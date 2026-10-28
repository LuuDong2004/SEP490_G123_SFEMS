package com.g123.sfems.domain.catalog.educationlevel;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Cấp học: Mầm non, Tiểu học, THCS, THPT.
 *
 * <p>Đây là danh mục được viết đầu tiên, trước khi {@link CatalogEntity} tồn
 * tại, nên nó từng chép lại cả năm trường của lớp cơ sở. Giờ nó kế thừa như
 * mười lăm danh mục còn lại — cùng một hình dạng thì phải cùng một chỗ định
 * nghĩa, nếu không thì sửa quy tắc chung ở lớp cơ sở sẽ bỏ sót đúng cái danh
 * mục được dùng nhiều nhất.
 *
 * <p>Việc gộp này KHÔNG đổi schema: năm cột kế thừa trùng khít với năm cột
 * từng khai ở đây, nên {@code ddl-auto=validate} vẫn khớp mà không cần
 * migration.
 *
 * <p>Cấp học là thứ quyết định trường do ai quản lý — THPT thuộc Sở, Tiểu học
 * và THCS thuộc UBND — nên nó là đầu vào gián tiếp của phân quyền dòng.
 */
@Entity
@Table(name = "education_levels")
public class EducationLevel extends CatalogEntity {

    /**
     * Tên rút gọn dùng ở chỗ hẹp — cột lưới, chip, nhãn in.
     *
     * <p>Trường riêng của danh mục này, không đưa lên lớp cơ sở: phần lớn danh
     * mục không có tên viết tắt, và đưa lên đó là thêm một cột rỗng cho mười
     * lăm bảng.
     */
    @Column(name = "short_name", length = 64)
    private String shortName;

    protected EducationLevel() {
        // JPA
    }

    public EducationLevel(String code, String name) {
        setCode(code);
        setName(name);
    }

    public String getShortName() {
        return shortName;
    }

    public void setShortName(String shortName) {
        this.shortName = shortName;
    }
}
