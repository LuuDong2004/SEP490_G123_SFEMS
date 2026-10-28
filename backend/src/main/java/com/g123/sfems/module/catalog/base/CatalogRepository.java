package com.g123.sfems.module.catalog.base;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.shared.data.SecuredRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.NoRepositoryBean;

/**
 * Repository chung cho các danh mục cùng hình dạng {@link CatalogEntity}.
 *
 * <p>{@code @NoRepositoryBean}: bản thân interface này không phải một bean — mỗi
 * danh mục khai một interface con rỗng, và Spring Data dựng bean cho interface
 * con đó.
 *
 * <p>{@link #findByCodeIgnoreCase} cố ý KHÔNG có phạm vi: mã là duy nhất trên
 * toàn bảng, nên câu hỏi "mã này có ai dùng chưa" phải nhìn được mọi dòng. Đây
 * là phương thức đọc không phạm vi duy nhất, và nó nằm ở MỘT chỗ thay vì lặp
 * lại trong từng repository danh mục.
 */
@NoRepositoryBean
public interface CatalogRepository<T extends CatalogEntity> extends SecuredRepository<T, Long> {

    Optional<T> findByCodeIgnoreCase(String code);

    /**
     * Các dòng mang đúng tên này (không phân biệt hoa thường), trên toàn bảng — cùng lý do không phạm
     * vi với {@link #findByCodeIgnoreCase}. Trả danh sách chứ không phải một dòng: dữ liệu có từ
     * trước khi luật trùng tên ra đời có thể đã trùng sẵn, và câu hỏi không được vỡ vì điều đó.
     */
    List<T> findByNameIgnoreCase(String name);
}
