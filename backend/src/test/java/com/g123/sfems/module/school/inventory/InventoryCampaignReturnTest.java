package com.g123.sfems.module.school.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import com.g123.sfems.domain.school.inventory.InventoryCampaign.Status;
import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/**
 * Sheet returnCampaign — KK-01 Lãnh đạo Sở trả lại đợt kiểm kê: {@link InventoryCampaignService#returnToDraft}.
 *
 * <p>Người trả lại: lãnh đạo Sở {@link InventoryFixture#SO_LEADER}. Đợt id 20 do chuyên viên
 * {@link InventoryFixture#SO_SPECIALIST} (user id 130) lập, đang Chờ duyệt.
 */
@TestMethodOrder(MethodOrderer.MethodName.class)
class InventoryCampaignReturnTest {

    static final String REASON = "Bổ sung số công văn và tệp kế hoạch kiểm kê";
    static final String NO_REASON = "Ghi lý do trả lại để chuyên viên biết phải sửa gì";

    InventoryFixture f;
    InventoryCampaign campaign;

    @BeforeEach
    void setUp() {
        f = new InventoryFixture();
        f.soLeader();
        campaign = f.campaign(20L, Status.PENDING, false);
        author(130L);
    }

    /** Người lập đợt (câu SQL đọc created_by_id). */
    private void author(Long id) {
        when(f.jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(id);
    }

    private InventoryCampaign assertReturned(String note) {
        InventoryCampaign saved = f.campaignService.returnToDraft(20L, note);
        assertThat(saved.getStatus()).isEqualTo(Status.DRAFT);
        verify(f.campaignRepository).save(campaign);
        assertThat(f.publishedEvents()).isEmpty();
        return saved;
    }

    private void assertRefused(String note, String message) {
        assertThatThrownBy(() -> f.campaignService.returnToDraft(20L, note))
                .isInstanceOf(FieldValidationException.class).hasMessage(message);
        verify(f.campaignRepository, never()).save(any());
        verifyNoInteractions(f.notifications);
    }

    @Test
    @DisplayName("UTCID01 - N: Lưu Văn Đông trả lại kèm lý do → đợt về Nháp, báo Lưu Văn Đông 2")
    void utcid01() {
        assertThat(assertReturned(REASON).getApprovalNote()).isEqualTo(REASON);
        verify(f.notifications).notify(eq(NotificationType.VOUCHER_RESULT), eq(130L), eq(NotificationLevel.WARNING),
                eq("Đợt kiểm kê bị trả lại: Kiểm kê toàn địa bàn năm học 2026-2027"), eq(REASON),
                eq("/inventory-campaigns/show/20"));
    }

    @Test
    @DisplayName("UTCID02 - N: lý do có khoảng trắng hai đầu → lưu lý do đã trim")
    void utcid02() {
        assertThat(assertReturned("  " + REASON + "  ").getApprovalNote()).isEqualTo(REASON);
    }

    @Test
    @DisplayName("UTCID03 - A: không ghi lý do (null) → bắt buộc ghi lý do")
    void utcid03() {
        assertRefused(null, NO_REASON);
        assertThat(campaign.getStatus()).isEqualTo(Status.PENDING);
    }

    @Test
    @DisplayName("UTCID04 - B: lý do chỉ khoảng trắng → bắt buộc ghi lý do")
    void utcid04() {
        assertRefused("   ", NO_REASON);
        assertThat(campaign.getStatus()).isEqualTo(Status.PENDING);
    }

    @Test
    @DisplayName("UTCID05 - A: đợt còn Nháp → không trả lại được")
    void utcid05() {
        campaign.setStatus(Status.DRAFT);
        assertRefused(REASON, "Đợt kiểm kê không ở trạng thái chờ duyệt");
    }

    @Test
    @DisplayName("UTCID06 - A: đợt đã duyệt, phát động → không trả lại được")
    void utcid06() {
        campaign.setStatus(Status.APPROVED);
        assertRefused(REASON, "Đợt kiểm kê không ở trạng thái chờ duyệt");
    }

    @Test
    @DisplayName("UTCID07 - A: hiệu trưởng THPT An Lạc Lê Bảo Nam (tài khoản trường, không thuộc Sở) trả lại đợt của Sở → từ chối")
    void utcid07() {
        f.leaderOfSchool(InventoryFixture.OTHER_SCHOOL);
        assertRefused(REASON, "Chỉ lãnh đạo cơ quan đã lập đợt mới duyệt được đợt này");
    }

    @Test
    @DisplayName("UTCID08 - B: không còn tài khoản người lập (created_by_id trống) → về Nháp, không gửi thông báo")
    void utcid08() {
        author(null);
        assertThat(assertReturned(REASON).getApprovalNote()).isEqualTo(REASON);
        verifyNoInteractions(f.notifications);
    }
}
