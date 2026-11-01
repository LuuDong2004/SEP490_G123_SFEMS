import type { CatalogConfig } from "@/features/catalogs/catalog-config";

/**
 * Cấu hình của từng danh mục dùng chung (DM-01). Thêm một danh mục = thêm một mục ở đây rồi gắn vào
 * `routes.tsx` bằng `catalogScreens("<resource>")`.
 */
export const CATALOG_CONFIGS = {
  wards: {
    resource: "wards",
    noun: "phường/xã",
    description: "Đơn vị hành chính cấp xã, nơi trường đặt trụ sở.",
    codeRequired: true,
    codePlaceholder: "26734",
    namePlaceholder: "Phường Bến Thành",
  },
  equipment_types: {
    resource: "equipment_types",
    noun: "loại thiết bị",
    description: "Nhóm lớn của thiết bị: thiết bị dạy học, máy móc, vật tư, hoá chất…",
    codePlaceholder: "TBDH",
    namePlaceholder: "Thiết bị dạy học",
  },
  units: {
    resource: "units",
    noun: "đơn vị tính",
    description: "Đơn vị đếm thiết bị trên phiếu và trong sổ tài sản.",
    codePlaceholder: "CAI",
    namePlaceholder: "Cái",
  },
  origin_sources: {
    resource: "origin_sources",
    noun: "nguồn hình thành",
    description: "Nguồn kinh phí hình thành tài sản: ngân sách, xã hội hoá, tài trợ…",
    codePlaceholder: "NSNN",
    namePlaceholder: "Ngân sách nhà nước",
  },
  acquisition_methods: {
    resource: "acquisition_methods",
    noun: "phương thức hình thành",
    description: "Tài sản về trường bằng cách nào: mua sắm, được cấp, được tài trợ…",
    codePlaceholder: "MUASAM",
    namePlaceholder: "Mua sắm",
  },
} satisfies Record<string, CatalogConfig>;

export type CatalogResource = keyof typeof CATALOG_CONFIGS;
