package com.g123.sfems.module.catalog.standard;

import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;

/** Thân tuỳ chọn của {@code POST /equipment_standards/{id}/revise}: phiên bản của bộ nháp mới. */
public record StandardReviseRequest(
        @Text(value = FieldRule.SHORT_TEXT, label = "Phiên bản", max = 50)
        String standardVersion) {
}
