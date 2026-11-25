package com.g123.sfems.module.system.datachange;

import com.g123.sfems.domain.system.datachange.DataChange;
import com.g123.sfems.shared.security.ActorNames;
import com.g123.sfems.shared.security.CurrentUser;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lịch sử thay đổi của MỘT bản ghi, cho tab "Lịch sử" trong hồ sơ (cán bộ — trưởng nhóm 13/11/2026). Không tự kiểm
 * quyền: feature sở hữu bản ghi kiểm đọc được bản ghi trước rồi mới gọi — ai xem được hồ sơ thì xem được lịch sử của
 * chính hồ sơ đó, không mở cả màn lịch sử chung (vẫn chỉ quản trị viên).
 */
@Service
public class DataChangeService {

    /** Đủ cho một hồ sơ; hồ sơ sửa nhiều hơn thì xem đủ ở màn Quản trị. */
    private static final int LIMIT = 200;

    private static final int MAX = 1000;

    private final DataChangeRepository repository;
    private final JdbcTemplate jdbc;
    private final ActorNames actors;

    public DataChangeService(DataChangeRepository repository, JdbcTemplate jdbc, ActorNames actors) {
        this.repository = repository;
        this.jdbc = jdbc;
        this.actors = actors;
    }

    /**
     * Ghi tay một dòng nhật ký — cho thay đổi mà bộ ghi tự động ({@code DataChangeRecorder}) không thấy, như một tập
     * nhiều-nhiều (thiết bị dùng chung của dòng danh mục tối thiểu). Giá trị cũ và mới giống nhau thì không ghi.
     */
    @Transactional
    public void record(String resource, Long recordId, String recordLabel, String field, String oldValue,
            String newValue) {
        if (Objects.equals(oldValue, newValue)) {
            return;
        }
        Long actorId = CurrentUser.id().orElse(null);
        jdbc.update("INSERT INTO data_changes (created_at, actor_id, actor_name, resource, record_id, record_label,"
                        + " field, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                Timestamp.from(Instant.now()), actorId, cut(actorId == null ? "Hệ thống" : actors.current(), 150),
                resource, recordId, cut(recordLabel, 255), field, cut(oldValue, MAX), cut(newValue, MAX));
    }

    private static String cut(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    @Transactional(readOnly = true)
    public List<DataChangeResponse> ofRecord(String resource, Long recordId) {
        Specification<DataChange> spec = (root, q, cb) -> cb.and(
                cb.equal(root.get("resource"), resource), cb.equal(root.get("recordId"), recordId));
        return repository.findAll(spec, PageRequest.of(0, LIMIT,
                        Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))))
                .getContent().stream().map(DataChangeResponse::from).toList();
    }
}
