package com.g123.sfems.module.organization.school.repo;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.shared.data.SecuredRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;

/**
 * {@link SecuredRepository}, nên {@code findById} và {@code findAll()} không có
 * ở đây để gọi nhầm.
 *
 * <p>Đây là repository sẽ quan trọng nhất khi trường được đưa vào diện phân
 * quyền dòng: mọi đường đọc bắt buộc phải nhận một {@code Specification}, nên
 * không có chỗ nào đọc được toàn bộ danh sách trường mà quên phạm vi.
 */
public interface SchoolRepository extends SecuredRepository<School, Long> {

    /**
     * Phục vụ kiểm tra trùng mã trường, không phân biệt hoa thường.
     *
     * <p>Cố ý KHÔNG có phạm vi, và ở đây điều đó đáng chú ý hơn mọi nơi khác:
     * ngày trường được scope theo người dùng, một người chỉ thấy trường của
     * mình vẫn phải bị từ chối khi gõ trùng mã của một trường họ không thấy.
     * Thêm phạm vi vào đây sẽ biến unique index thành nơi phát hiện lỗi, và
     * người dùng nhận một thông báo về constraint thay vì về trường.
     *
     * <p>Nó rò đúng một bit — rằng mã nào đó đang được dùng — cho người vốn đã
     * được phép tạo trường. Đó là vấn đề nhỏ hơn nhiều so với vấn đề kia.
     */
    Optional<School> findByCodeIgnoreCase(String code);

    /**
     * Mọi mã hai ký tự đang dùng — để cấp mã mới không trùng. Cố ý KHÔNG có phạm vi, cùng lý do
     * với {@link #findByCodeIgnoreCase}: trùng với một trường người gọi không thấy vẫn là trùng.
     */
    @Query("SELECT upper(s.shortCode) FROM School s WHERE s.shortCode IS NOT NULL")
    List<String> findAllShortCodes();
}
