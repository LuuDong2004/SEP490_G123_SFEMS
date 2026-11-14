import { FileImage, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/** Biểu tượng theo loại tệp — nhìn là biết ảnh / bảng tính / PDF / văn bản. */
export function FileTypeIcon({ name, type }: { name: string; type?: string | null }) {
  const t = type ?? "";
  const n = name.toLowerCase();
  if (t.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/.test(n)) return <FileImage className="text-info size-5" />;
  if (t.includes("spreadsheet") || t.includes("excel") || /\.(xlsx?|csv)$/.test(n)) return <FileSpreadsheet className="text-success size-5" />;
  if (t === "application/pdf" || n.endsWith(".pdf")) return <FileText className="text-destructive size-5" />;
  return <FileText className="text-muted-foreground size-5" />;
}

/** Một tệp trong ô: biểu tượng, tên (bấm để xem), dòng phụ (cỡ · lúc tải) và các nút bên phải. */
export type FileDropItem = {
  key: string;
  name: string;
  meta: string;
  icon: ReactNode;
  onOpen: () => void;
  actions: ReactNode;
};

/**
 * Ô tệp dạng TRƯỜNG FORM (hoá đơn, biên bản của phiếu): nhãn như nhãn các ô khác (dấu * khi bắt buộc), giới hạn tệp
 * bên phải nhãn; chưa có tệp thì một vùng viền đứt — kéo thả vào hoặc bấm để chọn; có tệp thì lưới thẻ tệp, ô cuối là
 * "Thêm tệp" (cũng nhận kéo thả). Thả tệp lên bất kỳ chỗ nào của ô đều nhận.
 *
 * Chỉ vẽ; nơi gọi giữ tệp (chờ lưu: `PendingAttachments`, đã lưu: `AttachmentsPanel`) và quyết định thêm / xoá.
 */
export function FileDrop({ label, required, limit = "Tối đa 10 MB mỗi tệp", hint, items, onAdd, busy, disabled, compact }: {
  label: string;
  required?: boolean;
  /** Chữ nhỏ bên phải nhãn. */
  limit?: string;
  /** Dòng phụ trong vùng trống, vd. "Bản đã ký, đóng dấu · tải lên khi lưu phiếu". */
  hint?: string;
  items: FileDropItem[];
  onAdd: (files: File[]) => void;
  busy?: boolean;
  /** Chỉ xem: không có vùng thả, không có ô "Thêm tệp". */
  disabled?: boolean;
  /** Vùng thả MỘT DÒNG (ô tệp nằm trong khối khác, vd. tệp của từng hoá đơn) thay cho ô cao. */
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = () => {
    // Xoá giá trị cũ TRƯỚC khi mở, để chọn lại đúng tệp vừa bỏ vẫn nhận.
    if (input.current) input.current.value = "";
    input.current?.click();
  };
  const drop = disabled ? {} : {
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setOver(false);
      if (e.dataTransfer.files.length) onAdd(Array.from(e.dataTransfer.files));
    },
  };
  const zone = cn("border-input flex rounded-lg border border-dashed transition-colors",
    disabled ? "cursor-default" : "hover:border-primary/50 hover:bg-primary/5 cursor-pointer",
    over && "border-primary bg-primary/5", busy && "pointer-events-none opacity-60");

  const list = (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((f) => (
        <li key={f.key} className="bg-card hover:border-primary/40 flex min-w-0 items-center gap-2.5 rounded-lg border py-2 ps-2.5 pe-1.5 transition-colors">
          <span className="bg-surface-subtle flex size-9 shrink-0 items-center justify-center rounded-md border">{f.icon}</span>
          <button type="button" className="min-w-0 flex-1 text-left" title={`Xem ${f.name}`} onClick={f.onOpen}>
            <span className="hover:text-primary block truncate text-sm font-medium">{f.name}</span>
            <span className="text-muted-foreground block truncate text-xs tabular-nums">{f.meta}</span>
          </button>
          <div className="flex shrink-0">{f.actions}</div>
        </li>
      ))}
    </ul>
  );

  // Gọn (tệp của từng hoá đơn): MỘT hàng — nhãn, nút chọn tệp (cũng nhận kéo thả), chữ phụ; có tệp thì danh sách ở dưới.
  // Không vùng thả chạy hết bề ngang (trưởng nhóm 14/11/2026, CLAUDE.md "không dài ngoằng").
  if (compact) {
    return (
      <div className={cn("grid gap-2 rounded-lg", over && "bg-primary/5")} {...drop}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-sm font-medium">
            {label}
            {required ? <span className="text-destructive" aria-hidden> *</span> : null}
            {items.length ? <span className="text-muted-foreground ms-1.5 font-normal tabular-nums">({items.length})</span> : null}
          </span>
          <input ref={input} type="file" multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) onAdd(Array.from(e.target.files)); }} />
          {/* Nút ở BÊN PHẢI, không dòng chữ phụ (trưởng nhóm 14/11/2026) — gợi ý, giới hạn tệp nằm trong chú thích nút. */}
          {disabled ? (items.length ? null : <span className="text-muted-foreground ms-auto text-sm">Chưa có tệp nào.</span>) : (
            <button type="button" onClick={pick} title={[hint, limit].filter(Boolean).join(" · ")}
              className={cn(zone, "bg-card text-primary ms-auto items-center gap-2 px-3 py-1.5 text-sm font-medium")}>
              <Upload className="size-4" />
              {items.length ? "Thêm tệp" : "Chọn hoặc kéo thả tệp"}
            </button>
          )}
        </div>
        {items.length ? list : null}
      </div>
    );
  }

  return (
    <div className="grid gap-2" {...drop}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm leading-none font-medium">
          {label}
          {required ? <span className="text-destructive" aria-hidden> *</span> : null}
          {items.length ? <span className="text-muted-foreground ms-1.5 font-normal tabular-nums">({items.length})</span> : null}
        </span>
        <span className="text-muted-foreground text-xs">{limit}</span>
      </div>
      <input ref={input} type="file" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) onAdd(Array.from(e.target.files)); }} />

      {items.length === 0 ? (
        disabled ? (
          <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2.5 text-sm">Chưa có tệp nào.</p>
        ) : (
          <button type="button" onClick={pick} className={cn(zone, "bg-card flex-col items-center justify-center gap-1.5 px-4 py-5 text-center")}>
            <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-full">
              <Upload className="size-4" />
            </span>
            <span className="text-sm">
              Kéo thả tệp vào đây hoặc <span className="text-primary font-medium">chọn tệp</span>
            </span>
            {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
          </button>
        )
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((f) => (
            <li key={f.key} className="bg-card hover:border-primary/40 flex min-w-0 items-center gap-2.5 rounded-lg border py-2 ps-2.5 pe-1.5 transition-colors">
              <span className="bg-surface-subtle flex size-9 shrink-0 items-center justify-center rounded-md border">{f.icon}</span>
              <button type="button" className="min-w-0 flex-1 text-left" title={`Xem ${f.name}`} onClick={f.onOpen}>
                <span className="hover:text-primary block truncate text-sm font-medium">{f.name}</span>
                <span className="text-muted-foreground block truncate text-xs tabular-nums">{f.meta}</span>
              </button>
              <div className="flex shrink-0">{f.actions}</div>
            </li>
          ))}
          {disabled ? null : (
            <li className="min-h-[3.375rem]">
              <button type="button" onClick={pick} className={cn(zone, "text-muted-foreground hover:text-primary size-full items-center justify-center gap-2 text-sm")}>
                <Upload className="size-4" />
                Thêm tệp
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
