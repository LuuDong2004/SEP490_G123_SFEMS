package com.g123.sfems.domain.catalog.standard;

/**
 * Điều chỉnh của một dòng danh mục tối thiểu — Sở khai tay cho từng dòng theo câu của thông tư (changelog 276).
 * {@link #NONE}: không được phép điều chỉnh (mặc định).
 */
public enum AdjustKind {
    NONE,
    /** Giảm định mức khi chưa đủ điều kiện ("Nơi chưa có điều kiện có thể sử dụng 01 bộ/02HS"). */
    REDUCE,
    /** Thay bằng thiết bị khác trong danh mục, hoặc hình thức khác (phần mềm mô phỏng, CNTT). */
    SUBSTITUTE,
    /** Dùng chung với thiết bị khác của danh mục. */
    SHARED,
    /** Một nhóm thiết bị, trường chọn một số trong nhóm ("Lựa chọn 1 trong 3 đạo cụ"). */
    CHOOSE_IN_GROUP
}
