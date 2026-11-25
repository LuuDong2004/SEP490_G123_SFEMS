import type { ColumnDef } from "@tanstack/react-table";
import type { Control } from "react-hook-form";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { CatalogExtra } from "@/shared/components/catalog/types";
import { MultiRefSelectField } from "@/shared/components/catalog/multi-ref-select";
import { RefField } from "@/shared/components/catalog/ref-field";
import { SelectField, TextField } from "@/shared/components/form/simple-fields";
import { Badge } from "@/shared/ui/badge";
import { FacilityStandardRulesPage } from "@/features/catalogs/facility-standard-list";
import { SwitchField, useFacilityLevels } from "@/features/catalogs/facility-catalog-extra";
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
  // Một cấp học: tự điền, không hỏi (xem `useFacilityLevels`).
  const levels = useFacilityLevels();
  const single = levels.length === 1 ? levels[0].code : null;
  const { setValue } = useFormContext();
  useEffect(() => {
    if (single && !level) setValue("levelCode", single, { shouldDirty: true });
  }, [single, level, setValue]);
  return (
    <div className="contents">
      {single && (!level || level === single) ? null : (
        <SelectField control={control} name="levelCode" label="Cấp học" placeholder="Vui lòng chọn cấp học"
          rules={{ required: "Vui lòng chọn cấp học" }}
          options={levels.map((l) => ({ value: l.code, label: l.name }))} />
      )}
      <SelectField control={control} name="tier" label="Mức" placeholder="Vui lòng chọn mức"
        rules={{ required: "Vui lòng chọn mức" }}
        options={STANDARD_TIERS.map((t) => ({ value: t.key, label: t.label }))} />
      <RefField control={control} name="roomType" resource="room_types" label="Loại CSVC" required className="col-span-2"
        current={record?.roomType ?? undefined}
        disabledHint={level ? undefined : "Chọn cấp học trước"}
        filters={[{ field: "standard", operator: "eq", value: true }, ...(level ? [{ field: "level", operator: "eq" as const, value: level }] : [])]} />
      <TextField control={control} name="minCount" label="Số phòng tối thiểu" type="number" numberRule="COUNT"
        description="Có ít nhất N phòng / hạng mục." />
      <TextField control={control} name="countPerClass" label="Số phòng theo số lớp" type="number" step="any"
        numberRule="DECIMAL_QUANTITY" description="Số phòng cho mỗi lớp. Ví dụ 0,1 là 1 phòng/10 lớp, 0,6 là 3 phòng/5 lớp." />
      <TextField control={control} name="minRoomArea" label="Diện tích mỗi phòng (m²)" type="number" step="any"
        numberRule="DECIMAL_QUANTITY" description="Mỗi phòng không nhỏ hơn." />
      <TextField control={control} name="areaPerStudent" label="Diện tích theo số học sinh (m²)" type="number" step="any"
        numberRule="DECIMAL_QUANTITY" description="Số m² cho mỗi học sinh. Ví dụ 1,5: trường 1200 học sinh cần 1800 m²." />
      <TextField control={control} name="studentPercent" label="Tính trên phần trăm học sinh (%)" type="number" step="any"
        numberRule="PERCENT" description="Để trống là mọi học sinh. Thư viện tính từ 30% học sinh." />
      <TextField control={control} name="minTotalArea" label="Tổng diện tích tối thiểu (m²)" type="number" step="any"
        numberRule="DECIMAL_QUANTITY" description="Tổng diện tích các phòng không nhỏ hơn." />
      <TextField control={control} name="largeClassFrom" label="Trường lớn: trên bao nhiêu lớp" type="number" numberRule="COUNT"
        description="Ví dụ 30: trường trên 30 lớp phải có nhiều phòng hơn." />
      <TextField control={control} name="largeMinCount" label="Số phòng của trường lớn" type="number" numberRule="COUNT"
        description="Số phòng tối thiểu của trường lớn." />
      <SwitchField control={control} name="onlyIfPresent" title="Chỉ xét khi trường có loại phòng này"
        description="Dùng cho kho bếp, phòng nội trú: trường không có thì bỏ qua." />
      <MultiRefSelectField control={control} name="legalDocuments" resource="legal_documents" label="Văn bản căn cứ" className="col-span-2" />
      <TextField control={control} name="legalBasis" label="Điều, khoản" rule="SHORT_TEXT" className="col-span-2"
        placeholder="VD: Khoản 4 Điều 18" />
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
    largeClassFrom: null,
    largeMinCount: null,
    studentPercent: null,
    onlyIfPresent: false,
    legalDocuments: [],
    legalBasis: "",
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
    { label: "Văn bản căn cứ", value: (r?.legalDocuments ?? []).map((d) => d.code).join(", ") || "—", span: 2 },
    { label: "Điều, khoản", value: r?.legalBasis ?? "—", span: 2 },
  ],
};
