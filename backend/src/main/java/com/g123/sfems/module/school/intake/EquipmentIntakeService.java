package com.g123.sfems.module.school.intake;

import com.g123.sfems.module.school.voucher.VoucherCampus;
import com.g123.sfems.module.school.facility.CampusScope.CampusLabel;
import com.g123.sfems.domain.catalog.acquisitionmethod.AcquisitionMethod;
import com.g123.sfems.domain.catalog.enums.AssetCategory;
import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.domain.catalog.originsource.OriginSource;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.domain.school.intake.EquipmentIntakeDocument;
import com.g123.sfems.domain.school.intake.EquipmentIntakeLine;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.acquisitionmethod.AcquisitionMethodService;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.catalog.originsource.OriginSourceService;
import com.g123.sfems.module.catalog.schoolyear.SchoolYearService;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.equipment.EquipmentService;
import com.g123.sfems.module.school.facility.RoomService;
import com.g123.sfems.module.school.voucher.VoucherSpecs;
import com.g123.sfems.module.school.voucher.VoucherWorkflow;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.data.RecordAccess;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import com.g123.sfems.shared.web.ListParams;
import jakarta.persistence.EntityManager;
import jakarta.persistence.FlushModeType;
import jakarta.persistence.LockModeType;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import com.g123.sfems.module.school.voucher.VoucherForms;
import java.math.BigDecimal;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import java.time.LocalDate;
import com.g123.sfems.domain.school.equipment.EquipmentEnums;
import com.g123.sfems.module.school.voucher.InventoryFindings;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import com.g123.sfems.shared.validation.FieldRule;

/**
 * Phiếu nhập — lập, sửa khi còn nháp, và XÁC NHẬN NHẬN HÀNG.
 *
 * <p>Ba luật của feature này, và cả ba đều nằm ở đây chứ không ở form:
 *
 * <ul>
 *   <li><b>Xác nhận là thời điểm ghi tăng.</b> Trước nó không có tài sản nào;
 *       sau nó thì có, và phiếu khoá lại. Không có khoảng thời gian "hàng đã về
 *       trường nhưng chưa ai chịu trách nhiệm".</li>
 *   <li><b>Phiếu đã xác nhận không sửa được.</b> Sai thì lập phiếu điều chỉnh —
 *       cho phép sửa nghĩa là số lượng trên chứng từ và số tài sản đã sinh có
 *       thể lệch nhau mà không ai biết.</li>
 *   <li><b>Ghi tăng đi theo SỐ THỰC NHẬN</b>, không theo số trên chứng từ. Đó là
 *       lý do có hai cột số lượng.</li>
 * </ul>
 *
 * <p>Cả việc sinh tài sản lẫn việc cộng tồn nằm trong CÙNG giao dịch với việc
 * khoá phiếu: một lần xác nhận hoặc làm xong tất cả, hoặc không để lại gì. Ghi
 * tăng nửa vời là hỏng sổ tài sản, và không có phiếu nào để lần ngược.
 */
@Transactional(readOnly = true)
@Service
public class EquipmentIntakeService implements RecordAccess {

    /** Ngày theo giờ Việt Nam: ngày ghi tăng, ngày chứng từ "không sau hôm nay". */
    private static final java.time.ZoneId VIETNAM = java.time.ZoneId.of("Asia/Ho_Chi_Minh");

    public static final String RESOURCE = "equipment_intakes";


    private static final Set<String> SORTABLE =
            Set.of("id", "code", "intakeDate", "documentDate", "status", "createdAt", "updatedAt");

    /** Phiếu mới nhất lên đầu: danh sách chứng từ luôn được đọc từ hiện tại lùi về. */
    private static final Sort DEFAULT_SORT =
            Sort.by(Sort.Order.desc("intakeDate"), Sort.Order.desc("id"));

    private final EquipmentIntakeRepository repository;
    private final RowLevelSecurity rowLevel;
    private final SchoolService schools;
    private final RowLevelPrincipalResolver principals;
    private final EquipmentCatalogService catalogs;
    private final RoomService rooms;
    private final OriginSourceService originSources;
    private final AcquisitionMethodService acquisitionMethods;
    private final EquipmentService equipment;
    private final VoucherWorkflow workflow;
    private final EntityManager entityManager;
    private final VoucherForms forms;
    private final SchoolYearService schoolYears;
    private final VoucherCampus campus;

    /** Phạm vi cơ sở: theo phòng nhận của các dòng; không dòng nào có phòng → cơ sở chính. */
    public static final VoucherCampus.Shape CAMPUS = VoucherCampus.Shape.of(List.of(), List.of(),
            new VoucherCampus.Line("lines", List.of("room"), List.of()));

    public EquipmentIntakeService(
            EquipmentIntakeRepository repository,
            RowLevelSecurity rowLevel,
            SchoolService schools,
            RowLevelPrincipalResolver principals,
            EquipmentCatalogService catalogs,
            RoomService rooms,
            OriginSourceService originSources,
            AcquisitionMethodService acquisitionMethods,
            EquipmentService equipment,
            VoucherWorkflow workflow,
            EntityManager entityManager,
            VoucherForms forms,
            SchoolYearService schoolYears,
            VoucherCampus campus) {
        this.repository = repository;
        this.rowLevel = rowLevel;
        this.schools = schools;
        this.principals = principals;
        this.catalogs = catalogs;
        this.rooms = rooms;
        this.originSources = originSources;
        this.acquisitionMethods = acquisitionMethods;
        this.equipment = equipment;
        this.workflow = workflow;
        this.entityManager = entityManager;
        this.forms = forms;
        this.schoolYears = schoolYears;
        this.campus = campus;
        campus.register(EquipmentIntake.class, CAMPUS);
    }

    public Page<EquipmentIntake> list(ListParams params) {
        Specification<EquipmentIntake> awaiting = VoucherSpecs.awaitingMe(params)
                ? workflow.<EquipmentIntake>awaitingMe().and(campus.solelyPinned(CAMPUS)) : Specification.unrestricted();
        Page<EquipmentIntake> page = repository.findAll(
                rowLevel.<EquipmentIntake>scope(EquipmentIntake.class, Action.READ)
                        .and(campus.pinned(CAMPUS))
                        .and(campus.filter(CAMPUS, params))
                        .and(awaiting)
                        .and(EquipmentIntakeSpecifications.from(params))
                        .and(CatalogSpecifications.referenceFilter(params, "school"))
                        .and(CatalogSpecifications.referenceFilter(params, "originSource"))
                        .and(CatalogSpecifications.referenceFilter(params, "acquisitionMethod")),
                params.pageable(SORTABLE, DEFAULT_SORT));
        page.getContent().forEach(EquipmentIntakeService::withLines);
        return page;
    }

    public EquipmentIntake get(Long id) {
        return withLines(repository.findOne(rowLevel.byId(EquipmentIntake.class, Action.READ, id)
                        .and(campus.pinned(CAMPUS)))
                .orElseThrow(() -> new ResourceNotFoundException("EquipmentIntake", id)));
    }

    public List<EquipmentIntake> getMany(List<Long> ids) {
        List<EquipmentIntake> rows = repository.findAll(rowLevel.byIds(EquipmentIntake.class, Action.READ, ids)
                .and(campus.pinned(CAMPUS)));
        rows.forEach(EquipmentIntakeService::withLines);
        return rows;
    }

    /**
     * Nạp các dòng TRONG transaction.
     *
     * <p>DTO được dựng ở controller, tức là sau khi transaction đã đóng — chạm
     * vào một collection lazy ở đó là {@code LazyInitializationException}, và
     * nó chỉ nổ trên đường đọc chứ không phải đường ghi, nên rất dễ lọt. Một
     * dòng tường minh ở đây rẻ hơn một {@code EAGER} kéo theo cả phiếu vào mọi
     * lần đọc thiết bị; {@code @BatchSize} lo phần N+1 của một trang.
     */
    /** Nhãn Cơ sở của các phiếu trên một trang danh sách ({@link VoucherCampus#labels}). */
    public Map<Long, List<CampusLabel>> campusLabels(List<Long> ids) {
        return campus.<EquipmentIntake>labels(CAMPUS, ids, spec -> repository.findAll(spec));
    }

    /**
     * Tài khoản bị giới hạn trong một cơ sở: dòng chưa chọn phòng nhận về KHO CỦA CƠ SỞ mình ngay lúc lưu (không đợi
     * lúc duyệt — người duyệt là cả trường, sẽ chọn kho chung), để phiếu thuộc cơ sở của người lập.
     */
    private void campusStoreroom(EquipmentIntake intake) {
        if (campus.pinnedCampus() == null) {
            return;
        }
        Room storeroom = null;
        boolean looked = false;
        for (EquipmentIntakeLine line : intake.getLines()) {
            if (line.getRoom() == null) {
                if (!looked) {
                    storeroom = rooms.storeroomOf(intake.getSchool().getId());
                    looked = true;
                }
                line.setRoom(storeroom);
            }
        }
    }

    private static EquipmentIntake withLines(EquipmentIntake intake) {
        intake.getLines().size();
        intake.getDocuments().size();
        return intake;
    }

    /**
     * Phiếu — kể cả bản NHÁP — phải có nguồn hình thành (15/11/2026): nó quyết định phiếu hỏi chứng từ gì, nguồn kinh
     * phí nào. Trước đây "Lưu nháp" trên form trống lưu được phiếu rỗng, không nguồn, không thiết bị — rác trong danh sách.
     */
    private static void requireOrigin(boolean present) {
        if (!present) {
            throw new FieldValidationException("originSource", "Vui lòng chọn nguồn hình thành");
        }
    }

    @Transactional
    public EquipmentIntake create(EquipmentIntakeRequest request) {
        requireOrigin(request.originSource() != null);
        EquipmentIntake intake = new EquipmentIntake();
        intake.setSchool(resolveSchool(request.school()));
        intake.setStatus(VoucherStatus.DRAFT);
        // Ngày ghi tăng do HỆ THỐNG đặt (trưởng nhóm 14/11/2026): lúc lập là hôm nay (tạm, để năm học có giá trị), lúc
        // DUYỆT đặt lại bằng ngày duyệt (`receive`). Ngày lập phiếu là `createdAt`; ngày nhận hàng là ngày hoá đơn.
        intake.setIntakeDate(LocalDate.now(VIETNAM));
        intake.setDocumentNo(trimToNull(request.documentNo()));
        intake.setDocumentDate(request.documentDate());
        intake.setSupplier(trimToNull(request.supplier()));
        intake.setFundingSource(request.fundingSource());
        intake.setOriginSource(ref(request.originSource(), originSources::get));
        intake.setOriginNote(trimToNull(request.originNote()));
        // Năm học là HỆ QUẢ của ngày ghi tăng, không phải lựa chọn — giá trị form gửi lên bị bỏ qua.
        intake.setSchoolYear(schoolYears.forDate(intake.getIntakeDate()));
        intake.setAcquisitionMethod(ref(request.acquisitionMethod(), acquisitionMethods::get));
        intake.setWarrantyMonths(request.warrantyMonths());
        intake.setNote(trimToNull(request.note()));
        if (request.documents() != null) {
            intake.replaceDocuments(buildDocuments(intake, request.documents()));
        }
        intake.replaceLines(buildLines(intake, request.lines()));
        syncHeadDocument(intake);
        intake.setDetails(forms.header(RESOURCE, request.details(), null, intake.getSchool().getId()));
        checkLines(intake);
        fitSources(intake);
        checkDocuments(intake);
        checkSerials(intake);
        campusStoreroom(intake);
        campus.requireWritable(CAMPUS, intake, Set.of());

        EquipmentIntake saved = repository.persist(intake);
        repository.flush();
        rowLevel.checkWritable(saved);
        return saved;
    }

    @Transactional
    public EquipmentIntake update(Long id, EquipmentIntakePatchRequest request) {
        EquipmentIntake intake = writable(id);
        // Khoá trước khi kiểm nháp — lần lưu đọc phiếu lúc còn nháp mà commit sau lần Trình sẽ kéo phiếu về nháp.
        lockAndReread(intake);
        requireDraft(intake, "sửa");
        Set<String> anchored = campus.anchorKeys(CAMPUS, intake);

        IdRef school = request.school();
        if (school != null && school.id() != null && !school.id().equals(intake.getSchool().getId())) {
            throw new FieldValidationException("school", "Không đổi được trường sau khi tạo");
        }
        if (request.documentNo() != null) {
            intake.setDocumentNo(trimToNull(request.documentNo()));
        }
        if (request.documentDate() != null) {
            intake.setDocumentDate(request.documentDate());
        }
        if (request.supplier() != null) {
            intake.setSupplier(trimToNull(request.supplier()));
        }
        if (request.fundingSource() != null) {
            intake.setFundingSource(request.fundingSource());
        }
        requireOrigin(request.originSource() != null || intake.getOriginSource() != null);
        if (request.originSource() != null) {
            OriginSource next = ref(request.originSource(), originSources::get);
            // Phiếu sinh từ phiếu nghiệp vụ khác: nguồn hình thành là hệ quả của phiếu nguồn, không phải
            // một lựa chọn — đề xuất mua sắm thì là mua sắm, biên bản kiểm kê thì là kiểm kê thừa.
            if (intake.getSourceResource() != null && !sameOrigin(next, intake.getOriginSource())) {
                throw new FieldValidationException("originSource",
                        "Phiếu lập từ %s nên nguồn hình thành là \"%s\", không đổi được".formatted(
                                intake.getSourceCode() == null ? "phiếu nghiệp vụ khác" : intake.getSourceCode(),
                                intake.getOriginSource() == null ? "—" : intake.getOriginSource().getName()));
            }
            intake.setOriginSource(next);
        }
        if (request.originNote() != null) {
            intake.setOriginNote(trimToNull(request.originNote()));
        }
        // Năm học luôn theo ngày ghi tăng — không nhận năm học form gửi lên.
        intake.setSchoolYear(schoolYears.forDate(intake.getIntakeDate()));
        if (request.acquisitionMethod() != null) {
            intake.setAcquisitionMethod(ref(request.acquisitionMethod(), acquisitionMethods::get));
        }
        if (request.warrantyMonths() != null) {
            intake.setWarrantyMonths(request.warrantyMonths());
        }
        if (request.note() != null) {
            intake.setNote(trimToNull(request.note()));
        }
        if (request.documents() != null) {
            // Hoá đơn và dòng đi cùng nhau: dòng chỉ tới hoá đơn theo vị trí trong danh sách mới.
            if (request.lines() == null) {
                throw new FieldValidationException("documents", "Gửi kèm danh sách thiết bị khi sửa hoá đơn");
            }
            intake.replaceDocuments(buildDocuments(intake, request.documents()));
        }
        if (request.lines() != null) {
            intake.replaceLines(buildLines(intake, request.lines()));
        }
        syncHeadDocument(intake);
        if (request.details() != null) {
            intake.setDetails(forms.header(RESOURCE, request.details(), intake.getDetails(),
                    intake.getSchool().getId()));
        }
        checkLines(intake);
        checkSource(intake, false);
        fitSources(intake);
        checkDocuments(intake);
        checkSerials(intake);
        campusStoreroom(intake);
        campus.requireWritable(CAMPUS, intake, anchored);

        rowLevel.checkWritable(intake);
        return repository.persist(intake);
    }

    /**
     * Trình phiếu lên lãnh đạo trường. Phiếu phải có dòng và các dòng phải hợp lệ
     * — trình một phiếu mà lúc duyệt mới lộ ra thiếu lý do chênh lệch là bắt
     * người duyệt làm việc của người lập.
     */
    @Transactional
    public EquipmentIntake submit(Long id) {
        EquipmentIntake intake = writable(id);
        lockAndReread(intake);
        if (intake.getLines().isEmpty()) {
            throw new FieldValidationException("lines", "Phiếu chưa có dòng nào để ghi tăng");
        }
        checkLines(intake);
        // Phiếu nguồn trước các ô còn thiếu: phiếu "Kế hoạch mua sắm" / "Kiểm kê thừa" không có phiếu nguồn hợp lệ thì
        // hoàn thiện các ô khác cũng không trình được.
        requirePlanLink(intake);
        checkSource(intake, true);
        forms.requireComplete(RESOURCE, intake.getDetails());
        for (EquipmentIntakeLine line : intake.getLines()) {
            forms.requireLineComplete(RESOURCE, line.getDetails(), line.getLineNo());
        }
        requireDocumentLines(intake);
        requireSources(intake);
        requirePurchaseDocuments(intake);
        requireSchoolYear(intake);
        requireAssetProfileData(intake);
        requireAttachment(intake);
        equipment.checkCodeCapacity(intake);
        if (workflow.submit(intake, RESOURCE)) {
            receive(intake);
        }
        rowLevel.checkWritable(intake);
        return withLines(repository.persist(intake));
    }

    /**
     * Duyệt. Lần duyệt cuối CHÍNH LÀ thời điểm ghi tăng — xem {@link #receive}.
     *
     * <p>Đọc phiếu theo phạm vi ĐỌC, không phải GHI: người duyệt (lãnh đạo trường)
     * không sửa phiếu, và không cần phạm vi ghi trên nó. Quyền duyệt được kiểm hai
     * lớp — mã quyền ở controller, cấp của tài khoản ở {@link VoucherWorkflow}.
     */
    @Transactional
    public EquipmentIntake approve(Long id, String note) {
        EquipmentIntake intake = readable(id);
        lockAndReread(intake);
        if (workflow.approve(intake, RESOURCE, note)) {
            checkLines(intake);
            // Phiếu nguồn và số còn lại của nó cũng kiểm lại: giữa trình và duyệt, phiếu ghi tăng khác của cùng kế hoạch
            // (hay cùng biên bản kiểm kê) có thể đã được duyệt và ăn vào số còn lại.
            requirePlanLink(intake);
            checkSource(intake, true);
            // Kiểm lại ở đây chứ không tin lần kiểm lúc trình: giữa trình và
            // duyệt có thể có phiếu khác của cùng trường đã ăn hết số thứ tự.
            requireSources(intake);
            requireAssetProfileData(intake);
            equipment.checkCodeCapacity(intake);
            receive(intake);
        }
        return withLines(repository.persist(intake));
    }

    @Transactional
    public EquipmentIntake returnToDraft(Long id, String note) {
        EquipmentIntake intake = readable(id);
        lockAndReread(intake);
        workflow.returnToDraft(intake, RESOURCE, note);
        return withLines(repository.persist(intake));
    }

    @Transactional
    public EquipmentIntake reject(Long id, String reason) {
        EquipmentIntake intake = readable(id);
        lockAndReread(intake);
        workflow.reject(intake, RESOURCE, reason);
        return withLines(repository.persist(intake));
    }

    /** Người lập tự bỏ phiếu nháp. */
    @Transactional
    public EquipmentIntake cancel(Long id, String reason) {
        EquipmentIntake intake = writable(id);
        lockAndReread(intake);
        workflow.cancel(intake, RESOURCE, reason);
        rowLevel.checkWritable(intake);
        return withLines(repository.persist(intake));
    }

    /**
     * GHI TĂNG: sinh tài sản (hoặc cộng tồn) cho từng dòng theo cách quản lý của
     * nhóm, ghi lại đã sinh bao nhiêu, rồi đánh dấu phiếu hoàn tất — cùng một
     * giao dịch với lần duyệt. Bất kỳ dòng nào không ghi tăng được (thiếu dữ liệu
     * sinh mã, hết số thứ tự) thì cả lần duyệt bị từ chối và phiếu vẫn chờ duyệt.
     */
    private void receive(EquipmentIntake intake) {
        // Số serial khai lúc lập phiếu: kiểm lại lúc ghi tăng — giữa lúc lập và lúc duyệt, thiết bị khác của trường có
        // thể đã mang số đó.
        checkSerials(intake);
        // Ngày ghi tăng = ngày DUYỆT (vào hệ thống); năm học theo đó. Ngày nhận của từng thiết bị là ngày hoá đơn của nó.
        intake.setIntakeDate(LocalDate.now(VIETNAM));
        intake.setSchoolYear(schoolYears.forDate(intake.getIntakeDate()));
        workflow.complete(intake, RESOURCE, null);
        // Dòng chưa có phòng nhận (phiếu lập từ đề xuất mua sắm, từ kiểm kê, qua API) thì về kho của trường —
        // như form vẫn chọn sẵn — để tài sản có chỗ để và người quản lý là cán bộ phụ trách kho (124).
        Room storeroom = null;
        boolean looked = false;
        for (EquipmentIntakeLine line : intake.getLines()) {
            if (line.getRoom() == null && line.getReceivedQuantity() > 0) {
                if (!looked) {
                    storeroom = rooms.storeroomOf(intake.getSchool().getId());
                    looked = true;
                }
                line.setRoom(storeroom);
            }
        }
        for (EquipmentIntakeLine line : intake.getLines()) {
            int quantity = line.getReceivedQuantity();
            line.setGeneratedCount(quantity);
            if (quantity <= 0) {
                // Hàng về thiếu hẳn một dòng: phiếu vẫn ghi nhận dòng đó (lý do
                // chênh lệch là bắt buộc), chỉ là không sinh ra tài sản nào.
                continue;
            }
            if (line.getCatalog().getTrackingType() == TrackingType.SERIAL) {
                equipment.generateFromIntakeLine(line);
            } else {
                equipment.generateLotFromIntakeLine(line);
            }
        }
    }

    /**
     * Xoá hẳn một phiếu. Chỉ phiếu chưa từng được trình: phiếu đã có số và nhật
     * ký duyệt là một chứng từ, và chứng từ thì huỷ chứ không xoá.
     */
    @Transactional
    public EquipmentIntake delete(Long id) {
        EquipmentIntake intake = repository.findOne(rowLevel.byId(EquipmentIntake.class, Action.DELETE, id)
                        .and(campus.pinned(CAMPUS)))
                .orElseThrow(() -> new ResourceNotFoundException("EquipmentIntake", id));
        lockAndReread(intake);
        workflow.requireDeletable(intake, RESOURCE);
        // Đọc các dòng TRƯỚC khi xoá: data provider có phân tích body trả về,
        // và sau khi xoá thì không còn gì để nạp.
        withLines(intake);
        repository.remove(intake);
        return intake;
    }

    /** Một dòng hàng mua về, lấy từ đề xuất mua sắm. */
    public record PurchasedItem(Long catalogId, String name, int quantity, BigDecimal unitPrice) {
    }

    /**
     * Số THỰC NHẬN đã ghi theo từng thiết bị (id danh mục → số lượng) trên các phiếu ghi tăng lập từ một phiếu
     * nguồn — kể cả phiếu nháp / chờ duyệt (đã giữ chỗ), trừ phiếu đã huỷ hoặc bị từ chối. Đề xuất mua sắm dùng nó
     * để biết thiết bị nào còn phải nhập (hàng về nhiều đợt, mỗi đợt một phiếu ghi tăng).
     */
    @Transactional(readOnly = true)
    public Map<Long, Integer> receivedBySource(String sourceResource, Long sourceId) {
        return sumBySource(sourceResource, sourceId, List.of(VoucherStatus.CANCELLED, VoucherStatus.REJECTED));
    }

    /**
     * Phần của {@link #receivedBySource} còn nằm ở phiếu CHƯA hoàn tất (nháp, chờ duyệt, bị trả lại): phiếu đang lập
     * cũng giữ chỗ trong kế hoạch (trưởng nhóm 15/11/2026, B13) — hộp chọn ghi "đang lập" thay vì "đã nhập".
     */
    public Map<Long, Integer> pendingBySource(String sourceResource, Long sourceId) {
        return sumBySource(sourceResource, sourceId,
                List.of(VoucherStatus.CANCELLED, VoucherStatus.REJECTED, VoucherStatus.COMPLETED));
    }

    private Map<Long, Integer> sumBySource(String sourceResource, Long sourceId, List<VoucherStatus> excluded) {
        List<Object[]> rows = entityManager.createQuery("""
                        select l.catalog.id, sum(l.receivedQuantity) from EquipmentIntakeLine l
                        where l.intake.sourceResource = :resource and l.intake.sourceId = :id
                          and l.intake.status not in :dead
                        group by l.catalog.id""", Object[].class)
                .setParameter("resource", sourceResource)
                .setParameter("id", sourceId)
                .setParameter("dead", excluded)
                .getResultList();
        Map<Long, Integer> result = new HashMap<>();
        for (Object[] row : rows) {
            result.put((Long) row[0], ((Number) row[1]).intValue());
        }
        return result;
    }

    /**
     * Hàng mua theo đề xuất đã về: lập phiếu nhập NHÁP mang đúng các dòng đề xuất.
     * Cán bộ vẫn phải đếm, sửa số thực nhận và trình như mọi phiếu nhập khác —
     * đề xuất nói trường XIN gì, không nói hàng về đủ.
     */
    @Transactional
    public EquipmentIntake createFromPurchase(Long schoolId, FundingSource funding,
            List<PurchasedItem> items, String note, Long proposalId, String proposalCode, String deliveringUnit) {
        EquipmentIntake draft = new EquipmentIntake();
        draft.setSchool(schools.get(schoolId));
        draft.setStatus(VoucherStatus.DRAFT);
        draft.setIntakeDate(LocalDate.now());
        // Hàng về theo đề xuất mua sắm là MUA SẮM — nguồn hình thành do phiếu nguồn quyết định, và
        // phiếu nhớ nó sinh từ đề xuất nào. Nguồn kinh phí của đề xuất mà không đi được với mua sắm
        // (tài trợ) thì để trống cho người lập chọn lại, thay vì mang một cặp giá trị mâu thuẫn.
        draft.setSchoolYear(schoolYears.forDate(draft.getIntakeDate()));
        draft.setOriginSource(originSources.of(OriginRule.MUA_SAM));
        draft.setSource("purchase_proposals", proposalId, proposalCode);
        draft.setFundingSource(funding != null && OriginRule.MUA_SAM.allows(funding) ? funding : null);
        draft.setNote(note);
        // Hàng theo kế hoạch của Sở / UBND: mặc định cấp trên mua tập trung rồi giao về — đơn vị giao là cơ quan lập kế
        // hoạch; trường tự mua bằng kinh phí được giao thì đổi "Cách mua" trên form (trưởng nhóm 17/11/2026).
        Map<String, Object> details = new LinkedHashMap<>();
        details.put(CENTRALIZED, true);
        if (deliveringUnit != null) {
            details.put("deliveringUnit", deliveringUnit);
        }
        draft.setDetails(forms.header(RESOURCE, details, null, schoolId));
        List<EquipmentIntakeLine> result = new ArrayList<>();
        int lineNo = 1;
        for (PurchasedItem item : items) {
            EquipmentIntakeLine line = new EquipmentIntakeLine();
            line.setIntake(draft);
            line.setLineNo(lineNo++);
            line.setCatalog(catalogs.get(item.catalogId()));
            line.setName(item.name());
            line.setPhysicalOrDigital(EquipmentEnums.PhysicalDigitalType.PHYSICAL);
            line.setDocumentQuantity(item.quantity());
            line.setReceivedQuantity(item.quantity());
            // KHÔNG chép đơn giá kế hoạch: đó là DỰ TOÁN — nguyên giá theo quyết định giao / hợp đồng / hoá đơn. Form hiện
            // dự toán làm chữ mờ để so.
            line.setUnitPrice(null);
            result.add(line);
        }
        draft.replaceLines(result);
        EquipmentIntake saved = repository.persist(draft);
        repository.flush();
        rowLevel.checkWritable(saved);
        return saved;
    }

    /**
     * Kiểm kê thấy tài sản THỪA: lập một phiếu nhập NHÁP mang các dòng đó. Ghi tăng
     * vẫn phải qua lãnh đạo trường duyệt như mọi lần ghi tăng khác.
     */
    @org.springframework.context.event.EventListener
    public void onSurplus(InventoryFindings.Surplus findings) {
        EquipmentIntake draft = new EquipmentIntake();
        draft.setSchool(schools.get(findings.schoolId()));
        draft.setStatus(VoucherStatus.DRAFT);
        draft.setIntakeDate(LocalDate.now());
        draft.setSchoolYear(schoolYears.forDate(draft.getIntakeDate()));
        draft.setOriginSource(originSources.of(OriginRule.KIEM_KE_THUA));
        draft.setSource("inventory_sessions", findings.sourceId(), findings.sourceCode());
        draft.setNote("Ghi tăng thiết bị thừa theo biên bản kiểm kê " + findings.sourceCode());
        List<EquipmentIntakeLine> result = new ArrayList<>();
        int lineNo = 1;
        for (var item : findings.items()) {
            EquipmentIntakeLine line = new EquipmentIntakeLine();
            line.setIntake(draft);
            line.setLineNo(lineNo++);
            line.setCatalog(catalogs.get(item.catalogId()));
            line.setName(item.name());
            line.setPhysicalOrDigital(EquipmentEnums.PhysicalDigitalType.PHYSICAL);
            line.setDocumentQuantity(item.quantity());
            line.setReceivedQuantity(item.quantity());
            line.setRoom(item.roomId() == null ? null : rooms.getAcrossCampuses(item.roomId()));
            result.add(line);
        }
        draft.replaceLines(result);
        repository.persist(draft);
    }

    /** Các nút người gọi bấm được trên phiếu này. */
    @Transactional(propagation = Propagation.SUPPORTS)
    public Set<String> actions(EquipmentIntake intake, Map<String, Boolean> can, boolean canApprove) {
        return workflow.actions(intake, Boolean.TRUE.equals(can.get("write")), canApprove);
    }

    @Override
    public String resource() {
        return RESOURCE;
    }

    @Override
    public void checkReadable(Long id) {
        readable(id);
    }

    /**
     * Ghi được phiếu — và cùng với nó tệp đính kèm của phiếu, của từng hoá đơn, từng dòng
     * ({@link EquipmentIntakeDocumentAccess}, {@link EquipmentIntakeLineAccess} hỏi qua đây). Tệp chỉ thêm / xoá được
     * khi phiếu còn NHÁP (gồm phiếu bị trả lại — trả lại là về nháp): phiếu đã trình thì người duyệt đang duyệt đúng bộ
     * hồ sơ ấy, phiếu đã ghi tăng thì tệp là căn cứ của các thiết bị đã sinh; phiếu bị từ chối, đã huỷ là chứng từ đã đóng.
     */
    @Override
    public void checkWritable(Long id) {
        EquipmentIntake intake = writable(id);
        if (intake.getStatus() != VoucherStatus.DRAFT) {
            throw new FieldValidationException("attachments",
                    "Chỉ thêm, xoá tệp đính kèm khi phiếu còn nháp — phiếu đã trình thì phải được trả lại mới sửa");
        }
    }

    /**
     * Khoá dòng phiếu rồi đọc lại trạng thái, trước khi quyết định có ghi tăng
     * hay không.
     *
     * <p>Không có bước này thì hai lần duyệt cùng một phiếu — bấm đúp, hai tab,
     * một lần thử lại của trình duyệt — đều đọc được trạng thái "chờ duyệt" và
     * đều chạy tiếp: phiếu 50 máy sinh ra 100 tài sản, mã không trùng nên không
     * ràng buộc nào chặn lại, và việc này chỉ lộ ra ở kỳ kiểm kê. Câu lệnh khoá
     * làm lần thứ hai phải đợi lần thứ nhất xong, rồi {@code refresh} cho nó
     * thấy trạng thái đã đổi và dừng lại với câu báo bình thường.
     */
    private void lockAndReread(EquipmentIntake intake) {
        entityManager.lock(intake, LockModeType.PESSIMISTIC_WRITE);
        entityManager.refresh(intake);
    }

    private EquipmentIntake readable(Long id) {
        return repository.findOne(rowLevel.byId(EquipmentIntake.class, Action.READ, id).and(campus.pinned(CAMPUS)))
                .orElseThrow(() -> new ResourceNotFoundException("EquipmentIntake", id));
    }

    private EquipmentIntake writable(Long id) {
        return repository.findOne(rowLevel.byId(EquipmentIntake.class, Action.WRITE, id).and(campus.pinned(CAMPUS)))
                .orElseThrow(() -> new ResourceNotFoundException("EquipmentIntake", id));
    }

    private static void requireDraft(EquipmentIntake intake, String action) {
        if (intake.getStatus() != VoucherStatus.DRAFT) {
            throw new FieldValidationException("status",
                    "Chỉ %s được phiếu nháp — phiếu đã trình thì phải được trả lại mới sửa".formatted(action));
        }
    }

    /**
     * Dựng lại toàn bộ các dòng từ payload. Số thứ tự dòng do server đánh, theo
     * đúng thứ tự gửi lên — nó là vị trí trên chứng từ, không phải dữ liệu người
     * dùng nhập.
     */
    /**
     * Hoá đơn (chứng từ) của phiếu (254) theo thứ tự gửi lên. Hoá đơn đang có (theo id) được sửa tại chỗ — tệp gắn theo id
     * đó; hoá đơn bị bỏ thì tệp của nó bị xoá theo.
     */
    private List<EquipmentIntakeDocument> buildDocuments(EquipmentIntake intake, List<EquipmentIntakeDocumentInput> inputs) {
        Map<Long, EquipmentIntakeDocument> existing = new HashMap<>();
        for (EquipmentIntakeDocument document : intake.getDocuments()) {
            if (document.getId() != null) {
                existing.put(document.getId(), document);
            }
        }
        List<EquipmentIntakeDocument> out = new ArrayList<>();
        int docNo = 1;
        for (EquipmentIntakeDocumentInput input : inputs) {
            EquipmentIntakeDocument document = input.id() != null && existing.containsKey(input.id())
                    ? existing.remove(input.id())
                    : new EquipmentIntakeDocument();
            document.setIntake(intake);
            document.setDocNo(docNo++);
            document.setSupplier(trimToNull(input.supplier()));
            document.setTaxCode(trimToNull(input.taxCode()));
            document.setContact(normalizeContact(input.contact()));
            document.setDocumentNo(trimToNull(input.documentNo()));
            document.setDocumentDate(input.documentDate());
            document.setFundingSource(input.fundingSource());
            document.setFundingNote(trimToNull(input.fundingNote()));
            document.setAcquisitionMethod(ref(input.acquisitionMethod(), acquisitionMethods::get));
            document.setAcquisitionNote(trimToNull(input.acquisitionNote()));
            // Phiếu đã lưu: ghi hoá đơn mới ngay, để dòng trỏ tới nó không vấp thứ tự ghi lúc flush.
            if (intake.getId() != null && document.getId() == null) {
                entityManager.persist(document);
            }
            out.add(document);
        }
        if (!existing.isEmpty()) {
            entityManager.createQuery("delete from Attachment a where a.resource = :resource and a.recordId in :ids")
                    .setParameter("resource", EquipmentIntakeDocumentAccess.RESOURCE)
                    .setParameter("ids", existing.keySet())
                    .executeUpdate();
        }
        return out;
    }

    /** Dòng thuộc hoá đơn {@code document}: chép chứng từ của hoá đơn xuống các cột chứng từ của dòng. */
    private static void applyDocument(EquipmentIntakeLine line, EquipmentIntakeDocument document) {
        line.setDocument(document);
        line.setSupplier(document.getSupplier());
        line.setDocumentNo(document.getDocumentNo());
        line.setDocumentDate(document.getDocumentDate());
        line.setFundingSource(document.getFundingSource());
        line.setFundingNote(document.getFundingNote());
        line.setAcquisitionMethod(document.getAcquisitionMethod());
        line.setAcquisitionNote(document.getAcquisitionNote());
    }

    /**
     * Đầu phiếu mang chứng từ của hoá đơn ĐẦU TIÊN — chỉ là tóm tắt cho danh sách phiếu và chỗ đỡ của đọc cũ; giá trị
     * thật của từng thiết bị là của hoá đơn nó thuộc (đã chép xuống dòng).
     */
    private static void syncHeadDocument(EquipmentIntake intake) {
        if (intake.getDocuments().isEmpty()) {
            return;
        }
        EquipmentIntakeDocument first = intake.getDocuments().get(0);
        intake.setSupplier(first.getSupplier());
        intake.setDocumentNo(first.getDocumentNo());
        intake.setDocumentDate(first.getDocumentDate());
        intake.setFundingSource(first.getFundingSource());
        intake.setAcquisitionMethod(first.getAcquisitionMethod());
    }

    /** Trình: chứng từ nào cũng phải có thiết bị — chứng từ trống là khai dở. */
    static void requireDocumentLines(EquipmentIntake intake) {
        for (EquipmentIntakeDocument document : intake.getDocuments()) {
            boolean used = intake.getLines().stream().anyMatch(l -> java.util.Objects.equals(l.documentId(), document.getId())
                    || l.getDocument() == document);
            if (!used) {
                throw new FieldValidationException("documents", "Chứng từ %d%s chưa có thiết bị — thêm thiết bị hoặc xoá chứng từ"
                        .formatted(document.getDocNo(), document.getDocumentNo() == null ? "" : " (số " + document.getDocumentNo() + ")"));
            }
        }
    }

    private List<EquipmentIntakeLine> buildLines(EquipmentIntake intake, List<EquipmentIntakeLineInput> inputs) {
        List<EquipmentIntakeLine> lines = new ArrayList<>();
        if (inputs == null) {
            return lines;
        }
        Map<Long, EquipmentIntakeLine> existing = new HashMap<>();
        for (EquipmentIntakeLine line : intake.getLines()) {
            if (line.getId() != null) {
                existing.put(line.getId(), line);
            }
        }
        int lineNo = 1;
        for (EquipmentIntakeLineInput input : inputs) {
            EquipmentCatalog catalog = catalogs.get(input.catalog().id());
            catalogs.requireLevelFits(catalog, intake.getSchool(), lineNo);
            // Dòng đã có thì sửa tại chỗ (giữ id — tệp hoá đơn gắn theo dòng bám vào nó), dòng mới thì tạo.
            EquipmentIntakeLine line = input.id() != null && existing.containsKey(input.id())
                    ? existing.remove(input.id())
                    : new EquipmentIntakeLine();
            line.setIntake(intake);
            line.setLineNo(lineNo++);
            line.setCatalog(catalog);
            String name = trimToNull(input.name());
            line.setName(name == null ? catalog.getName() : name);
            line.setPhysicalOrDigital(input.physicalOrDigital());
            line.setAssetCategory(input.assetCategory());
            line.setDocumentQuantity(input.documentQuantity());
            line.setReceivedQuantity(input.receivedQuantity());
            line.setVarianceReason(trimToNull(input.varianceReason()));
            line.setUnitPrice(input.unitPrice());
            line.setRoom(ref(input.room(), rooms::getAcrossCampuses));
            // Phòng riêng của từng cái: chỉ giữ tới số thực nhận; trùng phòng của dòng thì coi như theo dòng.
            List<Long> unitRooms = input.unitRoomIds() == null ? List.of() : input.unitRoomIds();
            Long lineRoom = line.getRoom() == null ? null : line.getRoom().getId();
            int received = input.receivedQuantity() == null ? 0 : input.receivedQuantity();
            line.setUnitRoomSlots(unitRooms.stream().limit(Math.max(received, 0))
                    .map(id -> id == null || id.equals(lineRoom) ? null : id).toList());
            // Cùng luật với phòng của dòng: đúng trường của phiếu, còn sử dụng.
            int keep = Math.max(received, 0);
            line.setUnitDetails(limit(input.unitModels(), keep), limit(input.unitManufacturers(), keep),
                    limit(input.unitWarrantyMonths(), keep), limit(input.unitOtherInfos(), keep));
            List<Long> unitSlots = line.unitRoomSlots();
            for (int u = 0; u < unitSlots.size(); u++) {
                if (unitSlots.get(u) == null) {
                    continue;
                }
                Room unit = rooms.getAcrossCampuses(unitSlots.get(u));
                if (!unit.getSchool().getId().equals(intake.getSchool().getId()) || !Boolean.TRUE.equals(unit.getActive())) {
                    throw new FieldValidationException("lines", "Dòng %d: phòng nhận của cái thứ %d không dùng được (khác trường hoặc đã ngừng sử dụng)"
                            .formatted(lineNo, u + 1));
                }
            }
            line.setSupplier(trimToNull(input.supplier()));
            line.setDocumentNo(trimToNull(input.documentNo()));
            line.setDocumentDate(input.documentDate());
            line.setFundingSource(input.fundingSource());
            line.setFundingNote(trimToNull(input.fundingNote()));
            // Nguồn hình thành là của cả phiếu — dòng không mang riêng nữa.
            line.setOriginSource(null);
            line.setAcquisitionMethod(ref(input.acquisitionMethod(), acquisitionMethods::get));
            line.setAcquisitionNote(trimToNull(input.acquisitionNote()));
            line.setWarrantyMonths(input.warrantyMonths());
            line.setModel(trimToNull(input.model()));
            line.setManufacturer(trimToNull(input.manufacturer()));
            line.setOtherInfo(trimToNull(input.otherInfo()));
            // Hạn sử dụng chỉ có nghĩa với vật tư tiêu hao, hoá chất (quản lý theo số lượng); dòng thiết bị
            // từng cái gửi kèm thì gỡ đi chứ không báo lỗi — cùng cách với các ô nguồn không còn nghĩa.
            line.setExpiryDate(catalog.getTrackingType() == TrackingType.BULK ? input.expiryDate() : null);
            // Không quy đổi bao bì nữa: số lượng của dòng theo đơn vị tính của danh mục (g, ml…), lọ / chai chỉ là đồ
            // đựng. Quy cách gửi kèm (form cũ) thì gỡ. Dòng cũ đã mang quy cách vẫn quy đổi đúng ở `stockQuantity()`.
            line.setPackUnit(null);
            line.setPackSize(null);
            // Serial chỉ thiết bị từng cái mới có; dòng theo số lượng gửi kèm thì gỡ đi, như hạn sử dụng ở trên.
            line.setSerialList(catalog.getTrackingType() == TrackingType.SERIAL
                    ? normalizeSerials(input.serialNumbers()) : List.of());
            line.setDetails(forms.line(RESOURCE, input.details(), intake.getSchool().getId(), line.getLineNo()));
            List<EquipmentIntakeDocument> docs = intake.getDocuments();
            if (docs.isEmpty()) {
                line.setDocument(null);
            } else {
                int at = input.documentIndex() == null ? 0 : input.documentIndex();
                if (at < 0 || at >= docs.size()) {
                    throw new FieldValidationException("lines", "Dòng %d (%s): chứng từ của dòng không có trong phiếu"
                            .formatted(line.getLineNo(), line.getName()));
                }
                applyDocument(line, docs.get(at));
            }
            lines.add(line);
        }
        return lines;
    }

    /**
     * Những gì phải đúng ở mọi lần ghi, kể cả lưu nháp.
     *
     * <p>Lý do chênh lệch cũng được database giữ bằng một {@code CHECK}, và đó
     * là lý do luật này không đợi tới lúc xác nhận: nếu để service dễ dãi hơn
     * database thì người dùng lưu một phiếu nháp hợp lệ theo code sẽ nhận về
     * "bản ghi còn được tham chiếu" — câu 409 chung của một vi phạm ràng buộc —
     * thay vì một câu nói rõ dòng nào thiếu lý do. Hai tầng nói cùng một luật,
     * và tầng trên nói bằng tiếng Việt.
     */
    private static void checkLines(EquipmentIntake intake) {
        for (EquipmentIntakeLine line : intake.getLines()) {
            String where = "Dòng %d (%s)".formatted(line.getLineNo(), line.getName());
            if (!line.getReceivedQuantity().equals(line.getDocumentQuantity())
                    && line.getVarianceReason() == null) {
                throw new FieldValidationException("lines",
                        "%s: số thực nhận khác số trên chứng từ, phải ghi lý do chênh lệch".formatted(where));
            }
            Room room = line.getRoom();
            if (room != null && !room.getSchool().getId().equals(intake.getSchool().getId())) {
                throw new FieldValidationException("lines",
                        "%s: phòng nhận không thuộc trường của phiếu".formatted(where));
            }
            // Phòng ngừng sử dụng (cờ hoạt động suy từ Tình trạng sử dụng) không nhận hàng mới.
            if (room != null && !Boolean.TRUE.equals(room.getActive())) {
                throw new FieldValidationException("lines",
                        "%s: phòng %s đã ngừng sử dụng — chọn phòng khác".formatted(where, room.getName()));
            }
        }
    }

    private static boolean sameOrigin(OriginSource a, OriginSource b) {
        return (a == null ? null : a.getId()) == null
                ? b == null
                : b != null && a.getId().equals(b.getId());
    }

    /**
     * Nguồn hình thành ↔ nguồn kinh phí ↔ hình thức mua sắm phải KHỚP nhau ở mọi lần lưu, kể cả nháp
     * — luật nằm ở {@link OriginRule}. Một cặp mâu thuẫn ("Được tặng" + "Ngân sách Thành phố") là
     * dữ liệu SAI chứ không phải dữ liệu thiếu, nên không đợi tới lúc trình: để nó nằm trong nháp là
     * để báo cáo theo nguồn đếm sai ngay khi phiếu được duyệt.
     *
     * <p>Thứ không còn nghĩa với nguồn hình thành đang chọn thì được GỠ chứ không báo lỗi: hình thức
     * mua sắm của hàng không phải mua, phần "ghi rõ" của nguồn không phải "Khác". Người dùng đổi
     * nguồn hình thành không phải đi xoá tay từng ô đã ẩn.
     */
    private static void fitSources(EquipmentIntake intake) {
        OriginRule rule = OriginRule.of(intake.getOriginSource()).orElse(null);
        if (rule == null) {
            // Chưa chọn nguồn hình thành: chưa có gì để đối chiếu — lúc trình mới đòi.
            return;
        }
        if (!rule.noteRequired()) {
            intake.setOriginNote(null);
        }
        if (!rule.acquisitionMethod()) {
            intake.setAcquisitionMethod(null);
        }
        if (intake.getFundingSource() != null && !rule.allows(intake.getFundingSource())) {
            // Cột đầu phiếu chỉ còn là chỗ đỡ cho phiếu cũ: giá trị không khớp thì bỏ, dòng tự khai.
            intake.setFundingSource(null);
        }
        if (intake.getAcquisitionMethod() != null
                && rule.excludedAcquisitionMethods().contains(intake.getAcquisitionMethod().getCode())) {
            intake.setAcquisitionMethod(null);
        }
        for (EquipmentIntakeDocument document : intake.getDocuments()) {
            if (!rule.acquisitionMethod()) {
                document.setAcquisitionMethod(null);
            }
            if (document.getAcquisitionMethod() != null
                    && rule.excludedAcquisitionMethods().contains(document.getAcquisitionMethod().getCode())) {
                throw new FieldValidationException("documents",
                        "Chứng từ %d: hình thức mua sắm \"%s\" không đi với nguồn hình thành \"%s\""
                                .formatted(document.getDocNo(), document.getAcquisitionMethod().getName(), rule.label()));
            }
            FundingSource funding = document.getFundingSource();
            if (funding != null && !rule.allows(funding)) {
                throw new FieldValidationException("documents",
                        "Chứng từ %d: nguồn kinh phí \"%s\" không đi với nguồn hình thành \"%s\". Chọn một trong: %s"
                                .formatted(document.getDocNo(), funding.label(), rule.label(),
                                        rule.fundingSources().stream().map(FundingSource::label)
                                                .collect(Collectors.joining(", "))));
            }
            if (funding == null || !funding.requiresNote()) {
                document.setFundingNote(null);
            }
            if (!isOtherMethod(document.getAcquisitionMethod())) {
                document.setAcquisitionNote(null);
            }
        }
        for (EquipmentIntakeLine line : intake.getLines()) {
            if (line.getDocument() != null) {
                applyDocument(line, line.getDocument());
            }
            if (!rule.acquisitionMethod() || line.getAcquisitionMethod() != null
                    && rule.excludedAcquisitionMethods().contains(line.getAcquisitionMethod().getCode())) {
                line.setAcquisitionMethod(null);
            }
            FundingSource funding = line.getFundingSource();
            if (funding != null && !rule.allows(funding)) {
                throw new FieldValidationException("lines",
                        "Dòng %d (%s): nguồn kinh phí \"%s\" không đi với nguồn hình thành \"%s\". Chọn một trong: %s"
                                .formatted(line.getLineNo(), line.getName(), funding.label(), rule.label(),
                                        rule.fundingSources().stream().map(FundingSource::label)
                                                .collect(Collectors.joining(", "))));
            }
            // Ghi rõ đi theo nguồn kinh phí THẬT của dòng — dòng theo nguồn của phiếu ("Nguồn khác") vẫn giữ phần ghi rõ.
            FundingSource effective = line.effectiveFundingSource();
            if (effective == null || !effective.requiresNote()) {
                line.setFundingNote(null);
            }
            if (!isOtherMethod(line.effectiveAcquisitionMethod())) {
                line.setAcquisitionNote(null);
            }
        }
    }

    /** Hình thức mua sắm "Khác" — mục duy nhất phải ghi rõ, vì tự nó không nói mua bằng cách nào. */
    private static boolean isOtherMethod(AcquisitionMethod method) {
        return method != null && "KHAC".equals(method.getCode());
    }

    /**
     * Những gì về NGUỒN phải có trước khi trình: nguồn hình thành của phiếu, phần ghi rõ khi là "Khác",
     * và nguồn kinh phí của từng dòng theo đúng luật của nguồn hình thành đó.
     *
     * <p>Nguồn kinh phí không bắt buộc ở hai trường hợp — kiểm kê thừa, và tự làm không tốn vật tư.
     * Dòng để trống ở đó được ghi "Chưa xác định nguồn" thay vì để null: hồ sơ tài sản đòi phải có
     * nguồn kinh phí thì mới vào được phiếu sau này ({@code Equipment.missingProfile}), và "không ai
     * biết tiền từ đâu" là một câu trả lời, khác với "chưa ai khai".
     */
    private static void requireSources(EquipmentIntake intake) {
        OriginRule rule = OriginRule.of(intake.getOriginSource()).orElseThrow(() -> new FieldValidationException(
                "originSource",
                "Chọn nguồn hình thành của phiếu: kế hoạch mua sắm, được cấp phát, bàn giao, được tặng, kiểm kê thừa, tự làm hay khác"));
        if (rule.noteRequired() && intake.getOriginNote() == null) {
            throw new FieldValidationException("originNote",
                    "Nguồn hình thành \"%s\": ghi rõ là nguồn gì".formatted(rule.label()));
        }
        fitSources(intake);
        for (EquipmentIntakeLine line : intake.getLines()) {
            if (line.getReceivedQuantity() == null || line.getReceivedQuantity() <= 0) {
                continue;
            }
            String where = "Dòng %d (%s)".formatted(line.getLineNo(), line.getName());
            FundingSource funding = line.effectiveFundingSource();
            if (funding == null) {
                if (rule.requiresFunding(line.getUnitPrice())) {
                    throw new FieldValidationException("fundingSource",
                            "%s: chọn nguồn kinh phí. Với nguồn hình thành \"%s\" chọn được: %s".formatted(
                                    where, rule.label(), rule.fundingSources().stream().map(FundingSource::label)
                                            .collect(Collectors.joining(", "))));
                }
                line.setFundingSource(FundingSource.UNDETERMINED);
                if (line.getDocument() != null && line.getDocument().getFundingSource() == null) {
                    line.getDocument().setFundingSource(FundingSource.UNDETERMINED);
                }
            } else if (funding.requiresNote() && line.getFundingNote() == null) {
                throw new FieldValidationException("lines",
                        "%s: nguồn kinh phí \"%s\" phải ghi rõ là nguồn gì".formatted(where, funding.label()));
            }
            if (isOtherMethod(line.effectiveAcquisitionMethod()) && line.getAcquisitionNote() == null) {
                throw new FieldValidationException("lines",
                        "%s: hình thức mua sắm \"Khác\" phải ghi rõ là hình thức gì".formatted(where));
            }
        }
    }

    /**
     * Những gì phiếu phải có TRƯỚC KHI TRÌNH để hồ sơ tài sản nó sinh ra là hồ
     * sơ CHUẨN.
     *
     * <p>Đây là chỗ vá một cái bẫy im lặng: {@code Equipment.missingProfile()}
     * đòi tài sản phải có mã chuẩn, đơn vị tính, nguồn kinh phí và ngày tiếp nhận
     * thì mới là hồ sơ chuẩn. Hai trong bốn thứ đó do phiếu nhập
     * cấp (nguồn kinh phí ở đầu phiếu, đơn vị tính lấy từ nhóm thiết bị), nhưng không thứ nào từng bắt buộc. Hệ quả:
     * phiếu lập được, trình được, duyệt được, tài sản vào sổ — rồi mới
     * thấy hồ sơ thiếu, lúc phiếu đã khoá và không sửa được nữa.
     *
     * <p>Chỉ đòi khi phiếu THỰC SỰ sinh hồ sơ tài sản: dòng quản lý theo lô chỉ
     * cộng tồn kho, không có hồ sơ nào để thiếu, nên một phiếu toàn bàn ghế
     * không bị hỏi nguồn kinh phí.
     *
     * <p>Đòi lúc TRÌNH chứ không lúc lưu nháp, cùng lý lẽ với các trường chứng
     * từ: phiếu nháp sinh tự động từ đề xuất mua sắm hay từ biên bản kiểm kê
     * chưa có gì để điền.
     */
    /** Số serial gửi lên → số đem lưu: bỏ khoảng trắng, viết hoa, bỏ dòng trống; thứ tự giữ nguyên. */
    static List<String> normalizeSerials(List<String> input) {
        if (input == null) {
            return List.of();
        }
        // Giữ VỊ TRÍ: ô trống của máy chưa khai vẫn là một phần tử rỗng (`setSerialList` bỏ phần trống ở cuối).
        List<String> out = new ArrayList<>();
        for (String raw : input) {
            String serial = raw == null ? null : FieldRule.SERIAL.normalize(raw);
            out.add(serial == null ? "" : serial);
        }
        return out;
    }

    /**
     * Luật số serial của một phiếu không cần tới CSDL: mỗi dòng không quá số lượng thực nhận, không số nào lặp lại
     * trong cả phiếu. Trả câu lỗi, hoặc {@code null} khi hợp lệ.
     */
    static String serialProblem(List<EquipmentIntakeLine> lines) {
        Map<String, Integer> seen = new LinkedHashMap<>();
        for (EquipmentIntakeLine line : lines) {
            List<String> serials = line.serialList();
            String where = "Dòng %d (%s)".formatted(line.getLineNo(), line.getName());
            int received = line.getReceivedQuantity() == null ? 0 : line.getReceivedQuantity();
            // Theo vị trí: serial khai cho máy thứ k mà dòng chỉ nhận ít hơn k cái (giảm số lượng sau khi khai).
            if (line.serialSlots().size() > received) {
                return "%s: có số serial cho máy thứ %d, nhiều hơn số lượng nhận (%d)".formatted(where, line.serialSlots().size(), received);
            }
            for (String serial : serials) {
                Integer other = seen.putIfAbsent(serial.toLowerCase(Locale.ROOT), line.getLineNo());
                if (other != null) {
                    return other.equals(line.getLineNo())
                            ? "%s: số serial %s nhập hai lần".formatted(where, serial)
                            : "%s: số serial %s trùng với dòng %d".formatted(where, serial, other);
                }
            }
        }
        return null;
    }

    /** Số serial: luật trong phiếu ({@link #serialProblem}), rồi không trùng thiết bị nào khác của trường. */
    private void checkSerials(EquipmentIntake intake) {
        String problem = serialProblem(intake.getLines());
        if (problem != null) {
            throw new FieldValidationException("lines", problem);
        }
        Set<String> checked = new HashSet<>();
        for (EquipmentIntakeLine line : intake.getLines()) {
            for (String serial : line.serialList()) {
                if (!checked.add(serial)) {
                    continue;
                }
                equipment.serialHolder(intake.getSchool().getId(), serial, null).ifPresent(code -> {
                    throw new FieldValidationException("lines", "Dòng %d (%s): số serial %s đã có ở thiết bị %s"
                            .formatted(line.getLineNo(), line.getName(), serial, code));
                });
            }
        }
    }

    /** Danh sách theo vị trí, chỉ giữ tới số thực nhận; vắng thì rỗng. */
    private static <T> List<T> limit(List<T> values, int max) {
        return values == null ? List.of() : values.stream().limit(max).toList();
    }

    /** Hàng mua — theo kế hoạch hay ngoài kế hoạch: đòi hoá đơn, đơn giá như nhau. */
    /**
     * Liên hệ của nhà cung cấp: số điện thoại HOẶC email (trưởng nhóm 14/11/2026). Có "@" thì kiểm như email, không thì
     * như số điện thoại — theo bộ quy tắc chuẩn (`FieldRule.PHONE` / `EMAIL`). {@code null} = hợp lệ hoặc trống.
     */
    static String contactProblem(String value) {
        String v = value == null ? "" : value.strip();
        if (v.isEmpty()) {
            return null;
        }
        String bad = v.contains("@") ? FieldRule.EMAIL.violation(v, 0) : FieldRule.PHONE.violation(v, 0);
        return bad == null ? null : "không hợp lệ (vd. 0912 345 678 hoặc ten@congty.vn)";
    }

    /** Lưu liên hệ: số điện thoại bỏ dấu ngăn cách, email chữ thường — cùng cách các ô điện thoại / email khác. */
    static String normalizeContact(String value) {
        String v = trimToNull(value);
        if (v == null || contactProblem(v) != null) {
            return v;
        }
        return v.contains("@") ? FieldRule.EMAIL.normalize(v) : FieldRule.PHONE.normalize(v);
    }

    /** Khoá trong {@code details}: cấp trên (Sở / UBND) mua tập trung rồi giao về trường. */
    static final String CENTRALIZED = "centralized";
    private static final String CENTRALIZED_PURCHASE = "TAP_TRUNG";

    /**
     * Cấp trên mua tập trung, giao về (chỉ với nguồn "Kế hoạch mua sắm"): căn cứ ghi tăng là QUYẾT ĐỊNH GIAO TÀI SẢN và
     * biên bản bàn giao — của CẢ phiếu (một kế hoạch, một đơn vị giao); hoá đơn vẫn theo từng lô của nhà thầu nhưng số /
     * ngày / tệp hoá đơn không bắt buộc (trưởng nhóm 17/11/2026).
     */
    static boolean isCentralized(EquipmentIntake intake) {
        if (OriginRule.of(intake.getOriginSource()).orElse(null) != OriginRule.MUA_SAM) {
            return false;
        }
        return Boolean.TRUE.equals(VoucherForms.read(intake.getDetails()).get(CENTRALIZED));
    }

    /** Lúc trình phiếu mua tập trung: đơn vị giao, số / ngày quyết định giao, ngày bàn giao; hình thức "Mua sắm tập trung". */
    static void requireAssignment(EquipmentIntake intake) {
        Map<String, Object> details = VoucherForms.read(intake.getDetails());
        String[][] required = {
                {"deliveringUnit", "đơn vị giao"},
                {"assignmentDecisionNo", "số quyết định giao"},
                {"assignmentDecisionDate", "ngày quyết định giao"},
                {"handoverDate", "ngày bàn giao"},
        };
        for (String[] f : required) {
            Object v = details.get(f[0]);
            if (v == null || String.valueOf(v).isBlank()) {
                throw new FieldValidationException("details." + f[0], "Cấp trên mua tập trung: nhập " + f[1]);
            }
        }
        for (EquipmentIntakeDocument document : intake.getDocuments()) {
            if (document.getAcquisitionMethod() == null
                    || !CENTRALIZED_PURCHASE.equals(document.getAcquisitionMethod().getCode())) {
                throw new FieldValidationException("documents",
                        "Hoá đơn %d: hàng cấp trên mua tập trung — hình thức là \"Mua sắm tập trung\"".formatted(document.getDocNo()));
            }
        }
    }

    private static boolean isPurchase(EquipmentIntake intake) {
        return OriginRule.of(intake.getOriginSource()).map(OriginRule::purchase).orElse(false);
    }

    /**
     * Chứng từ — kiểm ở mọi lần lưu: ngày hoá đơn không sau hôm nay (ngày ghi tăng là ngày duyệt, luôn sau đó); hàng mua sắm thì số hoá đơn theo luật số hoá
     * đơn (1–30 ký tự, chữ không dấu, số, / - . và khoảng trắng). Nguồn khác ghi số quyết định, biên bản — giữ luật
     * chữ ngắn của ô.
     */
    static void checkDocuments(EquipmentIntake intake) {
        LocalDate today = LocalDate.now(VIETNAM);
        boolean purchase = isPurchase(intake);
        if (intake.getDocumentDate() != null && intake.getDocumentDate().isAfter(today)) {
            throw new FieldValidationException("documentDate", "Ngày hoá đơn không được sau hôm nay");
        }
        if (purchase && intake.getDocumentNo() != null) {
            String problem = FieldRule.INVOICE_NO.violation(intake.getDocumentNo(), 0);
            if (problem != null) {
                throw new FieldValidationException("documentNo", "Số hoá đơn " + problem);
            }
        }
        for (EquipmentIntakeDocument document : intake.getDocuments()) {
            String where = "Chứng từ %d".formatted(document.getDocNo());
            String contact = contactProblem(document.getContact());
            if (contact != null) {
                throw new FieldValidationException("documents", where + ": điện thoại / email " + contact);
            }
            if (document.getDocumentDate() != null && document.getDocumentDate().isAfter(today)) {
                throw new FieldValidationException("documents", where + ": ngày chứng từ không được sau hôm nay");
            }
            if (purchase && document.getDocumentNo() != null) {
                String problem = FieldRule.INVOICE_NO.violation(document.getDocumentNo(), 0);
                if (problem != null) {
                    throw new FieldValidationException("documents", where + ": số hoá đơn " + problem);
                }
            }
        }
        for (EquipmentIntakeLine line : intake.getLines()) {
            String where = "Dòng %d (%s)".formatted(line.getLineNo(), line.getName());
            if (line.getDocumentDate() != null && line.getDocumentDate().isAfter(today)) {
                throw new FieldValidationException("lines", where + ": ngày hoá đơn không được sau hôm nay");
            }
            if (purchase && line.getDocumentNo() != null) {
                String problem = FieldRule.INVOICE_NO.violation(line.getDocumentNo(), 0);
                if (problem != null) {
                    throw new FieldValidationException("lines", where + ": số hoá đơn " + problem);
                }
            }
        }
    }

    /**
     * Nguồn "Kế hoạch mua sắm" phải đi từ một đề xuất của trường nằm trong kế hoạch của Sở / UBND (trưởng nhóm
     * 13/11/2026) — kiểm lúc TRÌNH, nháp vẫn lưu được. Trường tự mua ngoài kế hoạch thì chọn nguồn "Trường tự mua sắm".
     */
    static void requirePlanLink(EquipmentIntake intake) {
        OriginRule rule = OriginRule.of(intake.getOriginSource()).orElse(null);
        // Chỉ "Kế hoạch mua sắm" phải đi từ kế hoạch; "Trường tự mua sắm" thì không.
        if (rule == OriginRule.MUA_SAM && !PROPOSALS.equals(intake.getSourceResource())) {
            throw new FieldValidationException("originSource",
                    "Nguồn Kế hoạch mua sắm: chọn kế hoạch mua sắm. Hàng tự mua ngoài kế hoạch thì chọn nguồn Trường tự mua sắm");
        }
        // "Kiểm kê thừa" cũng vậy: thiết bị thừa chỉ có khi một biên bản kiểm kê đã duyệt ghi nhận nó — phiếu lập tay với
        // nguồn này là ghi tăng không căn cứ.
        if (rule == OriginRule.KIEM_KE_THUA && !SESSIONS.equals(intake.getSourceResource())) {
            throw new FieldValidationException("originSource",
                    "Nguồn Kiểm kê thừa: chọn biên bản kiểm kê đã duyệt có thiết bị thừa. Thiết bị có nguồn khác thì chọn đúng nguồn hình thành của nó");
        }
        // Chiều ngược lại: phiếu lập từ phiếu nguồn mang đúng nguồn hình thành của phiếu nguồn đó.
        OriginRule expected = PROPOSALS.equals(intake.getSourceResource()) ? OriginRule.MUA_SAM
                : SESSIONS.equals(intake.getSourceResource()) ? OriginRule.KIEM_KE_THUA : null;
        if (expected != null && rule != expected) {
            throw new FieldValidationException("originSource",
                    "Phiếu lập từ %s nên nguồn hình thành là \"%s\"".formatted(
                            intake.getSourceCode() == null ? "phiếu nghiệp vụ khác" : intake.getSourceCode(), expected.label()));
        }
    }

    /** Phiếu nguồn của phiếu ghi tăng: đề xuất mua sắm (trong kế hoạch được duyệt), biên bản kiểm kê. */
    static final String PROPOSALS = "purchase_proposals";
    static final String SESSIONS = "inventory_sessions";

    /**
     * Phiếu lập từ một phiếu nguồn chỉ ghi tăng ĐÚNG những gì phiếu nguồn cho: thiết bị có trong phiếu nguồn, và theo
     * từng thiết bị, số thực nhận không quá phần phiếu nguồn còn lại sau các phiếu ghi tăng khác lập từ nó (nháp, chờ
     * duyệt, đã ghi tăng — như {@link #receivedBySource}). Phiếu nguồn: đề xuất mua sắm → số ĐƯA VÀO KẾ HOẠCH của các
     * dòng (cùng cách {@code PurchaseProposalService.intakeLines} tính số còn phải nhập); biên bản kiểm kê → số thiết bị
     * thừa đã ghi nhận.
     *
     * <p>Lúc lập phiếu nháp từ phiếu nguồn số đã được kiểm, nhưng phiếu nháp thì sửa được: không kiểm lại thì phiếu 10
     * máy chiếu theo kế hoạch sửa thành 50 rồi duyệt là sinh 50 thiết bị, thêm dòng thiết bị ngoài kế hoạch cũng được,
     * và đổi thiết bị của một dòng là trả lại số còn lại của thiết bị cũ để lập thêm phiếu khác. Nên kiểm ở mọi lần lưu
     * dòng, lúc trình và lúc duyệt.
     *
     * <p>Khoá dòng phiếu nguồn ({@code FOR UPDATE}) trước khi đếm: hai phiếu ghi tăng của cùng một kế hoạch sửa / duyệt
     * cùng lúc, hay một phiếu đang sửa trong lúc đề xuất lập thêm phiếu ghi tăng (đề xuất cũng khoá chính dòng đó), phải
     * đợi nhau — không thì mỗi bên đều thấy còn đủ và cộng lại vượt kế hoạch.
     *
     * @param submitting lúc trình / duyệt: phiếu nguồn còn phải ở trạng thái cho ghi tăng (đề xuất đã vào kế hoạch được
     *                   duyệt, biên bản đã duyệt). Lúc lưu nháp không đòi — để người lập vẫn sửa được phiếu.
     */
    private void checkSource(EquipmentIntake intake, boolean submitting) {
        String resource = intake.getSourceResource();
        if (intake.getSourceId() == null || !(PROPOSALS.equals(resource) || SESSIONS.equals(resource))) {
            return;
        }
        boolean proposal = PROPOSALS.equals(resource);
        String source = (proposal ? "đề xuất " : "biên bản kiểm kê ")
                + (intake.getSourceCode() == null ? "" : intake.getSourceCode());
        // Tên bảng lấy từ hằng ở trên, không từ dữ liệu gửi lên.
        List<?> head = entityManager.createNativeQuery(
                        "SELECT school_id, status FROM " + resource + " WHERE id = :id FOR UPDATE")
                .setParameter("id", intake.getSourceId())
                .setFlushMode(FlushModeType.COMMIT)
                .getResultList();
        if (head.isEmpty()) {
            throw new FieldValidationException("originSource", "Không còn %s mà phiếu này lập từ đó".formatted(source.strip()));
        }
        Object[] row = (Object[]) head.get(0);
        if (!intake.getSchool().getId().equals(((Number) row[0]).longValue())) {
            throw new FieldValidationException("originSource",
                    "%s không thuộc trường của phiếu".formatted(capitalize(source.strip())));
        }
        if (submitting && !VoucherStatus.COMPLETED.name().equals(row[1])) {
            throw new FieldValidationException("originSource", proposal
                    ? "Đề xuất %s chưa vào kế hoạch mua sắm được duyệt — chưa ghi tăng theo nó được".formatted(nullToDash(intake.getSourceCode()))
                    : "Biên bản kiểm kê %s chưa được duyệt — chưa ghi tăng thiết bị thừa theo nó được".formatted(nullToDash(intake.getSourceCode())));
        }

        Map<Long, Integer> allowed = new HashMap<>();
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery(proposal
                        // Số sẽ mua của dòng (PurchaseProposalLine.effectiveQuantity): số đưa vào kế hoạch, chưa có thì số đề nghị.
                        ? "SELECT catalog_id, SUM(COALESCE(planned_quantity, quantity, 0)) FROM purchase_proposal_lines"
                                + " WHERE proposal_id = :id AND COALESCE(planned_quantity, quantity, 0) > 0 GROUP BY catalog_id"
                        : "SELECT catalog_id, SUM(quantity) FROM inventory_surplus WHERE session_id = :id GROUP BY catalog_id")
                .setParameter("id", intake.getSourceId())
                .setFlushMode(FlushModeType.COMMIT)
                .getResultList();
        for (Object[] r : rows) {
            allowed.put(((Number) r[0]).longValue(), ((Number) r[1]).intValue());
        }
        // Phần đã nằm ở phiếu ghi tăng KHÁC lập từ cùng phiếu nguồn. Không đẩy (flush) các dòng đang sửa của phiếu này
        // xuống trước — chúng bị loại khỏi phép đếm, và chưa qua hết các bước kiểm.
        Map<Long, Integer> others = new HashMap<>();
        for (Object[] r : entityManager.createQuery("""
                        select l.catalog.id, sum(l.receivedQuantity) from EquipmentIntakeLine l
                        where l.intake.sourceResource = :resource and l.intake.sourceId = :id
                          and l.intake.status not in :dead and l.intake.id <> :self
                        group by l.catalog.id""", Object[].class)
                .setParameter("resource", resource)
                .setParameter("id", intake.getSourceId())
                .setParameter("dead", List.of(VoucherStatus.CANCELLED, VoucherStatus.REJECTED))
                .setParameter("self", intake.getId() == null ? -1L : intake.getId())
                .setFlushMode(FlushModeType.COMMIT)
                .getResultList()) {
            others.put((Long) r[0], ((Number) r[1]).intValue());
        }

        Map<Long, Integer> mine = new LinkedHashMap<>();
        Map<Long, String> names = new HashMap<>();
        for (EquipmentIntakeLine line : intake.getLines()) {
            Long catalogId = line.getCatalog().getId();
            if (!allowed.containsKey(catalogId)) {
                throw new FieldValidationException("lines", (proposal
                        ? "Dòng %d (%s): thiết bị không có trong kế hoạch của %s — phiếu lập từ kế hoạch chỉ nhận thiết bị của kế hoạch. Hàng mua thêm ngoài kế hoạch thì lập phiếu khác, nguồn Trường tự mua sắm"
                        : "Dòng %d (%s): thiết bị không có trong danh sách thiết bị thừa của %s — phiếu chỉ ghi tăng đúng thiết bị thừa biên bản đã ghi nhận")
                        .formatted(line.getLineNo(), line.getName(), source.strip()));
            }
            mine.merge(catalogId, line.getReceivedQuantity() == null ? 0 : line.getReceivedQuantity(), Integer::sum);
            names.putIfAbsent(catalogId, line.getCatalog().getName());
        }
        for (Map.Entry<Long, Integer> e : mine.entrySet()) {
            int limit = allowed.get(e.getKey());
            int left = Math.max(0, limit - others.getOrDefault(e.getKey(), 0));
            if (e.getValue() > left) {
                String used = left == limit ? "" : " (phiếu ghi tăng khác đã nhận %d)".formatted(limit - left);
                throw new FieldValidationException("lines", (proposal
                        ? "\"%s\": kế hoạch theo %s mua %d, còn %d chưa nhập%s — phiếu này ghi nhận %d. Giảm số thực nhận cho khớp kế hoạch"
                        : "\"%s\": %s ghi nhận %d thiết bị thừa, còn %d chưa ghi tăng%s — phiếu này ghi nhận %d. Giảm số thực nhận cho khớp biên bản")
                        .formatted(names.get(e.getKey()), source.strip(), limit, left, used, e.getValue()));
            }
        }
    }

    private static String nullToDash(String value) {
        return value == null ? "—" : value;
    }

    private static String capitalize(String value) {
        return value.isEmpty() ? value : Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    /**
     * Hàng MUA SẮM — đòi lúc TRÌNH (phiếu nháp từ đề xuất mua sắm chưa có hoá đơn): nhà cung cấp, số và ngày hoá đơn
     * (của phiếu, hoặc riêng của dòng), và đơn giá lớn hơn 0 ở mọi dòng có nhận hàng.
     */
    static void requirePurchaseDocuments(EquipmentIntake intake) {
        if (!isPurchase(intake)) {
            return;
        }
        boolean centralized = isCentralized(intake);
        if (centralized) {
            requireAssignment(intake);
        }
        for (EquipmentIntakeLine line : intake.getLines()) {
            if (line.getReceivedQuantity() == null || line.getReceivedQuantity() <= 0) {
                continue;
            }
            String where = "Dòng %d (%s)".formatted(line.getLineNo(), line.getName());
            if (line.effectiveSupplier() == null) {
                throw new FieldValidationException("supplier", centralized
                        ? "Hàng mua tập trung: nhập nhà cung cấp (nhà thầu)" : "Hàng mua sắm: nhập nhà cung cấp");
            }
            // Mua tập trung: hoá đơn có thể đứng tên cơ quan mua — số, ngày hoá đơn có thì ghi, không bắt buộc.
            if (!centralized && line.effectiveDocumentNo() == null) {
                throw new FieldValidationException("documentNo", "Hàng mua sắm: nhập số hoá đơn");
            }
            if (!centralized && line.effectiveDocumentDate() == null) {
                throw new FieldValidationException("documentDate", "Hàng mua sắm: nhập ngày hoá đơn");
            }
            if (line.getUnitPrice() == null || line.getUnitPrice().signum() <= 0) {
                throw new FieldValidationException("lines", where + ": hàng mua sắm phải có đơn giá lớn hơn 0");
            }
        }
    }

    /** Trình phải có ít nhất một tệp — hoá đơn hoặc biên bản — gắn vào phiếu hay vào một dòng của phiếu. */
    private void requireAttachment(EquipmentIntake intake) {
        List<Long> lineIds = intake.getLines().stream().map(EquipmentIntakeLine::getId)
                .filter(id -> id != null).toList();
        List<Long> documentIds = intake.getDocuments().stream().map(EquipmentIntakeDocument::getId)
                .filter(id -> id != null).toList();
        Long count = entityManager.createQuery("""
                        select count(a) from Attachment a
                        where (a.resource = :resource and a.recordId = :id)
                           or (a.resource = 'equipment_intake_lines' and a.recordId in :lines)
                           or (a.resource = 'equipment_intake_documents' and a.recordId in :documents)""", Long.class)
                .setParameter("resource", RESOURCE)
                .setParameter("id", intake.getId())
                .setParameter("lines", lineIds.isEmpty() ? List.of(-1L) : lineIds)
                .setParameter("documents", documentIds.isEmpty() ? List.of(-1L) : documentIds)
                .getSingleResult();
        if (count == null || count == 0) {
            throw new FieldValidationException("attachments",
                    "Đính kèm ít nhất một tệp — hoá đơn hoặc biên bản giao nhận — rồi trình");
        }
        // Mua tập trung: phải có tệp quyết định giao / biên bản bàn giao (tệp của phiếu); tệp hoá đơn có thì gắn.
        if (isCentralized(intake)) {
            Long own = entityManager.createQuery(
                            "select count(a) from Attachment a where a.resource = :resource and a.recordId = :id", Long.class)
                    .setParameter("resource", RESOURCE)
                    .setParameter("id", intake.getId())
                    .getSingleResult();
            if (own == null || own == 0) {
                throw new FieldValidationException("attachments", "Đính kèm tệp quyết định giao / biên bản bàn giao rồi trình");
            }
            return;
        }
        // Hàng mua: hoá đơn nào cũng phải có tệp hoá đơn của chính nó.
        if (!isPurchase(intake)) {
            return;
        }
        for (EquipmentIntakeDocument document : intake.getDocuments()) {
            Long files = entityManager.createQuery("""
                            select count(a) from Attachment a
                            where a.resource = 'equipment_intake_documents' and a.recordId = :id""", Long.class)
                    .setParameter("id", document.getId())
                    .getSingleResult();
            if (files == null || files == 0) {
                throw new FieldValidationException("documents", "Hoá đơn %d%s: đính kèm tệp hoá đơn".formatted(
                        document.getDocNo(), document.getDocumentNo() == null ? "" : " (số " + document.getDocumentNo() + ")"));
            }
        }
    }

    /** Ghi tăng gắn với một năm học: sổ tài sản và báo cáo tăng giảm đọc theo năm học. */
    private static void requireSchoolYear(EquipmentIntake intake) {
        if (intake.getSchoolYear() == null) {
            throw new FieldValidationException("schoolYear",
                    "Chọn năm học của phiếu. Chưa có năm học nào thì khai ở danh mục Năm học trước.");
        }
    }

    private static void requireAssetProfileData(EquipmentIntake intake) {
        List<EquipmentIntakeLine> generating = new ArrayList<>();
        for (EquipmentIntakeLine line : intake.getLines()) {
            if (line.getReceivedQuantity() == null || line.getReceivedQuantity() <= 0) {
                continue;
            }
            // Đơn giá KHÔNG bắt buộc: nguyên giá chỉ ghi khi có dữ liệu (HSMT 3.5.3), không vào điều kiện hồ sơ chuẩn.
            // Hoá chất có hạn dùng: thiếu nó thì màn Thiết bị không báo được lô sắp / đã hết hạn — hoá chất
            // hết hạn vẫn nằm trong kho như còn dùng được.
            if (isChemical(line) && line.getCatalog().getTrackingType() == TrackingType.BULK
                    && line.getExpiryDate() == null) {
                throw new FieldValidationException("lines",
                        "Dòng %d (%s): nhập hạn sử dụng — hoá chất bắt buộc có hạn sử dụng."
                                .formatted(line.getLineNo(), line.getName()));
            }
            if (line.getCatalog().getTrackingType() == TrackingType.SERIAL) {
                generating.add(line);
            }
        }
        if (generating.isEmpty()) {
            return;
        }
        for (EquipmentIntakeLine line : generating) {
            String where = "Dòng %d (%s)".formatted(line.getLineNo(), line.getName());
            // Nguồn kinh phí của DÒNG (khai riêng, hoặc theo đầu phiếu).
            if (line.effectiveFundingSource() == null) {
                throw new FieldValidationException("fundingSource",
                        ("%s: chọn nguồn kinh phí — ở đầu phiếu, hoặc riêng cho dòng này. Thiết bị thiếu nguồn "
                                + "kinh phí thì hồ sơ chưa đạt chuẩn.")
                                .formatted(where));
            }
            if (line.getCatalog().getUnit() == null) {
                throw new FieldValidationException("lines",
                        ("%s: nhóm thiết bị \"%s\" chưa khai đơn vị tính. Khai ở danh mục Nhóm thiết bị rồi trình lại — "
                                + "thiết bị không có đơn vị tính thì không vào được phiếu nào sau này.")
                                .formatted(where, line.getCatalog().getName()));
            }
        }
    }

    /** Phân loại của dòng — khai riêng, không thì theo thiết bị trong danh mục (như lúc sinh tài sản). */
    private static boolean isChemical(EquipmentIntakeLine line) {
        AssetCategory category = line.getAssetCategory() != null
                ? line.getAssetCategory() : line.getCatalog().getAssetCategory();
        return category == AssetCategory.CHEMICAL;
    }

    /** Trường của phiếu: theo payload, vắng thì theo tài khoản đang đăng nhập. */
    private School resolveSchool(IdRef ref) {
        if (ref != null && ref.id() != null) {
            return schools.get(ref.id());
        }
        Long own = principals.current().map(RowLevelPrincipal::schoolId).orElse(null);
        if (own == null) {
            throw new FieldValidationException("school", "Chọn trường");
        }
        return schools.get(own);
    }

    private static boolean present(IdRef ref) {
        return ref != null && ref.id() != null;
    }

    private static <R> R ref(IdRef ref, Function<Long, R> loader) {
        return present(ref) ? loader.apply(ref.id()) : null;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
