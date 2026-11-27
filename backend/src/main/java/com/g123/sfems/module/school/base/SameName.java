package com.g123.sfems.module.school.base;

import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.FlushModeType;
import java.util.List;
import java.util.Objects;

/**
 * Tên trùng trong một phạm vi (cơ sở của trường, khối nhà của cơ sở, tổ của trường): hai dòng cùng tên thì ô chọn không
 * phân biệt được. Chỉ kiểm lúc ghi và chỉ khi tên / phạm vi ĐỔI — dữ liệu cũ vốn trùng vẫn sửa được ô khác.
 */
public final class SameName {

    private SameName() {
    }

    /**
     * {@code true} khi một bản ghi khác đang dùng cùng phạm vi đã mang tên của {@code item} (không phân biệt hoa thường).
     *
     * @param scope đường tới thực thể cha trên {@code entity}, vd. {@code "campus"}, {@code "school"}
     */
    public static boolean taken(EntityManager em, Class<? extends SchoolOwnedEntity> entity, SchoolOwnedEntity item,
            String scope, Long scopeId) {
        String name = item.getName() == null ? null : item.getName().trim();
        if (name == null || name.isEmpty() || scopeId == null || Boolean.FALSE.equals(item.getActive())) {
            return false;
        }
        String type = entity.getSimpleName();
        if (item.getId() != null) {
            // COMMIT: đọc giá trị còn trong DB, không đẩy bản đang sửa xuống trước.
            List<Object[]> before = em.createQuery("SELECT e.name, e." + scope + ".id, e.active FROM " + type
                            + " e WHERE e.id = :id", Object[].class)
                    .setFlushMode(FlushModeType.COMMIT)
                    .setParameter("id", item.getId())
                    .getResultList();
            if (!before.isEmpty()) {
                Object[] row = before.get(0);
                if (row[0] != null && name.equalsIgnoreCase(row[0].toString().trim())
                        && Objects.equals(row[1], scopeId) && Boolean.TRUE.equals(row[2])) {
                    return false;
                }
            }
        }
        Long n = em.createQuery("SELECT count(e) FROM " + type + " e WHERE e." + scope + ".id = :scope"
                        + " AND e.active = true AND lower(trim(e.name)) = lower(:name) AND e.id <> :self", Long.class)
                .setFlushMode(FlushModeType.COMMIT)
                .setParameter("scope", scopeId)
                .setParameter("name", name)
                .setParameter("self", item.getId() == null ? -1L : item.getId())
                .getSingleResult();
        return n > 0;
    }
}
