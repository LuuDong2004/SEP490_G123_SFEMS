import type { ComponentProps } from "react";

import type { Badge } from "@/shared/ui/badge";

/**
 * Màu badge của các trạng thái — tách khỏi `domains/` vì biết về UI: domain nói
 * trạng thái LÀ gì, còn nó TRÔNG thế nào thì ở đây.
 */
type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

/**
 * Trạng thái của Sở và trường (`OrgStatus`). "Đã ngưng" dùng tông trung tính chứ
 * không phải cảnh báo: ngưng một đơn vị là quyết định hành chính bình thường.
 */
export const ORG_STATUS_VARIANTS: Record<"active" | "inactive", BadgeVariant> = {
  active: "success",
  inactive: "neutral",
};

/**
 * Only "active" is a working state, so it is the only green one. Locked is
 * destructive rather than merely muted because it means somebody decided this
 * account was a risk, which is worth noticing in a list; inactive is neutral,
 * because it means nothing more than "not in use".
 */
export const USER_STATUS_VARIANTS: Record<"active" | "inactive" | "locked", BadgeVariant> = {
  active: "success",
  inactive: "neutral",
  locked: "destructive",
};

/**
 * Trạng thái phiếu. "Chờ duyệt" là cảnh báo vì nó là việc đang đợi ai đó;
 * "bị từ chối" là destructive vì phiếu dừng hẳn; "đã huỷ" trung tính vì người
 * lập tự bỏ — không có gì phải để ý.
 */
/** Hiện trạng khối nhà / phòng: tốt là xanh, cần sửa / xuống cấp là cảnh báo, hư hỏng nặng là đỏ. */
export const FACILITY_CONDITION_VARIANTS: Record<string, BadgeVariant> = {
  TOT: "success",
  BINH_THUONG: "neutral",
  CAN_SUA_CHUA: "warning",
  XUONG_CAP: "warning",
  HU_HONG_NANG: "destructive",
};

/** Tình trạng sử dụng phòng: đang dùng là xanh; bỏ trống / ngừng là trung tính; đang sửa là cảnh báo. */
export const ROOM_USAGE_VARIANTS: Record<string, BadgeVariant> = {
  DANG_SU_DUNG: "success",
  BO_TRONG: "neutral",
  DANG_SUA_CHUA: "warning",
  NGUNG_SU_DUNG: "neutral",
};

export const VOUCHER_STATUS_VARIANTS: Record<
  "DRAFT" | "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED" | "CANCELLED",
  BadgeVariant
> = {
  DRAFT: "neutral",
  PENDING: "warning",
  APPROVED: "info",
  COMPLETED: "success",
  REJECTED: "destructive",
  CANCELLED: "neutral",
};

/**
 * Trạng thái của một TÀI SẢN (`AssetStatus`) — một bảng cho mọi nơi vẽ nhãn trạng thái tài sản (hồ sơ, bảng
 * thiết bị, hộp chọn tài sản, tra cứu): đang dùng xanh, tạm vắng mặt (cho mượn, điều chuyển) xanh dương, đang
 * xử lý kỹ thuật hoặc chờ quyết định vàng, hỏng / mất đỏ, còn lại trung tính.
 */
/** Màu chip của 7 nhóm trạng thái thiết bị (`ASSET_STATUS_GROUP_OF`). */
export const ASSET_STATUS_GROUP_VARIANTS: Record<string, BadgeVariant> = {
  stock: "neutral",
  use: "success",
  moving: "info",
  repair: "warning",
  broken: "destructive",
  leaving: "warning",
  gone: "neutral",
};

export const ASSET_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  IN_STOCK: "neutral",
  IN_USE: "success",
  BORROWED: "info",
  TRANSFERRING: "info",
  MAINTAINING: "warning",
  REPAIRING: "warning",
  WARRANTY: "warning",
  PENDING_LIQUIDATION: "warning",
  PENDING_DESTRUCTION: "warning",
  BROKEN: "destructive",
  UNREPAIRABLE: "destructive",
  MISSING: "destructive",
  LOST: "destructive",
  NOT_DELIVERED: "destructive",
  LIQUIDATED: "neutral",
  DESTROYED: "neutral",
  USED_UP: "neutral",
};

/** Kết quả chấm chuẩn CSVC (203): đạt xanh, chưa đạt đỏ nhạt, chưa có quy tắc trung tính. */
export const STANDARD_STATUS_VARIANTS: Record<"PASS" | "FAIL" | "NONE", BadgeVariant> = {
  PASS: "success",
  FAIL: "destructive",
  NONE: "neutral",
};

/** Loại cơ sở (nhãn ở `domains/facility/types.ts` — `campusKindLabel`): trường chính nổi, phân hiệu / điểm trường trung tính. */
export const CAMPUS_KIND_VARIANTS: Record<"main" | "branch" | "site", BadgeVariant> = {
  main: "info",
  branch: "neutral",
  site: "neutral",
};

/** Điều chỉnh của dòng danh mục tối thiểu: được phép là xanh, không được phép trung tính. */
export const NORM_ADJUSTABLE_VARIANTS: Record<"allowed" | "denied", BadgeVariant> = {
  allowed: "success",
  denied: "neutral",
};

/** Hiệu lực của dòng danh mục tối thiểu: đang hiệu lực xanh; ngừng / hết hiệu lực đỏ. */
export const NORM_VALIDITY_VARIANTS: Record<"active" | "stopped" | "expired", BadgeVariant> = {
  active: "success",
  stopped: "destructive",
  expired: "destructive",
};

/** Hồ sơ năm học (docs/du-lieu-theo-nam-hoc.md §3): Đang khai · Đã xác nhận · Đã chốt · Mở lại. */
export const PROFILE_STATUS_VARIANTS: Record<"DRAFT" | "CONFIRMED" | "CLOSED" | "REOPENED", BadgeVariant> = {
  DRAFT: "neutral",
  CONFIRMED: "info",
  CLOSED: "success",
  REOPENED: "warning",
};

/** Kiểu điều chỉnh trường áp dụng (279) — cùng họ màu với mockup danh mục điều chỉnh. */
export const ADJUST_KIND_VARIANTS: Record<"REDUCE" | "SUBSTITUTE" | "SHARED" | "CHOOSE_IN_GROUP" | "OUTSIDE", BadgeVariant> = {
  REDUCE: "warning",
  SUBSTITUTE: "info",
  SHARED: "success",
  CHOOSE_IN_GROUP: "secondary",
  OUTSIDE: "neutral",
};
