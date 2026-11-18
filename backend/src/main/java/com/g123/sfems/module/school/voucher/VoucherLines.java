package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.catalog.unit.Unit;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.voucher.VoucherEquipmentLine;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.equipment.EquipmentLifecycle;
import com.g123.sfems.module.school.equipment.EquipmentService;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;

/**
 * Luật chung của các dòng phiếu trỏ tới tài sản: tài sản phải đọc được, thuộc
 * đúng trường của phiếu, không lặp lại trong phiếu, và đang ở trạng thái mà
 * phiếu được phép động tới.
 *
 * <p>Câu từ chối nêu đúng dòng và đúng mã tài sản — "dòng 3 (79.T6.00.TB.02.26)
 * đang cho mượn" — để người lập biết bỏ dòng nào.
 */
@Component
public class VoucherLines {

    /** Một dòng trong payload: tài sản nào, ghi chú gì. */
    public record LineInput(IdRef equipment,
            @Text(value = FieldRule.NOTE, label = "Ghi chú", max = 255) String note,
            java.util.Map<String, Object> details) {

        public LineInput(IdRef equipment, String note) {
            this(equipment, note, null);
        }
    }

    private final EquipmentService equipment;

    public VoucherLines(EquipmentService equipment) {
        this.equipment = equipment;
    }

    /** Nạp tài sản của một dòng, theo phạm vi đọc của người lập, và bắt buộc cùng trường. */
    public Equipment load(IdRef ref, School school, int lineNo) {
        if (ref == null || ref.id() == null) {
            throw new FieldValidationException("lines", "Dòng %d: chưa chọn thiết bị".formatted(lineNo));
        }
        Equipment item = equipment.getAcrossCampuses(ref.id());
        if (!item.getSchool().getId().equals(school.getId())) {
            throw new FieldValidationException("lines",
                    "Dòng %d (%s): thiết bị không thuộc trường của phiếu".formatted(lineNo, item.getCode()));
        }
        return item;
    }

    /** Không có tài sản nào lặp lại trong một phiếu. */
    public static void requireDistinct(List<? extends VoucherEquipmentLine> lines) {
        Set<Long> seen = new HashSet<>();
        for (VoucherEquipmentLine line : lines) {
            if (!seen.add(line.getEquipment().getId())) {
                throw new FieldValidationException("lines",
                        "Thiết bị %s xuất hiện hai lần trong phiếu".formatted(line.getEquipment().getCode()));
            }
        }
    }

    public static void requireNotEmpty(List<?> lines) {
        if (lines.isEmpty()) {
            throw new FieldValidationException("lines", "Phiếu chưa có thiết bị nào");
        }
    }

    /**
     * Tài sản của mỗi dòng phải ở một trong các trạng thái cho phép. Kiểm lúc trình
     * VÀ lúc duyệt cuối — giữa hai lúc đó tài sản có thể đã bị phiếu khác động tới.
     */
    /**
     * Số lượng bàn giao của một dòng (cấp phát, điều chuyển): lớn hơn 0, tối đa 3 chữ số thập phân, hợp đơn vị (đơn
     * vị không chia lẻ thì số nguyên), không vượt số đang có; tài sản quản lý từng cái thì phải đi nguyên. Trống mà
     * {@code required} thì báo thiếu; không bắt buộc thì bỏ qua (hiểu là cả lô).
     */
    public static void requireLotQuantity(Integer lineNo, Equipment item, BigDecimal amount, boolean required) {
        if (amount == null) {
            if (required) {
                throw new FieldValidationException("lines", "Dòng %d (%s): nhập số lượng bàn giao"
                        .formatted(lineNo, item.getCode()));
            }
            return;
        }
        if (amount.signum() <= 0 || amount.scale() > 3) {
            throw new FieldValidationException("lines", "Dòng %d (%s): số lượng phải lớn hơn 0 và tối đa 3 chữ số thập phân"
                    .formatted(lineNo, item.getCode()));
        }
        Unit unit = item.getUnit() != null ? item.getUnit() : item.getCatalog().getUnit();
        if (!Unit.accepts(unit, amount)) {
            throw new FieldValidationException("lines", "Dòng %d (%s): đơn vị %s không cho phép số lẻ"
                    .formatted(lineNo, item.getCode(), unit == null ? "chưa khai" : unit.getName()));
        }
        if (item.getCatalog().getTrackingType() != TrackingType.BULK
                && amount.compareTo(item.getQuantity()) != 0) {
            throw new FieldValidationException("lines", "Dòng %d (%s): thiết bị quản lý từng chiếc phải bàn giao toàn bộ"
                    .formatted(lineNo, item.getCode()));
        }
        if (amount.compareTo(item.getQuantity()) > 0) {
            throw new FieldValidationException("lines", "Dòng %d (%s): chỉ còn %s %s, không đủ %s"
                    .formatted(lineNo, item.getCode(), item.getQuantity().stripTrailingZeros().toPlainString(),
                            unit == null ? "" : unit.getName(), amount.stripTrailingZeros().toPlainString()));
        }
    }

    public static void requireStatus(List<? extends VoucherEquipmentLine> lines, Set<AssetStatus> allowed,
            String what) {
        requireStandardProfile(lines);
        for (VoucherEquipmentLine line : lines) {
            AssetStatus status = line.getEquipment().getStatus();
            if (!allowed.contains(status)) {
                throw new FieldValidationException("lines",
                        "Dòng %d (%s) đang ở trạng thái \"%s\" nên không %s được — chỉ %s được thiết bị ở trạng thái: %s".formatted(
                                line.getLineNo(), line.getEquipment().getCode(),
                                EquipmentLifecycle.statusLabel(status), what, what,
                                allowed.stream().map(EquipmentLifecycle::statusLabel)
                                        .collect(Collectors.joining(", "))));
            }
        }
    }

    /**
     * Chỉ tài sản có hồ sơ CHUẨN mới phát sinh nghiệp vụ: mã theo chuẩn của Sở, đơn vị
     * tính, nguồn kinh phí, ngày tiếp nhận, nguyên giá ({@code Equipment.missingProfile}).
     * Đi qua {@link #requireStatus}, nên mọi phiếu làm đổi tài sản đều kiểm — lúc trình
     * và lúc duyệt cuối. Kiểm kê không đi qua đây: nó phải đếm được cả tài sản chưa chuẩn.
     */
    public static void requireStandardProfile(List<? extends VoucherEquipmentLine> lines) {
        List<String> problems = new java.util.ArrayList<>();
        for (VoucherEquipmentLine line : lines) {
            List<String> missing = line.getEquipment().missingProfile();
            if (!missing.isEmpty()) {
                problems.add("dòng %d (%s) thiếu %s".formatted(line.getLineNo(), line.getEquipment().getCode(),
                        String.join(", ", missing)));
            }
        }
        if (!problems.isEmpty()) {
            throw new FieldValidationException("lines", "Hồ sơ thiết bị chưa chuẩn, chưa lập phiếu được: "
                    + String.join("; ", problems) + ". Hoàn thiện hồ sơ thiết bị trước.");
        }
    }
}
