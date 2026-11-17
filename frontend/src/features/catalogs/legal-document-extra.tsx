import type { Control } from "react-hook-form";

import { RefField } from "@/shared/components/catalog/ref-field";
import type { CatalogExtra } from "@/shared/components/catalog/types";
import { DateInput } from "@/shared/components/form/date-input";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { dateRules, mergeRules } from "@/shared/lib/field-rules";
import { formatPlainDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";

import { LegalDocDialog } from "./legal-doc-dialog";

/* eslint-disable @typescript-eslint/no-explicit-any */

function DateBox({ control, name, label, required, rule = "ANY", validate }: {
  control: Control<any>;
  name: string;
  label: string;
  required?: boolean;
  rule?: "ANY" | "PAST_OR_TODAY";
  validate?: (value: any, values: any) => true | string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={mergeRules(dateRules(rule, label, { required }), validate ? { validate } : undefined)}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Bản PDF của văn bản: ai sửa được văn bản thì thêm / xoá tệp ngay ở màn xem. */
function LegalDocumentFiles({ record }: { record: any }) {
  return (
    <AttachmentsPanel
      resource="legal_documents"
      recordId={record?.id}
      canWrite={record?._can?.write === true}
      section
      title="Bản văn bản"
      description="PDF hoặc Word, tối đa 20 MB."
    />
  );
}

const effectiveBadge = (r: any) =>
  r?.effective ? <Badge variant="success">Đang hiệu lực</Badge> : <Badge variant="neutral">Hết hiệu lực</Badge>;

export const LEGAL_DOCUMENT_EXTRA: CatalogExtra = {
  section: { title: "Ban hành và hiệu lực" },
  // Chỉ thông tư của Bộ về thiết bị và cơ sở vật chất (trưởng nhóm 17/11/2026): loại và cơ quan ban hành cố định, không hỏi.
  defaults: { docType: "THONG_TU", issuer: "Bộ Giáo dục và Đào tạo", issuedOn: null, effectiveFrom: null, effectiveTo: null, replaces: { id: null } },
  Fields: ({ control, record }) => (
    <div className="grid items-start gap-x-4 gap-y-5">
      <div className="grid grid-cols-[repeat(2,minmax(0,10rem))] items-start gap-x-4">
        <DateBox control={control} name="issuedOn" label="Ngày ban hành" rule="PAST_OR_TODAY" required />
        <DateBox control={control} name="effectiveFrom" label="Ngày có hiệu lực" required
          validate={(v, values) => !v || !values?.issuedOn || String(v) >= String(values.issuedOn)
            || "Không được trước ngày ban hành"} />
      </div>
      <RefField control={control} name="replaces" resource="legal_documents" label="Thay thế thông tư" placeholder="Không thay thế"
        labelField="code" current={record?.replaces} className="max-w-[22rem]"
        validate={(v: any) => !v?.id || v.id !== record?.id || "Văn bản không thay thế chính nó"} />
    </div>
  ),
  columns: [
    {
      id: "issuedOn",
      accessorKey: "issuedOn",
      header: "Ngày ban hành",
      size: 175,
      meta: { fixed: true },
      enableSorting: true,
      cell: ({ getValue }) => formatPlainDate(getValue() as string),
    },
    { id: "effective", header: "Hiệu lực", size: 150, meta: { fixed: true }, enableSorting: false, cell: ({ row }) => effectiveBadge(row.original) },
  ],
  show: (r) => [
    { label: "Ngày ban hành", value: formatPlainDate(r?.issuedOn) },
    { label: "Ngày có hiệu lực", value: formatPlainDate(r?.effectiveFrom) },
    { label: "Thay thế thông tư", value: r?.replaces?.code ?? "—" },
    { label: "Hiệu lực", value: effectiveBadge(r) },
  ],
  // Thêm / Xem / Sửa cùng một hộp, tệp thông tư bắt buộc (trưởng nhóm 17/11/2026).
  RecordDialog: LegalDocDialog,
  // Chỉ cần cột Hiệu lực — cờ Đang hoạt động không có nghĩa với văn bản (trưởng nhóm 17/11/2026).
  hideActive: true,
  // Giãn cách: số hiệu, ngày, hiệu lực rộng vừa chữ; phần dư cho trích yếu.
  codeSize: 190,
  codeFixed: true,
  ShowBelow: LegalDocumentFiles,
  ShowTabs: [{ key: "files", label: "Bản văn bản", Content: LegalDocumentFiles }],
};
