package com.g123.sfems.shared.web;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Đánh dấu endpoint chạy truy vấn gộp nặng (báo cáo, trang chủ, tổng hợp toàn ngành). {@link RequestThrottle} cho
 * mỗi người chỉ chạy vài cái cùng lúc — phần dư của chính người đó xếp hàng chờ, không làm nghẽn kết nối CSDL của
 * người khác. Xuất tệp ({@code /export}, {@code .xlsx}) tự được tính là nặng, không cần gắn.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface HeavyQuery {
}
