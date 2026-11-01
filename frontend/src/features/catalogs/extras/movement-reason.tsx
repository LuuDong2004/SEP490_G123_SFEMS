import type { HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Control } from "react-hook-form";

import { OptionFilter } from "@/shared/components/data-table/ref-filter";
import { ReadField } from "@/shared/components/form/read-field";
import { SelectField } from "@/shared/components/form/simple-fields";
import { Badge } from "@/shared/ui/badge";
import {
  MOVEMENT_DIRECTION_LABELS,
  MOVEMENT_DIRECTION_OPTIONS,
  type MovementDirection,
  type MovementReason,
} from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";

function DirectionBadge({ direction }: { direction: MovementDirection }) {
  return (
    <Badge variant={direction === "increase" ? "success" : "warning"}>{MOVEMENT_DIRECTION_LABELS[direction]}</Badge>
  );
}

function MovementReasonFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <SelectField
      control={control}
      name="direction"
      label="Chiều biến động"
      options={MOVEMENT_DIRECTION_OPTIONS}
      rules={{ required: "Chọn tăng hay giảm" }}
      description="Phiếu nhập chỉ cho chọn lý do tăng."
    />
  );
}

function MovementReasonRead({ record }: { record: CatalogRecord }) {
  return (
    <ReadField label="Chiều biến động">
      <DirectionBadge direction={(record as MovementReason).direction} />
    </ReadField>
  );
}

function MovementReasonFilters({ table }: { table: UseTableReturnType<CatalogRecord, HttpError> }) {
  return (
    <OptionFilter table={table} field="direction" all="Tăng và giảm" options={MOVEMENT_DIRECTION_OPTIONS} />
  );
}

export const movementReasonConfig: CatalogConfig = {
  resource: "movement_reasons",
  noun: "lý do biến động",
  description: "Lý do tài sản tăng hoặc giảm: mua mới, được cấp, thừa hoặc mất khi kiểm kê…",
  codePlaceholder: "MUAMOI",
  namePlaceholder: "Mua mới",
  extraKeys: ["direction"],
  extraDefaults: { direction: "increase" },
  extraColumns: [
    {
      id: "direction",
      header: "Chiều",
      size: 100,
      enableSorting: false,
      cell: ({ row }) => <DirectionBadge direction={(row.original as MovementReason).direction} />,
    },
  ],
  ExtraFields: MovementReasonFields,
  ExtraRead: MovementReasonRead,
  ExtraFilters: MovementReasonFilters,
};
