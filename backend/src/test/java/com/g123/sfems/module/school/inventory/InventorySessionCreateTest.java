package com.g123.sfems.module.school.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import com.g123.sfems.domain.school.inventory.InventoryLine;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.test.util.ReflectionTestUtils;

/** Sheet createSession — KK-03 Lập phiếu kiểm kê (chụp sổ thiết bị): {@link InventorySessionService#create}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class InventorySessionCreateTest {

    InventoryFixture f;
    InventoryCampaign campaign;
    Equipment tb001;
    Equipment tb002;
    Equipment lot;

    String title;
    String council;
    Long campaignId;
    Long roomId;

    @BeforeEach
    void setUp() {
        f = new InventoryFixture();
        f.officerOfSchool1();
        campaign = new InventoryCampaign();
        ReflectionTestUtils.setField(campaign, "id", 5L);
        campaign.setTitle("Kiểm kê cuối năm 2026");
        campaign.setManagingBody(f.so10);
        when(f.campaigns.get(5L)).thenReturn(campaign);
        tb001 = f.projectorItem(11L, "TB-001");
        tb002 = f.projectorItem(12L, "TB-002");
        lot = f.naclLot();
        register(null, tb001, tb002, lot);
        register(101L, tb001, tb002);
        title = "Kiểm kê cuối năm 2026";
        council = "Nguyễn Văn A, Trần Thị B";
        campaignId = null;
        roomId = null;
    }

    private void register(Long room, Equipment... items) {
        when(f.equipment.onRegister(1L, room)).thenReturn(List.of(items));
    }

    private InventorySession create() {
        InventorySessionApi.Request request = new InventorySessionApi.Request(null,
                campaignId == null ? null : new IdRef(campaignId), title, LocalDate.of(2026, 11, 25),
                roomId == null ? null : new IdRef(roomId), council, null, null);
        return f.sessionService.create(request, null);
    }

    private InventorySession assertDraft(int lines) {
        InventorySession saved = create();
        assertThat(saved.getStatus()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(saved.getCode()).isNull();
        assertThat(saved.getSchool()).isSameAs(f.school1);
        assertThat(saved.getLines()).hasSize(lines).allSatisfy(l -> assertThat(l.getFound()).isNull());
        verify(f.sessions).persist(saved);
        return saved;
    }

    private void assertRefused(String message) {
        assertThatThrownBy(this::create).isInstanceOf(FieldValidationException.class).hasMessage(message);
        verify(f.sessions, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: lập phiếu cả trường → Nháp, 3 dòng Chưa kiểm theo sổ, lô NaCl kiểm theo số lượng 500")
    void utcid01() {
        InventorySession saved = assertDraft(3);
        InventoryLine first = saved.getLines().get(0);
        assertThat(first.getLineNo()).isEqualTo(1);
        assertThat(first.getEquipment()).isSameAs(tb001);
        assertThat(first.getExpectedRoom()).isSameAs(f.room101);
        assertThat(first.getExpectedCondition()).isEqualTo(EquipmentCondition.TOT);
        assertThat(first.getExpectedQuantity()).isNull();
        assertThat(saved.getLines().get(2).getExpectedQuantity()).isEqualByComparingTo(new BigDecimal("500"));
        assertThat(saved.getRoom()).isNull();
        assertThat(saved.getCampaign()).isNull();
    }

    @Test
    @DisplayName("UTCID02 - N: kiểm riêng phòng 101, tên có khoảng trắng → phạm vi phòng 101, tên đã trim")
    void utcid02() {
        title = "  Kiểm kê phòng Tin  ";
        roomId = 101L;
        InventorySession saved = assertDraft(2);
        assertThat(saved.getRoom()).isSameAs(f.room101);
        assertThat(saved.getTitle()).isEqualTo("Kiểm kê phòng Tin");
    }

    @Test
    @DisplayName("UTCID03 - B: sổ có TB-003 đang chờ ghi giảm (MISSING) → bỏ qua, còn 3 dòng")
    void utcid03() {
        Equipment missing = f.item(14L, "TB-003", f.projector, f.room101, EquipmentCondition.TOT, AssetStatus.MISSING);
        register(null, tb001, tb002, missing, lot);
        InventorySession saved = assertDraft(3);
        assertThat(saved.getLines()).extracting(InventoryLine::getEquipment).doesNotContain(missing);
        assertThat(saved.getLines()).extracting(InventoryLine::getLineNo).containsExactly(1, 2, 3);
    }

    @Test
    @DisplayName("UTCID04 - B: sổ thiết bị trống → Nháp, 0 dòng")
    void utcid04() {
        register(null);
        assertDraft(0);
    }

    @Test
    @DisplayName("UTCID05 - A: chưa chọn tổ kiểm kê → MSG52")
    void utcid05() {
        council = null;
        assertRefused("Chọn người trong tổ kiểm kê");
    }

    @Test
    @DisplayName("UTCID06 - B: tổ kiểm kê chỉ khoảng trắng → MSG52")
    void utcid06() {
        council = "   ";
        assertRefused("Chọn người trong tổ kiểm kê");
    }

    @Test
    @DisplayName("UTCID07 - A: phòng thuộc trường 2 → MSG44")
    void utcid07() {
        roomId = 201L;
        assertRefused("Phòng không thuộc trường của phiếu");
    }

    @Test
    @DisplayName("UTCID08 - N: lập theo đợt 5 đang mở → phiếu gắn đợt, phạm vi cả trường")
    void utcid08() {
        campaignId = 5L;
        InventorySession saved = assertDraft(3);
        assertThat(saved.getCampaign()).isSameAs(campaign);
        assertThat(saved.getRoom()).isNull();
    }

    @Test
    @DisplayName("UTCID09 - A: đợt 5 đã đóng → không lập phiếu cho đợt được nữa")
    void utcid09() {
        campaign.setClosed(true);
        campaignId = 5L;
        assertRefused("Đợt \"Kiểm kê cuối năm 2026\" đã đóng, không lập phiếu cho đợt này được nữa");
    }

    @Test
    @DisplayName("UTCID10 - A: lập theo đợt nhưng chọn một phòng → đợt là kiểm kê toàn bộ")
    void utcid10() {
        campaignId = 5L;
        roomId = 101L;
        assertRefused("Kiểm kê theo đợt của cấp trên là kiểm kê toàn bộ: để trống phạm vi (cả trường). "
                + "Muốn kiểm kê riêng một phòng thì lập phiếu không gắn đợt.");
    }

    @Test
    @DisplayName("UTCID11 - A: trường đã có KK-2026-00001 cho đợt 5 → mỗi trường một biên bản")
    void utcid11() {
        campaignId = 5L;
        InventorySession existing = new InventorySession();
        existing.setCode("KK-2026-00001");
        when(f.sessions.findLiveForCampaign(eq(1L), eq(5L), any())).thenReturn(List.of(existing));
        assertRefused("Trường đã có phiếu kiểm kê cho đợt \"Kiểm kê cuối năm 2026\" (KK-2026-00001). Mỗi trường nộp "
                + "một biên bản cho một đợt — mở phiếu đó để làm tiếp.");
    }

    @Test
    @DisplayName("UTCID12 - A: đang có phiếu nháp kiểm phòng 101 → trùng phạm vi")
    void utcid12() {
        Map<String, Object> conflict = new HashMap<>();
        conflict.put("id", 7L);
        conflict.put("code", null);
        conflict.put("title", "Kiểm kê P101");
        conflict.put("room_name", "Phòng Tin 1");
        conflict.put("campus_name", null);
        when(f.jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(conflict));
        assertRefused("Không thể lập phiếu kiểm kê trùng phạm vi: phiếu nháp \"Kiểm kê P101\" (mã số 7) đang kiểm kê "
                + "phòng Phòng Tin 1. Hãy xử lý xong phiếu đó trước khi lập phiếu mới.");
    }

    @Test
    @DisplayName("UTCID13 - A: tài khoản Sở không chọn trường → \"Chọn trường\"")
    void utcid13() {
        f.soSpecialist();
        assertRefused("Chọn trường");
    }
}
