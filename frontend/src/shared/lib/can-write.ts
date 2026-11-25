import { portalAllows } from "@/domains/portal/types";
import { currentPortal } from "@/shared/api/portal";
import { getAuthorities } from "@/shared/api/session";

import { permissionFor } from "./permissions";

/**
 * Người xem sửa được bản ghi này không: có mã quyền ghi, cổng cho ghi, và dòng nằm trong phạm vi (`_can.write`). Cờ `_can`
 * của máy chủ chỉ nói PHẠM VI DÒNG — quản trị viên thấy mọi dòng nhưng không có quyền ghi dữ liệu nghiệp vụ, nên chỉ nhìn
 * cờ là hiện ra nút bấm vào báo lỗi.
 */
export function canWriteRecord(resource: string, record: { _can?: Record<string, boolean> } | null | undefined) {
  const code = permissionFor(resource, "edit");
  if (code && !(getAuthorities()?.permissions?.includes(code) && portalAllows(currentPortal(), code))) return false;
  return record?._can?.write !== false;
}
