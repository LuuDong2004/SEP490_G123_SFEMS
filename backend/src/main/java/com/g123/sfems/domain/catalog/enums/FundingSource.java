package com.g123.sfems.domain.catalog.enums;

/**
 * Nguồn kinh phí — NĂM nguồn chuẩn do nghiệp vụ chốt (Ngân sách · Học phí · Nguồn thu sự nghiệp · Quỹ
 * phát triển sự nghiệp · Tài trợ), "Nguồn khác" cho khoản chi không thuộc năm nguồn đó (QLTB-620 — dữ liệu
 * các trường có ghi "Nguồn khác"), cộng "Chưa xác định nguồn" cho tài sản vào sổ mà không có khoản
 * chi nào đứng sau (kiểm kê thừa, tự làm không tốn vật tư).
 *
 * <p>"Chưa xác định nguồn" KHÔNG phải một lựa chọn trên màn hình ({@link #selectable()}): hệ thống tự
 * ghi khi nguồn kinh phí không bắt buộc mà người lập để trống, vì hồ sơ tài sản đòi phải có nguồn
 * kinh phí thì mới vào được phiếu sau này.
 *
 * <p>Nguồn nào chọn được cho một lần ghi tăng là do NGUỒN HÌNH THÀNH của phiếu quyết định — xem
 * {@link com.g123.sfems.domain.catalog.originsource.OriginRule}. Tên hằng là giá trị lưu trong
 * database: đổi tên phải kèm changelog đổi dữ liệu (lần gần nhất: {@code 109}).
 */
public enum FundingSource implements LabeledEnum {
    STATE_BUDGET("NGAN_SACH", "Ngân sách"),
    TUITION("HOC_PHI", "Học phí"),
    REVENUE("THU_SU_NGHIEP", "Nguồn thu sự nghiệp"),
    DEVELOPMENT_FUND("QUY_PHAT_TRIEN_SU_NGHIEP", "Quỹ phát triển sự nghiệp"),
    SPONSORSHIP("TAI_TRO", "Tài trợ"),
    /** Nguồn có thật nhưng ngoài năm nguồn trên (QLTB-620). Khác "Chưa xác định": người khai biết là nguồn khác. */
    OTHER("KHAC", "Nguồn khác"),
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

    /** Người dùng chọn được nguồn này không — "Chưa xác định nguồn" chỉ do hệ thống ghi. */
    public boolean selectable() {
        return this != UNDETERMINED;
    }

    /**
     * Nguồn phải GHI RÕ là nguồn nào thì mới có nghĩa trên báo cáo: chỉ "Nguồn khác" (form ghi tăng chốt
     * 13/11/2026 — ghi rõ 5–200 ký tự). Năm nguồn chuẩn tự nói đủ.
     */
    public boolean requiresNote() {
        return this == OTHER;
    }
}
