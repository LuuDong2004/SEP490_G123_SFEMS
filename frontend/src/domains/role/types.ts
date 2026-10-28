/**
 * The `roles` resource as the API reports it — `RoleResponse` on the backend.
 *
 * The permission catalogue itself lives in `pages/permissions/types.ts`; what
 * is re-exported below is imported from there rather than declared twice, so
 * the role form's picker and the permissions screen cannot drift apart. What
 * stays here is `PermissionSummary`: the *nested* shape a role's payload
 * carries, which is the backend's `RoleResponse.PermissionSummary` and not the
 * permissions endpoint's own response.
 */

import { ACTION_LABELS } from "@/domains/permission/types";

export type {
  Permission,
  PermissionAction,
} from "@/domains/permission/types";
export {
  ACTION_LABELS,
  ACTION_VARIANTS,
  PERMISSION_ACTIONS,
  humanizeResource,
  splitPermissionCode,
} from "@/domains/permission/types";

export type Role = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  /**
   * True for the roles the application itself relies on. The API refuses to
   * delete one or change its code, so the UI does not offer to.
   */
  systemRole: boolean;
  permissions: PermissionSummary[];
};

export type PermissionSummary = {
  id: number;
  code: string;
  name: string;
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/**
 * Tên NGẮN của các vai hệ thống, cho chỗ chỉ đủ một dòng (menu tài khoản trên header). Tên đầy đủ
 * là `roles.name` do máy chủ giữ; vai do quản trị viên tự tạo không có ở đây thì hiện bằng mã.
 */
export const SYSTEM_ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  SO_LEADER: "Lãnh đạo Sở",
  SO_SPECIALIST: "Chuyên viên Sở",
  UBND_LEADER: "Lãnh đạo UBND",
  UBND_SPECIALIST: "Chuyên viên UBND",
  SCHOOL_LEADER: "Lãnh đạo trường",
  SCHOOL_STAFF: "Cán bộ thiết bị",
  SUBJECT_HEAD: "Trưởng bộ môn",
  TEACHER: "Giáo viên",
};
