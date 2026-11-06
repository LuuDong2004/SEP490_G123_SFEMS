import { useShow } from "@refinedev/core";

import { EditButton } from "@/shared/components/buttons/edit";
import { ReadField } from "@/shared/components/form/read-field";
import { RouteDialog } from "@/shared/components/views/route-dialog";
import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { formatDateTime } from "@/shared/lib/format";
import type { CatalogConfig, CatalogRecord } from "@/features/catalogs/catalog-config";
import { ActiveBadge } from "@/features/catalogs/active-badge";

/** Hộp thoại xem một mục danh mục: cùng bố cục với hộp thoại sửa, có nút chuyển sang sửa. */
export function CatalogShowDialog({ config, id }: { config: CatalogConfig; id?: string | number }) {
  const { query } = useShow<CatalogRecord>({ resource: config.resource, id });
  const record = query.data?.data;
  const { ExtraRead } = config;
  const title = `Chi tiết ${config.noun}`;

  if (isRecordMissing(query)) {
    return (
      <RouteDialog title={title} description={config.description}>
        <RecordNotFound what={config.noun} />
      </RouteDialog>
    );
  }

  return (
    <RouteDialog
      title={title}
      description={config.description}
      footer={record && (!config.canModify || config.canModify(record)) ? <EditButton recordItemId={record.id}>Sửa</EditButton> : null}
    >
      {record ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <ReadField label={config.codeLabel ?? "Mã"}>
            <span className="font-mono">{record.code}</span>
          </ReadField>
          <ReadField label="Tên">{record.name}</ReadField>

          {ExtraRead ? <ExtraRead record={record} /> : null}

          <ReadField label="Ghi chú" className="sm:col-span-2">
            {record.note || undefined}
          </ReadField>
          {!config.hideActive ? <ReadField label="Trạng thái">
            <ActiveBadge active={record.active} />
          </ReadField> : null}
          <ReadField label="Cập nhật lần cuối">{formatDateTime(record.updatedAt ?? record.createdAt)}</ReadField>
        </div>
      ) : null}
    </RouteDialog>
  );
}
