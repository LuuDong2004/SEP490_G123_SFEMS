package com.g123.sfems.module.organization.school.service;

import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.module.catalog.coderule.CodeGenerator;
import com.g123.sfems.module.catalog.ward.WardService;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.organization.departmentofeducation.service.DepartmentOfEducationService;
import com.g123.sfems.module.organization.school.api.dto.SchoolPatchRequest;
import com.g123.sfems.module.organization.school.api.dto.SchoolRequest;
import com.g123.sfems.module.organization.school.repo.SchoolRepository;
import com.g123.sfems.module.organization.school.repo.SchoolSpecifications;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.web.ListParams;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Logic riêng của trường học.
 *
 * <p>Hai tham chiếu được phân giải qua {@code service/} của feature tương ứng,
 * không qua {@code repo/} của chúng — nên một id không tồn tại sinh ra đúng
 * lỗi 404 mà endpoint của chính resource đó sinh ra, thay vì một
 * {@code ConstraintViolationException} lúc flush.
 */
@Service
@Transactional(readOnly = true)
public class SchoolService {

    private static final Set<String> SORTABLE =
            Set.of("id", "code", "shortCode", "moetCode", "name", "status", "createdAt", "updatedAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id"));

    private final SchoolRepository repository;
    private final DepartmentOfEducationService departments;
    private final EducationLevelService educationLevels;
    private final WardService wards;
    private final RowLevelSecurity rowLevel;
    private final ManagedSchoolsCache managedSchools;
    private CodeGenerator codes;

    /** Tiêm qua setter — sinh mã trường theo quy tắc "schools" (Quy tắc sinh mã của Sở). */
    @Autowired
    void setCodeGenerator(CodeGenerator codes) {
        this.codes = codes;
    }

    public SchoolService(
            SchoolRepository repository,
            DepartmentOfEducationService departments,
            EducationLevelService educationLevels,
            WardService wards,
            RowLevelSecurity rowLevel,
            ManagedSchoolsCache managedSchools) {
        this.repository = repository;
        this.managedSchools = managedSchools;
        this.departments = departments;
        this.educationLevels = educationLevels;
        this.wards = wards;
        this.rowLevel = rowLevel;
    }

    public Page<School> list(ListParams params) {
        return repository.findAll(
                rowLevel.scope(School.class, Action.READ)
                        .and(SchoolSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public School get(Long id) {
        return repository.findOne(rowLevel.byId(School.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException("School", id));
    }

    /** Trường mà người gọi được SỬA — 404 nếu ngoài phạm vi ghi. */
    public School getWritable(Long id) {
        return repository.findOne(rowLevel.byId(School.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("School", id));
    }

    public List<School> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(School.class, Action.READ, ids));
    }

    @Transactional
    public School create(SchoolRequest request) {
        // Mã trường và mã hai ký tự do hệ thống cấp; người khai báo chỉ nhập mã định danh của Bộ.
        String requested = request.code() == null ? "" : request.code().trim();
        String code = requested.isEmpty()
                ? codes.reserve("schools").orElseGet(this::fallbackCode)
                : codes.resolveOnCreate("schools", requested);
        requireCodeAvailable(code, null);

        // Không gửi cơ quan quản lý = CHƯA XÁC ĐỊNH, không phải "Sở mặc định".
        // Mặc định về Sở là cách cũ, từ hồi hệ thống chỉ có một cơ quan; giờ có
        // 169, và Sở không quản lý trực tiếp cấp 1, cấp 2 nên mặc định ấy sẽ
        // ghi sai phân cấp cho mọi trường tiểu học tạo mới.
        DepartmentOfEducation department =
                request.departmentOfEducation() == null || request.departmentOfEducation().id() == null
                        ? null
                        : departments.get(request.departmentOfEducation().id());

        School school = new School(department, code, request.name().trim());
        // Ref có mặt nhưng id rỗng nghĩa là "chưa chọn cấp học" — ô chọn chưa
        // được chạm tới vẫn gửi cả đối tượng lên.
        if (request.educationLevel() != null && request.educationLevel().id() != null) {
            school.setEducationLevel(educationLevels.get(request.educationLevel().id()));
        }
        String shortCode = trimToNull(request.shortCode());
        school.setShortCode(shortCode == null ? nextShortCode() : shortCode);
        school.setMoetCode(trimToNull(request.moetCode()));
        if (request.ward() != null && request.ward().id() != null) {
            school.setWard(wards.get(request.ward().id()));
        }
        school.setAddress(trimToNull(request.address()));
        school.setPrimaryColor(trimToNull(request.primaryColor()));
        school.setClassCount(request.classCount());
        school.setStudentCount(request.studentCount());
        school.setStatus(request.status());

        School saved = repository.persist(school);
        managedSchools.invalidateAfterCommit();
        repository.flush();
        rowLevel.checkWritable(saved);
        return saved;
    }

    /**
     * Mã hai ký tự kế tiếp còn trống: 01…99, rồi A0…Z9, rồi AA…ZZ. Đây là thành phần TR của mã tài
     * sản in trên tem, nên chỉ cấp MỘT lần lúc tạo trường — không tự đổi về sau.
     */
    private String nextShortCode() {
        Set<String> taken = new HashSet<>(repository.findAllShortCodes());
        String digits = "0123456789";
        String letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        List<String> candidates = new ArrayList<>();
        for (int i = 1; i < 100; i++) {
            candidates.add(String.format("%02d", i));
        }
        for (char a : letters.toCharArray()) {
            for (char d : digits.toCharArray()) {
                candidates.add("" + a + d);
            }
        }
        for (char a : letters.toCharArray()) {
            for (char b : letters.toCharArray()) {
                candidates.add("" + a + b);
            }
        }
        return candidates.stream().filter(c -> !taken.contains(c)).findFirst()
                .orElseThrow(() -> new ConflictException("Đã hết mã hai ký tự để cấp cho trường mới"));
    }

    /** Quy tắc "schools" bị tắt: vẫn cấp được mã, TR + số lớn nhất đang có + 1. */
    private String fallbackCode() {
        int n = 1;
        while (repository.findByCodeIgnoreCase(String.format("TR%04d", n)).isPresent()) {
            n++;
        }
        return String.format("TR%04d", n);
    }

    @Transactional
    public School update(Long id, SchoolPatchRequest request) {
        School school = repository.findOne(rowLevel.byId(School.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("School", id));

        if (request.code() != null) {
            String code = request.code().trim();
            requireCodeAvailable(code, school.getId());
            school.setCode(code);
        }
        if (request.name() != null) {
            school.setName(request.name().trim());
        }
        // Ba trạng thái như mọi tham chiếu khác: vắng mặt giữ nguyên,
        // {"id": null} gỡ về chưa xác định, {"id": n} gán.
        if (request.departmentOfEducation() != null) {
            school.setDepartmentOfEducation(
                    departments.get(request.departmentOfEducation().id()));
            // Người dùng tự chọn thì chính họ là nguồn, và nó đè lên mọi suy
            // luận trước đó — giữ lại nhãn "gán theo quận cũ" sau khi có người
            // sửa tay sẽ gọi một dữ liệu đã đúng là đáng ngờ.
            school.setDepartmentSource(null);
        }
        // Ba trạng thái: vắng mặt là để nguyên, {"id": null} là xoá,
        // {"id": n} là gán. Xem javadoc của EducationLevelRef.
        if (request.educationLevel() != null) {
            Long levelId = request.educationLevel().id();
            EducationLevel level = levelId == null ? null : educationLevels.get(levelId);
            school.setEducationLevel(level);
        }
        if (request.shortCode() != null) {
            school.setShortCode(trimToNull(request.shortCode()));
        }
        if (request.moetCode() != null) {
            school.setMoetCode(trimToNull(request.moetCode()));
        }
        if (request.ward() != null) {
            Long wardId = request.ward().id();
            school.setWard(wardId == null ? null : wards.get(wardId));
        }
        if (request.address() != null) {
            school.setAddress(trimToNull(request.address()));
        }
        if (request.primaryColor() != null) {
            school.setPrimaryColor(trimToNull(request.primaryColor()));
        }
        if (request.classCount() != null) {
            school.setClassCount(request.classCount());
        }
        if (request.studentCount() != null) {
            school.setStudentCount(request.studentCount());
        }
        if (request.status() != null) {
            school.setStatus(request.status());
        }

        rowLevel.checkWritable(school);
        managedSchools.invalidateAfterCommit();
        return repository.persist(school);
    }

    /**
     * Xoá một trường.
     *
     * <p>Hôm nay chưa có bảng nào trỏ vào {@code schools}, nên thao tác này
     * thành công. Ngày thiết bị, phiếu và tài khoản trỏ vào rồi thì khoá ngoại
     * {@code RESTRICT} sẽ từ chối, và thao tác đúng là chuyển trạng thái sang
     * {@code INACTIVE} — đó cũng là lý do vai trò Sở không được cấp
     * {@code schools:delete}.
     */
    @Transactional
    public School delete(Long id) {
        School school = repository.findOne(rowLevel.byId(School.class, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException("School", id));
        repository.remove(school);
        managedSchools.invalidateAfterCommit();
        return school;
    }

    private void requireCodeAvailable(String code, Long selfId) {
        repository.findByCodeIgnoreCase(code).ifPresent(existing -> {
            if (!existing.getId().equals(selfId)) {
                throw new ConflictException("Trường có mã %s đã tồn tại".formatted(code));
            }
        });
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
