package com.g123.sfems.module.system.dataimport;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.equipment.EquipmentRequest;
import com.g123.sfems.module.school.equipment.EquipmentService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Nhập hồ sơ tài sản ĐANG CÓ — dữ liệu chuyển từ sổ cũ, Excel của trường, phần
 * mềm trước đây. Tài sản mới mua thì đi qua phiếu nhập, không qua đây: nhập
 * hàng loạt là để đưa quá khứ vào sổ, không phải một đường ghi tăng không cần
 * duyệt.
 *
 * <p>Tham chiếu bằng MÃ (nhóm thiết bị, phòng, cán bộ quản lý), không bằng id:
 * người điền tệp nhìn thấy mã, không bao giờ thấy id.
 */
@Component
public class EquipmentImport implements ImportTarget<EquipmentImport.Row> {

    /**
     * Một dòng tệp đã đọc. {@code copies} &gt; 1 là thiết bị quản lý TỪNG CÁI khai gộp ("40 cái bàn") —
     * sổ vẫn ghi 40 hồ sơ, mỗi cái một mã chuẩn; vật tư tiêu hao thì một hồ sơ mang cả số lượng.
     */
    public record Row(EquipmentRequest request, int copies) {
    }

    /** Khai gộp tối đa ngần này cái trên một dòng — quá thì gần như chắc là gõ nhầm số. */
    private static final int MAX_COPIES = 500;

    private static final Map<EquipmentCondition, String> CONDITION = Map.of(
            EquipmentCondition.TOT, "Tốt", EquipmentCondition.TRUNG_BINH, "Trung bình",
            EquipmentCondition.KEM, "Kém", EquipmentCondition.HONG, "Hỏng");

    private static final Map<AssetStatus, String> STATUS = Map.of(
            AssetStatus.IN_STOCK, "Trong kho", AssetStatus.IN_USE, "Đang sử dụng", AssetStatus.BROKEN, "Hỏng",
            AssetStatus.PENDING_LIQUIDATION, "Chờ thanh lý",
            AssetStatus.PENDING_DESTRUCTION, "Chờ tiêu huỷ");

    /** Trạng thái được phép khi nhập: các trạng thái "đang mượn", "đang sửa"... phải sinh ra từ phiếu. */
    private static final Set<AssetStatus> IMPORTABLE = STATUS.keySet();

    private final JdbcTemplate jdbc;
    private final EquipmentService equipment;

    public EquipmentImport(JdbcTemplate jdbc, EquipmentService equipment) {
        this.jdbc = jdbc;
        this.equipment = equipment;
    }

    @Override
    public String name() {
        return "equipment";
    }

    @Override
    public String permission() {
        return "equipment:write";
    }

    @Override
    public String title() {
        return "Thiết bị đang có của trường";
    }

    @Override
    public List<Column> columns() {
        return List.of(
                new Column("code", "Mã cũ", false,
                        "Mã cũ trên tem, nếu có — giữ để tra cứu; mã chuẩn do hệ thống cấp. Chỉ ghi khi số lượng là 1"),
                new Column("name", "Tên thiết bị", true, ""),
                new Column("catalog", "Mã TB danh mục", true, "Theo Danh mục thiết bị, vd THCS-00-013"),
                new Column("quantity", "Số lượng", false,
                        "Để trống = 1. Thiết bị bền khai gộp thì hệ thống tách mỗi cái một hồ sơ; vật tư tiêu hao là một hồ sơ"),
                new Column("serial", "Số serial", false, ""),
                new Column("room", "Mã phòng", false, "Để trống = trong kho"),
                new Column("manager", "Mã cán bộ quản lý", false, ""),
                // Bốn cột bắt buộc dưới đây cùng mã chuẩn và đơn vị tính (hệ thống tự có) là đủ HỒ SƠ CHUẨN
                // (`Equipment.missingProfile`) — thiếu một cột là tài sản nhập vào không đưa được vào phiếu nào.
                new Column("originalValue", "Nguyên giá (đ)", true, "Giá của MỘT cái"),
                new Column("remainingValue", "Giá trị còn lại (đ)", false, "Để trống = bằng nguyên giá"),
                new Column("receivedDate", "Ngày tiếp nhận", true, "dd/mm/yyyy — ngày thiết bị về trường; không nhớ ngày thì ghi 01/01 của năm"),
                new Column("usageStartYear", "Năm đưa vào sử dụng", false, ""),
                new Column("originSource", "Nguồn hình thành", false,
                        "Kế hoạch mua sắm, Được cấp phát, bàn giao, Được tặng, tài trợ, Kiểm kê thừa, Đơn vị tự làm, Khác"),
                new Column("fundingSource", "Nguồn kinh phí", true,
                        "Ngân sách, Học phí, Nguồn thu sự nghiệp, Quỹ phát triển sự nghiệp, Tài trợ, Chưa xác định nguồn"),
                new Column("condition", "Tình trạng", false, "Tốt, Khá, Trung bình, Kém, Hỏng"),
                new Column("status", "Trạng thái", false, "Trong kho, Đang sử dụng, Hỏng, Chờ thanh lý, Chờ tiêu huỷ"),
                new Column("note", "Ghi chú", false, ""));
    }

    @Override
    public Parsed<Row> parse(Map<String, String> row, Long schoolId) {
        List<String> errors = new ArrayList<>();
        ImportValues v = new ImportValues(row, errors);
        String code = v.text("code", "mã cũ", false, 64);
        if (code != null && !code.matches("^[A-Za-z0-9._-]+$")) {
            errors.add("Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối");
        }
        String name = v.text("name", "tên thiết bị", true, 255);
        String catalogCode = v.text("catalog", "mã TB danh mục", true, 64);
        Long catalog = catalogCode == null ? null : id("SELECT id FROM equipment_catalogs WHERE UPPER(code) = UPPER(?)",
                catalogCode);
        if (catalogCode != null && catalog == null) {
            errors.add("Không có thiết bị mã \"" + catalogCode + "\" trong Danh mục thiết bị");
        }
        boolean bulk = catalog != null && "BULK".equals(jdbc.queryForObject(
                "SELECT tracking_type FROM equipment_catalogs WHERE id = ?", String.class, catalog));
        BigDecimal quantity = v.money("quantity", "Số lượng");
        if (quantity == null) {
            quantity = BigDecimal.ONE;
        } else if (quantity.signum() <= 0) {
            errors.add("Số lượng phải lớn hơn 0");
        }
        // Số lẻ chỉ với đơn vị chia được (kg, lít…) — kiểm ngay ở bước XEM TRƯỚC, không để tới lúc nhập.
        if (bulk && quantity.signum() > 0 && quantity.stripTrailingZeros().scale() > 0) {
            Boolean fraction = jdbc.queryForList("SELECT u.allows_fraction FROM equipment_catalogs c JOIN units u ON u.id = c.unit_id"
                    + " WHERE c.id = ?", Boolean.class, catalog).stream().findFirst().orElse(false);
            if (!Boolean.TRUE.equals(fraction)) {
                errors.add("Đơn vị tính của thiết bị này không chia lẻ được — nhập số nguyên");
            }
        }
        int copies = 1;
        if (!bulk && quantity.signum() > 0) {
            if (quantity.stripTrailingZeros().scale() > 0) {
                errors.add("Thiết bị quản lý từng cái không có số lượng lẻ");
            } else if (quantity.intValue() > MAX_COPIES) {
                errors.add("Một dòng khai tối đa " + MAX_COPIES + " cái — chia thành nhiều dòng");
            } else {
                copies = quantity.intValue();
            }
            if (copies > 1 && code != null) {
                errors.add("Mã cũ chỉ ghi được khi số lượng là 1 — mỗi cái một mã, khai thành từng dòng");
            }
        }
        String roomCode = v.text("room", "mã phòng", false, 64);
        Long room = roomCode == null ? null
                : id("SELECT id FROM rooms WHERE school_id = ? AND UPPER(code) = UPPER(?)", schoolId, roomCode);
        if (roomCode != null && room == null) {
            errors.add("Trường không có phòng mã \"" + roomCode + "\"");
        }
        String managerCode = v.text("manager", "mã cán bộ", false, 64);
        Long manager = managerCode == null ? null
                : id("SELECT id FROM staff WHERE school_id = ? AND UPPER(code) = UPPER(?)", schoolId, managerCode);
        if (managerCode != null && manager == null) {
            errors.add("Trường không có cán bộ mã \"" + managerCode + "\"");
        }
        BigDecimal original = v.money("originalValue", "Nguyên giá");
        BigDecimal remaining = v.money("remainingValue", "Giá trị còn lại");
        if (original != null && remaining != null && remaining.compareTo(original) > 0) {
            errors.add("Giá trị còn lại lớn hơn nguyên giá");
        }
        LocalDate received = v.date("receivedDate", "Ngày tiếp nhận");
        if (received == null && blank(row, "receivedDate")) {
            errors.add("Thiếu ngày tiếp nhận");
        }
        Integer startYear = v.integer("usageStartYear", "Năm đưa vào sử dụng", 1900, 2100);
        FundingSource funding = v.choice("fundingSource", "Nguồn kinh phí", FundingSource.class, FundingSource::label);
        if (funding == null && blank(row, "fundingSource")) {
            errors.add("Thiếu nguồn kinh phí — không rõ thì ghi \"Chưa xác định nguồn\"");
        }
        OriginRule origin = v.choice("originSource", "Nguồn hình thành", OriginRule.class, OriginRule::label);
        // Cùng luật với phiếu ghi tăng: báo ngay ở bước xem trước, không đợi tới lúc ghi.
        if (origin != null && funding != null && !origin.allows(funding)) {
            errors.add("Nguồn kinh phí \"" + funding.label() + "\" không đi với nguồn hình thành \"" + origin.label() + "\"");
        }
        Long originId = origin == null ? null : id("SELECT id FROM origin_sources WHERE code = ?", origin.name());
        EquipmentCondition condition = v.choice("condition", "Tình trạng", EquipmentCondition.class, CONDITION::get);
        AssetStatus status = v.choice("status", "Trạng thái", AssetStatus.class, STATUS::get);
        if (status != null && !IMPORTABLE.contains(status)) {
            errors.add("Trạng thái \"" + STATUS.getOrDefault(status, status.name())
                    + "\" không nhập được — chỉ sinh ra từ phiếu");
            status = null;
        }
        if (status == null) {
            status = room == null ? AssetStatus.IN_STOCK : AssetStatus.IN_USE;
        }
        String serial = v.text("serial", "Số serial", false, 100);
        String note = v.text("note", "Ghi chú", false, 500);
        if (copies > 1 && serial != null) {
            errors.add("Số serial chỉ ghi được khi số lượng là 1");
        }
        if (serial != null) {
            equipment.serialHolder(schoolId, serial, null)
                    .ifPresent(holder -> errors.add("Số serial \"" + serial + "\" đã có ở thiết bị " + holder));
        }
        if (!errors.isEmpty()) {
            return new Parsed<>(null, errors, code);
        }
        // Khai gộp: nguyên giá / giá trị còn lại trên dòng là của MỘT cái (như đơn giá trên hoá đơn).
        EquipmentRequest request = new EquipmentRequest(code, name, null, true, note, new IdRef(schoolId),
                new IdRef(catalog), null, null, serial, null, null, null, null, bulk ? quantity : BigDecimal.ONE,
                originId == null ? null : new IdRef(originId), null, funding, null,
                startYear, received, received, original, remaining, null, null, room == null ? null : new IdRef(room),
                manager == null ? null : new IdRef(manager), condition == null ? EquipmentCondition.TOT : condition,
                status, null, null);
        return new Parsed<>(new Row(request, copies), errors, code);
    }

    @Override
    public String codeLabel() {
        return "Mã cũ";
    }

    @Override
    public boolean exists(Long schoolId, String code) {
        // Mã cũ thành `legacy_code` khi nhập — nhập lại cùng một tệp phải bị bắt là trùng.
        return id("SELECT id FROM equipment WHERE school_id = ? AND (UPPER(code) = UPPER(?) OR UPPER(legacy_code) = UPPER(?))",
                schoolId, code, code) != null;
    }

    @Override
    public List<Unique> uniques(Row row) {
        String key = EquipmentService.normalizeSerial(row.request().serialNumber());
        return key == null ? List.of() : List.of(new Unique("Số serial", key, row.request().serialNumber().trim()));
    }

    @Override
    public void create(Row row) {
        for (int i = 0; i < row.copies(); i++) {
            equipment.create(row.request());
        }
    }

    /** Ô để trống — phân biệt với ô có chữ nhưng sai định dạng (lỗi đó ImportValues đã báo). */
    private static boolean blank(Map<String, String> row, String key) {
        String value = row.get(key);
        return value == null || value.isBlank();
    }

    private Long id(String sql, Object... args) {
        return jdbc.queryForList(sql, Long.class, args).stream().findFirst().orElse(null);
    }
}
