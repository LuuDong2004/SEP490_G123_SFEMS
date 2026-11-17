package com.g123.sfems.module.catalog.base;

import org.springframework.data.jpa.domain.Specification;

/**
 * Phạm vi CƠ SỞ của một loại dữ liệu trường — hẹp hơn phạm vi dòng (trường), áp SAU nó. Tài khoản trường có thể bị
 * giới hạn trong một cơ sở ({@code user_schools.campus_id}, 267): khi đó chỉ thấy, chỉ sửa dòng của cơ sở đó. Dòng
 * không suy ra được cơ sở thuộc cơ sở chính.
 *
 * <p>{@link CatalogService} gọi nó ở mọi đường đọc / ghi khi lớp con trả về một rule ở {@code campusRule()} —
 * {@code CampusScope} (slice CSVC) dựng rule cho từng loại.
 */
public interface CampusRule<T> {

    /** Dòng thuộc cơ sở của người gọi; người gọi không bị giới hạn thì không lọc gì. */
    Specification<T> pinned();

    /** Dòng có cơ sở thực là {@code campusId} — bộ lọc {@code campus=} của danh sách. */
    Specification<T> inCampus(long campusId);

    /** Từ chối (422) bản ghi nằm ngoài cơ sở của người gọi — trước khi sửa / xoá và sau khi gán giá trị mới. */
    void requireWritable(T item);
}
