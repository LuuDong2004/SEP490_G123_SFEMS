package com.g123.sfems.domain.school.voucher;

/**
 * Một bước duyệt — nói bước này thuộc CẤP nào, không nói người nào.
 *
 * <p>Người được duyệt ở một bước là người có mã quyền {@code <loại phiếu>:approve} VÀ thuộc đúng cấp
 * đó của phiếu:
 *
 * <ul>
 *   <li>{@link #SCHOOL} — tài khoản gắn với trường của phiếu (lãnh đạo trường).</li>
 *   <li>{@link #MANAGING_BODY} — tài khoản gắn với cơ quan quản lý của trường (Sở GD&ĐT).</li>
 * </ul>
 *
 * <p>Không có bước nào gắn với một chức danh cụ thể: ai là lãnh đạo trường là việc của vai trò.
 * Thứ tự khai báo chính là thứ tự cấp — {@code VoucherWorkflow.nextStep} so {@code ordinal}.
 */
public enum ApprovalStep {
    SCHOOL,
    MANAGING_BODY;

    /** Cấp CAO hơn trong hai cấp; {@code null} là "chưa tới cấp nào". */
    public static ApprovalStep furthest(ApprovalStep a, ApprovalStep b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.ordinal() >= b.ordinal() ? a : b;
    }

    public String label() {
        return switch (this) {
            case SCHOOL -> "lãnh đạo trường";
            case MANAGING_BODY -> "cơ quan quản lý";
        };
    }
}
