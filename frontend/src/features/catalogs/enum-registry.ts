import { Award, Banknote, ClipboardCheck, Tags } from "lucide-react";

/**
 * Danh mục CỐ ĐỊNH, chỉ đọc — giá trị nằm trong code backend
 * (`domain/catalog/enums`) vì nghiệp vụ rẽ nhánh theo từng giá trị. Bản Jmix
 * gom chúng vào một màn `EnumCatalogView` dùng chung; ở đây cũng vậy.
 *
 * <p>`resource` trùng đoạn đường dẫn `/api/enum_catalogs/{resource}`.
 */
export type EnumCatalogConfig = {
  resource: string;
  path: string;
  group: string;
  icon: import("lucide-react").LucideIcon;
  label: string;
  /** Hiện thành tab trong nhóm của nó (vd. Tài chính: Nguồn hình thành · Nguồn kinh phí · Hình thức mua). */
  visible?: boolean;
};

export const ENUM_CATALOGS: EnumCatalogConfig[] = [
  {
    resource: "asset_categories",
    path: "/asset-categories",
    group: "catalog_equip",
    icon: Tags,
    label: "Phân loại kế toán",
  },
  {
    resource: "usage_purposes",
    path: "/usage-purposes",
    group: "catalog_equip",
    icon: ClipboardCheck,
    label: "Mục đích sử dụng thiết bị",
  },
  {
    resource: "funding_sources",
    path: "/funding-sources",
    group: "catalog_finance",
    icon: Banknote,
    label: "Nguồn kinh phí",
    // Tài chính có đủ Nguồn hình thành, Nguồn kinh phí, Hình thức mua.
    visible: true,
  },
  {
    resource: "staff_positions",
    path: "/staff-positions",
    group: "catalog_system",
    icon: Award,
    label: "Chức vụ",
  },
];
