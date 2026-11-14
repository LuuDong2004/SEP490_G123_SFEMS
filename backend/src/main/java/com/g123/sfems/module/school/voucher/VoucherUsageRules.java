package com.g123.sfems.module.school.voucher;

import com.g123.sfems.domain.school.voucher.UsagePurpose;
import com.g123.sfems.domain.school.voucher.VoucherUsage;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.subject.SubjectService;
import com.g123.sfems.shared.exception.FieldValidationException;
import org.springframework.stereotype.Component;

/**
 * Luật của khối "mượn để làm gì" (QLTB-531), dùng chung cho phiếu mượn phòng và phiếu mượn thiết bị — một chỗ,
 * để hai phiếu không đòi khác nhau.
 *
 * <p>Lưu nháp nhận thiếu; lúc TRÌNH (ghi nhận) thì phải có mục đích, chọn "Khác" thì phải ghi rõ, và mục đích
 * là tiết học ({@link UsagePurpose#isLesson()}) thì phải có môn. Mục đích khác để trống môn được. Nội dung bài
 * dạy không bao giờ bắt buộc.
 */
@Component
public class VoucherUsageRules {

    private final SubjectService subjects;

    public VoucherUsageRules(SubjectService subjects) {
        this.subjects = subjects;
    }

    /**
     * Ghi bốn ô từ payload. Form luôn gửi đủ cả khối, nên vắng / {@code null} nghĩa là bỏ trống. Phần "ghi rõ"
     * chỉ giữ khi mục đích là "Khác" — đổi sang mục khác thì nó không còn nghĩa gì.
     */
    public void apply(VoucherUsage target, UsagePurpose purposeType, String purposeNote, IdRef subject,
            String lessonContent) {
        target.setPurposeType(purposeType);
        target.setPurposeNote(purposeType == UsagePurpose.OTHER ? trimToNull(purposeNote) : null);
        target.setSubject(subject == null || subject.id() == null ? null : subjects.get(subject.id()));
        target.setLessonContent(trimToNull(lessonContent));
    }

    /** Lúc trình: đủ thứ để thống kê được. */
    public void requireComplete(VoucherUsage usage) {
        if (usage.getPurposeType() == null) {
            throw new FieldValidationException("purposeType", "Chọn mục đích mượn");
        }
        if (usage.getPurposeType() == UsagePurpose.OTHER && usage.getPurposeNote() == null) {
            throw new FieldValidationException("purposeNote", "Ghi rõ mục đích khác là gì");
        }
        if (usage.getPurposeType().isLesson() && usage.getSubject() == null) {
            throw new FieldValidationException("subject", "Tiết học phải ghi môn học");
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
