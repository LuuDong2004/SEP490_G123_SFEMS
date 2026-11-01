import type { HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Control } from "react-hook-form";

import { OptionFilter } from "@/shared/components/data-table/ref-filter";
import { ReadField } from "@/shared/components/form/read-field";
import { Badge } from "@/shared/ui/badge";
import type { RoomType } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";
import { SwitchField } from "@/features/catalogs/switch-field";

function WarehouseBadge({ warehouse }: { warehouse: boolean }) {
  return warehouse ? <Badge variant="info">Kho</Badge> : <span className="text-muted-foreground">—</span>;
}

function RoomTypeFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <SwitchField
      control={control}
      name="warehouse"
      label="Là kho — thiết bị nhập về phòng loại này mang trạng thái Trong kho"
      className="sm:col-span-2"
    />
  );
}

function RoomTypeRead({ record }: { record: CatalogRecord }) {
  return (
    <ReadField label="Là kho">
      <WarehouseBadge warehouse={(record as RoomType).warehouse} />
    </ReadField>
  );
}

function RoomTypeFilters({ table }: { table: UseTableReturnType<CatalogRecord, HttpError> }) {
  return (
    <OptionFilter
      table={table}
      field="warehouse"
      all="Mọi loại phòng"
      options={[
        { value: "true", label: "Chỉ kho" },
        { value: "false", label: "Không phải kho" },
      ]}
    />
  );
}

export const roomTypeConfig: CatalogConfig = {
  resource: "room_types",
  noun: "loại phòng",
  description: "Loại phòng của trường: phòng học, phòng bộ môn, phòng thí nghiệm, kho…",
  codePlaceholder: "BOMON",
  namePlaceholder: "Phòng học bộ môn",
  extraKeys: ["warehouse"],
  extraDefaults: { warehouse: false },
  extraColumns: [
    {
      id: "warehouse",
      header: "Là kho",
      size: 110,
      enableSorting: false,
      cell: ({ row }) => <WarehouseBadge warehouse={(row.original as RoomType).warehouse} />,
    },
  ],
  ExtraFields: RoomTypeFields,
  ExtraRead: RoomTypeRead,
  ExtraFilters: RoomTypeFilters,
};
