package com.g123.sfems.domain.catalog.enums;

/**
 * Nguồn kinh phí của một lần mua / một tài sản. Khác với {@code OriginSource} (nguồn hình thành:
 * mua sắm, được cấp, tài trợ...) — đây là TIỀN lấy từ đâu.
 */
public enum FundingSource {
    STATE_BUDGET("Ngân sách nhà nước"),
    TUITION("Học phí"),
    REVENUE("Nguồn thu sự nghiệp"),
    DEVELOPMENT_FUND("Quỹ phát triển sự nghiệp"),
    SPONSORSHIP("Tài trợ"),
    OTHER("Nguồn hợp pháp khác"),
    UNDETERMINED("Chưa xác định nguồn");

    private final String label;

    FundingSource(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /** "Nguồn hợp pháp khác" phải ghi rõ là nguồn gì. */
    public boolean requiresNote() {
        return this == OTHER;
    }
}
