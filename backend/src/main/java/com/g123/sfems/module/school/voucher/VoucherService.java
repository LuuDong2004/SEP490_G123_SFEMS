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
 * Phần chung của service mọi loại phiếu: đọc theo phạm vi, tạo, sửa nháp, và
 * các bước của vòng duyệt. Mỗi loại phiếu chỉ viết phần của nó qua các móc:
 *
 * <ul>
 *   <li>{@link #applyCreate} / {@link #applyUpdate} — ghi payload vào phiếu;</li>
 *   <li>{@link #validate} — luật phải đúng ở mọi lần lưu, kể cả nháp;</li>
 *   <li>{@link #validateSubmit} — luật chỉ cần đúng khi trình (phiếu có dòng...);</li>
 *   <li>{@link #onApproved} — việc của lần duyệt CUỐI (khoá thiết bị, ghi sổ...);</li>
 *   <li>{@link #onCompleted} — việc của lúc hoàn tất, với phiếu duyệt xong còn
 *       phải thực hiện (bàn giao, nhận hàng).</li>
 * </ul>
 *
 * <p>Ba luật mà phiếu nào cũng phải giữ, và giữ ở đây để không loại phiếu nào
 * quên:
 * <ol>
 *   <li>phạm vi dữ liệu đi TRƯỚC bộ lọc của người gọi — query string không nới
 *       rộng được;</li>
 *   <li>mọi chuyển trạng thái khoá dòng phiếu rồi đọc lại — bấm đúp không làm
 *       một phiếu ghi sổ hai lần;</li>
 *   <li>người duyệt đọc phiếu theo phạm vi ĐỌC, không cần phạm vi ghi — họ không
 *       sửa phiếu.</li>
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
    protected final VoucherForms forms;
    protected final VoucherHolds holds;
    private final Class<V> type;
    private final String resource;
    private final Supplier<V> factory;

    protected VoucherService(VoucherServiceDeps deps, SecuredRepository<V, Long> repository, Class<V> type,
            String resource, Supplier<V> factory) {
        this.repository = repository;
        this.rowLevel = deps.rowLevel();
        this.workflow = deps.workflow();
        this.schools = deps.schools();
        this.principals = deps.principals();
        this.entityManager = deps.entityManager();
        this.forms = deps.forms();
        this.holds = deps.holds();
        this.type = type;
        this.resource = resource;
        this.factory = factory;
    }

    // ------------------------------------------------------------------ móc

    protected abstract void applyCreate(V voucher, C request);

    protected abstract void applyUpdate(V voucher, P request);

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

    /** Bước duyệt cuối vừa qua; phiếu đang {@code APPROVED}. */
    protected void onApproved(V voucher) {
    }

    /** Phiếu vừa hoàn tất. */
    protected void onCompleted(V voucher) {
    }

    /** Phiếu vừa bị từ chối — cho loại phiếu đã tạm đổi tài sản trước khi được duyệt. */
    protected void onRejected(V voucher) {
    }

    /**
     * Phiếu vừa bị trả về nháp — cũng cho loại phiếu đã tạm đổi tài sản lúc trình: về nháp là sửa được, nên tài sản
     * phải về như trước khi trình, kẻo nằm "chờ" mà không phiếu nào đang giữ.
     */
    protected void onReturned(V voucher) {
    }

    /** Trường nhận của phiếu (điều chuyển) — thuộc tính entity, để lọc "chờ tôi duyệt". */
    protected String targetAttribute() {
        return null;
    }

    /** Biến thể form (mục chỉ hiện với một loại, vd. tiêu huỷ) — mặc định không có. */
    protected String formVariant(V voucher) {
        return null;
    }

    /** Trường chứng từ của một dòng, đã kiểm theo cấu hình form của loại phiếu. */
    protected String lineDetails(java.util.Map<String, Object> input, School school, int lineNo) {
        return forms.line(resource, input, school.getId(), lineNo);
    }

    /**
     * Các dòng phải kiểm trường chứng từ bắt buộc khi TRÌNH. Mặc định rỗng —
     * loại phiếu nào có trường {@code required} trong phần {@code line} của
     * {@code resources/voucher-forms/<resource>.json} thì override, nếu không
     * cờ {@code required} đó không chặn gì cả.
     *
     * <p>Rỗng chứ không phải trừu tượng: phần lớn loại phiếu không khai trường
     * bắt buộc nào ở cấp dòng, và bắt mười bốn service viết một phương thức trả
     * về danh sách rỗng chỉ làm loãng chỗ thật sự cần đọc.
     */
    protected List<? extends com.g123.sfems.domain.school.voucher.VoucherEquipmentLine> linesToCheck(V voucher) {
        return List.of();
    }

    /** Ghi các trường chứng từ của một giai đoạn (vd. "return" lúc trả), giữ nguyên phần còn lại. */
    protected void stageDetails(V voucher, java.util.Map<String, Object> input, String stage) {
        voucher.setDetails(forms.header(resource, input, voucher.getDetails(), voucher.getSchool().getId(), stage));
        forms.requireComplete(resource, voucher.getDetails(), stage, formVariant(voucher));
    }

    /** Nạp các collection lazy trong transaction, trước khi controller dựng DTO. */
    protected V initialize(V voucher) {
        return voucher;
    }

    /**
     * Nạp những gì một dòng DANH SÁCH cần — mặc định như màn chi tiết (danh sách vẫn đếm dòng, cộng tiền từ
     * dòng). Phiếu có thể mang hàng nghìn dòng (kiểm kê) thì đè để không nạp dòng nào, và lấy số tóm tắt bằng SQL.
     */
    protected V initializeForList(V voucher) {
        return initialize(voucher);
    }

    protected abstract Specification<V> filters(ListParams params);

    protected Set<String> sortable() {
        return Set.of("id", "code", "status", "createdAt", "updatedAt");
    }

    protected Sort defaultSort() {
        return Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
    }

    // ------------------------------------------------------------------ đọc

    public Page<V> list(ListParams params) {
        Specification<V> awaiting = VoucherSpecs.awaitingMe(params)
                ? workflow.awaitingMe(targetAttribute()) : Specification.unrestricted();
        List<Specification<V>> common = new java.util.ArrayList<>();
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
    public V create(C request, IdRef school) {
        V voucher = factory.get();
        voucher.setSchool(resolveSchool(school));
        voucher.setStatus(VoucherStatus.DRAFT);
        applyCreate(voucher, request);
        voucher.setDetails(forms.header(resource, request.details(), null, voucher.getSchool().getId(), null));
        validate(voucher);
        V saved = repository.persist(voucher);
        repository.flush();
        rowLevel.checkWritable(saved);
        return initialize(saved);
    }

    @Transactional
    public V update(Long id, P request, IdRef school) {
        V voucher = writable(id);
        // Khoá trước khi kiểm nháp: không có @Version và UPDATE ghi mọi cột, nên một lần lưu đọc phiếu lúc còn nháp mà
        // commit sau lần Trình sẽ kéo phiếu về nháp (mất số phiếu, bước duyệt) dù nhật ký ghi đã trình.
        lockAndReread(voucher);
        requireDraft(voucher);
        if (school != null && school.id() != null && !school.id().equals(voucher.getSchool().getId())) {
            throw new FieldValidationException("school", "Không đổi được trường sau khi tạo phiếu");
        }
        applyUpdate(voucher, request);
        if (request.details() != null) {
            voucher.setDetails(forms.header(resource, request.details(), voucher.getDetails(),
                    voucher.getSchool().getId(), null));
        }
        validate(voucher);
        rowLevel.checkWritable(voucher);
        return initialize(repository.persist(voucher));
    }

    @Transactional
    public V submit(Long id) {
        V voucher = writable(id);
        lockAndReread(voucher);
        validateSubmit(voucher);
        // Một tài sản chỉ nằm trên một phiếu đang chạy — đặt ở đây để mọi loại phiếu cùng một luật.
        holds.requireFree(resource, voucher.getId());
        forms.requireComplete(resource, voucher.getDetails(), null, formVariant(voucher));
        for (var line : linesToCheck(voucher)) {
            forms.requireLineComplete(resource, line.getDetails(), line.getLineNo(), null, formVariant(voucher));
        }
        boolean approved = workflow.submit(voucher, resource);
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
        if (workflow.approve(voucher, resource, note)) {
            onApproved(voucher);
        }
        return initialize(repository.persist(voucher));
    }

    @Transactional
    public V returnToDraft(Long id, String note) {
        V voucher = readable(id);
        lockAndReread(voucher);
        workflow.returnToDraft(voucher, resource, note);
        onReturned(voucher);
        return initialize(repository.persist(voucher));
    }

    @Transactional
    public V reject(Long id, String note) {
        V voucher = readable(id);
        lockAndReread(voucher);
        workflow.reject(voucher, resource, note);
        onRejected(voucher);
        return initialize(repository.persist(voucher));
    }

    @Transactional
    public V cancel(Long id, String note) {
        V voucher = writable(id);
        lockAndReread(voucher);
        workflow.cancel(voucher, resource, note);
        rowLevel.checkWritable(voucher);
        return initialize(repository.persist(voucher));
    }

    /** Hoàn tất một phiếu đã duyệt — mặc định do người có quyền ghi phiếu làm. */
    @Transactional
    public V complete(Long id, String note) {
        V voucher = completable(id);
        lockAndReread(voucher);
        // Loại phiếu kết thúc bằng một hành động RIÊNG (trả thiết bị, ghi kết quả sửa chữa, thực hiện thanh
        // lý, trường nhận bàn giao…) gỡ "complete" khỏi `actions` — nhưng gỡ nút không phải là chặn: gọi
        // thẳng endpoint này từng đưa phiếu về Hoàn tất mà bỏ qua chính việc phiếu sinh ra để làm (đề
        // nghị thanh lý hoàn tất mà tài sản vẫn trên sổ, phiếu mượn hoàn tất mà tài sản vẫn "đang cho
        // mượn"). Hỏi lại đúng danh sách hành động mà màn hình được mời.
        if (voucher.getStatus() == VoucherStatus.APPROVED
                && !actions(voucher, Map.of("write", Boolean.TRUE), false).contains("complete")) {
            throw new FieldValidationException("status",
                    "Phiếu này không hoàn tất trực tiếp được — dùng đúng thao tác kết thúc của phiếu"
                            + " (trả thiết bị, ghi kết quả, thực hiện, nhận bàn giao…)");
        }
        workflow.complete(voucher, resource, note);
        onCompleted(voucher);
        return initialize(repository.persist(voucher));
    }

    /** Ai hoàn tất được phiếu. Phiếu điều chuyển đổi thành "trường nhận". */
    protected V completable(Long id) {
        return writable(id);
    }

    @Transactional
    public V delete(Long id) {
        V voucher = repository.findOne(rowLevel.byId(type, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException(type.getSimpleName(), id));
        lockAndReread(voucher);
        workflow.requireDeletable(voucher, resource);
        initialize(voucher);
        repository.remove(voucher);
        return voucher;
    }

    /** Các nút người gọi bấm được trên phiếu này. */
    @Transactional(propagation = Propagation.SUPPORTS)
    public Set<String> actions(V voucher, Map<String, Boolean> can, boolean canApprove) {
        return workflow.actions(voucher, Boolean.TRUE.equals(can.get("write")), canApprove);
    }

    @Transactional(propagation = Propagation.SUPPORTS)
    public String resourceName() {
        return resource;
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
        Long own = principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
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
