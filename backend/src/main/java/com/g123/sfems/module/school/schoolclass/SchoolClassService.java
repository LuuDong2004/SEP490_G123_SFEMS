package com.g123.sfems.module.school.schoolclass;

import com.g123.sfems.module.catalog.base.CampusRule;
import org.springframework.beans.factory.annotation.Autowired;
import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.domain.school.schoolclass.SchoolClass;
import com.g123.sfems.domain.school.staff.StaffType;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.grade.GradeService;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearService;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.base.SchoolOwnedService;
import com.g123.sfems.module.school.facility.RoomService;
import com.g123.sfems.module.school.staff.StaffService;
import com.g123.sfems.module.school.yearprofile.SchoolYearLock;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lớp học. Quy tắc riêng: giáo viên chủ nhiệm và phòng học phải cùng trường với lớp; tên lớp chỉ
 * duy nhất trong (trường, năm học).
 */
@Service
public class SchoolClassService
        extends SchoolOwnedService<SchoolClass, SchoolClassRequest, SchoolClassPatchRequest> {

    private static final Pattern TRAILING_NUMBER = Pattern.compile("(\\d{1,6})$");
    /** Lớp đặt theo chữ — 6A, 6B, 6C: chữ cuối ngay sau số khối là thứ tự. */
    private static final Pattern TRAILING_LETTER = Pattern.compile("\\d([A-Za-z])$");

    private final SchoolClassRepository classes;
    private final GradeService grades;
    private final SchoolYearService schoolYears;
    private final StaffService staff;
    private final RoomService rooms;

    public SchoolClassService(
            SchoolClassRepository repository,
            RowLevelSecurity rowLevel,
            SchoolService schools,
            RowLevelPrincipalResolver principals,
            GradeService grades,
            SchoolYearService schoolYears,
            StaffService staff,
            RoomService rooms) {
        super(repository, rowLevel, SchoolClass.class, SchoolClass::new, "Lớp học", schools, principals);
        this.classes = repository;
        this.grades = grades;
        this.schoolYears = schoolYears;
        this.staff = staff;
        this.rooms = rooms;
    }

    @Override
    protected void applyCreateOwned(SchoolClass item, SchoolClassRequest request) {
        item.setGrade(grades.get(request.grade().id()));
        requireGradeFitsSchool(item);
        item.setSchoolYear(schoolYears.get(request.schoolYear().id()));
        item.setStudentCount(request.studentCount());
        setHomeroomTeacher(item, request.homeroomTeacher());
        setRoom(item, request.room());
        guardYear(item);
        if (request.sortOrder() == null) {
            item.setSortOrder(autoOrder(item));
        }
    }

    @Override
    protected void applyUpdateOwned(SchoolClass item, SchoolClassPatchRequest request) {
        // Ghi lần sửa cuối vào hồ sơ năm học đã xác nhận — cả năm cũ lẫn năm chuyển sang.
        guardYear(item);
        if (request.grade() != null && request.grade().id() != null) {
            item.setGrade(grades.get(request.grade().id()));
            requireGradeFitsSchool(item);
        }
        if (request.schoolYear() != null && request.schoolYear().id() != null) {
            item.setSchoolYear(schoolYears.get(request.schoolYear().id()));
        }
        if (request.studentCount() != null) {
            item.setStudentCount(request.studentCount());
        }
        if (request.homeroomTeacher() != null) {
            setHomeroomTeacher(item, request.homeroomTeacher());
        }
        if (request.room() != null) {
            setRoom(item, request.room());
        }
        if (request.sortOrder() == null && (request.grade() != null || request.code() != null)) {
            item.setSortOrder(autoOrder(item));
        }
        guardYear(item);
    }

    @Override
    protected void beforeDelete(SchoolClass item) {
        super.beforeDelete(item);
        guardYear(item);
    }

    /** Lớp là dữ liệu của năm học: không khoá, hồ sơ năm học đã xác nhận ghi lần sửa cuối. */
    private void guardYear(SchoolClass item) {
        if (yearLock == null || item.getSchool() == null || item.getSchoolYear() == null) {
            return;
        }
        Long school = item.getSchool().getId();
        Long year = item.getSchoolYear().getId();
        yearLock.touched(school, year, yearLock.campusOfRoom(item.getRoom() == null ? null : item.getRoom().getId(),
                school));
    }

    private SchoolYearLock yearLock;

    @Autowired
    void setYearLock(SchoolYearLock yearLock) {
        this.yearLock = yearLock;
    }

    /**
     * Khối phải thuộc cấp học của trường: THCS chỉ có lớp 6–9. Trường hoặc khối chưa khai cấp học
     * thì không chặn — không có gì để đối chiếu.
     */
    private static void requireGradeFitsSchool(SchoolClass item) {
        EducationLevel schoolLevel = item.getSchool().getEducationLevel();
        EducationLevel gradeLevel = item.getGrade().getEducationLevel();
        if (schoolLevel != null && gradeLevel != null && !schoolLevel.getId().equals(gradeLevel.getId())) {
            throw new FieldValidationException("grade", "%s không thuộc cấp %s của trường"
                    .formatted(item.getGrade().getName(), schoolLevel.getName()));
        }
    }

    /**
     * Thứ tự mặc định = khối × 100 + số cuối tên lớp (6A1 → 601, 10C12 → 1012), để danh sách đứng
     * theo khối rồi theo lớp mà người nhập không phải gõ thứ tự. Gom nhóm theo khối trên màn hình
     * dựa vào chính thứ tự này — sắp theo tên thì "Lớp 10A1" đứng trước "Lớp 6A1".
     */
    private static Integer autoOrder(SchoolClass item) {
        Integer gradeOrder = item.getGrade() == null ? null : item.getGrade().getSortOrder();
        String code = item.getCode() == null ? "" : item.getCode();
        Matcher m = TRAILING_NUMBER.matcher(code);
        Matcher letter = TRAILING_LETTER.matcher(code);
        int index = m.find() ? Math.min(Integer.parseInt(m.group(1)), 99)
                : letter.find() ? Character.toUpperCase(letter.group(1).charAt(0)) - 'A' + 1
                : 0;
        return (gradeOrder == null ? 0 : gradeOrder) * 100 + index;
    }

    /** Lọc thêm: {@code grade.id}, {@code schoolYear.id}, {@code homeroomTeacher.id}, {@code room.id}. */
    @Override
    protected Specification<SchoolClass> ownedFilters(ListParams params) {
        return Specification.allOf(List.of(
                CatalogSpecifications.<SchoolClass>referenceFilter(params, "grade"),
                CatalogSpecifications.<SchoolClass>referenceFilter(params, "schoolYear"),
                CatalogSpecifications.<SchoolClass>referenceFilter(params, "homeroomTeacher"),
                CatalogSpecifications.<SchoolClass>referenceFilter(params, "room")));
    }

    /**
     * Tên lớp trùng trong CÙNG trường và CÙNG năm học — "6A1" năm nay và năm sau là hai lớp. Câu
     * mặc định của lớp nền chỉ xét trường, và với nhiều năm học nó gặp nhiều dòng.
     */
    @Override
    protected Optional<SchoolClass> findSameCode(SchoolClass item, String code) {
        if (item.getSchoolYear() == null) {
            return Optional.empty();
        }
        return classes.findFirstBySchoolIdAndSchoolYearIdAndCodeIgnoreCase(
                item.getSchool().getId(), item.getSchoolYear().getId(), code);
    }

    /**
     * Thêm nhanh N lớp một khối: tiền tố + số thứ tự (6A1…6A4). Lớp đã có trong năm học thì bỏ
     * qua. Mỗi lớp đi qua đúng {@link #create} — cùng kiểm tra, cùng phạm vi ghi — trong một giao
     * dịch: hỏng một lớp thì không lớp nào được thêm.
     *
     * @return các lớp vừa thêm (không gồm lớp đã có)
     */
    @Transactional
    public List<SchoolClass> createMany(SchoolClassBulkRequest request) {
        if (Boolean.TRUE.equals(request.letters())
                && (request.start() < 1 || request.start() + request.count() - 1 > 26)) {
            throw new FieldValidationException("count", "Đặt tên theo chữ chỉ tới Z — tối đa 26 lớp, bắt đầu từ A");
        }
        List<SchoolClass> created = new ArrayList<>();
        IdRef year = new IdRef(request.schoolYear().id());
        for (int i = 0; i < request.count(); i++) {
            int n = request.start() + i;
            String code = request.prefix().stripLeading()
                    + (Boolean.TRUE.equals(request.letters()) ? letterOf(n) : String.valueOf(n));
            SchoolClassRequest one = new SchoolClassRequest(
                    code, "Lớp " + code, null, true, null, request.school(), request.grade(),
                    year, null, null, request.studentCount());
            try {
                created.add(create(one));
            } catch (ConflictException alreadyThere) {
                // Lớp này đã có trong năm học: bỏ qua. Kiểm trùng chạy TRƯỚC khi lưu nên chưa
                // có gì phải lùi lại.
            }
        }
        return created;
    }

    /** 1 → A, 2 → B … 26 → Z. Ngoài khoảng đó bị chặn ở {@link #createMany} trước khi tới đây. */
    private static String letterOf(int n) {
        return String.valueOf((char) ('A' + n - 1));
    }

    private void setHomeroomTeacher(SchoolClass item, IdRef ref) {
        var teacher = ref(ref, staff::get);
        requireSameSchool(item, teacher, "homeroomTeacher");
        if (teacher != null && teacher.getStaffType() != StaffType.TEACHER) {
            throw new FieldValidationException("homeroomTeacher",
                    "%s không phải giáo viên — chủ nhiệm phải là giáo viên".formatted(teacher.getName()));
        }
        item.setHomeroomTeacher(teacher);
    }

    private void setRoom(SchoolClass item, IdRef ref) {
        var room = ref(ref, rooms::get);
        requireSameSchool(item, room, "room");
        item.setRoom(room);
    }

    private static <R> R ref(IdRef ref, Function<Long, R> loader) {
        return ref == null || ref.id() == null ? null : loader.apply(ref.id());
    }

    private CampusScope campusScope;

    /** Tiêm qua setter — phạm vi cơ sở (270), xem {@link CampusScope}. */
    @Autowired
    void setCampusScope(CampusScope campusScope) {
        this.campusScope = campusScope;
    }

    @Override
    protected CampusRule<SchoolClass> campusRule() {
        return campusScope.byRoom(SchoolClass::getRoom, SchoolClass::getSchool);
    }
}
