package com.g123.sfems.module.school.voucher;

import com.g123.sfems.module.catalog.base.dto.IdRef;

/** Payload của mọi phiếu mang trường của phiếu — vắng thì lấy trường của tài khoản đang đăng nhập. */
public interface VoucherRequest {

    IdRef school();
}
