package com.g123.sfems.module.school.inventory;

import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.data.SecuredRepository;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventorySessionRepository extends SecuredRepository<InventorySession, Long> {

    /**
     * Phiếu còn hiệu lực của MỘT trường cho MỘT đợt. Cố ý không qua phạm vi dòng: đây là phép kiểm trùng
     * trước khi lập phiếu, phải thấy cả phiếu người gọi không đọc được.
     */
    @Query("""
            select s from InventorySession s
            where s.school.id = :schoolId and s.campaign.id = :campaignId and s.status not in :dead
            order by s.id""")
    List<InventorySession> findLiveForCampaign(@Param("schoolId") Long schoolId, @Param("campaignId") Long campaignId,
            @Param("dead") Collection<VoucherStatus> dead);

    /**
     * Phiếu đang kiểm (đang khoá số liệu) của một trường. Cũng không qua phạm vi dòng: phiếu nháp người gọi không
     * đọc được vẫn đang khoá số liệu.
     */
    @Query("""
            select s from InventorySession s
            where s.school.id = :schoolId and s.status in :counting
            order by s.id""")
    List<InventorySession> findCounting(@Param("schoolId") Long schoolId,
            @Param("counting") Collection<VoucherStatus> counting);
}
