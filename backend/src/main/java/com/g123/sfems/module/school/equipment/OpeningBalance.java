package com.g123.sfems.module.school.equipment;

import com.g123.sfems.shared.exception.FieldValidationException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Số dư đầu kỳ của trường: lúc mới lên hệ thống, cán bộ thiết bị khai tay (TS-01) hoặc nhập từ tệp (TS-07) các thiết bị
 * trường ĐANG CÓ — chưa qua phiếu, chưa ai duyệt. Hiệu trưởng chốt số dư thì lối đó đóng lại: thiết bị mới chỉ vào sổ
 * qua phiếu ghi tăng có duyệt (PN-01..03). Không chốt thì khai tay là lối vòng qua bước duyệt ghi tăng.
 */
@Service
public class OpeningBalance {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM/yyyy")
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    /** {@code closedAt} {@code null} là chưa chốt; {@code equipmentCount} là số thiết bị lúc chốt. */
    public record State(Instant closedAt, String closedBy, Integer equipmentCount, long equipmentNow) {
        public boolean closed() {
            return closedAt != null;
        }
    }

    private final JdbcTemplate jdbc;

    public OpeningBalance(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public State state(Long schoolId) {
        long now = count(schoolId);
        List<State> rows = jdbc.query("""
                SELECT b.closed_at, u.full_name, b.equipment_count FROM school_opening_balances b
                LEFT JOIN users u ON u.id = b.closed_by_id WHERE b.school_id = ?""",
                (rs, i) -> new State(rs.getTimestamp(1).toInstant(), rs.getString(2), rs.getInt(3), now), schoolId);
        return rows.isEmpty() ? new State(null, null, null, now) : rows.get(0);
    }

    /** Chốt một lần, không mở lại: mở lại là mở lại lối khai tay không qua duyệt. */
    @Transactional
    public State close(Long schoolId, Long userId) {
        int inserted = jdbc.update("""
                INSERT INTO school_opening_balances (school_id, closed_by_id, equipment_count)
                VALUES (?, ?, (SELECT COUNT(*) FROM equipment WHERE school_id = ?))
                ON CONFLICT (school_id) DO NOTHING""", schoolId, userId, schoolId);
        if (inserted == 0) {
            throw new FieldValidationException("school", "Trường đã chốt số dư đầu kỳ");
        }
        return state(schoolId);
    }

    public boolean isOpen(Long schoolId) {
        return closedAt(schoolId) == null;
    }

    /** Khai tay / nhập từ tệp chỉ được khi trường chưa chốt số dư đầu kỳ. */
    public void requireOpen(Long schoolId) {
        Instant at = closedAt(schoolId);
        if (at != null) {
            throw new FieldValidationException("school", ("Trường đã chốt số dư đầu kỳ ngày %s — thiết bị mới vào sổ qua phiếu "
                    + "ghi tăng (cán bộ thiết bị lập, hiệu trưởng duyệt)").formatted(DAY.format(at)));
        }
    }

    private Instant closedAt(Long schoolId) {
        if (schoolId == null) {
            return null;
        }
        List<Instant> at = jdbc.query("SELECT closed_at FROM school_opening_balances WHERE school_id = ?",
                (rs, i) -> rs.getTimestamp(1).toInstant(), schoolId);
        return at.isEmpty() ? null : at.get(0);
    }

    private long count(Long schoolId) {
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM equipment WHERE school_id = ?", Long.class, schoolId);
        return n == null ? 0 : n;
    }
}
