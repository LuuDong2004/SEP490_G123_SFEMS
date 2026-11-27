package com.g123.sfems.module.school.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.inventory.InventoryLine;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.voucher.VoucherEvent;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/** Sheet returnSession — KK-06 3a Trả lại biên bản kiểm kê: {@link InventorySessionService#returnToDraft}. */
@TestMethodOrder(MethodOrderer.MethodName.class)
class InventorySessionReturnTest {

    static final String NOT_MY_TIER = "Phiếu đang chờ lãnh đạo trường duyệt — tài khoản của bạn không thuộc cấp này";

    InventoryFixture f;
    InventorySession session;
    InventoryLine line;

    @BeforeEach
    void setUp() {
        f = new InventoryFixture();
        f.leaderOfSchool(InventoryFixture.SCHOOL);
        line = InventoryFixture.counted(InventoryFixture.line(53332L, 1, f.projectorItem(24776L, "79.D2.14.TB.0001.19")), false, null,
                null);
        session = f.session(VoucherStatus.PENDING, line);
        session.setCode("KK-79000786-26-0001");
    }

    private void assertRefused(ThrowingCallable call, String message) {
        assertThatThrownBy(call).isInstanceOf(FieldValidationException.class).hasMessage(message);
        verifyNoInteractions(f.events, f.publisher, f.lifecycle);
        verify(f.sessions, never()).persist(any());
    }

    @Test
    @DisplayName("UTCID01 - N: trả lại có lý do → Nháp, giữ số, kết quả kiểm đếm giữ nguyên, báo người trình")
    void utcid01() {
        InventorySession result = f.sessionService.returnToDraft(84L, "  Kiểm đếm lại Phòng Tin học 2  ");
        assertThat(result.getStatus()).isEqualTo(VoucherStatus.DRAFT);
        assertThat(result.getReturnNote()).isEqualTo("Kiểm đếm lại Phòng Tin học 2");
        assertThat(result.getCode()).isEqualTo("KK-79000786-26-0001");
        assertThat(line.getFound()).isFalse();
        assertThat(f.recordedEvents()).extracting(VoucherEvent::getAction).containsExactly(VoucherEvent.Action.RETURN);
        assertThat(f.publishedEvents()).singleElement().asString().startsWith("VoucherDecided")
                .contains("decision=RETURNED", "recipientId=289");
        verifyNoInteractions(f.lifecycle);
    }

    @Test
    @DisplayName("UTCID02 - A: trả lại không ghi lý do → GBR-04")
    void utcid02() {
        assertRefused(() -> f.sessionService.returnToDraft(84L, null), "Ghi rõ cần sửa gì trước khi trả lại");
    }

    @Test
    @DisplayName("UTCID03 - B: lý do trả lại chỉ khoảng trắng → GBR-04")
    void utcid03() {
        assertRefused(() -> f.sessionService.returnToDraft(84L, "   "), "Ghi rõ cần sửa gì trước khi trả lại");
    }

    @Test
    @DisplayName("UTCID04 - A: hiệu trưởng THPT An Lạc Lê Bảo Nam trả lại biên bản của THPT An Nghĩa → MSG10")
    void utcid04() {
        f.leaderOfSchool(InventoryFixture.OTHER_SCHOOL);
        assertRefused(() -> f.sessionService.returnToDraft(84L, "  Kiểm đếm lại Phòng Tin học 2  "), NOT_MY_TIER);
    }
}
