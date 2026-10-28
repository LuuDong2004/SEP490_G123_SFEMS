package com.g123.sfems.shared.exception;

import java.util.Map;

/**
 * Một quy tắc nghiệp vụ gắn với MỘT trường bị vi phạm — "ngày kết thúc phải
 * sau ngày bắt đầu" — mà annotation trên record không diễn đạt được, thường vì
 * nó cần trạng thái đã lưu (một PATCH chỉ gửi một trong hai ngày).
 *
 * <p>Trả về 422 với {@code errors: {field: message}} — ĐÚNG hình dạng mà lỗi
 * {@code @Valid} trả về, nên form ở frontend hiện thông báo ngay dưới ô sai
 * thay vì một toast chung chung. {@code IllegalArgumentException} (400) không
 * làm được điều đó: nó không mang tên trường.
 */
public class FieldValidationException extends RuntimeException {

    private final String field;

    public FieldValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    public Map<String, Object> errors() {
        return Map.of(field, getMessage());
    }
}
