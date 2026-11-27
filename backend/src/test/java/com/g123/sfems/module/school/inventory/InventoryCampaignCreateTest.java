package com.g123.sfems.module.school.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/**
 * Sheet createCampaign — KK-01 Lập đợt kiểm kê (lưu nháp): {@link InventoryCampaignService#create}.
 *
 * <p>Người lập: chuyên viên Sở {@link InventoryFixture#SO_SPECIALIST} (Sở GD&amp;ĐT TP.HCM). Đợt lập ra là NHÁP — chưa
 * tới trường, chưa báo ai; trình rồi lãnh đạo Sở duyệt mới phát động.
 */
@TestMethodOrder(MethodOrderer.MethodName.class)
class InventoryCampaignCreateTest {

    static final String NO_TITLE = "Nhập tên đợt kiểm kê";
    static final String NOT_SO = "Chỉ Sở phát động được đợt kiểm kê";
    static final String OUT_OF_YEAR = "Ngày hiệu lực phải trong Năm học 2026-2027 (từ 05/09/2026 đến trước 05/09/2027)";

    InventoryFixture f;
    Long managingBodyId;
    Long schoolYearId;
    String title;
    String documentNo;
    LocalDate cutoffDate;
    LocalDate deadline;
    String note;

    @BeforeEach
    void setUp() {
        f = new InventoryFixture();
        f.soSpecialist();
        f.schoolYears(4L);
        managingBodyId = null;
        schoolYearId = 4L;
        title = "Kiểm kê toàn địa bàn năm học 2026-2027";
        documentNo = "4125/SGDĐT-KHTC";
        cutoffDate = LocalDate.of(2026, 11, 26);
        deadline = LocalDate.of(2026, 12, 31);
        note = "Kiêm kê, rà soát toàn bộ thiết bị trong toàn trường, để ra số liệu báo cáo kiểm kê toàn địa bàn năm 2027";
    }

    private InventoryCampaign create() {
        return f.campaignService.create(new InventoryCampaignService.Input(managingBodyId, schoolYearId, title,
                documentNo, cutoffDate, deadline, note, null));
    }

    private InventoryCampaign assertDraft() {
        InventoryCampaign saved = create();
        assertThat(saved.getStatus()).isEqualTo(InventoryCampaign.Status.DRAFT);
        assertThat(saved.getManagingBody()).isSameAs(f.so10);
        assertThat(saved.getSchoolYear()).isSameAs(f.schoolYear);
        assertThat(saved.isClosed()).isFalse();
        verify(f.campaignRepository).save(saved);
        // Nháp chưa phát động: không báo trường, không báo lãnh đạo.
        assertThat(f.publishedEvents()).isEmpty();
        verifyNoInteractions(f.notifications);
        return saved;
    }

    private void assertRefused(String message) {
        assertThatThrownBy(this::create).isInstanceOf(FieldValidationException.class).hasMessage(message);
        verify(f.campaignRepository, never()).save(any());
    }

    @Test
    @DisplayName("UTCID01 - N: Lưu Văn Đông 2 lập đợt hợp lệ → đợt Nháp của Sở GD&ĐT TP.HCM, Năm học 2026-2027")
    void utcid01() {
        InventoryCampaign saved = assertDraft();
        assertThat(saved.getTitle()).isEqualTo("Kiểm kê toàn địa bàn năm học 2026-2027");
        assertThat(saved.getDocumentNo()).isEqualTo("4125/SGDĐT-KHTC");
        assertThat(saved.getCutoffDate()).isEqualTo(LocalDate.of(2026, 11, 26));
        assertThat(saved.getDeadline()).isEqualTo(LocalDate.of(2026, 12, 31));
        assertThat(saved.getNote()).isEqualTo("Kiêm kê, rà soát toàn bộ thiết bị trong toàn trường, để ra số liệu báo cáo kiểm kê toàn địa bàn năm 2027");
    }

    @Test
    @DisplayName("UTCID02 - N: tên đợt, số công văn có khoảng trắng hai đầu → lưu bản đã trim")
    void utcid02() {
        title = "  Kiểm kê toàn địa bàn năm học 2026-2027  ";
        documentNo = "  4125/SGDĐT-KHTC ";
        InventoryCampaign saved = assertDraft();
        assertThat(saved.getTitle()).isEqualTo("Kiểm kê toàn địa bàn năm học 2026-2027");
        assertThat(saved.getDocumentNo()).isEqualTo("4125/SGDĐT-KHTC");
    }

    @Test
    @DisplayName("UTCID03 - B: số công văn, hướng dẫn chỉ khoảng trắng → để trống (null)")
    void utcid03() {
        documentNo = "   ";
        note = "   ";
        InventoryCampaign saved = assertDraft();
        assertThat(saved.getDocumentNo()).isNull();
        assertThat(saved.getNote()).isNull();
    }

    @Test
    @DisplayName("UTCID04 - B: ngày kết thúc bằng ngày hiệu lực 26/11/2026 → lưu được")
    void utcid04() {
        deadline = cutoffDate;
        assertThat(assertDraft().getDeadline()).isEqualTo(cutoffDate);
    }

    @Test
    @DisplayName("UTCID05 - B: ngày kết thúc 25/11/2026, trước ngày hiệu lực 1 ngày → báo lỗi")
    void utcid05() {
        deadline = cutoffDate.minusDays(1);
        assertRefused("Ngày kết thúc không được trước ngày hiệu lực");
    }

    @Test
    @DisplayName("UTCID06 - A: thiếu tên đợt → \"Nhập tên đợt kiểm kê\"")
    void utcid06() {
        title = null;
        assertRefused(NO_TITLE);
    }

    @Test
    @DisplayName("UTCID07 - B: tên đợt chỉ khoảng trắng → \"Nhập tên đợt kiểm kê\"")
    void utcid07() {
        title = "   ";
        assertRefused(NO_TITLE);
    }

    @Test
    @DisplayName("UTCID08 - A: thiếu ngày hiệu lực → \"Chọn ngày hiệu lực\"")
    void utcid08() {
        cutoffDate = null;
        assertRefused("Chọn ngày hiệu lực");
    }

    @Test
    @DisplayName("UTCID09 - A: thiếu ngày kết thúc → \"Chọn ngày kết thúc\"")
    void utcid09() {
        deadline = null;
        assertRefused("Chọn ngày kết thúc");
    }

    @Test
    @DisplayName("UTCID10 - A: Sở đã có đợt đang mở cùng ngày hiệu lực 26/11/2026 → không lập đợt trùng")
    void utcid10() {
        f.openTwins(1);
        assertRefused("Cơ quan đã có một đợt kiểm kê đang mở có ngày hiệu lực 26/11/2026 — mở đợt đó thay vì lập đợt mới");
    }

    @Test
    @DisplayName("UTCID11 - N: đợt cùng ngày hiệu lực đã đóng (không tính) → lưu được")
    void utcid11() {
        f.openTwins(0);
        assertDraft();
    }

    @Test
    @DisplayName("UTCID12 - N: quản trị viên admin (Quản trị viên hệ thống) chọn Sở GD&ĐT TP.HCM → đợt của Sở")
    void utcid12() {
        f.admin();
        managingBodyId = 1L;
        assertDraft();
    }

    @Test
    @DisplayName("UTCID13 - A: quản trị viên không chọn Sở → chỉ Sở phát động được")
    void utcid13() {
        f.admin();
        assertRefused(NOT_SO);
    }

    @Test
    @DisplayName("UTCID14 - A: cán bộ thiết bị Nguyễn Vũ Nghĩa (THPT An Nghĩa) → chỉ Sở phát động được")
    void utcid14() {
        f.officerOfSchool1();
        managingBodyId = 1L;
        assertRefused(NOT_SO);
    }

    @Test
    @DisplayName("UTCID15 - B: ngày hiệu lực 05/09/2026, đúng ngày đầu năm học → lưu được")
    void utcid15() {
        cutoffDate = LocalDate.of(2026, 9, 5);
        deadline = LocalDate.of(2026, 9, 30);
        assertThat(assertDraft().getCutoffDate()).isEqualTo(LocalDate.of(2026, 9, 5));
    }

    @Test
    @DisplayName("UTCID16 - B: ngày hiệu lực 04/09/2026, trước năm học 1 ngày → ngoài năm học")
    void utcid16() {
        cutoffDate = LocalDate.of(2026, 9, 4);
        deadline = LocalDate.of(2026, 9, 30);
        assertRefused(OUT_OF_YEAR);
    }

    @Test
    @DisplayName("UTCID17 - B: ngày hiệu lực 05/09/2027, ngày đầu năm học sau → ngoài năm học")
    void utcid17() {
        cutoffDate = LocalDate.of(2027, 9, 5);
        deadline = LocalDate.of(2027, 9, 30);
        assertRefused(OUT_OF_YEAR);
    }

    @Test
    @DisplayName("UTCID18 - N: không chọn năm học → lấy năm học bắt đầu gần nhất trước ngày hiệu lực (Năm học 2026-2027)")
    void utcid18() {
        schoolYearId = null;
        assertDraft();
    }

    @Test
    @DisplayName("UTCID19 - A: không chọn năm học, chưa khai năm học nào trước ngày hiệu lực → báo lỗi")
    void utcid19() {
        schoolYearId = null;
        f.schoolYears(null);
        assertRefused("Ngày hiệu lực không thuộc năm học nào đã khai");
    }
}
