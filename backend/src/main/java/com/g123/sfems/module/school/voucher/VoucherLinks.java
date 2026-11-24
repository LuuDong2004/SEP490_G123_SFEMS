package com.g123.sfems.module.school.voucher;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.shared.data.RecordAccessRegistry;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Phiếu liên quan của một phiếu, hai chiều: phiếu GỐC đã sinh ra nó, và các phiếu đã sinh ra TỪ nó.
 *
 * <p>Chuỗi phiếu nối bằng sự kiện (kiểm kê thấy thừa → ghi tăng, đề xuất mua sắm → ghi tăng), và phiếu được sinh ghi
 * lại nguồn ở {@code source_resource / source_id / source_code}. Đây là chỗ DUY NHẤT đọc ngược các cột đó, nên màn hình
 * không phải hỏi từng loại phiếu.
 *
 * <p>Phiếu gốc phải đọc được (cùng luật quyền và phạm vi dòng với chính phiếu đó); phiếu con chỉ hiện khi người gọi có
 * quyền đọc loại phiếu đó và phiếu thuộc trường người gọi thấy.
 */
@Component
public class VoucherLinks {

    /** Một phiếu liên quan. {@code direction}: {@code source} = phiếu gốc, {@code child} = phiếu sinh ra từ phiếu này. */
    public record Link(String direction, String resource, Long id, String code, String status, String name) {
    }

    /**
     * Các bảng phiếu có cột nguồn — tên bảng trùng tên tài nguyên. Trong phạm vi đồ án chỉ phiếu ghi tăng được sinh
     * từ phiếu khác (đề xuất mua sắm đã hoàn tất, NC-07; biên bản kiểm kê có tài sản thừa).
     */
    private static final List<String> SOURCED = List.of("equipment_intakes");

    private final JdbcTemplate jdbc;
    private final RecordAccessRegistry records;
    private final VisibleSchools visible;

    public VoucherLinks(JdbcTemplate jdbc, RecordAccessRegistry records, VisibleSchools visible) {
        this.jdbc = jdbc;
        this.records = records;
        this.visible = visible;
    }

    public List<Link> of(String resource, Long id) {
        records.checkReadable(resource, id);
        Set<String> authorities = authorities();
        List<Link> links = new ArrayList<>();

        if (SOURCED.contains(resource)) {
            jdbc.queryForList("SELECT source_resource, source_id, source_code FROM " + resource
                    + " WHERE id = ? AND source_id IS NOT NULL", id).forEach(r -> links.add(new Link("source",
                    (String) r.get("source_resource"), ((Number) r.get("source_id")).longValue(),
                    (String) r.get("source_code"), null, null)));
        }

        String school = visible.sqlFilter("v.school_id");
        for (String child : SOURCED) {
            if (!authorities.contains(child + ":read")) {
                continue;
            }
            jdbc.queryForList("SELECT v.id, v.code, v.status FROM " + child + " v"
                            + " WHERE v.source_resource = ? AND v.source_id = ?" + school + " ORDER BY v.id",
                    resource, id).forEach(r -> addIfReadable(links, child, r));
        }
        return links;
    }

    /**
     * Phiếu con qua đúng phạm vi dòng của loại phiếu đó, không chỉ lọc theo trường: Sở / UBND không thấy phiếu chưa
     * trình tới mình (nháp, đang chờ hiệu trưởng — {@code reachedStep}), nên cũng không được thấy số và trạng thái
     * của nó ở đây.
     */
    private void addIfReadable(List<Link> links, String resource, Map<String, Object> r) {
        Long childId = ((Number) r.get("id")).longValue();
        try {
            records.checkReadable(resource, childId);
        } catch (ResourceNotFoundException | AccessDeniedException e) {
            return;
        }
        links.add(child(resource, r));
    }

    private static Link child(String resource, Map<String, Object> r) {
        return new Link("child", resource, ((Number) r.get("id")).longValue(), (String) r.get("code"),
                (String) r.get("status"), null);
    }

    private static Set<String> authorities() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? Set.of()
                : auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.toSet());
    }
}
