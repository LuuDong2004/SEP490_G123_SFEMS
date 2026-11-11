import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOff, ImagePlus, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { Button } from "@/shared/ui/button";

import type { AttachmentRow } from "./equipment-attachments";

/** Đuôi ảnh được nhận (khớp `AttachmentPolicy`); máy chủ kiểm lại chữ ký tệp. */
const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif";

/**
 * Một ảnh tải qua `kyInstance` (có token) rồi dựng URL tạm; thẻ `<img src>` trỏ thẳng API không gắn được
 * token. URL tạm được thu hồi khi ảnh đổi hoặc component gỡ.
 */
function AttachmentImage({ id, alt }: { id: number; alt: string }) {
  const { data: blob } = useQuery({
    queryKey: ["attachment-blob", id],
    staleTime: 5 * 60_000,
    queryFn: () => kyInstance.get(`attachments/${id}/content`).blob(),
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  return url ? (
    <img src={url} alt={alt} className="size-full object-cover" />
  ) : (
    <div className="bg-muted size-full animate-pulse" aria-hidden />
  );
}

/**
 * Ảnh thiết bị (SRS: hồ sơ hiện ảnh), tách khỏi tệp đính kèm. Ảnh đại diện (cover) hiện to, các ảnh khác
 * xếp thành dải nhỏ để bấm xem. Khi {@code canWrite}: thêm nhiều ảnh một lần, đặt đại diện, xoá ảnh.
 */
export function EquipmentPhoto({ equipmentId, canWrite }: { equipmentId: number; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listKey = ["attachments", "equipment", equipmentId];

  const { data: rows } = useQuery({
    queryKey: listKey,
    queryFn: () =>
      kyInstance
        .get("attachments", { searchParams: { resource: "equipment", recordId: String(equipmentId) } })
        .json<AttachmentRow[]>(),
  });
  // Ảnh đại diện đứng đầu; các ảnh còn lại giữ thứ tự tải lên.
  const images = (rows ?? []).filter((row) => row.image).sort((a, b) => Number(b.cover) - Number(a.cover));
  const [picked, setPicked] = useState<number | null>(null);
  const shown = images.find((row) => row.id === picked) ?? images[0] ?? null;

  /** Tải lên lần lượt; nếu chưa có đại diện thì ảnh đầu tiên tải lên thành đại diện. */
  const upload = async (files: File[]) => {
    setBusy(true);
    setError(null);
    try {
      let first: AttachmentRow | null = null;
      for (const file of files) {
        const body = new FormData();
        body.append("resource", "equipment");
        body.append("recordId", String(equipmentId));
        body.append("file", file);
        body.append("purpose", "photo");
        const created = await kyInstance.post("attachments", { body }).json<AttachmentRow>();
        first ??= created;
      }
      if (first && !images.some((row) => row.cover)) {
        await kyInstance.put(`attachments/${first.id}/cover`).json();
      }
      await queryClient.invalidateQueries({ queryKey: listKey });
    } catch {
      setError("Không tải được ảnh. Kiểm tra định dạng (JPG, PNG, WEBP, GIF) và dung lượng tối đa 10 MB.");
      await queryClient.invalidateQueries({ queryKey: listKey });
    } finally {
      setBusy(false);
    }
  };

  const setCover = async (row: AttachmentRow) => {
    setBusy(true);
    setError(null);
    try {
      await kyInstance.put(`attachments/${row.id}/cover`).json();
      await queryClient.invalidateQueries({ queryKey: listKey });
    } catch {
      setError("Không đặt được ảnh đại diện, thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: AttachmentRow) => {
    if (!window.confirm(`Xoá ảnh "${row.fileName}" khỏi thiết bị?`)) return;
    setBusy(true);
    setError(null);
    try {
      await kyInstance.delete(`attachments/${row.id}`);
      setPicked(null);
      await queryClient.invalidateQueries({ queryKey: listKey });
    } catch {
      setError("Không xoá được ảnh, thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full shrink-0 flex-col gap-3 sm:w-72">
      <div className="bg-muted relative aspect-square overflow-hidden rounded-md border">
        {shown ? (
          <AttachmentImage id={shown.id} alt={shown.fileName} />
        ) : (
          <div className="text-muted-foreground grid size-full place-items-center">
            <ImageOff className="size-10" aria-hidden />
          </div>
        )}
        {shown?.cover ? (
          <span className="bg-primary text-primary-foreground absolute bottom-2 left-2 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs">
            <Star className="size-3" aria-hidden />
            Đại diện
          </span>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((row) => (
            <button
              key={row.id}
              type="button"
              aria-label={`Xem ${row.fileName}`}
              onClick={() => setPicked(row.id)}
              className={`size-14 shrink-0 overflow-hidden rounded border-2 ${
                shown?.id === row.id ? "border-primary" : "border-transparent"
              }`}
            >
              <AttachmentImage id={row.id} alt={row.fileName} />
            </button>
          ))}
        </div>
      ) : null}
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length) void upload(files);
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <ImagePlus />
            Thêm ảnh
          </Button>
          {shown && !shown.cover ? (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void setCover(shown)}>
              <Star />
              Đặt làm đại diện
            </Button>
          ) : null}
          {shown ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void remove(shown)}>
              <Trash2 />
              Xoá ảnh
            </Button>
          ) : null}
        </div>
      ) : null}
      {images.length === 0 && !canWrite ? (
        <span className="text-muted-foreground text-xs">Chưa có ảnh thiết bị.</span>
      ) : null}
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
}
