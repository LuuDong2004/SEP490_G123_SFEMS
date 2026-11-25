package com.g123.sfems.shared.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Trường chữ theo một kiểu chuẩn của {@link FieldRule}: độ dài và ký tự cho phép. Câu lỗi là
 * "nhãn + lỗi của kiểu" — "Tên thiết bị tối đa 255 ký tự", "Email không đúng định dạng…".
 *
 * <p>Không thay {@code @NotBlank}: bắt buộc hay không là chuyện riêng của từng ô.
 */
@Documented
@Constraint(validatedBy = TextValidator.class)
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER, ElementType.METHOD,
        ElementType.TYPE_USE})
@Retention(RetentionPolicy.RUNTIME)
public @interface Text {

    FieldRule value();

    /** Nhãn ô như trên màn hình — đầu câu báo lỗi. */
    String label();

    /** Trần riêng khi cột trong CSDL ngắn hơn trần của kiểu; 0 = dùng trần của kiểu. */
    int max() default 0;

    /** Độ dài tối thiểu khi có khai (rỗng vẫn hợp lệ — bắt buộc là việc của {@code @NotBlank}); 0 = không đặt. */
    int min() default 0;

    String message() default "";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
