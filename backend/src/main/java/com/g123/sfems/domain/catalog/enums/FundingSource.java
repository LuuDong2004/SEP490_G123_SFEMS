package com.g123.sfems.domain.catalog.enums;

/**
 * Nguồn kinh phí — NĂM nguồn chuẩn do nghiệp vụ chốt (Ngân sách · Học phí · Nguồn thu sự nghiệp · Quỹ
 * phát triển sự nghiệp · Tài trợ), "Nguồn khác" cho khoản chi không thuộc năm nguồn đó (dữ liệu
 * các trường có ghi "Nguồn khác"), cộng "Chưa xác định nguồn" cho tài sản vào sổ mà không có khoản
 * chi nào đứng sau (kiểm kê thừa, tự làm không tốn vật tư).
 *
 * <p>"Chưa xác định nguồn" KHÔNG phải một lựa chọn trên màn hình ({@link #selectable()}): hệ thống tự
 * ghi khi nguồn kinh phí không bắt buộc mà người lập để trống, vì hồ sơ tài sản đòi phải có nguồn
 * kinh phí thì mới vào được phiếu sau này.
 *
 * <p>Nguồn nào chọn được cho một lần ghi tăng là do NGUỒN HÌNH THÀNH của phiếu quyết định — xem
 * {@link com.g123.sfems.domain.catalog.originsource.OriginRule}. Tên hằng là giá trị lưu trong
 * database: đổi tên phải kèm changelog đổi dữ liệu (lần gần nhất: {@code 109}). Mã ({@link #code()}) chỉ để hiển
 * ở danh mục — mã chuẩn NKP001… cùng kiểu mã của các danh mục dùng chung, không lưu ở đâu.
 */
public enum FundingSource implements LabeledEnum {
    STATE_BUDGET("NKP001", "Ngân sách"),
    TUITION("NKP002", "Học phí"),
    REVENUE("NKP003", "Nguồn thu sự nghiệp"),
    DEVELOPMENT_FUND("NKP004", "Quỹ phát triển sự nghiệp"),
    SPONSORSHIP("NKP005", "Tài trợ"),
    /** Nguồn có thật nhưng ngoài năm nguồn trên. Khác "Chưa xác định": người khai biết là nguồn khác. */
    OTHER("NKP006", "Nguồn khác"),
    UNDETERMINED("NKP007", "Chưa xác định nguồn");

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
