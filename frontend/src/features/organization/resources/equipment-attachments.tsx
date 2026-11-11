import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { formatDateTime } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

/** Đuôi tài liệu (TS-03). Ảnh thiết bị có mục riêng (`equipment-photo.tsx`). Khớp với `AttachmentPolicy` ở máy chủ. */
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx";

export type AttachmentRow = {
  id: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  note: string | null;
  cover: boolean;
  image: boolean;
  createdAt: string | null;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Lời báo từ máy chủ (`message`) nếu có; không thì lời chung. */
async function errorMessage(e: unknown): Promise<string> {
  const withResponse = e as { response?: Response; message?: unknown };
  if (withResponse?.response) {
    const body = (await withResponse.response.json().catch(() => null)) as { message?: string } | null;
    if (body?.message) return body.message;
  }
  if (typeof withResponse?.message === "string" && withResponse.message) return withResponse.message;
  return "Không thực hiện được, thử lại sau.";
}

/**
 * Tệp đính kèm của thiết bị (TS-03): tải lên ngay khi chọn (không cần bấm Lưu), xem / tải về, đặt ảnh
 * đại diện, gỡ tệp. Ghi được khi người xem có quyền ghi thiết bị ({@code canWrite}).
 */
export function EquipmentAttachmentsCard({ equipmentId, canWrite }: { equipmentId: number; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const queryKey = ["attachments", "equipment", equipmentId];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Tệp đang xem trong hộp thoại; giữ URL blob để hiện ảnh hoặc PDF. */
  const [preview, setPreview] = useState<{ row: AttachmentRow; url: string } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () =>
      kyInstance
        .get("attachments", { searchParams: { resource: "equipment", recordId: String(equipmentId) } })
        .json<AttachmentRow[]>(),
  });

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey });
    } catch (e) {
      setError(await errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /** Tải lên lần lượt từng tệp; một tệp lỗi thì dừng và báo, các tệp trước đó vẫn được giữ. */
  const upload = (files: File[]) =>
    act(async () => {
      for (const file of files) {
        const body = new FormData();
        body.append("resource", "equipment");
        body.append("recordId", String(equipmentId));
        body.append("file", file);
        body.append("purpose", "document");
        await kyInstance.post("attachments", { body }).json();
      }
    });

  /** Tải nội dung về trình duyệt rồi mở hoặc lưu. Đường dẫn cần phiên đăng nhập nên không mở trực tiếp. */
  const fetchFile = async (row: AttachmentRow) => {
    const blob = await kyInstance.get(`attachments/${row.id}/content`).blob();
    return URL.createObjectURL(blob);
  };

  /** Xem ngay trong hộp thoại trên trang, không mở tab mới. */
  const view = async (row: AttachmentRow) => {
    setError(null);
    try {
      const url = await fetchFile(row);
      setPreview({ row, url });
    } catch (e) {
      setError(await errorMessage(e));
    }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const download = async (row: AttachmentRow) => {
    setError(null);
    try {
      const url = await fetchFile(row);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = row.fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(await errorMessage(e));
    }
  };

  const remove = (row: AttachmentRow) => {
    if (!window.confirm(`Gỡ tệp "${row.fileName}" khỏi thiết bị?`)) return;
    void act(() => kyInstance.delete(`attachments/${row.id}`));
  };

  // Ảnh thiết bị nằm ở mục riêng, nên thẻ này chỉ liệt kê tài liệu.
  const rows = (data ?? []).filter((row) => !row.image);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="size-4" aria-hidden />
          Tệp đính kèm {data ? <span className="text-muted-foreground font-normal">({rows.length})</span> : null}
        </CardTitle>
        {canWrite ? (
          <>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length) void upload(files);
              }}
            />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
              <Upload />
              Thêm tệp
            </Button>
          </>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Tài liệu (PDF, Word, Excel), tối đa 10 MB mỗi tệp.
        </p>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Đang tải…</p>
        ) : isError ? (
          <p className="text-destructive text-sm">Không tải được danh sách tệp.</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Chưa có tệp đính kèm nào.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-md">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium" title={row.fileName}>
                      {row.fileName}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatSize(row.sizeBytes)}
                    {row.createdAt ? ` · ${formatDateTime(row.createdAt)}` : ""}
                    {row.note ? ` · ${row.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Xem" onClick={() => void view(row)}>
                    <Eye />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Tải về" onClick={() => void download(row)}>
                    <Download />
                  </Button>
                  {canWrite ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Gỡ tệp"
                      disabled={busy}
                      onClick={() => remove(row)}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={preview !== null} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.row.fileName}</DialogTitle>
            <DialogDescription>Xem trước tệp đính kèm.</DialogDescription>
          </DialogHeader>
          {preview?.row.image ? (
            <img src={preview.url} alt={preview.row.fileName} className="mx-auto max-h-[70vh] w-auto" />
          ) : preview?.row.contentType === "application/pdf" ? (
            <iframe src={preview.url} title={preview.row.fileName} className="h-[70vh] w-full rounded border" />
          ) : (
            <p className="text-muted-foreground text-sm">Không xem trước được loại tệp này. Dùng nút Tải về để mở.</p>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
