package com.g123.sfems.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Bật các tác vụ định kỳ: nhắc mượn quá hạn, nhắc đến hạn bảo trì.
 *
 * <p>Mỗi tác vụ tự giữ dấu "đã nhắc lúc nào" trên chính dòng dữ liệu, nên chạy
 * trên nhiều node thì người nhận có thể được nhắc hai lần trong một ngày, nhưng
 * không bao giờ bị nhắc lại mỗi phút. Khi có hơn một node thật thì cần khoá
 * phân tán (ShedLock) — ghi lại đây để không ai phát hiện điều đó ở tuần vận hành
 * đầu tiên.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
