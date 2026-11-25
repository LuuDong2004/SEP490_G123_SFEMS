package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.module.school.voucher.VoucherSpecs;
import com.g123.sfems.shared.web.ListParams;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Query string của danh sách phiếu nhập, dịch thành {@link Specification}.
 *
 * <p>Trường lạ thì bỏ qua chứ không từ chối, như mọi danh sách khác ở nền này:
 * một ô lọc mới ở frontend thoái hoá thành "không thu hẹp" thay vì làm trắng
 * bảng bằng lỗi 400.
 */
final class EquipmentIntakeSpecifications {

    private EquipmentIntakeSpecifications() {
    }

    static Specification<EquipmentIntake> from(ListParams params) {
        List<Specification<EquipmentIntake>> specs = new ArrayList<>();

        for (ListParams.Criterion criterion : params.filters()) {
            Specification<EquipmentIntake> spec = VoucherSpecs.common(criterion);
            if (spec == null) {
                spec = switch (criterion.field()) {
                    case "documentNo" -> VoucherSpecs.text("documentNo", criterion);
                    case "supplier" -> VoucherSpecs.text("supplier", criterion);
                    case "intakeDate" -> VoucherSpecs.date("intakeDate", criterion);
                    default -> null;
                };
            }
            if (spec != null) {
                specs.add(spec);
            }
        }

        params.search().ifPresent(term -> specs.add((root, query, cb) -> {
            return cb.or(
                    ListParams.foldedLike(cb, root.get("code"), term),
                    ListParams.foldedLike(cb, root.get("documentNo"), term),
                    ListParams.foldedLike(cb, root.get("supplier"), term));
        }));

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            specs.add((root, query, cb) -> root.get("id").in(ids));
        }

        return Specification.allOf(specs);
    }
}
