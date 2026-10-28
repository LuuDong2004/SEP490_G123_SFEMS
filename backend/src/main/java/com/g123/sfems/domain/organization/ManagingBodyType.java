package com.g123.sfems.domain.organization;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Loại cơ quan quản lý của một trường.
 *
 * <p>Không phải mọi trường đều do Sở quản lý. Cây quản lý thật ở TP.HCM là:
 *
 * <pre>
 * Sở GD&amp;ĐT ──trực tiếp──► THPT
 *     └────qua UBND─────► UBND phường/xã ──► Tiểu học · THCS
 * </pre>
 *
 * <p>Sở vẫn theo dõi toàn ngành, nhưng theo dõi <em>thông qua</em> UBND. Sự
 * khác nhau đó không nằm ở mã quyền — cả hai đều gọi {@code schools:read} —
 * mà ở <b>phạm vi dòng</b>: Sở đọc mọi trường, UBND đọc trường trên địa bàn
 * mình. Enum này là thứ để chính sách phân biệt hai bên.
 *
 * <h2>Vì sao một bảng có cột loại, không phải hai bảng</h2>
 *
 * <p>Một trường trỏ tới <b>đúng một</b> cơ quan quản lý, nên câu hỏi "trường
 * này thuộc ai" phải trả lời được bằng một khoá ngoại. Hai bảng nghĩa là hai
 * cột khoá ngoại trên {@code schools} cộng một ràng buộc "đúng một trong hai
 * khác rỗng" — cùng một sự thật, gấp đôi chỗ để sai. Thêm một loại cơ quan thứ
 * tư về sau chỉ là thêm một hằng số ở đây và một giá trị vào {@code CHECK},
 * không phải thêm một bảng và một nhánh phân quyền.
 */
public enum ManagingBodyType {

    /** Sở Giáo dục và Đào tạo. Quản lý trực tiếp các trường THPT. */
    SO("so"),

    /**
     * UBND phường/xã. Quản lý các trường Tiểu học và THCS trên địa bàn.
     *
     * <p>Đây là loại mà mô hình cũ không có, và thiếu nó thì không viết được
     * chính sách "UBND chỉ thấy trường trên địa bàn mình".
     */
    UBND("ubnd"),

    /**
     * Cơ quan quản lý khác — tổ chức chủ quản trường ngoài công lập, hoặc một
     * cấp quản lý chưa lường trước.
     *
     * <p>Có sẵn để một trường hợp ngoài dự kiến không phải chờ một migration
     * mới. Dùng nó là tín hiệu cần bàn xem có nên thành một loại riêng không.
     */
    KHAC("khac");

    private final String value;

    ManagingBodyType(String value) {
        this.value = value;
    }

    /** Chữ thường trên đường truyền, cùng quy ước với {@link OrgStatus}. */
    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static ManagingBodyType from(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        for (ManagingBodyType type : values()) {
            if (type.value.equalsIgnoreCase(raw) || type.name().equalsIgnoreCase(raw)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Loại cơ quan quản lý không hợp lệ: " + raw);
    }
}
