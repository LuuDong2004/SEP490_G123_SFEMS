import type { Control } from "react-hook-form";

import { ReadField } from "@/shared/components/form/read-field";
import { Badge } from "@/shared/ui/badge";
import type { Unit } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";
import { SwitchField } from "@/features/catalogs/switch-field";

// Số lẻ chỉ có nghĩa với đơn vị chia được (kg, g, lít, ml, mét): 0,25 kg hoá chất thì có, 0,5 cái máy
// tính thì không. Máy chủ từ chối số lẻ khi cờ này tắt.
function UnitFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <SwitchField
      control={control}
      name="allowsFraction"
      label="Cho phép số lẻ"
      description="Bật cho kg, g, lít, ml, mét. Cái, chiếc, bộ, bình… để tắt."
      className="sm:col-span-2"
    />
  );
}

function UnitRead({ record }: { record: CatalogRecord }) {
  return (
    <ReadField label="Cho phép số lẻ" className="sm:col-span-2">
      {(record as Unit).allowsFraction ? "Có, đơn vị chia được" : "Không"}
    </ReadField>
  );
}

export const unitConfig: CatalogConfig = {
  resource: "units",
  noun: "đơn vị tính",
  description: "Đơn vị đếm thiết bị và vật tư.",
  codePlaceholder: "BO",
  namePlaceholder: "Bộ",
  extraKeys: ["allowsFraction"],
  extraDefaults: { allowsFraction: false },
  extraColumns: [
    {
      id: "allowsFraction",
      header: "Số lẻ",
      size: 110,
      enableSorting: false,
      cell: ({ row }) =>
        (row.original as Unit).allowsFraction ? (
          <Badge variant="success">Cho phép</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ],
  ExtraFields: UnitFields,
  ExtraRead: UnitRead,
};
