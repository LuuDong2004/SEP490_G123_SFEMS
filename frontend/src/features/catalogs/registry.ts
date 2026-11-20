import {
  ArrowLeftRight,
  Award,
  BadgeCheck,
  Banknote,
  BookOpenText,
  Building,
  CalendarDays,
  Clock,
  FileBadge,
  FolderTree,
  Gauge,
  SlidersHorizontal,
  HandCoins,
  Hash,
  MapPin,
  Package,
  Tags,
  Users,
  ScrollText,
} from "lucide-react";

import { LEGAL_DOC_NUMBER } from "@/domains/legal-document/types";
import type { CatalogConfig } from "@/shared/components/catalog/types";
import { CATALOG_EXTRAS } from "@/features/catalogs/extras";

/**
 * Các danh mục dùng chung dựng trên lớp nền `CatalogEntity`.
 *
 * <p>`routes.tsx` sinh CẢ HAI nửa của khai báo — mục trong `resources` và cây
 * `<Route>` — từ mảng này, nên chúng không thể lệch nhau.
 *
 * <p>`group` và `icon` theo đúng menu của bản Jmix (`menu.xml`, nhóm
 * `menu.catalog.group.*`): người dùng chuyển từ hệ thống cũ sang tìm được danh
 * mục ở đúng chỗ quen thuộc. Thứ tự trong mảng là thứ tự trong nhóm, cũng
 * theo Jmix. Hai danh mục bản Jmix không đặt lên menu — Hình thức mua sắm và
 * Lý do biến động — được xếp vào nhóm gần nghĩa nhất.
 *
 * <p>Nhãn lấy từ `docs/i18n/jmix-vi.json`, không tự nghĩ lại.
 */
const BASE: CatalogConfig[] = [
  // ---- Tổ chức và cơ sở vật chất (Cấp học khai riêng trong routes.tsx) ----
  {
    resource: "wards",
    path: "/wards",
    group: "catalog_org",
    icon: MapPin,
    label: "Phường/Xã",
    description: "Phường, xã của TP.HCM theo địa giới mới từ 2025.",
    codeExample: "26734",
    nameExample: "Phường Thủ Đức",
  },
  {
    resource: "facility_groups",
    path: "/facility-groups",
    group: "catalog_org",
    icon: Building,
    label: "Khối CSVC",
    description: "Khối phòng học tập, khối phụ trợ, khu sân chơi…",
    codeExample: "05",
    nameExample: "Khối phòng học tập",
  },
  {
    resource: "room_types",
    path: "/room-types",
    group: "catalog_org",
    icon: Building,
    label: "Loại CSVC",
    description: "Phòng, nhà, khu vực theo danh mục CSVC của Sở.",
    codeExample: "PHONG_HOC",
    nameExample: "Phòng học",
  },
  {
    resource: "facility_standard_rules",
    path: "/facility-standard-rules",
    group: "catalog_org",
    icon: BadgeCheck,
    label: "Chuẩn CSVC",
    description: "Tối thiểu, mức độ 1, mức độ 2 theo TT 13/2020, TT 23/2024. Số nạp sẵn là gợi ý, Sở rà lại.",
    codeExample: "PHONG_HOC.THPT.MIN",
    nameExample: "Phòng học",
    codeLabel: "Mã quy tắc",
    nameLabel: "Loại CSVC",
    hideCode: true,
    hideName: true,
    hideSortOrder: true,
  },

  // ---- Năm học và môn học ----
  {
    resource: "school_years",
    path: "/school-years",
    group: "catalog_academic",
    icon: CalendarDays,
    label: "Năm học",
    description: "Các năm học và năm đang diễn ra.",
    codeExample: "2026-2027",
    nameExample: "Năm học 2026-2027",
  },
  {
    resource: "semesters",
    path: "/semesters",
    group: "catalog_academic",
    icon: Clock,
    label: "Học kỳ",
    description: "Học kỳ trong năm học.",
    codeExample: "HOC_KY_1",
    nameExample: "Học kỳ 1",
  },
  {
    resource: "grades",
    path: "/grades",
    group: "catalog_academic",
    icon: Award,
    label: "Khối lớp",
    description: "Khối lớp 1 đến 12 theo từng cấp học.",
    codeExample: "LOP_10",
    nameExample: "Lớp 10",
  },
  {
    resource: "subject_groups",
    path: "/subject-groups",
    group: "catalog_academic",
    icon: Users,
    label: "Tổ chuyên môn",
    description: "Tổ chuyên môn và các môn trong tổ.",
    codeExample: "THPT-KHTN",
    nameExample: "Tổ Khoa học tự nhiên",
  },
  {
    resource: "subjects",
    path: "/subjects",
    group: "catalog_academic",
    icon: BookOpenText,
    label: "Môn học",
    description: "Môn học và cấp học có dạy môn.",
    // Mã duy nhất là mã môn dạy học (hai chữ số, đi vào đoạn MH của mã tài sản);
    // `code` nội bộ do máy chủ tự gán từ nó — ô Mã riêng ẩn khỏi form.
    hideCode: true,
    // Mã môn là số, đứng cạnh cột STT (cũng là số) thì dễ đọc nhầm — tester đề xuất bỏ STT.
    hideIndex: true,
    // Xếp theo mã môn tăng dần (00, 08, 09, 10…) — tester đề xuất. Mã luôn đủ hai chữ số nên xếp
    // theo chuỗi ra đúng thứ tự số.
    defaultSort: { field: "code", order: "asc" },
    codeLabel: "Mã môn",
    codeShowLabel: "Mã môn dạy học",
    codeExample: "08",
    nameExample: "Toán",
  },

  // ---- Tài sản và thiết bị ----
  {
    resource: "equipment_catalogs",
    // Không còn tab riêng: thiết bị xem trong Danh mục thiết bị tối thiểu (theo cấp học, và tab "Ngoài danh mục").
    // Route giữ nguyên cho trang hồ sơ, trang sửa và các liên kết cũ.
    hidden: true,
    pageForm: true,
    // Thêm / Sửa từ danh sách mở hộp thoại; hồ sơ chi tiết (có bảng định mức) vẫn là trang.
    formDialog: true,
    path: "/equipment-catalogs",
    group: "catalog_equip",
    icon: FolderTree,
    // Nhãn menu là "Danh mục thiết bị" chứ không phải "Thiết bị" như nhãn ô
    // nhập: menu đã có một mục "Thiết bị" ở nhóm Quản lý thiết bị, và đó là
    // TÀI SẢN CÓ THẬT. Hai mục trùng tên ở hai nhóm là cách chắc chắn người
    // dùng bấm nhầm.
    label: "Danh mục thiết bị",
    codeLabel: "Mã DM thiết bị",
    description: "Thiết bị dùng chung cho mọi trường, chọn khi lập phiếu ghi tăng.",
    codeExample: "TB-MAYCHIEU",
    nameExample: "Máy chiếu đa năng",
  },
  {
    resource: "equipment_types",
    path: "/equipment-types",
    group: "catalog_equip",
    icon: Package,
    label: "Loại thiết bị",
    description: "Nhóm của phụ lục danh mục tối thiểu: tranh ảnh, bản đồ, dụng cụ, hoá chất…",
    // Mã hai chữ cái. Không phải thành phần LT của mã tài sản — LT là TB / PM / HL.
    codeExample: "HC",
    nameExample: "Hoá chất",
    codePattern: { value: /^[A-Z]{2}$/, message: "Mã loại thiết bị gồm 2 chữ cái in hoa, vd. HC" },
  },
  {
    resource: "units",
    path: "/units",
    group: "catalog_equip",
    icon: Tags,
    label: "Đơn vị tính",
    description: "Đơn vị đếm thiết bị và vật tư.",
    codeExample: "BO",
    nameExample: "Bộ",
  },

  {
    resource: "equipment_configs",
    pageForm: true,
    path: "/equipment-configs",
    group: "catalog_equip",
    icon: SlidersHorizontal,
    label: "Bộ thông số kỹ thuật",
    description: "Các thông số mà từng loại thiết bị phải khai.",
    codeExample: "TS-MAY-CHIEU",
    nameExample: "Thông số máy chiếu",
  },
  {
    resource: "equipment_standards",
    // Sửa bộ (văn bản căn cứ nhiều dòng) mở TRANG riêng, không hộp thoại.
    pageForm: true,
    path: "/equipment-standards",
    group: "catalog_equip",
    icon: FileBadge,
    // Một màn cho bộ tiêu chuẩn theo cấp học VÀ định mức theo môn (`extra.ListPage`).
    label: "Danh mục thiết bị tối thiểu",
    // Đếm THIẾT BỊ (1.720), không đếm dòng phụ lục (1.777) — cùng con số với Danh mục thiết bị.
    countResource: "equipment_catalogs",
    countFilters: [{ field: "minimumRequired", value: "true" }],
    description: "Danh mục thiết bị dạy học tối thiểu theo cấp học (TT 37, 38, 39/2021, sửa đổi bởi TT 26/2023).",
    codeExample: "TT39-2021-THPT",
    nameExample: "Danh mục thiết bị tối thiểu cấp THCS",
  },
  {
    resource: "legal_documents",
    path: "/legal-documents",
    group: "catalog_equip",
    icon: ScrollText,
    label: "Văn bản căn cứ",
    description: "Thông tư của Bộ về thiết bị dạy học và cơ sở vật chất.",
    codeLabel: "Số hiệu",
    codeExample: "39/2021/TT-BGDĐT",
    codeMax: 50,
    codePattern: { value: LEGAL_DOC_NUMBER, message: "Số hiệu chỉ gồm chữ, số và dấu / . -" },
    nameLabel: "Tên văn bản",
    nameExample: "Ban hành Danh mục thiết bị dạy học tối thiểu cấp Tiểu học",
  },
  {
    resource: "equipment_norms",
    // Không còn mục menu riêng: các dòng định mức xem / sửa trong màn Danh mục thiết bị tối thiểu.
    hidden: true,
    pageForm: true,
    path: "/equipment-norms",
    group: "catalog_equip",
    icon: Gauge,
    label: "Thiết bị trong danh mục tối thiểu",
    description: "Số lượng thiết bị tối thiểu theo môn, khối và loại phòng.",
    codeExample: "DM-TOAN-10-001",
    nameExample: "Bộ thước vẽ bảng dạy học",
  },

  // ---- Tài chính ----
  {
    resource: "origin_sources",
    path: "/origin-sources",
    group: "catalog_finance",
    icon: Banknote,
    label: "Nguồn hình thành",
    description: "Thiết bị từ đâu ra. Sáu nguồn cố định, chọn ở đầu phiếu ghi tăng, không thêm hay sửa được.",
    codeExample: "MUA_SAM",
    nameExample: "Mua sắm",
  },
  {
    resource: "acquisition_methods",
    path: "/acquisition-methods",
    group: "catalog_finance",
    icon: HandCoins,
    label: "Hình thức mua sắm",
    description: "Cách trường mua hoặc nhận thiết bị.",
    codeExample: "DAU_THAU",
    nameExample: "Đấu thầu",
  },

  // ---- Danh mục nghiệp vụ ----
  {
    resource: "movement_reasons",
    path: "/movement-reasons",
    group: "catalog_business",
    icon: ArrowLeftRight,
    label: "Lý do biến động",
    description: "Lý do tăng, giảm thiết bị trên phiếu.",
    codeExample: "GT01",
    nameExample: "Mua sắm mới",
  },

  // ---- Quản trị hệ thống ----
  // Không phải danh mục nghiệp vụ, nhưng cùng hình dạng CatalogEntity nên dùng
  // chung bộ màn. Bản Jmix đặt nó trong nhóm "Tính năng dành cho nhà phát triển".
  {
    resource: "code_rules",
    path: "/code-rules",
    group: "admin_config",
    icon: Hash,
    label: "Quy tắc sinh mã của danh mục chung",
    description:
      "Tự tạo mã cho mục mới của từng danh mục.",
    codeExample: "MA_LOAI_TB",
    nameExample: "Mã loại thiết bị",
  },

];

/** Mỗi danh mục kèm phần riêng của nó — bộ màn dùng chung đọc `config.extra`. */
export const CATALOGS: CatalogConfig[] = BASE.map((c) => ({ ...c, extra: CATALOG_EXTRAS[c.resource] }));
