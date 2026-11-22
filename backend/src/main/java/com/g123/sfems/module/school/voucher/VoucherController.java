package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.facility.CampusScope.CampusLabel;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.web.ListParams;
import com.g123.sfems.shared.web.ListResponse;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Các endpoint mà MỌI loại phiếu có: năm endpoint của hợp đồng data provider
 * cộng các hành động của vòng duyệt ({@code POST /{id}/submit|approve|return|
 * reject|cancel|complete}).
 *
 * <p>Quyền được kiểm bằng code thay vì {@code @PreAuthorize}, vì chuỗi mã quyền
 * phụ thuộc tài nguyên của lớp con — {@code equipment_intakes:approve},
 * {@code inventory_sessions:write}... Kết quả giống hệt: thiếu mã quyền là 403, trước
 * khi chạm tới service. Hành động DUYỆT cần {@code :approve}, không phải
 * {@code :write}: người lập phiếu không tự duyệt phiếu của mình.
 *
 * @param <V> entity phiếu
 * @param <C> payload tạo
 * @param <P> payload sửa (mọi trường tuỳ chọn)
 */
public abstract class VoucherController<V extends SchoolVoucher, C extends VoucherRequest, P extends VoucherRequest> {

    /** Lời nhắn kèm một bước duyệt. */
    public record NoteRequest(@Text(value = FieldRule.NOTE, label = "Ghi chú") String note) {
    }

    protected final VoucherService<V, C, P> service;
    protected final RowLevelSecurity rowLevel;
    /** Đọc một lần: mỗi lần gọi qua proxy của service là một lượt qua bộ chặn giao dịch. */
    private final String resource;
    private ObjectMapper json;

    protected VoucherController(VoucherService<V, C, P> service, RowLevelSecurity rowLevel) {
        this.service = service;
        this.rowLevel = rowLevel;
        this.resource = service.resourceName();
    }

    /** Không qua hàm dựng: mười lăm lớp con gọi {@code super(service, rowLevel)}, không cần biết tới nó. */
    @Autowired
    void setJson(ObjectMapper json) {
        this.json = json;
    }

    /** DTO trả về của loại phiếu. */
    protected abstract Object toResponse(V voucher, Map<String, Boolean> can, Set<String> actions);

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
        return ListResponse.of(withCampuses(page.getContent(), listRows(page.getContent())), page.getTotalElements());
    }

    /**
     * Nhãn Cơ sở ({@code campuses: [{id, name, primary, branch}]}) trên từng dòng danh sách — chỉ khi người xem là
     * tài khoản cả trường của một trường nhiều cơ sở ({@link VoucherService#campusLabels}); không thì để nguyên.
     */
    protected List<Object> withCampuses(List<V> vouchers, List<Object> rows) {
        return attachCampuses(json, vouchers,
                rows, service.campusLabels(vouchers.stream().map(V::getId).toList()));
    }

    /** Gắn {@code campuses} vào từng dòng (cùng thứ tự với {@code vouchers}); {@code labels} rỗng thì để nguyên. */
    public static List<Object> attachCampuses(ObjectMapper json, List<? extends SchoolVoucher> vouchers,
            List<Object> rows, Map<Long, List<CampusLabel>> labels) {
        if (labels.isEmpty()) {
            return rows;
        }
        List<Object> out = new ArrayList<>(rows.size());
        for (int i = 0; i < rows.size(); i++) {
            JsonNode tree = json.valueToTree(rows.get(i));
            if (tree instanceof ObjectNode node && i < vouchers.size()) {
                node.set("campuses", json.valueToTree(labels.getOrDefault(vouchers.get(i).getId(), List.of())));
            }
            out.add(tree);
        }
        return out;
    }

    /**
     * Dòng của DANH SÁCH: như {@code GET /{id}} nhưng KHÔNG kèm mảng {@code lines} — màn danh sách chỉ đọc số
     * tóm tắt ({@code lineCount}, tổng tiền, số đã trả…), còn một biên bản kiểm kê cả trường có hàng nghìn dòng,
     * mỗi dòng một tài sản. {@code getMany} ({@code ?ids[0]=}) và màn chi tiết vẫn trả đủ dòng. Loại phiếu có
     * thể rất nhiều dòng đè hàm này để khỏi nạp dòng từ CSDL ({@link VoucherService#initializeForList}).
     */
    protected List<Object> listRows(List<V> vouchers) {
        return vouchers.stream().map(v -> withoutLines(respond(v))).toList();
    }

    protected Object withoutLines(Object response) {
        JsonNode tree = json.valueToTree(response);
        if (tree instanceof ObjectNode node) {
            // Giữ lại vài tài sản đầu ({@code lineItems}: mã, tên) để danh sách nói được phiếu về CÁI GÌ — "Số tài
            // sản: 1" không cho biết máy chiếu hay bàn ghế (E2E-13). Dòng đã nạp sẵn, không tốn thêm truy vấn.
            JsonNode lines = node.get("lines");
            if (lines != null && lines.isArray()) {
                ArrayNode items = node.putArray("lineItems");
                for (JsonNode line : lines) {
                    JsonNode equipment = line.get("equipment");
                    if (equipment == null || equipment.isNull()) {
                        continue;
                    }
                    ObjectNode item = items.addObject();
                    item.set("code", equipment.get("code"));
                    item.set("name", equipment.get("name"));
                    if (items.size() == 3) {
                        break;
                    }
                }
            }
            node.remove("lines");
        }
        return tree;
    }

    @GetMapping("/{id}")
    public Object get(@PathVariable Long id) {
        require("read");
        return respond(service.get(id));
    }

    @PostMapping
    public ResponseEntity<Object> create(@Valid @RequestBody C request) {
        require("write");
        V created = service.create(request, request.school());
        return ResponseEntity.created(URI.create("/api/" + resource + "/" + created.getId()))
                .body(respond(created));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    public Object update(@PathVariable Long id, @Valid @RequestBody P request) {
        require("write");
        return respond(service.update(id, request, request.school()));
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
     * Cờ của PHẠM VI DÒNG giao với MÃ QUYỀN của người gọi. {@code capabilities} chỉ trả lời "dòng này có
     * nằm trong phạm vi ghi không"; lãnh đạo trường có phạm vi ghi trên phiếu của trường mình nhưng không
     * có mã {@code write}, nên chỉ nhìn phạm vi thì máy chủ mời "Sửa, Huỷ, Xoá" trên một phiếu mà lời
     * gọi tương ứng sẽ bị 403. Khoá vắng mặt (cờ không tính được) vẫn vắng mặt.
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
