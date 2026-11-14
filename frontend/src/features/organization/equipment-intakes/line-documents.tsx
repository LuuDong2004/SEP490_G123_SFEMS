import { useFormContext, useWatch, type Control } from "react-hook-form";

import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { PendingAttachments } from "@/shared/components/voucher/pending-attachments";
import { DateInput } from "@/shared/components/form/date-input";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { maxLengthOf, mergeRules, textRules } from "@/shared/lib/field-rules";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
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
export function LineOwnDocumentFields({ control, path, lineId, required }: { control: Control<any>; path: string; lineId?: number | null; required?: boolean }) {
  // Trong hộp "chứng từ riêng": bên giao, số, ngày bắt buộc — thiếu thì không nhận ra chứng từ nào.
  const need = (label: string) => (required ? { required: `Nhập ${label.charAt(0).toLowerCase()}${label.slice(1)}` } : {});
  const { setValue } = useFormContext();
  const { origins } = useOriginRules();
  const originId = useWatch({ control, name: "originSource.id" });
  const code = origins.find((o) => String(o.id) === String(originId ?? ""))?.code;
  const head = headFieldsOf(code);
  const line = useWatch({ control, name: path }) as any;
  const name = (k: string) => `${path}.${k}`;

  return (
    <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem]">
      {head.supplier ? (
        <FormField
          control={control}
          name={name("supplier")}
          rules={mergeRules(textRules("SHORT_TEXT", head.supplier, { max: 200, min: 2 }), need(head.supplier))}
          render={({ field }) => (
            <FormItem>
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
          rules={mergeRules(documentNoRules(head), need(head.documentNo.label))}
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
          rules={mergeRules(documentDateRules(head.documentDate), need(head.documentDate))}
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
      {lineId ? (
        <div className="sm:col-span-full">
          <AttachmentsPanel resource="equipment_intake_lines" title="Tệp đính kèm" recordId={lineId} canWrite compact
            description="Chứng từ riêng của thiết bị này. Xem lại được ở từng thiết bị sau khi nhập." />
        </div>
      ) : (
        <div className="sm:col-span-full">
          <PendingAttachments files={(line?.pendingFiles ?? []) as File[]} onChange={(f) => setValue(name("pendingFiles"), f, { shouldDirty: true })} />
        </div>
      )}
    </div>
  );
}
