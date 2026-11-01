import type { Control } from "react-hook-form";

import { DateField } from "@/shared/components/form/simple-fields";
import { ReadField } from "@/shared/components/form/read-field";
import { formatPlainDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import type { SchoolYear } from "@/domains/catalog/types";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";
import { SwitchField } from "@/features/catalogs/switch-field";

function CurrentBadge({ current }: { current: boolean }) {
  return current ? <Badge variant="success">Hiện hành</Badge> : null;
}

function SchoolYearFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <>
      <DateField control={control} name="startDate" label="Ngày bắt đầu" rules={{ required: "Chọn ngày bắt đầu" }} />
      <DateField control={control} name="endDate" label="Ngày kết thúc" rules={{ required: "Chọn ngày kết thúc" }} />
      <SwitchField
        control={control}
        name="current"
        label="Năm học hiện hành — năm học hiện hành cũ sẽ tự bỏ đánh dấu"
        className="sm:col-span-2"
      />
    </>
  );
}

function SchoolYearRead({ record }: { record: CatalogRecord }) {
  const year = record as SchoolYear;
  return (
    <>
      <ReadField label="Ngày bắt đầu">{formatPlainDate(year.startDate)}</ReadField>
      <ReadField label="Ngày kết thúc">{formatPlainDate(year.endDate)}</ReadField>
      <ReadField label="Hiện hành">{year.current ? <CurrentBadge current /> : "Không"}</ReadField>
    </>
  );
}

export const schoolYearConfig: CatalogConfig = {
  resource: "school_years",
  noun: "năm học",
  description: "Năm học và khoảng ngày của nó; một năm học được đánh dấu là hiện hành.",
  codePlaceholder: "2026-2027",
  namePlaceholder: "Năm học 2026-2027",
  extraKeys: ["startDate", "endDate", "current"],
  extraDefaults: { startDate: null, endDate: null, current: false },
  extraColumns: [
    {
      id: "startDate",
      header: "Bắt đầu",
      size: 120,
      enableSorting: false,
      cell: ({ row }) => formatPlainDate((row.original as SchoolYear).startDate),
    },
    {
      id: "endDate",
      header: "Kết thúc",
      size: 120,
      enableSorting: false,
      cell: ({ row }) => formatPlainDate((row.original as SchoolYear).endDate),
    },
    {
      id: "current",
      header: "Hiện hành",
      size: 120,
      enableSorting: false,
      cell: ({ row }) => <CurrentBadge current={(row.original as SchoolYear).current} />,
    },
  ],
  ExtraFields: SchoolYearFields,
  ExtraRead: SchoolYearRead,
};
