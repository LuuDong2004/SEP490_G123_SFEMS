package com.g123.sfems.module.school.procurement;

/**
 * Kiểm thêm khi TRÌNH một đề xuất mua sắm — đề xuất lập từ chuẩn tối thiểu theo năm học chỉ trình lên Sở được khi
 * năm học đó đã chốt (docs/du-lieu-theo-nam-hoc.md §8 bước 6–7). Hồ sơ năm học cài.
 */
public interface ProposalSubmitGuard {

    void beforeSubmit(Long proposalId, Long schoolId);
}
