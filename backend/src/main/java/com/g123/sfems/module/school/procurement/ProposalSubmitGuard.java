package com.g123.sfems.module.school.procurement;

/**
 * Kiểm thêm khi TRÌNH một đề xuất mua sắm — chỗ móc cho phân hệ khác. Hiện không bean nào cài: luật "năm học phải
 * chốt mới trình được" đã bỏ (trưởng nhóm 23/11/2026) — trình lúc nào cũng được, đề xuất của năm chưa chốt chỉ mang
 * nhãn "Năm học chưa chốt" (`YearGapService.Trace.yearClosed`).
 */
public interface ProposalSubmitGuard {

    void beforeSubmit(Long proposalId, Long schoolId);
}
