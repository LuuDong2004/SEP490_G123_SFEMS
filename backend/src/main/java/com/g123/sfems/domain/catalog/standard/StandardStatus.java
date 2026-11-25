package com.g123.sfems.domain.catalog.standard;

/**
 * Vòng đời của một bộ tiêu chuẩn (một phiên bản danh mục theo một bộ văn bản).
 *
 * <p>Thay đổi thiết bị là thay đổi văn bản: bộ đang áp dụng bị khoá, muốn đổi thì lập bộ mới ở
 * trạng thái nháp rồi áp dụng — bộ cũ thành hết hiệu lực.
 */
public enum StandardStatus {
    /** Đang soạn — thêm / sửa / xoá thiết bị được, chưa tính vào đủ / thiếu. */
    DRAFT,
    /** Đang áp dụng — khoá thiết bị; mỗi cấp học đúng một bộ. */
    ACTIVE,
    /** Hết hiệu lực — đã có bộ mới thay, chỉ xem. */
    RETIRED
}
