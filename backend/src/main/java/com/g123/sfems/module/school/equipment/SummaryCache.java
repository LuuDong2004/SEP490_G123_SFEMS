package com.g123.sfems.module.school.equipment;

import com.g123.sfems.shared.cache.SharedCache;
import com.g123.sfems.shared.security.Hashes;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import tools.jackson.databind.JavaType;

/**
 * Bộ nhớ đệm ngắn hạn cho các bảng tổng hợp của màn Thiết bị, theo khoá (phạm vi người xem + bộ lọc).
 *
 * <p>Hai việc: giữ kết quả {@code ttl} để cơ quan quản lý mở lại màn / cột trái không quét lại cả sổ
 * (toàn ngành ~3,3 triệu tài sản), và MỘT lần tính cho mỗi khoá tại một thời điểm — người tới sau chờ
 * chung lần tính đang chạy, hoặc nhận bản vừa hết hạn nếu có, thay vì tự quét lần nữa và giữ thêm
 * một kết nối. Đầy thì bỏ khoá cũ nhất, không xoá sạch.
 *
 * <p>Mức 2 là {@link SharedCache} (Redis): node nào tính xong thì ghi lên đó, node khác trượt mức 1 thì lấy về
 * thay vì tự quét lại. Khoá Redis là băm của khoá ở đây — khoá chứa cả tập trường người xem thấy, có khi hàng
 * nghìn id.
 */
final class SummaryCache<V> {

    private record Cached<V>(V value, long at) {
    }

    private final long ttlMillis;
    private final Duration ttl;
    private final int maxEntries;
    private final SharedCache shared;
    private final String namespace;
    private final JavaType type;
    private final Map<String, Cached<V>> values = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<V>> running = new ConcurrentHashMap<>();

    SummaryCache(Duration ttl, int maxEntries, SharedCache shared, String namespace, JavaType type) {
        this.ttlMillis = ttl.toMillis();
        this.ttl = ttl;
        this.maxEntries = maxEntries;
        this.shared = shared;
        this.namespace = namespace;
        this.type = type;
    }

    V get(String key, Supplier<V> compute) {
        Cached<V> hit = values.get(key);
        if (hit != null && System.currentTimeMillis() - hit.at() < ttlMillis) {
            return hit.value();
        }
        CompletableFuture<V> mine = new CompletableFuture<>();
        CompletableFuture<V> other = running.putIfAbsent(key, mine);
        if (other != null) {
            return hit != null ? hit.value() : await(other);
        }
        try {
            String sharedKey = namespace + ":" + Hashes.sha256(key);
            V fromShared = shared.<V>get(sharedKey, type).orElse(null);
            V fresh = fromShared != null ? fromShared : compute.get();
            if (fromShared == null) {
                shared.put(sharedKey, fresh, ttl);
            }
            if (values.size() >= maxEntries) {
                values.entrySet().stream()
                        .min((x, y) -> Long.compare(x.getValue().at(), y.getValue().at()))
                        .ifPresent(oldest -> values.remove(oldest.getKey(), oldest.getValue()));
            }
            values.put(key, new Cached<>(fresh, System.currentTimeMillis()));
            mine.complete(fresh);
            return fresh;
        } catch (RuntimeException | Error e) {
            mine.completeExceptionally(e);
            throw e;
        } finally {
            running.remove(key, mine);
        }
    }

    private static <V> V await(CompletableFuture<V> future) {
        try {
            return future.join();
        } catch (CompletionException e) {
            if (e.getCause() instanceof RuntimeException runtime) {
                throw runtime;
            }
            throw e;
        }
    }
}
