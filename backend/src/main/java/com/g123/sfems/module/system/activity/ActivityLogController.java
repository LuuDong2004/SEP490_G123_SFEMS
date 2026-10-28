package com.g123.sfems.module.system.activity;

import com.g123.sfems.domain.system.activity.ActivityLog;
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
 * {@code GET /api/activity_logs} — nhật ký hoạt động, mới nhất trước. Chỉ đọc.
 *
 * <p>Lọc được theo người ({@code actorName}), tài nguyên, thao tác, mã trạng
 * thái và khoảng ngày; {@code q} tìm trong đường dẫn và tên người.
 */
@RestController
@RequestMapping("/api/activity_logs")
public class ActivityLogController {

    private static final Set<String> SORTABLE = Set.of("id", "createdAt", "actorName", "resource", "action");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    public record ActivityLogResponse(Long id, Instant createdAt, Long actorId, String actorName, String method,
            String path, String resource, Long recordId, String action, Integer statusCode, String ip) {

        static ActivityLogResponse from(ActivityLog row) {
            return new ActivityLogResponse(row.getId(), row.getCreatedAt(), row.getActorId(), row.getActorName(),
                    row.getMethod(), row.getPath(), row.getResource(), row.getRecordId(), row.getAction(),
                    row.getStatusCode(), row.getIp());
        }
    }

    private final ActivityLogRepository repository;

    public ActivityLogController(ActivityLogRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('activity_logs:read')")
    public ResponseEntity<List<ActivityLogResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        ListParams params = new ListParams(query);
        Page<ActivityLog> page = repository.findAll(filters(params), params.pageable(SORTABLE, DEFAULT_SORT));
        return ListResponse.of(page.getContent().stream().map(ActivityLogResponse::from).toList(),
                page.getTotalElements());
    }

    private static Specification<ActivityLog> filters(ListParams params) {
        List<Specification<ActivityLog>> specs = new ArrayList<>();
        for (ListParams.Criterion c : params.filters()) {
            Specification<ActivityLog> spec = switch (c.field()) {
                case "actorName" -> (root, q, cb) ->
                        cb.like(cb.lower(root.get("actorName")), ListParams.likePattern(c.value()));
                case "resource", "action", "method" -> (root, q, cb) -> cb.equal(root.get(c.field()), c.value());
                // Lịch sử đăng nhập của MỘT tài khoản (QLTB-242) — lần đăng nhập thành công mang id người làm.
                case "actorId" -> actorIdSpec(c.value());
                case "statusCode" -> statusSpec(c);
                case "createdAt" -> dateSpec(c);
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }
        params.search().ifPresent(term -> specs.add((root, q, cb) -> cb.or(
                cb.like(cb.lower(root.get("path")), ListParams.likePattern(term)),
                cb.like(cb.lower(root.get("actorName")), ListParams.likePattern(term)))));
        return Specification.allOf(specs);
    }

    private static Specification<ActivityLog> statusSpec(ListParams.Criterion c) {
        try {
            int code = Integer.parseInt(c.value().trim());
            return switch (c.operator()) {
                case GTE -> (root, q, cb) -> cb.greaterThanOrEqualTo(root.get("statusCode"), code);
                case LTE -> (root, q, cb) -> cb.lessThanOrEqualTo(root.get("statusCode"), code);
                default -> (root, q, cb) -> cb.equal(root.get("statusCode"), code);
            };
        } catch (NumberFormatException e) {
            return (root, q, cb) -> cb.disjunction();
        }
    }

    /** Ngày theo giờ Việt Nam: "hôm nay" của người đọc nhật ký, không phải của máy chủ. */
    private static Specification<ActivityLog> dateSpec(ListParams.Criterion c) {
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

    private static Specification<ActivityLog> actorIdSpec(String value) {
        try {
            long id = Long.parseLong(value.trim());
            return (root, q, cb) -> cb.equal(root.get("actorId"), id);
        } catch (NumberFormatException e) {
            return (root, q, cb) -> cb.disjunction();
        }
    }
}
