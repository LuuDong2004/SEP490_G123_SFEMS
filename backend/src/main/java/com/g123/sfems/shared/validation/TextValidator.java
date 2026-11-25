package com.g123.sfems.shared.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class TextValidator implements ConstraintValidator<Text, String> {

    private FieldRule rule;
    private String label;
    private int max;
    private int min;

    @Override
    public void initialize(Text annotation) {
        rule = annotation.value();
        label = annotation.label();
        max = annotation.max();
        min = annotation.min();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        String problem = rule.violation(value, max, min);
        if (problem == null) {
            return true;
        }
        Violations.replace(context, label + " " + problem);
        return false;
    }
}
