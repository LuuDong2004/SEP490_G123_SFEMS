package com.g123.sfems.module.organization.departmentofeducation.repo;

import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.shared.data.SecuredRepository;
import java.util.Optional;

/**
 * {@link SecuredRepository}, nên {@code findById} và {@code findAll()} không có
 * ở đây để gọi nhầm.
 */
public interface DepartmentOfEducationRepository
        extends SecuredRepository<DepartmentOfEducation, Long> {

    /**
     * Phục vụ kiểm tra trùng mã, không phân biệt hoa thường.
     *
     * <p>Cố ý KHÔNG có phạm vi: mã là duy nhất trên toàn bảng, nên câu hỏi "mã
     * này có ai dùng chưa" buộc phải nhìn được cả những dòng người gọi không
     * thấy. Thêm phạm vi vào đây sẽ cho phép hai đơn vị cùng mã được tạo bởi
     * hai người không thấy nhau, và unique index sẽ từ chối người thứ hai bằng
     * một thông báo về constraint thay vì về trường.
     */
    Optional<DepartmentOfEducation> findByCodeIgnoreCase(String code);
}
