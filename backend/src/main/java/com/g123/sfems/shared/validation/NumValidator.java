package com.g123.sfems.shared.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.math.BigDecimal;

public class NumValidator implements ConstraintValidator<Num, Number> {

    private NumberRule rule;
    private String label;

    @Override
    public void initialize(Num annotation) {
        rule = annotation.value();
        label = annotation.label();
    }

    @Override
    public boolean isValid(Number value, ConstraintValidatorContext context) {
        if (value == null) {
            return true;
        }
        BigDecimal decimal = value instanceof BigDecimal b ? b : new BigDecimal(value.toString());
        String problem = rule.violation(decimal);
        if (problem == null) {
            return true;
        }
        Violations.replace(context, label + " " + problem);
        return false;
    }
}
