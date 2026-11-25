package com.g123.sfems.domain.catalog.subject;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;
import org.hibernate.annotations.BatchSize;

/**
 * Môn học — Toán, Vật lý, Hoạt động trải nghiệm... cùng với các cấp học mà môn
 * đó được dạy, và ở mỗi cấp nó là bắt buộc hay tự chọn.
 *
 * <p>Năm trường chung ở {@link CatalogEntity}; lớp này thêm mã dạy học và danh
 * sách cấp học.
 */
@Entity
@Table(name = "subjects")
public class Subject extends CatalogEntity {

    /** Mã môn theo chương trình dạy học (ví dụ 22), khác với mã danh mục. */
    @Column(name = "teaching_code", length = 32)
    private String teachingCode;

    /**
     * Các cấp học mà môn được dạy.
     *
     * <p>{@code Set} chứ không {@code List}: tổ chuyên môn nạp môn học EAGER, và
     * môn học lại nạp danh sách này EAGER — hai "bag" ({@code List} không thứ tự)
     * lồng nhau trong cùng một lần nạp là {@code MultipleBagFetchException} ngay
     * lúc khởi động. {@code @OrderBy} vẫn giữ thứ tự, vì Hibernate dùng
     * {@code LinkedHashSet} cho một {@code Set} có thứ tự.
     *
     * <p>{@code EAGER} vì DTO được ánh xạ sau khi transaction đã đóng.
     * {@code @BatchSize} để màn danh sách nạp các dòng con theo lô thay vì một
     * truy vấn cho mỗi môn.
     *
     * <p>{@code orphanRemoval}: gỡ một cấp khỏi danh sách là XOÁ dòng đó — nó
     * không có ý nghĩa gì khi đứng một mình.
     */
    @OneToMany(mappedBy = "subject", cascade = CascadeType.ALL, orphanRemoval = true,
            fetch = FetchType.EAGER)
    @OrderBy("sortOrder ASC, id ASC")
    @BatchSize(size = 100)
    private Set<SubjectEducationLevel> educationLevels = new LinkedHashSet<>();

    public String getTeachingCode() {
        return teachingCode;
    }

    public void setTeachingCode(String teachingCode) {
        this.teachingCode = teachingCode;
    }

    /**
     * Tập sống — sửa trực tiếp trên đây. KHÔNG thay bằng một tập mới:
     * {@code orphanRemoval} chỉ hoạt động khi Hibernate còn theo dõi đúng
     * collection nó đã nạp; gán tập mới là "A collection with
     * cascade=all-delete-orphan was no longer referenced" lúc flush.
     */
    public Set<SubjectEducationLevel> getEducationLevels() {
        return educationLevels;
    }
}
