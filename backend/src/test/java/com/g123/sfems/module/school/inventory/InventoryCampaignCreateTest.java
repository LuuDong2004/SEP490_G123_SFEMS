package com.g123.sfems.module.school.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/** Sheet createCampaign — KK-01 Phát động đợt kiểm kê: {@link InventoryCampaignService#create}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class InventoryCampaignCreateTest {

    static final String MISSING = "Nhập tên đợt, ngày chốt số liệu và hạn nộp";
    static final String NOT_SO = "Chỉ tài khoản thuộc Sở mới phát động được đợt kiểm kê";

    InventoryFixture f;
    Long managingBodyId;
    String title;
    LocalDate cutoffDate;
    LocalDate deadline;
    String note;

    @BeforeEach
    void setUp() {
        f = new InventoryFixture();
        f.soSpecialist();
        managingBodyId = null;
        title = "Kiểm kê cuối năm 2026";
        cutoffDate = LocalDate.of(2026, 12, 31);
        deadline = LocalDate.of(2027, 1, 15);
        note = "Kiểm kê toàn bộ thiết bị, CSVC";
    }

    private InventoryCampaign create() {
        return f.campaignService.create(
                new InventoryCampaignService.Input(managingBodyId, title, cutoffDate, deadline, note, null));
    }

    /** Đã có {@code count} đợt ĐANG MỞ của Sở 10 cùng ngày chốt (câu đếm trong requireNoOpenTwin). */
    private void openTwins(int count) {
        when(f.jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenReturn(count);
    }

    private InventoryCampaign assertLaunched() {
        InventoryCampaign saved = create();
        assertThat(saved.getManagingBody()).isSameAs(f.so10);
        assertThat(saved.isClosed()).isFalse();
        verify(f.campaignRepository).save(saved);
        assertThat(f.publishedEvents()).singleElement()
                .isInstanceOfSatisfying(CampaignLaunchNotifier.CampaignLaunched.class, e -> {
                    assertThat(e.managingBodyId()).isEqualTo(10L);
                    assertThat(e.cityWide()).isTrue();
                    assertThat(e.title()).isEqualTo(saved.getTitle());
                });
        return saved;
    }

    private void assertRefused(String message) {
        assertThatThrownBy(this::create).isInstanceOf(FieldValidationException.class).hasMessage(message);
        verify(f.campaignRepository, never()).save(any());
        assertThat(f.publishedEvents()).isEmpty();
    }

    @Test
    @DisplayName("UTCID01 - N: chuyên viên Sở phát động đợt hợp lệ → đợt Đang mở, báo các trường")
    void utcid01() {
        InventoryCampaign saved = assertLaunched();
        assertThat(saved.getTitle()).isEqualTo("Kiểm kê cuối năm 2026");
        assertThat(saved.getCutoffDate()).isEqualTo(cutoffDate);
        assertThat(saved.getDeadline()).isEqualTo(deadline);
        assertThat(saved.getNote()).isEqualTo("Kiểm kê toàn bộ thiết bị, CSVC");
    }

    @Test
    @DisplayName("UTCID02 - N: tên đợt có khoảng trắng hai đầu → lưu tên đã trim")
    void utcid02() {
        title = "  Kiểm kê cuối năm 2026  ";
        assertThat(assertLaunched().getTitle()).isEqualTo("Kiểm kê cuối năm 2026");
    }

    @Test
    @DisplayName("UTCID03 - B: hướng dẫn chỉ khoảng trắng → note = null")
    void utcid03() {
        note = "   ";
        assertThat(assertLaunched().getNote()).isNull();
    }

    @Test
    @DisplayName("UTCID04 - B: hạn nộp bằng ngày chốt → lưu được")
    void utcid04() {
        deadline = cutoffDate;
        assertThat(assertLaunched().getDeadline()).isEqualTo(cutoffDate);
    }

    @Test
    @DisplayName("UTCID05 - B: hạn nộp trước ngày chốt 1 ngày → MSG39")
    void utcid05() {
        deadline = cutoffDate.minusDays(1);
        assertRefused("Hạn nộp phải sau ngày chốt số liệu");
    }

    @Test
    @DisplayName("UTCID06 - A: thiếu tên đợt → MSG38")
    void utcid06() {
        title = null;
        assertRefused(MISSING);
    }

    @Test
    @DisplayName("UTCID07 - B: tên đợt chỉ khoảng trắng → MSG38")
    void utcid07() {
        title = "   ";
        assertRefused(MISSING);
    }

    @Test
    @DisplayName("UTCID08 - A: thiếu ngày chốt số liệu → MSG38")
    void utcid08() {
        cutoffDate = null;
        assertRefused(MISSING);
    }

    @Test
    @DisplayName("UTCID09 - A: thiếu hạn nộp → MSG38")
    void utcid09() {
        deadline = null;
        assertRefused(MISSING);
    }

    @Test
    @DisplayName("UTCID10 - A: Sở đã có đợt đang mở cùng ngày chốt 31/12/2026 → MSG40")
    void utcid10() {
        openTwins(1);
        assertRefused("Cơ quan đã có một đợt kiểm kê đang mở chốt số liệu ngày 31/12/2026 — mở đợt đó thay vì lập đợt mới");
    }

    @Test
    @DisplayName("UTCID11 - N: đợt cùng ngày chốt đã đóng (không tính) → lưu được")
    void utcid11() {
        openTwins(0);
        assertLaunched();
    }

    @Test
    @DisplayName("UTCID12 - N: quản trị viên chọn Sở 10 → đợt của Sở 10")
    void utcid12() {
        f.admin();
        managingBodyId = 10L;
        assertLaunched();
    }

    @Test
    @DisplayName("UTCID13 - A: quản trị viên không chọn Sở → MSG41")
    void utcid13() {
        f.admin();
        assertRefused(NOT_SO);
    }

    @Test
    @DisplayName("UTCID14 - A: cán bộ trường (không thuộc Sở) → MSG41")
    void utcid14() {
        f.officerOfSchool1();
        managingBodyId = 10L;
        assertRefused(NOT_SO);
    }
}
