package com.g123.sfems.module.system.datachange;

import com.g123.sfems.domain.system.datachange.DataChange;
import com.g123.sfems.shared.web.ListParams;
import com.g123.sfems.shared.web.ListResponse;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/data_changes} — lịch sử thay đổi dữ liệu, mới nhất trước. Chỉ đọc, chỉ quản trị viên.
 *
 * <p>Lọc theo bảng ({@code resource}), bản ghi ({@code recordId}), trường ({@code field}), người
 * ({@code actorName}, chứa) và khoảng ngày ({@code createdAt_gte/_lte}); {@code q} tìm trong tên bản ghi, giá trị cũ /
 * mới và tên người.
 */
@RestController
@RequestMapping("/api/data_changes")
public class DataChangeController {

    private static final Set<String> SORTABLE = Set.of("id", "createdAt", "resource", "actorName");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final DataChangeRepository repository;

    public DataChangeController(DataChangeRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('data_changes:read')")
    public ResponseEntity<List<DataChangeResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);
        Page<DataChange> page = repository.findAll(filters(params), params.pageable(SORTABLE, DEFAULT_SORT));
        return ListResponse.of(page.getContent().stream().map(DataChangeResponse::from).toList(),
                page.getTotalElements());
    }

    private static Specification<DataChange> filters(ListParams params) {
        List<Specification<DataChange>> specs = new ArrayList<>();
        for (ListParams.Criterion c : params.filters()) {
            Specification<DataChange> spec = switch (c.field()) {
                case "resource", "field" -> (root, q, cb) -> cb.equal(root.get(c.field()), c.value());
                case "recordId" -> number(c.value(), "recordId");
                case "actorName" -> (root, q, cb) ->
                        ListParams.foldedLike(cb, root.get("actorName"), c.value());
                case "createdAt" -> date(c);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }
        params.search().ifPresent(term -> specs.add((root, q, cb) -> cb.or(
                ListParams.foldedLike(cb, root.get("recordLabel"), term),
                ListParams.foldedLike(cb, root.get("oldValue"), term),
                ListParams.foldedLike(cb, root.get("newValue"), term),
                ListParams.foldedLike(cb, root.get("actorName"), term))));
        return Specification.allOf(specs);
    }

    private static Specification<DataChange> number(String value, String attribute) {
        try {
            long n = Long.parseLong(value.trim());
            return (root, q, cb) -> cb.equal(root.get(attribute), n);
        } catch (NumberFormatException e) {
            return (root, q, cb) -> cb.disjunction();
        }
    }

    /** Ngày theo giờ Việt Nam, như nhật ký hoạt động. */
    private static Specification<DataChange> date(ListParams.Criterion c) {
        LocalDate day;
        try {
            day = LocalDate.parse(c.value().trim().substring(0, 10));
        } catch (DateTimeParseException | IndexOutOfBoundsException e) {
            return (root, q, cb) -> cb.disjunction();
        }
        Instant start = day.atStartOfDay(ZONE).toInstant();
        Instant end = day.plusDays(1).atStartOfDay(ZONE).toInstant();
        return switch (c.operator()) {
            case GTE -> (root, q, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), start);
            case LTE -> (root, q, cb) -> cb.lessThan(root.get("createdAt"), end);
            default -> (root, q, cb) -> cb.and(cb.greaterThanOrEqualTo(root.get("createdAt"), start),
                    cb.lessThan(root.get("createdAt"), end));
        };
    }
}
