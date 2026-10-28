package com.g123.sfems.module.catalog.coderule;

import com.g123.sfems.domain.catalog.coderule.CodeRule;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Xem trước và chốt mã theo {@link CodeRule}.
 *
 * <ul>
 *   <li>{@link #peek} — mã kế tiếp, KHÔNG tăng bộ đếm: điền sẵn ô mã ở form
 *       tạo mới, người dùng vẫn sửa được.</li>
 *   <li>{@link #reserve} — tăng bộ đếm và trả về mã mới, gọi lúc lưu.</li>
 * </ul>
 *
 * <p>{@link #reserve} là MỘT lệnh {@code UPDATE ... RETURNING}: database khoá
 * dòng quy tắc trong lúc tăng, nên hai người lưu cùng lúc nhận hai số khác
 * nhau mà không cần optimistic lock + thử lại như bản Jmix. Lệnh chạy trong
 * transaction của người gọi — lưu thất bại thì bộ đếm cũng lùi lại.
 *
 * <p>Bộ đếm BỎ QUA mã đã có trong bảng (QLTB-178): ai đó gõ tay DVT005 thì tới lượt số 5 máy cấp DVT006 thay vì
 * vấp trùng mã ở lần lưu đó — và mãi mãi về sau, vì bộ đếm cứ dừng ở 5.
 */
@Component
public class CodeGenerator {

    private final JdbcTemplate jdbc;

    public CodeGenerator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Số lần tối đa bỏ qua mã đã có khi tìm số kế tiếp — chặn vòng lặp vô tận trên một bảng kín số. */
    private static final int MAX_SKIP = 1000;
    private static final Pattern TABLE = Pattern.compile("^[a-z][a-z0-9_]*$");

    private record Rule(String prefix, String suffix, int numberLength, long current) {
        String format(long number) {
            return CodeRule.format(prefix, suffix, numberLength, number);
        }
    }

    private Optional<Rule> rule(String target) {
        return jdbc.query(
                "SELECT prefix, suffix, number_length, current_number FROM code_rules WHERE target = ? AND active",
                (rs, i) -> new Rule(rs.getString("prefix"), rs.getString("suffix"),
                        rs.getInt("number_length"), rs.getLong("current_number")),
                target).stream().findFirst();
    }

    /** Mã kế tiếp CÒN TRỐNG trong bảng — không tăng bộ đếm. */
    @Transactional(readOnly = true)
    public Optional<String> peek(String target) {
        return rule(target).map(r -> {
            boolean checkable = hasCodeColumn(target);
            for (long n = r.current() + 1; n <= r.current() + MAX_SKIP; n++) {
                String code = r.format(n);
                if (!checkable || !taken(target, code)) {
                    return code;
                }
            }
            return r.format(r.current() + 1);
        });
    }

    @Transactional
    public Optional<String> reserve(String target) {
        List<String> rows = jdbc.query(
                "UPDATE code_rules SET current_number = current_number + 1"
                        + " WHERE target = ? AND active"
                        + " RETURNING prefix, suffix, number_length, current_number",
                (rs, i) -> CodeRule.format(
                        rs.getString("prefix"), rs.getString("suffix"),
                        rs.getInt("number_length"), rs.getLong("current_number")),
                target);
        return rows.stream().findFirst();
    }

    /**
     * Mã sẽ lưu cho một bản ghi mới: người dùng giữ nguyên mã gợi ý thì chốt
     * số (có thể ra số khác nếu vừa có người chốt trước); tự gõ mã khác thì
     * dùng mã đó và bộ đếm không bị tiêu.
     */
    @Transactional
    public String resolveOnCreate(String target, String requestedCode) {
        String code = requestedCode == null ? "" : requestedCode.trim();
        // Để trống là để máy cấp (QLTB-178) — như một client API bỏ hẳn khoá `code`.
        if (code.isEmpty()) {
            return reserveFree(target).orElse(code);
        }
        Optional<String> suggested = peek(target);
        if (suggested.isPresent() && suggested.get().equalsIgnoreCase(code)) {
            return reserveFree(target).orElse(code);
        }
        return code;
    }

    /** Chốt số kế tiếp, bỏ qua các số mà mã của nó đã có người gõ tay. */
    private Optional<String> reserveFree(String target) {
        boolean checkable = hasCodeColumn(target);
        for (int i = 0; i < MAX_SKIP; i++) {
            Optional<String> code = reserve(target);
            if (code.isEmpty() || !checkable || !taken(target, code.get())) {
                return code;
            }
        }
        return reserve(target);
    }

    /**
     * Bảng đích có cột {@code code} không. Kiểm trước khi đọc: một câu SQL lỗi trong PostgreSQL làm hỏng cả
     * giao dịch của người gọi. Tên bảng chỉ nhận chữ thường, số, gạch dưới — nó được nối vào câu SQL.
     */
    private boolean hasCodeColumn(String target) {
        if (target == null || !TABLE.matcher(target).matches()) {
            return false;
        }
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM information_schema.columns"
                        + " WHERE table_schema = current_schema() AND table_name = ? AND column_name = 'code')",
                Boolean.class, target));
    }

    private boolean taken(String target, String code) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM " + target + " WHERE LOWER(code) = LOWER(?))", Boolean.class, code));
    }
}
