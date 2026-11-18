import type { ColumnDef } from "@tanstack/react-table";
import type { Control } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { CatalogExtra } from "@/shared/components/catalog/types";
import { RefField } from "@/shared/components/catalog/ref-field";
import { SelectField, TextField } from "@/shared/components/form/simple-fields";
import { Badge } from "@/shared/ui/badge";
import { FacilityStandardRulesPage } from "@/features/catalogs/facility-standard-list";
import { FACILITY_LEVELS } from "@/domains/facility/catalog";
import {
  ruleSummary,
  STANDARD_TIER_LABELS,
  STANDARD_TIERS,
  type FacilityStandardRule,
  type StandardTier,
} from "@/domains/facility/standard";

/* eslint-disable @typescript-eslint/no-explicit-any */

const levelName = (code: string | null | undefined) => FACILITY_LEVELS.find((l) => l.code === code)?.name ?? "—";

function RuleFields({ control, record }: { control: Control<any>; record?: FacilityStandardRule }) {
  const level = useWatch({ control, name: "levelCode" }) as string | undefined;
  return (
    <div className="contents">
      <SelectField control={control} name="levelCode" label="Cấp học" placeholder="Vui lòng chọn cấp học"
        rules={{ required: "Vui lòng chọn cấp học" }}
        options={FACILITY_LEVELS.map((l) => ({ value: l.code, label: l.name }))} />
      <SelectField control={control} name="tier" label="Mức" placeholder="Vui lòng chọn mức"
        rules={{ required: "Vui lòng chọn mức" }}
        options={STANDARD_TIERS.map((t) => ({ value: t.key, label: t.label }))} />
      <RefField control={control} name="roomType" resource="room_types" label="Loại CSVC" required className="col-span-2"
        current={record?.roomType ?? undefined}
        disabledHint={level ? undefined : "Chọn cấp học trước"}
        filters={[{ field: "standard", operator: "eq", value: true }, ...(level ? [{ field: "level", operator: "eq" as const, value: level }] : [])]} />
      <TextField control={control} name="minCount" label="Số phòng tối thiểu" type="number" numberRule="COUNT"
        description="Có ít nhất N phòng / hạng mục." />
      <TextField control={control} name="countPerClass" label="Số phòng mỗi lớp" type="number" step="any"
        numberRule="DECIMAL_QUANTITY" description="Số phòng ≥ số lớp × tỷ lệ, làm tròn lên." />
      <TextField control={control} name="minRoomArea" label="Diện tích mỗi phòng (m²)" type="number" step="any"
        numberRule="DECIMAL_QUANTITY" description="Mỗi phòng không nhỏ hơn." />
      <TextField control={control} name="areaPerStudent" label="Diện tích mỗi học sinh (m²)" type="number" step="any"
        numberRule="DECIMAL_QUANTITY" description="Tổng diện tích ≥ số học sinh × số này." />
      <TextField control={control} name="minTotalArea" label="Tổng diện tích tối thiểu (m²)" type="number" step="any"
        numberRule="DECIMAL_QUANTITY" description="Tổng diện tích các phòng không nhỏ hơn." />
      <TextField control={control} name="legalBasis" label="Văn bản căn cứ" rule="SHORT_TEXT" className="col-span-2"
        placeholder="TT 13/2020/TT-BGDĐT" />
    </div>
  );
}

const TIER_VARIANTS: Record<StandardTier, "neutral" | "info" | "success"> = {
  MIN: "neutral",
  LEVEL1: "info",
  LEVEL2: "success",
};

/**
 * Chuẩn CSVC (203): Sở khai quy tắc cho từng loại CSVC × cấp × mức. Mã và tên do máy chủ sinh (loại · cấp ·
 * mức), nên form không có ô Mã / Tên. Ít nhất một điều kiện; điều kiện để trống là không xét.
 */
export const FACILITY_STANDARD_EXTRA: CatalogExtra = {
  // Màn danh sách riêng: theo cấp học, chia khối, lọc khối / mức, sắp theo cột (như Danh mục thiết bị tối thiểu).
  ListPage: FacilityStandardRulesPage,
  section: { title: "Quy tắc", inline: true },
  codeSize: 200,
  defaults: {
    roomType: { id: null },
    levelCode: "",
    tier: "",
    minCount: null,
    countPerClass: null,
    minRoomArea: null,
    areaPerStudent: null,
    minTotalArea: null,
    legalBasis: "TT 13/2020/TT-BGDĐT, sửa đổi bởi TT 23/2024/TT-BGDĐT",
  },
  Fields: ({ control, record }) => <RuleFields control={control} record={record} />,
  nameColumn: {
    header: "Loại CSVC",
    subline: (r: FacilityStandardRule) => r.roomType?.groupName
      ? <span className="text-muted-foreground line-clamp-1 text-xs">{r.roomType.groupName}</span>
      : null,
  },
  columns: [
    {
      id: "levelCode",
      header: "Cấp",
      enableSorting: false,
      size: 110,
      cell: ({ row }) => <span className="text-sm whitespace-nowrap">{levelName(row.original.levelCode)}</span>,
    },
    {
      id: "tier",
      header: "Mức",
      enableSorting: false,
      size: 120,
      cell: ({ row }) => (
        <Badge variant={TIER_VARIANTS[row.original.tier as StandardTier] ?? "neutral"} className="whitespace-nowrap">
          {STANDARD_TIER_LABELS[row.original.tier as StandardTier] ?? row.original.tier}
        </Badge>
      ),
    },
    {
      id: "conditions",
      header: "Điều kiện",
      enableSorting: false,
      meta: { fill: true },
      cell: ({ row }) => <span className="text-sm whitespace-normal">{ruleSummary(row.original)}</span>,
    },
  ] as ColumnDef<any, any>[],
  show: (r: FacilityStandardRule) => [
    { label: "Loại CSVC", value: r?.roomType?.name ?? "—", span: 2 },
    { label: "Khối", value: r?.roomType?.groupName ?? "—", span: 2 },
    { label: "Cấp học", value: levelName(r?.levelCode) },
    { label: "Mức", value: r?.tier ? STANDARD_TIER_LABELS[r.tier] : "—" },
    { label: "Điều kiện", value: ruleSummary(r), span: 2 },
    { label: "Văn bản căn cứ", value: r?.legalBasis ?? "—", span: 4 },
  ],
};
