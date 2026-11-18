package com.g123.sfems.module.organization.school.service;

import com.g123.sfems.domain.organization.DepartmentSource;
import com.g123.sfems.domain.organization.OrgStatus;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.module.catalog.coderule.CodeGenerator;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.catalog.ward.WardService;
import com.g123.sfems.module.organization.departmentofeducation.service.DepartmentOfEducationService;
import com.g123.sfems.module.organization.school.repo.SchoolRepository;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.office.SheetImport;
import com.g123.sfems.shared.office.SheetImport.Applied;
import com.g123.sfems.shared.office.SheetImport.Change;
import com.g123.sfems.shared.office.SheetImport.Checked;
import com.g123.sfems.shared.office.SheetImport.Column;
import com.g123.sfems.shared.office.SheetImport.Input;
import com.g123.sfems.shared.office.SheetImport.Issue;
import com.g123.sfems.shared.office.SheetImport.Result;
import com.g123.sfems.shared.office.SheetImport.RowCheck;
import com.g123.sfems.shared.office.SheetImport.Snapshot;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.validation.FieldRule;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cập nhật DANH SÁCH TRƯỜNG từ tệp Excel của Sở — chạy qua lô nhập (vùng chờ) ở màn Nhập dữ liệu.
 *
 * <p><b>Phạm vi:</b> trường công lập Tiểu học, THCS, THPT. Dòng tư thục, ngoài công lập, GDTX, mầm non đếm là
 * "ngoài phạm vi" và bỏ qua, không phải lỗi, nên tải nguyên tệp của Sở lên được.
 *
 * <p><b>Ghép trường:</b> theo mã Sở ({@code moet_code}). Trường cũ chưa có mã Sở thì ghi mã trường hiện có vào cột
 * "Mã trường hiện có" để gắn đúng trường, giữ id và mã hai ký tự, nên dữ liệu đã gắn và mã tài sản đã in không đổi.
 * Cột đó trống thì ghép THEO TÊN ({@link #nameKey}: bỏ dấu, chữ "Trường" / cụm chỉ cấp ở đầu) + cấp học, chỉ khi còn
 * khớp cơ quan quản lý hoặc phường/xã ({@link #narrow}) và tên không lặp trong tệp — khớp thì cập nhật / bỏ qua, không
 * khớp thì thêm mới, mơ hồ thì báo để ghi "Mã trường hiện có". Không còn ghi thêm bản trùng của trường đã có.
 * <b>Mã trường lấy theo mã Sở</b> (thêm mới và cập nhật) — mã tài sản dùng mã hai ký tự, không dùng mã trường. Không
 * ghép được thì là trường mới; mã hai ký tự để trống chờ chốt quy tắc.
 *
 * <p><b>Toàn vẹn với dữ liệu cũ:</b> trường đã có dữ liệu (tài khoản, cán bộ, cơ sở, phòng, lớp, tài sản) không đổi
 * cấp học qua tệp và không bị ngừng; một lần không ngừng quá {@link #MAX_DEACTIVATE_SHARE} số trường đang hoạt động.
 * Ghi giữ giá trị cũ ({@link Snapshot}) để hoàn tác.
 *
 * <p>Chỉ tài khoản thấy toàn bộ trường (Sở, quản trị) mới dùng được.
 */
@Service
@Transactional(readOnly = true)
public class SchoolImportService {

    public static final List<Column> COLUMNS = List.of(
            new Column("moet", "Mã Sở", true, "Mã trường do Sở cấp, duy nhất",
                    List.of("Mã Sở (moet_code)", "Mã định danh Bộ GD&ĐT", "moet_code")),
            new Column("name", "Tên trường", true, "Tên chuẩn hoá", List.of("Tên trường (chuẩn hoá)")),
            new Column("level", "Cấp học", true, "Tiểu học, THCS hoặc THPT; liên cấp ghi cấp cao nhất",
                    List.of("Cấp lưu (tạm)", "Cấp lưu", "Cấp")),
            new Column("type", "Loại hình", false, "Công lập; dòng khác bỏ qua", List.of()),
            new Column("kind", "Loại trường", false, "Trung tâm GDTX bỏ qua", List.of()),
            new Column("department", "Cơ quan quản lý", true, "Đúng tên trong danh mục, vd. UBND Phường Phú Lợi",
                    List.of()),
            new Column("ward", "Phường / xã", false, "Đúng tên trong danh mục", List.of("Phường/xã", "Phường xã")),
            new Column("address", "Địa chỉ", false, "", List.of()),
            new Column("existing", "Mã trường hiện có", false, "Chỉ khi trường đã có mà chưa có mã Sở",
                    List.of("Mã trường cũ")));

    public static final int MAX_ROWS = 5_000;

    /** Không ngừng quá tỷ lệ này số trường đang hoạt động trong một lần: tệp thiếu dòng thì dừng, không ngừng hàng loạt. */
    private static final double MAX_DEACTIVATE_SHARE = 0.3;

    /** Mã Sở: chữ số, chữ cái không dấu, gạch nối. */
    private static final Pattern MOET = Pattern.compile("^[0-9A-Za-z-]{4,20}$");

    private static final Set<String> SCHOOL_DATA_TABLES =
            Set.of("users", "staff", "campuses", "rooms", "school_classes", "equipment");

    private final SchoolRepository repository;
    private final RowLevelSecurity rowLevel;
    private final VisibleSchools visibleSchools;
    private final ManagedSchoolsCache managedSchools;
    private final DepartmentOfEducationService departments;
    private final EducationLevelService educationLevels;
    private final WardService wards;
    private final CodeGenerator codes;
    private final JdbcTemplate jdbc;

    public SchoolImportService(SchoolRepository repository, RowLevelSecurity rowLevel, VisibleSchools visibleSchools,
            ManagedSchoolsCache managedSchools, DepartmentOfEducationService departments,
            EducationLevelService educationLevels, WardService wards,
            CodeGenerator codes, JdbcTemplate jdbc) {
        this.repository = repository;
        this.rowLevel = rowLevel;
        this.visibleSchools = visibleSchools;
        this.managedSchools = managedSchools;
        this.departments = departments;
        this.educationLevels = educationLevels;
        this.wards = wards;
        this.codes = codes;
        this.jdbc = jdbc;
    }

    /** Chỉ Sở và quản trị — người thấy toàn bộ trường. */
    public void requireCityWide() {
        if (visibleSchools.current() != null) {
            throw new AccessDeniedException("Chỉ Sở và quản trị cập nhật được danh sách trường");
        }
    }

    /** Giá trị chọn được trên lưới của lô: cấp học, cơ quan quản lý, phường/xã. */
    public Map<String, List<String>> choices() {
        Map<String, List<String>> out = new LinkedHashMap<>();
        out.put("level", jdbc.queryForList("SELECT name FROM education_levels WHERE active ORDER BY sort_order", String.class));
        out.put("department", jdbc.queryForList("SELECT name FROM departments_of_education ORDER BY name", String.class));
        out.put("ward", jdbc.queryForList("SELECT name FROM wards WHERE active ORDER BY name", String.class));
        out.put("type", List.of("Công lập"));
        return out;
    }

    public Checked check(List<Input> inputs, boolean deactivateMissing) {
        requireCityWide();
        return plan(inputs, deactivateMissing).checked();
    }

    /** Ghi cả lô. Còn lỗi thì không ghi gì. Trả bản ghi tạo mới và giá trị cũ của bản ghi đã sửa / ngừng. */
    @Transactional
    public Applied apply(List<Input> inputs, boolean deactivateMissing) {
        requireCityWide();
        Plan plan = plan(inputs, deactivateMissing);
        int errors = plan.errors.size() + plan.batchErrors.size();
        if (errors > 0) {
            throw new FieldValidationException("file", "Còn %d lỗi — sửa hết rồi ghi; chưa dòng nào được ghi".formatted(errors));
        }
        List<Long> created = new ArrayList<>();
        List<Snapshot> snapshots = new ArrayList<>();
        // Mã hai ký tự (TR của mã tài sản): trường chưa có thì cấp luôn, để trường nhập từ tệp Sở cấp được mã tài
        // sản ngay. Cấp một lần, hoàn tác lô KHÔNG thu lại (có thể đã in tem).
        Set<String> takenShortCodes = new HashSet<>(repository.findAllShortCodes());
        for (Row row : plan.rows) {
            School school = row.school;
            if (school != null && row.fields.isEmpty()) {
                continue;
            }
            if (school == null) {
                // Mã trường = mã Sở: người dùng tra trường bằng mã Sở cấp, không bằng mã nội bộ.
                String code = row.moet != null ? row.moet : codes.reserve("schools").orElseGet(this::fallbackCode);
                school = new School(departments.get(row.departmentId), code, row.name);
            } else {
                snapshots.add(new Snapshot(school.getId(), "UPDATE", before(school)));
                school.setName(row.name);
                school.setDepartmentOfEducation(departments.get(row.departmentId));
                if (row.moet != null) {
                    school.setCode(row.moet);
                }
            }
            school.setMoetCode(row.moet);
            if (school.getShortCode() == null || school.getShortCode().isBlank()) {
                school.setShortCode(SchoolShortCodes.next(takenShortCodes));
            }
            school.setEducationLevel(educationLevels.get(row.levelId));
            school.setWard(row.wardId == null ? null : wards.get(row.wardId));
            school.setWardText(row.wardId == null ? row.wardText : null);
            if (row.address != null) {
                school.setAddress(row.address);
            }
            school.setDepartmentSource(DepartmentSource.NGUON);
            school.setStatus(OrgStatus.ACTIVE);
            School saved = repository.persist(school);
            repository.flush();
            rowLevel.checkWritable(saved);
            if (row.school == null) {
                created.add(saved.getId());
            }
        }
        for (School school : plan.deactivate) {
            snapshots.add(new Snapshot(school.getId(), "DEACTIVATE", before(school)));
            school.setStatus(OrgStatus.INACTIVE);
            repository.persist(school);
            rowLevel.checkWritable(school);
        }
        repository.flush();
        managedSchools.invalidateAfterCommit();
        return new Applied(created, snapshots);
    }

    /**
     * Hoàn tác một lô đã ghi: trả trường đã sửa / ngừng về giá trị cũ, xoá trường lô tạo mới. Từ chối khi trường đã bị
     * sửa sau lúc ghi, hoặc trường mới đã có dữ liệu — gỡ lúc đó là xoá cả việc người khác đã làm.
     */
    @Transactional
    public void undo(List<Long> created, List<Snapshot> snapshots, Instant committedAt) {
        requireCityWide();
        Set<Long> withData = schoolsWithData();
        for (Long id : created) {
            if (withData.contains(id)) {
                throw new ConflictException("Trường lô đã thêm (id " + id + ") đã có dữ liệu — không hoàn tác được");
            }
        }
        List<Long> touched = new ArrayList<>(created);
        snapshots.forEach(s -> touched.add(s.recordId()));
        if (!touched.isEmpty()) {
            for (School s : repository.findAll(rowLevel.byIds(School.class, Action.WRITE, touched))) {
                if (s.getUpdatedAt() != null && committedAt != null
                        && s.getUpdatedAt().isAfter(committedAt.plusSeconds(60))) {
                    throw new ConflictException("Trường " + s.getCode() + " đã được sửa sau khi ghi lô — không hoàn tác được");
                }
            }
        }
        for (Snapshot snap : snapshots) {
            School school = repository.findOne(rowLevel.byId(School.class, Action.WRITE, snap.recordId())).orElse(null);
            if (school == null) {
                continue;
            }
            Map<String, Object> b = snap.before();
            school.setName((String) b.get("name"));
            if (b.get("code") != null) {
                school.setCode((String) b.get("code"));
            }
            school.setMoetCode((String) b.get("moetCode"));
            school.setEducationLevel(b.get("levelId") == null ? null : educationLevels.get(id(b.get("levelId"))));
            school.setDepartmentOfEducation(b.get("departmentId") == null ? null : departments.get(id(b.get("departmentId"))));
            school.setWard(b.get("wardId") == null ? null : wards.get(id(b.get("wardId"))));
            school.setWardText((String) b.get("wardText"));
            school.setAddress((String) b.get("address"));
            school.setDepartmentSource(b.get("departmentSource") == null ? null
                    : DepartmentSource.valueOf((String) b.get("departmentSource")));
            school.setStatus(OrgStatus.valueOf((String) b.get("status")));
            repository.persist(school);
        }
        for (Long id : created) {
            repository.findOne(rowLevel.byId(School.class, Action.WRITE, id)).ifPresent(repository::remove);
        }
        repository.flush();
        managedSchools.invalidateAfterCommit();
    }

    // ------------------------------------------------------------------ nội bộ

    private static Map<String, Object> before(School s) {
        Map<String, Object> b = new HashMap<>();
        b.put("name", s.getName());
        b.put("code", s.getCode());
        b.put("moetCode", s.getMoetCode());
        b.put("levelId", s.getEducationLevel() == null ? null : s.getEducationLevel().getId());
        b.put("departmentId", s.getDepartmentOfEducation() == null ? null : s.getDepartmentOfEducation().getId());
        b.put("wardId", s.getWard() == null ? null : s.getWard().getId());
        b.put("wardText", s.getWardText());
        b.put("address", s.getAddress());
        b.put("departmentSource", s.getDepartmentSource() == null ? null : s.getDepartmentSource().name());
        b.put("status", s.getStatus().name());
        return b;
    }

    private static long id(Object value) {
        return ((Number) value).longValue();
    }

    private static final class Row {
        int excelRow;
        String moet;
        String name;
        Long levelId;
        Long departmentId;
        Long wardId;
        String wardText;
        String address;
        School school;
        final List<String> fields = new ArrayList<>();
    }

    private static final class Plan {
        int total;
        int outOfScope;
        final List<Row> rows = new ArrayList<>();
        final List<Issue> errors = new ArrayList<>();
        final List<Issue> warnings = new ArrayList<>();
        final List<String> batchErrors = new ArrayList<>();
        final List<School> deactivate = new ArrayList<>();
        final List<School> kept = new ArrayList<>();
        final Map<Long, RowCheck> checks = new LinkedHashMap<>();

        Checked checked() {
            List<Change> changes = new ArrayList<>();
            int created = 0;
            int updated = 0;
            int unchanged = 0;
            for (Row r : rows) {
                if (r.school == null) {
                    created++;
                    changes.add(new Change("CREATE", r.excelRow, null, r.moet, r.name, List.of()));
                } else if (!r.fields.isEmpty()) {
                    updated++;
                    changes.add(new Change("UPDATE", r.excelRow, r.school.getCode(), r.moet, r.name, r.fields));
                } else {
                    unchanged++;
                }
            }
            deactivate.forEach(s -> changes.add(
                    new Change("DEACTIVATE", null, s.getCode(), s.getMoetCode(), s.getName(), List.of())));
            kept.forEach(s -> changes.add(
                    new Change("KEEP", null, s.getCode(), s.getMoetCode(), s.getName(), List.of("đã có dữ liệu"))));
            List<Issue> allErrors = new ArrayList<>(errors);
            batchErrors.forEach(e -> allErrors.add(new Issue(0, null, null, List.of(e))));
            Result result = new Result(total, outOfScope, created, updated, unchanged, deactivate.size(), allErrors,
                    warnings, changes, false);
            return new Checked(result, checks, batchErrors);
        }
    }

    private Plan plan(List<Input> inputs, boolean deactivateMissing) {
        if (inputs.size() > MAX_ROWS) {
            throw new FieldValidationException("file", "Lô có quá %,d dòng".formatted(MAX_ROWS));
        }
        Set<Long> withData = schoolsWithData();
        Map<String, Long> levels = levelLookup();
        SheetImport.NameIndex departmentIds = names("SELECT id, name FROM departments_of_education");
        SheetImport.NameIndex wardIds = names("SELECT id, name FROM wards");

        List<School> all = repository.findAll(rowLevel.scope(School.class, Action.READ));
        Map<String, School> byMoet = new HashMap<>();
        Map<String, School> byCode = new HashMap<>();
        Map<String, List<School>> byName = new HashMap<>();
        for (School s : all) {
            if (s.getMoetCode() != null) {
                byMoet.put(upper(s.getMoetCode()), s);
            } else if (s.getEducationLevel() != null) {
                byName.computeIfAbsent(nameKey(s.getName(), s.getEducationLevel().getId()), k -> new ArrayList<>()).add(s);
            }
            byCode.put(upper(s.getCode()), s);
        }

        // Tên + cấp xuất hiện mấy lần trong tệp: tên lặp (vd. hai "THPT Nguyễn Huệ") thì không ghép theo tên được —
        // hai dòng sẽ tranh một trường cũ.
        Map<String, Integer> fileNames = new HashMap<>();
        for (Input in : inputs) {
            Map<String, String> v = clean(in.values());
            Long level = levels.get(SheetImport.fold(v.get("level")));
            String key = level == null ? null : nameKey(v.get("name"), level);
            if (key != null) {
                fileNames.merge(key, 1, Integer::sum);
            }
        }

        Plan plan = new Plan();
        Map<String, Integer> seenMoet = new HashMap<>();
        Map<Long, Integer> seenSchool = new HashMap<>();
        for (Input in : inputs) {
            Map<String, String> v = clean(in.values());
            int excelRow = in.row();
            plan.total++;
            if (outOfScope(v)) {
                plan.outOfScope++;
                plan.checks.put(in.id(), new RowCheck("SKIPPED", List.of(),
                        List.of("Ngoài phạm vi (không phải trường công lập Tiểu học, THCS, THPT) — bỏ qua"), "Bỏ qua"));
                continue;
            }
            List<String> errors = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            Row row = new Row();
            row.excelRow = excelRow;
            row.moet = v.get("moet");
            row.name = v.get("name");
            row.address = v.get("address");
            if (row.moet == null) {
                errors.add("Thiếu mã Sở");
            } else if (!MOET.matcher(row.moet).matches()) {
                errors.add("Mã Sở \"" + row.moet + "\" sai định dạng (4–20 ký tự: chữ số, chữ cái không dấu, gạch nối)");
            } else {
                Integer first = seenMoet.putIfAbsent(upper(row.moet), excelRow);
                if (first != null) {
                    errors.add("Mã Sở trùng với dòng " + first);
                }
            }
            if (row.name == null) {
                errors.add("Thiếu tên trường");
            }
            SheetImport.check(errors, "Tên trường", row.name, FieldRule.NAME, 0);
            SheetImport.check(errors, "Địa chỉ", row.address, FieldRule.ADDRESS, 0);
            SheetImport.check(errors, "Phường/xã", v.get("ward"), FieldRule.SHORT_TEXT, 128);
            SheetImport.check(errors, "Mã trường hiện có", v.get("existing"), FieldRule.CODE, 0);
            row.levelId = levels.get(SheetImport.fold(v.get("level")));
            if (row.levelId == null) {
                errors.add(v.get("level") == null ? "Thiếu cấp học" : "Cấp học \"" + v.get("level") + "\" không đúng");
            }
            row.departmentId = departmentIds.get(v.get("department"));
            if (row.departmentId == null) {
                errors.add(v.get("department") == null ? "Thiếu cơ quan quản lý"
                        : "Cơ quan quản lý \"" + v.get("department") + "\" không có trong danh mục");
            }
            String ward = v.get("ward");
            row.wardId = wardIds.get(ward);
            if (ward != null && row.wardId == null) {
                row.wardText = ward;
                warnings.add("Phường/xã \"" + ward + "\" không có trong danh mục — lưu dạng chữ");
            }

            School school = row.moet == null ? null : byMoet.get(upper(row.moet));
            String existing = v.get("existing");
            if (school == null && existing != null) {
                School byExisting = byCode.get(upper(existing));
                if (byExisting == null) {
                    errors.add("Mã trường hiện có \"" + existing + "\" không có trong hệ thống");
                } else if (byExisting.getMoetCode() != null) {
                    errors.add("Trường \"" + existing + "\" đã gắn mã Sở " + byExisting.getMoetCode());
                } else {
                    school = byExisting;
                }
            }
            String matchedBy = null;
            if (school == null && existing == null && row.name != null && row.levelId != null
                    && fileNames.getOrDefault(nameKey(row.name, row.levelId), 0) == 1) {
                // Trường cũ chưa có mã Sở (946 trường của 050) và tệp không ghi "Mã trường hiện có": ghép theo tên
                // + cấp học, để tệp của Sở cập nhật trường đã có thay vì thêm một bản trùng.
                List<School> candidates = narrow(byName.getOrDefault(nameKey(row.name, row.levelId), List.of()), row);
                if (candidates.size() == 1) {
                    school = candidates.get(0);
                    matchedBy = "ghép theo tên với " + school.getCode();
                } else if (candidates.size() > 1) {
                    errors.add("Trùng tên với " + candidates.size() + " trường chưa có mã Sở ("
                            + String.join(", ", candidates.stream().map(School::getCode).toList())
                            + ") — ghi mã đúng vào cột \"Mã trường hiện có\"");
                }
            }
            if (school != null) {
                Integer first = seenSchool.putIfAbsent(school.getId(), excelRow);
                if (first != null) {
                    errors.add("Trường " + school.getCode() + " đã được ghép ở dòng " + first);
                }
            }
            row.school = school;
            // Mã trường sẽ là mã Sở: trường khác đang giữ đúng mã đó thì không ghi được (mã trường là duy nhất).
            School holder = row.moet == null ? null : byCode.get(upper(row.moet));
            if (holder != null && holder != school) {
                errors.add("Mã " + row.moet + " đang là mã trường của " + holder.getName() + " — đổi mã trường đó trước");
            }
            if (school != null && errors.isEmpty()) {
                diff(row, school);
                // Toàn vẹn với dữ liệu cũ: trường đã có lớp, phòng, tài sản, tài khoản thì không đổi cấp học qua tệp
                // (lớp và định mức theo cấp sẽ lệch); đổi cơ quan quản lý thì đổi phạm vi thấy của tài khoản UBND.
                if (withData.contains(school.getId()) && row.fields.contains("cấp học")) {
                    errors.add("Trường " + school.getCode() + " đã có dữ liệu — không đổi cấp học qua tệp, sửa tay ở màn Trường");
                }
                if (withData.contains(school.getId()) && row.fields.contains("cơ quan quản lý")) {
                    warnings.add("Đổi cơ quan quản lý của trường đã có dữ liệu: tài khoản UBND cũ không thấy trường này nữa");
                }
                if (school.getStatus() != OrgStatus.ACTIVE) {
                    warnings.add("Trường đang ngưng sẽ hoạt động lại");
                }
            }
            String change = school == null ? "Thêm mới"
                    : row.fields.isEmpty() ? "Không đổi" : "Cập nhật: " + String.join(", ", row.fields);
            if (matchedBy != null) {
                change += " (" + matchedBy + ")";
            }
            String status = !errors.isEmpty() ? "ERROR" : !warnings.isEmpty() ? "WARNING"
                    : school != null && row.fields.isEmpty() ? "EXISTS" : "OK";
            plan.checks.put(in.id(), new RowCheck(status, errors, warnings, change));
            if (!errors.isEmpty()) {
                plan.errors.add(new Issue(excelRow, row.moet, row.name, errors));
            } else {
                plan.rows.add(row);
            }
            if (!warnings.isEmpty()) {
                plan.warnings.add(new Issue(excelRow, row.moet, row.name, warnings));
            }
        }

        if (deactivateMissing) {
            Set<Long> inFile = new HashSet<>(seenSchool.keySet());
            for (Input in : inputs) {
                String moet = SheetImport.clean(in.values().get("moet"));
                School s = moet == null ? null : byMoet.get(upper(moet));
                if (s != null) {
                    inFile.add(s.getId());
                }
            }
            for (School s : all) {
                if (s.getStatus() != OrgStatus.ACTIVE || inFile.contains(s.getId())) {
                    continue;
                }
                (withData.contains(s.getId()) ? plan.kept : plan.deactivate).add(s);
            }
            long active = all.stream().filter(s -> s.getStatus() == OrgStatus.ACTIVE).count();
            if (plan.deactivate.size() > active * MAX_DEACTIVATE_SHARE) {
                plan.batchErrors.add(("Sẽ ngừng %d/%d trường đang hoạt động — quá %d%%; tệp có thể thiếu dòng. Kiểm tra"
                        + " lại tệp, hoặc bỏ chọn ngừng.").formatted(plan.deactivate.size(), active,
                        Math.round(MAX_DEACTIVATE_SHARE * 100)));
            }
        }
        return plan;
    }

    private static Map<String, String> clean(Map<String, String> values) {
        Map<String, String> out = new HashMap<>();
        values.forEach((k, v) -> out.put(k, SheetImport.clean(v)));
        return out;
    }

    /**
     * Cụm chữ đầu tên chỉ loại / cấp trường — bỏ khi so tên ("Trường Tiểu học X" ↔ "Tiểu Học X" ↔ "TH X";
     * "Tiểu học, THCS và THPT X" ↔ "X"). Bỏ theo CỤM, không theo chữ lẻ: "Tiểu học Số 1", "THCS Trường Sơn"
     * giữ nguyên phần tên.
     */
    private static final Pattern NAME_PREFIX = Pattern.compile(
            "^(trung hoc pho thong|trung hoc co so|tieu hoc|pho thong|lien cap|thpt|thcs|th|va)( |$)");

    /** Khoá so tên: bỏ dấu, dấu câu, chữ "Trường" đứng đầu rồi các cụm chỉ cấp ở đầu tên; kèm cấp học. */
    static String nameKey(String name, Long levelId) {
        String folded = SheetImport.fold(name);
        if (folded == null) {
            return null;
        }
        String key = folded.replaceAll("[^a-z0-9]+", " ").trim();
        if (key.startsWith("truong ")) {
            key = key.substring("truong ".length());
        }
        for (String rest; !(rest = NAME_PREFIX.matcher(key).replaceFirst("")).equals(key) && !rest.isBlank(); ) {
            key = rest;
        }
        return key + "|" + levelId;
    }

    /**
     * Trường cùng tên và cấp chỉ là MỘT trường khi còn khớp cơ quan quản lý hoặc phường/xã: TP.HCM mới gộp cả Bình
     * Dương, Bà Rịa – Vũng Tàu, nên "TH Kim Đồng" ở Bến Cát không phải "TH Kim Đồng" ở Quận 7. Không còn ai thì là
     * trường mới; còn nhiều thì ưu tiên trường cùng cơ quan, rồi cùng phường/xã.
     */
    private static List<School> narrow(List<School> candidates, Row row) {
        List<School> byDepartment = candidates.stream()
                .filter(s -> s.getDepartmentOfEducation() != null
                        && s.getDepartmentOfEducation().getId().equals(row.departmentId))
                .toList();
        List<School> byWard = row.wardId == null ? List.of() : candidates.stream()
                .filter(s -> s.getWard() != null && s.getWard().getId().equals(row.wardId))
                .toList();
        if (byDepartment.size() == 1) {
            return byDepartment;
        }
        if (byDepartment.size() > 1) {
            List<School> both = byDepartment.stream().filter(byWard::contains).toList();
            return both.size() == 1 ? both : byDepartment;
        }
        return byWard;
    }

    /** Trường công lập TH, THCS, THPT; dòng khác đếm là ngoài phạm vi. */
    private static boolean outOfScope(Map<String, String> v) {
        String type = SheetImport.fold(v.get("type"));
        if (type != null && !type.equals("cong lap")) {
            return true;
        }
        String text = String.join(" ", Objects.toString(SheetImport.fold(v.get("kind")), ""),
                Objects.toString(SheetImport.fold(v.get("name")), ""),
                Objects.toString(SheetImport.fold(v.get("level")), ""));
        return text.contains("thuong xuyen") || text.contains("gdtx") || text.contains("mam non")
                || text.contains("mau giao") || text.contains("nha tre");
    }

    private static void diff(Row row, School s) {
        if (!SheetImport.same(row.name, s.getName())) {
            row.fields.add("tên");
        }
        if (s.getMoetCode() == null) {
            row.fields.add("mã Sở");
        }
        if (row.moet != null && !row.moet.equals(s.getCode())) {
            row.fields.add("mã trường");
        }
        if (s.getEducationLevel() == null || !s.getEducationLevel().getId().equals(row.levelId)) {
            row.fields.add("cấp học");
        }
        if (s.getDepartmentOfEducation() == null || !s.getDepartmentOfEducation().getId().equals(row.departmentId)) {
            row.fields.add("cơ quan quản lý");
        }
        Long wardId = s.getWard() == null ? null : s.getWard().getId();
        if (!Objects.equals(wardId, row.wardId)) {
            row.fields.add("phường/xã");
        }
        if (row.address != null && !SheetImport.same(row.address, s.getAddress())) {
            row.fields.add("địa chỉ");
        }
        if (s.getStatus() != OrgStatus.ACTIVE) {
            row.fields.add("hoạt động lại");
        }
    }

    /** Cấp học theo mã (TH, THCS, THPT) hoặc tên (Tiểu học…), không phân biệt dấu. */
    private Map<String, Long> levelLookup() {
        Map<String, Long> map = new HashMap<>();
        jdbc.query("SELECT id, code, name, short_name FROM education_levels WHERE active", rs -> {
            long id = rs.getLong("id");
            for (String col : List.of("code", "name", "short_name")) {
                String value = SheetImport.fold(rs.getString(col));
                if (value != null) {
                    map.put(value, id);
                }
            }
        });
        return map;
    }

    /** Cột 1 là id, cột 2 là tên. */
    private SheetImport.NameIndex names(String sql) {
        SheetImport.NameIndex index = new SheetImport.NameIndex();
        jdbc.query(sql, rs -> {
            index.put(rs.getString(2), rs.getLong(1));
        });
        return index;
    }

    private Set<Long> schoolsWithData() {
        Set<Long> ids = new HashSet<>();
        for (String table : SCHOOL_DATA_TABLES) {
            ids.addAll(jdbc.queryForList("SELECT DISTINCT school_id FROM " + table + " WHERE school_id IS NOT NULL",
                    Long.class));
        }
        return ids;
    }

    private String fallbackCode() {
        int n = 1;
        while (repository.findByCodeIgnoreCase(String.format("TR%04d", n)).isPresent()) {
            n++;
        }
        return String.format("TR%04d", n);
    }

    private static String upper(String value) {
        return value.trim().toUpperCase(Locale.ROOT);
    }
}
