package com.g123.sfems.module.system.dataimport;

import java.util.List;
import java.util.Map;

/**
 * Một loại dữ liệu nhập được hàng loạt: các cột của tệp mẫu, cách đọc một dòng
 * thành một yêu cầu tạo, và cách tạo.
 *
 * <p>Tạo đi qua đúng service của feature — cùng kiểm tra mã trùng, cùng phạm vi
 * dòng — nên nhập hàng loạt không phải một cửa sau vào cơ sở dữ liệu: một cán bộ
 * không nhập được tài sản vào trường khác, y như không tạo tay được.
 *
 * @param <R> yêu cầu tạo của feature
 */
public interface ImportTarget<R> {

    /** Một cột của tệp mẫu. {@code hint} hiện ở hàng ghi chú dưới tiêu đề. */
    record Column(String key, String label, boolean required, String hint) {
    }

    /** Một dòng đã đọc: yêu cầu tạo, hoặc các lỗi của nó. */
    record Parsed<R>(R request, List<String> errors, String code) {
    }

    /**
     * Một giá trị phải duy nhất trong tệp ngoài mã (vd. số serial). {@code key} là dạng đã chuẩn hoá để so,
     * {@code label} + {@code value} để nói với người dùng.
     */
    record Unique(String label, String key, String value) {
    }

    String name();

    /** Mã quyền tạo của chính loại dữ liệu này — nhập hàng loạt không cho nhiều hơn tạo tay. */
    String permission();

    String title();

    List<Column> columns();

    /**
     * Đọc một dòng (khoá là {@link Column#key()}) cho trường {@code schoolId}.
     * Không ghi gì — xem trước và nhập thật dùng chung hàm này.
     */
    Parsed<R> parse(Map<String, String> row, Long schoolId);

    /** Mã đã có trong trường — để báo trùng ngay ở bước xem trước. */
    boolean exists(Long schoolId, String code);

    /** Tên của mã ({@link Parsed#code()}) trong câu báo trùng — vd. "Mã cũ" khi mã là mã của sổ cũ. */
    default String codeLabel() {
        return "Mã";
    }

    /** Giá trị phải duy nhất trong tệp của một dòng đọc được — mặc định không có. */
    default List<Unique> uniques(R request) {
        return List.of();
    }

    void create(R request);
}
