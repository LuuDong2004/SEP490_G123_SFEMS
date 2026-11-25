package com.g123.sfems.module.catalog.subject;

import com.g123.sfems.module.organization.school.service.CallerSchoolLevel;

import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.catalog.subject.SubjectEducationLevel;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.catalog.educationlevel.service.EducationLevelService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

/**
 * Môn học. Phần chung ở {@link CatalogService}; lớp này giữ danh sách cấp học.
 *
 * <h2>Sửa danh sách cấp học bằng so khớp, không bằng xoá hết rồi thêm lại</h2>
 *
 * <p>Dòng nào có cấp học vẫn còn trong request thì giữ nguyên và chỉ cập nhật
 * loại/thứ tự; cấp nào biến mất thì gỡ (orphanRemoval xoá dòng); cấp mới thì
 * thêm. Xoá hết rồi thêm lại sẽ đẩy một cặp DELETE + INSERT cùng khoá
 * {@code (subject_id, education_level_id)} vào cùng một lần flush — đúng hay
 * không phụ thuộc vào thứ tự Hibernate xếp hai loại lệnh đó, và dòng nào cũng
 * mất id cùng dấu audit của nó dù không ai đổi gì.
 */
@Service
public class SubjectService extends CatalogService<Subject, SubjectRequest, SubjectPatchRequest> {

    private final EducationLevelService educationLevels;
    private final CallerSchoolLevel callerLevel;

    public SubjectService(
            SubjectRepository repository,
            RowLevelSecurity rowLevel,
            EducationLevelService educationLevels,
            CallerSchoolLevel callerLevel) {
        super(repository, rowLevel, Subject.class, Subject::new, "Môn học");
        this.educationLevels = educationLevels;
        this.callerLevel = callerLevel;
    }

    /**
     * Mã danh mục ({@code code}) LUÔN bằng mã môn dạy học — trên form chỉ có một
     * ô "Mã môn dạy học", ô Mã riêng đã bỏ vì hai ô cùng nghĩa làm người nhập
     * không biết gõ ô nào. Gán lại {@code code} ở đây, sau cả mã đầu vào lẫn mã
     * quy tắc sinh mã của Sở (đã tắt cho {@code subjects}).
     */
    @Override
    protected void applyCreate(Subject item, SubjectRequest request) {
        String teachingCode = request.teachingCode().trim();
        item.setTeachingCode(teachingCode);
        item.setCode(teachingCode);
        if (request.educationLevels() != null) {
            syncLevels(item, request.educationLevels());
        }
    }

    @Override
    protected void applyUpdate(Subject item, SubjectPatchRequest request) {
        // {@code teachingCode} là trường thật; {@code code} chỉ là bản sao của nó —
        // client sửa "mã" là sửa mã môn dạy học, hai giá trị không bao giờ tách nhau.
        String teachingCode = request.teachingCode() != null
                ? request.teachingCode().trim()
                : request.code() != null ? request.code().trim() : null;
        if (teachingCode != null) {
            // Kiểm trùng TRƯỚC khi gán: truy vấn kiểm trùng làm Hibernate đẩy
            // bản ghi đang sửa xuống DB, và mã trùng sẽ vấp unique index trước
            // khi ta kịp trả lỗi có nghĩa — cùng thứ tự với kiểm mã của lớp cha.
            if (!teachingCode.equals(item.getCode())) {
                findSameCode(item, teachingCode).ifPresent(existing -> {
                    if (!existing.getId().equals(item.getId())) {
                        throw new FieldValidationException("teachingCode",
                                "Mã môn dạy học %s đã có ở môn %s"
                                        .formatted(teachingCode, existing.getName()));
                    }
                });
            }
            item.setTeachingCode(teachingCode);
            item.setCode(teachingCode);
        }
        if (request.educationLevels() != null) {
            syncLevels(item, request.educationLevels());
        }
    }

    private void syncLevels(Subject item, List<SubjectLevelInput> inputs) {
        // Một cấp học chỉ được xuất hiện một lần — báo vào đúng ô, trước khi
        // unique index của database kịp trả về một lỗi ràng buộc chung chung.
        Set<Long> seen = new HashSet<>();
        for (SubjectLevelInput input : inputs) {
            if (!seen.add(input.educationLevel().id())) {
                throw new FieldValidationException(
                        "educationLevels", "Một cấp học chỉ được chọn một lần");
            }
        }

        Map<Long, SubjectEducationLevel> existing = new HashMap<>();
        for (SubjectEducationLevel row : item.getEducationLevels()) {
            existing.put(row.getEducationLevel().getId(), row);
        }

        List<SubjectEducationLevel> keep = new ArrayList<>();
        for (SubjectLevelInput input : inputs) {
            Long levelId = input.educationLevel().id();
            SubjectEducationLevel row = existing.get(levelId);
            if (row == null) {
                EducationLevel level = educationLevels.get(levelId);
                row = new SubjectEducationLevel(item, level);
                item.getEducationLevels().add(row);
            }
            row.setSubjectType(input.subjectType());
            row.setSortOrder(input.sortOrder());
            keep.add(row);
        }
        // Sửa trên CHÍNH tập Hibernate đang theo dõi, không gán tập mới.
        item.getEducationLevels().retainAll(keep);
    }

    /**
     * {@code educationLevel.id=n}: môn học được dạy ở cấp đó. Viết bằng
     * {@code EXISTS} chứ không join vào collection — join sẽ nhân dòng lên, làm
     * {@code X-Total-Count} sai và buộc phải thêm {@code distinct}. Cùng lý do
     * mà engine phân quyền dòng sinh {@code EXISTS} cho mọi điều kiện qua quan hệ.
     */
    @Override
    protected Specification<Subject> extraFilters(ListParams params) {
        List<Specification<Subject>> specs = new ArrayList<>();
        // Tài khoản của một trường chỉ thấy môn CÓ dạy ở cấp học trường mình, cộng môn không gắn cấp nào
        // (dùng chung). Môn chỉ của cấp khác không có mặt trong ô chọn của trường.
        Long callerLevelId = callerLevel.educationLevelId();
        if (callerLevelId != null) {
            specs.add((root, query, cb) -> {
                var mine = query.subquery(Long.class);
                var link = mine.from(SubjectEducationLevel.class);
                mine.select(link.get("id")).where(
                        cb.equal(link.get("subject"), root),
                        cb.equal(link.get("educationLevel").get("id"), callerLevelId));
                var any = query.subquery(Long.class);
                var anyLink = any.from(SubjectEducationLevel.class);
                any.select(anyLink.get("id")).where(cb.equal(anyLink.get("subject"), root));
                return cb.or(cb.exists(mine), cb.not(cb.exists(any)));
            });
        }
        for (ListParams.Criterion criterion : params.filters()) {
            if (!criterion.field().equals("educationLevel.id")) {
                continue;
            }
            Long id;
            try {
                id = Long.valueOf(criterion.value().trim());
            } catch (NumberFormatException e) {
                specs.add((root, query, cb) -> cb.disjunction());
                continue;
            }
            specs.add((root, query, cb) -> {
                var sub = query.subquery(Long.class);
                var link = sub.from(SubjectEducationLevel.class);
                sub.select(link.get("id")).where(
                        cb.equal(link.get("subject"), root),
                        cb.equal(link.get("educationLevel").get("id"), id));
                return cb.exists(sub);
            });
        }
        return Specification.allOf(specs);
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }
}
