package com.g123.sfems.domain.base;

import com.g123.sfems.shared.security.CurrentUser;
import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import java.time.Instant;
import java.util.Objects;

/**
 * Khoá chính và vết tạo/sửa, dùng chung cho mọi entity nghiệp vụ.
 *
 * <p>Đây là thứ đã có sẵn ở mọi entity của nền này dưới dạng chép tay —
 * {@code Organization}, {@code Department} và {@code Task} đều lặp lại nguyên
 * khối {@code createdAt}/{@code updatedAt} kèm {@code @PrePersist}. Nâng nó lên
 * một {@code @MappedSuperclass} không đổi hành vi gì, chỉ bỏ chỗ để quên.
 *
 * <h2>Ba thứ cố ý KHÔNG có ở đây</h2>
 *
 * <p><b>Không xoá mềm.</b> Bản Jmix có, vì Jmix kèm luôn bộ lọc tự động ở mọi
 * truy vấn. Nền này không có bộ lọc đó, nên một cột {@code deleted_at} sẽ bắt
 * từng truy vấn phải tự nhớ loại trừ — quên một lần là rò dữ liệu đã xoá, im
 * lặng. Nền đã có câu trả lời riêng cho "đừng mất dữ liệu" và nó mạnh hơn:
 * khoá ngoại {@code RESTRICT} khắp nơi, tức là không xoá được thứ còn được
 * tham chiếu. Còn "giữ lại thiết bị đã thanh lý" là <em>trạng thái nghiệp
 * vụ</em>, không phải cờ đã-xoá.
 *
 * <p><b>Không {@code @Version}.</b> Khoá lạc quan buộc mọi {@code PATCH} phải
 * mang theo số phiên bản, tức là đổi hợp đồng API mà cả hai phía đang giữ bằng
 * tay. Thêm sau rẻ hơn gỡ ra.
 *
 * <p><b>{@code createdById} là {@code Long}, không phải {@code @ManyToOne
 * User}.</b> Cột này nằm trên <em>mọi</em> bảng, nên giá phải trả lúc ghi mới
 * là thứ đáng quan tâm: {@link CurrentUser#id()} đọc thẳng từ
 * {@code SecurityContextHolder} — không truy vấn, không bean, không vòng phụ
 * thuộc. Một {@code @ManyToOne} sẽ cần một instance {@code User} thật, tức là
 * một truy vấn cho mỗi lần ghi, để phục vụ một cái tên hiếm khi được hiển thị.
 * Khoá ngoại vẫn có thật, khai trong Liquibase kèm {@code ON DELETE SET NULL}:
 * ai tạo bản ghi là thứ đáng giữ, nhưng không đáng để từ chối xoá một tài
 * khoản đã nghỉ việc. Entity nào thực sự <em>hiển thị</em> người tạo thì khai
 * quan hệ riêng của nó — {@code Task.createdBy} làm đúng như vậy, và đó là
 * quan hệ nghiệp vụ, không phải cột audit.
 */
@MappedSuperclass
public abstract class BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    /**
     * Id tài khoản đã tạo bản ghi, hoặc {@code null} khi không có ai đăng nhập
     * — khởi động, job theo lịch, luồng đăng nhập. Xem javadoc của lớp về việc
     * vì sao đây là {@code Long} chứ không phải một quan hệ.
     */
    @Column(name = "created_by_id", updatable = false)
    private Long createdById;

    @Column(name = "updated_by_id")
    private Long updatedById;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (createdById == null) {
            createdById = CurrentUser.id().orElse(null);
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
        updatedById = CurrentUser.id().orElse(null);
    }

    public Long getId() {
        return id;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Long getCreatedById() {
        return createdById;
    }

    public Long getUpdatedById() {
        return updatedById;
    }

    /**
     * Định danh theo khoá chính — thoả hiệp quen thuộc của JPA, trong đó một
     * instance chưa được lưu chỉ bằng chính nó.
     *
     * <p>{@code getClass()} chứ không phải {@code instanceof}: hai entity khác
     * bảng có cùng id sẽ không được coi là bằng nhau. Với một lớp cha dùng
     * chung thì điều đó là bắt buộc — {@code instanceof BaseEntity} sẽ làm
     * {@code EducationLevel#1} bằng {@code School#1}.
     */
    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (other == null || getClass() != other.getClass()) {
            return false;
        }
        return id != null && id.equals(((BaseEntity) other).id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
