import { useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileImage, FileSpreadsheet, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { kyInstance, DOWNLOAD_TIMEOUT } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { formatDateTime } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";
import { FilePreviewDialog, previewable, type PreviewSource } from "@/shared/components/voucher/file-preview";
import type { AttachmentInfo } from "@/domains/voucher/types";

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} byte`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** "02/11/2026 11:37" — gọn, đủ chỗ trong thẻ tệp (dạng "2 thg 11, 2026" bị cắt). */
function shortDateTime(value?: string | null) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Biểu tượng theo loại tệp, để nhìn lưới là biết ảnh / bảng tính / văn bản. */
function FileIcon({ file }: { file: AttachmentInfo }) {
  const type = file.contentType ?? "";
  const name = file.fileName.toLowerCase();
  if (type.startsWith("image/")) return <FileImage className="text-info size-5" />;
  if (type.includes("spreadsheet") || type.includes("excel") || /\.(xlsx?|csv)$/.test(name)) {
    return <FileSpreadsheet className="text-success size-5" />;
  }
  if (type === "application/pdf") return <FileText className="text-destructive size-5" />;
  return <FileText className="text-muted-foreground size-5" />;
}

/**
 * Tệp đính kèm của một bản ghi: hoá đơn, biên bản, quyết định, ảnh thiết bị.
 *
 * <p>Tải về đi qua {@code kyInstance} rồi tạo liên kết tạm, không phải một thẻ
 * {@code <a href>} trỏ thẳng API: trình duyệt không gắn token vào liên kết thường,
 * và đưa token lên query string là để nó nằm lại trong lịch sử và nhật ký máy chủ.
 *
 * @param canWrite được thêm, xoá tệp — do bản ghi gốc quyết định
 */
export function AttachmentsPanel({
  resource,
  recordId,
  canWrite,
  description = "Hoá đơn, biên bản, quyết định hoặc ảnh chụp kèm theo. Tối đa 10 MB mỗi tệp.",
  compact,
  title = "Tệp đính kèm",
  required,
  note,
  className,
  section,
}: {
  /** Bắt buộc có ít nhất một tệp lúc trình — tiêu đề có dấu * như ô bắt buộc. */
  required?: boolean;
  resource: string;
  recordId: number | undefined;
  canWrite: boolean;
  description?: string;
  /** Gọn: tiêu đề, số tệp và nút Thêm trên một hàng; mô tả thành chú thích khi rê chuột. */
  compact?: boolean;
  /** Tiêu đề khung — màn có hai khung tệp (vd. hồ sơ thiết bị: tệp của nó và hoá đơn nhập) phải gọi tên được từng khung. */
  title?: string;
  /** Một dòng luôn hiện dưới tiêu đề, kể cả khi gọn — vd. trên form sửa: tệp lưu ngay, không chờ nút Lưu. */
  note?: string;
  /** Lớp thêm cho khung — form trong hộp thoại bỏ viền thẻ (hộp thoại đã là khung). */
  className?: string;
  /**
   * Khối trong hồ sơ (phòng, khối nhà, cơ sở), cùng khuôn với các khối lịch sử bên trên: tiêu đề chữ hoa nhỏ
   * kèm số tệp, nút bên phải, không thẻ riêng; chưa có tệp thì một dòng viền đứt.
   */
  section?: boolean;
}) {
  const { open } = useNotification();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewSource | null>(null);
  const key = ["attachments", resource, recordId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    enabled: recordId != null,
    queryFn: () =>
      kyInstance
        .get("attachments", { searchParams: { resource, recordId: String(recordId) } })
        .json<AttachmentInfo[]>(),
  });
  const files = Array.isArray(data) ? data : [];

  async function upload(list: File[]) {
    if (recordId == null) return;
    setBusy(true);
    let added = 0;
    for (const file of list) {
      const form = new FormData();
      form.append("resource", resource);
      form.append("recordId", String(recordId));
      form.append("file", file);
      try {
        await kyInstance.post("attachments", { body: form });
        added += 1;
      } catch (error) {
        open?.({ type: "error", message: await errorMessage(error), description: `Không đính kèm được ${file.name}` });
      }
    }
    if (added) open?.({ type: "success", message: added === 1 ? `Đã đính kèm ${list[0].name}` : `Đã đính kèm ${added} tệp` });
    await queryClient.invalidateQueries({ queryKey: key });
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  async function download(file: AttachmentInfo) {
    try {
      const blob = await kyInstance.get(`attachments/${file.id}/content`, { timeout: DOWNLOAD_TIMEOUT }).blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    }
  }

  /** PDF và ảnh mở thẳng trong thẻ mới (trình duyệt tự xem được) — đọc thông tư không phải tải về. */
  /** Xem trước ngay trong ứng dụng (ảnh, PDF, Word, văn bản) — không mở thẻ mới. */
  async function view(file: AttachmentInfo) {
    try {
      const blob = await kyInstance.get(`attachments/${file.id}/content`).blob();
      setPreview({ name: file.fileName, type: file.contentType, blob });
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    }
  }

  async function remove(file: AttachmentInfo) {
    setBusy(true);
    try {
      await kyInstance.delete(`attachments/${file.id}`);
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn(compact ? "gap-3 py-4" : undefined, section && "gap-2 rounded-none border-0 bg-transparent py-0 shadow-none", className)}>
      <CardHeader className={cn(compact || section ? "flex flex-row items-center justify-between gap-4 px-4" : "flex flex-row items-start justify-between gap-4", section && "min-h-8 px-0")}>
        <div className="space-y-1.5">
          {section ? (
            <h3 className="text-overline text-muted-foreground" title={description}>
              {title}
              {files.length ? <span className="text-foreground ms-1.5">{files.length}</span> : null}
            </h3>
          ) : (
          <CardTitle className="flex items-center gap-2 text-base" title={compact ? description : undefined}>
            <Paperclip className="size-4" />
            <span>
              {title}
              {required ? <span className="text-destructive" aria-hidden> *</span> : null}
            </span>
            {compact && files.length ? <span className="text-muted-foreground text-sm font-normal tabular-nums">({files.length})</span> : null}
          </CardTitle>
          )}
          {compact || section ? null : <CardDescription>{description}</CardDescription>}
          {note ? <p className="text-muted-foreground text-xs">{note}</p> : null}
        </div>
        {canWrite ? (
          <>
            <input
              ref={input}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void upload(Array.from(e.target.files));
              }}
            />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
              <Upload />
              Thêm tệp
            </Button>
          </>
        ) : null}
      </CardHeader>
      <CardContent className={cn(compact ? "px-4" : undefined, section && "px-0")}>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Đang tải…</p>
        ) : files.length === 0 ? (
          <p className={cn("text-muted-foreground text-sm", section && "rounded-lg border border-dashed px-3 py-2.5")}>Chưa có tệp nào.</p>
        ) : (
          <ul className={compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"}>
            {files.map((file) => (
              <li
                key={file.id}
                className="bg-surface-subtle hover:border-primary/40 group flex min-w-0 items-center gap-2.5 rounded-lg border py-2 ps-3 pe-1.5 transition-colors"
              >
                <span className="bg-card flex size-9 shrink-0 items-center justify-center rounded-md border">
                  <FileIcon file={file} />
                </span>
                <button type="button" className="min-w-0 flex-1 text-left" title={file.fileName}
                  onClick={() => void (previewable(file.fileName, file.contentType) ? view(file) : download(file))}>
                  <span className="hover:text-primary block truncate text-sm font-medium">{file.fileName}</span>
                  <span className="text-muted-foreground block truncate text-xs tabular-nums"
                    title={formatDateTime(file.createdAt)}>
                    {size(file.sizeBytes)} · {shortDateTime(file.createdAt)}
                  </span>
                </button>
                <div className="flex shrink-0">
                  {previewable(file.fileName, file.contentType) ? (
                    <Button type="button" variant="ghost" size="icon" className="size-8" title="Xem" onClick={() => void view(file)}>
                      <Eye />
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" size="icon" className="size-8" title="Tải về" onClick={() => void download(file)}>
                    <Download />
                  </Button>
                  {canWrite ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Xoá tệp"
                      disabled={busy}
                      onClick={() => void remove(file)}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <FilePreviewDialog source={preview} onClose={() => setPreview(null)} />
    </Card>
  );
}
