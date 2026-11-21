/** Quản trị hệ thống: người dùng, vai trò, quyền, phạm vi dữ liệu — một feature vì chúng sửa lẫn nhau. */
import { lazyNamed } from "@/shared/lib/lazy-named";

// Màn hình: tải khi mở tới (mỗi thư mục một chunk) — xem `lazyNamed`.
export const UserList = lazyNamed(() => import("./users/list"), "UserList");
export const UserCreate = lazyNamed(() => import("./users/create"), "UserCreate");
export const UserEdit = lazyNamed(() => import("./users/edit"), "UserEdit");
export const UserShow = lazyNamed(() => import("./users/show"), "UserShow");
export const RoleList = lazyNamed(() => import("./roles/list"), "RoleList");
export const RoleCreate = lazyNamed(() => import("./roles/create"), "RoleCreate");
export const RoleEdit = lazyNamed(() => import("./roles/edit"), "RoleEdit");
export const RoleShow = lazyNamed(() => import("./roles/show"), "RoleShow");
export const PermissionList = lazyNamed(() => import("./permissions/list"), "PermissionList");
export const PermissionShow = lazyNamed(() => import("./permissions/show"), "PermissionShow");
export const DataImports = lazyNamed(() => import("./data-imports"), "DataImports");
export const DataImportBatch = lazyNamed(() => import("./data-imports"), "DataImportBatch");
export const NotificationSettingsPage = lazyNamed(
  () => import("./notification-settings/page"),
  "NotificationSettingsPage",
);
export const ApprovalFlowsPage = lazyNamed(() => import("./approval-flows/page"), "ApprovalFlowsPage");
