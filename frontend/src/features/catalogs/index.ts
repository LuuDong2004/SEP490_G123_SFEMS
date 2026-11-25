/** Danh mục dùng chung: registry cho app/, màn Cấp học viết riêng, danh mục cố định chỉ đọc. */
import { lazyNamed } from "@/shared/lib/lazy-named";

export { CATALOGS } from "./registry";
export { ENUM_CATALOGS } from "./enum-registry";

// Màn hình: tải khi mở tới (mỗi thư mục một chunk) — xem `lazyNamed`.
export const EducationLevelList = lazyNamed(() => import("./education-levels/list"), "EducationLevelList");
export const EducationLevelCreate = lazyNamed(() => import("./education-levels/create"), "EducationLevelCreate");
export const EducationLevelEdit = lazyNamed(() => import("./education-levels/edit"), "EducationLevelEdit");
export const EducationLevelShow = lazyNamed(() => import("./education-levels/show"), "EducationLevelShow");
export const EnumCatalogList = lazyNamed(() => import("./enum-catalog-list"), "EnumCatalogList");
