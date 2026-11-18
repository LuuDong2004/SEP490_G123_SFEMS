package com.g123.sfems.module.security.user.api.dto;

import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;

/**
 * Phần riêng theo loại tài khoản (docs/kien-truc/11) — bảng con của {@code users}. Ô nào không thuộc loại của tài
 * khoản thì bị từ chối (vd. {@code superAdmin} cho tài khoản trường), không lặng lẽ bỏ qua. Bỏ cả khối = để nguyên;
 * trong khối, ô {@code null} = để nguyên.
 *
 * @param jobTitle   chức danh — mọi loại
 * @param workPhone  điện thoại cơ quan — Sở, UBND
 * @param note       ghi chú — quản trị
 * @param superAdmin quản trị cấp cao — quản trị; chỉ quản trị cấp cao đặt được
 * @param allowedIps IP / CIDR được đăng nhập, cách nhau dấu phẩy — quản trị; chỉ quản trị cấp cao đặt được
 */
public record UserProfileRequest(
        @Text(value = FieldRule.SHORT_TEXT, label = "Chức danh") String jobTitle,
        @Text(value = FieldRule.PHONE, label = "Điện thoại cơ quan") String workPhone,
        @Text(value = FieldRule.NOTE, label = "Ghi chú") String note,
        Boolean superAdmin,
        @Text(value = FieldRule.LONG_TEXT, label = "IP được đăng nhập", max = 1000) String allowedIps) {
}
