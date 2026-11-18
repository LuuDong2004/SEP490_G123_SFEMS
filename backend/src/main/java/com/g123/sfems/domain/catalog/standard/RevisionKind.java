package com.g123.sfems.domain.catalog.standard;

/**
 * Loại một lần sửa danh mục tối thiểu (bộ nháp lập từ bộ đang áp dụng). Danh mục mỗi cấp chỉ có MỘT thông tư gốc; về
 * sau Bộ chỉ sửa nó theo hai cách:
 * <ul>
 *   <li>{@link #AMENDMENT} — thông tư sửa đổi, bổ sung (TT 26/2023): thêm / sửa / bỏ dòng; dòng thêm, sửa lấy văn bản
 *   đó làm căn cứ.</li>
 *   <li>{@link #CORRECTION} — đính chính: dữ liệu sai so với văn bản đang có, hoặc Bộ ra quyết định đính chính. Bắt buộc
 *   ghi lý do; dòng sửa giữ căn cứ cũ.</li>
 * </ul>
 */
public enum RevisionKind {
    AMENDMENT,
    CORRECTION
}
