package com.g123.sfems.module.school.student;

import com.g123.sfems.domain.school.schoolclass.SchoolClass;
import com.g123.sfems.domain.school.student.Student;
import com.g123.sfems.domain.school.student.StudentGender;
import com.g123.sfems.module.catalog.base.CampusRule;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.base.SchoolOwnedService;
import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.module.school.schoolclass.SchoolClassService;
import com.g123.sfems.module.school.yearprofile.SchoolYearLock;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.criteria.JoinType;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Học sinh của trường (304). Quy tắc riêng: lớp phải cùng trường; mã học sinh chỉ duy nhất trong một lớp; và SĨ SỐ
 * của lớp đi theo danh sách — mỗi lần thêm, sửa (chuyển lớp, đổi cờ hoạt động), xoá, sĩ số các lớp chạm tới được đếm
 * lại bằng số học sinh đang hoạt động ({@link #recount}).
 *
 * <p>Lớp CHƯA có học sinh nào giữ sĩ số nhập tay như cũ: trường không khai danh sách học sinh vẫn tính chuẩn tối thiểu
 * theo học sinh như trước. Lớp vừa mất học sinh cuối cùng (xoá, chuyển đi) thì sĩ số về 0 — đúng với danh sách, và
 * ô Sĩ số của lớp lại sửa tay được.
 */
@Service
public class StudentService extends SchoolOwnedService<Student, StudentRequest, StudentPatchRequest> {

    private final StudentRepository students;
    private final SchoolClassService classes;
    private final JdbcTemplate jdbc;

    public StudentService(
            StudentRepository repository,
            RowLevelSecurity rowLevel,
            SchoolService schools,
            RowLevelPrincipalResolver principals,
            SchoolClassService classes,
            JdbcTemplate jdbc) {
        super(repository, rowLevel, Student.class, Student::new, "Học sinh", schools, principals);
        this.students = repository;
        this.classes = classes;
        this.jdbc = jdbc;
    }

    /**
     * Thêm cột sắp theo LỚP (thứ tự lớp, mã lớp): danh sách học sinh phân trang theo lớp thì học sinh một lớp nằm liền
     * nhau, dòng tiêu đề lớp không bị rải ra nhiều trang.
     */
    private static final Set<String> SORTABLE = Set.of("id", "code", "name", "sortOrder", "active", "createdAt",
            "updatedAt", "schoolClass.sortOrder", "schoolClass.code");

    @Override
    protected Set<String> sortable() {
        return SORTABLE;
    }

    @Override
    @Transactional
    public Student create(StudentRequest request) {
        Student saved = createUncounted(request);
        recount(List.of(saved.getSchoolClass().getId()), true);
        return saved;
    }

    /**
     * Như {@link #create} nhưng KHÔNG đếm lại sĩ số — cho lượt ghi lô nhập: thêm vài trăm học sinh rồi đếm lại các
     * lớp một lần ({@link #recount}). Bên gọi phải tự đếm lại trong cùng giao dịch.
     */
    @Transactional
    public Student createUncounted(StudentRequest request) {
        return super.create(request);
    }

    @Override
    @Transactional
    public Student update(Long id, StudentPatchRequest request) {
        // Lớp TRƯỚC khi sửa — chuyển lớp thì lớp vừa rời đi cũng đếm lại. Không thấy dòng thì lớp cha báo 404.
        Set<Long> touched = new LinkedHashSet<>(
                jdbc.queryForList("SELECT class_id FROM students WHERE id = ?", Long.class, id));
        Student saved = super.update(id, request);
        touched.add(saved.getSchoolClass().getId());
        entityManager().flush();
        recount(touched, true);
        return saved;
    }

    @Override
    @Transactional
    public Student delete(Long id) {
        Student removed = super.delete(id);
        entityManager().flush();
        recount(List.of(removed.getSchoolClass().getId()), true);
        return removed;
    }

    @Override
    protected void applyCreateOwned(Student item, StudentRequest request) {
        setClass(item, request.schoolClass().id());
        item.setBirthDate(request.birthDate());
        item.setGender(request.gender());
        touchYear(item);
    }

    @Override
    protected void applyUpdateOwned(Student item, StudentPatchRequest request) {
        touchYear(item);
        if (request.schoolClass() != null && request.schoolClass().id() != null
                && !request.schoolClass().id().equals(item.getSchoolClass().getId())) {
            // Lớp cha chỉ kiểm trùng mã trong lớp CŨ. Kiểm lớp mới TRƯỚC khi gán: truy vấn kiểm trùng làm Hibernate
            // đẩy bản ghi đang sửa xuống DB, và mã trùng sẽ vấp unique index trước khi kịp báo 409 có nghĩa.
            students.findFirstBySchoolClassIdAndCodeIgnoreCase(request.schoolClass().id(), item.getCode())
                    .filter(other -> !other.getId().equals(item.getId()))
                    .ifPresent(other -> {
                        throw new ConflictException(codeTakenMessage(item.getCode()));
                    });
            setClass(item, request.schoolClass().id());
            touchYear(item);
        }
        item.setBirthDate(request.birthDate());
        item.setGender(request.gender());
    }

    @Override
    protected void beforeDelete(Student item) {
        super.beforeDelete(item);
        touchYear(item);
    }

    /** Lớp trong phạm vi đọc của người gọi (404 nếu không), cùng trường với học sinh. */
    private void setClass(Student item, Long classId) {
        SchoolClass schoolClass = classes.get(classId);
        if (!schoolClass.getSchool().getId().equals(item.getSchool().getId())) {
            throw new FieldValidationException("class", "Lớp phải thuộc cùng trường với học sinh");
        }
        item.setSchoolClass(schoolClass);
    }

    /**
     * Đếm lại sĩ số các lớp {@code classIds}: lớp có học sinh thì sĩ số = số học sinh đang hoạt động. Lớp không còn
     * học sinh nào: {@code emptyToZero} thì về 0 (vừa xoá / chuyển học sinh cuối cùng đi), không thì giữ nguyên sĩ số
     * đang có (hoàn tác lô nhập: lớp trở lại như trước khi có danh sách). Bên gọi đẩy thay đổi xuống DB trước.
     */
    @Transactional
    public void recount(Collection<Long> classIds, boolean emptyToZero) {
        List<Long> ids = classIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return;
        }
        jdbc.update("""
                UPDATE school_classes k
                SET student_count = (SELECT count(*) FROM students s WHERE s.class_id = k.id AND s.active),
                    updated_at = now()
                WHERE k.id = ANY (?)
                  AND (? OR EXISTS (SELECT 1 FROM students s WHERE s.class_id = k.id))
                  AND k.student_count IS DISTINCT FROM
                      (SELECT count(*) FROM students s WHERE s.class_id = k.id AND s.active)
                """, ids.toArray(Long[]::new), emptyToZero);
        // Lớp đang nằm trong phiên (vừa nạp để gán cho học sinh) mang sĩ số cũ: đọc lại, kẻo lần ghi sau của phiên đè
        // mất số vừa đếm.
        for (Long id : ids) {
            SchoolClass managed = entityManager().find(SchoolClass.class, id);
            if (managed != null) {
                entityManager().refresh(managed);
            }
        }
    }

    /** Học sinh là dữ liệu của năm học (qua lớp): hồ sơ năm học đã xác nhận ghi lần sửa cuối, như lớp. */
    private void touchYear(Student item) {
        SchoolClass c = item.getSchoolClass();
        if (yearLock == null || c == null || c.getSchoolYear() == null) {
            return;
        }
        Long school = item.getSchool().getId();
        yearLock.touched(school, c.getSchoolYear().getId(),
                yearLock.campusOfRoom(c.getRoom() == null ? null : c.getRoom().getId(), school));
    }

    private SchoolYearLock yearLock;

    @Autowired
    void setYearLock(SchoolYearLock yearLock) {
        this.yearLock = yearLock;
    }

    /** Ô tìm dò mã học sinh và họ tên. */
    @Override
    protected List<String> searchFields() {
        return List.of("code", "name");
    }

    /**
     * Lọc thêm: {@code class.id} (cũng nhận {@code schoolClass.id}), {@code schoolYear.id} và {@code grade.id} của
     * lớp, {@code gender}.
     */
    @Override
    protected Specification<Student> ownedFilters(ListParams params) {
        List<Specification<Student>> specs = new ArrayList<>();
        specs.add(CatalogSpecifications.referenceFilter(params, "schoolClass"));
        for (ListParams.Criterion criterion : params.filters()) {
            String field = criterion.field();
            String value = criterion.value() == null ? "" : criterion.value().trim();
            switch (field) {
                case "class.id", "classId" -> specs.add(classPath("id", value));
                case "schoolYear.id", "schoolYearId" -> specs.add(classPath("schoolYear", value));
                case "grade.id", "gradeId" -> specs.add(classPath("grade", value));
                case "gender" -> specs.add(genderIs(value));
                default -> {
                }
            }
        }
        return Specification.allOf(specs);
    }

    /** {@code schoolClass.<attr>.id = value} ({@code attr = "id"}: chính lớp). Giá trị không phải số = không dòng nào. */
    private static Specification<Student> classPath(String attr, String value) {
        Long id;
        try {
            id = Long.parseLong(value);
        } catch (NumberFormatException e) {
            return (root, query, cb) -> cb.disjunction();
        }
        return (root, query, cb) -> {
            var join = root.join("schoolClass", JoinType.INNER);
            return cb.equal("id".equals(attr) ? join.get("id") : join.get(attr).get("id"), id);
        };
    }

    private static Specification<Student> genderIs(String value) {
        if ("none".equalsIgnoreCase(value)) {
            return (root, query, cb) -> cb.isNull(root.get("gender"));
        }
        for (StudentGender g : StudentGender.values()) {
            if (g.name().equalsIgnoreCase(value)) {
                return (root, query, cb) -> cb.equal(root.get("gender"), g);
            }
        }
        return (root, query, cb) -> cb.disjunction();
    }

    /** Mã học sinh trùng trong CÙNG lớp — câu mặc định của lớp nền xét cả trường. */
    @Override
    protected Optional<Student> findSameCode(Student item, String code) {
        if (item.getSchoolClass() == null) {
            return Optional.empty();
        }
        return students.findFirstBySchoolClassIdAndCodeIgnoreCase(item.getSchoolClass().getId(), code);
    }

    @Override
    protected String codeTakenMessage(String code) {
        return "Lớp đã có học sinh mã %s".formatted(code);
    }

    private CampusScope campusScope;

    /** Tiêm qua setter — phạm vi cơ sở (270): học sinh theo phòng học của lớp, như chính lớp. */
    @Autowired
    void setCampusScope(CampusScope campusScope) {
        this.campusScope = campusScope;
    }

    @Override
    protected CampusRule<Student> campusRule() {
        return campusScope.byRoomAt("class", "schoolClass.room",
                s -> s.getSchoolClass() == null ? null : s.getSchoolClass().getRoom(), Student::getSchool);
    }
}
