package com.g123.sfems.module.organization.school.api.dto;

/**
 * Tham chiếu tới phường/xã khi tạo hoặc sửa trường.
 *
 * <p>Địa bàn từng là chữ tự do. Nó thành khoá ngoại vì mục 3.5.2 và 3.5.8 của
 * Chương V yêu cầu tổng hợp số liệu THEO ĐỊA BÀN, mà "Phường Sài Gòn" và
 * "P. Sài Gòn" là hai nhóm khác nhau khi gộp — báo cáo vẫn ra số, chỉ là ra
 * nhầm. Nó cũng là khoá của phân quyền: UBND quản lý trường trên địa bàn mình.
 *
 * <p>Ba trạng thái như mọi tham chiếu khác: vắng mặt để nguyên,
 * {@code {"id": null}} xoá địa bàn, {@code {"id": n}} gán.
 */
public record WardRef(Long id) {
}
