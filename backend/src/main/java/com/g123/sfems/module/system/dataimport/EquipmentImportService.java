package com.g123.sfems.module.system.dataimport;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.norm.office.SpreadsheetReader;
import com.g123.sfems.module.school.equipment.EquipmentRequest;
import com.g123.sfems.module.school.equipment.EquipmentService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Nhập thiết bị ban đầu từ tệp theo MẪU "Mẫu dữ liệu đầu vào.xlsx" (TS-07). Chỉ đọc trang "Thiết bị";
 * các trang khác của mẫu (cơ sở, cán bộ, khối nhà, phòng, lớp) không thuộc luồng này.
 *
 * <p>Hai bước: {@link #preview} kiểm tra và báo lỗi từng dòng, không ghi gì; {@link #commit} chỉ ghi khi
 * TOÀN BỘ tệp không có lỗi (một giao dịch, lỗi một dòng là huỷ cả tệp). Thiết bị được tạo qua
 * {@link EquipmentService#create}, nên mã chuẩn do hệ thống cấp; mã cũ của sổ đi vào {@code legacyCode}.
 *
 * <p>Thiết bị ngoài danh mục (mã không khớp nhóm nào) CHƯA nhập được: cần chốt loại thiết bị và môn mặc
 * định cho nhóm riêng của trường. Dòng như vậy bị báo lỗi.
 */
@Service
public class EquipmentImportService {

    static final String SHEET = "Thiết bị";
    /** Tiêu đề cột đúng như mẫu, đã bỏ "(*)" và phần ghi chú trong ngoặc. */
    static final List<String> HEADERS = List.of("Mã cũ", "Tên tài sản", "Mã thiết bị", "Số lượng", "Đơn vị tính",
            "Cách quản lý", "Số serial", "Mã phòng", "Mã cán bộ quản lý", "Nguyên giá", "Giá trị còn lại",
            "Ngày tiếp nhận", "Năm đưa vào sử dụng", "Nguồn hình thành", "Nguồn kinh phí", "Tình trạng", "Ghi chú");

    private static final int HEADER_INDEX = 3;     // dòng 4
    private static final int FIRST_DATA_INDEX = 5; // dòng 6, dòng 5 là hướng dẫn
    private static final Pattern YEAR = Pattern.compile("\\d{4}");
    private static final Pattern EXCEL_SERIAL_DATE = Pattern.compile("\\d{5}");
    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/uuuu");
    /** Trần số thiết bị tạo từ một dòng "từng cái", để một dòng ghi nhầm số lượng không tạo cả nghìn hồ sơ. */
    private static final BigDecimal MAX_SERIAL_COPIES = BigDecimal.valueOf(200);

    private final EntityManager entityManager;
    private final EquipmentService equipment;
    private final RowLevelPrincipalResolver principals;

    public EquipmentImportService(EntityManager entityManager, EquipmentService equipment,
            RowLevelPrincipalResolver principals) {
        this.entityManager = entityManager;
        this.equipment = equipment;
        this.principals = principals;
    }

    /** Kết quả kiểm tra: số dòng có dữ liệu, số dòng hợp lệ và danh sách lỗi theo dòng. */
    public record Preview(int rows, int valid, List<RowError> errors) {
    }

    public record RowError(int row, String message) {
    }

    /** Kiểm tra tệp, không ghi gì. */
    @Transactional(readOnly = true)
    public Preview preview(String filename, byte[] content) {
        Parsed parsed = parse(filename, content);
        return new Preview(parsed.rows(), parsed.lines().size(), parsed.errors());
    }

    /** Ghi tệp. Có bất kỳ lỗi nào thì không ghi dòng nào và báo lỗi đầu tiên. */
    @Transactional
    public int commit(String filename, byte[] content) {
        Parsed parsed = parse(filename, content);
        if (!parsed.errors().isEmpty()) {
            RowError first = parsed.errors().get(0);
            throw new FieldValidationException("file", "Tệp còn %d lỗi, chưa ghi dòng nào. Dòng %d: %s"
                    .formatted(parsed.errors().size(), first.row(), first.message()));
        }
        int created = 0;
        for (Line line : parsed.lines()) {
            for (int i = 0; i < line.copies(); i++) {
                try {
                    Equipment saved = equipment.create(line.request());
                    saved.setRoom(line.room());
                    saved.setManager(line.manager());
                    saved.setCondition(line.condition());
                    saved.setRemainingValue(line.remaining());
                    saved.setStatus(line.room() == null ? AssetStatus.IN_STOCK : AssetStatus.IN_USE);
                } catch (RuntimeException e) {
                    throw new FieldValidationException("file", "Dòng %d: %s (chưa ghi dòng nào)"
                            .formatted(line.row(), e.getMessage()));
                }
                created++;
            }
        }
        return created;
    }

    // ------------------------------------------------------------------ đọc và kiểm tra

    /** Một dòng đã kiểm tra đủ, sẵn sàng tạo {@code copies} thiết bị. */
    private record Line(int row, EquipmentRequest request, int copies, Room room, User manager,
            EquipmentCondition condition, BigDecimal remaining) {
    }

    private record Parsed(int rows, List<Line> lines, List<RowError> errors) {
    }

    private Parsed parse(String filename, byte[] content) {
        Long schoolId = currentSchoolId();
        List<List<String>> rows = sheetRows(filename, content);
        checkHeaders(rows);

        List<Line> lines = new ArrayList<>();
        List<RowError> errors = new ArrayList<>();
        int dataRows = 0;
        for (int index = FIRST_DATA_INDEX; index < rows.size(); index++) {
            List<String> cells = rows.get(index);
            if (cells.stream().allMatch(c -> c == null || c.isBlank())) {
                continue;
            }
            dataRows++;
            int row = index + 1;
            List<String> messages = new ArrayList<>();
            Line line = checkRow(row, cells, schoolId, messages);
            for (String message : messages) {
                errors.add(new RowError(row, message));
            }
            if (line != null && messages.isEmpty()) {
                lines.add(line);
            }
        }
        return new Parsed(dataRows, lines, errors);
    }

    private Long currentSchoolId() {
        Long schoolId = principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
        if (schoolId == null) {
            throw new FieldValidationException("file", "Chỉ tài khoản trường mới nhập thiết bị từ tệp");
        }
        return schoolId;
    }

    private static List<List<String>> sheetRows(String filename, byte[] content) {
        List<SpreadsheetReader.NamedSheet> sheets = SpreadsheetReader.readAll(filename, content);
        return sheets.stream()
                .filter(s -> SHEET.equalsIgnoreCase(s.name().trim()))
                .findFirst()
                .orElseThrow(() -> new FieldValidationException("file",
                        "Tệp không đúng mẫu: thiếu trang \"" + SHEET + "\". Dùng file \"Mẫu dữ liệu đầu vào\"."))
                .rows();
    }

    private static void checkHeaders(List<List<String>> rows) {
        List<String> header = rows.size() > HEADER_INDEX ? rows.get(HEADER_INDEX) : List.of();
        for (int i = 0; i < HEADERS.size(); i++) {
            String actual = normalizeHeader(i < header.size() ? header.get(i) : "");
            if (!HEADERS.get(i).equalsIgnoreCase(actual)) {
                throw new FieldValidationException("file", "Tệp không đúng mẫu: cột %d phải là \"%s\""
                        .formatted(i + 1, HEADERS.get(i)));
            }
        }
    }

    private static String normalizeHeader(String raw) {
        return (raw == null ? "" : raw).replaceAll("\\(.*?\\)", "").replace("*", "").trim().replaceAll("\\s+", " ");
    }

    private static String cell(List<String> cells, int index) {
        if (index >= cells.size() || cells.get(index) == null) {
            return "";
        }
        return cells.get(index).trim();
    }

    /** Kiểm tra một dòng. Trả về dòng đã dựng, hoặc null khi có lỗi (lỗi nằm trong {@code messages}). */
    private Line checkRow(int row, List<String> cells, Long schoolId, List<String> messages) {
        String oldCode = cell(cells, 0);
        String name = cell(cells, 1);
        String catalogCode = cell(cells, 2);
        String quantityText = cell(cells, 3);
        String unitName = cell(cells, 4);
        String serial = cell(cells, 6);
        String roomCode = cell(cells, 7);
        String managerName = cell(cells, 8);
        String originalText = cell(cells, 9);
        String remainingText = cell(cells, 10);
        String receivedText = cell(cells, 11);
        String yearText = cell(cells, 12);
        String originName = cell(cells, 13);
        String fundingText = cell(cells, 14);
        String conditionText = cell(cells, 15);
        String note = cell(cells, 16);

        if (name.isEmpty()) {
            messages.add("Thiếu tên tài sản");
        }
        EquipmentCatalog catalog = catalogCode.isEmpty() ? null : findCatalog(catalogCode, schoolId);
        if (catalogCode.isEmpty()) {
            messages.add("Thiếu mã thiết bị");
        } else if (catalog == null) {
            messages.add("Mã thiết bị \"" + catalogCode + "\" không có trong danh mục. Thiết bị ngoài danh mục"
                    + " chưa nhập được từ tệp");
        }

        BigDecimal quantity = BigDecimal.ONE;
        if (!quantityText.isEmpty()) {
            quantity = parseNumber(quantityText);
            if (quantity == null || quantity.signum() <= 0) {
                messages.add("Số lượng phải là số lớn hơn 0");
                quantity = BigDecimal.ONE;
            }
        }
        int copies = 1;
        BigDecimal perRecordQuantity = quantity;
        if (catalog != null && catalog.getTrackingType() == TrackingType.SERIAL) {
            if (quantity.stripTrailingZeros().scale() > 0) {
                messages.add("Thiết bị quản lý từng cái thì số lượng phải là số nguyên");
            } else if (quantity.compareTo(MAX_SERIAL_COPIES) > 0) {
                messages.add("Một dòng tối đa " + MAX_SERIAL_COPIES + " thiết bị quản lý từng cái, tách dòng để nhập tiếp");
            } else {
                copies = quantity.intValue();
                perRecordQuantity = BigDecimal.ONE;
            }
            if (copies > 1 && !serial.isEmpty()) {
                messages.add("Số serial chỉ ghi khi số lượng là 1");
            }
        }

        Unit unit = unitName.isEmpty() ? null : findUnit(unitName);
        if (!unitName.isEmpty() && unit == null) {
            messages.add("Đơn vị tính \"" + unitName + "\" chưa có trong danh mục");
        }

        Room room = null;
        if (!roomCode.isEmpty()) {
            room = findRoom(roomCode, schoolId);
            if (room == null) {
                messages.add("Mã phòng \"" + roomCode + "\" không có trong trường");
            }
        }

        User manager = null;
        if (!managerName.isEmpty()) {
            manager = findUser(managerName);
            if (manager == null) {
                messages.add("Tên đăng nhập cán bộ \"" + managerName + "\" không tồn tại");
            }
        }

        BigDecimal original = null;
        if (!originalText.isEmpty()) {
            original = parseNumber(originalText);
            if (original == null || original.signum() < 0) {
                messages.add("Nguyên giá không hợp lệ: " + originalText);
            }
        }
        BigDecimal remaining = original;
        if (!remainingText.isEmpty()) {
            remaining = parseNumber(remainingText);
            if (remaining == null || remaining.signum() < 0) {
                messages.add("Giá trị còn lại không hợp lệ: " + remainingText);
            }
        }

        Integer usageYear = null;
        if (!yearText.isEmpty()) {
            if (YEAR.matcher(yearText).matches()) {
                usageYear = Integer.valueOf(yearText);
            } else {
                messages.add("Năm đưa vào sử dụng phải đủ 4 chữ số: " + yearText);
            }
        }

        LocalDate received = parseDate(receivedText);
        if (!receivedText.isEmpty() && received == null) {
            messages.add("Ngày tiếp nhận phải dạng dd/mm/yyyy: " + receivedText);
        }
        if (received == null && usageYear != null) {
            received = LocalDate.of(usageYear, 1, 1); // mẫu: để trống thì lấy 01/01 của năm đưa vào sử dụng
        }

        FundingSource funding = fundingSource(fundingText);
        if (funding == null) {
            messages.add("Nguồn kinh phí không có trong danh sách: " + fundingText);
        }
        OriginSource origin = null;
        if (!originName.isEmpty()) {
            origin = findOriginSource(originName);
            if (origin == null) {
                messages.add("Nguồn hình thành \"" + originName + "\" không có trong danh mục");
            }
        }
        EquipmentCondition condition = conditionOf(conditionText);
        if (condition == null) {
            messages.add("Tình trạng không có trong danh sách: " + conditionText);
        }

        if (!messages.isEmpty() || catalog == null) {
            return null;
        }
        EquipmentRequest request = new EquipmentRequest(
                null, name, null, null, note.isEmpty() ? null : note, null,
                new IdRef(catalog.getId()), null, null,
                oldCode.isEmpty() ? null : oldCode,
                serial.isEmpty() ? null : serial,
                null, null,
                unit == null ? null : new IdRef(unit.getId()),
                perRecordQuantity,
                origin == null ? null : new IdRef(origin.getId()),
                null, funding, null, null, null,
                null, usageYear, received, null, original, null, null);
        return new Line(row, request, copies, room, manager, condition == null ? EquipmentCondition.TOT : condition,
                remaining);
    }

    // ------------------------------------------------------------------ tra cứu

    private EquipmentCatalog findCatalog(String code, Long schoolId) {
        List<EquipmentCatalog> found = entityManager.createQuery(
                        "select c from EquipmentCatalog c where lower(c.code) = lower(:code)"
                                + " and (c.ownerSchool is null or c.ownerSchool.id = :sid)", EquipmentCatalog.class)
                .setParameter("code", code)
                .setParameter("sid", schoolId)
                .getResultList();
        // Ưu tiên nhóm riêng của trường nếu trùng mã với nhóm của Sở.
        return found.stream().filter(c -> c.getOwnerSchool() != null).findFirst()
                .orElse(found.isEmpty() ? null : found.get(0));
    }

    private Unit findUnit(String name) {
        return entityManager.createQuery("select u from Unit u where lower(u.name) = lower(:name)", Unit.class)
                .setParameter("name", name).getResultList().stream().findFirst().orElse(null);
    }

    private OriginSource findOriginSource(String name) {
        return entityManager.createQuery(
                        "select o from OriginSource o where lower(o.name) = lower(:name)", OriginSource.class)
                .setParameter("name", name).getResultList().stream().findFirst().orElse(null);
    }

    private Room findRoom(String code, Long schoolId) {
        return entityManager.createQuery(
                        "select r from Room r where lower(r.code) = lower(:code) and r.school.id = :sid", Room.class)
                .setParameter("code", code).setParameter("sid", schoolId).getResultList().stream()
                .findFirst().orElse(null);
    }

    private User findUser(String username) {
        return entityManager.createQuery(
                        "select u from User u where lower(u.username) = lower(:name)", User.class)
                .setParameter("name", username).getResultList().stream().findFirst().orElse(null);
    }

    // ------------------------------------------------------------------ giá trị theo mẫu

    private static BigDecimal parseNumber(String text) {
        try {
            return new BigDecimal(text.replace(" ", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static LocalDate parseDate(String text) {
        if (text.isEmpty()) {
            return null;
        }
        if (EXCEL_SERIAL_DATE.matcher(text).matches()) {
            // Excel lưu ngày thành số đếm từ 30/12/1899.
            return LocalDate.of(1899, 12, 30).plusDays(Long.parseLong(text));
        }
        try {
            return LocalDate.parse(text, DMY);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** Nguồn kinh phí theo nhãn trong mẫu; để trống = chưa xác định. Trả null nếu không khớp. */
    private static FundingSource fundingSource(String text) {
        if (text.isEmpty()) {
            return FundingSource.UNDETERMINED;
        }
        for (FundingSource source : FundingSource.values()) {
            if (source.label().equalsIgnoreCase(text)) {
                return source;
            }
        }
        return null;
    }

    /** Tình trạng theo nhãn trong mẫu (kèm các nhãn cũ mẫu nhận); để trống = Tốt. Trả null nếu không khớp. */
    private static EquipmentCondition conditionOf(String text) {
        if (text.isEmpty()) {
            return EquipmentCondition.TOT;
        }
        return switch (text.toLowerCase(Locale.ROOT)) {
            case "tốt" -> EquipmentCondition.TOT;
            case "khá" -> EquipmentCondition.KHA;
            case "trung bình", "bình thường" -> EquipmentCondition.TRUNG_BINH;
            case "kém", "hỏng nhẹ" -> EquipmentCondition.KEM;
            case "hỏng", "hỏng nặng" -> EquipmentCondition.HONG;
            case "không sử dụng" -> EquipmentCondition.KHONG_SU_DUNG;
            default -> null;
        };
    }
}
