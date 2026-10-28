package com.g123.sfems.domain.catalog.base;

import com.g123.sfems.domain.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;

/**
 * Hình dạng chung của một danh mục dùng chung: mã, tên, thứ tự, cờ còn dùng,
 * ghi chú.
 *
 * <p>Bản Jmix có khoảng hai chục danh mục, và năm trong số đó — loại thiết bị,
 * đơn vị tính, nguồn hình thành, hình thức mua sắm, học kỳ — có ĐÚNG hình dạng
 * này và không thêm gì. Chép khuôn {@code education_levels} năm lần là
 * khoảng bảy mươi lăm file giống nhau gần từng chữ, và mỗi lần sửa một quy tắc
 * (độ dài mã, cách sắp xếp mặc định) là phải sửa năm chỗ. Lớp này và phần
 * {@code module/catalog/base} đi kèm giữ quy tắc ở MỘT chỗ; mỗi danh mục chỉ
 * còn là một entity rỗng cộng ba lớp vài dòng.
 *
 * <p>{@code EducationLevel} cố ý KHÔNG dùng lớp này: nó có thêm
 * {@code shortName}, và nó được viết trước làm bản mẫu tường minh. Danh mục
 * nào có trường riêng (khối lớp trỏ tới cấp học, loại phòng có nhóm phòng...)
 * thì hoặc kế thừa rồi thêm trường, hoặc viết riêng như {@code EducationLevel}
 * — tuỳ phần khác biệt lớn tới đâu.
 */
@MappedSuperclass
public abstract class CatalogEntity extends BaseEntity {

    /** Mã ổn định. Duy nhất trong bảng, không phân biệt hoa thường. */
    @Column(nullable = false, length = 64, unique = true)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    /**
     * Thứ tự hiển thị. Danh mục thường có trật tự nghiệp vụ mà xếp theo tên
     * không ra đúng ("Khác" phải đứng cuối), nên trật tự đó phải được lưu.
     */
    @Column(name = "sort_order")
    private Integer sortOrder;

    /**
     * Còn dùng hay không. Ngưng dùng thì mục biến mất khỏi các ô chọn nhưng
     * bản ghi cũ trỏ vào nó vẫn đọc được — đó là lý do có cờ này thay vì xoá.
     */
    @Column(nullable = false)
    private Boolean active = Boolean.TRUE;

    @Column(length = 500)
    private String note;

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active == null ? Boolean.TRUE : active;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
