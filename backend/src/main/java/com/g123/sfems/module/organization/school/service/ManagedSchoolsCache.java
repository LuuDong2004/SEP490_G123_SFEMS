package com.g123.sfems.module.organization.school.service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Cơ quan quản lý → tập các trường nó quản lý, giữ trong bộ nhớ.
 *
 * <p>Đây là thứ đứng sau khoá ngữ cảnh {@code user.managedSchoolIds}, và lý do
 * nó là một bộ nhớ đệm chứ không phải một câu truy vấn: một khoá ngữ cảnh được
 * giải trên MỌI danh sách của mọi bảng thuộc trường, nên nó không được chạm cơ
 * sở dữ liệu ({@code RowLevelContextProvider#resolve}). Toàn bộ bảng là vài
 * nghìn cặp số — nạp một lần, đổi con trỏ khi cần nạp lại.
 *
 * <p>Làm mới bằng hai đường, như {@code AuthorityCache}: {@link SchoolService}
 * báo sau khi giao dịch đổi cơ quan của một trường đã commit, và một hạn 60 giây
 * cho trường hợp ai đó sửa thẳng trong cơ sở dữ liệu. Không đường nào cần tới
 * hạn đó; nó có để một chỗ quên báo thành "sai trong một phút" chứ không phải
 * "sai tới lần khởi động lại".
 */
@Component
public class ManagedSchoolsCache {

    private static final Duration TTL = Duration.ofSeconds(60);

    private record Snapshot(Map<Long, Set<Long>> byBody, Instant loadedAt) {
    }

    private final JdbcTemplate jdbc;
    private volatile Snapshot snapshot;

    public ManagedSchoolsCache(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Các trường mà cơ quan này là cơ quan quản lý. Rỗng khi không có cơ quan. */
    public Set<Long> schoolsOf(Long managingBodyId) {
        if (managingBodyId == null) {
            return Set.of();
        }
        return current().byBody().getOrDefault(managingBodyId, Set.of());
    }

    /** Cơ quan quản lý của một trường, hoặc {@code null}. */
    public Long bodyOf(Long schoolId) {
        for (Map.Entry<Long, Set<Long>> entry : current().byBody().entrySet()) {
            if (entry.getValue().contains(schoolId)) {
                return entry.getKey();
            }
        }
        return null;
    }

    /** Nạp lại sau khi giao dịch hiện tại commit — trước đó thì dữ liệu mới chưa đọc được. */
    public void invalidateAfterCommit() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    snapshot = null;
                }
            });
        } else {
            snapshot = null;
        }
    }

    private Snapshot current() {
        Snapshot now = snapshot;
        if (now == null || now.loadedAt().plus(TTL).isBefore(Instant.now())) {
            now = load();
            snapshot = now;
        }
        return now;
    }

    private Snapshot load() {
        Map<Long, Set<Long>> byBody = new HashMap<>();
        jdbc.query("SELECT department_of_education_id, id FROM schools WHERE department_of_education_id IS NOT NULL",
                rs -> {
                    byBody.computeIfAbsent(rs.getLong(1), key -> new HashSet<>()).add(rs.getLong(2));
                });
        Map<Long, Set<Long>> frozen = new HashMap<>();
        byBody.forEach((body, schools) -> frozen.put(body, Set.copyOf(schools)));
        return new Snapshot(Map.copyOf(frozen), Instant.now());
    }
}
