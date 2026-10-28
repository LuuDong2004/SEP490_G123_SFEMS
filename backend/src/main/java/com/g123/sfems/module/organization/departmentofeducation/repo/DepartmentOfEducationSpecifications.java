package com.g123.sfems.module.organization.departmentofeducation.repo;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.ManagingBodyType;
import com.g123.sfems.domain.organization.OrgStatus;
import com.g123.sfems.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Dịch query string đã phân tích thành {@link Specification}.
 *
 * <p>Trường không nhận ra thì bỏ qua chứ không từ chối: một ô lọc mới ở
 * frontend thoái hoá thành "không thu hẹp" thay vì làm trắng bảng bằng lỗi 400.
 */
public final class DepartmentOfEducationSpecifications {

    private DepartmentOfEducationSpecifications() {
    }

    public static Specification<DepartmentOfEducation> from(ListParams params) {
        List<Specification<DepartmentOfEducation>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<DepartmentOfEducation> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion);
                case "code" -> textSpec("code", criterion);
                case "name" -> textSpec("name", criterion);
                case "province" -> textSpec("province", criterion);
                case "address" -> textSpec("address", criterion);
                case "status" -> statusSpec(criterion);
                case "type" -> typeSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            // Không phân biệt dấu: gõ "binh an" phải ra "Bình An".
            var byText = cb.or(
                    ListParams.foldedLike(cb, root.get("code"), term),
                    ListParams.foldedLike(cb, root.get("name"), term),
                    ListParams.foldedLike(cb, root.get("province"), term));
            Long id = parseLong(term);
            return id == null ? byText : cb.or(byText, cb.equal(root.get("id"), id));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<DepartmentOfEducation> idSpec(ListParams.Criterion criterion) {
        Long id = parseLong(criterion.value());
        if (id == null) {
            return never();
        }
        return switch (criterion.operator()) {
            case EQ, LIKE -> (root, query, cb) -> cb.equal(root.get("id"), id);
            case NE -> (root, query, cb) -> cb.notEqual(root.get("id"), id);
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("id"), id);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get("id"), id);
        };
    }

    private static Specification<DepartmentOfEducation> textSpec(
            String attribute, ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    cb.like(cb.lower(root.get(attribute)), ListParams.likePattern(value));
            case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), value);
            default -> (root, query, cb) -> cb.equal(root.get(attribute), value);
        };
    }

    /**
     * Lọc theo loại cơ quan quản lý — "cho tôi các UBND" là câu hỏi mà màn
     * chọn cơ quan của một trường hỏi mỗi lần mở.
     */
    private static Specification<DepartmentOfEducation> typeSpec(ListParams.Criterion criterion) {
        ManagingBodyType type;
        try {
            type = ManagingBodyType.from(criterion.value());
        } catch (IllegalArgumentException e) {
            // Một loại không tồn tại là câu hỏi hợp lệ với câu trả lời rỗng.
            return never();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("type"), type)
                : (root, query, cb) -> cb.equal(root.get("type"), type);
    }

    private static Specification<DepartmentOfEducation> statusSpec(ListParams.Criterion criterion) {
        OrgStatus status;
        try {
            status = OrgStatus.from(criterion.value());
        } catch (IllegalArgumentException e) {
            // Lọc theo một trạng thái không tồn tại là câu hỏi hợp lệ với câu
            // trả lời rỗng, không phải một request sai.
            return never();
        }
        if (status == null) {
            return null;
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("status"), status)
                : (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    private static Specification<DepartmentOfEducation> never() {
        return (root, query, cb) -> cb.disjunction();
    }

    private static Long parseLong(String value) {
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
