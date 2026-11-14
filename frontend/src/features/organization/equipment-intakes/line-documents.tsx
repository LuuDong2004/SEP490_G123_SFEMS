import { useFormContext, useWatch, type Control } from "react-hook-form";

import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { ChoiceWithNote } from "@/shared/components/form/choice-with-note";
import { DateInput } from "@/shared/components/form/date-input";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { maxLengthOf, textRules } from "@/shared/lib/field-rules";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { FUNDING_LABELS, FUNDING_OPTIONS, OTHER_ACQUISITION_CODE } from "@/domains/equipment/types";
import { AcquisitionChoice } from "./acquisition-choice";
import { documentDateRules, documentNoRules, headFieldsOf } from "./head-fields";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Chứng từ RIÊNG của một dòng — trống là theo đầu phiếu. */
export const EMPTY_DOCUMENT = {
  supplier: null,
  documentNo: null,
  documentDate: null,
  fundingSource: null,
  fundingNote: null,
  acquisitionMethod: { id: null },
  acquisitionNote: null,
  warrantyMonths: null,
};

/**
 * "Hoá đơn riêng" của một dòng — chỉ khi dòng này mua theo hoá đơn khác hoá đơn ở đầu phiếu (phiếu cũ gom nhiều
 * hoá đơn, hoặc một lô giao bù). Các ô giống ô ở đầu phiếu, cùng luật; tệp hoá đơn của riêng dòng đính kèm ngay đây
 * khi dòng đã được lưu.
 */
export function LineOwnDocumentFields({ control, path, lineId }: { control: Control<any>; path: string; lineId?: number | null }) {
  const { setValue } = useFormContext();
  const { origins, ruleOf } = useOriginRules();
  const originId = useWatch({ control, name: "originSource.id" });
  const rule = ruleOf(originId);
  const code = origins.find((o) => String(o.id) === String(originId ?? ""))?.code;
  const head = headFieldsOf(code);
  const line = useWatch({ control, name: path }) as any;
  const name = (k: string) => `${path}.${k}`;
  const allowed = rule?.fundingSources ?? FUNDING_OPTIONS;
  const funding = line?.fundingSource as string | null | undefined;
  const fundingOptions = [
    ...(funding && !allowed.includes(funding) ? [{ value: funding, label: `${FUNDING_LABELS[funding] ?? funding} (không còn phù hợp)` }] : []),
    ...FUNDING_OPTIONS.filter((v) => allowed.includes(v)).map((v) => ({ value: v, label: FUNDING_LABELS[v] })),
  ];

  return (
    <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
      {head.supplier ? (
        <FormField
          control={control}
          name={name("supplier")}
          rules={textRules("SHORT_TEXT", head.supplier, { max: 200, min: 2 })}
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>{head.supplier}</FormLabel>
              <FormControl>
                <Input value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} onBlur={field.onBlur} name={field.name} ref={field.ref} maxLength={200} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      {head.documentNo ? (
        <FormField
          control={control}
          name={name("documentNo")}
          rules={documentNoRules(head)}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{head.documentNo!.label}</FormLabel>
              <FormControl>
                <Input value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} onBlur={field.onBlur} name={field.name} ref={field.ref}
                  maxLength={head.documentNo!.invoice ? maxLengthOf("INVOICE_NO") : 100} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      {head.documentDate ? (
        <FormField
          control={control}
          name={name("documentDate")}
          rules={documentDateRules(head.documentDate)}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{head.documentDate}</FormLabel>
              <FormControl>
                <DateInput className="max-w-none" value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      <FormField
        control={control}
        name={name("fundingNote")}
        rules={funding === "OTHER" ? textRules("SHORT_TEXT", "Ghi rõ nguồn kinh phí", { max: 200, min: 5 }) : undefined}
        render={({ field: note, fieldState }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Nguồn kinh phí</FormLabel>
            <ChoiceWithNote value={funding ?? ""} options={fundingOptions} otherValue="OTHER" disabled={!rule} clearable
              invalid={!!fieldState.error} placeholder="Theo phiếu" notePlaceholder="Nguồn khác: ghi rõ" noteMax={maxLengthOf("SHORT_TEXT", 200)}
              onChange={(v) => {
                setValue(name("fundingSource"), v || null, { shouldDirty: true });
                if (v !== "OTHER") setValue(name("fundingNote"), null, { shouldDirty: true });
              }}
              note={note.value} onNoteChange={note.onChange} onNoteBlur={note.onBlur} />
            <FormMessage />
          </FormItem>
        )}
      />
      {rule?.acquisitionMethod ? (
        <div className="sm:col-span-2">
          <AcquisitionChoice label="Hình thức mua sắm" clearable value={line?.acquisitionMethod?.id ? line.acquisitionMethod : null}
            onChange={(m) => {
              setValue(name("acquisitionMethod"), m ? { id: m.id, code: m.code, name: m.name } : { id: null }, { shouldDirty: true });
              if (m?.code !== OTHER_ACQUISITION_CODE) setValue(name("acquisitionNote"), null, { shouldDirty: true });
            }}
            note={line?.acquisitionNote} onNoteChange={(n) => setValue(name("acquisitionNote"), n, { shouldDirty: true })} />
        </div>
      ) : null}
      {lineId ? (
        <div className="sm:col-span-full">
          <AttachmentsPanel resource="equipment_intake_lines" title="Hoá đơn của dòng" recordId={lineId} canWrite compact
            description="Hoá đơn riêng của dòng này. Xem lại được ở từng thiết bị sau khi nhập." />
        </div>
      ) : null}
    </div>
  );
}
