package com.g123.sfems.shared.scheduling;

import java.lang.management.ManagementFactory;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Khoá cho tác vụ hẹn giờ khi chạy nhiều node: mỗi lượt của một tác vụ chỉ một node làm.
 *
 * <p>Cùng cách của ShedLock, trên bảng {@code scheduled_job_locks} (173): node nào đổi được
 * {@code locked_until} từ quá khứ sang tương lai thì được chạy, các node khác bỏ lượt. Mọi mốc
 * giờ là {@code now()} của database nên đồng hồ lệch giữa các node không làm hai node cùng chạy.
 * Chạy xong vẫn giữ khoá tới hết {@code atLeast} — node có đồng hồ cron trễ vài giây không chạy
 * lại lượt vừa xong; node chết giữa chừng thì khoá tự hết sau {@code atMost}.
 *
 * <p>Không dùng {@code pg_try_advisory_lock}: khoá ấy gắn với một phiên, phải giữ riêng một kết
 * nối suốt lượt chạy (sao lưu mất vài phút), và nhả ra ngay khi xong nên không chặn node trễ.
 */
@Component
public class JobLock {

    private static final Logger log = LoggerFactory.getLogger(JobLock.class);

    private final JdbcTemplate jdbc;
    private final String node = ManagementFactory.getRuntimeMXBean().getName();

    public JobLock(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Chạy {@code work} nếu lượt này chưa node nào nhận. Gọi NGOÀI giao dịch: khoá phải commit
     * ngay thì node khác mới thấy.
     *
     * @return {@code true} nếu node này đã chạy
     */
    public boolean runExclusive(String name, Duration atMost, Duration atLeast, Runnable work) {
        jdbc.update("INSERT INTO scheduled_job_locks (name, locked_until) VALUES (?, now()) ON CONFLICT (name) DO NOTHING",
                name);
        int taken = jdbc.update("""
                UPDATE scheduled_job_locks
                SET locked_until = now() + ? * INTERVAL '1 second', locked_at = now(), locked_by = ?
                WHERE name = ? AND locked_until <= now()""", atMost.toSeconds(), node, name);
        if (taken == 0) {
            log.debug("Bỏ lượt {}: node khác đang chạy hoặc vừa chạy", name);
            return false;
        }
        try {
            work.run();
        } finally {
            jdbc.update("""
                    UPDATE scheduled_job_locks
                    SET locked_until = GREATEST(now(), locked_at + ? * INTERVAL '1 second')
                    WHERE name = ? AND locked_by = ?""", atLeast.toSeconds(), name, node);
        }
        return true;
    }
}
