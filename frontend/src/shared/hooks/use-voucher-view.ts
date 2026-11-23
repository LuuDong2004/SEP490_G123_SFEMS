import { useState } from "react";

export type VoucherView = "work" | "document";

/**
 * Dạng xem của màn chi tiết một loại phiếu. Mở ra LUÔN là dạng "Làm việc" (trưởng nhóm 13/11/2026) — dạng
 * "Văn bản" chỉ bật khi người dùng chọn, và không nhớ sang lần mở sau. `name` giữ cho chỗ gọi không đổi.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useVoucherView(_name: string) {
  return useState<VoucherView>("work");
}
