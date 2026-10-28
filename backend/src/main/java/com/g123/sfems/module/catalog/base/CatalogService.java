package com.g123.sfems.module.catalog.base;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.module.catalog.coderule.CodeGenerator;
import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.web.ListParams;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Table;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.transaction.annotation.Transactional;

/**
 * Logic chung của mọi danh mục cùng hình dạng — cùng khuôn với
 * {@code EducationLevelService}, viết một lần.
 *
 * <p>Mỗi danh mục khai một lớp con {@code @Service} gần như rỗng, chỉ để truyền
 * vào kiểu entity, cách dựng một bản ghi mới và nhãn tiếng Việt dùng trong
 * thông báo. Lớp con cũng là cửa vào mà feature khác gọi khi cần phân giải một
 * mục danh mục — đi qua {@link #get(Long)} thì id lạ sinh ra đúng lỗi 404 của
 * chính resource danh mục đó.
 *
 * <p>Vẫn đi qua {@link RowLevelSecurity} dù danh mục là dữ liệu toàn cục: với
 * entity chưa đưa vào diện quản lý, {@code scope()} trả về phạm vi không giới
 * hạn, nên không có ngoại lệ nào phải nhớ — và ngày một danh mục cần phạm vi
 * theo trường, việc phải làm là thêm một policy set chứ không phải đi tìm những
 * đường đọc đã lỡ bỏ qua phạm vi.
 */
@Transactional(readOnly = true)
public abstract class CatalogService<
        T extends CatalogEntity, C extends CatalogInput, P extends CatalogInput> {

    private static final Set<String> SORTABLE =
            Set.of("id", "code", "name", "sortOrder", "active", "createdAt", "updatedAt");

    /**
     * Theo {@code sortOrder} trước, rồi mới tới tên: danh mục có trật tự nghiệp
     * vụ mà tên không nói lên được ("Khác" phải đứng cuối). {@code id} chốt ở
     * cuối để thứ tự ổn định giữa các trang.
     */
    private static final Sort DEFAULT_SORT =
            Sort.by(Sort.Order.asc("sortOrder"), Sort.Order.asc("name"), Sort.Order.asc("id"));

    private final CatalogRepository<T> repository;
    private final RowLevelSecurity rowLevel;
    private final Class<T> type;
    private final Supplier<T> factory;
    private final String label;
    private CodeGenerator codeGenerator;

    /**
     * @param factory dựng một bản ghi trống — entity danh mục có constructor
     *                không tham số, nên thường là {@code Unit::new}
     * @param label   tên danh mục bằng tiếng Việt, cho thông báo trùng mã
     */
    protected CatalogService(
            CatalogRepository<T> repository,
            RowLevelSecurity rowLevel,
            Class<T> type,
            Supplier<T> factory,
            String label) {
        this.repository = repository;
        this.rowLevel = rowLevel;
        this.type = type;
        this.factory = factory;
        this.label = label;
    }

    /**
     * Tiêm qua setter để lớp con không phải truyền thêm tham số constructor —
     * mọi danh mục đều có sinh mã, không danh mục nào phải nhớ nối nó.
     */
    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    void setCodeGenerator(CodeGenerator codeGenerator) {
        this.codeGenerator = codeGenerator;
    }

    /**
     * Tên danh mục trong quy tắc sinh mã — mặc định là tên bảng, trùng tên
     * resource. {@code null} là danh mục không sinh mã.
     */
    protected String codeTarget() {
        Table table = type.getAnnotation(Table.class);
        return table == null ? null : table.name();
    }

    public Page<T> list(ListParams params) {
        return repository.findAll(listSpecification(params), params.pageable(SORTABLE, DEFAULT_SORT));
    }

    /**
     * Điều kiện của danh sách — phạm vi trước, bộ lọc của người gọi sau: Specification.and không
     * có phép trừ, nên không query string nào nới rộng được. Tách riêng để các truy vấn gộp (đếm
     * theo nhóm) lọc đúng như danh sách.
     */
    protected Specification<T> listSpecification(ListParams params) {
        return rowLevel.scope(type, Action.READ)
                .and(CatalogSpecifications.<T>from(params, searchFields()))
                .and(extraFilters(params));
    }

    /** Các cột ô tìm kiếm ({@code q}) dò trong — mặc định mã và tên. */
    protected List<String> searchFields() {
        return List.of("code", "name");
    }

    protected EntityManager entityManager() {
        return entityManager;
    }

    /** Thứ tự lớn nhất đang có + 10 — chừa khoảng để chèn giữa nếu cần. */
    private int nextSortOrder() {
        Integer max = entityManager
                .createQuery("SELECT max(e.sortOrder) FROM " + type.getSimpleName() + " e", Integer.class)
                .getSingleResult();
        return (max == null ? 0 : max) + 10;
    }

    public T get(Long id) {
        return repository.findOne(rowLevel.byId(type, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException(type.getSimpleName(), id));
    }

    /** Bản ghi trong phạm vi GHI của người gọi — cho những việc làm đổi nó ngoài form sửa (tệp đính kèm…). */
    public T getWritable(Long id) {
        return repository.findOne(rowLevel.byId(type, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException(type.getSimpleName(), id));
    }

    public List<T> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(type, Action.READ, ids));
    }

    @Transactional
    public T create(C request) {
        // Vắng `code` cũng là "để máy chủ cấp" như chuỗi rỗng — form gửi "", còn một client API thì bỏ hẳn khoá.
        String code = request.code() == null ? "" : request.code().trim();
        String target = codeTarget();
        if (target != null) {
            code = codeGenerator.resolveOnCreate(target, code);
        }

        T item = factory.get();
        item.setCode(code);
        item.setName(request.name().trim());
        item.setSortOrder(request.sortOrder());
        item.setActive(request.active());
        item.setNote(trimToNull(request.note()));
        applyCreate(item, request);
        if (item.getCode() == null || item.getCode().isBlank()) {
            // Để trống mà không quy tắc mã nào cấp thay (Sở hay của trường — móc tạo vừa chạy): mã vẫn phải khai.
            throw new FieldValidationException("code", "Mã là bắt buộc");
        }
        if (item.getSortOrder() == null) {
            // Không ai gõ thứ tự nữa (form không còn ô này): mục mới xếp cuối danh sách.
            item.setSortOrder(nextSortOrder());
        }
        // Kiểm trùng SAU móc tạo: phạm vi trùng mã có thể phụ thuộc trường riêng
        // mà móc vừa gán (mã cán bộ chỉ cần duy nhất trong một trường).
        requireCodeAvailable(item, item.getCode(), null);
        requireNameAvailable(item.getName(), null);

        T saved = repository.persist(item);
        // Đẩy xuống DB trước: khoá định danh và dấu @PrePersist chỉ tồn tại sau
        // đó, và kiểm chính sách trên bản ghi chưa dựng xong thì sai.
        repository.flush();
        rowLevel.checkWritable(saved);
        return saved;
    }

    @Transactional
    public T update(Long id, P request) {
        T item = repository.findOne(rowLevel.byId(type, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException(type.getSimpleName(), id));

        if (request.code() != null) {
            // Kiểm TRƯỚC khi gán: truy vấn kiểm trùng làm Hibernate đẩy bản ghi
            // đang sửa xuống DB, và mã trùng sẽ vấp unique index trước khi ta kịp
            // trả 409 có nghĩa.
            String code = request.code().trim();
            requireCodeAvailable(item, code, item.getId());
            item.setCode(code);
        }
        if (request.name() != null) {
            String name = request.name().trim();
            // Chỉ kiểm khi tên THẬT SỰ đổi: sửa ghi chú của một mục vốn trùng tên từ trước không nên
            // bị chặn vì một lỗi nó không gây ra. Và kiểm trước khi gán, như với mã.
            if (!name.equalsIgnoreCase(item.getName())) {
                requireNameAvailable(name, item.getId());
            }
            item.setName(name);
        }
        if (request.sortOrder() != null) {
            item.setSortOrder(request.sortOrder());
        }
        if (request.active() != null) {
            item.setActive(request.active());
        }
        if (request.note() != null) {
            item.setNote(trimToNull(request.note()));
        }
        applyUpdate(item, request);

        rowLevel.checkWritable(item);
        return repository.persist(item);
    }

    /**
     * Xoá một mục. Mục còn được bản ghi khác trỏ vào sẽ bị khoá ngoại
     * {@code RESTRICT} từ chối thành lỗi 409 — với danh mục, thao tác đúng
     * thường là ngưng dùng bằng cờ {@code active}.
     */
    @Transactional
    public T delete(Long id) {
        T item = repository.findOne(rowLevel.byId(type, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException(type.getSimpleName(), id));
        beforeDelete(item);
        repository.remove(item);
        return item;
    }

    /**
     * Luật nghiệp vụ trước khi xoá (ném lỗi để từ chối). Mặc định không có luật nào — khoá
     * ngoại vẫn chặn mục đang được trỏ tới. Thiết bị ghi đè: chỉ tài sản đã ra khỏi sổ.
     */
    protected void beforeDelete(T item) {
    }

    /**
     * Gán các trường RIÊNG của danh mục khi tạo. Năm trường chung đã được gán
     * trước khi móc này chạy. Mặc định không làm gì.
     */
    protected void applyCreate(T item, C request) {
    }

    /**
     * Gán các trường riêng khi sửa, theo ngữ nghĩa patch: {@code null} là để
     * nguyên. Mặc định không làm gì.
     */
    protected void applyUpdate(T item, P request) {
    }

    /**
     * Bộ lọc cho các trường RIÊNG của danh mục, ví dụ {@code educationLevel.id}.
     * Ghép SAU phạm vi và năm trường chung, nên cũng không nới rộng được gì.
     * Mặc định không lọc thêm.
     */
    protected Specification<T> extraFilters(ListParams params) {
        return Specification.unrestricted();
    }

    /** Trim, và chuỗi rỗng thành {@code null} — cho lớp con dùng lại. */
    protected static String blankToNull(String value) {
        return trimToNull(value);
    }

    private void requireCodeAvailable(T item, String code, Long selfId) {
        findSameCode(item, code).ifPresent(existing -> {
            if (!existing.getId().equals(selfId)) {
                // Danh mục có quy tắc sinh mã: nói luôn mã kế tiếp còn trống (QLTB-178), như mã của trường.
                String target = codeTarget();
                Optional<String> next = target == null ? Optional.empty() : codeGenerator.peek(target);
                if (next.isPresent()) {
                    throw new FieldValidationException("code",
                            "%s có mã %s đã tồn tại — mã kế tiếp còn trống là %s".formatted(label, code, next.get()));
                }
                throw new ConflictException("%s có mã %s đã tồn tại".formatted(label, code));
            }
        });
    }

    /**
     * Danh mục này có đòi TÊN duy nhất không. Mặc định không: dữ liệu của trường lặp tên là chuyện
     * thường (mỗi khối nhà một "Phòng 101"), danh mục thiết bị cùng tên ở nhiều cấp học, học kỳ lặp
     * theo năm. Các danh mục lựa chọn đơn giản (đơn vị tính, loại phòng, lý do tăng giảm…) bật lên:
     * ở đó hai dòng cùng tên là hai lựa chọn không ai phân biệt được trong ô chọn.
     */
    protected boolean uniqueName() {
        return false;
    }

    private void requireNameAvailable(String name, Long selfId) {
        if (!uniqueName() || name == null) {
            return;
        }
        repository.findByNameIgnoreCase(name).stream()
                .filter(existing -> !existing.getId().equals(selfId))
                .findFirst()
                .ifPresent(existing -> {
                    throw new FieldValidationException("name",
                            "%s tên \"%s\" đã có (mã %s) — đặt tên khác hoặc dùng lại mục đó"
                                    .formatted(label, existing.getName(), existing.getCode()));
                });
    }

    /**
     * Bản ghi đang giữ mã {@code code}. Mặc định: trùng trong cả bảng. Dữ liệu
     * thuộc trường ghi đè để chỉ tìm trong cùng trường với {@code item}.
     */
    protected Optional<T> findSameCode(T item, String code) {
        return repository.findByCodeIgnoreCase(code);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
