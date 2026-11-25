package com.g123.sfems.module.school.procurement;

/**
 * Số "đang đề xuất" của một thiết bị ở một trường — cột "Đề xuất" của bảng định mức ({@link AdequacyService}), của
 * chuẩn tối thiểu theo năm học ({@link YearAdequacyService}) và cảnh báo xin trùng
 * ({@link PurchaseProposalService#overlaps}) đếm cùng một luật:
 * <ul>
 *   <li>đề xuất chưa hoàn tất (nháp, chờ duyệt, đã duyệt — kể cả đang nằm ở kế hoạch chưa duyệt): số trường đề nghị;</li>
 *   <li>đề xuất hoàn tất (kế hoạch chứa nó đã duyệt): số ĐƯA VÀO KẾ HOẠCH — dòng cơ quan bỏ (0) không còn là "đang
 *       xin";</li>
 *   <li>trừ phần đã về theo phiếu ghi tăng HOÀN TẤT lập từ đề xuất (cùng thiết bị): phần đó đã thành thiết bị trên sổ,
 *       nằm ở cột "Đang có". Phiếu ghi tăng còn nháp / chờ duyệt chưa trừ — hàng chưa lên sổ. Đề xuất nhập một phần vẫn
 *       đếm phần còn chờ về, không biến mất sau phiếu ghi tăng đầu tiên.</li>
 * </ul>
 */
final class ProposedQuantity {

    private ProposedQuantity() {
    }

    /**
     * Câu SQL trả ba cột {@code school_id, catalog_id, n}. {@code statuses}: danh sách trạng thái đề xuất đã trích dẫn
     * ({@code 'PENDING', 'APPROVED'}); {@code where}: điều kiện thêm trên bí danh {@code p} (purchase_proposals), bắt đầu
     * bằng {@code " AND"} hoặc rỗng.
     */
    static String sql(String statuses, String where) {
        return """
                SELECT q.school_id, q.catalog_id, SUM(GREATEST(q.n - COALESCE(r.n, 0), 0))::int AS n
                FROM (SELECT p.id AS proposal_id, p.school_id, l.catalog_id,
                             SUM(CASE WHEN p.status = 'COMPLETED' THEN COALESCE(l.planned_quantity, l.quantity)
                                      ELSE l.quantity END) AS n
                      FROM purchase_proposals p JOIN purchase_proposal_lines l ON l.proposal_id = p.id
                      WHERE p.status IN (%s)%s
                      GROUP BY 1, 2, 3) q
                LEFT JOIN (SELECT i.source_id, il.catalog_id, SUM(il.received_quantity) AS n
                           FROM equipment_intakes i JOIN equipment_intake_lines il ON il.intake_id = i.id
                           WHERE i.source_resource = 'purchase_proposals' AND i.status = 'COMPLETED'
                           GROUP BY 1, 2) r ON r.source_id = q.proposal_id AND r.catalog_id = q.catalog_id
                GROUP BY 1, 2
                HAVING SUM(GREATEST(q.n - COALESCE(r.n, 0), 0)) > 0""".formatted(statuses, where);
    }
}
