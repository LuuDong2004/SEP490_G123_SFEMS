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
        ReflectionTestUtils.setField(campaign, "id", 20L);
        campaign.setTitle("Kiểm kê toàn địa bàn năm học 2026-2027");
        campaign.setManagingBody(f.so10);
        when(f.campaigns.get(20L)).thenReturn(campaign);
        tb001 = f.projectorItem(24776L, "79.D2.14.TB.0001.19");
        tb002 = f.projectorItem(24777L, "79.D2.14.TB.0002.19");
        lot = f.naclLot();
        register(null, tb001, tb002, lot);
        register(1087L, tb001, tb002);
        title = "Kiểm kê toàn địa bàn năm học 2026-2027";
        council = InventoryFixture.COUNCIL;
        campaignId = null;
        roomId = null;
    }

    private void register(Long room, Equipment... items) {
        when(f.equipment.onRegister(1503L, room)).thenReturn(List.of(items));
    }

    private InventorySession create() {
        InventorySessionApi.Request request = new InventorySessionApi.Request(null,
                campaignId == null ? null : new IdRef(campaignId), title, LocalDate.of(2026, 11, 26),
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
    @DisplayName("UTCID01 - N: lập phiếu cả trường → Nháp, 3 dòng Chưa kiểm theo sổ, lô Sodium chloride (NaCl) kiểm theo số lượng 99")
    void utcid01() {
        InventorySession saved = assertDraft(3);
        InventoryLine first = saved.getLines().get(0);
        assertThat(first.getLineNo()).isEqualTo(1);
        assertThat(first.getEquipment()).isSameAs(tb001);
        assertThat(first.getExpectedRoom()).isSameAs(f.room101);
        assertThat(first.getExpectedCondition()).isEqualTo(EquipmentCondition.TOT);
        assertThat(first.getExpectedQuantity()).isNull();
        assertThat(saved.getLines().get(2).getExpectedQuantity()).isEqualByComparingTo(new BigDecimal("99"));
        assertThat(saved.getRoom()).isNull();
        assertThat(saved.getCampaign()).isNull();
    }

    @Test
    @DisplayName("UTCID02 - N: kiểm riêng Phòng Tin học 1, tên có khoảng trắng → phạm vi Phòng Tin học 1, tên đã trim")
    void utcid02() {
        title = "  Kiểm kê Phòng Tin học 1  ";
        roomId = 1087L;
        InventorySession saved = assertDraft(2);
        assertThat(saved.getRoom()).isSameAs(f.room101);
        assertThat(saved.getTitle()).isEqualTo("Kiểm kê Phòng Tin học 1");
    }

    @Test
    @DisplayName("UTCID03 - A: tài khoản chỉ quản lý một cơ sở lập phiếu theo đợt → đợt là kiểm kê mọi cơ sở")
    void utcid03() {
        when(f.campusScope.pinnedCampusIn(1503L)).thenReturn(52L);
        campaignId = 20L;
        assertRefused("Kiểm kê theo đợt của cấp trên là kiểm kê toàn bộ các cơ sở của trường, mỗi trường một biên bản. "
                + "Tài khoản của bạn chỉ quản lý một cơ sở nên không lập được phiếu này: nhờ tài khoản "
                + "quản lý cả trường lập phiếu cho đợt. Muốn kiểm kê riêng cơ sở mình thì lập phiếu không gắn đợt.");
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
    @DisplayName("UTCID07 - A: chọn Phòng bộ môn Vật lý của THPT An Lạc → MSG44")
    void utcid07() {
        roomId = 1019L;
        assertRefused("Phòng không thuộc trường của phiếu");
    }

    @Test
    @DisplayName("UTCID08 - N: lập theo đợt \"Kiểm kê toàn địa bàn năm học 2026-2027\" đang mở → phiếu gắn đợt, phạm vi cả trường")
    void utcid08() {
        campaignId = 20L;
        InventorySession saved = assertDraft(3);
        assertThat(saved.getCampaign()).isSameAs(campaign);
        assertThat(saved.getRoom()).isNull();
    }

    @Test
    @DisplayName("UTCID09 - A: đợt \"Kiểm kê toàn địa bàn năm học 2026-2027\" đã đóng → không lập phiếu cho đợt được nữa")
    void utcid09() {
        campaign.setClosed(true);
        campaignId = 20L;
        assertRefused("Đợt \"Kiểm kê toàn địa bàn năm học 2026-2027\" đã đóng, không lập phiếu cho đợt này được nữa");
    }

    @Test
    @DisplayName("UTCID10 - A: lập theo đợt nhưng chọn một phòng → đợt là kiểm kê toàn bộ")
    void utcid10() {
        campaignId = 20L;
        roomId = 1087L;
        assertRefused("Kiểm kê theo đợt của cấp trên là kiểm kê toàn bộ: để trống phạm vi (cả trường). "
                + "Muốn kiểm kê riêng một phòng thì lập phiếu không gắn đợt.");
    }

    @Test
    @DisplayName("UTCID11 - A: trường đã có KK-79000786-26-0001 cho đợt → mỗi trường một biên bản")
    void utcid11() {
        campaignId = 20L;
        InventorySession existing = new InventorySession();
        existing.setCode("KK-79000786-26-0001");
        when(f.sessions.findLiveForCampaign(eq(1503L), eq(20L), any())).thenReturn(List.of(existing));
        assertRefused("Trường đã có phiếu kiểm kê cho đợt \"Kiểm kê toàn địa bàn năm học 2026-2027\" (KK-79000786-26-0001). Mỗi trường nộp "
                + "một biên bản cho một đợt — mở phiếu đó để làm tiếp.");
    }

    @Test
    @DisplayName("UTCID12 - A: đang có phiếu nháp kiểm Phòng Tin học 1 → trùng phạm vi")
    void utcid12() {
        Map<String, Object> conflict = new HashMap<>();
        conflict.put("id", 85L);
        conflict.put("code", null);
        conflict.put("title", "Kiểm kê Phòng Tin học 1");
        conflict.put("room_name", "Phòng Tin học 1");
        conflict.put("campus_name", null);
        when(f.jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(conflict));
        assertRefused("Không thể lập phiếu kiểm kê trùng phạm vi: phiếu nháp \"Kiểm kê Phòng Tin học 1\" (mã số 85) đang kiểm kê "
                + "phòng Phòng Tin học 1. Hãy xử lý xong phiếu đó trước khi lập phiếu mới.");
    }

    @Test
    @DisplayName("UTCID13 - A: chuyên viên Sở Lưu Văn Đông 2 không chọn trường → \"Chọn trường\"")
    void utcid13() {
        f.soSpecialist();
        assertRefused("Chọn trường");
    }
}
