package com.g123.sfems.domain.school.voucher;

/**
 * Một bước duyệt — nói bước này thuộc CẤP nào, không nói người nào.
 *
 * <p>Người được duyệt ở một bước là người có mã quyền {@code <loại phiếu>:approve}
 * VÀ thuộc đúng cấp đó của phiếu:
 *
 * <ul>
 *   <li>{@link #SCHOOL} — tài khoản gắn với trường của phiếu (lãnh đạo trường).</li>
 *   <li>{@link #MANAGING_BODY} — tài khoản gắn với cơ quan quản lý của trường:
 *       Sở GD&amp;ĐT.</li>
 * </ul>
 *
 * <p>Không có bước nào gắn với một chức danh cụ thể. Ai là lãnh đạo trường là
 * việc của vai trò; bước duyệt chỉ nói cấp — nên Sở đổi người duyệt bằng cách
 * đổi vai trò, không phải sửa mã nguồn.
 */
public enum ApprovalStep {
    SCHOOL,
    MANAGING_BODY;

    /**
     * Cấp CAO hơn trong hai cấp; {@code null} là "chưa tới cấp nào". Thứ tự khai báo ở trên chính là thứ tự
     * cấp — {@code VoucherWorkflow.nextStep} cũng dựa vào nó — nên so theo {@code ordinal} là so theo cấp.
     */
    public static ApprovalStep furthest(ApprovalStep a, ApprovalStep b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.ordinal() >= b.ordinal() ? a : b;
    }
}
