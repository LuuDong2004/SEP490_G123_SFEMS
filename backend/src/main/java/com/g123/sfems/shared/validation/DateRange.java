package com.g123.sfems.shared.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Repeatable;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Khoảng ngày trên MỘT payload: {@code to} không được trước {@code from}. Đặt trên record; lỗi gắn vào ô
 * {@code to}. Một trong hai ô vắng thì không kiểm — PATCH chỉ gửi một ngày thì service tự so với giá trị đã lưu.
 */
@Documented
@Constraint(validatedBy = DateRangeValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Repeatable(DateRange.List.class)
public @interface DateRange {

    /** Tên thành phần record của ngày đầu. */
    String from();

    /** Tên thành phần record của ngày cuối. */
    String to();

    /** Câu lỗi đầy đủ, vd. "Hạn trả không được trước ngày mượn". */
    String message();

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    @Documented
    @Target(ElementType.TYPE)
    @Retention(RetentionPolicy.RUNTIME)
    @interface List {
        DateRange[] value();
    }
}
