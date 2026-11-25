package com.g123.sfems.module.school.voucher;

import static org.assertj.core.api.Assertions.assertThatCode;

import com.g123.sfems.domain.school.voucher.ApprovalStep;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * Câu tìm người duyệt chạy được trên schema thật. Mọi lần trình / duyệt một cấp đều đi qua đây; trước đây câu SQL
 * còn ghép bảng {@code user_ubnds} đã xoá ở changelog 252 nên MỌI phiếu trình đều lỗi 500.
 */
@SpringBootTest
@Transactional
class VoucherProgressNotifierTest {

    @Autowired
    VoucherProgressNotifier notifier;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void findsApproversAtEveryStepOnTheRealSchema() {
        Long schoolId = jdbc.query("SELECT us.school_id FROM user_schools us ORDER BY us.id LIMIT 1",
                rs -> rs.next() ? rs.getLong(1) : null);
        Assumptions.assumeTrue(schoolId != null, "Thiếu tài khoản trường");
        // Phiếu chạm một cơ sở (lãnh đạo cơ sở đó + cả trường) và chạm nhiều cơ sở (chỉ lãnh đạo cả trường).
        for (java.util.Set<Long> campuses : java.util.List.of(java.util.Set.<Long>of(), java.util.Set.of(1L),
                java.util.Set.of(1L, 2L))) {
            for (ApprovalStep step : ApprovalStep.values()) {
                var event = new VoucherProgressNotifier.VoucherAwaiting("purchase_proposals", 1L, "MS-TEST", step,
                        schoolId, "Trường thử", campuses);
                assertThatCode(() -> notifier.on(event)).as("bước %s, cơ sở %s", step, campuses)
                        .doesNotThrowAnyException();
            }
        }
    }
}
