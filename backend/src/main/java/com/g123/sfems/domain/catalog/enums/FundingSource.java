package com.g123.sfems.domain.catalog.enums;

/**
 * Nguồn kinh phí của một lần mua / một tài sản: TIỀN lấy từ đâu. Khác với nguồn hình thành (tài sản
 * về trường bằng cách nào). Nguồn nào chọn được do nguồn hình thành quyết định, xem
 * {@link com.g123.sfems.domain.catalog.originsource.OriginRule}. Tên hằng là giá trị lưu trong database.
 *
 * <p>"Chưa xác định nguồn" không phải lựa chọn trên màn hình: hệ thống tự ghi khi nguồn kinh phí không
 * bắt buộc mà người lập để trống (kiểm kê thừa, tự làm không tốn vật tư).
 */
public enum FundingSource implements LabeledEnum {
    STATE_BUDGET("NGAN_SACH", "Ngân sách"),
    TUITION("HOC_PHI", "Học phí"),
    REVENUE("THU_SU_NGHIEP", "Nguồn thu sự nghiệp"),
    DEVELOPMENT_FUND("QUY_PHAT_TRIEN_SU_NGHIEP", "Quỹ phát triển sự nghiệp"),
    SPONSORSHIP("TAI_TRO", "Tài trợ"),
    OTHER("NGUON_KHAC", "Nguồn hợp pháp khác"),
    UNDETERMINED("CHUA_XAC_DINH", "Chưa xác định nguồn");

    private final String code;
    private final String label;

    FundingSource(String code, String label) {
        this.code = code;
        this.label = label;
    }

    @Override
    public String code() {
        return code;
    }

    @Override
    public String label() {
        return label;
    }

    /** "Nguồn hợp pháp khác" phải ghi rõ là nguồn gì. */
    public boolean requiresNote() {
        return this == OTHER;
    }
}
