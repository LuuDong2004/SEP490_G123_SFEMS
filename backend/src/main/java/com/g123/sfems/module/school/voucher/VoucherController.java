package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.web.ListParams;
import com.g123.sfems.shared.web.ListResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * Các endpoint mà MỌI loại phiếu có: năm endpoint của hợp đồng data provider cộng các hành động của
 * vòng duyệt ({@code POST /{id}/submit|approve|return|reject|cancel|complete}).
 *
 * <p>Lớp con chỉ khai {@code @RestController @RequestMapping("/api/<resource>")}, constructor và
 * {@link #toResponse}:
 * <pre>{@code
 * @RestController
 * @RequestMapping("/api/equipment_intakes")
 * public class EquipmentIntakeController extends VoucherController<EquipmentIntake, IntakeRequest, IntakePatchRequest> {
 *     public EquipmentIntakeController(EquipmentIntakeService service, RowLevelSecurity rowLevel) { super(service, rowLevel); }
 *     protected Object toResponse(EquipmentIntake v, Map<String, Boolean> can, Set<String> actions) {
 *         return EquipmentIntakeResponse.from(v, can, actions);
 *     }
 * }
 * }</pre>
 *
 * <p>Quyền được kiểm bằng code thay vì {@code @PreAuthorize}, vì chuỗi mã quyền phụ thuộc tài nguyên
 * của lớp con. Kết quả giống hệt: thiếu mã quyền là 403, trước khi chạm tới service. Hành động DUYỆT
 * cần {@code :approve}, không phải {@code :write}: người lập phiếu không tự duyệt phiếu của mình.
 */
public abstract class VoucherController<V extends SchoolVoucher, C extends VoucherRequest, P extends VoucherRequest> {

    /** Lời nhắn kèm một bước duyệt. */
    public record NoteRequest(@Size(max = 500, message = "Tối đa 500 ký tự") String note) {
    }

    protected final VoucherService<V, C, P> service;
    protected final RowLevelSecurity rowLevel;
    private final String resource;

    protected VoucherController(VoucherService<V, C, P> service, RowLevelSecurity rowLevel) {
        this.service = service;
        this.rowLevel = rowLevel;
        this.resource = service.resource();
    }

    /** DTO trả về của loại phiếu; gắn {@link VoucherHeader#of} cho phần chung. */
    protected abstract Object toResponse(V voucher, Map<String, Boolean> can, Set<String> actions);

    /**
     * DTO của một dòng DANH SÁCH — mặc định như màn chi tiết. Loại phiếu có nhiều dòng (kiểm kê cả
     * trường) đè để trả bản gọn không kèm mảng dòng.
     */
    protected Object toListResponse(V voucher, Map<String, Boolean> can, Set<String> actions) {
        return toResponse(voucher, can, actions);
    }

    @GetMapping
    public ResponseEntity<List<Object>> list(@RequestParam MultiValueMap<String, String> query) {
        require("read");
        ListParams params = new ListParams(query);
        List<Long> ids = params.ids();
        if (!ids.isEmpty() && params.filters().isEmpty()) {
            List<Object> rows = service.getMany(ids).stream().map(this::respond).toList();
            return ListResponse.of(rows, rows.size());
        }
        Page<V> page = service.list(params);
        List<Object> rows = page.getContent().stream().map(v -> respond(v, this::toListResponse)).toList();
        return ListResponse.of(rows, page.getTotalElements());
    }

    @GetMapping("/{id}")
    public Object get(@PathVariable Long id) {
        require("read");
        return respond(service.get(id));
    }

    @PostMapping
    public ResponseEntity<Object> create(@Valid @RequestBody C request) {
        require("write");
        V created = service.create(request);
        return ResponseEntity.created(URI.create("/api/" + resource + "/" + created.getId()))
                .body(respond(created));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    public Object update(@PathVariable Long id, @Valid @RequestBody P request) {
        require("write");
        return respond(service.update(id, request));
    }

    @PostMapping("/{id}/submit")
    public Object submit(@PathVariable Long id) {
        require("write");
        return respond(service.submit(id));
    }

    @PostMapping("/{id}/approve")
    public Object approve(@PathVariable Long id, @Valid @RequestBody(required = false) NoteRequest request) {
        require("approve");
        return respond(service.approve(id, note(request)));
    }

    @PostMapping("/{id}/return")
    public Object returnToDraft(@PathVariable Long id, @Valid @RequestBody(required = false) NoteRequest request) {
        require("approve");
        return respond(service.returnToDraft(id, note(request)));
    }

    @PostMapping("/{id}/reject")
    public Object reject(@PathVariable Long id, @Valid @RequestBody(required = false) NoteRequest request) {
        require("approve");
        return respond(service.reject(id, note(request)));
    }

    @PostMapping("/{id}/cancel")
    public Object cancel(@PathVariable Long id, @Valid @RequestBody(required = false) NoteRequest request) {
        require("write");
        return respond(service.cancel(id, note(request)));
    }

    @PostMapping("/{id}/complete")
    public Object complete(@PathVariable Long id, @Valid @RequestBody(required = false) NoteRequest request) {
        require("write");
        return respond(service.complete(id, note(request)));
    }

    /** Vọng lại bản ghi vừa xoá — data provider có phân tích body trả về. */
    @DeleteMapping("/{id}")
    public Object delete(@PathVariable Long id) {
        require("delete");
        return toResponse(service.delete(id), Map.of(), Set.of());
    }

    protected Object respond(V voucher) {
        return respond(voucher, this::toResponse);
    }

    /** Dựng DTO bằng {@code builder}, với cờ phạm vi và các nút y như {@link #respond(SchoolVoucher)}. */
    protected Object respond(V voucher, ResponseBuilder<V> builder) {
        Map<String, Boolean> can = permitted(rowLevel.capabilities(voucher), resource);
        return builder.build(voucher, can, service.actions(voucher, can, CurrentUser.has(code("approve"))));
    }

    @FunctionalInterface
    protected interface ResponseBuilder<V> {
        Object build(V voucher, Map<String, Boolean> can, Set<String> actions);
    }

    /**
     * Cờ của PHẠM VI DÒNG giao với MÃ QUYỀN của người gọi: lãnh đạo trường có phạm vi ghi trên phiếu
     * của trường mình nhưng không có mã {@code write}, nên chỉ nhìn phạm vi thì máy chủ mời "Sửa"
     * trên một phiếu mà lời gọi tương ứng sẽ bị 403.
     */
    public static Map<String, Boolean> permitted(Map<String, Boolean> can, String resource) {
        Map<String, Boolean> result = new LinkedHashMap<>(can);
        result.computeIfPresent("write", (k, v) -> v && CurrentUser.has(resource + ":write"));
        result.computeIfPresent("delete", (k, v) -> v && CurrentUser.has(resource + ":delete"));
        return result;
    }

    protected void require(String action) {
        String code = code(action);
        if (!CurrentUser.has(code)) {
            throw new AccessDeniedException(code);
        }
    }

    protected String code(String action) {
        return resource + ":" + action;
    }

    protected static String note(NoteRequest request) {
        return request == null ? null : request.note();
    }

    /** Để lớp con dùng khi dựng payload lồng. */
    protected static IdRef ref(Long id) {
        return new IdRef(id);
    }
}
