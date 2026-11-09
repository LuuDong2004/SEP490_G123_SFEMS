package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.data.RecordAccess;
import com.g123.sfems.shared.data.SecuredRepository;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phần chung của service mọi loại phiếu: đọc theo phạm vi, tạo, sửa nháp, và các bước của vòng duyệt.
 * Mỗi loại phiếu chỉ viết phần của nó qua các móc:
 *
 * <ul>
 *   <li>{@link #applyCreate} / {@link #applyUpdate} — ghi payload vào phiếu;</li>
 *   <li>{@link #filters} — bộ lọc theo trường riêng (ngày nhập, nhà cung cấp...);</li>
 *   <li>{@link #validate} — luật phải đúng ở mọi lần lưu, kể cả nháp;</li>
 *   <li>{@link #validateSubmit} — luật chỉ cần đúng khi trình (phiếu có dòng...);</li>
 *   <li>{@link #onApproved} — việc của lần duyệt CUỐI (phiếu nhập: ghi tăng thiết bị);</li>
 *   <li>{@link #onCompleted} — việc của lúc hoàn tất, với phiếu duyệt xong còn phải thực hiện.</li>
 * </ul>
 *
 * <p>Ví dụ lớp con:
 * <pre>{@code
 * @Service
 * public class EquipmentIntakeService extends VoucherService<EquipmentIntake, IntakeRequest, IntakePatchRequest> {
 *     public EquipmentIntakeService(VoucherServiceDeps deps, EquipmentIntakeRepository repository) {
 *         super(deps, repository, EquipmentIntake.class, EquipmentIntake::new);
 *     }
 *     ...
 * }
 * }</pre>
 *
 * <p>Ba luật mà phiếu nào cũng phải giữ, và giữ ở đây để không loại phiếu nào quên:
 * <ol>
 *   <li>phạm vi dữ liệu đi TRƯỚC bộ lọc của người gọi — query string không nới rộng được;</li>
 *   <li>mọi chuyển trạng thái khoá dòng phiếu rồi đọc lại — bấm đúp không làm một phiếu ghi sổ hai lần;</li>
 *   <li>người duyệt đọc phiếu theo phạm vi ĐỌC, không cần phạm vi ghi — họ không sửa phiếu.</li>
 * </ol>
 */
@Transactional(readOnly = true)
public abstract class VoucherService<V extends SchoolVoucher, C extends VoucherRequest, P extends VoucherRequest>
        implements RecordAccess {

    protected final SecuredRepository<V, Long> repository;
    protected final RowLevelSecurity rowLevel;
    protected final VoucherWorkflow workflow;
    protected final SchoolService schools;
    protected final RowLevelPrincipalResolver principals;
    protected final EntityManager entityManager;
    private final Class<V> type;
    private final String resource;
    private final Supplier<V> factory;

    protected VoucherService(VoucherServiceDeps deps, SecuredRepository<V, Long> repository, Class<V> type,
            Supplier<V> factory) {
        this.repository = repository;
        this.rowLevel = deps.rowLevel();
        this.workflow = deps.workflow();
        this.schools = deps.schools();
        this.principals = deps.principals();
        this.entityManager = deps.entityManager();
        this.type = type;
        this.factory = factory;
        this.resource = factory.get().resource();
    }

    // ------------------------------------------------------------------ móc

    protected abstract void applyCreate(V voucher, C request);

    protected abstract void applyUpdate(V voucher, P request);

    /** Bộ lọc theo trường riêng của loại phiếu; mặc định không có. */
    protected Specification<V> filters(ListParams params) {
        return Specification.unrestricted();
    }

    /** Luật của mọi lần lưu. */
    protected void validate(V voucher) {
    }

    /** Luật khi trình — mặc định: như mọi lần lưu. */
    protected void validateSubmit(V voucher) {
        validate(voucher);
    }

    /** Phiếu vừa được trình (đã có số), trước khi xét có cần duyệt không. */
    protected void onSubmitted(V voucher) {
    }

    /** Bước duyệt cuối vừa qua; phiếu đang {@code APPROVED}. Phiếu nhập ghi tăng ở đây rồi gọi {@code workflow.complete}. */
    protected void onApproved(V voucher) {
    }

    /** Phiếu vừa hoàn tất. */
    protected void onCompleted(V voucher) {
    }

    /** Phiếu vừa bị từ chối. */
    protected void onRejected(V voucher) {
    }

    /** Phiếu vừa bị trả về nháp. */
    protected void onReturned(V voucher) {
    }

    /** Nạp các collection lazy (dòng phiếu) trong transaction, trước khi controller dựng DTO. */
    protected V initialize(V voucher) {
        return voucher;
    }

    /** Nạp những gì một dòng DANH SÁCH cần — mặc định như màn chi tiết. Phiếu nhiều dòng đè để không nạp dòng. */
    protected V initializeForList(V voucher) {
        return initialize(voucher);
    }

    protected Set<String> sortable() {
        return Set.of("id", "code", "status", "createdAt", "updatedAt", "submittedAt");
    }

    protected Sort defaultSort() {
        return Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
    }

    // ------------------------------------------------------------------ đọc

    public Page<V> list(ListParams params) {
        Specification<V> awaiting = VoucherSpecs.awaitingMe(params) ? workflow.awaitingMe() : Specification.unrestricted();
        List<Specification<V>> common = new ArrayList<>();
        for (ListParams.Criterion criterion : params.filters()) {
            Specification<V> spec = VoucherSpecs.common(criterion);
            if (spec != null) {
                common.add(spec);
            }
        }
        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            common.add((root, query, cb) -> root.get("id").in(ids));
        }
        params.search().ifPresent(term -> common.add((root, query, cb) ->
                ListParams.foldedLike(cb, root.get("code"), term)));
        Page<V> page = repository.findAll(
                rowLevel.<V>scope(type, Action.READ)
                        .and(awaiting)
                        .and(Specification.allOf(common))
                        .and(CatalogSpecifications.referenceFilter(params, "school"))
                        .and(filters(params)),
                params.pageable(sortable(), defaultSort()));
        page.getContent().forEach(this::initializeForList);
        return page;
    }

    public V get(Long id) {
        return initialize(readable(id));
    }

    public List<V> getMany(List<Long> ids) {
        List<V> rows = repository.findAll(rowLevel.byIds(type, Action.READ, ids));
        rows.forEach(this::initialize);
        return rows;
    }

    public V readable(Long id) {
        return repository.findOne(rowLevel.byId(type, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException(type.getSimpleName(), id));
    }

    public V writable(Long id) {
        return repository.findOne(rowLevel.byId(type, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException(type.getSimpleName(), id));
    }

    // ------------------------------------------------------------------ ghi

    @Transactional
    public V create(C request) {
        V voucher = factory.get();
        voucher.setSchool(resolveSchool(request.school()));
        voucher.setStatus(VoucherStatus.DRAFT);
        applyCreate(voucher, request);
        validate(voucher);
        V saved = repository.persist(voucher);
        repository.flush();
        rowLevel.checkWritable(saved);
        return initialize(saved);
    }

    @Transactional
    public V update(Long id, P request) {
        V voucher = writable(id);
        // Khoá trước khi kiểm nháp: một lần lưu đọc phiếu lúc còn nháp mà commit sau lần Trình sẽ kéo
        // phiếu về nháp (mất số phiếu, bước duyệt) dù nhật ký ghi đã trình.
        lockAndReread(voucher);
        requireDraft(voucher);
        IdRef school = request.school();
        if (school != null && school.id() != null && !school.id().equals(voucher.getSchool().getId())) {
            throw new FieldValidationException("school", "Không đổi được trường sau khi tạo phiếu");
        }
        applyUpdate(voucher, request);
        validate(voucher);
        rowLevel.checkWritable(voucher);
        return initialize(repository.persist(voucher));
    }

    @Transactional
    public V submit(Long id) {
        V voucher = writable(id);
        lockAndReread(voucher);
        validateSubmit(voucher);
        boolean approved = workflow.submit(voucher);
        onSubmitted(voucher);
        if (approved) {
            onApproved(voucher);
        }
        rowLevel.checkWritable(voucher);
        return initialize(repository.persist(voucher));
    }

    @Transactional
    public V approve(Long id, String note) {
        V voucher = readable(id);
        lockAndReread(voucher);
        if (workflow.approve(voucher, note)) {
            onApproved(voucher);
        }
        return initialize(repository.persist(voucher));
    }

    @Transactional
    public V returnToDraft(Long id, String note) {
        V voucher = readable(id);
        lockAndReread(voucher);
        workflow.returnToDraft(voucher, note);
        onReturned(voucher);
        return initialize(repository.persist(voucher));
    }

    @Transactional
    public V reject(Long id, String note) {
        V voucher = readable(id);
        lockAndReread(voucher);
        workflow.reject(voucher, note);
        onRejected(voucher);
        return initialize(repository.persist(voucher));
    }

    @Transactional
    public V cancel(Long id, String note) {
        V voucher = writable(id);
        lockAndReread(voucher);
        workflow.cancel(voucher, note);
        rowLevel.checkWritable(voucher);
        return initialize(repository.persist(voucher));
    }

    /** Hoàn tất một phiếu đã duyệt — do người có quyền ghi phiếu làm. */
    @Transactional
    public V complete(Long id, String note) {
        V voucher = writable(id);
        lockAndReread(voucher);
        workflow.complete(voucher, note);
        onCompleted(voucher);
        return initialize(repository.persist(voucher));
    }

    @Transactional
    public V delete(Long id) {
        V voucher = repository.findOne(rowLevel.byId(type, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException(type.getSimpleName(), id));
        lockAndReread(voucher);
        workflow.requireDeletable(voucher);
        initialize(voucher);
        workflow.forgetEvents(voucher);
        repository.remove(voucher);
        return voucher;
    }

    /** Các nút người gọi bấm được trên phiếu này. */
    @Transactional(propagation = Propagation.SUPPORTS)
    public Set<String> actions(V voucher, Map<String, Boolean> can, boolean canApprove) {
        return workflow.actions(voucher, Boolean.TRUE.equals(can.get("write")), canApprove);
    }

    @Override
    @Transactional(propagation = Propagation.SUPPORTS)
    public String resource() {
        return resource;
    }

    @Override
    public void checkReadable(Long id) {
        readable(id);
    }

    @Override
    public void checkWritable(Long id) {
        writable(id);
    }

    // ------------------------------------------------------------------ tiện ích

    /**
     * Khoá dòng phiếu rồi đọc lại: mọi chuyển trạng thái đi qua đây để hai lượt bấm cùng lúc không
     * làm một phiếu ghi sổ hai lần. Loại phiếu có việc "thực hiện" riêng (ghi kết quả kiểm đếm) gọi
     * hàm này trước khi đổi phiếu.
     */
    protected void lockAndReread(V voucher) {
        entityManager.lock(voucher, LockModeType.PESSIMISTIC_WRITE);
        entityManager.refresh(voucher);
    }

    protected static void requireDraft(SchoolVoucher voucher) {
        if (voucher.getStatus() != VoucherStatus.DRAFT) {
            throw new FieldValidationException("status",
                    "Chỉ sửa được phiếu nháp — phiếu đã trình thì phải được trả lại mới sửa");
        }
    }

    /** Trường của phiếu: theo payload, vắng thì theo tài khoản đang đăng nhập. */
    protected School resolveSchool(IdRef ref) {
        if (ref != null && ref.id() != null) {
            return schools.get(ref.id());
        }
        Long own = currentSchoolId();
        if (own == null) {
            throw new FieldValidationException("school", "Chọn trường");
        }
        return schools.get(own);
    }

    protected Long currentSchoolId() {
        return principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
    }

    protected static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
