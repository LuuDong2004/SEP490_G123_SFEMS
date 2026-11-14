package com.g123.sfems.module.catalog.subjectgroup;

import com.g123.sfems.module.organization.school.service.CallerSchoolLevel;

import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.catalog.subjectgroup.SubjectGroup;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.catalog.subject.SubjectService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.web.ListParams;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

/**
 * Tổ chuyên môn. Phần chung ở {@link CatalogService}; lớp này gán cấp học và
 * danh sách môn.
 *
 * <p>Môn học phân giải qua {@link SubjectService#getMany} trong MỘT truy vấn,
 * và một id không tồn tại là 404 nêu đúng id đó — không phải một danh sách lặng
 * lẽ ngắn đi, thứ mà người dùng sẽ chỉ phát hiện khi mở lại tổ.
 */
@Service
public class SubjectGroupService
        extends CatalogService<SubjectGroup, SubjectGroupRequest, SubjectGroupPatchRequest> {

    private final EducationLevelService educationLevels;
    private final SubjectService subjects;
    private final CallerSchoolLevel callerLevel;

    public SubjectGroupService(
            SubjectGroupRepository repository,
            RowLevelSecurity rowLevel,
            EducationLevelService educationLevels,
            SubjectService subjects,
            CallerSchoolLevel callerLevel) {
        super(repository, rowLevel, SubjectGroup.class, SubjectGroup::new, "Tổ chuyên môn");
        this.educationLevels = educationLevels;
        this.subjects = subjects;
        this.callerLevel = callerLevel;
    }

    @Override
    protected void applyCreate(SubjectGroup item, SubjectGroupRequest request) {
        IdRef level = request.educationLevel();
        if (level != null && level.id() != null) {
            item.setEducationLevel(educationLevels.get(level.id()));
        }
        if (request.subjects() != null) {
            replaceSubjects(item, request.subjects());
        }
    }

    @Override
    protected void applyUpdate(SubjectGroup item, SubjectGroupPatchRequest request) {
        IdRef level = request.educationLevel();
        if (level != null) {
            item.setEducationLevel(level.id() == null ? null : educationLevels.get(level.id()));
        }
        if (request.subjects() != null) {
            replaceSubjects(item, request.subjects());
        }
    }

    private void replaceSubjects(SubjectGroup item, List<IdRef> refs) {
        List<Long> ids = refs.stream().map(IdRef::id).filter(Objects::nonNull).distinct().toList();
        Map<Long, Subject> found = subjects.getMany(ids).stream()
                .collect(Collectors.toMap(Subject::getId, Function.identity()));
        for (Long id : ids) {
            if (!found.containsKey(id)) {
                throw new ResourceNotFoundException("Subject", id);
            }
        }
        Set<Subject> wanted = new LinkedHashSet<>();
        ids.forEach(id -> wanted.add(found.get(id)));
        // Sửa trên CHÍNH tập Hibernate đang theo dõi, không gán tập mới.
        item.getSubjects().retainAll(wanted);
        item.getSubjects().addAll(wanted);
    }

    @Override
    protected Specification<SubjectGroup> extraFilters(ListParams params) {
        Specification<SubjectGroup> byParam = CatalogSpecifications.referenceFilter(params, "educationLevel");
        // Tài khoản của một trường chỉ thấy tổ chuyên môn của CẤP HỌC trường mình, cộng tổ không gắn cấp
        // (xem `CallerSchoolLevel`).
        Long levelId = callerLevel.educationLevelId();
        return levelId == null ? byParam
                : byParam.and((root, q, cb) -> cb.or(cb.isNull(root.get("educationLevel")),
                        cb.equal(root.get("educationLevel").get("id"), levelId)));
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }
}
