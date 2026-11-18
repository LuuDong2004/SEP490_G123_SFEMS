package com.g123.sfems.domain.school.voucher;

import com.g123.sfems.domain.catalog.subject.Subject;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

/**
 * Mượn để làm gì — chung cho phiếu mượn phòng và phiếu mượn thiết bị, cùng bốn cột ở cả hai bảng.
 * Mục đích và môn học là thứ báo cáo ĐẾM (theo môn, tỷ lệ tiết thực hành), nên là lựa chọn; nội dung bài dạy là
 * chữ tự do để người đọc phiếu hiểu, không đếm.
 */
@Embeddable
public class VoucherUsage {

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose_type", length = 30)
    private UsagePurpose purposeType;

    /** Ghi rõ khi mục đích là "Khác"; các mục khác thì trống. */
    @Column(name = "purpose_note", length = 255)
    private String purposeNote;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "subject_id")
    private Subject subject;

    @Column(name = "lesson_content", length = 1000)
    private String lessonContent;

    public UsagePurpose getPurposeType() {
        return purposeType;
    }

    public void setPurposeType(UsagePurpose purposeType) {
        this.purposeType = purposeType;
    }

    public String getPurposeNote() {
        return purposeNote;
    }

    public void setPurposeNote(String purposeNote) {
        this.purposeNote = purposeNote;
    }

    public Subject getSubject() {
        return subject;
    }

    public void setSubject(Subject subject) {
        this.subject = subject;
    }

    public String getLessonContent() {
        return lessonContent;
    }

    public void setLessonContent(String lessonContent) {
        this.lessonContent = lessonContent;
    }
}
