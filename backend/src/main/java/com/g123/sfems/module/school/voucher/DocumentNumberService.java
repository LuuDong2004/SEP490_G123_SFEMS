package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.organization.School;
import java.time.LocalDate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Số phiếu: {@code <tiền tố>-<năm>-<5 chữ số>}, đếm lại mỗi năm, riêng cho từng trường và từng loại
 * phiếu — {@code NK-2026-00042}, {@code MS-2026-00003}.
 *
 * <p>Một lệnh {@code INSERT ... ON CONFLICT DO UPDATE ... RETURNING}: database khoá dòng đếm, hai
 * người trình cùng lúc nhận hai số khác nhau, không cần thử lại. Số được cấp TRONG giao dịch trình
 * phiếu — giao dịch đó cuộn lại thì số mất theo, nên dãy số có thể khuyết. Điều đó đúng hơn là dùng
 * lại: hai phiếu từng mang cùng một số là thứ không ai gỡ được về sau.
 */
@Service
public class DocumentNumberService {

    private final JdbcTemplate jdbc;

    public DocumentNumberService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public String reserve(School school, String prefix, LocalDate date) {
        String series = prefix + "-" + (date == null ? LocalDate.now() : date).getYear();
        Integer next = jdbc.queryForObject(
                "INSERT INTO document_number_sequences (school_id, prefix, current_number)"
                        + " VALUES (?, ?, 1)"
                        + " ON CONFLICT (school_id, prefix)"
                        + " DO UPDATE SET current_number = document_number_sequences.current_number + 1"
                        + " RETURNING current_number",
                Integer.class, school.getId(), series);
        return series + "-" + String.format("%05d", next == null ? 1 : next);
    }
}
