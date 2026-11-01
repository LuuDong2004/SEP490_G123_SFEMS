package com.g123.sfems.domain.school.base;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.organization.School;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;

/**
 * Dữ liệu THUỘC MỘT TRƯỜNG (phòng, thiết bị, đợt kiểm kê...): cùng năm trường chung của danh mục
 * (mã, tên, thứ tự, đang dùng, ghi chú), cộng trường sở hữu.
 *
 * <p>Phân quyền dòng dựa trên {@link #school}: cán bộ trường chỉ thấy dòng có
 * {@code school.id = user.schoolId}. Trường là khoá ngoại BẮT BUỘC, nên không có dòng "vô chủ" nào
 * để rò sang trường khác.
 *
 * <p>Mã chỉ cần duy nhất TRONG một trường — hai trường cùng có phòng "P101" là bình thường. Bảng của
 * lớp con khai unique {@code (school_id, code)} trong changelog, KHÔNG khai unique trên {@code code}
 * một mình (cột {@code code} kế thừa có {@code unique = true} chỉ là chú thích cho Hibernate; Liquibase
 * mới là nơi quyết định ràng buộc thật).
 */
@MappedSuperclass
public abstract class SchoolOwnedEntity extends CatalogEntity {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    public School getSchool() {
        return school;
    }

    public void setSchool(School school) {
        this.school = school;
    }
}
