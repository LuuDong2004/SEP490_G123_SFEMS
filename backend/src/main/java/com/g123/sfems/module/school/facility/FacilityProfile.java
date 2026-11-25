package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.catalog.base.CatalogEntity;
import com.g123.sfems.domain.catalog.roomtype.RoomType;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Luật chung của hồ sơ CSVC (201) cho phòng và khối nhà: tham chiếu còn dùng, thông số theo loại. Cơ chế xác nhận
 * hiện trạng của 202 đã bỏ (240).
 */
final class FacilityProfile {

    private FacilityProfile() {
    }

    /**
     * Tham chiếu vừa chọn (cơ sở, khối nhà, loại, môn, cán bộ…) phải còn dùng. Chỉ kiểm khi tham chiếu ĐỔI: bản ghi đang
     * trỏ vào một mục đã ngừng dùng vẫn sửa được các ô khác.
     */
    static <E extends CatalogEntity> E usable(E ref, E current, String field, String label) {
        if (ref == null || (current != null && Objects.equals(current.getId(), ref.getId()))) {
            return ref;
        }
        if (!Boolean.TRUE.equals(ref.getActive())) {
            throw new FieldValidationException(field, label + " \"" + ref.getName() + "\" đã ngừng dùng");
        }
        return ref;
    }

    static final BigDecimal MAX_PARAM = BigDecimal.valueOf(10_000);
    static final int MAX_PARAM_TEXT = 100;

    /**
     * Thông số riêng của phòng, theo danh sách thông số của loại (và loại kết hợp): bỏ khoá loại không có, số không âm,
     * ≤ 10.000, 2 số lẻ; chữ tối đa 100 ký tự; ô trống thì bỏ.
     */
    static Map<String, String> params(Map<String, String> input, RoomType type, RoomType combined) {
        Map<String, String> out = new LinkedHashMap<>();
        if (input == null) {
            return out;
        }
        for (RoomType t : new RoomType[] {type, combined}) {
            if (t == null) {
                continue;
            }
            for (Map<String, String> spec : t.getParams() == null ? List.<Map<String, String>>of() : t.getParams()) {
                String key = spec.get("key");
                String raw = key == null ? null : input.get(key);
                if (raw == null || raw.isBlank() || out.containsKey(key)) {
                    continue;
                }
                String value = raw.trim();
                String label = Objects.requireNonNullElse(spec.get("label"), key);
                if ("number".equals(spec.get("type"))) {
                    BigDecimal n;
                    try {
                        n = new BigDecimal(value.replace(",", "."));
                    } catch (NumberFormatException e) {
                        throw new FieldValidationException("params." + key, label + " phải là số");
                    }
                    if (n.signum() < 0) {
                        throw new FieldValidationException("params." + key, label + " không được âm");
                    }
                    // Cùng luật ô Diện tích của phòng (chốt 12/11/2026): ≤ 10.000, tối đa 2 số lẻ.
                    if (n.compareTo(MAX_PARAM) > 0) {
                        throw new FieldValidationException("params." + key, label + " tối đa 10.000 — kiểm tra lại đơn vị");
                    }
                    if (n.stripTrailingZeros().scale() > 2) {
                        throw new FieldValidationException("params." + key, label + " tối đa 2 chữ số thập phân");
                    }
                    value = n.stripTrailingZeros().toPlainString();
                } else if (value.codePointCount(0, value.length()) > MAX_PARAM_TEXT) {
                    throw new FieldValidationException("params." + key, label + " tối đa " + MAX_PARAM_TEXT + " ký tự");
                }
                out.put(key, value);
            }
        }
        return out;
    }
}
