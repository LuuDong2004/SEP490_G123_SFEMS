package com.g123.sfems.shared.validation;

import jakarta.validation.ConstraintValidatorContext;

final class Violations {

    private Violations() {
    }

    /**
     * Thay câu mặc định bằng câu đã dựng sẵn. Nhãn có thể chứa ký tự mẫu của Bean Validation ({, }, $, \),
     * nên thoát chúng trước khi đưa vào làm mẫu.
     */
    static void replace(ConstraintValidatorContext context, String message) {
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(escape(message)).addConstraintViolation();
    }

    static void replace(ConstraintValidatorContext context, String message, String property) {
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(escape(message))
                .addPropertyNode(property).addConstraintViolation();
    }

    private static String escape(String message) {
        return message.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}").replace("$", "\\$");
    }
}
