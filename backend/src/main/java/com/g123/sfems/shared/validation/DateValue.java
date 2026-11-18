package com.g123.sfems.shared.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Ngày theo {@link DateRule}. */
@Documented
@Constraint(validatedBy = DateValueValidator.class)
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER, ElementType.METHOD,
        ElementType.TYPE_USE})
@Retention(RetentionPolicy.RUNTIME)
public @interface DateValue {

    DateRule value() default DateRule.ANY;

    String label();

    String message() default "";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
