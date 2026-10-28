package com.g123.sfems.module.catalog.base;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Dịch query string thành {@link Specification} cho mọi danh mục cùng hình
 * dạng. Trường không nhận ra thì bỏ qua chứ không từ chối: một ô lọc mới ở
 * frontend thoái hoá thành "không thu hẹp" thay vì làm trắng bảng bằng lỗi 400.
 */
public final class CatalogSpecifications {

    private CatalogSpecifications() {
    }

    public static <T extends CatalogEntity> Specification<T> from(ListParams params) {
        return from(params, List.of("code", "name"));
    }

    /** Như {@link #from(ListParams)}, ô tìm kiếm dò trong {@code searchFields}. */
    public static <T extends CatalogEntity> Specification<T> from(ListParams params, List<String> searchFields) {
        List<Specification<T>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<T> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion);
                case "code" -> textSpec("code", criterion);
                case "name" -> textSpec("name", criterion);
                case "note" -> textSpec("note", criterion);
                case "active" -> activeSpec(criterion);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }

        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            var byText = cb.or(searchFields.stream()
                    .map(field -> ListParams.foldedLike(cb, root.get(field), term))
                    .toArray(Predicate[]::new));
            Long id = parseLong(term);
            return id == null ? byText : cb.or(byText, cb.equal(root.get("id"), id));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static <T> Specification<T> idSpec(ListParams.Criterion criterion) {
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

    private static <T> Specification<T> textSpec(String attribute, ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    cb.like(cb.lower(root.get(attribute)), ListParams.likePattern(value));
            case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), value);
            default -> (root, query, cb) -> cb.equal(root.get(attribute), value);
        };
    }

    /** Chuỗi không phải true/false là câu hỏi hợp lệ với câu trả lời rỗng. */
    private static <T> Specification<T> activeSpec(ListParams.Criterion criterion) {
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

    /**
     * {@code <tham chiếu>.id = n} (hoặc {@code _ne}) cho một tham chiếu to-one,
     * dùng cho {@code extraFilters} của lớp con.
     *
     * <p>{@code LEFT} join tường minh: với tham chiếu cho phép rỗng, một
     * {@code INNER} join sẽ lặng lẽ loại luôn những dòng chưa gán khỏi truy vấn.
     */
    public static <T> Specification<T> referenceFilter(
            ListParams params, String attribute) {
        List<Specification<T>> specs = new ArrayList<>();
        for (ListParams.Criterion criterion : params.filters()) {
            if (!criterion.field().equals(attribute + ".id")
                    && !criterion.field().equals(attribute + "Id")) {
                continue;
            }
            // "none" = chưa gán (vd. tài sản chưa xếp phòng) — cùng quy ước với schoolBody, catalogType.
            if ("none".equals(criterion.value() == null ? null : criterion.value().trim())) {
                specs.add((root, query, cb) -> cb.isNull(root.get(attribute)));
                continue;
            }
            Long id = parseLong(criterion.value());
            if (id == null) {
                specs.add(never());
            } else if (criterion.operator() == ListParams.Operator.NE) {
                specs.add((root, query, cb) -> cb.notEqual(
                        root.join(attribute, jakarta.persistence.criteria.JoinType.LEFT).get("id"), id));
            } else {
                specs.add((root, query, cb) -> cb.equal(
                        root.join(attribute, jakarta.persistence.criteria.JoinType.LEFT).get("id"), id));
            }
        }
        return Specification.allOf(specs);
    }

    private static <T> Specification<T> never() {
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
