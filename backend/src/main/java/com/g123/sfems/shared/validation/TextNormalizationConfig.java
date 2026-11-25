package com.g123.sfems.shared.validation;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.JacksonModule;
import tools.jackson.databind.deser.jdk.StringDeserializer;
import tools.jackson.databind.module.SimpleModule;

/**
 * Gắn {@link TextNormalizer} vào bộ đọc JSON: mọi ô chữ của mọi payload đi qua nó, nên không DTO nào phải tự
 * {@code trim()} và không ô nào bị quên. Spring Boot tự đăng ký mọi bean {@link JacksonModule}.
 */
@Configuration(proxyBeanMethods = false)
public class TextNormalizationConfig {

    @Bean
    JacksonModule textNormalizationModule() {
        SimpleModule module = new SimpleModule("text-normalization");
        module.addDeserializer(String.class, new NormalizingStringDeserializer());
        return module;
    }

    static final class NormalizingStringDeserializer extends StringDeserializer {

        @Override
        public String deserialize(JsonParser p, DeserializationContext ctxt) {
            return TextNormalizer.normalize(super.deserialize(p, ctxt));
        }
    }
}
