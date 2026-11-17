import { useInvalidate, useNotification } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Control } from "react-hook-form";

import type { EquipmentNorm } from "@/domains/equipment-standard/types";
import { kyInstance } from "@/shared/api/data";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { errorMessage } from "@/shared/lib/api-error";
import { formatDateTime } from "@/shared/lib/format";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Label } from "@/shared/ui/label";

import { LegalBasisPicker } from "./legal-doc-picker";

/**
 * Danh mục tối thiểu là danh sách PHẲNG (trưởng nhóm 17/11/2026): thêm / sửa / xoá trực tiếp, không phiên bản, không
 * ngày áp dụng; mọi thay đổi ghi vào nhật ký (`data_changes`: thêm, từng trường sửa, xoá — ai, lúc nào, cũ → mới).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const NORMS = "equipment_norms";

type Change = {
  id: number;
  createdAt: string;
  actorName: string | null;
  recordId: number;
  recordLabel: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

/** Tên trường trên nhật ký, theo chữ của màn hình. */
const FIELD_LABEL: Record<string, string> = {
  "(thêm)": "Thêm vào danh mục",
  "(xoá)": "Xoá khỏi danh mục",
  name: "Tên thiết bị",
  minQuantity: "Cần có",
  unit: "ĐVT",
  basisSize: "Số đối tượng",
  normBasis: "Đối tượng",
  gradeLevels: "Lớp",
  subject: "Môn",
  catalog: "Thiết bị trong danh mục",
  quantityText: "Số lượng (theo phụ lục)",
  topic: "Chủ đề",
  sectionName: "Nhóm",
  purpose: "Mục đích",
  description: "Mô tả",
  optional: "Tự chọn",
  forTeacher: "Giáo viên dùng",
  forStudent: "Học sinh dùng",
  sourceDocument: "Căn cứ",
  endDocument: "Căn cứ xoá",
  effectiveFrom: "Áp dụng từ",
  effectiveTo: "Thôi áp dụng từ",
  note: "Ghi chú",
  itemNo: "Số thứ tự",
};

const fieldLabel = (f: string) => FIELD_LABEL[f] ?? f;

/** Trường nội bộ của lần xoá (căn cứ xoá, ngày thôi áp dụng) — đã gói trong dòng "Xoá khỏi danh mục", không hiện riêng. */
const HIDDEN_FIELDS = new Set(["endDocument", "effectiveTo", "replaces"]);

/** Giá trị trên nhật ký đọc như chữ trên màn: ngày dd/mm/yyyy, có / không, mã nội bộ qua `format` của màn gọi. */
function valueText(field: string, v: string | null, format?: (field: string, v: string) => string | undefined): string {
  if (v === null || v === "") return "trống";
  const custom = format?.(field, v);
  if (custom) return custom;
  if (v === "true") return "Có";
  if (v === "false") return "Không";
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (day) return `${day[3]}/${day[2]}/${day[1]}`;
  return v;
}

const changeText = (c: Change, format?: (field: string, v: string) => string | undefined) =>
  c.field === "(thêm)" || c.field === "(xoá)" ? ""
    : `${valueText(c.field, c.oldValue, format)} → ${valueText(c.field, c.newValue, format)}`;

/**
 * Nhật ký một dòng — đặt trong ngăn chi tiết, cùng kiểu mốc (chấm + chữ + dòng phụ) với "Có từ TT …". Các trường sửa
 * trong CÙNG một lần lưu gộp thành một mốc: "Sửa Cần có, ĐVT" rồi từng dòng cũ → mới.
 */
export function NormChangeLog({ id, format }: { id: number; format?: (field: string, v: string) => string | undefined }) {
  const { data, isLoading } = useQuery({
    queryKey: [NORMS, id, "changes"],
    queryFn: () => kyInstance.get(`${NORMS}/${id}/changes`).json<Change[]>(),
  });
  if (isLoading || !data) return null;
  const groups: { key: string; at: string; who: string; items: Change[] }[] = [];
  for (const c of data.filter((x) => !HIDDEN_FIELDS.has(x.field))) {
    const key = `${c.createdAt.slice(0, 19)}|${c.actorName ?? ""}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(c);
    else groups.push({ key, at: c.createdAt, who: c.actorName ?? "—", items: [c] });
  }
  return (
    <>
      {groups.map((g) => {
        const kind = g.items.find((c) => c.field === "(thêm)" || c.field === "(xoá)");
        const edits = g.items.filter((c) => c !== kind);
        const title = kind ? fieldLabel(kind.field) : `Sửa ${edits.map((c) => fieldLabel(c.field).toLowerCase()).join(", ")}`;
        return (
          <div key={g.key} className="flex gap-2">
            <i className={kind?.field === "(xoá)" ? "bg-destructive mt-1.5 size-2 shrink-0 rounded-full"
              : kind ? "bg-success mt-1.5 size-2 shrink-0 rounded-full" : "bg-warning mt-1.5 size-2 shrink-0 rounded-full"} />
            <div className="min-w-0">
              <div>{title}</div>
              {!kind && edits.length ? (
                <ul className="text-foreground/80 mt-0.5">
                  {edits.map((c) => (
                    <li key={c.id} className="break-words">
                      {edits.length > 1 ? <span className="text-muted-foreground">{fieldLabel(c.field)}: </span> : null}
                      {changeText(c, format)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="text-muted-foreground">{formatDateTime(g.at)} · {g.who}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Hỏi lại rồi xoá một thiết bị khỏi danh mục (nhật ký giữ lại lần xoá). */
export function DeleteNormDialog({ row, onClose }: { row: EquipmentNorm | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<number | null>(null);
  const [missing, setMissing] = useState(false);
  const invalidate = useInvalidate();
  const { open: notify } = useNotification();
  const run = async () => {
    if (!row) return;
    if (!legal) {
      setMissing(true);
      return;
    }
    setBusy(true);
    try {
      await kyInstance.post(`${NORMS}/${row.id}/remove`, { json: { legalDocument: { id: legal } } });
      await invalidate({ resource: NORMS, invalidates: ["list"] });
      notify?.({ type: "success", message: `Đã xoá "${row.name}" khỏi danh mục.` });
      setLegal(null);
      onClose();
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không xoá được" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open={!!row} onOpenChange={(o) => !o && !busy && onClose()}>
      <ConfirmContent
        tone="danger"
        title="Xoá thiết bị khỏi danh mục?"
        description={
          <div className="grid gap-3">
            <p className="text-foreground font-medium">{row?.name}</p>
            <div className="grid gap-2">
              <Label>Văn bản căn cứ</Label>
              <LegalBasisPicker value={legal} onChange={(id) => { setLegal(id); setMissing(false); }} invalid={missing} />
              {missing ? <p className="text-destructive text-sm">Chọn văn bản căn cứ</p> : null}
            </div>
          </div>
        }
        cancelLabel="Không xoá"
        confirmLabel="Xoá"
        busy={busy}
        keepOpen
        onConfirm={() => void run()}
      />
    </AlertDialog>
  );
}

/** Ô "Văn bản căn cứ" của form thêm / sửa (khoá `legalDocument`). */
export function LegalBasisField({ control, block }: { control: Control<any>; block?: boolean }) {
  return (
    <FormField
      control={control}
      name="legalDocument.id"
      rules={{ required: "Chọn văn bản căn cứ" }}
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel>Văn bản căn cứ</FormLabel>
          <LegalBasisPicker value={field.value ?? null} onChange={field.onChange} invalid={!!fieldState.error} block={block} />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
