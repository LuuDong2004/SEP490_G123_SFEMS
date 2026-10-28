import { ENUM_CATALOG_RESOURCES } from "@/domains/enum-catalog/types";

/**
 * Decides what the UI offers, from the permissions fetched at sign-in.
 *
 * The access token carries none: `authProvider.check` fetches them from
 * `/auth/permissions` before the shell renders and caches them in `session.ts`,
 * so every question here is answered from that cache. Refine calls `can` for
 * every menu item, every action button and every `<CanAccess>` boundary — a
 * table of twenty rows with four action buttons each would otherwise be eighty
 * authorisation requests.
 *
 * This hides things; it does not protect them. Every endpoint re-checks the
 * same permission with `@PreAuthorize`, so a hand-edited URL or a devtools
 * console gets a 403 rather than a result. That is deliberate: this layer
 * exists to keep the UI honest about what the user can do, not to enforce it.
 *
 * Two questions are answered here, in order. The permission code decides
 * whether the resource is reachable at all; the `_can` flags the API stamps on
 * each row decide whether *that row* can be edited or deleted. The second is
 * likewise only a hint — the server answers a write outside the caller's data
 * scope with a 422 regardless of which buttons were rendered.
 */

/** Hành động mà một mã quyền có thể kết thúc bằng. */
export type PermissionAction = "read" | "write" | "delete" | "approve" | "export" | "configure";

/**
 * Refine's six actions, mapped onto the actions the API grants.
 *
 * `clone` needs `write` rather than `read` even though it opens a form
 * pre-filled from an existing record: what it produces is a create.
 *
 * Hai hành động cuối không phải của Refine — chúng là hành động của DỰ ÁN,
 * thêm theo Chương V mục 3.6.5 ("xem, thêm, sửa, xóa, PHÊ DUYỆT, XUẤT DỮ
 * LIỆU"). Màn hình gọi chúng qua `useCan({ action: "approve" })` hoặc
 * `permissionFor(resource, "export")`:
 *
 * - `approve` là một HÀNH ĐỘNG, không phải một giá trị của trường trạng thái.
 *   Mỗi chuyển trạng thái là một endpoint riêng nên cần một mã quyền riêng;
 *   nếu trạng thái là một ô chọn trên form thì mọi bước nhảy đều hợp lệ như
 *   nhau và luật "chỉ nháp mới trình duyệt được" phải đi kiểm ở chỗ khác.
 * - `export` tách khỏi `read` vì xem một danh sách trên màn hình và mang cả
 *   danh sách ra khỏi hệ thống dưới dạng tệp là hai việc có rủi ro khác nhau.
 *   Mục 3.9.6 bắt ghi nhật ký riêng cho thao tác xuất dữ liệu.
 */
export const ACTION_TO_PERMISSION: Record<string, PermissionAction> = {
  list: "read",
  show: "read",
  create: "write",
  edit: "write",
  clone: "write",
  delete: "delete",
  approve: "approve",
  export: "export",
  /** Khai cấu hình của một nghiệp vụ (vd. tiêu chí minh chứng — `evidence:configure`). */
  configure: "configure",
};

/**
 * Resources that are declared for the sake of routing and the sidebar, and have
 * no permission code behind them.
 *
 * The dashboard is a screen, not a resource: no endpoint, no rows, nothing the
 * API guards. Deriving `dashboard:read` for it would invent a permission that
 * protects nothing — and, because that code is in no migration and in no role,
 * `useAccessibleMenuItems` would hide the item from every account including the
 * administrator. The same reasoning exempts `/user/queue/auth` on the WebSocket
 * side: requiring a grant to reach something that grants nothing is circular.
 *
 * Keep this list short. An entry here is a screen the UI offers to anyone
 * signed in, so anything it does show has to be safe for anyone signed in —
 * which in practice means it must not read a guarded resource. The moment the
 * dashboard starts pulling counts out of `blog_posts` or `users`, those reads
 * are `useList` calls that carry their own permission checks, and the tiles
 * around them need gating with `useCan` rather than an entry here.
 */
const UNGUARDED_RESOURCES = new Set([
  "dashboard",
  // Màn tổng quan tự gác từng khối bằng quyền của resource bên trong nó.
  "school_explorer",
  // Danh mục cố định chỉ đọc: API chỉ cần đăng nhập, không có mã quyền riêng.
  ...ENUM_CATALOG_RESOURCES,
]);

/**
 * Màn hình không có tài nguyên riêng mà làm việc trên dữ liệu của tài nguyên
 * khác — in tem và tra cứu đọc thiết bị. Chúng mượn mã quyền của tài nguyên đó
 * thay vì bịa ra `equipment_labels:read` mà không migration nào cấp.
 */
const PERMISSION_ALIASES: Record<string, string> = {
  equipment_labels: "equipment",
  equipment_lookup: "equipment",
  // Bảng Chi tiết của màn Thiết bị (và "Thiết bị trong phòng" của hồ sơ phòng) — máy chủ gác bằng `equipment:read`.
  equipment_items: "equipment",
  equipment_adequacy: "purchase_proposals",
  equipment_minimum: "purchase_proposals",
};

/**
 * The permission code a resource and action need, or `null` where no code
 * applies — a route-less grouping node, an unguarded screen, or an action
 * nobody has defined one for.
 *
 * Exported because the sidebar filters the menu with it. `useMenu` does not
 * consult access control at all: it only drops items marked `meta.hide` or with
 * neither a list route nor children. Without this the Administration section
 * would be offered to everyone and the API would answer 403 on arrival.
 */
export function permissionFor(
  resource: string | undefined,
  action: string
): string | null {
  if (!resource || UNGUARDED_RESOURCES.has(resource)) return null;
  // Trang Quy trình của một phân hệ chỉ là hướng dẫn: không đọc dữ liệu nào, mọi liên kết
  // trên đó tự gác bằng quyền của màn đích. Sidebar ẩn cả phân hệ nếu chỉ còn trang này.
  if (resource.startsWith("process_")) return null;
  const suffix = ACTION_TO_PERMISSION[action];
  // Mỗi báo cáo là một mục menu (`report_<tên>`) nhưng cùng một quyền `reports:read`.
  const base = resource.startsWith("report_") ? "reports" : PERMISSION_ALIASES[resource] ?? resource;
  return suffix ? `${base}:${suffix}` : null;
}
