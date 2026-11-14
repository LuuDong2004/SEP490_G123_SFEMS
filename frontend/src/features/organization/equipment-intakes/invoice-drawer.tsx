import { useQueries } from "@tanstack/react-query";
import { Download, FileQuestion, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { kyInstance, DOWNLOAD_TIMEOUT } from "@/shared/api/data";
import { LoadingText } from "@/shared/components/spinner";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import type { AttachmentInfo } from "@/domains/voucher/types";

/** Một tệp xem được trong ngăn: tệp đã lưu (tải theo id) hoặc tệp vừa chọn trên form lập phiếu (chưa tải lên). */
export type IntakeFile = { key: string; name: string; type?: string | null; load: () => Promise<Blob> };

/**
 * Tệp của phiếu ghi tăng: tệp của phiếu và tệp hoá đơn riêng của từng dòng (đã lưu), cộng tệp đang chờ tải lên
 * của form lập. Cùng khoá truy vấn với `AttachmentsPanel`, nên thêm / xoá tệp ở đó là danh sách này đổi theo.
 */
export function useIntakeFiles(recordId: number | undefined, lineIds: number[], pending: File[]): IntakeFile[] {
  const sources = [
    ...(recordId ? [{ resource: "equipment_intakes", id: recordId }] : []),
    ...lineIds.map((id) => ({ resource: "equipment_intake_lines", id })),
  ];
  const results = useQueries({
    queries: sources.map((s) => ({
      queryKey: ["attachments", s.resource, s.id],
      queryFn: () => kyInstance.get("attachments", { searchParams: { resource: s.resource, recordId: String(s.id) } }).json<AttachmentInfo[]>(),
    })),
  });
  const saved = results.flatMap((r) => (Array.isArray(r.data) ? r.data : []));
  const savedKey = saved.map((f) => f.id).join(",");
  const pendingKey = pending.map((f) => `${f.name}:${f.size}`).join(",");
  return useMemo(() => [
    ...saved.map((f) => ({
      key: `a${f.id}`,
      name: f.fileName,
      type: f.contentType,
      load: () => kyInstance.get(`attachments/${f.id}/content`, { timeout: DOWNLOAD_TIMEOUT }).blob(),
    })),
    ...pending.map((f) => ({ key: `p${f.name}:${f.size}`, name: f.name, type: f.type, load: () => Promise.resolve(f as Blob) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [savedKey, pendingKey]);
}

const kindOf = (name: string, type?: string | null) =>
  (type ?? "").startsWith("image/") ? "image" : type === "application/pdf" || /\.pdf$/i.test(name) ? "pdf" : "other";

/**
 * "Xem hoá đơn": ngăn bên PHẢI màn hình, KHÔNG phủ form — vừa nhìn hoá đơn vừa gõ số lượng, đơn giá bên trái. Ảnh và
 * PDF xem ngay; loại khác thì tải về.
 */
export function InvoiceDrawer({ open, onClose, files }: { open: boolean; onClose: () => void; files: IntakeFile[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const current = files.find((f) => f.key === selected) ?? files[0];
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || !current) return;
    let revoked = false;
    let made: string | null = null;
    setUrl(null);
    setFailed(false);
    current.load().then((blob) => {
      if (revoked) return;
      const type = kindOf(current.name, current.type) === "pdf" ? "application/pdf" : blob.type || current.type || "";
      made = URL.createObjectURL(type ? new Blob([blob], { type }) : blob);
      setUrl(made);
    }).catch(() => !revoked && setFailed(true));
    return () => {
      revoked = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [open, current]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const kind = current ? kindOf(current.name, current.type) : "other";
  return createPortal(
    <aside data-print="hide" aria-label="Xem hoá đơn"
      className="bg-card shadow-e3 fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l sm:w-[32rem]">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h2 className="min-w-0 flex-1 truncate font-semibold" title={current?.name}>{current?.name ?? "Tệp đính kèm"}</h2>
        {url && current ? (
          <Button type="button" variant="outline" size="sm" onClick={() => Object.assign(document.createElement("a"), { href: url, download: current.name }).click()}>
            <Download />
            Tải về
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Đóng">
          <X />
        </Button>
      </div>
      {files.length > 1 ? (
        <div className="flex gap-1.5 overflow-x-auto border-b px-4 py-2">
          {files.map((f) => (
            <button key={f.key} type="button" onClick={() => setSelected(f.key)}
              className={cn("max-w-48 shrink-0 truncate rounded-full border px-3 py-1 text-xs", f.key === current?.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}
              title={f.name}>
              {f.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="bg-foreground/10 min-h-0 flex-1 overflow-auto">
        {!current ? null : failed ? (
          <p className="text-muted-foreground p-6 text-center text-sm">Không mở được tệp.</p>
        ) : !url ? (
          <div className="p-6"><LoadingText /></div>
        ) : kind === "image" ? (
          <div className="flex min-h-full items-start justify-center p-3">
            <img src={url} alt={current.name} className="max-w-full rounded-md" />
          </div>
        ) : kind === "pdf" ? (
          <iframe src={url} title={current.name} className="size-full border-0" />
        ) : (
          <div className="text-muted-foreground flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
            <FileQuestion className="size-8" />
            <p>Tệp này không xem được ở đây. Bấm Tải về để mở.</p>
          </div>
        )}
      </div>
    </aside>,
    document.body,
  );
}
