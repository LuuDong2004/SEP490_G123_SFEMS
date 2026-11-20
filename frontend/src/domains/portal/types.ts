/**
 * Cổng theo loại tài khoản: Quản trị · Sở · Trường (đồ án không có cấp UBND). BẢN SAO của bảng phân cổng phía máy chủ
 * (`backend/.../shared/web/portal/PortalRoutes.java`) — giao diện dùng để ẩn menu / nút mà cổng hiện tại không mở;
 * máy chủ mới là nơi chặn thật (403). Đổi bên kia thì đổi bên này (`npm run verify:portal` so hai bản).
 */
export type UserType = "SYSTEM" | "SO" | "SCHOOL";
export type Portal = "admin" | "so" | "school";

export const PORTAL_OF: Record<UserType, Portal> = { SYSTEM: "admin", SO: "so", SCHOOL: "school" };
export const PORTALS: Portal[] = ["admin", "so", "school"];

export const PORTAL_LABELS: Record<Portal, string> = {
  admin: "Quản trị hệ thống",
  so: "Sở GD&ĐT",
  school: "Trường học",
};

/** Không qua cổng — dùng trước khi biết loại tài khoản. */
export const UNGATED = ["auth"];

export type PortalRule = { read: Portal[]; write: Portal[] };

/** Tài nguyên (đoạn đầu sau `/api/`) → cổng đọc / ghi. */
export const PORTAL_ROUTES: Record<string, PortalRule> = {
  "users": { read: ["admin"], write: ["admin"] },
  "roles": { read: ["admin"], write: ["admin"] },
  "permissions": { read: ["admin"], write: ["admin"] },
  "row_level_policies": { read: ["admin"], write: ["admin"] },
  "ai_settings": { read: ["admin"], write: ["admin"] },
  "data_changes": { read: ["admin"], write: ["admin"] },
  "system_status": { read: ["admin"], write: ["admin"] },
  "approval_flows": { read: [], write: [] },
  "school_users": { read: [], write: [] },
  "code_rules": { read: ["admin", "so", "school"], write: ["admin"] },
  "activity_logs": { read: ["admin"], write: ["admin", "so", "school"] },
  "notifications": { read: ["admin", "so", "school"], write: ["admin", "so", "school"] },
  "enum_catalogs": { read: ["admin", "so", "school"], write: [] },
  "schools": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "departments_of_education": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "wards": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "education_levels": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "acquisition_methods": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "equipment_catalogs": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "equipment_configs": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "equipment_norms": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "equipment_standards": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "equipment_types": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "facility_groups": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "facility_standard_rules": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "grades": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "legal_documents": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "movement_reasons": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "room_types": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "school_years": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "semesters": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "subject_groups": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "subjects": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "units": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "origin_sources": { read: ["admin", "so", "school"], write: [] },
  "voucher_forms": { read: ["admin", "so", "school"], write: [] },
  "buildings": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "campuses": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "rooms": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "facility_info": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "facility_todo": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "equipment": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "equipment_items": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "inventory_sessions": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "school_classes": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "staff": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "subject_teams": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "data_transfer": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "staff_assignments": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "year_standards": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "school_year_profiles": { read: ["admin", "so", "school"], write: ["admin", "so", "school"] },
  "school_norm_adjustments": { read: ["admin", "so", "school"], write: ["admin", "school"] },
  "equipment_intakes": { read: ["admin", "so", "school"], write: ["admin", "so", "school"] },
  "purchase_proposals": { read: ["admin", "so", "school"], write: ["admin", "so", "school"] },
  "attachments": { read: ["admin", "so", "school"], write: ["admin", "so", "school"] },
  "report_snapshots": { read: ["admin", "so", "school"], write: ["admin", "so", "school"] },
  "reports": { read: ["admin", "so", "school"], write: ["admin", "so", "school"] },
  "inventory_campaigns": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "procurement_plans": { read: ["admin", "so", "school"], write: ["admin", "so"] },
  "facility-standard": { read: ["admin", "so", "school"], write: [] },
  "school_overview": { read: ["admin", "so", "school"], write: [] },
  "voucher_events": { read: ["admin", "so", "school"], write: [] },
  "voucher_holds": { read: ["admin", "so", "school"], write: [] },
  "voucher_links": { read: ["admin", "so", "school"], write: [] },
  "school_code_rules": { read: ["school"], write: ["school"] },
  "school_profile": { read: ["school"], write: ["school"] },
  "data_imports": { read: ["admin", "so", "school"], write: ["admin", "so", "school"] },
};

const READ_ACTIONS = new Set(["read", "list", "show", "export"]);

/** Cổng `portal` có mở mã quyền `resource:action` không. Tài nguyên ngoài bảng (màn chỉ có ở giao diện) thì mở. */
export function portalAllows(portal: Portal | null, permission: string): boolean {
  if (!portal) return true;
  const [resource, action = "read"] = permission.split(":");
  const rule = PORTAL_ROUTES[resource];
  if (!rule) return true;
  return (READ_ACTIONS.has(action) ? rule.read : rule.write).includes(portal);
}

/** Màn chỉ có ở giao diện (không có mã quyền riêng) → cổng hiện nó. Ngoài danh sách thì theo mã quyền. */
const UI_ONLY: Record<string, Portal[]> = {
  dashboard: ["admin", "so", "school"],
  // Ngoài 42 UC (trưởng nhóm chốt 20/11/2026): không lên menu ở cổng nào. Văn bản căn cứ vẫn chọn được trong danh mục
  // tối thiểu (DM-03); luồng duyệt và tài khoản trường đóng cả API.
  legal_documents: [],
  approval_flows: [],
  school_users: [],
  school_explorer: ["admin", "so", "school"],
};

/**
 * Mục menu `name` (mã quyền `required`, null nếu không có) có hiện ở cổng `portal` không: cổng nào cũng hiện thứ cổng
 * đó ĐỌC được. Quản trị viên đi được toàn bộ luồng (trưởng nhóm 20/11/2026, changelog 281) nên thấy mọi phân hệ.
 */
export function menuAllows(portal: Portal | null, name: string, required: string | null): boolean {
  if (!portal) return true;
  if (UI_ONLY[name]) return UI_ONLY[name].includes(portal);
  if (!required) return true;
  const rule = PORTAL_ROUTES[required.split(":")[0]];
  if (!rule) return true;
  return rule.read.includes(portal);
}
