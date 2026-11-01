package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.school.voucher.VoucherEvent;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Không phải {@code SecuredRepository}: nhật ký duyệt không có phạm vi dữ liệu của riêng nó — ai đọc
 * được phiếu thì đọc được nhật ký của phiếu, và việc đó được kiểm ở phiếu trước khi tới đây.
 */
public interface VoucherEventRepository extends JpaRepository<VoucherEvent, Long> {

    List<VoucherEvent> findByResourceAndVoucherIdOrderByCreatedAtAscIdAsc(String resource, Long voucherId);

    boolean existsByResourceAndVoucherId(String resource, Long voucherId);
}
