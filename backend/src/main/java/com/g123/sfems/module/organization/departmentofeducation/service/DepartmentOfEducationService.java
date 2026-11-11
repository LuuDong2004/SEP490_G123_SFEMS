package com.g123.sfems.module.organization.departmentofeducation.service;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.module.organization.departmentofeducation.api.dto.DepartmentOfEducationPatchRequest;
import com.g123.sfems.module.organization.departmentofeducation.api.dto.DepartmentOfEducationRequest;
import com.g123.sfems.module.organization.departmentofeducation.repo.DepartmentOfEducationRepository;
import com.g123.sfems.module.organization.departmentofeducation.repo.DepartmentOfEducationSpecifications;
import com.g123.sfems.module.organization.school.service.ManagedSchoolsCache;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.web.ListParams;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Logic riêng của Sở/Phòng GD, và là cửa vào cho feature khác cần phân giải
 * một Sở — {@code SchoolService} đi qua {@link #get(Long)} chứ không qua
 * {@code DepartmentOfEducationRepository}, để một id không tồn tại sinh ra
 * đúng lỗi 404 mà endpoint của chính resource này sinh ra.
 */
@Service
@Transactional(readOnly = true)
public class DepartmentOfEducationService {

    private static final Set<String> SORTABLE =
            Set.of("id", "code", "name", "province", "type", "status", "createdAt", "updatedAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id"));

    private final DepartmentOfEducationRepository repository;
    private final RowLevelSecurity rowLevel;
    private final ManagedSchoolsCache managedSchools;

    public DepartmentOfEducationService(
            DepartmentOfEducationRepository repository, RowLevelSecurity rowLevel,
            ManagedSchoolsCache managedSchools) {
        this.repository = repository;
        this.rowLevel = rowLevel;
        this.managedSchools = managedSchools;
    }

    public Page<DepartmentOfEducation> list(ListParams params) {
        return repository.findAll(
                // Phạm vi trước, bộ lọc của người gọi sau: Specification.and
                // không có phép trừ, nên không query string nào nới rộng được.
                rowLevel.scope(DepartmentOfEducation.class, Action.READ)
                        .and(DepartmentOfEducationSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public DepartmentOfEducation get(Long id) {
        return repository.findOne(rowLevel.byId(DepartmentOfEducation.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException("DepartmentOfEducation", id));
    }

    public List<DepartmentOfEducation> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(DepartmentOfEducation.class, Action.READ, ids));
    }

    @Transactional
    public DepartmentOfEducation create(DepartmentOfEducationRequest request) {
        String code = request.code().trim();
        requireCodeAvailable(code, null);

        DepartmentOfEducation department =
                new DepartmentOfEducation(code, request.name().trim(), request.type());
        department.setProvince(trimToNull(request.province()));
        department.setAddress(trimToNull(request.address()));
        department.setStatus(request.status());

        DepartmentOfEducation saved = repository.persist(department);
        // Đẩy xuống DB trước: khoá định danh và dấu @PrePersist chỉ tồn tại sau
        // đó, và kiểm chính sách trên bản ghi chưa dựng xong thì sai trong mọi
        // trường hợp.
        repository.flush();
        rowLevel.checkWritable(saved);
        // Loại cơ quan (Sở / UBND) nằm trong bộ nhớ đệm của VisibleSchools.
        managedSchools.invalidateAfterCommit();
        return saved;
    }

    @Transactional
    public DepartmentOfEducation update(Long id, DepartmentOfEducationPatchRequest request) {
        DepartmentOfEducation department = repository
                .findOne(rowLevel.byId(DepartmentOfEducation.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("DepartmentOfEducation", id));

        if (request.code() != null) {
            String code = request.code().trim();
            requireCodeAvailable(code, department.getId());
            department.setCode(code);
        }
        if (request.name() != null) {
            department.setName(request.name().trim());
        }
        if (request.province() != null) {
            department.setProvince(trimToNull(request.province()));
        }
        if (request.address() != null) {
            department.setAddress(trimToNull(request.address()));
        }
        if (request.status() != null) {
            department.setStatus(request.status());
        }

        if (request.type() != null) {
            department.setType(request.type());
            managedSchools.invalidateAfterCommit();
        }

        rowLevel.checkWritable(department);
        return repository.persist(department);
    }

    /**
     * Xoá một Sở/Phòng GD.
     *
     * <p>Một Sở còn trường trực thuộc bị khoá ngoại {@code RESTRICT} trên
     * {@code schools} từ chối, và nổi lên thành đúng lỗi 409 mà một danh mục
     * đang được dùng vẫn sinh ra. Đếm số trường ở đây thay vì vậy sẽ là đọc
     * bảng của feature khác từ bên trong feature này.
     */
    @Transactional
    public DepartmentOfEducation delete(Long id) {
        DepartmentOfEducation department = repository
                .findOne(rowLevel.byId(DepartmentOfEducation.class, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException("DepartmentOfEducation", id));
        repository.remove(department);
        managedSchools.invalidateAfterCommit();
        return department;
    }

    /** Từ chối mã trùng bằng thông báo nói về trường, không phải về index. */
    private void requireCodeAvailable(String code, Long selfId) {
        repository.findByCodeIgnoreCase(code).ifPresent(existing -> {
            if (!existing.getId().equals(selfId)) {
                throw new ConflictException("Sở/Phòng GD có mã %s đã tồn tại".formatted(code));
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
