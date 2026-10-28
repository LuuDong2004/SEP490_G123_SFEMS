package com.g123.sfems.module.catalog.educationlevel.repo;

import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Dịch query string đã phân tích thành {@link Specification} của JPA.
 *
 * <p>Trường không nhận ra thì bỏ qua chứ không từ chối: một ô lọc mới ở
 * frontend sẽ thoái hoá thành "không thu hẹp" thay vì làm trắng bảng bằng một
 * lỗi 400.
 */
public final class EducationLevelSpecifications {

    private EducationLevelSpecifications() {
    }

    public static Specification<EducationLevel> from(ListParams params) {
        List<Specification<EducationLevel>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<EducationLevel> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion);
                case "code" -> textSpec("code", criterion);
                case "name" -> textSpec("name", criterion);
                case "shortName" -> textSpec("shortName", criterion);
                case "note" -> textSpec("note", criterion);
                case "active" -> activeSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        // `q` là ô tìm nhanh: một từ khoá soi qua mã, tên và tên rút gọn, vì
        // data provider không có cách nào diễn đạt phép OR giữa các trường rời.
        // Nửa theo id chỉ ghép vào khi từ khoá phân tích được thành số, để
        // truy vấn không phải ép kiểu trên từng dòng.
        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            var byText = cb.or(
                    ListParams.foldedLike(cb, root.get("code"), term),
                    ListParams.foldedLike(cb, root.get("name"), term),
                    ListParams.foldedLike(cb, root.get("shortName"), term));
            Long id = parseLong(term);
            return id == null ? byText : cb.or(byText, cb.equal(root.get("id"), id));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<EducationLevel> idSpec(ListParams.Criterion criterion) {
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

    private static Specification<EducationLevel> textSpec(
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
     * Lọc theo cờ còn dùng. Chuỗi không phải {@code true}/{@code false} là một
     * câu hỏi hợp lệ với câu trả lời rỗng, không phải một request sai.
     */
    private static Specification<EducationLevel> activeSpec(ListParams.Criterion criterion) {
        String value = criterion.value().trim();
        Boolean active;
        if ("true".equalsIgnoreCase(value)) {
            active = Boolean.TRUE;
        } else if ("false".equalsIgnoreCase(value)) {
            active = Boolean.FALSE;
        } else {
            return never();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("active"), active)
                : (root, query, cb) -> cb.equal(root.get("active"), active);
    }

    /** Vị từ không dòng nào thoả — giá trị lọc không khớp được với gì cả. */
    private static Specification<EducationLevel> never() {
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
