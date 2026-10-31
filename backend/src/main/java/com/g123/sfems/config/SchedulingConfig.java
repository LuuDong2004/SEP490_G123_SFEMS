package com.g123.sfems.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Bật các tác vụ định kỳ: nhắc mượn quá hạn, nhắc đến hạn bảo trì, sao lưu, kiểm dung lượng.
 *
 * <p>Mỗi tác vụ bọc lượt chạy trong {@code JobLock.runExclusive}: nhiều node thì mỗi lượt chỉ
 * một node làm. Tác vụ mới phải làm y vậy, nếu không mỗi node chạy một lần.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
