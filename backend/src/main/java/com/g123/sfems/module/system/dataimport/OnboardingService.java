package com.g123.sfems.module.system.dataimport;

import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.enums.StaffPosition;
import com.g123.sfems.domain.catalog.equipmentcatalog.CatalogOrigin;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.domain.school.staff.StaffType;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.catalog.equipmentcatalog.SchoolItemRequest;
import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.equipment.EquipmentRequest;
import com.g123.sfems.module.school.equipment.EquipmentService;
import com.g123.sfems.module.school.facility.BuildingRequest;
import com.g123.sfems.module.school.facility.BuildingService;
import com.g123.sfems.module.school.facility.CampusRequest;
import com.g123.sfems.module.school.facility.CampusService;
import com.g123.sfems.module.school.facility.RoomRequest;
import com.g123.sfems.module.school.facility.RoomService;
import com.g123.sfems.module.school.schoolclass.SchoolClassRequest;
import com.g123.sfems.module.school.schoolclass.SchoolClassService;
import com.g123.sfems.module.school.staff.StaffRequest;
import com.g123.sfems.module.school.staff.StaffService;
import com.g123.sfems.module.school.team.SubjectTeamRequest;
import com.g123.sfems.module.school.team.SubjectTeamService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.system.dataimport.OnboardingValidator.BuildingRow;
import com.g123.sfems.module.system.dataimport.OnboardingValidator.CampusRow;
import com.g123.sfems.module.system.dataimport.OnboardingValidator.ClassRow;
import com.g123.sfems.module.system.dataimport.OnboardingValidator.EquipmentRow;
import com.g123.sfems.module.system.dataimport.OnboardingValidator.Message;
import com.g123.sfems.module.system.dataimport.OnboardingValidator.NewItem;
import com.g123.sfems.module.system.dataimport.OnboardingValidator.Result;
import com.g123.sfems.module.system.dataimport.OnboardingValidator.RoomRow;
import com.g123.sfems.module.system.dataimport.OnboardingValidator.Staged;
import com.g123.sfems.module.system.dataimport.OnboardingValidator.StaffRow;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.office.SpreadsheetReader;
import com.g123.sfems.shared.office.SpreadsheetReader.NamedSheet;
import com.g123.sfems.shared.office.XlsxWriter;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Nhập dữ liệu đầu vào của một trường qua VÙNG CHỜ (`146`).
 *
 * <p>Tệp tải lên không ghi thẳng vào sổ: mỗi dòng của mỗi trang thành một dòng chờ giữ nguyên chữ người dùng
 * gõ. Người nhập xem lỗi, sửa ô, bỏ dòng ngay trên hệ thống — mỗi lần sửa là kiểm lại cả lô — rồi mới ghi. Ghi
 * là TẤT CẢ HOẶC KHÔNG GÌ, theo thứ tự trang (`OnboardingSheet`), và đi qua đúng service tạo của từng loại dữ
 * liệu: cùng kiểm trùng mã, cùng phạm vi dòng, cùng cấp mã tài sản như tạo tay. Ghi xong vẫn HOÀN TÁC được cả
 * lô khi dữ liệu chưa được nghiệp vụ nào dùng tới; hoàn tác đưa lô về nháp để sửa và ghi lại.
 */
@Service
public class OnboardingService {

    public static final String DRAFT = "DRAFT";
    public static final String COMMITTED = "COMMITTED";
    /** Hoàn tác chỉ trong ngần này giờ sau khi ghi; quá hạn thì sửa từng hồ sơ. Bản TS: {@code UNDO_HOURS}. */
    public static final int UNDO_HOURS = 24;

    public record SheetCount(String sheet, String title, int total, int ok, int warning, int error, int exists,
            int skipped) {
    }

    /**
     * Một lô. {@code kind}: {@code school_data} (dữ liệu đầu vào của {@code school}) hoặc danh mục dùng chung
     * ({@code schools}, {@code wards} — {@code school} rỗng, {@code preview} là kết quả kiểm tra cả lô).
     */
    public record Batch(long id, String kind, String kindTitle, IdName school, String fileName, String status,
            String createdAt, String createdBy, String committedAt, String committedBy, List<SheetCount> sheets,
            int errors, Map<String, Integer> created, Map<String, Object> preview) {
    }

    public record IdName(Long id, String name) {
    }

    public record StagedRow(long id, int rowNo, Map<String, String> data, boolean skipped, String status,
            List<Message> messages, Map<String, Object> resolved, String editSource, Map<String, String> editedCells) {
    }

    /** Một lần sửa ô (tab Lịch sử): ai, lúc nào, dòng nào, ô nào, từ gì thành gì, bằng cách nào. */
    public record Edit(long id, String sheet, int rowNo, Long rowId, String field, String oldValue, String newValue,
            String source, String editedAt, String editedBy) {
    }

    public record SheetInfo(String key, String title, List<OnboardingSheet.Column> columns) {
    }

    private static final TypeReference<Map<String, String>> DATA = new TypeReference<>() {
    };
    private static final TypeReference<List<Message>> MESSAGES = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, Object>> RESOLVED = new TypeReference<>() {
    };

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final OnboardingValidator validator;
    private final VisibleSchools visibleSchools;
    private final RowLevelPrincipalResolver principals;
    private final CampusService campuses;
    private final StaffService staff;
    private final SubjectTeamService teams;
    private final BuildingService buildings;
    private final RoomService rooms;
    private final SchoolClassService classes;
    private final EquipmentService equipment;
    private final EquipmentCatalogService catalogs;
    private final CatalogImports catalogImports;

    public OnboardingService(JdbcTemplate jdbc, ObjectMapper mapper, OnboardingValidator validator,
            VisibleSchools visibleSchools, RowLevelPrincipalResolver principals, CampusService campuses,
            StaffService staff, SubjectTeamService teams, BuildingService buildings, RoomService rooms,
            SchoolClassService classes, EquipmentService equipment, EquipmentCatalogService catalogs,
            CatalogImports catalogImports) {
        this.catalogImports = catalogImports;
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.validator = validator;
        this.visibleSchools = visibleSchools;
        this.principals = principals;
        this.campuses = campuses;
        this.staff = staff;
        this.teams = teams;
        this.buildings = buildings;
        this.rooms = rooms;
        this.classes = classes;
        this.equipment = equipment;
        this.catalogs = catalogs;
    }

    // ------------------------------------------------------------------ đọc

    public List<SheetInfo> sheets() {
        List<SheetInfo> out = new ArrayList<>(List.of(OnboardingSheet.values()).stream()
                .map(s -> new SheetInfo(s.key(), s.title(), s.columns())).toList());
        out.addAll(catalogImports.sheets());
        return out;
    }

    /** Tệp mẫu: các trang theo đúng thứ tự ghi, dòng dưới tiêu đề là hướng dẫn. */
    public byte[] template() {
        List<XlsxWriter.Tab> tabs = new ArrayList<>();
        for (OnboardingSheet s : OnboardingSheet.values()) {
            List<XlsxWriter.Column> columns = s.columns().stream()
                    .map(c -> new XlsxWriter.Column(c.key(), c.label() + (c.required() ? " (*)" : ""), "text"))
                    .toList();
            Map<String, Object> hint = new HashMap<>();
            s.columns().forEach(c -> hint.put(c.key(), c.hint()));
            tabs.add(new XlsxWriter.Tab(s.title(), new XlsxWriter.Sheet("Mẫu nhập: " + s.title(),
                    "Cột có (*) là bắt buộc. Dòng dưới tiêu đề là hướng dẫn, ghi dữ liệu từ dòng kế tiếp.", columns,
                    List.of(hint))));
        }
        return XlsxWriter.writeAll(tabs);
    }

    @Transactional(readOnly = true)
    public List<Batch> list(Long schoolId) {
        Set<Long> visible = visibleSchools.current();
        List<Long> ids = jdbc.queryForList("SELECT id, school_id, kind FROM data_import_batches ORDER BY created_at DESC")
                .stream()
                .filter(m -> {
                    CatalogImports.Kind kind = CatalogImports.kindOf(m.get("kind"));
                    if (kind != null) {
                        return schoolId == null && catalogImports.allowed(kind);
                    }
                    long school = ((Number) m.get("school_id")).longValue();
                    return (visible == null || visible.contains(school)) && (schoolId == null || schoolId.equals(school));
                })
                .map(m -> ((Number) m.get("id")).longValue()).toList();
        return ids.stream().map(this::summary).toList();
    }

    @Transactional(readOnly = true)
    public Batch get(long id) {
        requireVisible(id);
        return summary(id);
    }

    @Transactional(readOnly = true)
    public List<StagedRow> rows(long id, String sheet) {
        requireVisible(id);
        String sheetName = sheetName(id, sheet);
        return jdbc.query("""
                SELECT id, row_no, data::text AS data, skipped, status, messages::text AS messages,
                       resolved::text AS resolved, edit_source,
                       -- Từng ô đã sửa → cách sửa GẦN NHẤT (tay / sửa nhanh / AI): lưới tô đúng ô đó.
                       (SELECT jsonb_object_agg(x.field, x.source)::text FROM (
                            SELECT DISTINCT ON (e.field) e.field, e.source FROM data_import_edits e
                            WHERE e.row_id = r.id AND e.field <> '_skip'
                            ORDER BY e.field, e.edited_at DESC, e.id DESC) x) AS edited_cells
                FROM data_import_rows r WHERE batch_id = ? AND sheet = ? ORDER BY row_no, id
                """, (rs, i) -> new StagedRow(rs.getLong("id"), rs.getInt("row_no"),
                mapper.readValue(rs.getString("data"), DATA), rs.getBoolean("skipped"), rs.getString("status"),
                mapper.readValue(rs.getString("messages"), MESSAGES),
                mapper.readValue(rs.getString("resolved"), RESOLVED), rs.getString("edit_source"),
                rs.getString("edited_cells") == null ? Map.of() : mapper.readValue(rs.getString("edited_cells"), DATA)),
                id, sheetName);
    }

    /** Lịch sử sửa ô của lô, mới nhất trước. */
    @Transactional(readOnly = true)
    public List<Edit> edits(long id) {
        requireVisible(id);
        return jdbc.query("""
                SELECT e.id, e.sheet, e.row_no, e.row_id, e.field, e.old_value, e.new_value, e.source,
                       to_char(e.edited_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS') AS edited_at,
                       u.full_name AS edited_by
                FROM data_import_edits e LEFT JOIN users u ON u.id = e.edited_by_id
                WHERE e.batch_id = ? ORDER BY e.edited_at DESC, e.id DESC LIMIT 2000
                """, (rs, i) -> new Edit(rs.getLong("id"), rs.getString("sheet"), rs.getInt("row_no"),
                rs.getObject("row_id") == null ? null : rs.getLong("row_id"), rs.getString("field"),
                rs.getString("old_value"), rs.getString("new_value"), rs.getString("source"),
                rs.getString("edited_at"), rs.getString("edited_by")), id);
    }

    /**
     * Giá trị chọn được cho từng ô của lô (QLTB-617): theo trang → theo cột. Danh mục chung (loại phòng, khối, đơn vị
     * tính, môn…), giá trị cố định (tình trạng, nguồn…) và mã tham chiếu (cơ sở, khối nhà, phòng, cán bộ) — mã đã có ở
     * trường cộng mã đang có trong các trang của lô. Lưới hiện thành danh sách chọn thay cho gõ tay.
     */
    @Transactional(readOnly = true)
    public Map<String, Map<String, List<String>>> choices(long id) {
        requireVisible(id);
        CatalogImports.Kind kind = kindOf(id);
        if (kind != null) {
            return catalogImports.choices(kind);
        }
        long schoolId = ((Number) batchRow(id).get("school_id")).longValue();
        List<String> staff = codesOf(id, schoolId, "staff", OnboardingSheet.STAFF);
        List<String> rooms = codesOf(id, schoolId, "rooms", OnboardingSheet.ROOM);
        List<String> subjects = jdbc.queryForList("SELECT name FROM subjects WHERE active ORDER BY name", String.class);
        List<String> facility = List.of("Tốt", "Bình thường", "Cần sửa chữa", "Xuống cấp", "Hư hỏng nặng");
        Map<String, Map<String, List<String>>> out = new LinkedHashMap<>();
        out.put(OnboardingSheet.CAMPUS.key(), Map.of("primary", List.of("Có", "Không")));
        out.put(OnboardingSheet.STAFF.key(), Map.of(
                "type", List.of("Giáo viên", "Cán bộ"),
                "position", Arrays.stream(StaffPosition.values()).map(StaffPosition::label).toList(),
                "mainSubject", subjects));
        out.put(OnboardingSheet.BUILDING.key(), Map.of(
                "campus", codesOf(id, schoolId, "campuses", OnboardingSheet.CAMPUS),
                "condition", facility, "manager", staff));
        out.put(OnboardingSheet.ROOM.key(), Map.of(
                "building", codesOf(id, schoolId, "buildings", OnboardingSheet.BUILDING),
                "roomType", jdbc.queryForList("SELECT name FROM room_types WHERE active AND (school_id IS NULL OR school_id = ?)"
                        + " ORDER BY sort_order, name", String.class, schoolId),
                "subject", subjects, "condition", facility,
                "structure", List.of("Kiên cố", "Bán kiên cố", "Tạm", "Nhờ, mượn, thuê"),
                "usage", List.of("Đang sử dụng", "Bỏ trống", "Đang sửa chữa", "Ngừng sử dụng"),
                "manager", staff));
        out.put(OnboardingSheet.CLASS.key(), Map.of(
                "grade", jdbc.queryForList("SELECT name FROM grades WHERE active ORDER BY sort_order, name", String.class),
                "year", jdbc.queryForList("SELECT code FROM school_years WHERE active ORDER BY code DESC", String.class),
                "teacher", staff, "room", rooms));
        List<String> funding = new ArrayList<>(Arrays.stream(FundingSource.values())
                .filter(FundingSource::selectable).map(FundingSource::label).toList());
        funding.add(FundingSource.UNDETERMINED.label());
        out.put(OnboardingSheet.EQUIPMENT.key(), Map.of(
                "unit", jdbc.queryForList("SELECT name FROM units WHERE active ORDER BY name", String.class),
                "tracking", List.of("Từng cái", "Theo số lượng"),
                "room", rooms, "manager", staff,
                "origin", Arrays.stream(OriginRule.values()).map(OriginRule::label).toList(),
                "funding", funding,
                "condition", List.of("Tốt", "Khá", "Trung bình", "Kém", "Hỏng", "Không sử dụng")));
        return out;
    }

    /** Mã của một loại đối tượng: đã có ở trường cộng mã đang khai trong trang tương ứng của lô (bỏ dòng "Bỏ qua"). */
    private List<String> codesOf(long batchId, long schoolId, String table, OnboardingSheet sheet) {
        Set<String> out = new TreeSet<>(jdbc.queryForList(
                "SELECT code FROM " + table + " WHERE school_id = ? AND code IS NOT NULL", String.class, schoolId));
        rows(batchId, sheet.key()).forEach(r -> {
            String code = r.data().get("code");
            if (code != null && !code.isBlank() && !r.skipped()) {
                out.add(code.trim());
            }
        });
        return List.copyOf(out);
    }

    /**
     * Dữ liệu đã chuẩn hoá của lô (QLTB-619): như đang có trong vùng chờ, cùng khuôn tệp mẫu — không cột Dòng, Kết quả kiểm
     * tra, Lỗi / cảnh báo; bỏ dòng đã đánh "Bỏ qua". Tải lên lại được như một tệp mới.
     */
    @Transactional(readOnly = true)
    public byte[] cleanExport(long id) {
        requireVisible(id);
        if (kindOf(id) != null) {
            return catalogImports.export(id, kindOf(id), false);
        }
        List<XlsxWriter.Tab> tabs = new ArrayList<>();
        for (OnboardingSheet s : OnboardingSheet.values()) {
            List<Map<String, Object>> data = rows(id, s.key()).stream().filter(r -> !r.skipped())
                    .map(r -> (Map<String, Object>) new HashMap<String, Object>(r.data())).toList();
            if (data.isEmpty()) {
                continue;
            }
            List<XlsxWriter.Column> columns = s.columns().stream()
                    .map(c -> new XlsxWriter.Column(c.key(), c.label() + (c.required() ? " (*)" : ""), "text"))
                    .toList();
            tabs.add(new XlsxWriter.Tab(s.title(), new XlsxWriter.Sheet("Dữ liệu đã chuẩn hoá: " + s.title(),
                    "Cột có (*) là bắt buộc. Tải lên lại được ở Nhập dữ liệu đầu vào.", columns, data)));
        }
        if (tabs.isEmpty()) {
            throw new FieldValidationException("file", "Lô không có dòng dữ liệu nào");
        }
        return XlsxWriter.writeAll(tabs);
    }

    /** Tệp Excel của lô: mỗi trang dữ liệu như đang có trong vùng chờ, thêm cột trạng thái và lỗi / cảnh báo. */
    @Transactional(readOnly = true)
    public byte[] errorReport(long id) {
        requireVisible(id);
        if (kindOf(id) != null) {
            return catalogImports.export(id, kindOf(id), true);
        }
        List<XlsxWriter.Tab> tabs = new ArrayList<>();
        for (OnboardingSheet s : OnboardingSheet.values()) {
            List<StagedRow> rows = rows(id, s.key());
            if (rows.isEmpty()) {
                continue;
            }
            List<XlsxWriter.Column> columns = new ArrayList<>();
            columns.add(new XlsxWriter.Column("_row", "Dòng", "text"));
            columns.add(new XlsxWriter.Column("_status", "Kết quả kiểm tra", "text"));
            columns.add(new XlsxWriter.Column("_messages", "Lỗi / cảnh báo", "text"));
            s.columns().forEach(c -> columns.add(new XlsxWriter.Column(c.key(), c.label(), "text")));
            List<Map<String, Object>> data = new ArrayList<>();
            for (StagedRow r : rows) {
                Map<String, Object> m = new HashMap<>(r.data());
                m.put("_row", String.valueOf(r.rowNo()));
                m.put("_status", statusLabel(r.status()));
                m.put("_messages", String.join("; ", r.messages().stream()
                        .map(x -> ("error".equals(x.level()) ? "Lỗi: " : "Lưu ý: ") + x.text()).toList()));
                data.add(m);
            }
            tabs.add(new XlsxWriter.Tab(s.title(), new XlsxWriter.Sheet("Kết quả kiểm tra: " + s.title(),
                    "Sửa ngay trên hệ thống, hoặc sửa tệp gốc rồi tải lên lại.", columns, data)));
        }
        if (tabs.isEmpty()) {
            throw new FieldValidationException("file", "Lô không có dòng dữ liệu nào");
        }
        return XlsxWriter.writeAll(tabs);
    }

    // ------------------------------------------------------------------ tải lên, sửa

    @Transactional
    public Batch upload(Long requestedSchool, String filename, byte[] content) {
        long schoolId = resolveSchool(requestedSchool);
        List<NamedSheet> sheets = SpreadsheetReader.readAll(filename, content);
        Map<OnboardingSheet, List<Map.Entry<Integer, Map<String, String>>>> found = new LinkedHashMap<>();
        for (NamedSheet sheet : sheets) {
            Detected d = detect(sheet.rows());
            if (d == null) {
                continue;
            }
            if (found.containsKey(d.sheet())) {
                throw new FieldValidationException("file", "Tệp có hai trang " + d.sheet().title()
                        + " (\"" + sheet.name() + "\") — gộp lại thành một trang");
            }
            found.put(d.sheet(), d.sheet() == OnboardingSheet.ROOM ? fromHcmTemplate(d.rows()) : d.rows());
        }
        if (found.isEmpty()) {
            throw new FieldValidationException("file", "Không nhận ra trang nào — dòng tiêu đề phải có đủ các cột "
                    + "bắt buộc của mẫu (tải tệp mẫu để xem)");
        }
        Long userId = CurrentUser.id().orElse(null);
        Long batchId = jdbc.queryForObject("""
                INSERT INTO data_import_batches (school_id, file_name, created_by_id, created_at)
                VALUES (?, ?, ?, now()) RETURNING id
                """, Long.class, schoolId, filename == null ? "tep-nhap.xlsx" : filename, userId);
        List<Object[]> inserts = new ArrayList<>();
        found.forEach((s, rows) -> rows.forEach(r -> inserts.add(
                new Object[] {batchId, s.name(), r.getKey(), mapper.writeValueAsString(r.getValue())})));
        jdbc.batchUpdate("INSERT INTO data_import_rows (batch_id, sheet, row_no, data) VALUES (?, ?, ?, ?::jsonb)",
                inserts);
        revalidate(batchId);
        return summary(batchId);
    }

    /** Sửa một dòng chờ: các ô gửi lên đè ô cũ (chuỗi rỗng = xoá ô); {@code skipped} bỏ / dùng lại dòng. */
    @Transactional
    public Batch updateRow(long id, long rowId, Map<String, String> data, Boolean skipped) {
        requireDraft(id);
        applyEdit(id, rowId, data, skipped, "manual");
        touch(id);
        revalidate(id);
        return summary(id);
    }

    /**
     * Một ô / một dòng sửa trong lần sửa nhiều dòng. {@code source}: sửa tay (vắng / {@code manual}), sửa nhanh theo
     * luật ({@code rule}) hay AI ({@code ai}) — ghi vào lịch sử và tô lên dòng.
     */
    public record RowEdit(long rowId, Map<String, String> data, Boolean skipped,
            @Size(max = 40, message = "Nguồn sửa không hợp lệ") String source) {
    }

    /** Lưới kiểu Excel: lần dán một khối ô, kéo điền xuống = nhiều dòng, nhưng chỉ kiểm lại cả lô MỘT lần. */
    public static final int MAX_EDITS = 5000;

    @Transactional
    public Batch updateRows(long id, List<RowEdit> edits) {
        requireDraft(id);
        if (edits == null || edits.isEmpty()) {
            return summary(id);
        }
        if (edits.size() > MAX_EDITS) {
            throw new FieldValidationException("edits", "Mỗi lần sửa tối đa " + MAX_EDITS + " dòng");
        }
        for (RowEdit e : edits) {
            applyEdit(id, e.rowId(), e.data(), e.skipped(), e.source());
        }
        touch(id);
        revalidate(id);
        return summary(id);
    }

    private void applyEdit(long id, long rowId, Map<String, String> data, Boolean skipped, String source) {
        String src = "rule".equals(source) || "ai".equals(source) ? source : "manual";
        record Current(Map<String, String> data, boolean skipped, String sheet, int rowNo) {
        }
        Current cur = jdbc.query(
                "SELECT data::text, skipped, sheet, row_no FROM data_import_rows WHERE id = ? AND batch_id = ?",
                rs -> rs.next() ? new Current(mapper.readValue(rs.getString(1), DATA), rs.getBoolean(2),
                        rs.getString(3), rs.getInt(4)) : null, rowId, id);
        if (cur == null) {
            throw new ResourceNotFoundException("DataImportRow", rowId);
        }
        Map<String, String> current = cur.data();
        Long user = CurrentUser.id().orElse(null);
        boolean changed = false;
        if (data != null) {
            for (Map.Entry<String, String> e : data.entrySet()) {
                String k = e.getKey();
                String v = e.getValue() == null || e.getValue().isBlank() ? null : e.getValue().trim();
                String old = current.get(k);
                if (Objects.equals(old, v)) {
                    continue;
                }
                if (v == null) {
                    current.remove(k);
                } else {
                    current.put(k, v);
                }
                changed = true;
                logEdit(id, rowId, cur.sheet(), cur.rowNo(), k, old, v, src, user);
            }
        }
        if (skipped != null && skipped != cur.skipped()) {
            changed = true;
            logEdit(id, rowId, cur.sheet(), cur.rowNo(), "_skip", cur.skipped() ? "bỏ" : "dùng",
                    skipped ? "bỏ" : "dùng", src, user);
        }
        jdbc.update("UPDATE data_import_rows SET data = ?::jsonb, skipped = COALESCE(?, skipped),"
                + " edit_source = CASE WHEN ? THEN ? ELSE edit_source END WHERE id = ?",
                mapper.writeValueAsString(current), skipped, changed, src, rowId);
    }

    private void logEdit(long batchId, long rowId, String sheet, int rowNo, String field, String oldValue,
            String newValue, String source, Long user) {
        jdbc.update("INSERT INTO data_import_edits (batch_id, row_id, sheet, row_no, field, old_value, new_value,"
                + " source, edited_by_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                batchId, rowId, sheet, rowNo, field, oldValue, newValue, source, user);
    }

    /**
     * Xoá hẳn các dòng khỏi lô (menu chuột phải của lưới). Khác "bỏ dòng" ({@code skipped}): dòng bỏ vẫn nằm trong
     * lô, mờ đi và dùng lại được; dòng xoá thì mất. Kiểm lại cả lô một lần — dòng khác đang trỏ tới mã của dòng
     * vừa xoá sẽ báo lỗi.
     */
    @Transactional
    public Batch deleteRows(long id, List<Long> rowIds) {
        requireDraft(id);
        if (rowIds == null || rowIds.isEmpty()) {
            return summary(id);
        }
        if (rowIds.size() > MAX_EDITS) {
            throw new FieldValidationException("rowIds", "Mỗi lần xoá tối đa " + MAX_EDITS + " dòng");
        }
        jdbc.update("DELETE FROM data_import_rows WHERE batch_id = ? AND id = ANY (?)", id, rowIds.toArray(Long[]::new));
        touch(id);
        revalidate(id);
        return summary(id);
    }

    /** Thêm một dòng ngay trên hệ thống (thiếu một phòng, một cán bộ… thì khỏi sửa tệp gửi lại). */
    @Transactional
    public Batch addRow(long id, String sheet, Map<String, String> data) {
        requireDraft(id);
        String sheetName = sheetName(id, sheet);
        Integer next = jdbc.queryForObject(
                "SELECT COALESCE(MAX(row_no), 0) + 1 FROM data_import_rows WHERE batch_id = ? AND sheet = ?",
                Integer.class, id, sheetName);
        Map<String, String> clean = new LinkedHashMap<>();
        if (data != null) {
            data.forEach((k, v) -> {
                if (v != null && !v.isBlank()) {
                    clean.put(k, v.trim());
                }
            });
        }
        jdbc.update("INSERT INTO data_import_rows (batch_id, sheet, row_no, data) VALUES (?, ?, ?, ?::jsonb)", id,
                sheetName, next, mapper.writeValueAsString(clean));
        touch(id);
        revalidate(id);
        return summary(id);
    }

    @Transactional
    public Batch recheck(long id) {
        requireDraft(id);
        revalidate(id);
        return summary(id);
    }

    @Transactional
    public void delete(long id) {
        requireDraft(id);
        jdbc.update("DELETE FROM data_import_batches WHERE id = ?", id);
    }

    // ------------------------------------------------------------------ ghi

    /** Ghi cả lô vào sổ của trường. Còn dòng lỗi thì không ghi gì. */
    @Transactional
    public Batch commit(long id) {
        // Khoá TRƯỚC rồi mới kiểm còn nháp: bấm "Ghi" hai lần thì lần sau chờ khoá, và lúc có khoá lô đã là
        // COMMITTED — kiểm trước khi khoá thì cả hai cùng qua, lô được ghi hai lần (tài sản nhân đôi).
        lockBatch(id);
        CatalogImports.Kind kind = kindOf(id);
        if (kind != null) {
            requireDraft(id);
            catalogImports.commit(id, kind);
            return summary(id);
        }
        long schoolId = requireDraft(id);
        List<Staged> staged = staged(id);
        Map<Long, Result> results = validator.validate(schoolId, staged);
        persist(results);
        long errors = results.values().stream().filter(r -> OnboardingValidator.ERROR.equals(r.status())).count();
        if (errors > 0) {
            throw new FieldValidationException("file", "Còn " + errors + " dòng lỗi — sửa hết rồi ghi; chưa dòng nào được ghi");
        }
        Writer w = new Writer(id, schoolId);
        for (OnboardingSheet s : OnboardingSheet.values()) {
            for (Staged row : staged) {
                if (row.sheet() != s) {
                    continue;
                }
                Result r = results.get(row.id());
                if (!OnboardingValidator.OK.equals(r.status()) && !OnboardingValidator.WARNING.equals(r.status())) {
                    continue;
                }
                try {
                    w.write(s, r.payload());
                } catch (RuntimeException e) {
                    throw new FieldValidationException("file", "Trang " + s.title() + ", dòng " + row.rowNo() + ": "
                            + e.getMessage() + " — chưa dòng nào được ghi");
                }
            }
            if (s == OnboardingSheet.STAFF) {
                w.teams();
            }
        }
        Integer history = w.equipmentIds.isEmpty() ? 0 : jdbc.queryForObject(
                "SELECT COUNT(*) FROM equipment_history WHERE equipment_id = ANY (?)", Integer.class,
                (Object) w.equipmentIds.toArray(Long[]::new));
        jdbc.update("""
                UPDATE data_import_batches SET status = ?, committed_at = now(), committed_by_id = ?, history_count = ?,
                       updated_at = now() WHERE id = ?
                """, COMMITTED, CurrentUser.id().orElse(null), history, id);
        return summary(id);
    }

    /**
     * Hoàn tác: xoá mọi thứ lô đã tạo, đưa lô về nháp. Từ chối khi dữ liệu đã được dùng — tài sản đã vào phiếu,
     * phòng đã có tài sản khác, cán bộ đã có tài khoản… — vì xoá lúc đó là xoá cả việc người khác đã làm.
     */
    @Transactional
    public Batch rollback(long id) {
        // Khoá trước khi đọc trạng thái — cùng lý do với commit: bấm hoàn tác hai lần không được chạy hai lần.
        lockBatch(id);
        Map<String, Object> batch = batchRow(id);
        requireVisible(id);
        CatalogImports.Kind catalogKind = kindOf(id);
        if (catalogKind != null) {
            catalogImports.rollback(id, catalogKind);
            return summary(id);
        }
        if (!COMMITTED.equals(batch.get("status"))) {
            throw new ConflictException("Lô này chưa ghi vào hệ thống");
        }
        Boolean expired = jdbc.queryForObject("SELECT committed_at < now() - make_interval(hours => ?) "
                + "FROM data_import_batches WHERE id = ?", Boolean.class, UNDO_HOURS, id);
        if (Boolean.TRUE.equals(expired)) {
            throw new ConflictException("Đã quá %d giờ kể từ lúc ghi — không hoàn tác được; sửa từng hồ sơ trên màn tương ứng"
                    .formatted(UNDO_HOURS));
        }
        Map<String, List<Long>> created = new HashMap<>();
        jdbc.query("SELECT resource, record_id FROM data_import_records WHERE batch_id = ?", rs -> {
            created.computeIfAbsent(rs.getString("resource"), k -> new ArrayList<>()).add(rs.getLong("record_id"));
        }, id);
        Long[] equipmentIds = ids(created, "equipment");
        Integer historyAtCommit = (Integer) batch.get("history_count");
        if (equipmentIds.length > 0) {
            Integer history = jdbc.queryForObject("SELECT COUNT(*) FROM equipment_history WHERE equipment_id = ANY (?)",
                    Integer.class, (Object) equipmentIds);
            if (historyAtCommit != null && history != null && history > historyAtCommit) {
                throw new ConflictException("Thiết bị của lô đã có nghiệp vụ (cấp phát, sửa chữa, cập nhật…) — "
                        + "không hoàn tác được; sửa từng hồ sơ trên màn Thiết bị");
            }
            refuseIf("SELECT EXISTS (SELECT 1 FROM maintenance_plan_equipment WHERE equipment_id = ANY (?))",
                    equipmentIds, "Thiết bị của lô đã nằm trong kế hoạch bảo trì");
        }
        Long[] staffIds = ids(created, "staff");
        refuseIf("SELECT EXISTS (SELECT 1 FROM staff WHERE id = ANY (?) AND user_id IS NOT NULL)", staffIds,
                "Cán bộ của lô đã được cấp tài khoản");
        rewindCodeSequences(((Number) batch.get("school_id")).longValue(), equipmentIds);
        try {
            delete("equipment", equipmentIds);
            delete("equipment_catalogs", ids(created, "equipment_catalogs"));
            delete("subject_teams", ids(created, "subject_teams"));
            delete("school_classes", ids(created, "school_classes"));
            Long[] roomIds = ids(created, "rooms");
            refuseIf("SELECT EXISTS (SELECT 1 FROM equipment WHERE room_id = ANY (?))", roomIds,
                    "Phòng của lô đang có thiết bị khác");
            refuseIf("SELECT EXISTS (SELECT 1 FROM school_classes WHERE room_id = ANY (?))", roomIds,
                    "Phòng của lô đang là phòng học của lớp khác");
            delete("rooms", roomIds);
            delete("buildings", ids(created, "buildings"));
            for (String sql : List.of("SELECT EXISTS (SELECT 1 FROM equipment WHERE manager_id = ANY (?))",
                    "SELECT EXISTS (SELECT 1 FROM rooms WHERE managing_staff_id = ANY (?))",
                    "SELECT EXISTS (SELECT 1 FROM buildings WHERE managing_staff_id = ANY (?))",
                    "SELECT EXISTS (SELECT 1 FROM school_classes WHERE homeroom_teacher_id = ANY (?))",
                    "SELECT EXISTS (SELECT 1 FROM subject_teams WHERE leader_id = ANY (?))")) {
                refuseIf(sql, staffIds, "Cán bộ của lô đang được dùng ở dữ liệu khác (phụ trách phòng, quản lý thiết bị…)");
            }
            delete("staff", staffIds);
            delete("campuses", ids(created, "campuses"));
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Dữ liệu của lô đã được dùng ở nơi khác (phiếu, kiểm kê, lịch sử sửa chữa…) — "
                    + "không hoàn tác được");
        }
        jdbc.update("DELETE FROM data_import_records WHERE batch_id = ?", id);
        jdbc.update("""
                UPDATE data_import_batches SET status = ?, committed_at = NULL, committed_by_id = NULL,
                       history_count = NULL, updated_at = now() WHERE id = ?
                """, DRAFT, id);
        revalidate(id);
        return summary(id);
    }

    // ------------------------------------------------------------------ ghi từng loại

    /** Một lượt ghi: mã → id của thứ vừa tạo hoặc đã có, để trang sau tham chiếu. */
    private final class Writer {
        final long batchId;
        final long schoolId;
        final IdRef school;
        final Map<OnboardingSheet, Map<String, Long>> ids = new HashMap<>();
        final Map<String, List<Long>> teamMembers = new LinkedHashMap<>();
        final Map<String, Long> teamLeaders = new HashMap<>();
        final Map<String, Long> newItems = new HashMap<>();
        final List<Long> equipmentIds = new ArrayList<>();

        Writer(long batchId, long schoolId) {
            this.batchId = batchId;
            this.schoolId = schoolId;
            this.school = new IdRef(schoolId);
            load(OnboardingSheet.CAMPUS, "campuses");
            load(OnboardingSheet.STAFF, "staff");
            load(OnboardingSheet.BUILDING, "buildings");
            load(OnboardingSheet.ROOM, "rooms");
        }

        void load(OnboardingSheet s, String table) {
            Map<String, Long> m = ids.computeIfAbsent(s, k -> new HashMap<>());
            jdbc.query("SELECT id, code FROM " + table + " WHERE school_id = ?",
                    rs -> {
                        m.put(OnboardingValidator.upper(rs.getString("code")), rs.getLong("id"));
                    }, schoolId);
        }

        IdRef ref(OnboardingSheet s, String code) {
            if (code == null) {
                return null;
            }
            Long id = ids.get(s).get(OnboardingValidator.upper(code));
            return id == null ? null : new IdRef(id);
        }

        void put(OnboardingSheet s, String code, Long id) {
            ids.get(s).put(OnboardingValidator.upper(code), id);
        }

        void record(String resource, Long id) {
            jdbc.update("INSERT INTO data_import_records (batch_id, resource, record_id) VALUES (?, ?, ?)", batchId,
                    resource, id);
        }

        void write(OnboardingSheet s, Object payload) {
            switch (payload) {
                case CampusRow c -> {
                    Long id = campuses.create(new CampusRequest(c.code(), c.name(), null, true, c.note(), school,
                            c.primary(), c.phone(), c.address(), null)).getId();
                    put(s, c.code(), id);
                    record("campuses", id);
                }
                case StaffRow c -> {
                    Long id = staff.create(new StaffRequest(c.code(), c.name(), null, true, c.note(), school, c.type(),
                            c.position(), c.department() != null ? c.department() : c.team(), c.phone(), c.email(),
                            c.subjects().stream().map(IdRef::new).toList(),
                            c.mainSubject() == null ? null : new IdRef(c.mainSubject()))).getId();
                    put(s, c.code(), id);
                    record("staff", id);
                    if (c.team() != null && c.type() == StaffType.TEACHER) {
                        teamMembers.computeIfAbsent(c.team(), k -> new ArrayList<>()).add(id);
                        if (c.position() == StaffPosition.TO_TRUONG) {
                            teamLeaders.putIfAbsent(c.team(), id);
                        }
                    }
                }
                case BuildingRow c -> {
                    Long id = buildings.create(new BuildingRequest(c.code(), c.name(), null, true, c.note(), school,
                            ref(OnboardingSheet.CAMPUS, c.campus()), c.floors(), c.year(), c.area(), c.condition(),
                            ref(OnboardingSheet.STAFF, c.manager()), null)).getId();
                    put(s, c.code(), id);
                    record("buildings", id);
                }
                case RoomRow c -> {
                    Long id = rooms.create(new RoomRequest(c.code(), c.name(), null, true, c.note(), school, null,
                            ref(OnboardingSheet.BUILDING, c.building()), new IdRef(c.roomType()),
                            c.subject() == null ? null : new IdRef(c.subject()), null, c.floor(), c.area(), c.capacity(),
                            c.condition(), c.usage(), ref(OnboardingSheet.STAFF, c.manager()), c.unit(), null, c.structure(), null,
                            null, null, null)).getId();
                    put(s, c.code(), id);
                    record("rooms", id);
                }
                case ClassRow c -> {
                    Long id = classes.create(new SchoolClassRequest(c.code(), c.code(), null, true, c.note(), school,
                            new IdRef(c.grade()), new IdRef(c.year()), ref(OnboardingSheet.STAFF, c.teacher()),
                            ref(OnboardingSheet.ROOM, c.room()), c.students())).getId();
                    record("school_classes", id);
                }
                case EquipmentRow c -> equipment(c);
                default -> throw new IllegalStateException("Dòng không đọc được");
            }
        }

        /** Tổ bộ môn chưa có của trường: tạo, thành viên là giáo viên ghi tổ đó, tổ trưởng là người ghi chức vụ ấy. */
        void teams() {
            Map<String, Long> existing = new HashMap<>();
            jdbc.query("SELECT id, name FROM subject_teams WHERE school_id = ?", rs -> {
                existing.put(OnboardingValidator.norm(rs.getString("name")), rs.getLong("id"));
            }, schoolId);
            teamMembers.forEach((name, members) -> {
                if (existing.containsKey(OnboardingValidator.norm(name))) {
                    return;
                }
                Long leader = teamLeaders.get(name);
                Long id = teams.create(new SubjectTeamRequest(null, name, null, true, null, school,
                        leader == null ? null : new IdRef(leader), List.of(),
                        members.stream().map(IdRef::new).toList())).getId();
                existing.put(OnboardingValidator.norm(name), id);
                record("subject_teams", id);
            });
        }

        void equipment(EquipmentRow c) {
            Long catalog = c.catalog();
            if (catalog == null) {
                catalog = newItems.computeIfAbsent(c.newItem().key(), k -> createItem(c));
            }
            EquipmentRequest request = new EquipmentRequest(c.legacy(), c.name(), null, true, c.note(), school,
                    new IdRef(catalog), null, null, c.serial(), null, null, null, null, c.quantity(),
                    c.originSource() == null ? null : new IdRef(c.originSource()), null, c.funding(), null, c.year(),
                    c.receivedDate(), c.receivedDate(), c.originalValue(), c.remainingValue(), null, null,
                    ref(OnboardingSheet.ROOM, c.room()), ref(OnboardingSheet.STAFF, c.manager()),
                    c.condition(), null, null, null);
            for (int i = 0; i < c.copies(); i++) {
                Long id = equipment.create(request).getId();
                equipmentIds.add(id);
                record("equipment", id);
            }
            if (c.aliasCode() != null) {
                jdbc.update("INSERT INTO equipment_catalog_aliases (alias, catalog_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
                        c.aliasCode(), c.catalog());
            }
        }

        /** Thiết bị ngoài danh mục của trường, cho các dòng không ghép được vào danh mục. */
        Long createItem(EquipmentRow c) {
            NewItem n = c.newItem();
            Long unit = n.unit() != null ? n.unit() : lookup("SELECT id FROM units WHERE name = ? ORDER BY id LIMIT 1", "Cái");
            Long type = lookup("SELECT id FROM equipment_types WHERE code = ?", n.chemical() ? "HC" : "KH");
            AssetCategory category = n.chemical() ? AssetCategory.CHEMICAL
                    : n.bulk() ? AssetCategory.SUPPLY
                    : c.originalValue() != null && c.originalValue().compareTo(new BigDecimal("10000000")) >= 0
                            ? AssetCategory.FIXED_ASSET : AssetCategory.DURABLE_TOOL;
            CatalogOrigin origin = c.origin() == OriginRule.TU_LAM ? CatalogOrigin.SELF_MADE
                    : c.origin() == OriginRule.TANG_TAI_TRO ? CatalogOrigin.DONATED : CatalogOrigin.OUTSIDE_PURCHASE;
            Long id = catalogs.createForSchool(new SchoolItemRequest(n.name(), new IdRef(type),
                    n.subject() == null ? null : new IdRef(n.subject()), null, new IdRef(unit), category,
                    n.bulk() ? TrackingType.BULK : TrackingType.SERIAL, null, origin, null,
                    "Tạo khi nhập dữ liệu đầu vào"), schoolId).getId();
            record("equipment_catalogs", id);
            return id;
        }
    }

    // ------------------------------------------------------------------ nội bộ

    record Detected(OnboardingSheet sheet, List<Map.Entry<Integer, Map<String, String>>> rows) {
    }

    /** Bốn giá trị cột "Hiện trạng" của file mẫu phòng CSDL HCM — ở đó cột này là KẾT CẤU, không phải chất lượng. */
    private static final Set<String> STRUCTURE_VALUES = Set.of("KIEN_CO", "BAN_KIEN_CO", "TAM", "NHO_MUON_THUE");

    /**
     * Trang phòng làm từ file mẫu phòng của CSDL HCM (QLTB-637, `File_mau_phong_hoc_csvc.xlsx`): cột "Hiện trạng" ghi
     * Kiên cố / Bán kiên cố / Tạm / Nhờ, mượn, thuê là kết cấu → chuyển sang cột Kết cấu; không có mã phòng → cấp
     * HM + số dòng (HM0019). Trang theo mẫu của hệ thống đi qua nguyên vẹn.
     */
    static List<Map.Entry<Integer, Map<String, String>>> fromHcmTemplate(List<Map.Entry<Integer, Map<String, String>>> rows) {
        List<Map.Entry<Integer, Map<String, String>>> out = new ArrayList<>();
        for (Map.Entry<Integer, Map<String, String>> e : rows) {
            Map<String, String> data = new LinkedHashMap<>(e.getValue());
            String condition = data.get("condition");
            if (condition != null && data.get("structure") == null
                    && STRUCTURE_VALUES.contains(OnboardingValidator.fold(condition).replaceAll("^_|_$", ""))) {
                data.put("structure", data.remove("condition"));
            }
            if (data.get("code") == null || data.get("code").isBlank()) {
                data.put("code", "HM%04d".formatted(e.getKey()));
            }
            out.add(Map.entry(e.getKey(), data));
        }
        return out;
    }

    /**
     * Nhận ra trang theo dòng tiêu đề trong 15 dòng đầu. Tiêu đề hai tầng (ô gộp "Giá trị" trên, "Nguyên giá" /
     * "Còn lại" dưới) đọc gộp hai dòng, ô dòng dưới được ưu tiên. Dòng hướng dẫn ngay dưới tiêu đề, dòng
     * "Tổng cộng", dòng tiêu đề nhóm ("I. Thiết bị dùng chung") và phần chữ ký cuối trang thì bỏ.
     */
    static Detected detect(List<List<String>> rows) {
        OnboardingSheet best = null;
        int bestStart = -1;
        int bestCount = 0;
        Map<Integer, String> bestKeys = null;
        for (int i = 0; i < Math.min(rows.size(), 15); i++) {
            List<String> top = rows.get(i);
            List<String> below = i + 1 < rows.size() ? rows.get(i + 1) : List.of();
            for (OnboardingSheet s : OnboardingSheet.values()) {
                Map<String, String> byLabel = labels(s);
                Map<Integer, String> one = headerKeys(byLabel, top, List.of());
                Map<Integer, String> two = headerKeys(byLabel, top, below);
                boolean useTwo = two.size() > one.size() && !one.isEmpty();
                Map<Integer, String> keys = useTwo ? two : one;
                boolean complete = keys.size() >= 2 && s.detectColumns().stream()
                        .allMatch(col -> keys.containsValue(col.key()));
                if (complete && keys.size() > bestCount) {
                    best = s;
                    bestStart = useTwo ? i + 2 : i + 1;
                    bestCount = keys.size();
                    bestKeys = keys;
                }
            }
        }
        if (best == null) {
            return null;
        }
        Set<String> hints = new HashSet<>();
        best.columns().forEach(c -> {
            if (!c.hint().isBlank()) {
                hints.add(c.hint());
            }
        });
        List<Map.Entry<Integer, Map<String, String>>> result = new ArrayList<>();
        for (int i = bestStart; i < rows.size(); i++) {
            List<String> cells = rows.get(i);
            Map<String, String> data = new LinkedHashMap<>();
            for (Map.Entry<Integer, String> k : bestKeys.entrySet()) {
                String v = k.getKey() < cells.size() ? cells.get(k.getKey()) : null;
                if (v != null && !v.isBlank()) {
                    data.put(k.getValue(), v.trim());
                }
            }
            if (data.isEmpty()) {
                continue;
            }
            if (i <= bestStart + 1 && (isHint(data, hints) || isColumnNumbers(data))) {
                continue;
            }
            if (isJunk(cells, data)) {
                continue;
            }
            result.add(Map.entry(i + 1, data));
        }
        return new Detected(best, result);
    }

    /** Nhãn và các tên khác của mọi cột một trang, theo khoá so ({@link #headerKey}). */
    private static Map<String, String> labels(OnboardingSheet s) {
        Map<String, String> byLabel = new HashMap<>();
        for (OnboardingSheet.Column c : s.columns()) {
            byLabel.putIfAbsent(headerKey(c.label()), c.key());
            c.aliases().forEach(a -> byLabel.putIfAbsent(headerKey(a), c.key()));
        }
        // Nhãn chính của một cột thắng tên khác của cột khác khi trùng.
        for (OnboardingSheet.Column c : s.columns()) {
            byLabel.put(headerKey(c.label()), c.key());
        }
        return byLabel;
    }

    /** Khoá các cột nhận ra ở một dòng tiêu đề; có {@code below} thì ô dòng dưới (tầng hai) được xét trước. */
    private static Map<Integer, String> headerKeys(Map<String, String> byLabel, List<String> top, List<String> below) {
        Map<Integer, String> keys = new HashMap<>();
        int width = Math.max(top.size(), below.size());
        for (int c = 0; c < width; c++) {
            String key = null;
            if (c < below.size()) {
                key = lookupHeader(byLabel, below.get(c));
            }
            if (key == null && c < top.size()) {
                key = lookupHeader(byLabel, top.get(c));
            }
            if (key != null && !keys.containsValue(key)) {
                keys.put(c, key);
            }
        }
        return keys;
    }

    private static String lookupHeader(Map<String, String> byLabel, String cell) {
        if (cell == null || cell.isBlank() || cell.length() > 80) {
            return null;
        }
        String key = byLabel.get(headerKey(cell));
        return key != null ? key : byLabel.get(headerKey(cell.replaceAll("\\([^)]*\\)", " ")));
    }

    /** Khoá so tiêu đề: bỏ dấu, bỏ "(*)", "*", dấu câu và khoảng trắng — "Đ.V.T" = "ĐVT", "Tên TB:" = "Tên TB". */
    static String headerKey(String s) {
        return ImportValues.fold(s.replace("(*)", " ").replace("*", " ")).replace("_", "");
    }

    /** Dòng đánh số cột ngay dưới tiêu đề: (1) (2) (3)… hoặc 1 2 3… */
    private static boolean isColumnNumbers(Map<String, String> data) {
        return data.size() >= 3 && data.values().stream().allMatch(v -> v.matches("\\(?[0-9A-Za-z]{1,2}\\)?"))
                && data.values().stream().filter(v -> v.matches("\\(?\\d{1,2}\\)?")).count() >= 2;
    }

    private static final java.util.regex.Pattern TOTAL =
            java.util.regex.Pattern.compile("^(TONG_CONG(_.{0,30})?|TONG_SO(_CONG)?|TONG|CONG|TONG_GIA_TRI|"
                    + "CONG_(TRANG|NHOM|PHAN|MUC|LOAI|DON)(_.{0,10})?)$");
    private static final java.util.regex.Pattern FOOTER = java.util.regex.Pattern.compile(
            "^(NGUOI_LAP|THU_TRUONG|KE_TOAN|HIEU_TRUONG|XAC_NHAN|KY_|KY$|NGAY_.*THANG|DA_KY|CHU_TICH|PHU_TRACH_KE_TOAN|"
                    + "CAN_BO_THIET_BI|NGUOI_KIEM|TRUONG_BAN|THU_KHO|DAI_DIEN).*");
    private static final java.util.regex.Pattern SECTION =
            java.util.regex.Pattern.compile("^(?:[IVXLC]{1,5}|[A-Z]|PHAN_[A-Z0-9]+|NHOM_[A-Z0-9]+)(?:_.*)?$");

    /**
     * Dòng không phải dữ liệu: "Tổng cộng" / "Cộng", phần chữ ký cuối trang, dòng tiêu đề nhóm (STT là số La Mã
     * hoặc chữ cái, chỉ một ô chữ). Dòng thật chỉ có tên (số lượng để trống = 1) vẫn giữ.
     */
    private static boolean isJunk(List<String> cells, Map<String, String> data) {
        List<String> filled = cells.stream().filter(c -> c != null && !c.isBlank()).map(String::trim).toList();
        if (filled.isEmpty()) {
            return true;
        }
        for (String c : filled) {
            String f = ImportValues.fold(c).replaceAll("^_|_$", "");
            if (f.length() <= 45 && TOTAL.matcher(f).matches()) {
                return true;
            }
        }
        if (filled.size() <= 3 && filled.stream()
                .allMatch(c -> FOOTER.matcher(ImportValues.fold(c).replaceAll("^_", "")).matches()
                        || c.matches("\\(.*\\)"))) {
            return true;
        }
        if (filled.size() <= 2 && data.size() <= 2) {
            String first = filled.get(0);
            String f = ImportValues.fold(first).replaceAll("^_|_$", "");
            boolean numbered = filled.size() == 2 && first.matches("[IVXLC]{1,5}\\.?|[A-Ha-h][.)]?");
            boolean titled = first.matches("^(?:[IVXLC]{1,5}|[A-H])[.)]\\s+\\S.*") || f.startsWith("PHAN_")
                    || f.startsWith("NHOM_");
            return (numbered || titled) && SECTION.matcher(f).matches();
        }
        return false;
    }

    private static boolean isHint(Map<String, String> data, Set<String> hints) {
        return data.values().stream().anyMatch(v -> hints.contains(v) || v.startsWith("Mã do trường đặt")
                || v.startsWith("Theo trang tính") || v.startsWith("Một trong:"));
    }

    private void revalidate(long id) {
        CatalogImports.Kind kind = kindOf(id);
        if (kind != null) {
            catalogImports.revalidate(id, kind);
            return;
        }
        long schoolId = ((Number) batchRow(id).get("school_id")).longValue();
        persist(validator.validate(schoolId, staged(id)));
    }

    private void persist(Map<Long, Result> results) {
        List<Object[]> updates = new ArrayList<>();
        results.forEach((rowId, r) -> updates.add(new Object[] {r.status(), mapper.writeValueAsString(r.messages()),
                mapper.writeValueAsString(r.resolved()), rowId}));
        jdbc.batchUpdate("UPDATE data_import_rows SET status = ?, messages = ?::jsonb, resolved = ?::jsonb WHERE id = ?",
                updates);
    }

    private List<Staged> staged(long id) {
        return jdbc.query("SELECT id, sheet, row_no, data::text AS data, skipped FROM data_import_rows "
                + "WHERE batch_id = ? ORDER BY row_no, id", (rs, i) -> new Staged(rs.getLong("id"),
                OnboardingSheet.valueOf(rs.getString("sheet")), rs.getInt("row_no"),
                mapper.readValue(rs.getString("data"), DATA), rs.getBoolean("skipped")), id);
    }

    private Batch summary(long id) {
        Map<String, Object> b = batchRow(id);
        Map<String, int[]> counts = new LinkedHashMap<>();
        jdbc.query("SELECT sheet, status, COUNT(*) AS n FROM data_import_rows WHERE batch_id = ? GROUP BY sheet, status",
                rs -> {
                    int[] c = counts.computeIfAbsent(rs.getString("sheet"), k -> new int[6]);
                    int n = rs.getInt("n");
                    c[0] += n;
                    switch (rs.getString("status")) {
                        case OnboardingValidator.OK -> c[1] += n;
                        case OnboardingValidator.WARNING -> c[2] += n;
                        case OnboardingValidator.ERROR -> c[3] += n;
                        case OnboardingValidator.EXISTS -> c[4] += n;
                        default -> c[5] += n;
                    }
                }, id);
        List<SheetCount> sheets = new ArrayList<>();
        int errors = 0;
        CatalogImports.Kind kind = CatalogImports.kindOf(b.get("kind"));
        if (kind != null) {
            int[] c = counts.getOrDefault(kind.name(), new int[6]);
            errors = c[3] + catalogImports.batchErrors(b.get("preview"));
            sheets.add(new SheetCount(kind.key(), kind.title(), c[0], c[1], c[2], c[3], c[4], c[5]));
        } else {
            for (OnboardingSheet s : OnboardingSheet.values()) {
                int[] c = counts.getOrDefault(s.name(), new int[6]);
                errors += c[3];
                sheets.add(new SheetCount(s.key(), s.title(), c[0], c[1], c[2], c[3], c[4], c[5]));
            }
        }
        Map<String, Integer> created = new LinkedHashMap<>();
        jdbc.query("SELECT resource, COUNT(*) AS n FROM data_import_records WHERE batch_id = ? GROUP BY resource",
                rs -> {
                    created.put(rs.getString("resource"), rs.getInt("n"));
                }, id);
        IdName school = b.get("school_id") == null ? null
                : new IdName(((Number) b.get("school_id")).longValue(), (String) b.get("school_name"));
        return new Batch(id, kind == null ? "school_data" : kind.key(),
                kind == null ? "Dữ liệu đầu vào của trường" : kind.title(), school,
                (String) b.get("file_name"), (String) b.get("status"), iso(b.get("created_at")),
                (String) b.get("created_by"), iso(b.get("committed_at")), (String) b.get("committed_by"), sheets, errors,
                created, kind == null ? null : catalogImports.preview(b.get("preview")));
    }

    private Map<String, Object> batchRow(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT b.*, b.preview::text AS preview, s.name AS school_name,
                       COALESCE(cu.full_name, cu.username) AS created_by,
                       COALESCE(mu.full_name, mu.username) AS committed_by
                FROM data_import_batches b
                LEFT JOIN schools s ON s.id = b.school_id
                LEFT JOIN users cu ON cu.id = b.created_by_id
                LEFT JOIN users mu ON mu.id = b.committed_by_id
                WHERE b.id = ?
                """, id);
        if (rows.isEmpty()) {
            throw new ResourceNotFoundException("DataImportBatch", id);
        }
        return rows.get(0);
    }

    private Long requireVisible(long id) {
        Map<String, Object> row = batchRow(id);
        CatalogImports.Kind kind = CatalogImports.kindOf(row.get("kind"));
        if (kind != null) {
            if (!catalogImports.allowed(kind)) {
                throw new ResourceNotFoundException("DataImportBatch", id);
            }
            return null;
        }
        long schoolId = ((Number) row.get("school_id")).longValue();
        Set<Long> visible = visibleSchools.current();
        if (visible != null && !visible.contains(schoolId)) {
            throw new ResourceNotFoundException("DataImportBatch", id);
        }
        return schoolId;
    }

    /**
     * Khoá dòng lô trước khi đọc trạng thái — mọi thao tác ghi lên lô đi qua đây ({@link #requireDraft} gọi sẵn): Ghi,
     * Hoàn tác, Xoá lô, sửa / thêm / xoá dòng chạy song song trên cùng lô thì xếp hàng, và người tới sau thấy trạng
     * thái người trước để lại (xoá lô đúng lúc đang Ghi không còn xoá mất lô vừa ghi). Không có lô thì 404.
     */
    private void lockBatch(long id) {
        if (jdbc.queryForList("SELECT id FROM data_import_batches WHERE id = ? FOR UPDATE", Long.class, id).isEmpty()) {
            throw new ResourceNotFoundException("DataImportBatch", id);
        }
    }

    private Long requireDraft(long id) {
        lockBatch(id);
        Long schoolId = requireVisible(id);
        if (!DRAFT.equals(batchRow(id).get("status"))) {
            throw new ConflictException("Lô đã ghi vào hệ thống — muốn sửa thì hoàn tác trước");
        }
        return schoolId;
    }

    private long resolveSchool(Long requested) {
        Set<Long> visible = visibleSchools.current();
        if (requested == null) {
            Long own = principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
            if (own == null) {
                throw new FieldValidationException("schoolId", "Chọn trường nhận dữ liệu");
            }
            return own;
        }
        if (visible != null && !visible.contains(requested)) {
            throw new ResourceNotFoundException("School", requested);
        }
        return requested;
    }

    private void touch(long id) {
        jdbc.update("UPDATE data_import_batches SET updated_at = now() WHERE id = ?", id);
    }

    /**
     * Trả lại số thứ tự của lô cho bộ đếm mã — chạy TRƯỚC khi xoá tài sản của lô (cần mã của chúng), cùng giao dịch.
     * Chỉ lùi bộ đếm mà lô đã dùng, và chỉ khi mọi số từ số nhỏ nhất của lô tới số hiện tại của bộ đếm đều là của lô:
     * còn số nào trong khoảng đó không thuộc lô thì nó đã cấp cho tài sản khác — kể cả tài sản đã điều chuyển sang
     * trường khác hay hồ sơ đã thanh lý rồi xoá, vốn không còn mang {@code school_id} của trường — và cấp lại là hai
     * tài sản cùng một mã trên tem. Không lùi được thì để nguyên: hụt vài số không sai gì, trùng mã thì sai.
     */
    private void rewindCodeSequences(long schoolId, Long[] equipmentIds) {
        if (equipmentIds.length == 0) {
            return;
        }
        jdbc.update("""
                WITH lot AS (
                    SELECT split_part(code, '.', 1) || '.' || split_part(code, '.', 2) || '.'
                               || split_part(code, '.', 3) || '.' || split_part(code, '.', 4) || '.'
                               || split_part(code, '.', 6) AS prefix,
                           split_part(code, '.', 5)::int AS seq
                    FROM equipment
                    WHERE id = ANY (?)
                      AND code ~ '^[0-9]{2}\\.[A-Z0-9]{2}\\.[0-9]{2}\\.[A-Z]{2}\\.[0-9]{3}\\.[0-9]{2}$'
                ), span AS (
                    SELECT prefix, MIN(seq) AS lo, MAX(seq) AS hi, COUNT(DISTINCT seq) AS n FROM lot GROUP BY prefix
                )
                UPDATE equipment_code_sequences q SET current_number = s.lo - 1
                FROM span s
                WHERE q.school_id = ? AND q.code_prefix = s.prefix
                  AND q.current_number = s.hi AND s.n = s.hi - s.lo + 1
                """, equipmentIds, schoolId);
    }

    private void delete(String table, Long[] ids) {
        if (ids.length > 0) {
            jdbc.update("DELETE FROM " + table + " WHERE id = ANY (?)", (Object) ids);
        }
    }

    private void refuseIf(String sql, Long[] ids, String message) {
        if (ids.length > 0 && Boolean.TRUE.equals(jdbc.queryForObject(sql, Boolean.class, (Object) ids))) {
            throw new ConflictException(message + " — không hoàn tác được");
        }
    }

    private Long lookup(String sql, Object... args) {
        return jdbc.queryForList(sql, Long.class, args).stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("Thiếu dữ liệu danh mục cho thiết bị ngoài danh mục"));
    }

    private static Long[] ids(Map<String, List<Long>> created, String resource) {
        return created.getOrDefault(resource, List.of()).toArray(Long[]::new);
    }

    /** Loại danh mục của lô; {@code null} là lô dữ liệu đầu vào của một trường. */
    private CatalogImports.Kind kindOf(long id) {
        return CatalogImports.kindOf(batchRow(id).get("kind"));
    }

    /** Tên trang lưu ở {@code data_import_rows.sheet}: lô danh mục chỉ có một trang, mang tên loại. */
    private String sheetName(long id, String key) {
        CatalogImports.Kind kind = kindOf(id);
        return kind != null ? kind.name() : sheet(key).name();
    }

    /** Lô danh mục: đổi tuỳ chọn ngừng mục không có trong tệp rồi kiểm tra lại. */
    @Transactional
    public Batch setDeactivate(long id, boolean deactivateMissing) {
        requireDraft(id);
        CatalogImports.Kind kind = kindOf(id);
        if (kind == null) {
            throw new FieldValidationException("deactivateMissing", "Chỉ lô danh mục có tuỳ chọn này");
        }
        catalogImports.setDeactivate(id, kind, deactivateMissing);
        return summary(id);
    }

    /** Lô danh mục mới từ tệp. */
    @Transactional
    public Batch uploadCatalog(String kindKey, String filename, byte[] content, boolean deactivateMissing) {
        CatalogImports.Kind kind = CatalogImports.Kind.of(kindKey);
        if (kind == null) {
            throw new FieldValidationException("kind", "Loại dữ liệu không đúng");
        }
        return summary(catalogImports.upload(kind, filename == null ? "tep-nhap.xlsx" : filename, content,
                deactivateMissing));
    }

    public byte[] catalogTemplate(String kindKey) {
        CatalogImports.Kind kind = CatalogImports.Kind.of(kindKey);
        if (kind == null) {
            throw new FieldValidationException("kind", "Loại dữ liệu không đúng");
        }
        return catalogImports.template(kind);
    }

    private static OnboardingSheet sheet(String key) {
        OnboardingSheet s = OnboardingSheet.of(key);
        if (s == null) {
            throw new ResourceNotFoundException("OnboardingSheet", key);
        }
        return s;
    }

    private static String iso(Object value) {
        if (value instanceof Timestamp t) {
            return t.toInstant().toString();
        }
        if (value instanceof OffsetDateTime t) {
            return t.toInstant().toString();
        }
        return value == null ? null : value.toString();
    }

    private static String statusLabel(String status) {
        return switch (status) {
            case OnboardingValidator.OK -> "Hợp lệ";
            case OnboardingValidator.WARNING -> "Có lưu ý";
            case OnboardingValidator.ERROR -> "Lỗi";
            case OnboardingValidator.EXISTS -> "Đã có trên hệ thống";
            default -> "Bỏ qua";
        };
    }
}
