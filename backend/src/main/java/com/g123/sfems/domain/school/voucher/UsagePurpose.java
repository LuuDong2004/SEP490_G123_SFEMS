package com.g123.sfems.domain.school.voucher;

/**
 * Mục đích mượn — của phiếu mượn phòng và phiếu mượn thiết bị (QLTB-531).
 *
 * <p>Là danh sách CỐ ĐỊNH chứ không phải danh mục người dùng sửa: báo cáo thống kê theo môn và tỷ lệ tiết thực
 * hành đếm đúng các giá trị này, nên đổi tên hay xoá một mục là số liệu các năm không còn so được với nhau.
 * Thêm mục thì thêm ở đây, ở {@code USAGE_PURPOSE_LABELS} phía màn hình, và ở {@code CHECK} của changelog.
 *
 * <p>Tên hằng là giá trị lưu trong database.
 */
public enum UsagePurpose {
    THEORY("Tiết học lý thuyết"),
    PRACTICE("Tiết thực hành"),
    EXTRACURRICULAR("Hoạt động ngoại khoá, CLB"),
    PROFESSIONAL("Sinh hoạt chuyên môn"),
    TRAINING("Bồi dưỡng, tập huấn"),
    /** Phải ghi rõ là gì ({@code purpose_note}). */
    OTHER("Khác");

    private final String label;

    UsagePurpose(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /**
     * Là một TIẾT HỌC — luôn dạy đúng một môn, nên phải ghi môn: báo cáo tỷ lệ tiết thực hành theo môn chỉ đếm
     * các mục này, và một tiết để trống môn là số của môn đó bị thiếu. Ngoại khoá, tập huấn, họp… không phải tiết
     * học, thường không thuộc môn nào — bắt chọn là người dùng chọn bừa, số theo môn sai đi.
     */
    public boolean isLesson() {
        return this == THEORY || this == PRACTICE;
    }
}
