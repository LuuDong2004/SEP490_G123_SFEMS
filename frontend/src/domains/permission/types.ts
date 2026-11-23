/**
 * The `permissions` resource as the API reports it — `PermissionResponse` on
 * the backend.
 *
 * The catalogue lives here rather than in `pages/roles/` because roles are one
 * consumer of it and not its owner: `roles/types.ts` re-exports what it needs
 * from this file. The direction matters — a permission means something without
 * any role granting it, a role's grants do not exist without the catalogue.
 */

/** Phạm vi của quyền (docs/kien-truc/11 §11) — `PermissionScope` của máy chủ. */
export type PermissionScope = "SYSTEM" | "ORGANIZATION" | "COMMON";

export const SCOPE_LABELS: Record<PermissionScope, string> = {
  SYSTEM: "Quản trị hệ thống",
  ORGANIZATION: "Nghiệp vụ đơn vị",
  COMMON: "Dùng chung",
};

/** Vai loại `roleType` có được mang quyền phạm vi `scope` không — như `PermissionScope.fits`. */
export function scopeFits(scope: PermissionScope, roleType: string): boolean {
  // Quản trị mang được mọi quyền (dùng được toàn bộ chức năng); vai Sở / UBND / trường không mang quyền quản trị.
  return scope !== "SYSTEM" || roleType === "SYSTEM";
}

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
  /** Loại vai được mang quyền: quản trị / nghiệp vụ đơn vị / dùng chung. */
  scope: PermissionScope;
};

/** The three actions every `resource:action` code ends in. */
export const PERMISSION_ACTIONS = ["read", "write", "delete"] as const;

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
};

/**
 * Tên hiển thị của từng resource, khớp với tên trong `vi.json`. Resource nào
 * chưa có trong bảng thì rơi về dạng humanize của chính mã — một quyền lạ vẫn
 * phải đọc được chứ không được mất.
 */
const RESOURCE_LABELS: Record<string, string> = {
  dashboard: "Tổng hợp",
  users: "Người dùng",
  roles: "Vai trò",
  permissions: "Quyền",
  notifications: "Thông báo",
  row_level_policies: "Phân quyền dòng dữ liệu",
  departments_of_education: "Cơ quan quản lý",
  schools: "Trường học",
  education_levels: "Cấp học",
  tasks: "Công việc",
  acquisition_methods: "Hình thức mua sắm",
  activity_logs: "Nhật ký hoạt động",
  buildings: "Khối nhà",
  campuses: "Cơ sở",
  code_rules: "Quy tắc sinh mã của danh mục chung",
  data_transfer: "Nhập / xuất dữ liệu",
  equipment: "Thiết bị",
  equipment_catalogs: "Danh mục thiết bị",
  equipment_configs: "Bộ thông số kỹ thuật",
  equipment_intakes: "Phiếu ghi tăng",
  equipment_norms: "Định mức thiết bị",
  equipment_standards: "Bộ tiêu chuẩn",
  equipment_types: "Loại thiết bị",
  grades: "Khối lớp",
  inventory_campaigns: "Đợt kiểm kê",
  inventory_sessions: "Phiếu kiểm kê",
  movement_reasons: "Lý do biến động",
  origin_sources: "Nguồn hình thành",
  procurement_plans: "Kế hoạch mua sắm",
  purchase_proposals: "Đề xuất mua sắm",
  reports: "Báo cáo",
  room_types: "Loại CSVC",
  facility_groups: "Khối CSVC",
  facility_standard_rules: "Chuẩn CSVC",
  rooms: "Phòng",
  school_classes: "Lớp học",
  school_code_rules: "Mã tự tăng của trường",
  school_users: "Tài khoản của trường",
  school_years: "Năm học",
  staff: "Cán bộ",
  staff_accounts: "Tài khoản cán bộ",
  subject_groups: "Tổ chuyên môn",
  subject_teams: "Tổ bộ môn",
  subjects: "Môn học",
  ai_settings: "Cấu hình AI",
  system_status: "Tình trạng hệ thống",
  units: "Đơn vị tính",
  wards: "Phường/xã",
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
