package com.g123.sfems.module.school.equipment;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.PhysicalDigitalType;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sinh mã định danh thiết bị dạy học theo chuẩn {@code TT.TR.MH.LT.ST.NC} của
 * Sở — cùng quy tắc với {@code TeachingEquipmentCodeService} bản Jmix:
 *
 * <ul>
 *   <li>TT — mã tỉnh/thành ({@code qltb.equipment-code.province}, mặc định 79 = TP.HCM)</li>
 *   <li>TR — mã EMIS 2 ký tự của trường</li>
 *   <li>MH — mã môn dạy học của môn gắn với nhóm thiết bị; nhóm không gắn môn → 00</li>
 *   <li>LT — TB (vật lý), PM (thiết bị số / phần mềm), HL (hệ thống hỗ trợ học tập)</li>
 *   <li>ST — số thứ tự 0001..9999 (bốn chữ số), đếm riêng theo từng bộ TT.TR.MH.LT.NC trong trường</li>
 *   <li>NC — 2 số cuối năm cấp phát: ngày tiếp nhận, không có thì ngày mua, không có nữa thì năm nay</li>
 * </ul>
 *
 * <p>Ví dụ {@code 79.A1.08.PM.02.25}. Thiếu thành phần nào (trường chưa có mã
 * EMIS, môn chưa có mã dạy học) thì KHÔNG sinh mã — người dùng nhập tay.
 *
 * <p>Bộ đếm: một lệnh {@code INSERT ... ON CONFLICT DO UPDATE ... RETURNING}
 * trên {@code equipment_code_sequences} — database khoá dòng đếm, hai người lưu
 * cùng lúc nhận hai số khác nhau, không cần thử lại như bản Jmix.
 */
@Service
public class EquipmentCodeService {

    private static final Pattern TWO_DIGITS = Pattern.compile("\\d{2}");
    private static final Pattern SCHOOL_CODE = Pattern.compile("[A-Z0-9]{2}");
    private static final String SHARED_SUBJECT = "00";
    /** Bốn chữ số: 9.999 tài sản một bộ đếm một năm — trường lớn có hơn 999 bàn ghế quản lý từng cái. */
    private static final int LAST_SEQUENCE = 9999;

    private final JdbcTemplate jdbc;
    private final String province;

    public EquipmentCodeService(
            JdbcTemplate jdbc, @Value("${qltb.equipment-code.province:79}") String province) {
        this.jdbc = jdbc;
        this.province = province.trim();
    }

    /** Các thành phần của mã; {@code counterKey} = TT.TR.MH.LT.NC. */
    public record CodeParts(String province, String school, String subject, String type, String year) {

        String counterKey() {
            return province + "." + school + "." + subject + "." + type + "." + year;
        }

        String format(int number) {
            return province + "." + school + "." + subject + "." + type + "."
                    + String.format("%04d", number) + "." + year;
        }

        /** Bộ mã như người dùng nhìn thấy, số thứ tự để trống: {@code 79.JP.00.TB.xx.26}. */
        String mask() {
            return province + "." + school + "." + subject + "." + type + ".xxx." + year;
        }
    }

    /** Các thành phần, hoặc rỗng khi thiếu dữ liệu để sinh mã. */
    public Optional<CodeParts> parts(
            School school, EquipmentCatalog catalog, PhysicalDigitalType type,
            LocalDate receivedDate, LocalDate purchaseDate) {
        if (school == null || catalog == null || !TWO_DIGITS.matcher(province).matches()) {
            return Optional.empty();
        }
        // Mã hai ký tự của trường — thành phần TR. Không phải mã định danh
        // 20 ký tự của Bộ GD&ĐT (`moetCode`), vốn dùng để liên thông CSDL
        // ngành chứ không để dựng mã tài sản.
        String schoolCode = normalized(school.getShortCode());
        if (!SCHOOL_CODE.matcher(schoolCode).matches()) {
            return Optional.empty();
        }
        Subject subject = catalog.getSubject();
        String subjectCode = subject == null ? SHARED_SUBJECT : normalized(subject.getTeachingCode());
        if (!TWO_DIGITS.matcher(subjectCode).matches()) {
            return Optional.empty();
        }
        LocalDate date = receivedDate != null ? receivedDate
                : purchaseDate != null ? purchaseDate
                : LocalDate.now();
        return Optional.of(new CodeParts(province, schoolCode, subjectCode, typeCode(type),
                String.format("%02d", date.getYear() % 100)));
    }

    /** Mã kế tiếp, KHÔNG tăng bộ đếm. Rỗng khi thiếu dữ liệu hoặc đã hết 99 số. */
    @Transactional(readOnly = true)
    public Optional<String> peek(School school, CodeParts parts) {
        int next = used(school, parts) + 1;
        return next > LAST_SEQUENCE ? Optional.empty() : Optional.of(parts.format(next));
    }

    /**
     * Còn cấp được bao nhiêu mã cho bộ đếm này.
     *
     * <p>Có để hỏi TRƯỚC khi ghi tăng, chứ không để hết số rồi mới biết. Thành
     * phần ST chỉ có hai chữ số nên mỗi bộ {@code TT.TR.MH.LT.NC} chỉ chứa 99
     * tài sản — và vì MH lấy theo MÔN của nhóm thiết bị, mọi nhóm chưa gắn môn
     * đều dùng chung {@code 00}, tức là chung một bộ đếm. Một phiếu nhập 100 máy
     * phải bị từ chối lúc TRÌNH, khi người lập còn sửa được, chứ không phải lúc
     * lãnh đạo bấm duyệt.
     */
    @Transactional(readOnly = true)
    public int remaining(School school, CodeParts parts) {
        return Math.max(0, LAST_SEQUENCE - used(school, parts));
    }

    private int used(School school, CodeParts parts) {
        List<Integer> rows = jdbc.queryForList(
                "SELECT current_number FROM equipment_code_sequences WHERE school_id = ? AND code_prefix = ?",
                Integer.class, school.getId(), parts.counterKey());
        return rows.isEmpty() ? 0 : rows.getFirst();
    }

    /** Chốt số kế tiếp trong transaction của người gọi. Rỗng khi đã hết 99 số. */
    @Transactional
    public Optional<String> reserve(School school, CodeParts parts) {
        Integer next = jdbc.queryForObject(
                "INSERT INTO equipment_code_sequences (school_id, code_prefix, current_number)"
                        + " VALUES (?, ?, 1)"
                        + " ON CONFLICT (school_id, code_prefix)"
                        + " DO UPDATE SET current_number = equipment_code_sequences.current_number + 1"
                        + " RETURNING current_number",
                Integer.class, school.getId(), parts.counterKey());
        return next == null || next > LAST_SEQUENCE ? Optional.empty() : Optional.of(parts.format(next));
    }

    /**
     * Chốt {@code count} số liền nhau trong MỘT câu (cộng bộ đếm một lần, nhận số cuối) — cho một dòng
     * phiếu nhập sinh hàng trăm tài sản cùng bộ mã. Gọi {@link #reserve} từng cái là mỗi tài sản một
     * lượt đi về, và dòng bộ đếm bị khoá suốt cả loạt. Rỗng khi khối số vượt quá 9999 (người gọi
     * từ chối, giao dịch lùi lại nên bộ đếm không nhảy).
     */
    @Transactional
    public Optional<List<String>> reserveBlock(School school, CodeParts parts, int count) {
        if (count <= 0) {
            return Optional.of(List.of());
        }
        Integer last = jdbc.queryForObject(
                "INSERT INTO equipment_code_sequences (school_id, code_prefix, current_number)"
                        + " VALUES (?, ?, ?)"
                        + " ON CONFLICT (school_id, code_prefix)"
                        + " DO UPDATE SET current_number = equipment_code_sequences.current_number + EXCLUDED.current_number"
                        + " RETURNING current_number",
                Integer.class, school.getId(), parts.counterKey(), count);
        if (last == null || last > LAST_SEQUENCE) {
            return Optional.empty();
        }
        List<String> codes = new ArrayList<>(count);
        for (int n = last - count + 1; n <= last; n++) {
            codes.add(parts.format(n));
        }
        return Optional.of(codes);
    }

    private static String typeCode(PhysicalDigitalType type) {
        if (type == PhysicalDigitalType.DIGITAL) {
            return "PM";
        }
        if (type == PhysicalDigitalType.LEARNING_SUPPORT) {
            return "HL";
        }
        return "TB";
    }

    private static String normalized(String value) {
        return value == null ? "" : value.trim().toUpperCase();
    }
}
