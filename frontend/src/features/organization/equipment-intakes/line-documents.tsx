import { FormHint } from "@/shared/components/form/help-hint";
import { AcquisitionChoice } from "./acquisition-choice";
import { Copy, CopyCheck } from "lucide-react";
import { useState } from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { DateInput } from "@/shared/components/form/date-input";
import { Button } from "@/shared/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { dateRules, maxLengthOf, numberRules, textRules, type NumberRule, type TextRule } from "@/shared/lib/field-rules";
import { Input } from "@/shared/ui/input";
import { FundingSelect } from "@/shared/components/form/funding-select";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { FUNDING_LABELS, fundingRequired, OTHER_ACQUISITION_CODE } from "@/domains/equipment/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Chứng từ và nguồn của MỘT dòng hàng — mỗi dòng mang của riêng nó. */
export const DOCUMENT_KEYS = [
  "supplier",
  "documentNo",
  "documentDate",
  "fundingSource",
  "fundingNote",
  "acquisitionMethod",
  "acquisitionNote",
  "warrantyMonths",
] as const;

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

/** Chép chứng từ của một dòng (để dòng mới khỏi gõ lại nhà cung cấp, hoá đơn, nguồn…). */
export function documentOf(line: any): Record<string, unknown> {
  const out: Record<string, unknown> = { ...EMPTY_DOCUMENT };
  for (const k of DOCUMENT_KEYS) {
    const v = line?.[k];
    if (v != null) out[k] = v && typeof v === "object" ? { id: v.id ?? null, name: v.name } : v;
  }
  return out;
}

/**
 * "Chứng từ & nguồn" của một dòng hàng — các ô nhập, vẽ trong hộp chi tiết dòng.
 *
 * <p>NGUỒN HÌNH THÀNH là của cả phiếu (ô ở đầu phiếu) và quyết định các ô nguồn ở đây. Phần còn lại
 * của chứng từ đi theo HÀNG, không theo phiếu: một phiếu nhập có thể gom hàng của nhiều nhà cung
 * cấp, nhiều hoá đơn, nhiều nguồn kinh phí, bảo hành khác nhau — và tài sản sinh ra mang chứng từ
 * của đúng dòng đã sinh ra nó. Tệp hoá đơn cũng gắn theo dòng (`equipment_intake_lines`), nên hồ sơ
 * tài sản mở ra là thấy hoá đơn của chính nó. Dòng mới tự chép chứng từ của dòng ngay trên.
 */
export function LineDocumentFields({ control, base, index }: { control: Control<any>; base: string; index: number }) {
  const { setValue, getValues } = useFormContext();
  const line = useWatch({ control, name: `${base}.${index}` });
  const name = (k: string) => `${base}.${index}.${k}`;
  const count = (getValues(base) ?? []).length;
  const [applied, setApplied] = useState(false);
  // Nguồn hình thành của PHIẾU quyết định dòng chọn được nguồn kinh phí nào, có bắt buộc không, và có
  // hình thức mua sắm không — luật đọc từ máy chủ.
  const originId = useWatch({ control, name: "originSource.id" });
  const { ruleOf } = useOriginRules();
  const rule = ruleOf(originId);
  // Phiếu đã có nguồn kinh phí thì dòng để trống là theo phiếu — ô của dòng chỉ để khai KHÁC.
  const headFunding = useWatch({ control, name: "fundingSource" }) as string | null | undefined;
  const headAcquisitionName = (useWatch({ control, name: "acquisitionMethod" }) as { id?: number | null; name?: string } | undefined)?.id
    ? (getValues("acquisitionMethod")?.name ?? "đã chọn ở đầu phiếu")
    : undefined;
  const needFunding = !headFunding && fundingRequired(rule, line?.unitPrice);

  return (
    <div className="space-y-4">
      {/* Tên nhóm và hai nút chép nằm chung một hàng: nút chép là thao tác của cả nhóm, và để riêng một
          hàng dưới cùng thì hộp dài thêm đúng một nếp cuộn. */}
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h4 className="text-overline text-muted-foreground">Chứng từ và nguồn</h4>
        {count > 1 ? (
          <div className="flex flex-wrap items-center gap-1">
            {index > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => {
                  const above = documentOf(getValues(`${base}.${index - 1}`));
                  for (const [k, v] of Object.entries(above)) setValue(name(k), v, { shouldDirty: true });
                }}
              >
                <Copy />
                Chép từ dòng trên
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              title="Chép chứng từ của dòng này sang mọi dòng khác trong phiếu"
              onClick={() => {
                const mine = documentOf(getValues(`${base}.${index}`));
                for (let i = 0; i < count; i++) {
                  if (i === index) continue;
                  for (const [k, v] of Object.entries(mine)) setValue(`${base}.${i}.${k}`, v, { shouldDirty: true });
                }
                setApplied(true);
              }}
            >
              <CopyCheck />
              {applied ? `Đã áp cho ${count - 1} dòng khác` : "Áp cho mọi dòng"}
            </Button>
          </div>
        ) : null}
      </div>
      {/* Lưới 12 cột: hàng chứng từ (ai bán, hoá đơn nào, ngày nào, bảo hành), hàng hàng hoá
          (model, hãng — của lô này chứ không của cả nhóm), rồi các ô chọn nguồn chia đều. */}
      <div className="grid items-start gap-x-4 gap-y-4 sm:grid-cols-12">
        <TextCell control={control} name={name("supplier")} label="Nhà cung cấp" rule="SHORT_TEXT" className="sm:col-span-4" hint="Đơn vị bán, cấp hoặc tài trợ" placeholder="Tên đơn vị bán / tài trợ" />
        <TextCell control={control} name={name("documentNo")} label="Số hoá đơn / hợp đồng" rule="SHORT_TEXT" max={100} className="sm:col-span-3" placeholder="VD: HD-2026/145" />
        <FormField
          control={control}
          name={name("documentDate")}
          rules={dateRules("PAST_OR_TODAY", "Ngày hoá đơn")}
          render={({ field }) => (
            <FormItem className="sm:col-span-3">
              <FormLabel className="text-xs">Ngày hoá đơn</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <TextCell control={control} name={name("warrantyMonths")} label="Bảo hành (tháng)" className="sm:col-span-2" number numberRule="COUNT" hint="Số tháng bảo hành của hàng trên dòng này." placeholder="VD: 24" />
        <TextCell control={control} name={name("model")} label="Model" rule="SHORT_TEXT" className="sm:col-span-3" hint="Mẫu của lô hàng này — khác nhau giữa các lần mua." placeholder="VD: VN-320X" />
        <TextCell control={control} name={name("manufacturer")} label="Hãng sản xuất" rule="SHORT_TEXT" className="sm:col-span-3" placeholder="VD: Panasonic" />
        <FormField
          control={control}
          name={name("fundingSource")}
          render={({ field }) => (
            <FormItem className="sm:col-span-3">
              <FormLabel className="text-xs" required={needFunding || undefined}>
                {headFunding ? "Nguồn kinh phí riêng" : "Nguồn kinh phí"}
              </FormLabel>
              <FormHint>
                {!rule
                  ? "Chọn nguồn hình thành ở đầu phiếu trước: nguồn kinh phí chọn được đi theo nó."
                  : headFunding
                    ? `Để trống là theo phiếu (${FUNDING_LABELS[headFunding] ?? headFunding}). Chỉ chọn khi dòng này dùng nguồn khác.`
                    : needFunding
                    ? `Với nguồn hình thành "${rule.name}" chỉ chọn được các nguồn bên dưới.`
                    : `Không bắt buộc với nguồn hình thành "${rule.name}". Để trống thì ghi là "Chưa xác định nguồn".`}
              </FormHint>
              <FundingSelect
                value={field.value}
                onChange={field.onChange}
                allowed={rule?.fundingSources}
                disabled={!rule}
                placeholder={!rule ? "Chọn nguồn hình thành trước" : headFunding ? `Theo phiếu: ${FUNDING_LABELS[headFunding] ?? headFunding}` : needFunding ? "Vui lòng chọn nguồn kinh phí" : "Chưa xác định nguồn"}
                clearable={!needFunding}
              />
            </FormItem>
          )}
        />
        {/* Chỉ hàng MUA mới có hình thức mua sắm (tập trung, đấu thầu, chỉ định thầu, mua trực tiếp, khác). */}
        {rule?.acquisitionMethod ? (
          <div className="sm:col-span-3">
            {/* Giữ mã bên cạnh id: "Khác" là mục duy nhất phải ghi rõ — ghi ngay trong ô. */}
            <AcquisitionChoice label={headAcquisitionName ? "Hình thức mua sắm riêng" : "Hình thức mua sắm"}
              hint={headAcquisitionName ? `Để trống là theo phiếu (${headAcquisitionName})` : undefined}
              value={line?.acquisitionMethod} clearable
              onChange={(m) => {
                setValue(name("acquisitionMethod"), m ? { id: m.id, code: m.code, name: m.name } : { id: null }, { shouldDirty: true });
                if (m?.code !== OTHER_ACQUISITION_CODE) setValue(name("acquisitionNote"), null, { shouldDirty: true });
              }}
              note={line?.acquisitionNote} onNoteChange={(n) => setValue(name("acquisitionNote"), n, { shouldDirty: true })} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TextCell({ control, name, label, placeholder, number, hint, className, rule, max, numberRule }: {
  control: Control<any>;
  name: string;
  label: string;
  className?: string;
  placeholder?: string;
  number?: boolean;
  hint?: string;
  rule?: TextRule;
  max?: number;
  numberRule?: NumberRule;
}) {
  // Nhãn trong câu báo lỗi là nhãn trên ô, bỏ dấu * vẽ tay.
  const ruleLabel = label.replace(/\s*\*$/, "");
  return (
    <FormField
      control={control}
      name={name}
      rules={rule ? textRules(rule, ruleLabel, { max }) : numberRule ? numberRules(numberRule, ruleLabel) : undefined}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="text-xs">{label}</FormLabel>
          {hint ? <FormHint>{hint}</FormHint> : null}
          <FormControl>
            <Input
              type={number ? "number" : "text"}
              value={field.value ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                field.onChange(v === "" ? null : number ? Number(v) : v);
              }}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder={placeholder}
              maxLength={rule ? maxLengthOf(rule, max) : undefined}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
