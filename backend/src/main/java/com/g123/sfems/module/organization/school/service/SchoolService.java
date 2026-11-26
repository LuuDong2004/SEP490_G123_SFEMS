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
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
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

    /**
     * Trường tự sửa phần hồ sơ của CHÍNH MÌNH (239): địa chỉ, mã định danh Bộ. Không qua phạm vi ghi của
     * {@code schools} — bên gọi đã lấy {@code schoolId} từ người gọi, không nhận từ request. Các ô còn lại (tên, mã,
     * phường, cơ quan quản lý…) quyết định phạm vi dữ liệu và mã tài sản nên vẫn chỉ đi qua {@link #update}.
     * Ba trạng thái như {@code SchoolPatchRequest}: null là để nguyên, chuỗi rỗng là xoá.
     */
    @Transactional
    public void updateOwnProfile(Long schoolId, String address, String moetCode) {
        // Đọc qua phạm vi ĐỌC (trường luôn thấy chính mình); không qua phạm vi ghi của `schools` — xem javadoc.
        School school = get(schoolId);
        if (address != null) {
            school.setAddress(trimToNull(address));
        }
        if (moetCode != null) {
            school.setMoetCode(requireMoetCodeAvailable(trimToNull(moetCode), school.getId()));
        }
    }

    /** Trường mà người gọi được SỬA — 404 nếu ngoài phạm vi ghi. */
    public School getWritable(Long id) {
        return repository.findOne(rowLevel.byId(School.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("School", id));
    }

    public List<School> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(School.class, Action.READ, ids));
    }

    /** Diện tích xây dựng nằm trên đất của trường — lớn hơn diện tích đất là gõ nhầm (thiếu một ô trống thì không so). */
    public static void requireAreasFit(BigDecimal landArea, BigDecimal constructionArea) {
        if (landArea != null && constructionArea != null && constructionArea.compareTo(landArea) > 0) {
            throw new FieldValidationException("constructionArea", "Diện tích xây dựng không được lớn hơn diện tích đất");
        }
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
        // Cấp học quyết định khối lớp, danh mục tối thiểu, chuẩn CSVC của trường — trường không cấp học thì các màn đó trống.
        if (request.educationLevel() == null || request.educationLevel().id() == null) {
            throw new FieldValidationException("educationLevel", "Chọn cấp học");
        }
        school.setEducationLevel(educationLevels.get(request.educationLevel().id()));
        String shortCode = SchoolShortCodes.normalize(trimToNull(request.shortCode()));
        if (shortCode != null) {
            requireShortCodeAvailable(shortCode, null);
        }
        school.setShortCode(shortCode == null ? nextShortCode() : shortCode);
        school.setMoetCode(requireMoetCodeAvailable(trimToNull(request.moetCode()), null));
        if (request.ward() != null && request.ward().id() != null) {
            school.setWard(wards.get(request.ward().id()));
        }
        school.setAddress(trimToNull(request.address()));
        school.setPrimaryColor(trimToNull(request.primaryColor()));
        school.setLandArea(request.landArea());
        school.setConstructionArea(request.constructionArea());
        requireAreasFit(school.getLandArea(), school.getConstructionArea());
        school.setStatus(request.status());

        School saved = repository.persist(school);
        managedSchools.invalidateAfterCommit();
        repository.flush();
        rowLevel.checkWritable(saved);
        return saved;
    }

    /**
     * Mã hai ký tự kế tiếp còn trống ({@link SchoolShortCodes}). Đây là thành phần TR của mã tài sản in trên
     * tem, nên chỉ cấp MỘT lần lúc tạo trường — không tự đổi về sau.
     */
    private String nextShortCode() {
        return SchoolShortCodes.next(new HashSet<>(repository.findAllShortCodes()));
    }

    /** Mã hai ký tự là duy nhất toàn hệ thống: hai trường cùng TR thì sinh trùng mã tài sản (NV-33). */
    private void requireShortCodeAvailable(String shortCode, Long selfId) {
        for (School existing : repository.findByShortCode(shortCode)) {
            if (!existing.getId().equals(selfId)) {
                throw new ConflictException("Mã hai ký tự %s đang là của %s".formatted(shortCode, existing.getName()));
            }
        }
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
            String shortCode = SchoolShortCodes.normalize(trimToNull(request.shortCode()));
            if (shortCode != null) {
                requireShortCodeAvailable(shortCode, school.getId());
            }
            school.setShortCode(shortCode);
        }
        if (request.moetCode() != null) {
            school.setMoetCode(requireMoetCodeAvailable(trimToNull(request.moetCode()), school.getId()));
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
        if (request.landArea() != null) {
            school.setLandArea(request.landArea());
        }
        if (request.constructionArea() != null) {
            school.setConstructionArea(request.constructionArea());
        }
        if (request.landArea() != null || request.constructionArea() != null) {
            requireAreasFit(school.getLandArea(), school.getConstructionArea());
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

    /**
     * Mã định danh của Bộ là của MỘT trường: hai trường cùng mã thì báo cáo nộp Bộ gộp nhầm. Chỉ kiểm trùng, không kiểm
     * khuôn — dữ liệu đang có lẫn mã 8 số và mã có chữ ("790007B6").
     */
    private String requireMoetCodeAvailable(String moetCode, Long selfId) {
        if (moetCode == null) {
            return null;
        }
        for (School existing : repository.findByMoetCodeIgnoreCase(moetCode)) {
            if (!existing.getId().equals(selfId)) {
                throw new FieldValidationException("moetCode",
                        "Mã định danh Bộ %s đang là của trường %s".formatted(moetCode, existing.getName()));
            }
        }
        return moetCode;
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
