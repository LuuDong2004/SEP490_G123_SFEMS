package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.school.voucher.ApprovalStep;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.web.ListParams;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.springframework.data.jpa.domain.Specification;

/**
 * Các mảnh bộ lọc mọi danh sách phiếu đều cần: chữ, trạng thái, bước duyệt, ngày. Mỗi loại phiếu ghép
 * chúng với các trường riêng của nó trong {@code filters(params)}.
 *
 * <p>Giá trị không đọc được (một trạng thái lạ, một ngày sai định dạng) là một câu hỏi hợp lệ có câu
 * trả lời rỗng, không phải lỗi 400.
 */
public final class VoucherSpecs {

    private VoucherSpecs() {
    }

    /** Bộ lọc chung của mọi phiếu, hoặc {@code null} nếu trường lọc là trường riêng của loại phiếu. */
    public static <T> Specification<T> common(ListParams.Criterion criterion) {
        return switch (criterion.field()) {
            case "code" -> text("code", criterion);
            case "status" -> status(criterion);
            case "approvalStep" -> step(criterion);
            default -> null;
        };
    }

    public static <T> Specification<T> text(String attribute, ListParams.Criterion criterion) {
        String value = criterion.value();
        return switch (criterion.operator()) {
            case LIKE -> (root, query, cb) ->
                    cb.like(cb.lower(root.get(attribute)), ListParams.likePattern(value));
            case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), value);
            default -> (root, query, cb) -> cb.equal(root.get(attribute), value);
        };
    }

    public static <T> Specification<T> status(ListParams.Criterion criterion) {
        VoucherStatus status;
        try {
            status = VoucherStatus.valueOf(criterion.value().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return never();
        }
        return criterion.operator() == ListParams.Operator.NE
                ? (root, query, cb) -> cb.notEqual(root.get("status"), status)
                : (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    public static <T> Specification<T> step(ListParams.Criterion criterion) {
        ApprovalStep step;
        try {
            step = ApprovalStep.valueOf(criterion.value().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return never();
        }
        return (root, query, cb) -> cb.equal(root.get("approvalStep"), step);
    }

    public static <T> Specification<T> date(String attribute, ListParams.Criterion criterion) {
        LocalDate value;
        try {
            value = LocalDate.parse(criterion.value().trim());
        } catch (DateTimeParseException e) {
            return never();
        }
        return switch (criterion.operator()) {
            case GTE -> (root, query, cb) -> cb.greaterThanOrEqualTo(root.get(attribute), value);
            case LTE -> (root, query, cb) -> cb.lessThanOrEqualTo(root.get(attribute), value);
            case NE -> (root, query, cb) -> cb.notEqual(root.get(attribute), value);
            default -> (root, query, cb) -> cb.equal(root.get(attribute), value);
        };
    }

    public static <T> Specification<T> never() {
        return (root, query, cb) -> cb.disjunction();
    }

    /** {@code ?awaiting=me}: chỉ phiếu đang chờ chính người gọi duyệt. */
    public static boolean awaitingMe(ListParams params) {
        return params.filters().stream()
                .anyMatch(c -> c.field().equals("awaiting") && "me".equalsIgnoreCase(c.value()));
    }
}
