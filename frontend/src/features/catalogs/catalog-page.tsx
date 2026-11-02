import { useResourceParams } from "@refinedev/core";

import type { CatalogConfig } from "@/features/catalogs/catalog-config";
import { CatalogFormDialog } from "@/features/catalogs/catalog-form-dialog";
import { CatalogList } from "@/features/catalogs/catalog-list";
import { CatalogShowDialog } from "@/features/catalogs/catalog-show-dialog";

/**
 * Màn của một danh mục. Cùng một component cho cả bốn đường dẫn list / create / edit / show: danh
 * sách luôn nằm dưới, còn hộp thoại thêm, sửa, xem mở đè lên theo đường dẫn hiện tại (Báo cáo 3,
 * màn số 8: "danh sách, hộp thoại thêm, sửa, xem").
 */
export function CatalogPage({ config }: { config: CatalogConfig }) {
  const { action, id } = useResourceParams();

  return (
    <>
      <CatalogList config={config} />
      {action === "create" || action === "edit" ? (
        <CatalogFormDialog key={`${action}-${id ?? ""}`} config={config} action={action} id={id} />
      ) : null}
      {action === "show" ? <CatalogShowDialog key={`show-${id}`} config={config} id={id} /> : null}
    </>
  );
}
