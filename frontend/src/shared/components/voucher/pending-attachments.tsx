import { useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Paperclip, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";
import { FilePreviewDialog, type PreviewSource } from "@/shared/components/voucher/file-preview";

const MAX_BYTES = 10 * 1024 * 1024;

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Tệp chọn trên form LẬP phiếu, khi phiếu chưa có id để gắn tệp vào: giữ trong bộ nhớ, và
 * `uploadTo(id)` đẩy lên ngay sau khi phiếu được lưu. Người lập chọn tệp lúc đang điền, không phải
 * lưu nháp rồi quay lại mới đính kèm được.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function usePendingAttachments(resource: string) {
  const [files, setFiles] = useState<File[]>([]);
  const { open } = useNotification();
  const queryClient = useQueryClient();

  const uploadTo = useCallback(async (recordId: number | undefined) => {
    if (recordId == null || files.length === 0) return;
    for (const file of files) {
      const form = new FormData();
      form.append("resource", resource);
      form.append("recordId", String(recordId));
      form.append("file", file);
      try {
        await kyInstance.post("attachments", { body: form });
      } catch (error) {
        open?.({ type: "error", message: await errorMessage(error), description: `Phiếu đã lưu nhưng chưa đính kèm được ${file.name}` });
      }
    }
    setFiles([]);
    await queryClient.invalidateQueries({ queryKey: ["attachments", resource, recordId] });
  }, [files, resource, open, queryClient]);

  return { files, setFiles, uploadTo };
}

/** Khung "Tệp đính kèm" của form lập phiếu: nút Thêm tệp và danh sách tệp đang chờ lưu. */
export function PendingAttachments({ files, onChange, className, title = "Tệp đính kèm", required }: {
  files: File[];
  onChange: (files: File[]) => void;
  /** Tiêu đề khung, vd. "Tệp quyết định" khi loại phiếu cần đúng một loại giấy tờ. */
  title?: string;
  /** Bắt buộc có ít nhất một tệp lúc trình — tiêu đề có dấu * như ô bắt buộc. */
  required?: boolean;
  /** Lớp thêm cho khung — form trong hộp thoại bỏ viền thẻ. */
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { open } = useNotification();
  const [preview, setPreview] = useState<PreviewSource | null>(null);

  const add = (list: File[]) => {
    const tooBig = list.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) open?.({ type: "error", message: `${tooBig.map((f) => f.name).join(", ")} vượt quá 10 MB`, description: "Không thêm được tệp" });
    const ok = list.filter((f) => f.size <= MAX_BYTES && !files.some((x) => x.name === f.name && x.size === f.size));
    if (ok.length) onChange([...files, ...ok]);
  };

  return (
    <Card className={cn("gap-3 py-4", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-4">
        <CardTitle className="flex items-center gap-2 text-base" title="Biên bản, hoá đơn, ảnh chụp kèm theo phiếu. Tối đa 10 MB mỗi tệp.">
          <Paperclip className="size-4" />
          <span>
            {title}
            {required ? <span className="text-destructive" aria-hidden> *</span> : null}
          </span>
          {files.length ? <span className="text-muted-foreground text-sm font-normal tabular-nums">({files.length})</span> : null}
        </CardTitle>
        <input ref={input} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) add(Array.from(e.target.files)); }} />
        <Button type="button" variant="outline" size="sm" onClick={() => {
          // Xoá giá trị cũ TRƯỚC khi mở, để chọn lại đúng tệp vừa bỏ vẫn nhận.
          if (input.current) input.current.value = "";
          input.current?.click();
        }}>
          <Upload />
          Thêm tệp
        </Button>
      </CardHeader>
      <CardContent className="px-4">
        {files.length === 0 ? (
          <p className="text-muted-foreground text-sm">Chưa có tệp nào. Tệp chọn ở đây được tải lên khi lưu phiếu.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {files.map((file) => (
              <li key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-lg border p-2.5">
                <span className="bg-card flex size-9 shrink-0 items-center justify-center rounded-md border">
                  <FileText className="text-muted-foreground size-5" />
                </span>
                {/* Bấm vào tệp là xem trước ngay, không phải lưu phiếu rồi mới xem được. */}
                <button type="button" className="min-w-0 flex-1 text-left" title={`Xem ${file.name}`} onClick={() => setPreview({ name: file.name, type: file.type, blob: file })}>
                  <span className="hover:text-primary block truncate text-sm font-medium">{file.name}</span>
                  <span className="text-muted-foreground block text-xs">{size(file.size)} · tải lên khi lưu</span>
                </button>
                <Button type="button" variant="ghost" size="icon" className="size-8" title="Bỏ tệp này" onClick={() => onChange(files.filter((f) => f !== file))}>
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <FilePreviewDialog source={preview} onClose={() => setPreview(null)} />
    </Card>
  );
}
