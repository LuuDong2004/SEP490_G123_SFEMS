package com.g123.sfems.module.catalog.educationlevel.service;

import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.module.catalog.coderule.CodeGenerator;
import com.g123.sfems.module.catalog.educationlevel.api.dto.EducationLevelPatchRequest;
import com.g123.sfems.module.catalog.educationlevel.api.dto.EducationLevelRequest;
import com.g123.sfems.module.catalog.educationlevel.repo.EducationLevelRepository;
import com.g123.sfems.module.catalog.educationlevel.repo.EducationLevelSpecifications;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.web.ListParams;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Logic riêng của cấp học, và là cửa vào cho các feature khác cần phân giải
 * một cấp học — {@code schools} sẽ đi qua {@link #get(Long)} chứ không qua
 * {@code EducationLevelRepository}, để một id không tồn tại sinh ra đúng lỗi
 * 404 mà chính endpoint của resource này sinh ra.
 */
@Service
@Transactional(readOnly = true)
public class EducationLevelService {

    /** Thuộc tính được phép sắp xếp; ngoài danh sách này thì bỏ qua. */
    private static final Set<String> SORTABLE =
            Set.of("id", "code", "name", "shortName", "sortOrder", "active", "createdAt", "updatedAt");

    /**
     * Mặc định xếp theo {@code sortOrder} rồi mới tới tên. Cấp học có trật tự
     * tự nhiên mà tên không nói lên được — xếp theo tên thì "THCS" đứng trước
     * "Tiểu học", trông như đang hoạt động nhưng trả lời một câu khác.
     * {@code id} chốt lại ở cuối để thứ tự ổn định giữa các trang khi hai bản
     * ghi cùng {@code sortOrder}.
     */
    private static final Sort DEFAULT_SORT =
            Sort.by(Sort.Order.asc("sortOrder"), Sort.Order.asc("name"), Sort.Order.asc("id"));

    private final EducationLevelRepository repository;

    // Chỉ để đóng dấu người gọi được làm gì với từng dòng. Với danh mục toàn
    // cục thì phạm vi luôn là tất cả, nhưng đi qua cùng một đường với mọi
    // resource khác nghĩa là không có ngoại lệ nào phải nhớ.
    private final RowLevelSecurity rowLevel;

    private final CodeGenerator codeGenerator;

    public EducationLevelService(
            EducationLevelRepository repository,
            RowLevelSecurity rowLevel,
            CodeGenerator codeGenerator) {
        this.repository = repository;
        this.rowLevel = rowLevel;
        this.codeGenerator = codeGenerator;
    }

    public Page<EducationLevel> list(ListParams params) {
        return repository.findAll(
                // Phạm vi trước, bộ lọc của người gọi sau: Specification.and
                // không có phép trừ, nên không query string nào nới rộng được.
                rowLevel.scope(EducationLevel.class, Action.READ)
                        .and(EducationLevelSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public EducationLevel get(Long id) {
        return repository.findOne(rowLevel.byId(EducationLevel.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException("EducationLevel", id));
    }

    /** Phân giải các id mà một request {@code getMany} hỏi, trong một truy vấn. */
    public List<EducationLevel> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(EducationLevel.class, Action.READ, ids));
    }

    @Transactional
    public EducationLevel create(EducationLevelRequest request) {
        String code = codeGenerator.resolveOnCreate("education_levels", request.code().trim());
        requireCodeAvailable(code, null);

        EducationLevel level = new EducationLevel(code, request.name().trim());
        level.setShortName(trimToNull(request.shortName()));
        level.setSortOrder(request.sortOrder());
        level.setActive(request.active());
        level.setNote(trimToNull(request.note()));

        EducationLevel saved = repository.persist(level);
        // Đẩy xuống DB trước: khoá định danh và dấu @PrePersist chỉ tồn tại sau
        // đó, và kiểm một chính sách trên bản ghi chưa dựng xong thì sai trong
        // mọi trường hợp.
        repository.flush();
        rowLevel.checkWritable(saved);
        return saved;
    }

    @Transactional
    public EducationLevel update(Long id, EducationLevelPatchRequest request) {
        // USING, trên trạng thái hiện tại. Ngoài phạm vi là 404, cố ý không
        // phân biệt được với "không có cấp học nào như vậy".
        EducationLevel level = repository
                .findOne(rowLevel.byId(EducationLevel.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("EducationLevel", id));

        if (request.code() != null) {
            String code = request.code().trim();
            requireCodeAvailable(code, level.getId());
            level.setCode(code);
        }
        if (request.name() != null) {
            level.setName(request.name().trim());
        }
        if (request.shortName() != null) {
            level.setShortName(trimToNull(request.shortName()));
        }
        if (request.sortOrder() != null) {
            level.setSortOrder(request.sortOrder());
        }
        if (request.active() != null) {
            level.setActive(request.active());
        }
        if (request.note() != null) {
            level.setNote(trimToNull(request.note()));
        }

        // WITH CHECK, trên trạng thái mà lần ghi này để lại.
        rowLevel.checkWritable(level);
        return repository.persist(level);
    }

    /**
     * Xoá một cấp học.
     *
     * <p>Cấp học còn trường trỏ vào sẽ bị khoá ngoại {@code RESTRICT} trên
     * {@code schools} từ chối, và nổi lên thành đúng lỗi 409 mà một danh mục
     * đang được dùng vẫn sinh ra. Đếm số trường ở đây thay vì vậy sẽ là đọc
     * bảng của feature khác từ bên trong feature này — đúng thứ cách chia gói
     * sinh ra để ngăn.
     *
     * <p>Với danh mục, xoá hiếm khi là việc đúng: ngưng dùng bằng cờ
     * {@code active} giữ được các bản ghi cũ đang trỏ vào nó. Endpoint xoá vẫn
     * có, cho những mục vừa tạo nhầm.
     */
    @Transactional
    public EducationLevel delete(Long id) {
        // Hành động riêng, không phải đọc rồi xoá: có người được nhìn thấy một
        // dòng mà không được phép gỡ nó đi.
        EducationLevel level = repository
                .findOne(rowLevel.byId(EducationLevel.class, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException("EducationLevel", id));
        repository.remove(level);
        // Trả về để controller vọng lại bản ghi vừa xoá: data provider có phân
        // tích body của DELETE.
        return level;
    }

    /** Từ chối mã trùng bằng thông báo nói về trường, không phải về index. */
    private void requireCodeAvailable(String code, Long selfId) {
        repository.findByCodeIgnoreCase(code).ifPresent(existing -> {
            if (!existing.getId().equals(selfId)) {
                throw new ConflictException("Cấp học có mã %s đã tồn tại".formatted(code));
            }
        });
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
