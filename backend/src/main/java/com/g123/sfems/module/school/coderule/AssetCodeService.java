package com.g123.sfems.module.school.coderule;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.coderule.SchoolCodeRule;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import com.g123.sfems.shared.exception.FieldValidationException;
import jakarta.persistence.EntityManager;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sinh mã tài sản {@code TT.TR.MH.LT.ST.NC} theo quy tắc của trường (TS-06), và khai số bắt đầu của
 * phần ST (TS-05).
 *
 * <p><b>Đếm riêng theo bộ {@code TT.TR.MH.LT.NC}.</b> ST chỉ đếm trong cùng bộ: cùng trường, cùng môn,
 * cùng loại vật lý/số, cùng năm cấp. Mỗi bộ có tối đa {@value #MAX_NUMBER} mã, nên trường không bị chặn
 * toàn cục sau 999 tài sản.
 *
 * <p>Số kế tiếp trong bộ = {@code max(số đã cấp trong bộ + 1, số bắt đầu)}. Số bắt đầu là sàn áp cho
 * mọi bộ: đặt nhỏ hơn số đã cấp thì không đảo ngược được, mã vẫn nối tiếp mã cuối.
 *
 * <p>Độ dài ST cố định 3 chữ số theo {@link Equipment#STANDARD_CODE}, nên quy tắc của trường chỉ chỉnh
 * được số bắt đầu, không chỉnh tiền tố hay độ dài.
 */
@Service
public class AssetCodeService {

    /** Tên {@code target} của quy tắc mã tài sản trong {@code school_code_rules}. */
    public static final String TARGET = "equipment";

    /** TT. Chưa có cột nào lưu mã tỉnh; mọi trường trong đồ án thuộc TP.HCM. */
    private static final String PROVINCE = "79";

    /** ST có đúng 3 chữ số: tối đa 999 mã trong một bộ. */
    public static final int MAX_NUMBER = 999;

    private final EntityManager entityManager;
    private final SchoolCodeRuleRepository rules;

    public AssetCodeService(EntityManager entityManager, SchoolCodeRuleRepository rules) {
        this.entityManager = entityManager;
        this.rules = rules;
    }

    /**
     * Mở một lượt cấp mã cho MỘT bộ {@code TT.TR.MH.LT.NC} của thiết bị này.
     *
     * <p>Khoá trường đến hết giao dịch để hai lần cấp cùng lúc xếp hàng, thay vì cùng đọc một số rồi vấp
     * unique {@code (school_id, code)}. {@code NO KEY UPDATE} không chặn các lệnh chỉ cần khoá ngoại tới
     * trường.
     */
    @Transactional
    public Batch begin(School school, EquipmentCatalog catalog, PhysicalDigitalType type, int year) {
        requireIssuable(school, catalog, "catalog");
        if (type == null) {
            throw new FieldValidationException("physicalOrDigital", "Chọn loại vật lý hay số để cấp mã");
        }
        entityManager.createNativeQuery("SELECT id FROM schools WHERE id = :id FOR NO KEY UPDATE")
                .setParameter("id", school.getId())
                .getSingleResult();
        Bo bo = new Bo(school, catalog, type, year);
        return new Batch(school, bo, nextNumber(school.getId(), bo));
    }

    /**
     * Còn cấp được bao nhiêu mã trong bộ này. Dùng để báo sớm (lúc trình phiếu) mà không cần ghi tăng.
     */
    @Transactional(readOnly = true)
    public int remaining(School school, EquipmentCatalog catalog, PhysicalDigitalType type, int year) {
        if (missing(school, catalog).isPresent()) {
            return 0;
        }
        Bo bo = new Bo(school, catalog, type, year);
        return Math.max(0, MAX_NUMBER - nextNumber(school.getId(), bo) + 1);
    }

    /** Quy tắc đang khai của trường: số bắt đầu của phần ST, áp cho mọi bộ. */
    @Transactional(readOnly = true)
    public EquipmentRule view(School school) {
        return new EquipmentRule(startNumber(school.getId()));
    }

    /** Khai số bắt đầu của phần ST. Dòng quy tắc được tạo khi lưu lần đầu. */
    @Transactional
    public EquipmentRule setStartNumber(School school, Integer startNumber) {
        if (startNumber == null || startNumber < 1 || startNumber > MAX_NUMBER) {
            throw new FieldValidationException("startNumber",
                    "Số bắt đầu phải từ 1 đến " + MAX_NUMBER + " (phần ST của mã có 3 chữ số)");
        }
        SchoolCodeRule rule = rules.findBySchoolIdAndTarget(school.getId(), TARGET).orElseGet(() -> {
            SchoolCodeRule created = new SchoolCodeRule();
            created.setSchool(school);
            created.setTarget(TARGET);
            return created;
        });
        rule.setStartNumber(startNumber);
        rules.saveAndFlush(rule);
        return view(school);
    }

    /**
     * Mã kế tiếp của bộ, KHÔNG tăng bộ đếm — cho ô "Mã sẽ cấp" của form. Rỗng khi bộ đã hết 999 số, hoặc
     * thiếu dữ liệu để cấp (xem {@link #missing}).
     */
    @Transactional(readOnly = true)
    public Optional<String> peek(School school, EquipmentCatalog catalog, PhysicalDigitalType type, int year) {
        if (missing(school, catalog).isPresent()) {
            return Optional.empty();
        }
        Bo bo = new Bo(school, catalog, type, year);
        int next = nextNumber(school.getId(), bo);
        return next > MAX_NUMBER ? Optional.empty() : Optional.of(bo.format(next));
    }

    /** Lý do không cấp được mã cho nhóm này ở trường này, rỗng nếu đủ dữ liệu. */
    public Optional<String> missing(School school, EquipmentCatalog catalog) {
        if (school.getShortCode() == null || school.getShortCode().isBlank()) {
            return Optional.of("trường chưa có mã viết tắt");
        }
        Subject subject = catalog.getSubject();
        if (subject == null) {
            return Optional.of("nhóm thiết bị \"" + catalog.getName() + "\" chưa gắn môn học");
        }
        String teaching = subject.getTeachingCode();
        if (teaching == null || !teaching.matches("\\d{2}")) {
            return Optional.of("môn \"" + subject.getName() + "\" chưa có mã dạy học 2 chữ số");
        }
        return Optional.empty();
    }

    /** Kiểm trường và nhóm thiết bị đủ dữ liệu để cấp mã. */
    private void requireIssuable(School school, EquipmentCatalog catalog, String field) {
        missing(school, catalog).ifPresent(reason -> {
            throw new FieldValidationException(field, "Chưa cấp được mã tài sản: " + reason);
        });
    }

    private int startNumber(Long schoolId) {
        return rules.findBySchoolIdAndTarget(schoolId, TARGET)
                .map(SchoolCodeRule::getStartNumber)
                .orElse(1);
    }

    /** Số kế tiếp trong bộ: lớn hơn số đã cấp trong bộ và không nhỏ hơn số bắt đầu. */
    private int nextNumber(Long schoolId, Bo bo) {
        return Math.max(startNumber(schoolId), lastIssued(schoolId, bo).orElse(0) + 1);
    }

    /** Số ST lớn nhất đã cấp trong đúng bộ {@code TT.TR.MH.LT.NC}, rỗng nếu bộ chưa có mã nào. */
    private Optional<Integer> lastIssued(Long schoolId, Bo bo) {
        Number last = (Number) entityManager.createNativeQuery(
                        "SELECT MAX(CAST(split_part(code, '.', 5) AS integer)) FROM equipment"
                                + " WHERE school_id = :id AND code ~ :pattern"
                                + " AND split_part(code, '.', 1) || '.' || split_part(code, '.', 2) || '.'"
                                + " || split_part(code, '.', 3) || '.' || split_part(code, '.', 4) || '.'"
                                + " || split_part(code, '.', 6) = :bo")
                .setParameter("id", schoolId)
                .setParameter("pattern", Equipment.STANDARD_CODE.pattern())
                .setParameter("bo", bo.key())
                .getSingleResult();
        return Optional.ofNullable(last).map(Number::intValue);
    }

    /** Quy tắc đọc được: số bắt đầu của phần ST. */
    public record EquipmentRule(int startNumber) {
    }

    /** Bộ đếm {@code TT.TR.MH.LT.NC}: các thành phần của mã trừ ST. */
    private record Bo(String province, String school, String subject, String type, String year) {

        Bo(School school, EquipmentCatalog catalog, PhysicalDigitalType type, int year) {
            this(PROVINCE,
                    school.getShortCode().toUpperCase(),
                    catalog.getSubject().getTeachingCode(),
                    kind(type),
                    String.format("%02d", year % 100));
        }

        String key() {
            return province + "." + school + "." + subject + "." + type + "." + year;
        }

        String format(int number) {
            return province + "." + school + "." + subject + "." + type + "."
                    + String.format("%03d", number) + "." + year;
        }

        private static String kind(PhysicalDigitalType type) {
            if (type == null) {
                throw new FieldValidationException("physicalOrDigital", "Chọn loại vật lý hay số để cấp mã");
            }
            return switch (type) {
                case PHYSICAL -> "TB";
                case DIGITAL -> "PM";
                case LEARNING_SUPPORT -> "HL";
            };
        }
    }

    /** Một lượt cấp mã trong một bộ; mỗi {@link #next} trả mã kế tiếp và không trùng trong lượt. */
    public final class Batch {

        private final School school;
        private final Bo bo;
        private int number;

        private Batch(School school, Bo bo, int number) {
            this.school = school;
            this.bo = bo;
            this.number = number;
        }

        public String next() {
            if (number > MAX_NUMBER) {
                throw new FieldValidationException("code", "Bộ mã " + bo.key() + " đã dùng hết số thứ tự (tối đa "
                        + MAX_NUMBER + ")");
            }
            String code = bo.format(number);
            if (!Equipment.STANDARD_CODE.matcher(code).matches()) {
                throw new FieldValidationException("code", "Mã tài sản " + code + " không đúng chuẩn");
            }
            number++;
            return code;
        }
    }
}
