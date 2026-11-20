package com.g123.sfems.module.system.dataimport;

import com.g123.sfems.module.catalog.ward.WardImportService;
import com.g123.sfems.module.organization.school.service.SchoolImportService;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.office.SheetImport;
import com.g123.sfems.shared.office.SheetImport.Applied;
import com.g123.sfems.shared.office.SheetImport.Checked;
import com.g123.sfems.shared.office.SheetImport.Input;
import com.g123.sfems.shared.office.SheetImport.RowCheck;
import com.g123.sfems.shared.office.SheetImport.Snapshot;
import com.g123.sfems.shared.office.XlsxWriter;
import com.g123.sfems.shared.security.CurrentUser;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Lô nhập DANH MỤC dùng chung (danh sách trường, phường/xã) — cùng vùng chờ với dữ liệu đầu vào của trường
 * ({@link OnboardingService}): tệp đọc vào {@code data_import_rows}, sửa trên lưới, kiểm tra lại, ghi, hoàn tác.
 *
 * <p>Khác dữ liệu đầu vào ở chỗ ghi SỬA và NGỪNG bản ghi đã có, nên giữ giá trị cũ ({@code data_import_snapshots}) để
 * hoàn tác. Kiểm tra và ghi do service của chính danh mục làm ({@link SchoolImportService}, {@link WardImportService});
 * đây chỉ lo lô: lưu dòng, lưu kết quả, quyền.
 */
@Service
public class CatalogImports {

    /** Loại lô danh mục. {@code key} là tên trang trong API, {@code name()} là giá trị cột {@code kind} và {@code sheet}. */
    public enum Kind {
        SCHOOLS("schools", "Danh sách trường", "schools", "schools:write", SchoolImportService.COLUMNS,
                SchoolImportService.MAX_ROWS),
        WARDS("wards", "Phường/xã", "wards", "wards:write", WardImportService.COLUMNS, WardImportService.MAX_ROWS);

        final String key;
        final String title;
        final String resource;
        final String permission;
        final List<SheetImport.Column> columns;
        final int maxRows;

        Kind(String key, String title, String resource, String permission, List<SheetImport.Column> columns,
                int maxRows) {
            this.key = key;
            this.title = title;
            this.resource = resource;
            this.permission = permission;
            this.columns = columns;
            this.maxRows = maxRows;
        }

        public String key() {
            return key;
        }

        public String title() {
            return title;
        }

        public static Kind of(String value) {
            for (Kind k : values()) {
                if (k.key.equalsIgnoreCase(value) || k.name().equalsIgnoreCase(value)) {
                    return k;
                }
            }
            return null;
        }
    }

    private static final TypeReference<Map<String, String>> DATA = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {
    };

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final SchoolImportService schools;
    private final WardImportService wards;

    @PersistenceContext
    private EntityManager entityManager;

    public CatalogImports(JdbcTemplate jdbc, ObjectMapper mapper, SchoolImportService schools, WardImportService wards) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.schools = schools;
        this.wards = wards;
    }

    // ------------------------------------------------------------------ quyền

    /** Người gọi làm được lô loại này không: có quyền sửa danh mục đó; danh sách trường còn phải là Sở / quản trị. */
    public boolean allowed(Kind kind) {
        if (!CurrentUser.has(kind.permission)) {
            return false;
        }
        if (kind == Kind.SCHOOLS) {
            try {
                schools.requireCityWide();
            } catch (AccessDeniedException e) {
                return false;
            }
        }
        return true;
    }

    public void require(Kind kind) {
        if (!allowed(kind)) {
            throw new AccessDeniedException("Không có quyền cập nhật " + kind.title.toLowerCase());
        }
    }

    // ------------------------------------------------------------------ mẫu, trang, giá trị chọn

    public List<OnboardingService.SheetInfo> sheets() {
        return List.of(Kind.values()).stream().map(k -> new OnboardingService.SheetInfo(k.key, k.title,
                k.columns.stream().map(c -> new OnboardingSheet.Column(c.key(), c.label(), c.required(), c.hint(),
                        c.aliases())).toList())).toList();
    }

    public byte[] template(Kind kind) {
        return SheetImport.template(kind.title, kind.columns);
    }

    public Map<String, Map<String, List<String>>> choices(Kind kind) {
        return Map.of(kind.key, kind == Kind.SCHOOLS ? schools.choices() : Map.of());
    }

    // ------------------------------------------------------------------ tải lên, kiểm tra

    /** Đọc tệp vào một lô chờ mới. Trả id lô. */
    @Transactional
    public long upload(Kind kind, String filename, byte[] content, boolean deactivateMissing) {
        require(kind);
        SheetImport.Rows rows = SheetImport.read(filename, content, kind.columns, kind.maxRows);
        // Lô rỗng mà bật "ngừng mục không có trong tệp" thì ghi vào sẽ ngừng cả danh mục — chặn ngay lúc tải lên.
        if (rows.values().isEmpty()) {
            throw new FieldValidationException("file", OnboardingService.EMPTY_FILE);
        }
        Long batchId = jdbc.queryForObject("""
                INSERT INTO data_import_batches (kind, school_id, file_name, created_by_id, created_at, options)
                VALUES (?, NULL, ?, ?, now(), ?::jsonb) RETURNING id
                """, Long.class, kind.name(), filename, CurrentUser.id().orElse(null),
                mapper.writeValueAsString(Map.of("deactivateMissing", deactivateMissing)));
        List<Object[]> inserts = new ArrayList<>();
        for (int i = 0; i < rows.values().size(); i++) {
            Map<String, String> data = new LinkedHashMap<>();
            rows.values().get(i).forEach((k, v) -> {
                if (v != null) {
                    data.put(k, v);
                }
            });
            inserts.add(new Object[] {batchId, kind.name(), rows.excelRows().get(i), mapper.writeValueAsString(data)});
        }
        jdbc.batchUpdate("INSERT INTO data_import_rows (batch_id, sheet, row_no, data) VALUES (?, ?, ?, ?::jsonb)", inserts);
        revalidate(batchId, kind);
        return batchId;
    }

    /** Đổi tuỳ chọn "ngừng mục không có trong tệp" của lô nháp rồi kiểm tra lại. */
    @Transactional
    public void setDeactivate(long id, Kind kind, boolean deactivateMissing) {
        require(kind);
        jdbc.update("UPDATE data_import_batches SET options = options || ?::jsonb, updated_at = now() WHERE id = ?",
                mapper.writeValueAsString(Map.of("deactivateMissing", deactivateMissing)), id);
        revalidate(id, kind);
    }

    /** Kiểm lại cả lô, lưu kết quả từng dòng và kết quả cả lô ({@code preview}). */
    @Transactional
    public void revalidate(long id, Kind kind) {
        require(kind);
        record Staged(long id, int row, Map<String, String> data, boolean skipped) {
        }
        List<Staged> staged = jdbc.query("SELECT id, row_no, data::text AS data, skipped FROM data_import_rows"
                + " WHERE batch_id = ? ORDER BY row_no, id", (rs, i) -> new Staged(rs.getLong("id"), rs.getInt("row_no"),
                mapper.readValue(rs.getString("data"), DATA), rs.getBoolean("skipped")), id);
        List<Input> inputs = staged.stream().filter(s -> !s.skipped()).map(s -> new Input(s.id(), s.row(), s.data())).toList();
        Checked checked = check(kind, inputs, deactivate(id));
        List<Object[]> updates = new ArrayList<>();
        for (Staged s : staged) {
            if (s.skipped()) {
                updates.add(new Object[] {"SKIPPED", "[]", "{}", s.id()});
                continue;
            }
            RowCheck c = checked.rows().get(s.id());
            List<Map<String, String>> messages = new ArrayList<>();
            c.errors().forEach(t -> messages.add(Map.of("level", "error", "field", "", "text", t)));
            c.warnings().forEach(t -> messages.add(Map.of("level", "warning", "field", "", "text", t)));
            updates.add(new Object[] {c.status(), mapper.writeValueAsString(messages),
                    mapper.writeValueAsString(Map.of("change", c.change())), s.id()});
        }
        jdbc.batchUpdate("UPDATE data_import_rows SET status = ?, messages = ?::jsonb, resolved = ?::jsonb WHERE id = ?",
                updates);
        SheetImport.Result r = checked.result();
        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("created", r.created());
        preview.put("updated", r.updated());
        preview.put("unchanged", r.unchanged());
        preview.put("outOfScope", r.outOfScope());
        preview.put("deactivated", r.deactivated());
        preview.put("deactivateMissing", deactivate(id));
        preview.put("batchErrors", checked.batchErrors());
        preview.put("deactivate", r.changes().stream().filter(c -> "DEACTIVATE".equals(c.kind()))
                .map(c -> item(c.code(), c.name(), null)).toList());
        preview.put("kept", r.changes().stream().filter(c -> "KEEP".equals(c.kind()))
                .map(c -> item(c.code(), c.name(), String.join(", ", c.fields()))).toList());
        jdbc.update("UPDATE data_import_batches SET preview = ?::jsonb WHERE id = ?", mapper.writeValueAsString(preview), id);
    }

    private static Map<String, Object> item(String code, String name, String note) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", code);
        m.put("name", name);
        if (note != null) {
            m.put("note", note);
        }
        return m;
    }

    /** Số lỗi của cả lô (không thuộc dòng nào), từ lần kiểm tra gần nhất. */
    public int batchErrors(Object preview) {
        if (preview == null) {
            return 0;
        }
        Map<String, Object> p = mapper.readValue(preview.toString(), MAP);
        Object list = p.get("batchErrors");
        return list instanceof List<?> l ? l.size() : 0;
    }

    public Map<String, Object> preview(Object raw) {
        return raw == null ? null : mapper.readValue(raw.toString(), MAP);
    }

    // ------------------------------------------------------------------ ghi, hoàn tác

    @Transactional
    public void commit(long id, Kind kind) {
        require(kind);
        revalidate(id, kind);
        long errors = jdbc.queryForObject("SELECT COUNT(*) FROM data_import_rows WHERE batch_id = ? AND status = 'ERROR'",
                Long.class, id);
        Object preview = jdbc.queryForObject("SELECT preview::text FROM data_import_batches WHERE id = ?", String.class, id);
        errors += batchErrors(preview);
        if (errors > 0) {
            throw new FieldValidationException("file", "Còn " + errors + " lỗi — sửa hết rồi ghi; chưa dòng nào được ghi");
        }
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", "import:" + kind.resource);
        List<Input> inputs = jdbc.query("SELECT id, row_no, data::text AS data FROM data_import_rows"
                + " WHERE batch_id = ? AND NOT skipped ORDER BY row_no, id", (rs, i) -> new Input(rs.getLong("id"),
                rs.getInt("row_no"), mapper.readValue(rs.getString("data"), DATA)), id);
        Applied applied = kind == Kind.SCHOOLS ? schools.apply(inputs, deactivate(id)) : wards.apply(inputs, deactivate(id));
        entityManager.flush();
        jdbc.batchUpdate("INSERT INTO data_import_records (batch_id, resource, record_id) VALUES (?, ?, ?)",
                applied.created().stream().map(rid -> new Object[] {id, kind.resource, rid}).toList());
        jdbc.batchUpdate("INSERT INTO data_import_snapshots (batch_id, resource, record_id, action, before) VALUES (?, ?, ?, ?, ?::jsonb)",
                applied.snapshots().stream().map(s -> new Object[] {id, kind.resource, s.recordId(), s.action(),
                        mapper.writeValueAsString(s.before())}).toList());
        jdbc.update("""
                UPDATE data_import_batches SET status = ?, committed_at = now(), committed_by_id = ?, updated_at = now()
                WHERE id = ?
                """, OnboardingService.COMMITTED, CurrentUser.id().orElse(null), id);
    }

    @Transactional
    public void rollback(long id, Kind kind) {
        require(kind);
        Map<String, Object> batch = jdbc.queryForMap("SELECT status, committed_at FROM data_import_batches WHERE id = ?", id);
        if (!OnboardingService.COMMITTED.equals(batch.get("status"))) {
            throw new ConflictException("Lô này chưa ghi vào hệ thống");
        }
        Instant committedAt = instant(batch.get("committed_at"));
        if (committedAt == null || committedAt.isBefore(Instant.now().minusSeconds(OnboardingService.UNDO_HOURS * 3600L))) {
            throw new ConflictException("Quá " + OnboardingService.UNDO_HOURS + " giờ sau khi ghi — sửa từng bản ghi thay vì hoàn tác");
        }
        List<Long> created = jdbc.queryForList("SELECT record_id FROM data_import_records WHERE batch_id = ? ORDER BY id",
                Long.class, id);
        List<Snapshot> snapshots = jdbc.query("SELECT record_id, action, before::text AS before FROM data_import_snapshots"
                + " WHERE batch_id = ? ORDER BY id", (rs, i) -> new Snapshot(rs.getLong("record_id"), rs.getString("action"),
                mapper.readValue(rs.getString("before"), MAP)), id);
        if (kind == Kind.SCHOOLS) {
            schools.undo(created, snapshots, committedAt);
        } else {
            wards.undo(created, snapshots, committedAt);
        }
        // Đẩy thay đổi của JPA (xoá, trả giá trị cũ) xuống trước khi kiểm tra lại bằng SQL — không thì lần kiểm tra
        // vẫn thấy bản ghi vừa xoá.
        entityManager.flush();
        jdbc.update("DELETE FROM data_import_records WHERE batch_id = ?", id);
        jdbc.update("DELETE FROM data_import_snapshots WHERE batch_id = ?", id);
        jdbc.update("""
                UPDATE data_import_batches SET status = ?, committed_at = NULL, committed_by_id = NULL, updated_at = now()
                WHERE id = ?
                """, OnboardingService.DRAFT, id);
        revalidate(id, kind);
    }

    // ------------------------------------------------------------------ xuất

    /** Dữ liệu của lô ra Excel, cùng khuôn tệp mẫu; {@code withResult}: thêm cột kết quả kiểm tra. */
    public byte[] export(long id, Kind kind, boolean withResult) {
        List<XlsxWriter.Column> columns = new ArrayList<>(kind.columns.stream()
                .map(c -> new XlsxWriter.Column(c.key(), c.label() + (c.required() ? " (*)" : ""), "text")).toList());
        if (withResult) {
            columns.add(new XlsxWriter.Column("_row", "Dòng", "text"));
            columns.add(new XlsxWriter.Column("_change", "Việc", "text"));
            columns.add(new XlsxWriter.Column("_messages", "Lỗi / lưu ý", "text"));
        }
        List<Map<String, Object>> rows = jdbc.query("SELECT row_no, data::text AS data, skipped, messages::text AS messages,"
                + " resolved->>'change' AS change FROM data_import_rows WHERE batch_id = ? ORDER BY row_no, id", (rs, i) -> {
            Map<String, Object> m = new HashMap<>(mapper.readValue(rs.getString("data"), DATA));
            if (withResult) {
                m.put("_row", rs.getInt("row_no"));
                m.put("_change", rs.getBoolean("skipped") ? "Bỏ" : rs.getString("change"));
                List<Map<String, Object>> msgs = mapper.readValue(rs.getString("messages"), new TypeReference<>() {
                });
                m.put("_messages", String.join("; ", msgs.stream().map(x -> String.valueOf(x.get("text"))).toList()));
            }
            return m;
        }, id);
        return XlsxWriter.write(new XlsxWriter.Sheet(kind.title, withResult ? "Kết quả kiểm tra lô " + id : "", columns, rows));
    }

    // ------------------------------------------------------------------ nội bộ

    private Checked check(Kind kind, List<Input> inputs, boolean deactivate) {
        return kind == Kind.SCHOOLS ? schools.check(inputs, deactivate) : wards.check(inputs, deactivate);
    }

    private boolean deactivate(long id) {
        Boolean value = jdbc.queryForObject("SELECT COALESCE((options->>'deactivateMissing')::boolean, FALSE)"
                + " FROM data_import_batches WHERE id = ?", Boolean.class, id);
        return Boolean.TRUE.equals(value);
    }

    private static Instant instant(Object value) {
        if (value instanceof Timestamp t) {
            return t.toInstant();
        }
        if (value instanceof OffsetDateTime t) {
            return t.toInstant();
        }
        return null;
    }

    /** Loại của lô theo cột {@code kind}; {@code null} là lô dữ liệu đầu vào của một trường. */
    public static Kind kindOf(Object kind) {
        if (kind == null || "SCHOOL_DATA".equals(kind)) {
            return null;
        }
        Kind k = Kind.of(kind.toString());
        if (k == null) {
            throw new ResourceNotFoundException("ImportKind", kind.toString());
        }
        return k;
    }
}
