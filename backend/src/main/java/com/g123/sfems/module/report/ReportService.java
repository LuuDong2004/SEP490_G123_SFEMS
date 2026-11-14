package com.g123.sfems.module.report;

import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.procurement.AdequacyService;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bộ báo cáo nghiệp vụ. Mọi báo cáo trả về CÙNG một hình — tiêu đề, danh sách
 * cột có kiểu, và các dòng — để màn hình vẽ được bất kỳ báo cáo nào bằng một
 * bảng, và bộ xuất Excel ghi được bất kỳ báo cáo nào mà không cần biết nó là gì.
 * Thêm một báo cáo là thêm một nhánh ở {@link #build}, không thêm màn hình.
 *
 * <p>Danh mục bám mục 3.5.8 của hồ sơ mời thầu (Chương V, Sở GD&amp;ĐT TP.HCM): báo cáo
 * theo đơn vị, địa bàn, cấp học, loại thiết bị, tình trạng và nguồn hình thành; báo cáo
 * kiểm kê, bảo trì, sửa chữa, điều chuyển, mượn/trả và nhu cầu mua sắm — cộng ba bảng
 * tổng hợp ở các mục khác: cơ sở vật chất (3.5.2), thiết bị hư hỏng / cần thay thế
 * (3.5.6), đối chiếu định mức (3.5.7).
 *
 * <p>Mọi truy vấn gộp trên {@link VisibleSchools}: Sở thấy toàn ngành, UBND thấy
 * địa bàn, trường thấy trường mình — cùng một báo cáo, ba phạm vi. Bộ lọc của người
 * xem (cơ quan quản lý, cấp học, trường) chỉ THU HẸP thêm trong phạm vi đó, không
 * bao giờ nới rộng nó: {@link #scope} nối cả hai bằng {@code AND}.
 */
@Service
@Transactional(readOnly = true)
public class ReportService {

    /** Kiểu cột: {@code text}, {@code number}, {@code money}, {@code date}. */
    public record Column(String key, String label, String type) {
    }

    /**
     * @param totals số của dòng "Tổng" cho cột KHÔNG cộng dồn được (vd. số người khác nhau) — màn hình lấy số ở đây
     *               thay vì cộng các dòng; cột không có ở đây thì cộng như thường.
     */
    public record Report(String name, String title, String subtitle, List<Column> columns,
            List<Map<String, Object>> rows, Map<String, Object> totals) {

        /**
         * Cột giá trị tài sản không lên báo cáo: nguyên giá không bắt buộc (HSMT 3.5.3 "theo dữ liệu được cung
         * cấp"), nên cộng nó ra là con số thiếu mà trông như đủ. Gỡ ở MỘT chỗ để báo cáo nào cũng vậy, kể cả
         * bản xuất Excel; truy vấn có tính thì cứ tính, chỉ không đưa ra.
         */
        static final Set<String> ASSET_VALUE_COLUMNS = Set.of(
                "original_value", "remaining_value", "depreciation", "value", "unvalued");

        public Report {
            columns = columns.stream().filter(c -> !ASSET_VALUE_COLUMNS.contains(c.key())).toList();
            totals = totals == null ? Map.of() : totals;
        }

        public Report(String name, String title, String subtitle, List<Column> columns,
                List<Map<String, Object>> rows) {
            this(name, title, subtitle, columns, rows, Map.of());
        }
    }

    /** Một chiều tổng hợp người xem chọn được ("theo đơn vị", "theo cấp học"...). */
    public record Group(String key, String label) {
    }

    /**
     * @param groups  các chiều tổng hợp báo cáo nhận (tham số {@code group}); rỗng là báo cáo có một hình cố
     *                định. Chiều đầu tiên là mặc định.
     * @param choices các giá trị của ô chọn riêng của báo cáo (tham số {@code choice}) — vd. trạng thái của
     *                danh sách thiết bị; rỗng là không có ô đó. Giá trị đầu là mặc định.
     */
    public record Definition(String name, String title, String description, boolean period, boolean year,
            List<Group> groups, List<Group> choices, List<ReportFilters.Filter> filters) {

        /** Bộ lọc theo tài sản (loại, trạng thái, tình trạng) lấy theo tên báo cáo ở {@link ReportFilters}. */
        Definition(String name, String title, String description, boolean period, boolean year, List<Group> groups,
                List<Group> choices) {
            this(name, title, description, period, year, groups, choices, ReportFilters.of(name));
        }

        Definition(String name, String title, String description, boolean period, boolean year, List<Group> groups) {
            this(name, title, description, period, year, groups, List.of());
        }
    }

    /**
     * Tham số của một lần xem. {@code bodyId}, {@code levelId}, {@code schoolId} lọc theo cơ quan quản lý
     * (địa bàn), cấp học, trường; {@code group} chọn chiều tổng hợp; {@code typeId}, {@code status},
     * {@code condition} lọc tài sản theo loại thiết bị, trạng thái, tình trạng ({@link ReportFilters}).
     */
    public record Params(LocalDate from, LocalDate to, Integer year, Long bodyId, Long levelId, Long schoolId,
            String group, String choice, Long typeId, String status, String condition) {

        public Params(LocalDate from, LocalDate to, Integer year, Long bodyId, Long levelId, Long schoolId,
                String group, String choice) {
            this(from, to, year, bodyId, levelId, schoolId, group, choice, null, null, null);
        }

        boolean filtered() {
            return bodyId != null || levelId != null || schoolId != null;
        }
    }

    private static final Group BY_SCHOOL = new Group("school", "Theo đơn vị");
    private static final Group BY_BODY = new Group("body", "Theo địa bàn (cơ quan quản lý)");
    private static final Group BY_LEVEL = new Group("level", "Theo cấp học");
    private static final Group BY_TYPE = new Group("type", "Theo loại thiết bị");
    private static final Group BY_ORIGIN = new Group("origin", "Theo nguồn hình thành");
    private static final Group BY_ROOM_TYPE = new Group("room_type", "Theo loại phòng");
    private static final Group BY_BUILDING = new Group("building", "Chi tiết từng khối nhà");
    private static final Group BY_ROOM = new Group("room", "Chi tiết từng phòng");
    private static final Group BY_PURPOSE = new Group("purpose", "Theo mục đích");
    private static final Group BY_SUBJECT = new Group("subject", "Theo môn học");
    private static final Group BY_BORROWER = new Group("borrower", "Theo người mượn");

    private static final List<Group> IDLE_CHOICES = List.of(new Group("180", "Từ 6 tháng"),
            new Group("90", "Từ 3 tháng"), new Group("365", "Từ 1 năm"));
    private static final List<Group> STALE_CHOICES = List.of(new Group("90", "Quá 90 ngày"),
            new Group("30", "Quá 30 ngày"), new Group("180", "Quá 180 ngày"));
    private static final List<Group> LEDGER_CHOICES = AnalysisReports.LEDGERS.entrySet().stream()
            .map(e -> new Group(e.getKey(), e.getValue()[0])).toList();

    /**
     * Trạng thái chọn được ở "Danh sách thiết bị theo trạng thái" (tham số {@code choice}) — cùng tập với bộ lọc
     * trạng thái dùng chung, nên nằm ở {@link ReportFilters}: khoá → các trạng thái gộp.
     */
    private static final Map<String, String> LIST_STATUSES = ReportFilters.STATUS_SQL;

    private static final List<Group> STATUS_CHOICES = ReportFilters.STATUS_CHOICES;

    /** Thứ tự ở đây là thứ tự trên menu: tài sản, cơ sở vật chất, hư hỏng, kiểm kê, sửa chữa, biến động, mua sắm, định mức, dữ liệu. */
    public static final List<Definition> DEFINITIONS = List.of(
            new Definition("equipment-by-school", "Tổng hợp thiết bị",
                    "Số lượng, tình trạng và giá trị thiết bị đang trong hệ thống — gộp theo đơn vị, địa bàn, cấp học, "
                            + "loại thiết bị hoặc nguồn hình thành.",
                    false, false, List.of(BY_SCHOOL, BY_BODY, BY_LEVEL, BY_TYPE, BY_ORIGIN)),
            new Definition("equipment-by-catalog", "Tổng hợp thiết bị theo danh mục",
                    "Mỗi thiết bị trong danh mục: số lượng trong hệ thống, đang dùng, hỏng, có ở bao nhiêu trường.",
                    false, false, List.of()),
            new Definition("equipment-by-status", "Thiết bị theo trạng thái sử dụng",
                    "Thiết bị trong hệ thống đang ở đâu trong vòng đời: trong kho, đang dùng, cho mượn, bảo trì, sửa chữa, "
                            + "hỏng, báo mất, chờ thanh lý.",
                    false, false, List.of(BY_SCHOOL, BY_BODY, BY_LEVEL, BY_TYPE)),
            new Definition("equipment-by-condition", "Thiết bị theo tình trạng kỹ thuật",
                    "Tình trạng kỹ thuật ghi trên hồ sơ thiết bị: tốt, khá, trung bình, kém, hỏng, không sử dụng được.",
                    false, false, List.of(BY_SCHOOL, BY_BODY, BY_LEVEL, BY_TYPE)),
            new Definition("equipment-list", "Danh sách thiết bị theo trạng thái",
                    "Từng thiết bị đang ở một trạng thái — trong kho, đang dùng, đang mượn, bảo trì, sửa chữa, hỏng "
                            + "hoặc mất, chờ thanh lý — kèm chỗ để, người quản lý và giá trị.",
                    false, false, List.of(), STATUS_CHOICES),
            new Definition("facilities", "Tổng hợp cơ sở vật chất",
                    "Điểm trường, khối nhà, phòng, diện tích và tình trạng phòng — theo đơn vị, địa bàn, cấp học "
                            + "hoặc loại phòng; hoặc liệt kê từng khối nhà, từng phòng đang có.",
                    false, false, List.of(BY_SCHOOL, BY_BODY, BY_LEVEL, BY_ROOM_TYPE, BY_BUILDING, BY_ROOM)),
            CsvcStatisticsReport.DEFINITION,
            new Definition("equipment-ledger", "Bảng theo dõi thiết bị",
                    "Bảng theo dõi thiết bị còn trong hệ thống — từng thiết bị kèm chứng từ ghi tăng, ngày nhận, nguyên giá, hao "
                            + "mòn, còn lại, chỗ để, người quản lý. Chọn bảng: thiết bị, tài sản cố định, công cụ dụng cụ, "
                            + "vật tư hoá chất.",
                    false, false, List.of(), LEDGER_CHOICES),
            new Definition("room-usage", "Sử dụng phòng bộ môn, phòng chức năng",
                    "Mỗi phòng cho mượn: số lượt mượn, số tiết đã dùng trong kỳ, tiết thực hành / lý thuyết, lần "
                            + "mượn gần nhất, số lần trả phòng có vấn đề.",
                    true, false, List.of()),
            new Definition("room-standard", "Đánh giá chuẩn phòng bộ môn",
                    "Mỗi phòng bộ môn: thiết bị phải có theo định mức \"tính cho 01 phòng\" của môn, đang đặt tại "
                            + "phòng đủ chưa — kèm diện tích, sức chứa, kết luận đạt / chưa đạt.",
                    false, false, List.of()),
            new Definition("broken-equipment", "Thiết bị hư hỏng, mất, cần thay thế",
                    "Thiết bị đang hỏng, đang sửa hoặc bảo hành, bị báo mất, và thiết bị không còn dùng được cần thay "
                            + "thế, thanh lý.",
                    false, false, List.of()),
            SupplyReports.EXPIRY,
            new Definition("unused-equipment", "Thiết bị không còn sử dụng",
                    "Thiết bị còn trong hệ thống mà không còn dùng được: hỏng chờ xử lý, tình trạng hỏng, "
                            + "đã duyệt thanh lý / tiêu huỷ — kèm lý do để biết bước kế tiếp.",
                    false, false, List.of()),
            new Definition("idle-equipment", "Thiết bị nằm kho kéo dài",
                    "Thiết bị trong kho lâu không phát sinh sử dụng (cấp phát, mượn, sửa, bảo trì…), tính từ lần dùng "
                            + "gần nhất hoặc ngày tiếp nhận.",
                    false, false, List.of(), IDLE_CHOICES),
            new Definition("damage-trends", "Xu hướng hư hỏng",
                    "Thiết bị nào hay hỏng: lượt báo hỏng trong kỳ so với kỳ liền trước, số thiết bị bị báo hỏng và "
                            + "tỷ lệ trên số đang có.",
                    true, false, List.of()),
            new Definition("inventory", "Kết quả kiểm kê",
                    "Mỗi phiên kiểm kê trong kỳ: số thiết bị kiểm, tìm thấy, thiếu, thừa, sai vị trí, sai tình trạng.",
                    true, false, List.of()),
            new Definition("maintenance", "Bảo trì, sửa chữa",
                    "Số phiếu sửa chữa, bảo hành, bảo trì trong kỳ, kết quả và chi phí dự kiến / thực tế.",
                    true, false, List.of(BY_SCHOOL, BY_BODY, BY_LEVEL)),
            new Definition("movements", "Tăng, giảm thiết bị",
                    "Ghi tăng, cấp phát, điều chuyển, mượn, báo hỏng, sửa chữa, thanh lý... trong kỳ, theo tháng.",
                    true, false, List.of()),
            new Definition("transfers", "Lịch sử điều chuyển thiết bị",
                    "Từng lần thiết bị đổi chỗ trong kỳ — cấp phát, thu hồi, chuyển phòng, điều chuyển giữa trường: "
                            + "từ đâu, đến đâu, theo phiếu nào.",
                    true, false, List.of()),
            new Definition("overdue-loans", "Thiết bị mượn quá hạn",
                    "Các phiếu mượn đã quá hạn trả mà chưa trả.", false, false, List.of()),
            new Definition("loans", "Thống kê mượn trả",
                    "Phiếu mượn, lượt thiết bị, đã trả / chưa trả, quá hạn, trả hỏng, báo mất, người mượn và lượt "
                            + "mượn theo phòng trong kỳ — theo đơn vị, địa bàn, cấp học, mục đích, môn học hoặc người "
                            + "mượn. Bấm một dòng để xem các phiếu của dòng đó.",
                    true, false, List.of(BY_SCHOOL, BY_BODY, BY_LEVEL, BY_PURPOSE, BY_SUBJECT, BY_BORROWER)),
            new Definition("utilization", "Hiệu quả khai thác thiết bị",
                    "Tỷ lệ thiết bị đang dùng, số lượt mượn thiết bị và mượn phòng trong kỳ, và thiết bị nằm kho không "
                            + "phát sinh sử dụng trong kỳ.",
                    true, false, List.of(BY_SCHOOL, BY_BODY, BY_LEVEL, BY_TYPE)),
            SupplyReports.CONSUMPTION,
            new Definition("purchase", "Tổng hợp nhu cầu mua sắm",
                    "Đề xuất mua sắm của năm ngân sách — theo địa bàn, cấp học, đơn vị hoặc loại thiết bị.",
                    false, true, List.of(BY_BODY, BY_LEVEL, BY_SCHOOL, BY_TYPE)),
            new Definition("adequacy", "Mức đáp ứng danh mục thiết bị tối thiểu",
                    "Mỗi trường đạt bao nhiêu định mức, còn thiếu bao nhiêu thiết bị.", false, false, List.of()),
            new Definition("data-quality", "Chất lượng dữ liệu theo trường",
                    "Hồ sơ thiết bị còn thiếu gì ở mỗi trường: mã chuẩn, đơn vị tính, nguồn kinh phí, ngày tiếp nhận, "
                            + "nguyên giá, chỗ để, người quản lý — và tỷ lệ hồ sơ chuẩn.",
                    false, false, List.of(BY_SCHOOL, BY_BODY, BY_LEVEL)),
            new Definition("data-anomalies", "Thiết bị có dữ liệu bất thường",
                    "Từng thiết bị có dữ liệu mâu thuẫn: còn lại lớn hơn nguyên giá, nguyên giá ≤ 0, ngày nhận ở "
                            + "tương lai, trạng thái không khớp chỗ để / tình trạng, trùng số serial…",
                    false, false, List.of()),
            new Definition("last-update", "Thời điểm cập nhật dữ liệu của đơn vị",
                    "Mỗi trường lần cuối cập nhật thiết bị, phiếu, cơ sở vật chất lúc nào, cách đây bao nhiêu ngày.",
                    false, false, List.of()),
            new Definition("stale-schools", "Đơn vị chưa cập nhật dữ liệu",
                    "Trường chưa có dữ liệu, chưa nhập thiết bị, hoặc không cập nhật gì quá số ngày đã chọn.",
                    false, false, List.of(), STALE_CHOICES),
            new Definition("vouchers", "Tình hình xử lý chứng từ",
                    "Mỗi loại phiếu lập trong kỳ: bao nhiêu nháp, chờ duyệt, hoàn tất, bị từ chối, huỷ.",
                    true, false, List.of()),
            new Definition("disposals", "Thiết bị ghi giảm",
                    "Thiết bị thanh lý, tiêu huỷ, ghi giảm do mất trong kỳ, kèm nguyên giá và số thu về.",
                    true, false, List.of()));

    private static final Map<String, String> VOUCHER_TABLES = new LinkedHashMap<>();

    static {
        VOUCHER_TABLES.put("equipment_intakes", "Phiếu ghi tăng");
        VOUCHER_TABLES.put("equipment_allocations", "Cấp phát, thu hồi");
        VOUCHER_TABLES.put("equipment_transfers", "Điều chuyển giữa trường");
        VOUCHER_TABLES.put("equipment_loans", "Mượn, trả");
        VOUCHER_TABLES.put("damage_reports", "Báo hỏng, sửa chữa");
        VOUCHER_TABLES.put("inventory_sessions", "Kiểm kê");
        VOUCHER_TABLES.put("disposals", "Thanh lý, ghi giảm");
        VOUCHER_TABLES.put("purchase_proposals", "Đề xuất mua sắm");
        VOUCHER_TABLES.put("repair_orders", "Sửa chữa, bảo trì");
        VOUCHER_TABLES.put("warranty_claims", "Bảo hành");
        VOUCHER_TABLES.put("maintenance_orders", "Bảo dưỡng");
        VOUCHER_TABLES.put("stock_issues", "Xuất kho vật tư");
        VOUCHER_TABLES.put("storage_orders", "Lưu kho");
        VOUCHER_TABLES.put("depreciation_orders", "Tính hao mòn");
        VOUCHER_TABLES.put("consumption_records", "Tiêu hao theo tiết");
        VOUCHER_TABLES.put("room_bookings", "Mượn phòng bộ môn");
    }

    static Map<String, String> voucherTables() {
        return VOUCHER_TABLES;
    }

    private static final Map<String, String> HISTORY_LABELS = Map.ofEntries(
            Map.entry("GHI_TANG", "Ghi tăng"), Map.entry("CAP_NHAT", "Cập nhật"), Map.entry("CAP_PHAT", "Cấp phát"),
            Map.entry("THU_HOI", "Thu hồi"), Map.entry("DIEU_CHUYEN", "Điều chuyển"), Map.entry("MUON", "Cho mượn"),
            Map.entry("TRA", "Trả"), Map.entry("BAO_HONG", "Báo hỏng"), Map.entry("SUA_CHUA", "Sửa chữa"),
            Map.entry("BAO_HANH", "Bảo hành"), Map.entry("BAO_TRI", "Bảo trì"), Map.entry("KIEM_KE", "Kiểm kê"),
            Map.entry("CHO_THANH_LY", "Chờ thanh lý"), Map.entry("THANH_LY", "Thanh lý"),
            Map.entry("CHO_TIEU_HUY", "Chờ tiêu huỷ"), Map.entry("TIEU_HUY", "Tiêu huỷ"),
            Map.entry("MAT", "Mất"));

    /** Tài sản đã ra khỏi sổ — không đếm vào "đang có". */
    static final String OFF_BOOK = " ('LIQUIDATED', 'DESTROYED', 'LOST', 'USED_UP', 'NOT_DELIVERED') ";

    /** Phiếu chưa hoặc không đi vào nghiệp vụ: nháp, huỷ, bị từ chối. */
    static final String NOT_LIVE = " ('DRAFT', 'CANCELLED', 'REJECTED') ";

    /** Danh sách chi tiết không trả quá ngần này dòng — xuất Excel cùng giới hạn; lọc hẹp lại để xem phần còn lại. */
    static final int LIST_LIMIT = 5000;

    private final JdbcTemplate jdbc;
    private final VisibleSchools visible;
    private final AdequacyService adequacy;
    private final AnalysisReports analysis;
    private final SupplyReports supply;
    private final CsvcStatisticsReport csvc;

    public ReportService(JdbcTemplate jdbc, VisibleSchools visible, AdequacyService adequacy) {
        this.jdbc = jdbc;
        this.visible = visible;
        this.adequacy = adequacy;
        this.analysis = new AnalysisReports(jdbc, this);
        this.supply = new SupplyReports(jdbc, this);
        this.csvc = new CsvcStatisticsReport(jdbc, this);
    }

    /**
     * Biểu số liệu CSVC ra tệp Excel đúng bố cục mẫu Sở — khác bản xuất chung (một hàng tiêu đề) của mọi báo cáo
     * khác. Cùng tham số, cùng phạm vi với khi xem.
     */
    public byte[] csvcWorkbook(Params params) {
        Params p = ReportFilters.only(params, ReportFilters.of(CsvcStatisticsReport.NAME));
        return CsvcStatisticsXlsx.write(csvc.header(p), csvc.build(p).rows());
    }

    /** Các phiếu của một dòng "Thống kê mượn trả" — dòng có khoá {@code key} ở chiều {@code params.group()}. */
    public Report loanRows(Params params, String key) {
        Params p = ReportFilters.only(params, ReportFilters.of("loans"));
        LocalDate to = p.to() == null ? LocalDate.now() : p.to();
        LocalDate from = p.from() == null ? to.withDayOfYear(1) : p.from();
        Definition definition = DEFINITIONS.stream().filter(d -> d.name().equals("loans")).findFirst().orElseThrow();
        String group = definition.groups().stream().map(Group::key).filter(k -> k.equals(p.group())).findFirst()
                .orElse(definition.groups().getFirst().key());
        Report report = analysis.loanRows(p, group, key, from, to, "Từ %s đến %s".formatted(vn(from), vn(to)));
        for (Map<String, Object> row : report.rows()) {
            row.replaceAll((k, v) -> v instanceof Date d ? d.toLocalDate() : v);
        }
        return report;
    }

    public Report build(String name, Params params) {
        // Bộ lọc theo tài sản báo cáo không nhận thì gạt đi trước khi tính, không lặng lẽ áp vào truy vấn khác nghĩa.
        Report report = compute(name, ReportFilters.only(params, ReportFilters.of(name)));
        // Cột ngày từ JDBC là java.sql.Date, mà Jackson ghi nó thành MỘT THỜI ĐIỂM theo UTC — 16/10 ở Việt Nam ra
        // "2026-10-15T17:00:00Z", và màn hình đọc nhầm sang ngày hôm trước. Đổi về ngày lịch thuần trước khi trả.
        for (Map<String, Object> row : report.rows()) {
            row.replaceAll((k, v) -> v instanceof Date d ? d.toLocalDate() : v);
        }
        return report;
    }

    private Report compute(String name, Params params) {
        LocalDate to = params.to() == null ? LocalDate.now() : params.to();
        LocalDate from = params.from() == null ? to.withDayOfYear(1) : params.from();
        String period = "Từ %s đến %s".formatted(vn(from), vn(to));
        Definition definition = DEFINITIONS.stream().filter(d -> d.name().equals(name)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Report", name));
        // Chiều lạ thì về chiều mặc định thay vì lỗi — cùng tinh thần với bộ lọc lạ ở mọi danh sách.
        String group = definition.groups().stream().map(Group::key)
                .filter(k -> k.equals(params.group())).findFirst()
                .orElse(definition.groups().isEmpty() ? "school" : definition.groups().getFirst().key());
        return switch (name) {
            case "equipment-by-school" -> equipmentSummary(params, group);
            case "equipment-by-catalog" -> equipmentByCatalog(params);
            case "equipment-by-status" -> equipmentByStatus(params, group);
            case "equipment-by-condition" -> equipmentByCondition(params, group);
            case "equipment-list" -> equipmentList(params, definition.choices().stream().map(Group::key)
                    .filter(k -> k.equals(params.choice())).findFirst().orElse("IN_STOCK"));
            case "transfers" -> transfers(params, from, to, period);
            case "utilization" -> utilization(params, group, from, to, period);
            case "data-quality" -> dataQuality(params, group);
            case "facilities" -> facilities(params, group);
            case CsvcStatisticsReport.NAME -> csvc.build(params);
            case "broken-equipment" -> brokenEquipment(params);
            case "inventory" -> inventory(params, from, to, period);
            case "maintenance" -> maintenance(params, group, from, to, period);
            case "movements" -> movements(params, from, to, period);
            case "vouchers" -> vouchers(params, from, to, period);
            case "adequacy" -> adequacyReport(params);
            case "overdue-loans" -> overdueLoans(params);
            case "disposals" -> disposals(params, from, to, period);
            case "unused-equipment" -> analysis.unused(params);
            case "idle-equipment" -> analysis.idle(params, Integer.parseInt(choice(definition, params)));
            case "loans" -> analysis.loans(params, group, from, to, period);
            case "damage-trends" -> analysis.damageTrends(params, from, to, period);
            case "last-update" -> analysis.lastUpdate(params, null);
            case "stale-schools" -> analysis.lastUpdate(params, Integer.parseInt(choice(definition, params)));
            case "data-anomalies" -> analysis.anomalies(params);
            case "equipment-ledger" -> analysis.ledger(params, choice(definition, params));
            case "room-usage" -> analysis.roomUsage(params, from, to, period);
            case "room-standard" -> analysis.roomStandard(params);
            case "supply-consumption" -> supply.consumption(params, group, from, to, period);
            case "supply-expiry" -> supply.expiry(params, choice(definition, params));
            case "purchase" -> purchase(params, group,
                    params.year() == null ? LocalDate.now().getYear() + 1 : params.year());
            default -> throw new ResourceNotFoundException("Report", name);
        };
    }

    /** Giá trị của ô chọn riêng: giá trị gửi lên nếu báo cáo có nó, không thì giá trị đầu (mặc định). */
    private static String choice(Definition definition, Params params) {
        return definition.choices().stream().map(Group::key).filter(k -> k.equals(params.choice())).findFirst()
                .orElse(definition.choices().getFirst().key());
    }

    // ------------------------------------------------------------------ chiều tổng hợp

    /**
     * Một chiều tổng hợp dịch ra SQL: biểu thức nhãn, biểu thức mã (chỉ chiều "đơn vị" có), các JOIN cần thêm,
     * mệnh đề GROUP BY và tên cột. Truy vấn dùng nó đặt bí danh {@code s} cho {@code schools}, {@code e} cho
     * {@code equipment}, {@code r} cho {@code rooms}.
     */
    record Dim(String label, String code, String joins, String groupBy, String header) {

        String select() {
            return label + " AS name" + (code == null ? "" : ", " + code + " AS code");
        }
    }

    static Dim dim(String group) {
        return switch (group) {
            case "body" -> new Dim("COALESCE(dob.name, 'Chưa có cơ quan quản lý')", null,
                    " LEFT JOIN departments_of_education dob ON dob.id = s.department_of_education_id ",
                    "dob.id, dob.name", "Cơ quan quản lý (địa bàn)");
            case "level" -> new Dim("COALESCE(lv.name, 'Chưa xác định cấp học')", null,
                    " LEFT JOIN education_levels lv ON lv.id = s.education_level_id ",
                    "lv.id, lv.name, lv.sort_order", "Cấp học");
            case "type" -> new Dim("COALESCE(et.name, 'Chưa phân loại')", null,
                    " LEFT JOIN equipment_catalogs gc ON gc.id = e.catalog_id"
                            + " LEFT JOIN equipment_types et ON et.id = gc.equipment_type_id ",
                    "et.id, et.name", "Loại thiết bị");
            case "origin" -> new Dim("COALESCE(os.name, 'Chưa khai nguồn hình thành')", null,
                    " LEFT JOIN origin_sources os ON os.id = e.origin_source_id ",
                    "os.id, os.name", "Nguồn hình thành");
            case "room_type" -> new Dim("COALESCE(rt.name, 'Chưa phân loại')", null,
                    " LEFT JOIN room_types rt ON rt.id = r.room_type_id ",
                    "rt.id, rt.name", "Loại phòng");
            default -> new Dim("s.name", "s.code", " ", "s.id, s.code, s.name", "Trường");
        };
    }

    /** Cột đầu của một báo cáo gộp theo chiều: mã trường (chỉ khi gộp theo đơn vị), rồi nhãn của chiều. */
    private static List<Column> leadColumns(Dim d) {
        List<Column> cols = new ArrayList<>();
        if (d.code() != null) {
            cols.add(col("code", "Mã trường", "text"));
        }
        cols.add(col("name", d.header(), "text"));
        return cols;
    }

    // ------------------------------------------------------------------ các báo cáo

    private Report equipmentSummary(Params p, String group) {
        Dim d = dim(group);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT " + d.select()
                + ", COUNT(DISTINCT e.school_id) AS schools, COUNT(e.id) AS total,"
                + " COUNT(e.id) FILTER (WHERE e.status = 'IN_USE') AS in_use,"
                + " COUNT(e.id) FILTER (WHERE e.status = 'IN_STOCK') AS in_stock,"
                + " COUNT(e.id) FILTER (WHERE e.status IN ('BROKEN', 'UNREPAIRABLE', 'REPAIRING', 'WARRANTY')) AS broken,"
                + " COUNT(e.id) FILTER (WHERE e.status = 'MISSING') AS missing,"
                + " COUNT(e.id) FILTER (WHERE e.status IN ('PENDING_LIQUIDATION', 'PENDING_DESTRUCTION')) AS pending_liquidation,"
                + " COALESCE(SUM(e.original_value), 0) AS original_value,"
                + " COALESCE(SUM(e.remaining_value), 0) AS remaining_value"
                + " FROM equipment e JOIN schools s ON s.id = e.school_id" + d.joins()
                + " WHERE e.status NOT IN" + OFF_BOOK + assets("e", p)
                + " GROUP BY " + d.groupBy() + " ORDER BY total DESC, name");
        List<Column> columns = leadColumns(d);
        if (d.code() == null) {
            columns.add(col("schools", "Số trường", "number"));
        }
        columns.addAll(List.of(col("total", "Tổng số", "number"), col("in_use", "Đang dùng", "number"),
                col("in_stock", "Trong kho", "number"), col("broken", "Hỏng / đang sửa", "number"),
                col("missing", "Chờ ghi giảm do mất", "number"), col("pending_liquidation", "Chờ thanh lý / tiêu huỷ", "number"),
                col("original_value", "Nguyên giá (đ)", "money"),
                col("remaining_value", "Giá trị còn lại (đ)", "money")));
        return new Report("equipment-by-school", "Tổng hợp thiết bị " + groupTitle(group), subtitle(p, null),
                columns, rows);
    }

    private Report equipmentByCatalog(Params p) {
        // Nhiều trường: thiết bị ngoài danh mục (mỗi trường đặt tên một kiểu) gộp thành MỘT dòng "Khác", cuối bảng.
        String other = otherCatalog("c", p);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT CASE WHEN " + other + " THEN NULL ELSE c.code END AS catalog_code,"
                + " CASE WHEN " + other + " THEN '" + OTHER_LABEL + "' ELSE c.name END AS catalog,"
                + " CASE WHEN " + other + " THEN NULL ELSE t.name END AS type, COUNT(e.id) AS total,"
                + " COUNT(e.id) FILTER (WHERE e.status = 'IN_USE') AS in_use,"
                + " COUNT(e.id) FILTER (WHERE e.status IN ('BROKEN', 'UNREPAIRABLE', 'REPAIRING', 'WARRANTY')) AS broken,"
                + " COUNT(DISTINCT e.school_id) AS schools, COALESCE(SUM(e.original_value), 0) AS original_value"
                + " FROM equipment e JOIN equipment_catalogs c ON c.id = e.catalog_id"
                + " LEFT JOIN equipment_types t ON t.id = c.equipment_type_id"
                + " WHERE e.status NOT IN" + OFF_BOOK + assets("e", p)
                + " GROUP BY CASE WHEN " + other + " THEN 0 ELSE c.id END, 1, 2, 3"
                + " ORDER BY bool_or(" + other + "), total DESC");
        return new Report("equipment-by-catalog", "Tổng hợp thiết bị theo danh mục", subtitle(p, null),
                List.of(col("catalog_code", "Mã DM thiết bị", "text"), col("catalog", "Thiết bị", "text"),
                        col("type", "Loại", "text"), col("total", "Tổng số", "number"),
                        col("in_use", "Đang dùng", "number"), col("broken", "Hỏng / đang sửa", "number"),
                        col("schools", "Số trường có", "number"), col("original_value", "Nguyên giá (đ)", "money")),
                rows);
    }

    /**
     * Cơ sở vật chất (mục 3.5.2). Theo một chiều của trường thì tính từng trường trước rồi mới gộp: điểm trường,
     * khối nhà và phòng nằm ở ba bảng, JOIN thẳng cả ba sẽ nhân dòng. Gộp theo loại phòng thì chỉ có phòng.
     */
    private Report facilities(Params p, String group) {
        // Hiện trạng công trình (`FacilityCondition`) — KHÁC tình trạng thiết bị (Tốt / Khá / Kém…): tốt là Tốt,
        // Bình thường; xuống cấp là Cần sửa chữa, Xuống cấp, Hư hỏng nặng. Phòng chưa đánh giá không vào bên nào.
        String good = "r.condition IN " + FACILITY_GOOD;
        String poor = "r.condition IN " + FACILITY_POOR;
        if ("building".equals(group)) {
            return facilityBuildings(p);
        }
        if ("room".equals(group)) {
            return facilityRooms(p);
        }
        Dim d = dim(group);
        if ("room_type".equals(group)) {
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT " + d.select()
                    + ", COUNT(DISTINCT r.school_id) AS schools, COUNT(*) AS rooms,"
                    + " COALESCE(SUM(r.area), 0) AS room_area, COALESCE(SUM(r.capacity), 0) AS capacity,"
                    + " COUNT(*) FILTER (WHERE " + good + ") AS rooms_good,"
                    + " COUNT(*) FILTER (WHERE " + poor + ") AS rooms_poor"
                    + " FROM rooms r JOIN schools s ON s.id = r.school_id" + d.joins()
                    + " WHERE r.active" + scope("r.school_id", p)
                    + " GROUP BY " + d.groupBy() + " ORDER BY rooms DESC, name");
            return new Report("facilities", "Tổng hợp cơ sở vật chất theo loại phòng", subtitle(p, null),
                    List.of(col("name", d.header(), "text"), col("schools", "Số trường", "number"),
                            col("rooms", "Số phòng", "number"), col("room_area", "Diện tích phòng (m²)", "number"),
                            col("capacity", "Sức chứa (chỗ)", "number"), col("rooms_good", "Phòng tốt, bình thường", "number"),
                            col("rooms_poor", "Phòng xuống cấp, cần sửa", "number")),
                    rows);
        }
        boolean bySchool = d.code() != null;
        String room = "FROM rooms r WHERE r.school_id = s.id AND r.active";
        String building = "FROM buildings b WHERE b.school_id = s.id AND b.active";
        List<Map<String, Object>> rows = jdbc.queryForList("WITH per AS (SELECT s.id,"
                + " (SELECT COUNT(*) FROM campuses c WHERE c.school_id = s.id AND c.active) AS campuses,"
                + " (SELECT COUNT(*) " + building + ") AS buildings,"
                + " (SELECT COALESCE(SUM(b.floor_area), 0) " + building + ") AS floor_area,"
                + " (SELECT COUNT(*) " + room + ") AS rooms,"
                + " (SELECT COALESCE(SUM(r.area), 0) " + room + ") AS room_area,"
                + " (SELECT COUNT(*) " + room + " AND " + good + ") AS rooms_good,"
                + " (SELECT COUNT(*) " + room + " AND " + poor + ") AS rooms_poor"
                + " FROM schools s WHERE TRUE" + scope("s.id", p) + ")"
                + " SELECT " + d.select() + ", COUNT(*) AS schools,"
                + " COUNT(*) FILTER (WHERE per.rooms > 0 OR per.buildings > 0) AS schools_declared,"
                + " SUM(per.campuses) AS campuses, SUM(per.buildings) AS buildings, SUM(per.floor_area) AS floor_area,"
                + " SUM(per.rooms) AS rooms, SUM(per.room_area) AS room_area,"
                + " SUM(per.rooms_good) AS rooms_good, SUM(per.rooms_poor) AS rooms_poor"
                + " FROM per JOIN schools s ON s.id = per.id" + d.joins()
                // Gộp theo đơn vị: chỉ trường đã khai cơ sở vật chất — gần nghìn dòng toàn số 0 thì không đọc được.
                // Số trường chưa khai đọc ở cột "Trường đã khai" khi gộp theo địa bàn hoặc cấp học.
                + (bySchool ? " WHERE per.rooms > 0 OR per.buildings > 0 OR per.campuses > 0" : "")
                + " GROUP BY " + d.groupBy() + " ORDER BY rooms DESC, name");
        List<Column> columns = leadColumns(d);
        if (!bySchool) {
            columns.add(col("schools", "Số trường", "number"));
            columns.add(col("schools_declared", "Trường đã khai", "number"));
        }
        columns.addAll(List.of(col("campuses", "Điểm trường", "number"), col("buildings", "Khối nhà", "number"),
                col("floor_area", "Diện tích sàn (m²)", "number"), col("rooms", "Số phòng", "number"),
                col("room_area", "Diện tích phòng (m²)", "number"), col("rooms_good", "Phòng tốt, bình thường", "number"),
                col("rooms_poor", "Phòng xuống cấp, cần sửa", "number")));
        return new Report("facilities", "Tổng hợp cơ sở vật chất " + groupTitle(group), subtitle(p, null),
                columns, rows);
    }

    /** Hiện trạng công trình "tốt" / "xuống cấp" (mã `FacilityCondition`), dạng danh sách SQL. */
    private static final String FACILITY_GOOD = "('TOT', 'BINH_THUONG')";
    private static final String FACILITY_POOR = "('CAN_SUA_CHUA', 'XUONG_CAP', 'HU_HONG_NANG')";

    /** Nhãn hiện trạng công trình bằng SQL — cùng chữ với {@code CONDITION_LABELS} của màn cơ sở vật chất. */
    private static String facilityConditionLabel(String column) {
        return "CASE " + column + " WHEN 'TOT' THEN 'Tốt' WHEN 'BINH_THUONG' THEN 'Bình thường'"
                + " WHEN 'CAN_SUA_CHUA' THEN 'Cần sửa chữa' WHEN 'XUONG_CAP' THEN 'Xuống cấp'"
                + " WHEN 'HU_HONG_NANG' THEN 'Hư hỏng nặng' ELSE 'Chưa đánh giá' END";
    }

    /**
     * Chi tiết từng khối nhà đang có (QLTB-155): cùng danh sách với màn Khối nhà của trường, kèm số phòng và diện
     * tích phòng trong từng khối. Diện tích chưa khai để trống, không ghi 0. {@code cond} là mã hiện trạng — không
     * thành cột, màn hình đếm tốt / xuống cấp từ nó.
     */
    private Report facilityBuildings(Params p) {
        String room = "FROM rooms r WHERE r.building_id = b.id AND r.active";
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT s.code AS school_code, s.name AS school,"
                + " c.name AS campus, b.code AS building_code, b.name AS building_name, b.floor_count, b.built_year,"
                + " b.floor_area, (SELECT COUNT(*) " + room + ") AS rooms,"
                + " (SELECT SUM(r.area) " + room + ") AS room_area,"
                + " " + facilityConditionLabel("b.condition") + " AS condition, b.condition AS cond"
                + " FROM buildings b JOIN schools s ON s.id = b.school_id LEFT JOIN campuses c ON c.id = b.campus_id"
                + " WHERE b.active" + scope("b.school_id", p)
                + " ORDER BY s.name, c.name NULLS LAST, b.sort_order, b.name");
        return new Report("facilities", "Danh sách khối nhà", subtitle(p, null),
                List.of(col("school_code", "Mã trường", "text"), col("school", "Trường", "text"),
                        col("campus", "Điểm trường", "text"), col("building_code", "Mã khối nhà", "text"),
                        col("building_name", "Khối nhà", "text"), col("floor_count", "Số tầng", "text"),
                        col("built_year", "Năm xây dựng", "text"), col("floor_area", "Diện tích sàn (m²)", "number"),
                        col("rooms", "Số phòng", "number"), col("room_area", "Diện tích phòng (m²)", "number"),
                        col("condition", "Hiện trạng", "text")),
                rows);
    }

    /** Chi tiết từng phòng đang có (QLTB-155): khối nhà, loại, môn, tầng, diện tích, sức chứa, hiện trạng, sử dụng. */
    private Report facilityRooms(Params p) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT s.code AS school_code, s.name AS school,"
                + " b.name AS building, r.code AS room_code, r.name AS room_name,"
                + " COALESCE(rt.name, 'Chưa phân loại') AS room_type, sj.name AS subject, r.floor, r.area, r.capacity,"
                + " " + facilityConditionLabel("r.condition") + " AS condition, r.condition AS cond,"
                + " CASE r.usage_status WHEN 'DANG_SU_DUNG' THEN 'Đang sử dụng' WHEN 'BO_TRONG' THEN 'Bỏ trống'"
                + "  WHEN 'DANG_SUA_CHUA' THEN 'Đang sửa chữa' WHEN 'NGUNG_SU_DUNG' THEN 'Ngừng sử dụng'"
                + "  ELSE 'Chưa khai' END AS usage"
                + " FROM rooms r JOIN schools s ON s.id = r.school_id"
                + " LEFT JOIN buildings b ON b.id = r.building_id LEFT JOIN room_types rt ON rt.id = r.room_type_id"
                + " LEFT JOIN subjects sj ON sj.id = r.subject_id"
                + " WHERE r.active" + scope("r.school_id", p)
                + " ORDER BY s.name, b.name NULLS LAST, r.floor NULLS LAST, r.sort_order, r.name");
        return new Report("facilities", "Danh sách phòng", subtitle(p, null),
                List.of(col("school_code", "Mã trường", "text"), col("school", "Trường", "text"),
                        col("building", "Khối nhà", "text"), col("room_code", "Mã phòng", "text"),
                        col("room_name", "Phòng", "text"), col("room_type", "Loại phòng", "text"),
                        col("subject", "Môn học", "text"), col("floor", "Tầng", "text"),
                        col("area", "Diện tích (m²)", "number"), col("capacity", "Sức chứa (chỗ)", "number"),
                        col("condition", "Hiện trạng", "text"), col("usage", "Sử dụng", "text")),
                rows);
    }

    /**
     * Mục 3.5.6: thiết bị hư hỏng, đang sửa, và thiết bị không còn khả năng sử dụng cần thay thế.
     *
     * <p>Nhóm theo TRẠNG THÁI xử lý, không theo tình trạng: báo hỏng đặt tình trạng "hỏng" cho mọi tài sản, nên
     * "hỏng" không có nghĩa là phải thay — chỉ chờ thanh lý hoặc "không sử dụng được" mới là cần thay thế. Tài sản
     * kém / hỏng mà chưa ai báo hỏng đứng nhóm riêng: đó là việc chưa ai bắt đầu. Tài sản bị báo mất (kiểm kê
     * không thấy, chưa ghi giảm) cũng ở đây — nó là việc chờ xử lý như tài sản hỏng; mất đã ghi giảm thì ở báo cáo
     * ghi giảm.
     */
    private Report brokenEquipment(Params p) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT CASE WHEN e.status = 'MISSING' THEN 'Chờ ghi giảm do mất'
                            WHEN e.status IN ('PENDING_LIQUIDATION', 'PENDING_DESTRUCTION')
                                 THEN 'Cần thay thế, ghi giảm'
                            WHEN e.status IN ('REPAIRING', 'WARRANTY') THEN 'Đang sửa, bảo hành'
                            WHEN e.status = 'UNREPAIRABLE' THEN 'Hỏng, không sửa được'
                            WHEN e.status = 'BROKEN' THEN 'Hư hỏng, chờ xử lý'
                            ELSE 'Xuống cấp, vẫn đang dùng' END AS kind,
                       CASE WHEN e.status = 'MISSING' THEN 2
                            WHEN e.status IN ('PENDING_LIQUIDATION', 'PENDING_DESTRUCTION') THEN 4
                            WHEN e.status IN ('REPAIRING', 'WARRANTY') THEN 3
                            WHEN e.status = 'UNREPAIRABLE' THEN 2
                            WHEN e.status = 'BROKEN' THEN 1 ELSE 5 END AS kind_order,
                       e.id AS equipment_id, s.name AS school, e.code, e.name, c.name AS catalog,
                       CASE e.status WHEN 'IN_STOCK' THEN 'Trong kho' WHEN 'IN_USE' THEN 'Đang dùng'
                            WHEN 'BROKEN' THEN 'Hỏng, chờ xử lý' WHEN 'REPAIRING' THEN 'Đang sửa'
                            WHEN 'UNREPAIRABLE' THEN 'Hỏng, không sửa được'
                            WHEN 'WARRANTY' THEN 'Đang bảo hành' WHEN 'PENDING_LIQUIDATION' THEN 'Chờ thanh lý'
                            WHEN 'PENDING_DESTRUCTION' THEN 'Chờ tiêu huỷ'
                            WHEN 'BORROWED' THEN 'Đang cho mượn' WHEN 'MAINTAINING' THEN 'Đang bảo trì'
                            WHEN 'MISSING' THEN 'Chờ ghi giảm do mất' ELSE e.status END AS status,
                       CASE e.condition WHEN 'TOT' THEN 'Tốt' WHEN 'TRUNG_BINH' THEN 'Trung bình'
                            WHEN 'KEM' THEN 'Kém' WHEN 'HONG' THEN 'Hỏng'
                            ELSE e.condition END AS condition,
                       e.original_value, e.remaining_value
                FROM equipment e
                JOIN schools s ON s.id = e.school_id
                LEFT JOIN equipment_catalogs c ON c.id = e.catalog_id
                WHERE (e.status IN ('BROKEN', 'UNREPAIRABLE', 'REPAIRING', 'WARRANTY', 'PENDING_LIQUIDATION', 'PENDING_DESTRUCTION', 'MISSING')
                       OR (e.condition IN ('KEM', 'HONG')
                           AND e.status NOT IN ('LIQUIDATED', 'DESTROYED', 'LOST', 'USED_UP', 'NOT_DELIVERED', 'MISSING')))\
                """ + assets("e", p) + " ORDER BY kind_order, s.name, e.code LIMIT " + LIST_LIMIT);
        return new Report("broken-equipment", "Thiết bị hư hỏng, mất, cần thay thế", subtitle(p, null),
                List.of(col("kind", "Nhóm", "text"), col("school", "Trường", "text"), col("code", "Mã thiết bị", "text"),
                        col("name", "Tên thiết bị", "text"), col("catalog", "DM thiết bị", "text"),
                        col("status", "Trạng thái", "text"), col("condition", "Tình trạng", "text"),
                        col("original_value", "Nguyên giá (đ)", "money"),
                        col("remaining_value", "Giá trị còn lại (đ)", "money")),
                rows);
    }

    /** Mục 3.5.5: kết quả và chênh lệch của từng phiên kiểm kê trong kỳ. */
    private Report inventory(Params p, LocalDate from, LocalDate to, String period) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT i.code, s.name AS school, COALESCE(i.inventory_date, i.created_at::date) AS inventory_date,
                       CASE i.status WHEN 'DRAFT' THEN 'Nháp' WHEN 'PENDING' THEN 'Chờ duyệt'
                            WHEN 'APPROVED' THEN 'Đang thực hiện' WHEN 'COMPLETED' THEN 'Hoàn tất' ELSE i.status END AS status,
                       COUNT(l.id) AS items,
                       COUNT(l.id) FILTER (WHERE l.found) AS found,
                       COUNT(l.id) FILTER (WHERE NOT l.found) AS missing,
                       COALESCE((SELECT SUM(x.quantity) FROM inventory_surplus x WHERE x.session_id = i.id), 0) AS surplus,
                       COUNT(l.id) FILTER (WHERE l.found AND l.found_room_id IS NOT NULL
                                           AND l.found_room_id IS DISTINCT FROM l.expected_room_id) AS wrong_room,
                       COUNT(l.id) FILTER (WHERE l.found AND l.found_condition IS NOT NULL
                                           AND l.found_condition IS DISTINCT FROM l.expected_condition) AS wrong_condition
                FROM inventory_sessions i
                JOIN schools s ON s.id = i.school_id
                LEFT JOIN inventory_lines l ON l.session_id = i.id
                WHERE i.status NOT IN ('CANCELLED', 'REJECTED')
                  AND COALESCE(i.inventory_date, i.created_at::date) BETWEEN ?::date AND ?::date\
                """ + scope("i.school_id", p) + " GROUP BY i.id, s.name ORDER BY 3 DESC, s.name",
                from.toString(), to.toString());
        return new Report("inventory", "Kết quả kiểm kê", subtitle(p, period),
                List.of(col("code", "Số phiếu", "text"), col("school", "Trường", "text"),
                        col("inventory_date", "Ngày kiểm kê", "date"), col("status", "Trạng thái", "text"),
                        col("items", "Số thiết bị kiểm", "number"), col("found", "Tìm thấy", "number"),
                        col("missing", "Thiếu", "number"), col("surplus", "Thừa", "number"),
                        col("wrong_room", "Sai vị trí", "number"), col("wrong_condition", "Sai tình trạng", "number")),
                rows);
    }

    /** Mục 3.5.6 / 3.5.8: khối lượng, kết quả và chi phí bảo trì, sửa chữa trong kỳ. */
    private Report maintenance(Params p, String group, LocalDate from, LocalDate to, String period) {
        Dim d = dim(group);
        String live = " status NOT IN" + NOT_LIVE;
        String sql = "WITH rep AS (SELECT school_id, COUNT(*) AS n,"
                + " COUNT(*) FILTER (WHERE status = 'COMPLETED') AS done,"
                + " COUNT(*) FILTER (WHERE result = 'REPAIRED') AS repaired,"
                + " COUNT(*) FILTER (WHERE result = 'UNREPAIRABLE') AS unrepairable,"
                + " COALESCE(SUM(cost_estimated), 0) AS est, COALESCE(SUM(cost_actual), 0) AS act"
                + " FROM repair_orders WHERE work_kind = 'REPAIR' AND" + live
                + " AND request_date BETWEEN ?::date AND ?::date GROUP BY school_id),"
                + " war AS (SELECT school_id, COUNT(*) AS n, COALESCE(SUM(cost), 0) AS cost FROM warranty_claims"
                + " WHERE" + live + " AND request_date BETWEEN ?::date AND ?::date GROUP BY school_id),"
                + " mai AS (SELECT school_id, COUNT(*) AS n, COUNT(*) FILTER (WHERE status = 'COMPLETED') AS done,"
                + " COALESCE(SUM(cost_actual), 0) AS cost FROM ("
                + " SELECT school_id, status, cost_actual FROM maintenance_orders"
                + " WHERE" + live + " AND maintenance_date BETWEEN ?::date AND ?::date"
                + " UNION ALL SELECT school_id, status, cost_actual FROM repair_orders"
                + " WHERE work_kind = 'MAINTENANCE' AND" + live + " AND request_date BETWEEN ?::date AND ?::date"
                + ") m GROUP BY school_id)"
                + " SELECT " + d.select() + ","
                + " COALESCE(SUM(rep.n), 0) AS repairs, COALESCE(SUM(rep.done), 0) AS repairs_done,"
                + " COALESCE(SUM(rep.repaired), 0) AS repaired, COALESCE(SUM(rep.unrepairable), 0) AS unrepairable,"
                + " COALESCE(SUM(rep.est), 0) AS cost_estimated, COALESCE(SUM(rep.act), 0) AS cost_actual,"
                + " COALESCE(SUM(war.n), 0) AS warranty, COALESCE(SUM(mai.n), 0) AS maintenance,"
                + " COALESCE(SUM(mai.done), 0) AS maintenance_done,"
                + " COALESCE(SUM(rep.act), 0) + COALESCE(SUM(war.cost), 0) + COALESCE(SUM(mai.cost), 0) AS total_cost"
                + " FROM schools s LEFT JOIN rep ON rep.school_id = s.id LEFT JOIN war ON war.school_id = s.id"
                + " LEFT JOIN mai ON mai.school_id = s.id" + d.joins()
                + " WHERE (rep.n IS NOT NULL OR war.n IS NOT NULL OR mai.n IS NOT NULL)" + scope("s.id", p)
                + " GROUP BY " + d.groupBy() + " ORDER BY repairs DESC, name";
        String f = from.toString();
        String t = to.toString();
        List<Map<String, Object>> rows = jdbc.queryForList(sql, f, t, f, t, f, t, f, t);
        List<Column> columns = leadColumns(d);
        columns.addAll(List.of(col("repairs", "Phiếu sửa chữa", "number"), col("repairs_done", "Đã xong", "number"),
                col("repaired", "Sửa được", "number"), col("unrepairable", "Không sửa được", "number"),
                col("cost_estimated", "Chi phí sửa dự kiến (đ)", "money"),
                col("cost_actual", "Chi phí sửa thực tế (đ)", "money"), col("warranty", "Phiếu bảo hành", "number"),
                col("maintenance", "Phiếu bảo trì", "number"), col("maintenance_done", "Bảo trì xong", "number"),
                col("total_cost", "Tổng chi phí thực tế (đ)", "money")));
        return new Report("maintenance", "Bảo trì, sửa chữa " + groupTitle(group), subtitle(p, period), columns,
                rows);
    }

    private Report movements(Params p, LocalDate from, LocalDate to, String period) {
        List<Map<String, Object>> raw = jdbc.queryForList("""
                SELECT TO_CHAR(DATE_TRUNC('month', h.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'MM/YYYY') AS month,
                       DATE_TRUNC('month', h.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS m,
                       h.action, COUNT(DISTINCT h.equipment_id) AS n
                FROM equipment_history h JOIN equipment e ON e.id = h.equipment_id
                WHERE h.created_at >= ?::date AND h.created_at < (?::date + 1)\
                """ + scope("e.school_id", p) + " GROUP BY 1, 2, 3 ORDER BY 2", from.toString(), to.toString());
        List<String> actions = List.of("GHI_TANG", "CAP_PHAT", "THU_HOI", "DIEU_CHUYEN", "MUON", "BAO_HONG",
                "SUA_CHUA", "BAO_HANH", "THANH_LY", "TIEU_HUY", "MAT");
        // Đủ mọi tháng trong kỳ, tháng không phát sinh là dòng số 0: thiếu chúng thì biểu đồ dồn hai tháng có số
        // liệu sát nhau như thể kỳ chỉ dài hai tháng.
        Map<String, Map<String, Object>> byMonth = new LinkedHashMap<>();
        for (LocalDate m = from.withDayOfMonth(1); !m.isAfter(to); m = m.plusMonths(1)) {
            byMonth.put("%02d/%d".formatted(m.getMonthValue(), m.getYear()), emptyMonth(m, actions));
        }
        for (Map<String, Object> r : raw) {
            Map<String, Object> row = byMonth.get((String) r.get("month"));
            if (row == null) {
                continue;
            }
            String action = (String) r.get("action");
            if (row.containsKey(action)) {
                row.put(action, ((Number) r.get("n")).longValue());
            }
        }
        List<Column> columns = new ArrayList<>();
        columns.add(col("month", "Tháng", "text"));
        actions.forEach(a -> columns.add(col(a, HISTORY_LABELS.get(a), "number")));
        return new Report("movements", "Biến động thiết bị", subtitle(p, period), columns,
                new ArrayList<>(byMonth.values()));
    }

    private Report vouchers(Params p, LocalDate from, LocalDate to, String period) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map.Entry<String, String> t : VOUCHER_TABLES.entrySet()) {
            Map<String, Object> r = jdbc.queryForMap("""
                    SELECT COUNT(*) AS total,
                           COUNT(*) FILTER (WHERE status = 'DRAFT') AS draft,
                           COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
                           COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved,
                           COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
                           COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected,
                           COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled
                    FROM %s WHERE created_at >= ?::date AND created_at < (?::date + 1)""".formatted(t.getKey())
                    + scope("school_id", p), from.toString(), to.toString());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("voucher", t.getValue());
            row.putAll(r);
            rows.add(row);
        }
        return new Report("vouchers", "Tình hình xử lý chứng từ", subtitle(p, period),
                List.of(col("voucher", "Loại phiếu", "text"), col("total", "Tổng", "number"),
                        col("draft", "Nháp", "number"), col("pending", "Chờ duyệt", "number"),
                        col("approved", "Đã duyệt, đang thực hiện", "number"),
                        col("completed", "Hoàn tất", "number"), col("rejected", "Từ chối", "number"),
                        col("cancelled", "Huỷ", "number")),
                rows);
    }

    private Report adequacyReport(Params p) {
        Set<Long> only = p.filtered() ? filteredSchools(p) : null;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (AdequacyService.SchoolSummary s : adequacy.summary().rows()) {
            if (only != null && !only.contains(s.schoolId())) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("school_code", s.schoolCode());
            row.put("school", s.schoolName());
            row.put("level", s.level());
            row.put("norms", s.norms());
            row.put("met", s.met());
            row.put("unknown", s.unknown());
            row.put("shortage", s.shortageTotal());
            row.put("percent", s.percent());
            rows.add(row);
        }
        return new Report("adequacy", "Mức đáp ứng danh mục thiết bị tối thiểu", subtitle(p, null),
                List.of(col("school_code", "Mã trường", "text"), col("school", "Trường", "text"),
                        col("level", "Cấp học", "text"), col("norms", "Số định mức", "number"),
                        col("met", "Đã đạt", "number"), col("unknown", "Chưa tính được", "number"),
                        col("shortage", "Tổng số thiết bị thiếu", "number"), col("percent", "Tỷ lệ đạt (%)", "number")),
                rows);
    }

    private Report overdueLoans(Params p) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT l.id AS loan_id, l.code, s.name AS school, st.name AS borrower, l.loan_date, l.due_date,
                       (CURRENT_DATE - l.due_date) AS days_late,
                       (SELECT COUNT(*) FROM equipment_loan_lines x WHERE x.loan_id = l.id AND x.returned_date IS NULL) AS items
                FROM equipment_loans l
                JOIN schools s ON s.id = l.school_id
                LEFT JOIN staff st ON st.id = l.borrower_id
                WHERE l.status = 'APPROVED' AND l.due_date < CURRENT_DATE\
                """ + scope("l.school_id", p) + " ORDER BY l.due_date");
        return new Report("overdue-loans", "Thiết bị mượn quá hạn",
                subtitle(p, "tính đến " + vn(LocalDate.now())),
                List.of(col("code", "Số phiếu", "text"), col("school", "Trường", "text"),
                        col("borrower", "Người mượn", "text"), col("loan_date", "Ngày mượn", "date"),
                        col("due_date", "Hạn trả", "date"), col("days_late", "Quá hạn (ngày)", "number"),
                        col("items", "Số thiết bị chưa trả", "number")),
                rows);
    }

    private Report disposals(Params p, LocalDate from, LocalDate to, String period) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT d.id AS disposal_id, d.code, s.name AS school,
                       CASE d.kind WHEN 'LIQUIDATION' THEN 'Thanh lý' WHEN 'DESTRUCTION' THEN 'Tiêu huỷ' ELSE 'Ghi giảm do mất' END AS kind,
                       COALESCE(d.executed_date, d.completed_at::date) AS done_date, d.decision_no,
                       (SELECT COUNT(*) FROM disposal_lines x WHERE x.disposal_id = d.id) AS items,
                       (SELECT COALESCE(SUM(x.original_value), 0) FROM disposal_lines x WHERE x.disposal_id = d.id) AS original_value,
                       COALESCE(d.recovered_value, 0) AS recovered_value, COALESCE(d.disposal_cost, 0) AS disposal_cost
                FROM disposals d JOIN schools s ON s.id = d.school_id
                WHERE d.status = 'COMPLETED'
                  AND COALESCE(d.executed_date, d.completed_at::date) BETWEEN ?::date AND ?::date\
                """ + scope("d.school_id", p) + " ORDER BY 4", from.toString(), to.toString());
        return new Report("disposals", "Thiết bị ghi giảm", subtitle(p, period),
                List.of(col("code", "Số phiếu", "text"), col("school", "Trường", "text"), col("kind", "Hình thức", "text"),
                        col("done_date", "Ngày thực hiện", "date"), col("decision_no", "Số quyết định", "text"),
                        col("items", "Số thiết bị", "number"), col("original_value", "Nguyên giá (đ)", "money"),
                        col("recovered_value", "Thu về (đ)", "money"), col("disposal_cost", "Chi phí (đ)", "money")),
                rows);
    }

    /**
     * Mục 3.5.7: nhu cầu mua sắm theo địa bàn, cấp học, đơn vị hoặc loại thiết bị, trong một năm ngân sách.
     * "Đã vào kế hoạch" là đề xuất đã được một kế hoạch mua sắm duyệt đóng lại ({@code COMPLETED}).
     */
    private Report purchase(Params p, String group, int year) {
        boolean byType = "type".equals(group);
        // Loại thiết bị nằm trên DÒNG đề xuất (qua thiết bị trong danh mục), không trên tài sản.
        Dim d = byType
                ? new Dim("COALESCE(et.name, 'Ngoài danh mục')", null,
                        " LEFT JOIN equipment_catalogs gc ON gc.id = l.catalog_id"
                                + " LEFT JOIN equipment_types et ON et.id = gc.equipment_type_id ",
                        "et.id, et.name", "Loại thiết bị")
                : dim(group);
        String amount = "l.quantity * COALESCE(l.unit_price, 0)";
        String approved = "p.status IN ('APPROVED', 'COMPLETED')";
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT " + d.select()
                + ", COUNT(DISTINCT p.school_id) AS schools, COUNT(DISTINCT p.id) AS proposals,"
                + " COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'PENDING') AS pending,"
                + " COUNT(DISTINCT p.id) FILTER (WHERE " + approved + ") AS approved,"
                + " COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'COMPLETED') AS planned,"
                + " COALESCE(SUM(l.quantity), 0) AS quantity,"
                + " COALESCE(SUM(" + amount + "), 0) AS amount,"
                + " COALESCE(SUM(" + amount + ") FILTER (WHERE " + approved + "), 0) AS approved_amount"
                + " FROM purchase_proposals p JOIN schools s ON s.id = p.school_id"
                + " LEFT JOIN purchase_proposal_lines l ON l.proposal_id = p.id" + d.joins()
                + " WHERE p.status IN ('PENDING', 'APPROVED', 'COMPLETED') AND p.budget_year = ?"
                + scope("p.school_id", p) + " GROUP BY " + d.groupBy() + " ORDER BY amount DESC, name", year);
        List<Column> columns = leadColumns(d);
        if (d.code() == null) {
            columns.add(col("schools", "Số trường", "number"));
        }
        columns.addAll(List.of(col("proposals", "Số đề xuất", "number"), col("pending", "Chờ duyệt", "number"),
                col("approved", "Đã duyệt", "number"), col("planned", "Đã vào kế hoạch", "number"),
                col("quantity", "Số lượng đề xuất", "number"), col("amount", "Dự toán (đ)", "money"),
                col("approved_amount", "Dự toán đã duyệt (đ)", "money")));
        return new Report("purchase", "Tổng hợp nhu cầu mua sắm " + groupTitle(group),
                subtitle(p, "năm ngân sách " + year), columns, rows);
    }

    // ------------------------------------------------------------------ trạng thái, tình trạng, danh sách

    /** Nhãn trạng thái tài sản bằng SQL — cùng chữ với {@code ASSET_STATUS_LABELS} ở màn hình. */
    static String statusLabel(String column) {
        return "CASE " + column + " WHEN 'IN_STOCK' THEN 'Trong kho' WHEN 'IN_USE' THEN 'Đang sử dụng'"
                + " WHEN 'BORROWED' THEN 'Đang cho mượn' WHEN 'BROKEN' THEN 'Hỏng, chờ xử lý'"
                + " WHEN 'UNREPAIRABLE' THEN 'Hỏng, không sửa được'"
                + " WHEN 'REPAIRING' THEN 'Đang sửa chữa' WHEN 'WARRANTY' THEN 'Đang bảo hành'"
                + " WHEN 'MAINTAINING' THEN 'Đang bảo trì' WHEN 'TRANSFERRING' THEN 'Đang điều chuyển'"
                + " WHEN 'PENDING_LIQUIDATION' THEN 'Chờ thanh lý' WHEN 'PENDING_DESTRUCTION' THEN 'Chờ tiêu huỷ'"
                + " WHEN 'LIQUIDATED' THEN 'Đã thanh lý' WHEN 'DESTROYED' THEN 'Đã tiêu huỷ'"
                + " WHEN 'MISSING' THEN 'Chờ ghi giảm do mất'"
                + " ELSE " + column + " END";
    }

    /** Nhãn tình trạng kỹ thuật bằng SQL — cùng chữ với {@code EQUIPMENT_CONDITION_LABELS}. */
    static String conditionLabel(String column) {
        return "CASE " + column + " WHEN 'TOT' THEN 'Tốt' WHEN 'TRUNG_BINH' THEN 'Trung bình'"
                + " WHEN 'KEM' THEN 'Kém' WHEN 'HONG' THEN 'Hỏng'"
                + " ELSE COALESCE(" + column + ", 'Chưa đánh giá') END";
    }

    /** Thêm cột "Số trường" khi gộp theo chiều khác đơn vị — gộp theo đơn vị thì mỗi dòng đã là một trường. */
    private static void schoolsColumn(Dim d, List<Column> columns) {
        if (d.code() == null) {
            columns.add(col("schools", "Số trường", "number"));
        }
    }

    /** Tài sản trên sổ theo trạng thái sử dụng — mỗi trạng thái của vòng đời một cột. */
    private Report equipmentByStatus(Params p, String group) {
        Dim d = dim(group);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT " + d.select()
                + ", COUNT(DISTINCT e.school_id) AS schools, COUNT(e.id) AS total,"
                + " COUNT(e.id) FILTER (WHERE e.status = 'IN_STOCK') AS in_stock,"
                + " COUNT(e.id) FILTER (WHERE e.status = 'IN_USE') AS in_use,"
                + " COUNT(e.id) FILTER (WHERE e.status = 'BORROWED') AS borrowed,"
                + " COUNT(e.id) FILTER (WHERE e.status = 'MAINTAINING') AS maintaining,"
                + " COUNT(e.id) FILTER (WHERE e.status IN ('REPAIRING', 'WARRANTY')) AS repairing,"
                + " COUNT(e.id) FILTER (WHERE e.status IN ('BROKEN', 'UNREPAIRABLE')) AS broken,"
                + " COUNT(e.id) FILTER (WHERE e.status = 'MISSING') AS missing,"
                + " COUNT(e.id) FILTER (WHERE e.status IN ('PENDING_LIQUIDATION', 'PENDING_DESTRUCTION')) AS pending_liquidation,"
                + " COUNT(e.id) FILTER (WHERE e.status = 'TRANSFERRING') AS transferring"
                + " FROM equipment e JOIN schools s ON s.id = e.school_id" + d.joins()
                + " WHERE e.status NOT IN" + OFF_BOOK + assets("e", p)
                + " GROUP BY " + d.groupBy() + " ORDER BY total DESC, name");
        List<Column> columns = leadColumns(d);
        schoolsColumn(d, columns);
        columns.addAll(List.of(col("total", "Tổng số", "number"), col("in_stock", "Trong kho", "number"),
                col("in_use", "Đang sử dụng", "number"), col("borrowed", "Đang cho mượn", "number"),
                col("maintaining", "Đang bảo trì", "number"), col("repairing", "Đang sửa, bảo hành", "number"),
                col("broken", "Hỏng, chờ xử lý", "number"), col("missing", "Chờ ghi giảm do mất", "number"),
                col("pending_liquidation", "Chờ thanh lý / tiêu huỷ", "number"),
                col("transferring", "Đang điều chuyển", "number")));
        return new Report("equipment-by-status", "Thiết bị theo trạng thái sử dụng " + groupTitle(group),
                subtitle(p, null), columns, rows);
    }

    /** Tài sản trên sổ theo tình trạng kỹ thuật ghi trên hồ sơ. */
    private Report equipmentByCondition(Params p, String group) {
        Dim d = dim(group);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT " + d.select()
                + ", COUNT(DISTINCT e.school_id) AS schools, COUNT(e.id) AS total,"
                + " COUNT(e.id) FILTER (WHERE e.condition = 'TOT') AS good,"
                + " COUNT(e.id) FILTER (WHERE e.condition = 'TRUNG_BINH') AS average,"
                + " COUNT(e.id) FILTER (WHERE e.condition = 'KEM') AS poor,"
                + " COUNT(e.id) FILTER (WHERE e.condition = 'HONG') AS broken,"
                + " COUNT(e.id) FILTER (WHERE e.condition IS NULL) AS unrated"
                + " FROM equipment e JOIN schools s ON s.id = e.school_id" + d.joins()
                + " WHERE e.status NOT IN" + OFF_BOOK + assets("e", p)
                + " GROUP BY " + d.groupBy() + " ORDER BY total DESC, name");
        List<Column> columns = leadColumns(d);
        schoolsColumn(d, columns);
        columns.addAll(List.of(col("total", "Tổng số", "number"), col("good", "Tốt", "number"),
                col("average", "Trung bình", "number"), col("poor", "Kém", "number"),
                col("broken", "Hỏng", "number"),
                col("unrated", "Chưa đánh giá", "number")));
        return new Report("equipment-by-condition", "Thiết bị theo tình trạng kỹ thuật " + groupTitle(group),
                subtitle(p, null), columns, rows);
    }

    /**
     * Danh sách từng tài sản ở một trạng thái — trong kho, đang dùng, đang mượn, bảo trì, sửa chữa, hỏng / mất,
     * chờ thanh lý, đang điều chuyển. Một báo cáo thay cho tám, vì tám bảng ấy cùng cột và chỉ khác điều kiện.
     */
    private Report equipmentList(Params p, String choice) {
        String label = STATUS_CHOICES.stream().filter(g -> g.key().equals(choice)).map(Group::label)
                .findFirst().orElse(choice);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT e.id AS equipment_id, s.name AS school, e.code, e.name,"
                + " c.name AS catalog, r.name AS room, st.name AS manager,"
                + " " + statusLabel("e.status") + " AS status, " + conditionLabel("e.condition") + " AS condition,"
                + " e.quantity, e.received_date, e.original_value, e.remaining_value"
                + " FROM equipment e JOIN schools s ON s.id = e.school_id"
                + " LEFT JOIN equipment_catalogs c ON c.id = e.catalog_id"
                + " LEFT JOIN rooms r ON r.id = e.room_id LEFT JOIN staff st ON st.id = e.manager_id"
                + " WHERE e.status IN (" + LIST_STATUSES.get(choice) + ")" + assets("e", p)
                + " ORDER BY s.name, e.code LIMIT " + LIST_LIMIT);
        return new Report("equipment-list", "Danh sách thiết bị — " + label.toLowerCase(), subtitle(p, null),
                List.of(col("school", "Trường", "text"), col("code", "Mã thiết bị", "text"),
                        col("name", "Tên thiết bị", "text"), col("catalog", "DM thiết bị", "text"),
                        col("room", "Chỗ để", "text"), col("manager", "Người quản lý", "text"),
                        col("status", "Trạng thái", "text"), col("condition", "Tình trạng", "text"),
                        col("quantity", "Số lượng", "number"), col("received_date", "Ngày tiếp nhận", "date"),
                        col("original_value", "Nguyên giá (đ)", "money"),
                        col("remaining_value", "Giá trị còn lại (đ)", "money")),
                rows);
    }

    /**
     * Lịch sử điều chuyển: mọi lần tài sản đổi phòng hoặc đổi trường trong kỳ, đọc từ lịch sử tài sản (mỗi phiếu
     * cấp phát, thu hồi, chuyển phòng, điều chuyển ghi một dòng "từ … đến …"). Điều chuyển giữa hai trường thì cả
     * trường chuyển lẫn trường nhận đều thấy — tài sản đã sang trường nhận nên phải xét cả trường trên phiếu.
     */
    private Report transfers(Params p, LocalDate from, LocalDate to, String period) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT (h.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS moved_date,
                       CASE WHEN h.action = 'CAP_PHAT' THEN 'Cấp phát' WHEN h.action = 'THU_HOI' THEN 'Thu hồi'
                            WHEN h.field = 'school' THEN 'Điều chuyển giữa trường' ELSE 'Chuyển phòng' END AS kind,
                       h.voucher_code, h.voucher_resource, h.voucher_id, e.id AS equipment_id,
                       COALESCE(src.name, s.name) AS school, e.code, e.name,
                       CASE h.field WHEN 'school' THEN 'Trường' ELSE 'Phòng' END AS field,
                       h.from_value, h.to_value, h.actor_name
                FROM equipment_history h
                JOIN equipment e ON e.id = h.equipment_id
                JOIN schools s ON s.id = e.school_id
                LEFT JOIN equipment_transfers t ON h.voucher_resource = 'equipment_transfers' AND t.id = h.voucher_id
                LEFT JOIN schools src ON src.id = t.school_id
                WHERE h.action IN ('CAP_PHAT', 'THU_HOI', 'DIEU_CHUYEN') AND h.field IN ('room', 'school')
                  -- Điều chuyển giữa trường ghi hai dòng (đổi trường, rồi phòng ở trường nhận): giữ dòng đổi trường.
                  AND NOT (h.voucher_resource = 'equipment_transfers' AND h.field = 'room')
                  AND h.created_at >= ?::date AND h.created_at < (?::date + 1)\
                """ + " AND ((TRUE" + scope("e.school_id", p) + ") OR (t.id IS NOT NULL" + scope("t.school_id", p)
                + ")) ORDER BY h.created_at DESC, e.code LIMIT " + LIST_LIMIT, from.toString(), to.toString());
        return new Report("transfers", "Lịch sử điều chuyển thiết bị", subtitle(p, period),
                List.of(col("moved_date", "Ngày", "date"), col("kind", "Hình thức", "text"),
                        col("voucher_code", "Số phiếu", "text"), col("school", "Trường", "text"),
                        col("code", "Mã thiết bị", "text"), col("name", "Tên thiết bị", "text"),
                        col("field", "Đổi", "text"), col("from_value", "Từ", "text"), col("to_value", "Đến", "text"),
                        col("actor_name", "Người thực hiện", "text")),
                rows);
    }

    /** Lịch sử cho thấy tài sản ĐƯỢC DÙNG — cấp phát, mượn, trả, chuyển, sửa, bảo trì, báo hỏng, tiêu hao. */
    static final String USAGE_ACTIONS = " ('CAP_PHAT', 'THU_HOI', 'DIEU_CHUYEN', 'MUON', 'TRA', 'BAO_HONG',"
            + " 'SUA_CHUA', 'BAO_HANH', 'BAO_TRI', 'TIEU_HAO') ";

    /**
     * Hiệu quả khai thác trong kỳ: tỷ lệ tài sản đang dùng (kể cả đang cho mượn), lượt mượn thiết bị và số tài
     * sản được mượn, lượt mượn phòng, và tài sản NẰM KHO KHÔNG PHÁT SINH SỬ DỤNG — đang trong kho, đã có từ trước
     * kỳ, và cả kỳ không có lần cấp phát, mượn, sửa, bảo trì nào. Mượn phòng gắn với trường, không với loại thiết
     * bị, nên gộp theo loại thì không có cột đó.
     */
    private Report utilization(Params p, String group, LocalDate from, LocalDate to, String period) {
        Dim d = dim(group);
        String f = from.toString();
        String t = to.toString();
        String idle = "e.status = 'IN_STOCK' AND COALESCE(e.received_date, e.created_at::date) < ?::date"
                + " AND NOT EXISTS (SELECT 1 FROM equipment_history h WHERE h.equipment_id = e.id"
                + " AND h.action IN" + USAGE_ACTIONS + " AND h.created_at >= ?::date AND h.created_at < (?::date + 1))";
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT " + d.select()
                + ", COUNT(DISTINCT e.school_id) AS schools, COUNT(e.id) AS total,"
                + " COUNT(e.id) FILTER (WHERE e.status IN ('IN_USE', 'BORROWED')) AS in_use,"
                + " ROUND(100.0 * COUNT(e.id) FILTER (WHERE e.status IN ('IN_USE', 'BORROWED'))"
                + " / NULLIF(COUNT(e.id), 0), 1) AS use_rate,"
                + " COALESCE(SUM(lc.n), 0) AS loans, COUNT(lc.equipment_id) AS loaned,"
                + " COUNT(e.id) FILTER (WHERE " + idle + ") AS idle"
                + " FROM equipment e JOIN schools s ON s.id = e.school_id" + d.joins()
                + " LEFT JOIN (SELECT ll.equipment_id, COUNT(*) AS n FROM equipment_loan_lines ll"
                + " JOIN equipment_loans l ON l.id = ll.loan_id WHERE l.status NOT IN" + NOT_LIVE
                + " AND l.loan_date BETWEEN ?::date AND ?::date GROUP BY ll.equipment_id) lc ON lc.equipment_id = e.id"
                + " WHERE e.status NOT IN" + OFF_BOOK + scope("e.school_id", p)
                + " GROUP BY " + d.groupBy() + " ORDER BY total DESC, name", f, f, t, f, t);
        boolean rooms = !"type".equals(group);
        if (rooms) {
            Map<String, Object> bookings = new LinkedHashMap<>();
            jdbc.queryForList("SELECT " + d.select() + ", COUNT(b.id) AS n FROM room_bookings b"
                    + " JOIN schools s ON s.id = b.school_id" + d.joins()
                    + " WHERE b.status NOT IN" + NOT_LIVE + " AND b.booking_date BETWEEN ?::date AND ?::date"
                    + scope("b.school_id", p) + " GROUP BY " + d.groupBy(), f, t)
                    .forEach(r -> bookings.put(r.get("name") + "|" + r.get("code"), r.get("n")));
            rows.forEach(r -> r.put("bookings", bookings.getOrDefault(r.get("name") + "|" + r.get("code"), 0L)));
        }
        List<Column> columns = leadColumns(d);
        schoolsColumn(d, columns);
        columns.addAll(List.of(col("total", "Thiết bị trong hệ thống", "number"),
                col("in_use", "Đang dùng, cho mượn", "number"), col("use_rate", "Tỷ lệ đang dùng (%)", "number"),
                col("loans", "Lượt mượn thiết bị", "number"), col("loaned", "Thiết bị được mượn", "number")));
        if (rooms) {
            columns.add(col("bookings", "Lượt mượn theo phòng", "number"));
        }
        columns.add(col("idle", "Nằm kho, không phát sinh", "number"));
        return new Report("utilization", "Hiệu quả khai thác thiết bị " + groupTitle(group), subtitle(p, period),
                columns, rows);
    }

    /**
     * Chất lượng dữ liệu: mỗi trường còn bao nhiêu hồ sơ tài sản chưa chuẩn và thiếu gì. Năm điều kiện của hồ sơ
     * chuẩn là đúng {@code Equipment.missingProfile} (mã chuẩn, đơn vị tính, nguồn kinh phí, ngày tiếp nhận,
     * nguyên giá — bản SQL cùng điều kiện ở {@code EquipmentSummaryService.items}); chỗ để và người quản lý thêm
     * vào vì báo cáo nào đọc theo phòng / người giữ cũng hụt đúng chừng ấy.
     */
    private Report dataQuality(Params p, String group) {
        Dim d = dim(group);
        String complete = "e.code ~ ? AND e.unit_id IS NOT NULL AND e.funding_source IS NOT NULL"
                + " AND e.received_date IS NOT NULL";
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT " + d.select()
                + ", COUNT(DISTINCT e.school_id) AS schools, COUNT(e.id) AS total,"
                + " COUNT(e.id) FILTER (WHERE " + complete + ") AS complete,"
                + " ROUND(100.0 * COUNT(e.id) FILTER (WHERE " + complete + ") / NULLIF(COUNT(e.id), 0), 1) AS percent,"
                + " COUNT(e.id) FILTER (WHERE e.code IS NULL OR e.code !~ ?) AS miss_code,"
                + " COUNT(e.id) FILTER (WHERE e.unit_id IS NULL) AS miss_unit,"
                + " COUNT(e.id) FILTER (WHERE e.funding_source IS NULL) AS miss_funding,"
                + " COUNT(e.id) FILTER (WHERE e.received_date IS NULL) AS miss_received,"
                + " COUNT(e.id) FILTER (WHERE e.room_id IS NULL) AS no_room,"
                + " COUNT(e.id) FILTER (WHERE e.manager_id IS NULL) AS no_manager"
                + " FROM equipment e JOIN schools s ON s.id = e.school_id" + d.joins()
                + " WHERE e.status NOT IN" + OFF_BOOK + assets("e", p)
                // Trường dữ liệu kém nhất đứng đầu — đó là chỗ cần nhắc.
                + " GROUP BY " + d.groupBy() + " ORDER BY percent NULLS FIRST, total DESC, name",
                Equipment.STANDARD_CODE_SQL, Equipment.STANDARD_CODE_SQL, Equipment.STANDARD_CODE_SQL);
        List<Column> columns = leadColumns(d);
        schoolsColumn(d, columns);
        columns.addAll(List.of(col("total", "Thiết bị trong hệ thống", "number"), col("complete", "Hồ sơ chuẩn", "number"),
                col("percent", "Tỷ lệ chuẩn (%)", "number"), col("miss_code", "Thiếu mã chuẩn", "number"),
                col("miss_unit", "Thiếu đơn vị tính", "number"), col("miss_funding", "Thiếu nguồn kinh phí", "number"),
                col("miss_received", "Thiếu ngày tiếp nhận", "number"),
                col("no_room", "Chưa xếp chỗ", "number"), col("no_manager", "Chưa có người quản lý", "number")));
        return new Report("data-quality", "Chất lượng dữ liệu " + groupTitle(group), subtitle(p, null), columns,
                rows);
    }

    // ------------------------------------------------------------------ phạm vi và bộ lọc

    /**
     * Phạm vi của người xem ({@link VisibleSchools}) cộng bộ lọc của lần xem, trên cột id trường cho trước.
     * Chỉ ghép id số (đã là {@code Long}), không ghép chuỗi người dùng gõ. Luôn có khoảng trắng hai đầu.
     */
    String scope(String column, Params p) {
        StringBuilder sql = new StringBuilder(visible.sqlFilter(column));
        if (p.schoolId() != null) {
            sql.append(" AND ").append(column).append(" = ").append(p.schoolId().longValue()).append(' ');
        }
        if (p.bodyId() != null || p.levelId() != null) {
            sql.append(" AND ").append(column).append(" IN (SELECT fs.id FROM schools fs WHERE TRUE");
            if (p.bodyId() != null) {
                sql.append(" AND fs.department_of_education_id = ").append(p.bodyId().longValue());
            }
            if (p.levelId() != null) {
                sql.append(" AND fs.education_level_id = ").append(p.levelId().longValue());
            }
            sql.append(") ");
        }
        return sql.toString();
    }

    /**
     * {@link #scope} trên {@code <alias>.school_id} cộng bộ lọc theo tài sản ({@link ReportFilters}) trên cùng bí
     * danh — cho báo cáo về tài sản. Báo cáo không khai bộ lọc thì {@link ReportFilters#only} đã gạt nó đi.
     */
    String assets(String alias, Params p) {
        return scope(alias + ".school_id", p) + ReportFilters.sql(alias, p);
    }

    /** Tên dòng gộp thiết bị ngoài danh mục ở báo cáo nhiều trường. */
    static final String OTHER_LABEL = "Khác (thiết bị ngoài danh mục)";

    /**
     * Điều kiện SQL "thiết bị này gộp vào dòng Khác" trên bí danh bảng {@code equipment_catalogs} cho trước. Báo
     * cáo theo từng thiết bị mà phủ NHIỀU trường thì thiết bị ngoài danh mục (riêng của từng trường, tên mỗi nơi
     * một kiểu) không liệt kê từng cái — gộp một dòng "Khác"; xem chi tiết thì lọc một trường. Xem MỘT trường
     * (lọc theo trường, hoặc người xem chỉ thấy một trường) thì liệt kê đủ: {@code FALSE}.
     */
    String otherCatalog(String alias, Params p) {
        Set<Long> schools = visible.current();
        boolean single = p.schoolId() != null || (schools != null && schools.size() == 1);
        return single ? "FALSE" : "(" + alias + ".owner_school_id IS NOT NULL)";
    }

    /** Id các trường khớp bộ lọc, trong phạm vi của người xem — cho báo cáo dựng từ service khác. */
    private Set<Long> filteredSchools(Params p) {
        return new HashSet<>(jdbc.queryForList("SELECT s.id FROM schools s WHERE TRUE" + scope("s.id", p), Long.class));
    }

    /** Phụ đề: phạm vi, bộ lọc đang áp, rồi kỳ — mỗi phần cách nhau " · " để màn hình tách thành nhãn. */
    String subtitle(Params p, String period) {
        List<String> parts = new ArrayList<>();
        parts.add(scopeLabel());
        if (p.bodyId() != null) {
            parts.add(nameOf("departments_of_education", p.bodyId()));
        }
        if (p.levelId() != null) {
            parts.add(nameOf("education_levels", p.levelId()));
        }
        if (p.schoolId() != null) {
            parts.add(nameOf("schools", p.schoolId()));
        }
        if (p.typeId() != null) {
            parts.add(nameOf("equipment_types", p.typeId()));
        }
        parts.addAll(ReportFilters.labels(p));
        if (period != null) {
            parts.add(period);
        }
        return String.join(" · ", parts);
    }

    private String nameOf(String table, Long id) {
        List<String> names = jdbc.queryForList("SELECT name FROM " + table + " WHERE id = ?", String.class, id);
        return names.isEmpty() ? "#" + id : names.getFirst();
    }

    static String groupTitle(String group) {
        return switch (group) {
            case "body" -> "theo địa bàn";
            case "level" -> "theo cấp học";
            case "type" -> "theo loại thiết bị";
            case "origin" -> "theo nguồn hình thành";
            case "room_type" -> "theo loại phòng";
            default -> "theo đơn vị";
        };
    }

    // ------------------------------------------------------------------ tiện ích

    private static Map<String, Object> emptyMonth(LocalDate month, List<String> actions) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("month", "%02d/%d".formatted(month.getMonthValue(), month.getYear()));
        actions.forEach(a -> row.put(a, 0L));
        return row;
    }

    String scopeLabel() {
        return switch (visible.level()) {
            case "CITY" -> "Toàn ngành";
            case "BODY" -> "Các trường thuộc địa bàn quản lý";
            case "SCHOOL" -> "Trường của tôi";
            default -> "";
        };
    }

    private static Column col(String key, String label, String type) {
        return new Column(key, label, type);
    }

    private static String vn(LocalDate d) {
        return "%02d/%02d/%d".formatted(d.getDayOfMonth(), d.getMonthValue(), d.getYear());
    }
}
