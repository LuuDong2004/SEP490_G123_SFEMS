package com.g123.sfems.shared.cache;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Kết nối Redis — chỉ dựng khi khai {@code app.cache.redis.host} ({@code REDIS_HOST}).
 *
 * <p>Tự dựng thay vì để auto-configuration của Spring Boot làm (đã exclude trong {@code application.properties}):
 * bản tự động luôn dựng kết nối tới {@code localhost:6379} và gắn health indicator — máy dev không có Redis thì
 * {@code /actuator/health} báo DOWN, còn ở đây không có Redis là một cấu hình hợp lệ ({@link SharedCache} đọc
 * thẳng CSDL). Thời gian chờ ngắn vì Redis chậm thì đọc CSDL còn hơn đứng chờ nó.
 */
@Configuration
@ConditionalOnExpression("!'${app.cache.redis.host:}'.isBlank()")
public class SharedCacheConfig {

    @Bean
    public LettuceConnectionFactory redisConnectionFactory(
            @Value("${app.cache.redis.host}") String host,
            @Value("${app.cache.redis.port:6379}") int port,
            @Value("${app.cache.redis.password:}") String password,
            @Value("${app.cache.redis.timeout:500ms}") Duration timeout) {
        RedisStandaloneConfiguration server = new RedisStandaloneConfiguration(host, port);
        if (!password.isBlank()) {
            server.setPassword(password);
        }
        LettuceClientConfiguration client = LettuceClientConfiguration.builder()
                .commandTimeout(timeout)
                .build();
        return new LettuceConnectionFactory(server, client);
    }

    @Bean
    public StringRedisTemplate sharedCacheTemplate(LettuceConnectionFactory factory) {
        return new StringRedisTemplate(factory);
    }
}
