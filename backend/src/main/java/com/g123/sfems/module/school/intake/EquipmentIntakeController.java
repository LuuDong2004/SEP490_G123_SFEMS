package com.g123.sfems.module.school.intake;

import com.g123.sfems.domain.school.intake.EquipmentIntake;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.web.ListParams;
import com.g123.sfems.shared.web.ListResponse;
import com.g123.sfems.shared.exception.FieldValidationException;
import jakarta.validation.Valid;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.user.service.UserService;
import com.g123.sfems.module.school.voucher.VoucherController;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import java.util.HashMap;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.ObjectMapper;

/**
 * {@code /api/equipment_intakes} — năm endpoint của hợp đồng data provider, cộng
 * hai HÀNH ĐỘNG.
 *
 * <p>Trình, duyệt, trả lại, từ chối, huỷ là {@code POST /{id}/<hành động>} chứ
 * không phải một {@code PATCH} đặt {@code status}. Hai lý do, cả hai đều thực
 * tế: một lần xác nhận sinh ra 50 tài sản và cấp một số phiếu — đó không phải
 * việc sửa một trường; và một trường {@code status} nhận được từ form thì mọi
 * chuyển trạng thái đều hợp lệ như nhau, nên luật "chỉ nháp mới xác nhận được"
 * phải đi kiểm ở chỗ khác.
 *
 * <p>Không kế thừa {@code CatalogController}: phiếu không phải danh mục, và
 * đường tạo/sửa ở đây có luật riêng (phiếu đã xác nhận thì khoá).
 */
@RestController
@RequestMapping("/api/equipment_intakes")
public class EquipmentIntakeController {

    /** Lời nhắn kèm một bước duyệt: ý kiến khi duyệt, cần sửa gì khi trả lại, lý do khi từ chối hay huỷ. */
    public record NoteRequest(
            @Text(value = FieldRule.NOTE, label = "Ghi chú") String note) {
    }

    private final EquipmentIntakeService service;
    private final RowLevelSecurity rowLevel;
    private final UserService users;
    private final IntakeLookups lookups;
    private ObjectMapper json;

    /** Nhãn Cơ sở trên danh sách — dựng lại dòng thành cây JSON. */
    @Autowired
    void setJson(ObjectMapper json) {
        this.json = json;
    }

    public EquipmentIntakeController(EquipmentIntakeService service, RowLevelSecurity rowLevel, UserService users,
            IntakeLookups lookups) {
        this.service = service;
        this.rowLevel = rowLevel;
        this.users = users;
        this.lookups = lookups;
    }

    /** Danh bạ nhà cung cấp của trường (254): gõ tên hoặc mã số thuế ở ô Nhà cung cấp. */
    @GetMapping("/suppliers")
    @PreAuthorize("hasAuthority('equipment_intakes:read')")
    public List<IntakeLookups.SupplierHint> suppliers(@RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) String q) {
        return lookups.suppliers(schoolId, q);
    }

    /** Hoá đơn này đã ghi tăng ở phiếu khác chưa (cảnh báo, không chặn). */
    @GetMapping("/duplicate-documents")
    @PreAuthorize("hasAuthority('equipment_intakes:read')")
    public List<IntakeLookups.DuplicateDocument> duplicateDocuments(@RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) String documentNo, @RequestParam(required = false) String taxCode,
            @RequestParam(required = false) String supplier, @RequestParam(required = false) Long excludeId) {
        return lookups.duplicates(schoolId, documentNo, taxCode, supplier, excludeId);
    }

    /** Lần nhập trước của các thiết bị (đơn giá, model, hãng, bảo hành) — gợi ý khi lập phiếu. */
    @GetMapping("/catalog-history")
    @PreAuthorize("hasAuthority('equipment_intakes:read')")
    public List<IntakeLookups.CatalogHistory> catalogHistory(@RequestParam(required = false) Long schoolId,
            @RequestParam(required = false) List<Long> catalogIds) {
        return lookups.history(schoolId, catalogIds);
    }

    /** Phục vụ cả {@code getList} lẫn {@code getMany} — chỉ khác ở query string. */
    @GetMapping
    @PreAuthorize("hasAuthority('equipment_intakes:read')")
    public ResponseEntity<List<Object>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<EquipmentIntake> found = service.getMany(ids);
            Map<Long, RefSummary> creators = creators(found);
            List<Object> rows = found.stream().map(i -> respond(i, creators)).toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<EquipmentIntake> page = service.list(params);
        Map<Long, RefSummary> creators = creators(page.getContent());
        List<Object> rows = page.getContent().stream().map(i -> respond(i, creators)).toList();
        return ListResponse.of(VoucherController.attachCampuses(json, page.getContent(), rows,
                service.campusLabels(page.getContent().stream().map(EquipmentIntake::getId).toList())),
                page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('equipment_intakes:read')")
    public Object get(@PathVariable Long id) {
        return respond(service.get(id));
    }

    /** Tệp mẫu danh sách thiết bị nhận (Mã DM thiết bị · Tên · Số lượng · Đơn giá) — form "Nhập Excel". */
    @GetMapping("/lines-template")
    @PreAuthorize("hasAuthority('equipment_intakes:write')")
    public ResponseEntity<byte[]> linesTemplate() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("Mẫu thiết bị phiếu ghi tăng - " + java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy")) + ".xlsx", StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(IntakeLinesExcel.template());
    }

    /**
     * Đọc tệp Excel danh sách thiết bị và trả các dòng (mã, số lượng, đơn giá). Không ghi gì: form khớp mã với danh
     * mục và thêm dòng như khi dán từ Excel.
     */
    @PostMapping("/lines-file")
    @PreAuthorize("hasAuthority('equipment_intakes:write')")
    public List<IntakeLinesExcel.Line> readLinesFile(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) throw new FieldValidationException("file", "Chưa chọn tệp");
        if (file.getSize() > 10L * 1024 * 1024) throw new FieldValidationException("file", "Tệp lớn hơn 10 MB");
        try {
            return IntakeLinesExcel.read(file.getOriginalFilename() == null ? "" : file.getOriginalFilename(), file.getBytes());
        } catch (IOException e) {
            throw new FieldValidationException("file", "Không đọc được tệp tải lên");
        }
    }

    @PostMapping
    @PreAuthorize("hasAuthority('equipment_intakes:write')")
    public ResponseEntity<Object> create(@Valid @RequestBody EquipmentIntakeRequest request) {
        EquipmentIntake created = service.create(request);
        return ResponseEntity
                .created(URI.create("/api/equipment_intakes/" + created.getId()))
                .body(respond(created));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('equipment_intakes:write')")
    public Object update(@PathVariable Long id, @Valid @RequestBody EquipmentIntakePatchRequest request) {
        return respond(service.update(id, request));
    }

    /** Trình lên lãnh đạo trường. Người lập là người trình, nên mã quyền là {@code :write}. */
    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAuthority('equipment_intakes:write')")
    public Object submit(@PathVariable Long id) {
        return respond(service.submit(id));
    }

    /**
     * Duyệt — với phiếu nhập, lần duyệt cuối là lúc ghi tăng tài sản.
     *
     * <p>Mã quyền {@code :approve}, KHÔNG phải {@code :write}: người lập phiếu
     * không tự duyệt phiếu của mình. Cấp của người duyệt (đúng trường của phiếu)
     * được kiểm tiếp ở {@code VoucherWorkflow}.
     */
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('equipment_intakes:approve')")
    public Object approve(@PathVariable Long id, @Valid @RequestBody(required = false) NoteRequest request) {
        return respond(service.approve(id, request == null ? null : request.note()));
    }

    @PostMapping("/{id}/return")
    @PreAuthorize("hasAuthority('equipment_intakes:approve')")
    public Object returnToDraft(@PathVariable Long id, @Valid @RequestBody(required = false) NoteRequest request) {
        return respond(service.returnToDraft(id, request == null ? null : request.note()));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAuthority('equipment_intakes:approve')")
    public Object reject(@PathVariable Long id, @Valid @RequestBody(required = false) NoteRequest request) {
        return respond(service.reject(id, request == null ? null : request.note()));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('equipment_intakes:write')")
    public Object cancel(@PathVariable Long id, @Valid @RequestBody(required = false) NoteRequest request) {
        return respond(service.cancel(id, request == null ? null : request.note()));
    }

    /** Vọng lại bản ghi vừa xoá — data provider có phân tích body trả về. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('equipment_intakes:delete')")
    public Object delete(@PathVariable Long id) {
        return EquipmentIntakeResponse.from(service.delete(id), Map.of(), Set.of(), null);
    }

    private Object respond(EquipmentIntake item) {
        return respond(item, creators(List.of(item)));
    }

    private Object respond(EquipmentIntake item, Map<Long, RefSummary> creators) {
        Map<String, Boolean> can = VoucherController.permitted(rowLevel.capabilities(item), "equipment_intakes");
        return EquipmentIntakeResponse.from(item, can,
                service.actions(item, can, CurrentUser.has("equipment_intakes:approve")),
                creators.get(item.getCreatedById()));
    }

    /** Người lập của cả trang trong MỘT lần đọc — không phải một câu truy vấn mỗi dòng. */
    private Map<Long, RefSummary> creators(List<EquipmentIntake> items) {
        List<Long> ids = items.stream().map(EquipmentIntake::getCreatedById).filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, RefSummary> out = new HashMap<>();
        for (User user : users.getMany(ids)) {
            out.put(user.getId(), new RefSummary(user.getId(), user.getUsername(),
                    user.getFullName() != null ? user.getFullName() : user.getUsername()));
        }
        return out;
    }
}
