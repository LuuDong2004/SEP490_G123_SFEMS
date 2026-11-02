import { CATALOG_CONFIGS, type CatalogResource } from "@/features/catalogs/catalog-configs";
import { CatalogPage } from "@/features/catalogs/catalog-page";

/**
 * Bốn màn list / create / edit / show của một danh mục, để truyền thẳng vào `crudRoutes(...)`.
 * Cả bốn là cùng một `CatalogPage`: danh sách giữ nguyên, chỉ hộp thoại đổi theo đường dẫn.
 */
export function catalogScreens(resource: CatalogResource) {
  const page = <CatalogPage config={CATALOG_CONFIGS[resource]} />;
  return { list: page, create: page, edit: page, show: page };
}
