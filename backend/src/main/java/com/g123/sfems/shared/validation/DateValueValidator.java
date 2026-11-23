package com.g123.sfems.shared.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.time.LocalDate;

public class DateValueValidator implements ConstraintValidator<DateValue, LocalDate> {

    private DateRule rule;
    private String label;

    @Override
    public void initialize(DateValue annotation) {
        rule = annotation.value();
        label = annotation.label();
    }

    @Override
    public boolean isValid(LocalDate value, ConstraintValidatorContext context) {
        String problem = rule.violation(value);
        if (problem == null) {
            return true;
        }
        Violations.replace(context, label + " " + problem);
        return false;
    }
}
