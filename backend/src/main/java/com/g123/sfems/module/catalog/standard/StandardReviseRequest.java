package com.g123.sfems.module.catalog.standard;

import java.time.LocalDate;
import java.util.List;

import com.g123.sfems.domain.catalog.standard.RevisionKind;
import com.g123.sfems.shared.validation.DateRule;
import com.g123.sfems.shared.validation.DateValue;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import jakarta.validation.Valid;

/**
 * Thân của {@code POST /equipment_standards/{id}/revise} — lập bộ nháp từ bộ đang áp dụng. Một lần sửa phải có căn cứ:
 * {@code kind} là sửa đổi, bổ sung (bắt buộc {@code document}) hay đính chính (bắt buộc {@code reason}, văn bản đính
 * chính có thì kèm). Luật bắt buộc kiểm ở {@code EquipmentStandardService.revise} để báo đúng ô.
 */
public record StandardReviseRequest(
        /** Lập cho nhiều bộ (`POST /equipment_standards/revise`): các bộ đang áp dụng mà văn bản điều chỉnh. */
        List<Long> standardIds,
        RevisionKind kind,
        @Valid Document document,
        @Text(value = FieldRule.NOTE, label = "Lý do")
        String reason,
        @Text(value = FieldRule.SHORT_TEXT, label = "Phiên bản", max = 50)
        String standardVersion) {

    /** Văn bản của lần sửa — thành một dòng trong danh sách văn bản căn cứ của bộ nháp. */
    public record Document(
            @Text(value = FieldRule.SHORT_TEXT, label = "Số hiệu", max = 100)
            String documentNo,
            @Text(value = FieldRule.NOTE, label = "Trích yếu")
            String documentName,
            @Text(value = FieldRule.NAME, label = "Cơ quan ban hành")
            String issuingAuthority,
            @DateValue(value = DateRule.ANY, label = "Ngày ban hành")
            LocalDate issueDate,
            @DateValue(value = DateRule.ANY, label = "Ngày hiệu lực")
            LocalDate effectiveDate,
            @Text(value = FieldRule.URL, label = "Đường dẫn", max = 1000)
            String url) {
    }
}
