import { useSyncExternalStore } from "react";

import { getPerspective, subscribeToAuthorities, type Perspective } from "@/shared/api/session";

/**
 * Góc nhìn của tài khoản đang đăng nhập (`school` / `management`) — xem `getPerspective`.
 *
 * Đọc từ kho quyền đã lưu, nên đổi chỗ công tác của tài khoản (quyền được đẩy xuống
 * qua kênh live) cũng vẽ lại menu ngay.
 */
export function usePerspective(): { perspective: Perspective } {
  return { perspective: useSyncExternalStore(subscribeToAuthorities, getPerspective) };
}
