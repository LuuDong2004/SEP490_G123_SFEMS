package com.g123.sfems.module.school.base;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.base.SchoolOwnedEntity;
import com.g123.sfems.shared.security.rowlevel.DefaultScope;
import com.g123.sfems.shared.security.rowlevel.FieldDescriptor;
import com.g123.sfems.shared.security.rowlevel.RowLevelPolicySet;
import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * Chính sách phân quyền dòng chung cho dữ liệu thuộc trường. Lớp con chỉ khai tên resource và kiểu
 * entity:
 *
 * <pre>{@code
 * @Component
 * class RoomPolicies extends SchoolOwnedPolicies<Room> {
 *     public String resource() { return "rooms"; }
 *     public Class<Room> entityClass() { return Room.class; }
 * }
 * }</pre>
 *
 * <p>{@code NONE}: vai trò chưa có phạm vi thì KHÔNG thấy gì — quên chính sách là một màn hình trống,
 * không phải dữ liệu rò sang trường khác. Phạm vi của từng vai trò seed ở changelog 010 cho các
 * resource đã biết; resource mới thì người phụ trách thêm dòng seed trong changelog của mình.
 */
public abstract class SchoolOwnedPolicies<T extends SchoolOwnedEntity> implements RowLevelPolicySet<T> {

    @Override
    public DefaultScope defaultScope() {
        return DefaultScope.NONE;
    }

    /** {@code school.id} là ranh giới bảo mật; {@code active} cho phạm vi kiểu "chỉ dòng đang hoạt động". */
    @Override
    public List<FieldDescriptor> fields() {
        return List.of(
                FieldDescriptor.id("id"),
                FieldDescriptor.reference("school", School.class),
                FieldDescriptor.column("active", Boolean.class, false),
                FieldDescriptor.column("createdAt", Instant.class, false));
    }

    @Override
    public Set<String> notCheckSafe() {
        return Set.of("id", "createdAt", "updatedAt");
    }
}
