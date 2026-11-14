package com.g123.sfems.module.system.datachange;

import com.g123.sfems.domain.system.datachange.DataChange;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
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

    private final DataChangeRepository repository;

    public DataChangeService(DataChangeRepository repository) {
        this.repository = repository;
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
