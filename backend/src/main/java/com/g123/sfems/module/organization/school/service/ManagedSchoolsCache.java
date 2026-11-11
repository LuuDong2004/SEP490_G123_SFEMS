package com.g123.sfems.module.organization.school.service;

import com.g123.sfems.shared.messaging.PostgresEventBus;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.context.event.EventListener;
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
 * <p>Cùng bản chụp giữ LOẠI của từng cơ quan ({@code SO} / UBND), để
 * {@link #isCityBody} — được {@link VisibleSchools} gọi ở mỗi {@code sqlFilter},
 * hàng chục lần một trang tổng quan — không còn là một câu SELECT mỗi lần.
 *
 * <p>Làm mới bằng ba đường, như {@code AuthorityCache}: {@link SchoolService} và
 * {@code DepartmentOfEducationService} báo sau khi giao dịch đổi cơ quan / loại cơ
 * quan đã commit; node khác nghe qua {@link PostgresEventBus} (loại tin
 * {@value #KIND}); và một hạn 60 giây cho trường hợp ai đó sửa thẳng trong cơ sở
 * dữ liệu. Không đường nào cần tới hạn đó; nó có để một chỗ quên báo thành "sai
 * trong một phút" chứ không phải "sai tới lần khởi động lại".
 *
 * <p>Hết hạn thì nạp lại dưới khoá và KIỂM HẠN LẦN HAI ({@link #reloadIfStale}), như
 * {@code RowLevelPolicyCache}: không có lần kiểm thứ hai, mọi yêu cầu đang chạy lúc bản
 * chụp hết hạn đều tự nạp lại cả bảng, mỗi yêu cầu giữ một kết nối.
 */
@Component
public class ManagedSchoolsCache {

    private static final Duration TTL = Duration.ofSeconds(60);

    /** Nhãn tin của cache này trên bus chung. */
    static final String KIND = "managed-schools";

    private record Snapshot(Map<Long, Set<Long>> byBody, Map<Long, Long> bodyBySchool, Set<Long> cityBodies,
                            Instant loadedAt) {
        boolean isExpired() {
            return loadedAt.plus(TTL).isBefore(Instant.now());
        }
    }

    private final JdbcTemplate jdbc;
    private final PostgresEventBus bus;
    private volatile Snapshot snapshot;

    public ManagedSchoolsCache(JdbcTemplate jdbc, PostgresEventBus bus) {
        this.jdbc = jdbc;
        this.bus = bus;
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
        return schoolId == null ? null : current().bodyBySchool().get(schoolId);
    }

    /** Cơ quan này có phải Sở (cấp thành phố — thấy mọi trường) không. */
    public boolean isCityBody(Long bodyId) {
        return bodyId != null && current().cityBodies().contains(bodyId);
    }

    /**
     * Nạp lại sau khi giao dịch hiện tại commit — trước đó thì dữ liệu mới chưa đọc được —
     * và báo các node khác làm theo.
     */
    public void invalidateAfterCommit() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    invalidateAndBroadcast();
                }
            });
        } else {
            invalidateAndBroadcast();
        }
    }

    private void invalidateAndBroadcast() {
        snapshot = null;
        bus.publish(KIND, "all");
    }

    /** Node khác vừa đổi cơ quan của một trường: bỏ bản chụp, lần đọc kế tiếp nạp lại. */
    @EventListener
    public void onRemote(PostgresEventBus.RemoteEvent remote) {
        if (KIND.equals(remote.kind())) {
            snapshot = null;
        }
    }

    private Snapshot current() {
        Snapshot now = snapshot;
        if (now == null || now.isExpired()) {
            now = reloadIfStale();
        }
        return now;
    }

    private synchronized Snapshot reloadIfStale() {
        Snapshot now = snapshot;
        if (now == null || now.isExpired()) {
            now = load();
            snapshot = now;
        }
        return now;
    }

    private Snapshot load() {
        Map<Long, Set<Long>> byBody = new HashMap<>();
        Map<Long, Long> bodyBySchool = new HashMap<>();
        jdbc.query("SELECT department_of_education_id, id FROM schools WHERE department_of_education_id IS NOT NULL",
                rs -> {
                    byBody.computeIfAbsent(rs.getLong(1), key -> new HashSet<>()).add(rs.getLong(2));
                    bodyBySchool.put(rs.getLong(2), rs.getLong(1));
                });
        Set<Long> cityBodies = new HashSet<>(
                jdbc.queryForList("SELECT id FROM departments_of_education WHERE type = 'SO'", Long.class));
        Map<Long, Set<Long>> frozen = new HashMap<>();
        byBody.forEach((body, schools) -> frozen.put(body, Set.copyOf(schools)));
        return new Snapshot(Map.copyOf(frozen), Map.copyOf(bodyBySchool), Set.copyOf(cityBodies), Instant.now());
    }
}
