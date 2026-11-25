package com.g123.sfems.shared.validation;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Valid;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Mọi {@code @RequestBody} phải mang {@code @Valid}: thiếu nó, mọi ràng buộc trên DTO chỉ là trang trí — payload
 * đi thẳng vào service. Đã có lúc 38 endpoint như vậy (kể cả quên / đặt lại mật khẩu). Test này giữ cho số đó
 * về 0.
 */
class RequestBodyValidatedTest {

    @Test
    void everyRequestBodyIsValidated() throws ClassNotFoundException {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        List<String> missing = new ArrayList<>();
        for (BeanDefinition definition : scanner.findCandidateComponents("com.g123.sfems")) {
            Class<?> type = Class.forName(definition.getBeanClassName());
            for (Method method : type.getDeclaredMethods()) {
                for (Parameter parameter : method.getParameters()) {
                    if (parameter.isAnnotationPresent(RequestBody.class)
                            && !parameter.isAnnotationPresent(Valid.class)
                            && !parameter.isAnnotationPresent(Validated.class)) {
                        missing.add(type.getSimpleName() + "." + method.getName());
                    }
                }
            }
        }
        assertThat(missing).as("@RequestBody thiếu @Valid").isEmpty();
    }
}
