package com.g123.sfems.domain.organization;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

/**
 * Cơ quan quản lý của một trường được xác định BẰNG CÁCH NÀO.
 *
 * <p>Tồn tại vì phần lớn dữ liệu 946 trường không nói trường nào thuộc UBND
 * nào, nên một số trường được gán bằng suy luận. Một lần gán suy luận mà không
 * để lại dấu vết thì sau đó không ai phân biệt được đâu là sự thật và đâu là
 * phỏng đoán — cả hai trông y hệt nhau trong bảng, và cái sai sẽ sống mãi.
 *
 * <p>Cột này là thứ làm cho việc đối soát có mục tiêu: Sở chỉ cần xem lại
 * những dòng {@link #QUAN_CU} và {@link #PHUONG_CHIA}, thay vì rà cả 946
 * trường. Xem {@code docs/doi-soat/}.
 *
 * <p>Thứ tự khai báo là thứ tự tin cậy GIẢM DẦN.
 */
public enum DepartmentSource {

    /**
     * Theo phân cấp quản lý nhà nước: THPT thuộc Sở GD&ĐT. Không suy đoán gì —
     * đây là quy định, không phải dữ liệu.
     */
    PHAN_CAP,

    /** Địa bàn có sẵn trong dữ liệu nguồn. */
    NGUON,

    /**
     * Suy từ phường cũ trong địa chỉ, qua Nghị quyết 1685/NQ-UBTVQH15 (2025).
     * Phường cũ ánh xạ 1-1 sang phường mới nên chặng này không mất thông tin.
     */
    NQ_1685,

    /**
     * Như trên nhưng qua NHIỀU chặng sắp xếp đơn vị hành chính.
     *
     * <p>Địa bàn TP.HCM được sắp xếp ba lần trong bốn năm: Nghị quyết 1111
     * (01/01/2021), 1278 (01/01/2025) và 1685 (01/07/2025). Một địa chỉ chép
     * từ hồ sơ cũ có thể ứng với bất kỳ mốc nào, nên phải lần lượt đi qua các
     * chặng cho tới khi khớp danh mục hiện hành. Mỗi chặng thêm một chỗ có thể
     * sai, nên nhóm này kém chắc hơn {@link #NQ_1685} dù cùng một lối suy.
     */
    NHIEU_CHANG,

    /**
     * Phường cũ bị CHIA cho nhiều phường mới, và nghị quyết không nói trường
     * nằm ở phần nào. Đã chọn một phường trong số đó — cần Sở xác nhận.
     */
    PHUONG_CHIA,

    /**
     * Địa chỉ không nêu phường. Chỉ biết quận/huyện cũ, nên gán về phường đại
     * diện của quận ấy. Đây là nhóm KÉM TIN CẬY NHẤT và là nhóm cần xem trước
     * khi Sở trả phiếu đối soát.
     */
    QUAN_CU;

    @JsonValue
    public String json() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static DepartmentSource from(String value) {
        return value == null ? null : valueOf(value.trim().toUpperCase(Locale.ROOT));
    }
}
