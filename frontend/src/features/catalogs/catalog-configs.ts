import type { CatalogConfig } from "@/features/catalogs/catalog-config";
import { educationLevelConfig } from "@/features/catalogs/extras/education-level";
import { equipmentCatalogConfig } from "@/features/catalogs/extras/equipment-catalog";
import { gradeConfig } from "@/features/catalogs/extras/grade";
import { movementReasonConfig } from "@/features/catalogs/extras/movement-reason";
import { roomTypeConfig } from "@/features/catalogs/extras/room-type";
import { schoolTypeConfig } from "@/features/catalogs/extras/school-type";
import { schoolYearConfig } from "@/features/catalogs/extras/school-year";
import { subjectConfig } from "@/features/catalogs/extras/subject";
import { subjectGroupConfig } from "@/features/catalogs/extras/subject-group";

/**
 * Cấu hình của từng danh mục dùng chung (DM-01). Thêm một danh mục = thêm một mục ở đây rồi gắn vào
 * `routes.tsx` bằng `catalogScreens("<resource>")`. Danh mục có trường riêng khai trong `extras/`.
 */
export const CATALOG_CONFIGS = {
  education_levels: educationLevelConfig,
  room_types: roomTypeConfig,
  school_types: schoolTypeConfig,
  school_years: schoolYearConfig,
  semesters: {
    resource: "semesters",
    noun: "học kỳ",
    description: "Học kỳ dùng chung cho mọi năm học: Học kỳ 1, Học kỳ 2, Cả năm.",
    codePlaceholder: "HOC_KY_1",
    namePlaceholder: "Học kỳ 1",
  },
  grades: gradeConfig,
  subject_groups: subjectGroupConfig,
  subjects: subjectConfig,
  movement_reasons: movementReasonConfig,
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
  equipment_catalogs: equipmentCatalogConfig,
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
