package com.g123.sfems.module.school.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import com.g123.sfems.domain.school.inventory.InventoryCampaign.Status;
import com.g123.sfems.domain.system.notification.NotificationLevel;
import com.g123.sfems.domain.system.notification.NotificationType;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.mockito.Mockito;
import org.springframework.data.jpa.domain.Specification;

/**
 * Sheet submitCampaign — KK-01 Trình đợt kiểm kê: {@link InventoryCampaignService#submit}.
 *
 * <p>Người trình: chuyên viên Sở {@link InventoryFixture#SO_SPECIALIST}. Đợt id 20 "Kiểm kê toàn địa bàn năm học
 * 2026-2027" của Sở GD&amp;ĐT TP.HCM. Lãnh đạo Sở có quyền duyệt đợt: {@link InventoryFixture#SO_LEADER} (user id 129).
 */
@TestMethodOrder(MethodOrderer.MethodName.class)
class InventoryCampaignSubmitTest {

    static final String TITLE = "Kiểm kê toàn địa bàn năm học 2026-2027";

    InventoryFixture f;
    InventoryCampaign campaign;

    @BeforeEach
    void setUp() {
        f = new InventoryFixture();
        f.soSpecialist();
        campaign = f.campaign(20L, Status.DRAFT, false);
        leaders(129L);
    }

    /** Người có quyền duyệt đợt ở Sở GD&ĐT TP.HCM (câu SQL tìm lãnh đạo cùng cơ quan). */
    private void leaders(Long... ids) {
        when(f.jdbc.queryForList(anyString(), eq(Long.class), any(Object[].class))).thenReturn(List.of(ids));
    }

    private InventoryCampaign assertPending() {
        InventoryCampaign saved = f.campaignService.submit(20L);
        assertThat(saved.getStatus()).isEqualTo(Status.PENDING);
        assertThat(saved.getSubmittedAt()).isNotNull();
        assertThat(saved.getApprovalNote()).isNull();
        verify(f.campaignRepository).save(campaign);
        // Trình chưa phát động: các trường chưa được báo.
        assertThat(f.publishedEvents()).isEmpty();
        return saved;
    }

    private void assertRefused(String message) {
        assertThatThrownBy(() -> f.campaignService.submit(20L)).isInstanceOf(FieldValidationException.class)
                .hasMessage(message);
        verify(f.campaignRepository, never()).save(any());
        verifyNoInteractions(f.notifications);
    }

    @Test
    @DisplayName("UTCID01 - N: Lưu Văn Đông 2 trình đợt Nháp → Chờ duyệt, báo lãnh đạo Sở Lưu Văn Đông")
    void utcid01() {
        assertPending();
        verify(f.notifications).notify(eq(NotificationType.VOUCHER_PENDING), eq(129L), eq(NotificationLevel.INFO),
                eq("Đợt kiểm kê chờ duyệt: " + TITLE),
                eq("Chuyên viên đã trình đợt kiểm kê — duyệt thì đợt được phát động tới các trường."),
                eq("/inventory-campaigns/show/20"));
    }

    @Test
    @DisplayName("UTCID02 - N: đợt từng bị trả lại (lý do \"Bổ sung số công văn\") → trình lại, xoá lý do cũ")
    void utcid02() {
        campaign.setApprovalNote("Bổ sung số công văn");
        assertThat(assertPending().getApprovalNote()).isNull();
    }

    @Test
    @DisplayName("UTCID03 - B: Sở chưa có lãnh đạo nào có quyền duyệt → vẫn Chờ duyệt, không gửi thông báo")
    void utcid03() {
        leaders();
        assertPending();
        verifyNoInteractions(f.notifications);
    }

    @Test
    @DisplayName("UTCID04 - N: hai tài khoản Sở có quyền duyệt đợt (Lưu Văn Đông, Lưu Văn Đông 2 được cấp thêm quyền duyệt) → báo cả hai")
    void utcid04() {
        leaders(129L, 130L);
        assertPending();
        verify(f.notifications, times(2)).notify(eq(NotificationType.VOUCHER_PENDING), any(), any(), anyString(),
                anyString(), anyString());
    }

    @Test
    @DisplayName("UTCID05 - A: đợt đang Chờ duyệt → không trình lại được")
    void utcid05() {
        campaign.setStatus(Status.PENDING);
        assertRefused("Đợt kiểm kê đang chờ Lãnh đạo Sở duyệt — không sửa, xoá hay đổi tệp được");
    }

    @Test
    @DisplayName("UTCID06 - A: đợt đã duyệt, đã phát động → không trình được")
    void utcid06() {
        campaign.setStatus(Status.APPROVED);
        assertRefused("Đợt kiểm kê đã được duyệt, phát động tới các trường — không sửa, xoá hay đổi tệp được nữa");
    }

    @Test
    @DisplayName("UTCID07 - A: cán bộ thiết bị THPT An Lạc Phan Tuấn Đăng (tài khoản trường, không thuộc Sở) trình đợt của Sở → từ chối")
    void utcid07() {
        f.officerOfSchool2();
        assertRefused("Chỉ cơ quan đã lập đợt mới sửa được đợt kiểm kê này");
    }

    @Test
    @DisplayName("UTCID08 - A: Sở đã có đợt khác đang mở cùng ngày hiệu lực 26/11/2026 → không trình được")
    void utcid08() {
        f.openTwins(1);
        assertRefused("Cơ quan đã có một đợt kiểm kê đang mở có ngày hiệu lực 26/11/2026 — mở đợt đó thay vì lập đợt mới");
    }

    @Test
    @DisplayName("UTCID09 - N: quản trị viên admin (Quản trị viên hệ thống) trình thay → Chờ duyệt")
    void utcid09() {
        f.admin();
        assertPending();
    }

    @Test
    @DisplayName("UTCID10 - A: đợt id 99 không có / không thấy được → \"Không tìm thấy\"")
    void utcid10() {
        when(f.campaignRepository.findOne(Mockito.<Specification<InventoryCampaign>>any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> f.campaignService.submit(99L)).isInstanceOf(ResourceNotFoundException.class);
        verify(f.campaignRepository, never()).save(any());
    }
}
