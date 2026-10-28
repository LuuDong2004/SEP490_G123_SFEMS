package com.g123.sfems.module.catalog.base;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.module.catalog.base.dto.CatalogInput;
import com.g123.sfems.module.catalog.base.dto.CatalogResponse;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.web.ListParams;
import com.g123.sfems.shared.web.ListResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
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

/**
 * Năm endpoint của một danh mục, viết một lần.
 *
 * <p>Lớp con mang {@code @RestController} và {@code @RequestMapping("/api/<tên>")};
 * các mapping ở đây được kế thừa. Đoạn đường dẫn phải trùng đúng tên resource
 * trong {@code routes.tsx}, như mọi resource khác.
 *
 * <h2>Mã quyền SUY RA từ tên resource, không khai lại</h2>
 *
 * <p>{@code @PreAuthorize} ở đây đọc {@code #root.this.authority('read')} —
 * tức là hỏi chính controller đang phục vụ request, và nó trả về
 * {@code <resource>:read}. Đó đúng là quy tắc mà cả nền dùng: mã quyền là
 * {@code {resource}:{read|write|delete}}, suy ra chứ không tra bảng. Nhờ vậy
 * một danh mục mới không có chỗ nào để khai sai mã quyền — nó chỉ có một tên.
 *
 * <p>Các hằng số trong {@code Permissions} vẫn là cách viết cho resource ngoài
 * nhóm này; ở đây việc lặp một hằng số cho mỗi danh mục chỉ thêm chỗ để lệch.
 */
public abstract class CatalogController<
        T extends CatalogEntity, C extends CatalogInput, P extends CatalogInput> {

    private final CatalogService<T, C, P> service;
    private final RowLevelSecurity rowLevel;

    protected CatalogController(CatalogService<T, C, P> service, RowLevelSecurity rowLevel) {
        this.service = service;
        this.rowLevel = rowLevel;
    }

    /** Tên resource, ví dụ {@code units} — nửa đầu mã quyền và đoạn đường dẫn. */
    protected abstract String resource();

    /**
     * Mã quyền cho một hành động trên resource này. Public vì biểu thức SpEL
     * của {@code @PreAuthorize} gọi nó qua {@code #root.this}.
     */
    public String authority(String action) {
        return resource() + ":" + action;
    }

    /**
     * Hình dạng trên đường truyền của một mục. Mặc định là năm trường chung;
     * danh mục có trường riêng ghi đè để trả thêm chúng.
     */
    protected Object respond(T item, RowLevelSecurity rowLevel) {
        return CatalogResponse.from(item, rowLevel);
    }

    /**
     * Hình dạng của một mục TRONG DANH SÁCH — mặc định như {@link #respond}. Danh mục có trường văn
     * bản dài chỉ hiện ở màn chi tiết ghi đè để bỏ chúng khỏi danh sách (vài nghìn người cùng mở).
     */
    protected Object respondInList(T item, RowLevelSecurity rowLevel) {
        return respond(item, rowLevel);
    }

    /** Phục vụ cả {@code getList} lẫn {@code getMany} — chỉ khác ở query string. */
    @GetMapping
    @PreAuthorize("hasAuthority(#root.this.authority('read'))")
    public ResponseEntity<List<Object>> list(
            @RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);

        List<Long> ids = params.ids();
        if (!ids.isEmpty()) {
            List<Object> rows = service.getMany(ids).stream()
                    .map(row -> respond(row, rowLevel))
                    .toList();
            return ListResponse.of(rows, rows.size());
        }

        Page<T> page = service.list(params);
        return ListResponse.of(
                page.map(row -> respondInList(row, rowLevel)).getContent(),
                page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority(#root.this.authority('read'))")
    public Object get(@PathVariable Long id) {
        return respond(service.get(id), rowLevel);
    }

    @PostMapping
    @PreAuthorize("hasAuthority(#root.this.authority('write'))")
    public ResponseEntity<Object> create(@Valid @RequestBody C request) {
        T created = service.create(request);
        return ResponseEntity
                .created(URI.create("/api/" + resource() + "/" + created.getId()))
                .body(respond(created, rowLevel));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority(#root.this.authority('write'))")
    public Object update(@PathVariable Long id, @Valid @RequestBody P request) {
        return respond(service.update(id, request), rowLevel);
    }

    /** Vọng lại bản ghi vừa xoá — data provider có phân tích body trả về. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority(#root.this.authority('delete'))")
    public Object delete(@PathVariable Long id) {
        return respond(service.delete(id), null);
    }
}
