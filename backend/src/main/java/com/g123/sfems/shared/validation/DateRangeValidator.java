package com.g123.sfems.shared.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.time.temporal.Temporal;

public class DateRangeValidator implements ConstraintValidator<DateRange, Object> {

    private String from;
    private String to;
    private String message;

    @Override
    public void initialize(DateRange annotation) {
        from = annotation.from();
        to = annotation.to();
        message = annotation.message();
    }

    @Override
    public boolean isValid(Object value, ConstraintValidatorContext context) {
        if (value == null) {
            return true;
        }
        Object start = read(value, from);
        Object end = read(value, to);
        if (!before(end, start)) {
            return true;
        }
        Violations.replace(context, message, to);
        return false;
    }

    @SuppressWarnings("unchecked")
    private static boolean before(Object end, Object start) {
        if (!(end instanceof Temporal) || start == null || end.getClass() != start.getClass()
                || !(end instanceof Comparable<?>)) {
            return false;
        }
        return ((Comparable<Object>) end).compareTo(start) < 0;
    }

    private static Object read(Object bean, String name) {
        try {
            Method accessor = bean.getClass().getMethod(name);
            return accessor.invoke(bean);
        } catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException e) {
            throw new IllegalStateException("@DateRange: " + bean.getClass().getSimpleName() + " không có " + name, e);
        }
    }
}
