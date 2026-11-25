/** Mặt hàng thiết bị trong danh mục: cách quản lý, nguồn gốc. */

export const TRACKING_TYPE_LABELS: Record<string, string> = {
  serial: "Từng cái",
  bulk: "Theo lô",
};

/**
 * Nguồn gốc của thiết bị NGOÀI danh mục của Sở (thiết bị riêng của một trường). Thiết bị trong danh
 * mục của Sở không có nguồn gốc.
 */
export const CATALOG_ORIGIN_LABELS: Record<string, string> = {
  SELF_MADE: "Tự làm",
  DONATED: "Được tài trợ, tặng",
  OUTSIDE_PURCHASE: "Mua ngoài danh mục",
};

/** Một thiết bị được chọn trong ô chọn danh mục (phiếu ghi tăng, đề xuất mua sắm) — đủ để vẽ dòng phiếu. */
export type PickedCatalog = {
  id: number;
  code: string;
  name: string;
  trackingType?: string;
  assetCategory?: string | null;
  physicalOrDigital?: string | null;
  unit?: { id: number; name: string } | null;
  equipmentType?: { id: number; name: string } | null;
  subject?: { id: number; name: string } | null;
  /** Có giá trị: thiết bị NGOÀI danh mục của Sở, riêng của trường này. */
  ownerSchool?: { id: number; name: string } | null;
  origin?: string | null;
};
