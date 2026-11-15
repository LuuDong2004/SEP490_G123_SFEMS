import type { CatalogRef } from "@/domains/catalog/types";
import { CONDITION_LABELS, USAGE_STATUS_LABELS } from "@/domains/facility/types";

/** Hiện trạng phòng / công trình — cùng bộ giá trị với máy chủ (`FacilityCondition`). */
export type FacilityCondition = "TOT" | "BINH_THUONG" | "CAN_SUA_CHUA" | "XUONG_CAP" | "HU_HONG_NANG";

/** Tình trạng sử dụng phòng — cùng bộ giá trị với máy chủ (`RoomUsageStatus`). */
export type RoomUsageStatus = "DANG_SU_DUNG" | "BO_TRONG" | "DANG_SUA_CHUA" | "NGUNG_SU_DUNG";

/**
 * Một phòng, đúng hình dạng `RoomResponse` của máy chủ (TC-02).
 *
 * <p>Bảng `rooms` cố tình đơn giản: khối nhà và tầng là hai ô CHỮ ("Dãy A", "Tầng 2")
 * chứ không phải tham chiếu tới bảng khối nhà, và người phụ trách là `managingUnit` (đơn vị/tổ) chứ không
 * phải một tài khoản.
 *
 * <p>`active` KHÔNG gửi lên khi lưu: máy chủ suy nó từ `usageStatus` (ngừng sử dụng là ngừng hoạt động).
 */
export type Room = {
  id: number;
  code: string;
  name: string;
  sortOrder: number | null;
  active: boolean;
  note: string | null;
  school: CatalogRef | null;
  roomType: CatalogRef | null;
  subject: CatalogRef | null;
  building: string | null;
  floor: string | null;
  location: string | null;
  area: number | null;
  capacity: number | null;
  condition: FacilityCondition | null;
  usageStatus: RoomUsageStatus | null;
  /** Đơn vị / tổ quản lý phòng, nhập tự do: "Tổ Vật lí", "Thư viện". */
  managingUnit: string | null;
  createdAt: string;
  updatedAt: string | null;
  /** Người đang đăng nhập được làm gì với chính dòng này. */
  _can?: Record<string, boolean>;
};

/** Lựa chọn của ô "Hiện trạng" — cùng thứ tự với bộ giá trị của máy chủ. */
export const CONDITION_OPTIONS = (Object.keys(CONDITION_LABELS) as FacilityCondition[]).map((value) => ({
  value,
  label: CONDITION_LABELS[value],
}));

/** Lựa chọn của ô "Tình trạng sử dụng". */
export const USAGE_STATUS_OPTIONS = (Object.keys(USAGE_STATUS_LABELS) as RoomUsageStatus[]).map((value) => ({
  value,
  label: USAGE_STATUS_LABELS[value],
}));
