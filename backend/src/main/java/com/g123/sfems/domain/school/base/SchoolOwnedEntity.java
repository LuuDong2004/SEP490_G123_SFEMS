package com.g123.sfems.domain.school.base;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.organization.School;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;

/**
 * Dữ liệu THUỘC MỘT TRƯỜNG (cán bộ, cơ sở, khối nhà, phòng...): cùng năm trường
 * chung của danh mục, cộng trường sở hữu.
 *
 * <p>Phân quyền dòng dựa trên {@link #school}: cán bộ trường chỉ thấy dòng có
 * {@code school.id = user.schoolId}. Khác bản Jmix ({@code tenantId} chuỗi, NULL
 * nghĩa là ai cũng thấy): ở đây trường là khoá ngoại BẮT BUỘC, nên không có dòng
 * "vô chủ" nào để rò sang trường khác.
 *
 * <p>Mã chỉ cần duy nhất TRONG một trường — hai trường cùng có cán bộ "CB0001"
 * là bình thường. Database giữ bằng unique {@code (school_id, code)}.
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
