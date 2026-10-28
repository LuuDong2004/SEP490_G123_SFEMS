package com.g123.sfems.module.catalog.educationlevel.repo;

import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.shared.data.SecuredRepository;
import java.util.Optional;

/**
 * {@link SecuredRepository}, nên {@code findById}, {@code findAll()} và
 * {@code findAllById} không có ở đây để gọi nhầm.
 *
 * <p>Với một danh mục toàn cục thì phạm vi luôn là "tất cả", nhưng vẫn kế thừa
 * {@code SecuredRepository} chứ không phải {@code JpaRepository}: ngày một
 * danh mục nào đó cần phạm vi theo trường, việc phải làm là thêm một policy
 * set — chứ không phải đi tìm xem những chỗ đọc nào đã lỡ đi đường không có
 * phạm vi.
 */
public interface EducationLevelRepository extends SecuredRepository<EducationLevel, Long> {

    /**
     * Phục vụ việc kiểm tra trùng mã. Không phân biệt hoa thường, vì
     * {@code thpt} và {@code THPT} là cùng một mã với tất cả mọi người trừ cái
     * index.
     *
     * <p>Cố ý KHÔNG có phạm vi — và đó chính là lý do một phương thức mới trên
     * secured repository phải nhìn thấy được khi review. Mã là duy nhất trên
     * toàn bảng, nên câu hỏi "mã này có ai dùng chưa" buộc phải nhìn được cả
     * những dòng người gọi không thấy. Ở đây danh mục vốn toàn cục nên không
     * có khác biệt, nhưng viết như vậy để khuôn này chép sang một danh mục có
     * phạm vi vẫn đúng.
     */
    Optional<EducationLevel> findByCodeIgnoreCase(String code);
}
