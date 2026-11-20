import { useOne } from "@refinedev/core";
import { Lock, Plus, Trash2 } from "lucide-react";
import { useFieldArray, useWatch, type Control, type UseFormGetValues } from "react-hook-form";

import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { DateField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { formatPlainDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { DOCUMENT_ROLE_LABELS } from "@/domains/equipment-standard/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Văn bản thêm vào bộ nháp chỉ là hướng dẫn hoặc tham khảo — căn cứ chính và văn bản lần sửa đã có. */
const ADDED_ROLES = ["guidance", "reference"] as const;

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

/**
 * Thân form SỬA BỘ NHÁP lập từ "Lập bộ mới" (trưởng nhóm 16/11/2026: chỉ văn bản):
 * - Không dải "Phiên bản / Thay cho bộ" (trưởng nhóm 16/11/2026: khó hiểu) — cấp học ở tiêu đề, danh sách văn bản dưới
 *   đã nói bộ gồm những thông tư nào. Tên bộ, năm học áp dụng, ghi chú không có: năm học ghi lúc bấm Áp dụng.
 * - Văn bản căn cứ: văn bản chép từ bộ cũ chỉ xem; văn bản của lần sửa sửa được (vai trò giữ nguyên); thêm được văn
 *   bản hướng dẫn / tham khảo. Máy chủ khoá cùng luật (`EquipmentStandardService.requireRevisionDraftLocks`).
 */
export function RevisionDraftFields({ control, getValues, standard, record }: {
  control: Control<any>;
  getValues: UseFormGetValues<any>;
  standard: any;
  record?: any;
}) {
  const current = record ?? standard;
  const { result: previous } = useOne<any>({
    resource: "equipment_standards",
    id: current.previousStandard?.id ?? "",
    queryOptions: { enabled: current.previousStandard?.id != null },
  });
  const previousNos = new Set(((previous?.documents ?? []) as any[]).map((d) => norm(d.documentNo)));
  const revisionId = current.revisionDocumentId ?? null;
  const { fields, append, remove } = useFieldArray({ control, name: "documents", keyName: "_key" });
  const docs = (useWatch({ control, name: "documents" }) ?? []) as any[];
  const isInherited = (i: number) => {
    const f: any = fields[i];
    return f?.id != null && f.id !== revisionId && previousNos.has(norm(f.documentNo));
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Văn bản căn cứ</h3>
        <ol className="space-y-2">
          {fields.map((f: any, i) => {
            const d = docs[i] ?? f;
            if (isInherited(i)) {
              return (
                <li key={f._key} className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border px-3.5 py-2.5 text-sm"
                  title="Văn bản của bộ cũ — không sửa, không xoá">
                  <Lock className="text-muted-foreground size-3.5 shrink-0 self-center" />
                  <span className="font-medium">{d.documentNo}</span>
                  <Badge variant="neutral">{DOCUMENT_ROLE_LABELS[d.documentRole] ?? d.documentRole}</Badge>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate">{d.documentName}</span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {d.issueDate ? `Ban hành ${formatPlainDate(d.issueDate)}` : ""}
                    {d.effectiveDate ? ` · hiệu lực ${formatPlainDate(d.effectiveDate)}` : ""}
                  </span>
                </li>
              );
            }
            const revision = f.id != null && f.id === revisionId;
            return (
              <li key={f._key} className="border-primary/40 bg-primary/5 rounded-lg border px-3.5 py-3">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm font-semibold">{revision ? "Văn bản của lần sửa này" : "Văn bản thêm"}</span>
                  {revision ? <Badge variant="info">{DOCUMENT_ROLE_LABELS[d.documentRole] ?? d.documentRole}</Badge> : null}
                  {revision ? null : (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Xoá văn bản" title="Xoá văn bản"
                      className="text-muted-foreground hover:text-destructive ms-auto" onClick={() => remove(i)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <DocumentFields control={control} getValues={getValues} i={i} roleEditable={!revision} docId={f.id ?? undefined} />
              </li>
            );
          })}
        </ol>
        <Button type="button" variant="outline" size="sm"
          onClick={() => append({
            id: null, documentRole: "guidance", documentNo: "", documentName: "",
            issuingAuthority: "Bộ Giáo dục và Đào tạo", issueDate: null, effectiveDate: null, url: "",
          })}>
          <Plus />
          Thêm văn bản hướng dẫn / tham khảo
        </Button>
      </section>
    </div>
  );
}

/** Các ô của một văn bản sửa được: số hiệu, ngày ban hành, ngày hiệu lực, cơ quan, trích yếu, tệp. */
function DocumentFields({ control, getValues, i, roleEditable, docId }: {
  control: Control<any>;
  getValues: UseFormGetValues<any>;
  i: number;
  roleEditable: boolean;
  /** Văn bản đã lưu — tệp đính kèm gắn vào id này; văn bản mới thêm phải lưu xong mới đính kèm được. */
  docId?: number;
}) {
  const at = (k: string) => `documents.${i}.${k}`;
  return (
    <div className="grid items-start gap-x-4 gap-y-4 sm:grid-cols-[14rem_10rem_10rem_minmax(0,18rem)]">
      {roleEditable ? (
        <FormField control={control} name={at("documentRole")} rules={{ required: "Vui lòng chọn vai trò" }}
          render={({ field }) => (
            <FormItem className="sm:col-span-4 sm:max-w-[14rem]">
              <FormLabel>Vai trò</FormLabel>
              <Select value={field.value ?? undefined} onValueChange={(v) => v && field.onChange(v)}>
                <FormControl>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Vui lòng chọn vai trò" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ADDED_ROLES.map((v) => <SelectItem key={v} value={v}>{DOCUMENT_ROLE_LABELS[v]}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
      ) : null}
      <TextField control={control} name={at("documentNo")} label="Số hiệu" placeholder="16/2026/TT-BGDĐT" rule="SHORT_TEXT" max={50} min={3}
        rules={{
          required: "Vui lòng nhập số hiệu",
          validate: (v: string) => {
            const same = ((getValues("documents") ?? []) as any[]).filter((d) => norm(d.documentNo) === norm(v));
            return !norm(v) || same.length <= 1 || "Số hiệu trùng với văn bản khác trong bộ";
          },
        }} />
      <DateField control={control} name={at("issueDate")} label="Ngày ban hành" dateRule="PAST_OR_TODAY"
        rules={{ required: "Vui lòng nhập ngày ban hành", deps: [at("effectiveDate")] }} />
      <DateField control={control} name={at("effectiveDate")} label="Ngày hiệu lực"
        rules={{
          validate: (v: string | null) => {
            const doc = getValues(`documents.${i}`) ?? {};
            if (!v) return doc.documentRole === "reference" || "Vui lòng nhập ngày hiệu lực";
            return !doc.issueDate || v >= doc.issueDate || "Không được trước ngày ban hành";
          },
        }} />
      <TextField control={control} name={at("issuingAuthority")} label="Cơ quan ban hành" rule="NAME" max={200} min={2} />
      <TextareaField control={control} name={at("documentName")} label="Trích yếu" rule="NOTE" min={10} className="sm:col-span-4 sm:max-w-[40rem]"
        rules={{ required: "Vui lòng nhập trích yếu" }} />
      {/* Chỉ tệp, không ô đường dẫn (trưởng nhóm 16/11/2026) — đường dẫn đã khai trước đây vẫn giữ nguyên khi lưu. */}
      {docId != null ? (
        // Ô tệp dạng field không nhận className — bọc div để chiếm hai cột.
        <div className="sm:col-span-2">
          <AttachmentsPanel resource="equipment_standard_documents" recordId={docId} canWrite field compact title="Tệp văn bản" />
        </div>
      ) : null}
    </div>
  );
}
