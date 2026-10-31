package com.g123.sfems.shared.cache;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Optional;
import java.util.Properties;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JavaType;
import tools.jackson.databind.ObjectMapper;

/**
 * Bộ nhớ đệm DÙNG CHUNG giữa các node ứng dụng (Redis) — mức 2, sau bộ nhớ đệm trong từng node.
 *
 * <p>Một node tính xong một bảng tổng hợp nặng thì các node khác lấy lại, không mỗi node tự quét CSDL; và sổ phiên
 * đăng nhập nằm ở một chỗ mọi node cùng thấy ({@code SessionRegistry}). CSDL vẫn là nguồn sự thật: mất Redis —
 * chưa khai, sập, đầy rồi bỏ khoá, khởi động lại mất dữ liệu — thì mọi lời gọi ở đây trả "không có", người gọi
 * tính / đọc lại từ CSDL. Không chỗ nào ĐỢI Redis lâu hơn {@code app.cache.redis.timeout}, và gọi lỗi một lần thì
 * bỏ qua Redis {@value #BACKOFF_SECONDS} giây — nếu không mỗi yêu cầu lại chờ hết thời gian chờ rồi mới đọc CSDL.
 *
 * <p>Giá trị lưu dạng JSON, khoá có tiền tố {@value #PREFIX}. Kiểu đọc ra do người gọi nói, nên đừng lưu gì mà
 * Jackson không dựng lại được (thực thể JPA, đối tượng có vòng).
 */
@Component
public class SharedCache {

    private static final Logger log = LoggerFactory.getLogger(SharedCache.class);

    public static final String PREFIX = "sfems:";
    static final long BACKOFF_SECONDS = 30;

    private final StringRedisTemplate redis;
    private final ObjectMapper json;
    private final AtomicLong hits = new AtomicLong();
    private final AtomicLong misses = new AtomicLong();
    private final AtomicLong errors = new AtomicLong();
    private volatile long downUntil;

    public SharedCache(ObjectProvider<StringRedisTemplate> redis, ObjectMapper json) {
        this.redis = redis.getIfAvailable();
        this.json = json;
    }

    /** Có Redis để dùng ngay lúc này: đã khai, và không trong thời gian bỏ qua sau một lần lỗi. */
    public boolean available() {
        return redis != null && System.currentTimeMillis() >= downUntil;
    }

    public boolean configured() {
        return redis != null;
    }

    public JavaType type(Class<?> type) {
        return json.getTypeFactory().constructType(type);
    }

    public JavaType mapType(Class<?> key, Class<?> value) {
        return json.getTypeFactory().constructMapType(LinkedHashMap.class, key, value);
    }

    public <T> Optional<T> get(String key, JavaType type) {
        String raw = getRaw(key);
        if (raw == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(json.readValue(raw, type));
        } catch (JacksonException e) {
            // Khuôn dữ liệu đổi giữa hai bản phát hành: coi như không có, lần tính sau ghi đè.
            log.debug("Bỏ giá trị cache không đọc được {}: {}", key, e.getMessage());
            return Optional.empty();
        }
    }

    public void put(String key, Object value, Duration ttl) {
        if (!available()) {
            return;
        }
        String raw;
        try {
            raw = json.writeValueAsString(value);
        } catch (JacksonException e) {
            log.warn("Không ghi được {} vào cache dùng chung: {}", key, e.getMessage());
            return;
        }
        putRaw(key, raw, ttl);
    }

    /** Chuỗi thô — cho giá trị nhỏ, đọc nhiều (cờ phiên). */
    public String getRaw(String key) {
        if (!available()) {
            return null;
        }
        try {
            String value = redis.opsForValue().get(PREFIX + key);
            (value == null ? misses : hits).incrementAndGet();
            return value;
        } catch (RuntimeException e) {
            failed(e);
            return null;
        }
    }

    public void putRaw(String key, String value, Duration ttl) {
        if (!available()) {
            return;
        }
        try {
            redis.opsForValue().set(PREFIX + key, value, ttl);
        } catch (RuntimeException e) {
            failed(e);
        }
    }

    /** Chỉ ghi khi khoá chưa có — để một cờ cũ ghi sau không đè lên cờ mới hơn. */
    public void putRawIfAbsent(String key, String value, Duration ttl) {
        if (!available()) {
            return;
        }
        try {
            redis.opsForValue().setIfAbsent(PREFIX + key, value, ttl);
        } catch (RuntimeException e) {
            failed(e);
        }
    }

    /**
     * Chạy sau khi giao dịch hiện tại commit (ngay nếu không có giao dịch). Ghi Redis nằm ngoài giao dịch: ghi trước
     * commit mà giao dịch lùi lại thì Redis nói một điều CSDL không có.
     */
    public void afterCommit(Runnable work) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            work.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                work.run();
            }
        });
    }

    /** Cho màn Giám sát hệ thống: trúng / trượt / lỗi của node này từ lúc khởi động, và bộ nhớ của Redis. */
    public Stats stats() {
        Long used = null;
        Long max = null;
        Long keys = null;
        boolean up = false;
        if (available()) {
            try {
                Properties memory = redis.execute((RedisCallback<Properties>) c -> c.serverCommands().info("memory"));
                used = number(memory, "used_memory");
                max = number(memory, "maxmemory");
                keys = redis.execute((RedisCallback<Long>) c -> c.serverCommands().dbSize());
                up = true;
            } catch (RuntimeException e) {
                failed(e);
            }
        }
        long h = hits.get();
        long m = misses.get();
        Double hitRate = h + m == 0 ? null : (double) h / (h + m);
        return new Stats(configured(), up, h, m, errors.get(), hitRate, used, max, keys);
    }

    /** {@code maxMemory} 0 nghĩa là Redis không đặt giới hạn. */
    public record Stats(boolean configured, boolean up, long hits, long misses, long errors, Double hitRate,
                        Long usedMemory, Long maxMemory, Long keys) {
    }

    private static Long number(Properties properties, String name) {
        String value = properties == null ? null : properties.getProperty(name);
        try {
            return value == null ? null : Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void failed(RuntimeException e) {
        errors.incrementAndGet();
        boolean wasUp = System.currentTimeMillis() >= downUntil;
        downUntil = System.currentTimeMillis() + BACKOFF_SECONDS * 1000;
        if (wasUp) {
            log.warn("Redis không trả lời ({}) — đọc thẳng CSDL trong {} giây", e.getMessage(), BACKOFF_SECONDS);
        }
    }
}
