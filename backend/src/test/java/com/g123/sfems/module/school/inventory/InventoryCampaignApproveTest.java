package com.g123.sfems.module.school.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import com.g123.sfems.domain.school.inventory.InventoryCampaign.Status;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/**
 * Sheet approveCampaign — KK-01 Lãnh đạo Sở duyệt, phát động đợt kiểm kê: {@link InventoryCampaignService#approve}.
 *
 * <p>Người duyệt: lãnh đạo Sở {@link InventoryFixture#SO_LEADER}. Đợt id 20 "Kiểm kê toàn địa bàn năm học
 * 2026-2027", hiệu lực 26/11/2026, kết thúc 31/12/2026, đang Chờ duyệt.
 */
@TestMethodOrder(MethodOrderer.MethodName.class)
class InventoryCampaignApproveTest {

    static final String NOT_PENDING = "Đợt kiểm kê không ở trạng thái chờ duyệt";

    InventoryFixture f;
    InventoryCampaign campaign;

    @BeforeEach
    void setUp() {
        f = new InventoryFixture();
        f.soLeader();
        campaign = f.campaign(20L, Status.PENDING, false);
    }

    private InventoryCampaign assertLaunched(String note) {
        InventoryCampaign saved = f.campaignService.approve(20L, note);
        assertThat(saved.getStatus()).isEqualTo(Status.APPROVED);
        assertThat(saved.getApprovedAt()).isNotNull();
        verify(f.campaignRepository).save(campaign);
        assertThat(f.publishedEvents()).singleElement()
                .isInstanceOfSatisfying(CampaignLaunchNotifier.CampaignLaunched.class, e -> {
                    assertThat(e.managingBodyId()).isEqualTo(1L);
                    assertThat(e.cityWide()).isTrue();
                    assertThat(e.title()).isEqualTo("Kiểm kê toàn địa bàn năm học 2026-2027");
                    assertThat(e.cutoffDate()).isEqualTo(LocalDate.of(2026, 11, 26));
                    assertThat(e.deadline()).isEqualTo(LocalDate.of(2026, 12, 31));
                });
        return saved;
    }

    private void assertRefused(String note, String message) {
        assertThatThrownBy(() -> f.campaignService.approve(20L, note)).isInstanceOf(FieldValidationException.class)
                .hasMessage(message);
        verify(f.campaignRepository, never()).save(any());
        assertThat(f.publishedEvents()).isEmpty();
    }

    @Test
    @DisplayName("UTCID01 - N: Lưu Văn Đông duyệt, ý kiến \"Đồng ý phát động\" → Đã duyệt, phát động tới các trường")
    void utcid01() {
        assertThat(assertLaunched("Đồng ý phát động").getApprovalNote()).isEqualTo("Đồng ý phát động");
    }

    @Test
    @DisplayName("UTCID02 - N: ý kiến có khoảng trắng hai đầu → lưu ý kiến đã trim")
    void utcid02() {
        assertThat(assertLaunched("  Đồng ý phát động  ").getApprovalNote()).isEqualTo("Đồng ý phát động");
    }

    @Test
    @DisplayName("UTCID03 - B: không nhập ý kiến (null) → vẫn duyệt, ý kiến để trống")
    void utcid03() {
        assertThat(assertLaunched(null).getApprovalNote()).isNull();
    }

    @Test
    @DisplayName("UTCID04 - B: ý kiến chỉ khoảng trắng → vẫn duyệt, ý kiến để trống")
    void utcid04() {
        assertThat(assertLaunched("   ").getApprovalNote()).isNull();
    }

    @Test
    @DisplayName("UTCID05 - A: đợt còn Nháp (chưa trình) → không duyệt được")
    void utcid05() {
        campaign.setStatus(Status.DRAFT);
        assertRefused("Đồng ý phát động", NOT_PENDING);
    }

    @Test
    @DisplayName("UTCID06 - A: đợt đã duyệt rồi → không duyệt lại được")
    void utcid06() {
        campaign.setStatus(Status.APPROVED);
        assertRefused("Đồng ý phát động", NOT_PENDING);
    }

    @Test
    @DisplayName("UTCID07 - A: hiệu trưởng THPT An Lạc Lê Bảo Nam (tài khoản trường, không thuộc Sở) duyệt đợt của Sở → từ chối")
    void utcid07() {
        f.leaderOfSchool(InventoryFixture.OTHER_SCHOOL);
        assertRefused("Đồng ý phát động", "Chỉ lãnh đạo cơ quan đã lập đợt mới duyệt được đợt này");
    }

    @Test
    @DisplayName("UTCID08 - A: trong lúc chờ duyệt, Sở đã phát động đợt khác cùng ngày hiệu lực → không duyệt được")
    void utcid08() {
        f.openTwins(1);
        assertRefused("Đồng ý phát động",
                "Cơ quan đã có một đợt kiểm kê đang mở có ngày hiệu lực 26/11/2026 — mở đợt đó thay vì lập đợt mới");
    }

    @Test
    @DisplayName("UTCID09 - N: quản trị viên admin (Quản trị viên hệ thống) duyệt → Đã duyệt, phát động")
    void utcid09() {
        f.admin();
        assertLaunched("Đồng ý phát động");
    }
}
