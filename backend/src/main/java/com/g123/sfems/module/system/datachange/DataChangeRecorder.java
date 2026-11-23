package com.g123.sfems.module.system.datachange;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.shared.security.ActorNames;
import com.g123.sfems.shared.security.CurrentUser;
import jakarta.annotation.PostConstruct;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Table;
import java.lang.reflect.Method;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.hibernate.event.service.spi.EventListenerRegistry;
import org.hibernate.event.spi.EventType;
import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.event.spi.PostDeleteEvent;
import org.hibernate.event.spi.PostDeleteEventListener;
import org.hibernate.event.spi.PostInsertEvent;
import org.hibernate.event.spi.PostInsertEventListener;
import org.hibernate.event.spi.PostUpdateEvent;
import org.hibernate.event.spi.PostUpdateEventListener;
import org.hibernate.persister.entity.EntityPersister;
import org.hibernate.proxy.HibernateProxy;
import org.springframework.stereotype.Component;

/**
 * Ghi lịch sử thay đổi dữ liệu: mỗi lần Hibernate cập nhật một bản ghi của bảng được theo dõi, mỗi trường
 * đổi giá trị thành một dòng {@code data_changes} — giá trị trước, giá trị sau, ai, lúc nào.
 *
 * <p>Nghe ở tầng ORM ({@link PostUpdateEventListener}), không ở từng service: một service quên gọi là một lỗ hổng
 * trong lịch sử, còn ở đây mọi lối sửa đi qua Hibernate đều để lại vết. Ghi bằng JDBC trên CHÍNH kết nối của phiên
 * ({@code doWork}) trong lúc flush — cùng giao dịch, nên lần sửa lùi lại thì dòng lịch sử cũng lùi theo. Không dùng
 * TransactionSynchronization: Spring gọi beforeCommit TRƯỚC khi Hibernate flush lúc commit, sự kiện đến sau thì mất.
 *
 * <p>Theo dõi: danh mục dùng chung ({@link CatalogEntity}), và các bảng ở {@link #TABLES}. Không theo dõi tài sản và
 * phiếu — chúng có lịch sử riêng ({@code equipment_history}, {@code voucher_events}). Bỏ qua các trường kỹ thuật
 * ({@link #SKIP}); mật khẩu chỉ ghi "đã đổi", không ghi giá trị.
 */
@Component
class DataChangeRecorder implements PostUpdateEventListener, PostInsertEventListener, PostDeleteEventListener {

    /** Bảng ngoài danh mục dùng chung mà một lần sửa đáng để lại vết. */
    private static final Set<String> TABLES = Set.of("schools", "departments_of_education", "staff", "rooms",
            "buildings", "campuses", "school_classes", "subject_teams", "users",
            "school_code_rules", "approval_flows");

    /**
     * Bảng ghi cả lần THÊM và XOÁ một bản ghi (không chỉ sửa) — danh mục tối thiểu là danh sách phẳng, thêm / sửa / xoá
     * trực tiếp, nhật ký là thứ duy nhất giữ lại "ai bỏ thiết bị nào lúc nào" (trưởng nhóm 17/11/2026).
     */
    private static final Set<String> WHOLE_RECORD = Set.of("equipment_norms");

    /** Trường kỹ thuật, tự đổi theo thao tác khác — ghi vào chỉ làm lịch sử rối. */
    private static final Set<String> SKIP = Set.of("updatedAt", "updatedById", "createdAt", "createdById", "version",
            "lastLoginAt", "failedLoginCount", "loginLockedUntil", "mfaSecret", "mfaFailedAttempts", "mfaLockedUntil",
            "emailCodeHash", "emailCodeExpiresAt", "emailCodeSentAt", "passwordChangedAt");

    /** Trường bí mật: chỉ ghi là đã đổi. */
    private static final Map<String, String> SECRET = Map.of("passwordHash", "password");

    private static final String INSERT = "INSERT INTO data_changes (created_at, actor_id, actor_name, resource,"
            + " record_id, record_label, field, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    private static final int MAX = 1000;

    private final EntityManagerFactory emf;
    private final ActorNames actors;

    DataChangeRecorder(EntityManagerFactory emf, ActorNames actors) {
        this.emf = emf;
        this.actors = actors;
    }

    @PostConstruct
    void register() {
        emf.unwrap(SessionFactoryImplementor.class).getServiceRegistry().requireService(EventListenerRegistry.class)
                .appendListeners(EventType.POST_UPDATE, this);
        emf.unwrap(SessionFactoryImplementor.class).getServiceRegistry().requireService(EventListenerRegistry.class)
                .appendListeners(EventType.POST_INSERT, this);
        emf.unwrap(SessionFactoryImplementor.class).getServiceRegistry().requireService(EventListenerRegistry.class)
                .appendListeners(EventType.POST_DELETE, this);
    }

    @Override
    public boolean requiresPostCommitHandling(EntityPersister persister) {
        return false;
    }

    @Override
    public void onPostUpdate(PostUpdateEvent event) {
        Object entity = event.getEntity();
        String resource = resourceOf(entity);
        Object[] before = event.getOldState();
        if (resource == null || before == null || !(event.getId() instanceof Number id)) {
            return;
        }
        Object[] after = event.getState();
        String[] names = event.getPersister().getPropertyNames();
        int[] dirty = event.getDirtyProperties();
        List<String[]> rows = new ArrayList<>();
        for (int i = 0; i < names.length; i++) {
            if (dirty != null && !contains(dirty, i)) {
                continue;
            }
            String field = names[i];
            if (SKIP.contains(field) || after[i] instanceof Collection<?>) {
                continue;
            }
            String oldText = text(before[i]);
            String newText = text(after[i]);
            if (Objects.equals(oldText, newText)) {
                continue;
            }
            if (SECRET.containsKey(field)) {
                rows.add(new String[] {SECRET.get(field), null, "(đã đổi)"});
            } else {
                rows.add(new String[] {field, oldText, newText});
            }
        }
        if (rows.isEmpty()) {
            return;
        }
        Long actorId = CurrentUser.id().orElse(null);
        String actorName = actorId == null ? "Hệ thống" : actors.current();
        String label = cut(label(entity), 255);
        Timestamp now = Timestamp.from(Instant.now());
        event.getSession().doWork(connection -> {
            try (PreparedStatement ps = connection.prepareStatement(INSERT)) {
                for (String[] row : rows) {
                    ps.setTimestamp(1, now);
                    if (actorId == null) {
                        ps.setNull(2, Types.BIGINT);
                    } else {
                        ps.setLong(2, actorId);
                    }
                    ps.setString(3, cut(actorName, 150));
                    ps.setString(4, resource);
                    ps.setLong(5, id.longValue());
                    ps.setString(6, label);
                    ps.setString(7, row[0]);
                    ps.setString(8, cut(row[1], MAX));
                    ps.setString(9, cut(row[2], MAX));
                    ps.addBatch();
                }
                ps.executeBatch();
            }
        });
    }

    @Override
    public void onPostInsert(PostInsertEvent event) {
        whole(event.getEntity(), event.getId(), event.getSession(), "(thêm)", null, true);
    }

    @Override
    public void onPostDelete(PostDeleteEvent event) {
        whole(event.getEntity(), event.getId(), event.getSession(), "(xoá)", null, false);
    }

    /** Một dòng nhật ký cho cả bản ghi: thêm (giá trị mới = nhãn) hoặc xoá (giá trị cũ = nhãn). */
    private void whole(Object entity, Object rawId, SharedSessionContractImplementor session, String field,
            String unused, boolean added) {
        Table table = entity.getClass().getAnnotation(Table.class);
        if (table == null || !WHOLE_RECORD.contains(table.name()) || !(rawId instanceof Number id)) {
            return;
        }
        Long actorId = CurrentUser.id().orElse(null);
        String actorName = actorId == null ? "Hệ thống" : actors.current();
        String label = cut(label(entity), 255);
        Timestamp now = Timestamp.from(Instant.now());
        session.doWork(connection -> {
            try (PreparedStatement ps = connection.prepareStatement(INSERT)) {
                ps.setTimestamp(1, now);
                if (actorId == null) {
                    ps.setNull(2, Types.BIGINT);
                } else {
                    ps.setLong(2, actorId);
                }
                ps.setString(3, cut(actorName, 150));
                ps.setString(4, table.name());
                ps.setLong(5, id.longValue());
                ps.setString(6, label);
                ps.setString(7, field);
                ps.setString(8, added ? null : label);
                ps.setString(9, added ? label : null);
                ps.executeUpdate();
            }
        });
    }

    /** Tên bảng của entity nếu nó được theo dõi, không thì {@code null}. */
    private static String resourceOf(Object entity) {
        Table table = entity.getClass().getAnnotation(Table.class);
        if (table == null) {
            return null;
        }
        return entity instanceof CatalogEntity || TABLES.contains(table.name()) ? table.name() : null;
    }

    private static boolean contains(int[] values, int target) {
        for (int v : values) {
            if (v == target) {
                return true;
            }
        }
        return false;
    }

    /** Giá trị đọc được: tham chiếu thì tên / mã của bản ghi kia, enum thì tên hằng, còn lại chuỗi. */
    private static String text(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Enum<?> e) {
            return e.name();
        }
        if (value instanceof HibernateProxy || value.getClass().isAnnotationPresent(Entity.class)) {
            return label(value);
        }
        String s = value.toString();
        return s.isBlank() ? null : s;
    }

    /** Nhãn của một bản ghi: tên, không có thì mã, tên đăng nhập, cuối cùng là id. Danh mục tối thiểu: "mã · tên". */
    private static String label(Object entity) {
        Table table = entity.getClass().getAnnotation(Table.class);
        if (table != null && WHOLE_RECORD.contains(table.name())) {
            try {
                Object code = entity.getClass().getMethod("getCode").invoke(entity);
                Object name = entity.getClass().getMethod("getName").invoke(entity);
                return code + " · " + name;
            } catch (ReflectiveOperationException ignored) {
                // rơi xuống cách chung
            }
        }
        for (String getter : List.of("getName", "getFullName", "getCode", "getDocumentNo", "getUsername")) {
            try {
                Method m = entity.getClass().getMethod(getter);
                Object v = m.invoke(entity);
                if (v != null && !v.toString().isBlank()) {
                    return v.toString();
                }
            } catch (ReflectiveOperationException ignored) {
                // Không có getter đó — thử cái kế.
            }
        }
        try {
            return "#" + entity.getClass().getMethod("getId").invoke(entity);
        } catch (ReflectiveOperationException e) {
            return null;
        }
    }

    private static String cut(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
