package com.g123.sfems.module.report;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.ActorNames;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Lưu trữ báo cáo: chụp lại một báo cáo đúng lúc lập để nộp, đối chiếu, in lại về sau — số liệu sống thì
 * hôm nay khác tháng trước. Bản lưu không sửa được; chỉ người lập hoặc quản trị viên xoá.
 *
 * <p>Ai xem được đi theo NƠI LẬP, cùng cách nhìn với {@link VisibleSchools}: cấp Sở (và quản trị viên) thấy mọi bản;
 * cơ quan quản lý thấy bản của chính mình và của các trường mình quản lý; trường thấy bản của trường mình.
 */
@Service
public class ReportSnapshotService {

    private static final String LIST = "SELECT id, report_name AS \"reportName\", title, subtitle, row_count AS \"rowCount\","
            + " note, level, created_by_name AS \"createdByName\", created_by_id AS \"createdById\", created_at AS \"createdAt\""
            + " FROM report_snapshots r";

    private final JdbcTemplate jdbc;
    private final ReportService reports;
    private final VisibleSchools visible;
    private final RowLevelPrincipalResolver principals;
    private final ActorNames actors;
    private final ObjectMapper json;

    public ReportSnapshotService(JdbcTemplate jdbc, ReportService reports, VisibleSchools visible,
            RowLevelPrincipalResolver principals, ActorNames actors, ObjectMapper json) {
        this.jdbc = jdbc;
        this.reports = reports;
        this.visible = visible;
        this.principals = principals;
        this.actors = actors;
        this.json = json;
    }

    /** Tính báo cáo với đúng bộ lọc đang xem rồi lưu lại; trả bản vừa lưu (không kèm các dòng). */
    @Transactional
    public Map<String, Object> save(String name, ReportService.Params params, String note) {
        ReportService.Report report = reports.build(name, params);
        RowLevelPrincipal me = principals.current().orElseThrow(() -> new AccessDeniedException("Chưa đăng nhập"));
        String level = visible.level();
        if ("NONE".equals(level)) {
            throw new AccessDeniedException("Tài khoản không thuộc cơ quan hay trường nào");
        }
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("from", params.from());
        p.put("to", params.to());
        p.put("year", params.year());
        p.put("bodyId", params.bodyId());
        p.put("levelId", params.levelId());
        p.put("schoolId", params.schoolId());
        p.put("group", params.group());
        p.put("choice", params.choice());
        p.put("typeId", params.typeId());
        p.put("status", params.status());
        p.put("condition", params.condition());
        String trimmed = note == null || note.isBlank() ? null : note.trim();
        if (trimmed != null && trimmed.length() > 500) {
            throw new FieldValidationException("note", "Ghi chú tối đa 500 ký tự");
        }
        KeyHolder key = new GeneratedKeyHolder();
        Long actorId = CurrentUser.id().orElse(null);
        String paramsJson = write(p);
        String columnsJson = write(report.columns());
        String rowsJson = write(report.rows());
        jdbc.update(c -> {
            var ps = c.prepareStatement("INSERT INTO report_snapshots (report_name, title, subtitle, params, columns, rows,"
                    + " row_count, note, level, school_id, body_id, created_by_id, created_by_name)"
                    + " VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?, ?, ?)", new String[] {"id"});
            ps.setString(1, name);
            ps.setString(2, cut(report.title(), 300));
            ps.setString(3, cut(report.subtitle(), 500));
            ps.setString(4, paramsJson);
            ps.setString(5, columnsJson);
            ps.setString(6, rowsJson);
            ps.setInt(7, report.rows().size());
            ps.setString(8, trimmed);
            ps.setString(9, level);
            ps.setObject(10, "SCHOOL".equals(level) ? me.schoolId() : null);
            ps.setObject(11, "SCHOOL".equals(level) ? null : me.managingBodyId());
            ps.setObject(12, actorId);
            ps.setString(13, cut(actorId == null ? null : actors.current(), 150));
            return ps;
        }, key);
        return jdbc.queryForMap(LIST + " WHERE r.id = ?", key.getKey().longValue());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(String reportName, String q, int start, int end) {
        Filter f = filter(reportName, q);
        List<Object> args = new ArrayList<>(f.args());
        args.add(Math.max(end - start, 1));
        args.add(Math.max(start, 0));
        return jdbc.queryForList(LIST + " WHERE " + f.sql() + " ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?",
                args.toArray());
    }

    @Transactional(readOnly = true)
    public long count(String reportName, String q) {
        Filter f = filter(reportName, q);
        return jdbc.queryForObject("SELECT COUNT(*) FROM report_snapshots r WHERE " + f.sql(), Long.class,
                f.args().toArray());
    }

    /** Một bản đã lưu, đủ cột và các dòng — chỉ khi người xem được phép thấy nó (không thì 404 như chưa từng có). */
    @Transactional(readOnly = true)
    public Map<String, Object> get(long id) {
        Filter f = filter(null, null);
        List<Object> args = new ArrayList<>(f.args());
        args.add(id);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT r.id, r.report_name AS \"reportName\", r.title,"
                + " r.subtitle, r.params::text AS params, r.columns::text AS columns, r.rows::text AS rows,"
                + " r.row_count AS \"rowCount\", r.note, r.level, r.created_by_name AS \"createdByName\","
                + " r.created_by_id AS \"createdById\", r.created_at AS \"createdAt\" FROM report_snapshots r WHERE "
                + f.sql() + " AND r.id = ?", args.toArray());
        if (rows.isEmpty()) {
            throw new ResourceNotFoundException("ReportSnapshot", id);
        }
        Map<String, Object> row = new LinkedHashMap<>(rows.getFirst());
        row.put("params", read((String) row.get("params"), new TypeReference<Map<String, Object>>() { }));
        row.put("columns", read((String) row.get("columns"), new TypeReference<List<Map<String, Object>>>() { }));
        row.put("rows", read((String) row.get("rows"), new TypeReference<List<Map<String, Object>>>() { }));
        return row;
    }

    /** Xoá một bản lưu: chỉ người lập hoặc quản trị viên. */
    @Transactional
    public Map<String, Object> delete(long id) {
        Map<String, Object> row = get(id);
        boolean admin = principals.current().map(p -> p.roleCodes().contains("ADMIN")).orElse(false);
        if (!admin && !Objects.equals(((Number) row.getOrDefault("createdById", -1L)).longValue(),
                CurrentUser.id().orElse(null))) {
            throw new AccessDeniedException("Chỉ người lập hoặc quản trị viên xoá được bản lưu");
        }
        jdbc.update("DELETE FROM report_snapshots WHERE id = ?", id);
        row.remove("rows");
        return row;
    }

    // ------------------------------------------------------------------ phạm vi

    private record Filter(String sql, List<Object> args) {
    }

    private Filter filter(String reportName, String q) {
        List<String> parts = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        parts.add(scope());
        if (reportName != null && !reportName.isBlank()) {
            parts.add("r.report_name = ?");
            args.add(reportName);
        }
        if (q != null && !q.isBlank()) {
            parts.add("(lower(r.title) LIKE ? OR lower(coalesce(r.note, '')) LIKE ? OR lower(coalesce(r.created_by_name, '')) LIKE ?)");
            String like = "%" + q.trim().toLowerCase() + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }
        return new Filter(String.join(" AND ", parts), args);
    }

    /** Điều kiện "người xem thấy bản này" — chỉ ghép id số, không ghép chữ người dùng gõ. */
    private String scope() {
        RowLevelPrincipal me = principals.current().orElse(null);
        if (me == null) {
            return "FALSE";
        }
        Set<Long> schools = visible.current();
        if (schools == null) {
            return "TRUE";
        }
        if (me.managingBodyId() != null) {
            String own = "r.body_id = " + me.managingBodyId().longValue();
            return schools.isEmpty() ? "(" + own + ")" : "(" + own + " OR r.school_id IN ("
                    + schools.stream().map(String::valueOf).collect(Collectors.joining(",")) + "))";
        }
        return me.schoolId() == null ? "FALSE" : "(r.level = 'SCHOOL' AND r.school_id = " + me.schoolId().longValue() + ")";
    }

    private String write(Object value) {
        return json.writeValueAsString(value);
    }

    private <T> T read(String value, TypeReference<T> type) {
        return json.readValue(value, type);
    }

    private static String cut(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
