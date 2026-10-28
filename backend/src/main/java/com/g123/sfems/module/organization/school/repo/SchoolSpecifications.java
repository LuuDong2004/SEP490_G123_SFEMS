package com.g123.sfems.module.organization.school.repo;

import com.g123.sfems.domain.organization.OrgStatus;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.criteria.JoinType;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Dịch query string đã phân tích thành {@link Specification}.
 *
 * <p>Hai bộ lọc theo tham chiếu — {@code departmentOfEducation.id} và
 * {@code educationLevel.id} — là thứ màn chi tiết Sở và ô lọc "cấp học" gửi
 * lên. Chúng dùng {@code LEFT} join: với {@code educationLevel} (cho phép
 * rỗng), một {@code INNER} join sẽ lặng lẽ loại luôn những trường chưa gán cấp
 * học khỏi MỌI truy vấn có bộ lọc đó — kể cả khi bộ lọc đang hỏi một chuyện
 * khác. Đây đúng là cái bẫy inner-vs-left mà engine phân quyền dòng tránh được
 * bằng cách sinh {@code EXISTS}; ở đây thì phải tự chọn cho đúng.
 */
public final class SchoolSpecifications {

    private SchoolSpecifications() {
    }

    public static Specification<School> from(ListParams params) {
        List<Specification<School>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<School> spec = switch (criterion.field()) {
                case "id" -> idSpec(criterion);
                case "code" -> textSpec("code", criterion);
                case "name" -> textSpec("name", criterion);
                case "shortCode" -> textSpec("shortCode", criterion);
                case "moetCode" -> textSpec("moetCode", criterion);
                case "ward", "ward.id", "wardId" -> referenceSpec("ward", criterion);
                case "wardText" -> textSpec("wardText", criterion);
                case "district" -> textSpec("district", criterion);
                case "address" -> textSpec("address", criterion);
                case "status" -> statusSpec(criterion);
                case "departmentOfEducation.id", "departmentOfEducationId" ->
                        referenceSpec("departmentOfEducation", criterion);
                case "educationLevel.id", "educationLevelId" ->
                        referenceSpec("educationLevel", criterion);
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
                    // Tên phường nằm ở bảng danh mục, nên tìm nhanh phải đi
                    // qua join. LEFT vì trường chưa gán địa bàn vẫn phải tìm
                    // được bằng mã hoặc tên của chính nó.
                    ListParams.foldedLike(cb,
                            root.join("ward", jakarta.persistence.criteria.JoinType.LEFT).get("name"), term),
                    ListParams.foldedLike(cb, root.get("wardText"), term));
            Long id = parseLong(term);
            return id == null ? byText : cb.or(byText, cb.equal(root.get("id"), id));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }

    private static Specification<School> referenceSpec(
            String attribute, ListParams.Criterion criterion) {
        // "null" là một GIÁ TRỊ hỏi được, không phải một tham số hỏng: cơ quan
        // quản lý được phép rỗng, và "trường nào chưa xác định cơ quan quản
        // lý" là câu hỏi cả cây tổng quan lẫn người đi đối soát đều hỏi.
        // Không có nó thì nhánh "Chưa xác định" không lấy được danh sách.
        if ("null".equalsIgnoreCase(criterion.value())) {
            return switch (criterion.operator()) {
                case NE -> (root, query, cb) -> cb.isNotNull(root.get(attribute));
                default -> (root, query, cb) -> cb.isNull(root.get(attribute));
            };
        }
        Long id = parseLong(criterion.value());
        if (id == null) {
            return never();
        }
        return switch (criterion.operator()) {
            case NE -> (root, query, cb) ->
                    cb.notEqual(root.join(attribute, JoinType.LEFT).get("id"), id);
            default -> (root, query, cb) ->
                    cb.equal(root.join(attribute, JoinType.LEFT).get("id"), id);
        };
    }

    private static Specification<School> idSpec(ListParams.Criterion criterion) {
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

    private static Specification<School> textSpec(String attribute, ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    cb.like(cb.lower(root.get(attribute)), ListParams.likePattern(value));
            case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), value);
            default -> (root, query, cb) -> cb.equal(root.get(attribute), value);
        };
    }

    private static Specification<School> statusSpec(ListParams.Criterion criterion) {
        OrgStatus status;
        try {
            status = OrgStatus.from(criterion.value());
        } catch (IllegalArgumentException e) {
            return never();
        }
        if (status == null) {
            return null;
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("status"), status)
                : (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    /** Vị từ không dòng nào thoả — giá trị lọc không khớp được với gì cả. */
    private static Specification<School> never() {
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
