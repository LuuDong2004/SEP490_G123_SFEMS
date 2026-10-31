/**
 * The `permissions` resource as the API reports it — `PermissionResponse` on
 * the backend.
 *
 * The catalogue lives here rather than in `pages/roles/` because roles are one
 * consumer of it and not its owner: `roles/types.ts` re-exports what it needs
 * from this file. The direction matters — a permission means something without
 * any role granting it, a role's grants do not exist without the catalogue.
 */

export type Permission = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  /**
   * True for a code that arrived in a migration alongside the `@PreAuthorize`
   * that checks it, as opposed to one added afterwards. The mirror of
   * `Role.systemRole` — but nothing refuses an edit on the strength of it yet,
   * because the catalogue is read-only over the API in the first place.
   */
  systemPermission: boolean;
};

/**
 * Sáu động từ của mã quyền `{resource}:{action}` (ARCHITECTURE.md mục 2.3), theo thứ tự hiện
 * cột trong ma trận quyền. Thao tác lạ ngoài danh sách vẫn được hiện, nối vào cuối.
 */
export const PERMISSION_ACTIONS = [
  "read",
  "write",
  "delete",
  "approve",
  "export",
  "configure",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/**
 * How each action reads in a badge. `delete` is the only destructive one and
 * the only one coloured as such; `read` stays quiet because most codes are
 * reads and colouring them all would be noise.
 */
export const ACTION_VARIANTS: Record<
  string,
  "secondary" | "outline" | "destructive"
> = {
  read: "outline",
  write: "secondary",
  delete: "destructive",
  approve: "secondary",
  export: "outline",
  configure: "secondary",
};

/**
 * How each action reads in a badge, in Vietnamese. The wire values stay
 * English — `read`/`write`/`delete` are what the codes end in.
 */
export const ACTION_LABELS: Record<string, string> = {
  read: "Đọc",
  write: "Ghi",
  delete: "Xoá",
  approve: "Duyệt",
  export: "Xuất",
  configure: "Cấu hình",
};

/**
 * Tên hiển thị của từng resource, khớp với tên trong `vi.json`. Resource nào
 * chưa có trong bảng thì rơi về dạng humanize của chính mã — một quyền lạ vẫn
 * phải đọc được chứ không được mất.
 */
const RESOURCE_LABELS: Record<string, string> = {
  // Hệ thống (HT)
  dashboard: "Bảng điều khiển",
  users: "Người dùng",
  roles: "Vai trò",
  permissions: "Quyền",
  notifications: "Thông báo",
  row_level_policies: "Phạm vi dữ liệu",
  activity_logs: "Nhật ký hoạt động",
  // Danh mục dùng chung (DM)
  wards: "Phường/xã",
  school_years: "Năm học",
  grades: "Khối lớp",
  subjects: "Môn học",
  room_types: "Loại phòng",
  equipment_types: "Loại thiết bị",
  units: "Đơn vị tính",
  origin_sources: "Nguồn hình thành",
  acquisition_methods: "Phương thức hình thành",
  movement_reasons: "Lý do biến động",
  education_levels: "Cấp học",
  equipment_catalogs: "Danh mục thiết bị",
  equipment_standards: "Danh mục thiết bị tối thiểu",
  equipment_norms: "Định mức thiết bị",
  code_rules: "Quy tắc sinh mã",
  // Tổ chức và cơ sở vật chất (TC)
  departments_of_education: "Cơ quan quản lý",
  schools: "Trường học",
  rooms: "Phòng",
  // Hồ sơ thiết bị (TS)
  equipment: "Thiết bị",
  attachments: "Tệp đính kèm",
  school_code_rules: "Bộ đếm mã tài sản của trường",
  data_imports: "Nhập dữ liệu từ tệp",
  // Mua sắm (NC)
  purchase_proposals: "Đề xuất mua sắm",
  procurement_plans: "Kế hoạch mua sắm",
  // Nhập thiết bị (PN)
  equipment_intakes: "Phiếu nhập thiết bị",
  // Kiểm kê (KK)
  inventory_campaigns: "Đợt kiểm kê",
  inventory_sessions: "Phiếu kiểm kê",
  // Báo cáo (BC)
  reports: "Báo cáo",
  data_exports: "Xuất dữ liệu",
};

/**
 * Splits `resource:action` into its halves so the permission picker can group
 * by resource. Anything without a colon becomes its own group rather than being
 * dropped — a permission the UI cannot categorise is still one an admin needs
 * to be able to grant.
 */
export function splitPermissionCode(code: string): {
  resource: string;
  action: string;
} {
  const separator = code.indexOf(":");
  if (separator === -1) {
    return { resource: code, action: code };
  }
  return {
    resource: code.slice(0, separator),
    action: code.slice(separator + 1),
  };
}

/** `blog_posts` reads better as "Blog posts" in a group heading. */
export function humanizeResource(resource: string): string {
  const known = RESOURCE_LABELS[resource];
  if (known) return known;
  const spaced = resource.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
