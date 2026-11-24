import { AlertTriangle, CircleHelp, ListX } from "lucide-react";
import { useState, type ReactNode } from "react";

import { DetailTable, type DetailColumn } from "@/shared/components/data-table/detail-table";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import type { ImportKind, ImportPreview } from "@/domains/data-import/types";

const WHAT: Partial<Record<ImportKind, string>> = { schools: "trường", wards: "phường/xã" };

type Item = { code: string; name: string; what: string; note: string };
const COLUMNS: DetailColumn[] = [
  { key: "code", label: "Mã" },
  { key: "name", label: "Tên" },
  { key: "what", label: "Việc" },
  { key: "note", label: "Lý do" },
];

/**
 * Dải trên trang lô danh mục: thêm / cập nhật / ngừng bao nhiêu, tuỳ chọn ngừng mục không có trong tệp, danh sách sẽ
 * ngừng và lỗi của cả lô (không thuộc dòng nào — vd ngừng quá nhiều một lúc).
 */
export function CatalogPreviewBar({ kind, preview, editable, busy, onToggle }: {
  batchId: string;
  kind: ImportKind;
  preview: ImportPreview;
  editable: boolean;
  busy: boolean;
  onToggle: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const what = WHAT[kind] ?? "mục";
  const items: Item[] = [
    ...preview.deactivate.map((d) => ({ code: d.code, name: d.name, what: "Ngừng", note: "Không có trong tệp" })),
    ...preview.kept.map((k) => ({ code: k.code, name: k.name, what: "Giữ", note: k.note ?? "" })),
  ];
  const n = (v: number) => v.toLocaleString("vi-VN", { useGrouping: false });
  return (
    <div className="grid gap-2">
      {/* Một hàng chip gọn, không thẻ kéo ngang màn; rê chuột vào chip để biết con số đó là gì. */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Chip tone="text-success-text" label="Thêm" value={n(preview.created)}
          hint={`${n(preview.created)} ${what} trong tệp chưa có trên hệ thống. Bấm Cập nhật sẽ thêm mới.`} />
        <Chip tone="text-info-text" label="Cập nhật" value={n(preview.updated)}
          hint={`${n(preview.updated)} ${what} đã có nhưng tệp ghi khác (tên, địa chỉ, cơ quan quản lý…). Bấm Cập nhật sẽ sửa theo tệp. Cột So với hệ thống ghi rõ đổi gì.`} />
        <Chip tone="text-muted-foreground" label="Không đổi" value={n(preview.unchanged)}
          hint={`${n(preview.unchanged)} ${what} đã có và giống hệt tệp. Bỏ qua.`} />
        {preview.outOfScope ? (
          <Chip tone="text-muted-foreground" label="Ngoài phạm vi" value={n(preview.outOfScope)}
            hint={`${n(preview.outOfScope)} ${what} không thuộc phạm vi tài khoản này được sửa. Bỏ qua.`} />
        ) : null}
        {preview.deactivateMissing ? (
          <Chip tone="text-warning-text" label="Ngừng" value={n(preview.deactivated)}
            hint={`${n(preview.deactivated)} ${what} đang hoạt động mà tệp không có. Bấm Cập nhật sẽ chuyển sang ngừng hoạt động, không xoá.`} />
        ) : null}
        <span aria-hidden className="bg-border mx-1 h-5 w-px" />
        <Label className={cn("bg-card flex h-8 items-center gap-2 rounded-full border px-3 text-sm font-normal",
          editable && !busy && "hover:bg-accent cursor-pointer")}>
          <Checkbox checked={preview.deactivateMissing} disabled={!editable || busy} onCheckedChange={(v) => onToggle(v === true)} />
          Ngừng {what} không có trong tệp
        </Label>
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <button type="button" aria-label="Giải thích" className="text-muted-foreground hover:text-foreground -ms-1 p-1">
              <CircleHelp className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" tone="light" className="max-w-sm text-pretty">
            {`Bật khi tệp là danh sách ĐẦY ĐỦ: ${what} đang hoạt động trên hệ thống mà tệp không có sẽ chuyển sang ngừng hoạt động. Không xoá; ${what} đang có dữ liệu thì giữ nguyên. Tắt thì chỉ thêm và cập nhật.`}
          </TooltipContent>
        </Tooltip>
        {preview.deactivateMissing && items.length ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            <ListX />
            Xem danh sách ({n(items.length)})
          </Button>
        ) : null}
      </div>
      {preview.batchErrors.map((e) => (
        <p key={e} role="alert" className="text-destructive-text flex items-start gap-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {e}
        </p>
      ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="wide">
          <DialogHeader>
            <DialogTitle>{`Ngừng ${what} không có trong tệp`}</DialogTitle>
            <DialogDescription>
              {`Ngừng ${preview.deactivate.length} ${what}; giữ ${preview.kept.length} ${what} vì đang được dùng. Chỉ chuyển sang ngừng, không xoá.`}
            </DialogDescription>
          </DialogHeader>
          <DetailTable columns={COLUMNS} rows={items} text={(r, c) => r[c.key as keyof Item]} searchPlaceholder="Tìm mã, tên…" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({ label, value, hint, tone }: { label: string; value: string; hint: ReactNode; tone: string }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn("bg-card inline-flex h-8 cursor-default items-center gap-1.5 rounded-full border px-3 outline-none",
          "focus-visible:ring-ring/50 focus-visible:ring-[3px]", tone)}>
          {label}
          <span className="font-semibold tabular-nums">{value}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" tone="light" className="max-w-sm text-pretty">{hint}</TooltipContent>
    </Tooltip>
  );
}
