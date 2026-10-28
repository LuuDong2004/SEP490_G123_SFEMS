package com.g123.sfems.module.security.user.api.dto;

/**
 * Đối tượng {@code school} trên body của request tài khoản.
 *
 * <p>{@code id} CHO PHÉP {@code null}, và đó là cả lý do record này tồn tại.
 * Ở những chỗ khác, một trường {@code null} nghĩa là "để nguyên" — nhưng nơi
 * công tác thì phải XOÁ được, mà Jackson báo cáo một trường vắng mặt và một
 * trường {@code null} tường minh giống hệt nhau. Bọc thêm một lớp thì ba trạng
 * thái trở lại phân biệt được:
 *
 * <ul>
 *   <li>không có khoá {@code school} → để nguyên</li>
 *   <li>{@code "school": {"id": null}} → gỡ khỏi trường đang thuộc</li>
 *   <li>{@code "school": {"id": 3}} → gán vào trường đó</li>
 * </ul>
 *
 * <p>Gỡ một tài khoản khỏi trường KHÔNG phải thao tác vô hại: dưới
 * {@code defaultScope = NONE}, tài khoản không thuộc trường nào thì không thấy
 * gì. Đó là hành vi đúng (fail closed), nhưng người bấm nút cần biết mình đang
 * làm gì.
 */
public record SchoolRef(Long id) {
}
