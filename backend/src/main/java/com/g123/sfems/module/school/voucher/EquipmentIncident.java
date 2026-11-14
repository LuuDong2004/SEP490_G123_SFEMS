package com.g123.sfems.module.school.voucher;

import java.util.List;

/**
 * Một phiếu phát hiện tài sản HỎNG hoặc MẤT — khi trả sau khi mượn, khi kiểm kê.
 *
 * <p>Phiếu phát hiện không tự sửa sổ theo chuyện nó thấy: nó phát sự kiện này, và
 * feature phụ trách chuyện đó lập một phiếu NHÁP (báo hỏng, đề nghị ghi giảm) để
 * có người duyệt. Đó là luật "phiếu không sửa thẳng trạng thái của phiếu khác"
 * — cán bộ ghi "mất" lúc trả không được thành cách lặng lẽ xoá một tài sản khỏi
 * sổ.
 *
 * <p>Là một sự kiện, không phải một lời gọi service, vì hướng phụ thuộc: mượn trả
 * và kiểm kê có trước, báo hỏng và thanh lý đến sau và dựa vào chúng, không phải
 * ngược lại. Listener chạy đồng bộ trong CÙNG giao dịch, nên phiếu nháp ra đời
 * cùng lúc với lần trả, hoặc không cái nào ra đời.
 *
 * @param source       tài nguyên của phiếu phát hiện, vd. {@code equipment_loans}
 * @param sourceId     id phiếu phát hiện
 * @param sourceCode   số phiếu phát hiện, để phiếu nháp ghi căn cứ
 */
public record EquipmentIncident(
        Kind kind,
        Long schoolId,
        List<Long> equipmentIds,
        String source,
        Long sourceId,
        String sourceCode,
        String note) {

    public enum Kind {
        /** Hỏng — cần một phiếu báo hỏng để chọn cách xử lý. */
        DAMAGED,
        /** Hỏng nặng, kết luận không sửa được — cần một đề nghị thanh lý. */
        UNREPAIRABLE,
        /** Mất — cần một đề nghị ghi giảm. */
        MISSING
    }
}
