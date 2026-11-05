package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.shared.exception.FieldValidationException;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Cấp mã tài sản {@code TT.TR.MH.LT.ST.NC} cho thiết bị sinh ra từ phiếu nhập, theo đúng cách dữ liệu
 * mẫu (changelog 012) đang tính. Sinh mã dùng chung là TS-06; khi có thì thay lớp này, phần ghi tăng
 * chỉ gọi {@link #requireIssuable} và {@link #begin}.
 */
@Component
public class AssetCodeIssuer {

    /** TT. Chưa có cột nào lưu mã tỉnh; mọi trường trong đồ án thuộc TP.HCM. */
    private static final String PROVINCE = "79";

    /** ST có đúng 3 chữ số theo {@link Equipment#STANDARD_CODE}. */
    private static final int MAX_NUMBER = 999;

    private final EntityManager entityManager;

    public AssetCodeIssuer(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /** Báo sớm lúc trình: dữ liệu danh mục thiếu thì tới bước duyệt cũng không cấp được mã. */
    public void requireIssuable(School school, EquipmentCatalog catalog, String field) {
        if (school.getShortCode() == null || school.getShortCode().isBlank()) {
            throw new FieldValidationException(field, "Trường chưa có mã viết tắt, chưa cấp được mã tài sản");
        }
        Subject subject = catalog.getSubject();
        if (subject == null || subject.getSortOrder() == null) {
            throw new FieldValidationException(field,
                    "Nhóm thiết bị \"" + catalog.getName() + "\" chưa gắn môn học, chưa cấp được mã tài sản");
        }
    }

    /**
     * Mở một lượt cấp mã, khoá trường đến hết giao dịch: ST lấy từ dữ liệu đang có nên hai phiếu duyệt
     * cùng lúc phải xếp hàng, không thì cùng đọc một số rồi vấp unique {@code (school_id, code)}.
     * {@code NO KEY UPDATE} để không chặn các lệnh chỉ cần khoá ngoại tới trường.
     */
    public Batch begin(School school) {
        entityManager.createNativeQuery("SELECT id FROM schools WHERE id = :id FOR NO KEY UPDATE")
                .setParameter("id", school.getId())
                .getSingleResult();
        Number last = (Number) entityManager.createNativeQuery(
                        "SELECT COALESCE(MAX(CAST(split_part(code, '.', 5) AS integer)), 0) FROM equipment"
                                + " WHERE school_id = :id AND code ~ :pattern")
                .setParameter("id", school.getId())
                .setParameter("pattern", Equipment.STANDARD_CODE.pattern())
                .getSingleResult();
        List<?> start = entityManager.createNativeQuery(
                        "SELECT start_number FROM school_code_rules WHERE school_id = :id AND target = 'equipment'")
                .setParameter("id", school.getId())
                .getResultList();
        int first = start.isEmpty() ? 1 : ((Number) start.get(0)).intValue();
        return new Batch(school, Math.max(last.intValue() + 1, first));
    }

    /** Một lượt cấp mã của một trường. */
    public final class Batch {

        private final School school;
        private int number;

        private Batch(School school, int number) {
            this.school = school;
            this.number = number;
        }

        public String next(EquipmentCatalog catalog, PhysicalDigitalType type, int year) {
            requireIssuable(school, catalog, "lines");
            if (number > MAX_NUMBER) {
                throw new FieldValidationException("lines", "Trường đã dùng hết số thứ tự của mã tài sản (tối đa "
                        + MAX_NUMBER + ")");
            }
            String code = String.format("%s.%s.%02d.%s.%03d.%02d", PROVINCE, school.getShortCode().toUpperCase(),
                    catalog.getSubject().getSortOrder() / 10, kind(type), number, year % 100);
            if (!Equipment.STANDARD_CODE.matcher(code).matches()) {
                throw new FieldValidationException("lines", "Mã tài sản " + code + " không đúng chuẩn");
            }
            number++;
            return code;
        }

        private static String kind(PhysicalDigitalType type) {
            return switch (type) {
                case PHYSICAL -> "TB";
                case DIGITAL -> "PM";
                case LEARNING_SUPPORT -> "HL";
            };
        }
    }
}
