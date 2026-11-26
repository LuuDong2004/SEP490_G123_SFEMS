package com.g123.sfems.shared.data;

/**
 * "Người đang gọi có đọc / sửa được bản ghi này không", do chính feature sở hữu
 * bản ghi trả lời.
 *
 * <p>Tệp đính kèm và nhật ký duyệt gắn vào bản ghi của NHIỀU feature bằng cặp
 * {@code (resource, id)}. Chúng không được tự quyết ai đọc được — đó là việc của
 * phạm vi dữ liệu của bản ghi gốc — nên chúng hỏi feature đó qua interface này.
 * Mỗi feature muốn nhận tệp đính kèm khai một bean; không có bean nào cho một
 * resource thì không ai đính kèm được vào nó.
 */
public interface RecordAccess {

    /** Tên tài nguyên, đúng như mã quyền và đường dẫn API. */
    String resource();

    /**
     * Tài nguyên mà MÃ QUYỀN được xét theo — thường là chính nó. Khác đi khi bản ghi là phần của
     * một bản ghi khác (dòng của phiếu nhập): quyền là của phiếu, không có mã quyền riêng cho dòng.
     */
    default String permission() {
        return resource();
    }

    /**
     * Đuôi tệp nhận được, chặt hơn danh sách chung của tệp đính kèm — {@code null} = theo danh sách chung. Cán bộ
     * chỉ có ảnh đại diện nên chỉ nhận ảnh.
     */
    default java.util.Set<String> allowedExtensions() {
        return null;
    }

    /** Trần dung lượng một tệp (byte), nhỏ hơn trần chung — 0 = theo trần chung. */
    default long maxBytes() {
        return 0;
    }

    /** Ném {@code ResourceNotFoundException} nếu bản ghi không nằm trong phạm vi ĐỌC. */
    void checkReadable(Long id);

    /** Ném {@code ResourceNotFoundException} nếu bản ghi không nằm trong phạm vi GHI. */
    void checkWritable(Long id);

    /**
     * Thêm / xoá được tệp đính kèm của bản ghi không — mặc định như ghi. Phiếu đã trình duyệt thì không: tệp là căn cứ
     * người duyệt đang xét, muốn đổi thì người duyệt trả lại phiếu.
     */
    default void checkAttachmentsEditable(Long id) {
        checkWritable(id);
    }
}
