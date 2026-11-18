import { useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, ImageOff, ImagePlus, Loader2, Maximize2, Minus, Pencil, Plus, RotateCcw, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { kyInstance } from "@/shared/api/data";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Slider } from "@/shared/ui/slider";
import type { AttachmentInfo } from "@/domains/voucher/types";

/**
 * Ảnh một tệp đính kèm, tải qua `kyInstance` (có token) rồi dựng URL tạm — thẻ `<img src>`
 * trỏ thẳng API thì trình duyệt không gắn token, và đưa token lên query string là để nó
 * nằm lại trong nhật ký máy chủ. URL tạm được thu hồi khi ảnh đổi hoặc component gỡ.
 */
export function useImageUrl(id: number | undefined) {
  const { data: blob } = useQuery({
    queryKey: ["attachment-blob", id],
    enabled: id != null,
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => kyInstance.get(`attachments/${id}/content`, { signal }).blob(),
  });
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return setUrl(undefined);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

type CropBox = { x: number; y: number; zoom: number };
const DEFAULT_CROP: CropBox = { x: 50, y: 50, zoom: 1 };
const FRAME = 256;

/**
 * Luật ảnh — cùng số với máy chủ (`AttachmentController`: 10 MB mỗi tệp, tối đa 10 ảnh mỗi bản ghi). Chỉ nhận ảnh
 * chụp thường gặp; GIF / ảnh động không có chỗ dùng ở hồ sơ.
 */
const PHOTO_MAX = 10;
const PHOTO_MAX_MB = 10;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WEBP" };
const PHOTO_ACCEPT = Object.keys(PHOTO_TYPES).join(",");
const PHOTO_HINT = `${Object.values(PHOTO_TYPES).join(", ")} · tối đa ${PHOTO_MAX_MB} MB/ảnh`;

/** Lọc tệp vừa chọn theo luật ảnh: trả tệp nhận được và câu báo cho từng nhóm bị bỏ. */
function screenPhotos(files: File[], have: number): { ok: File[]; problems: string[] } {
  const wrongType = files.filter((f) => !PHOTO_TYPES[f.type]);
  const tooBig = files.filter((f) => PHOTO_TYPES[f.type] && f.size > PHOTO_MAX_MB * 1024 * 1024);
  const fit = files.filter((f) => PHOTO_TYPES[f.type] && f.size <= PHOTO_MAX_MB * 1024 * 1024);
  const room = Math.max(0, PHOTO_MAX - have);
  const ok = fit.slice(0, room);
  const problems = [
    wrongType.length ? `${wrongType.length} tệp không phải ảnh ${Object.values(PHOTO_TYPES).join(", ")}` : null,
    tooBig.length ? `${tooBig.length} ảnh quá ${PHOTO_MAX_MB} MB` : null,
    fit.length > room ? `Đã đủ ${PHOTO_MAX} ảnh — bỏ ${fit.length - room} ảnh` : null,
  ].filter(Boolean) as string[];
  return { ok, problems };
}

export function parseCrop(v: string | null | undefined): CropBox {
  const [x, y, zoom] = (v ?? "").split(",").map(Number);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(zoom) ? { x, y, zoom: Math.max(1, zoom) } : DEFAULT_CROP;
}

/** Đóng khung ảnh vào một ô VUÔNG theo vùng cắt: giữ ảnh gốc, chỉ đổi cách hiển thị. */
export function cropStyle(c: CropBox): CSSProperties {
  return {
    objectFit: "cover",
    objectPosition: `${c.x}% ${c.y}%`,
    transform: `scale(${c.zoom})`,
    transformOrigin: `${c.x}% ${c.y}%`,
  };
}

/** Một ảnh trong hộp chọn: ảnh đã có (tải qua API) hoặc tệp vừa chọn (URL tạm từ máy). */
type Candidate = { key: string; name: string; existing?: AttachmentInfo; file?: File; localUrl?: string };

function CandidateImg({ c, className, style }: { c: Candidate; className?: string; style?: CSSProperties }) {
  const remote = useImageUrl(c.existing?.id);
  const src = c.file ? c.localUrl : remote;
  return src ? <img src={src} alt={c.name} draggable={false} className={className} style={style} /> : null;
}

function Thumb({ file, active, onClick }: { file: AttachmentInfo; active: boolean; onClick: () => void }) {
  const url = useImageUrl(file.id);
  return (
    <button
      type="button"
      onClick={onClick}
      title={file.fileName}
      className={cn(
        "bg-muted relative size-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
        active ? "border-primary" : "hover:border-primary/40 border-transparent",
      )}
    >
      {url ? <img src={url} alt={file.fileName} className="size-full object-cover" /> : null}
      {file.cover ? (
        <span className="bg-primary text-primary-foreground absolute top-0.5 left-0.5 rounded-full p-0.5" title="Ảnh đại diện">
          <Star className="size-2.5 fill-current" />
        </span>
      ) : null}
    </button>
  );
}

/**
 * Chọn ảnh đại diện NGAY LÚC THÊM ẢNH: tệp vừa chọn và ảnh đã có hiện thành một dải, bấm ảnh
 * nào thì ảnh đó là đại diện, kéo / trượt để căn khung vuông như avatar, rồi một lần Xác nhận
 * là tải lên và đặt đại diện. Mở không kèm tệp mới (bấm vào khung ảnh) là đổi / căn lại đại diện.
 * Chỉ lưu cách đóng khung ("x,y,zoom"), ảnh gốc giữ nguyên.
 */
export function PhotoPickerDialog({ open, onOpenChange, resource, recordId, existing, files, onDone }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  resource: string;
  recordId: number;
  existing: AttachmentInfo[];
  files: File[];
  onDone: () => void;
}) {
  const { open: notify } = useNotification();
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  // URL tạm dựng TRONG effect: dựng trong useMemo thì StrictMode chạy dọn dẹp một lần và thu
  // hồi đúng những URL mà memo còn giữ — ảnh xem trước vỡ.
  const [localUrls, setLocalUrls] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setLocalUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  const fresh = useMemo<Candidate[]>(
    () => files.map((f, i) => ({ key: `new-${i}`, name: f.name, file: f, localUrl: localUrls[i] })),
    [files, localUrls],
  );
  const candidates = useMemo<Candidate[]>(
    () => [...fresh, ...existing.map((f) => ({ key: `att-${f.id}`, name: f.fileName, existing: f }))],
    [fresh, existing],
  );

  const currentCover = existing.find((f) => f.cover);
  const [selected, setSelected] = useState<string>();
  const [crop, setCrop] = useState<CropBox>(DEFAULT_CROP);
  useEffect(() => {
    if (!open) return;
    // Đang có đại diện thì giữ nó (thêm ảnh không tự đổi đại diện); chưa có thì lấy ảnh mới đầu tiên.
    const first = currentCover ? `att-${currentCover.id}` : candidates[0]?.key;
    setSelected(first);
    setCrop(currentCover ? parseCrop(currentCover.coverCrop) : DEFAULT_CROP);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khởi tạo khi mở hộp
  }, [open]);
  const chosen = candidates.find((c) => c.key === selected);

  const pick = (c: Candidate) => {
    setSelected(c.key);
    setCrop(c.existing?.cover ? parseCrop(c.existing.coverCrop) : DEFAULT_CROP);
  };
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    // Kéo sang phải = thấy phần bên TRÁI ảnh (vị trí giảm). Hệ số theo cỡ khung và mức phóng.
    const k = 100 / (FRAME * crop.zoom);
    setCrop((c) => ({
      ...c,
      x: Math.min(100, Math.max(0, d.x - (e.clientX - d.px) * k)),
      y: Math.min(100, Math.max(0, d.y - (e.clientY - d.py) * k)),
    }));
  };

  const confirm = async () => {
    setBusy(true);
    let coverId = chosen?.existing?.id;
    let added = 0;
    for (const c of fresh) {
      const form = new FormData();
      form.append("resource", resource);
      form.append("recordId", String(recordId));
      form.append("file", c.file!);
      try {
        const info = await kyInstance.post("attachments", { body: form }).json<AttachmentInfo>();
        added += 1;
        if (c.key === selected) coverId = info.id;
      } catch (error) {
        notify?.({ type: "error", message: await errorMessage(error), description: `Không thêm được ${c.name}` });
      }
    }
    try {
      if (coverId != null) {
        await kyInstance.post(`attachments/${coverId}/cover`, {
          json: { crop: `${crop.x.toFixed(1)},${crop.y.toFixed(1)},${crop.zoom.toFixed(2)}` },
        });
      }
      if (added > 0) notify?.({ type: "success", message: `Đã thêm ${added} ảnh` });
      onDone();
      onOpenChange(false);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không đặt được ảnh đại diện" });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent size="auto" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fresh.length ? `Thêm ${fresh.length} ảnh` : "Ảnh đại diện"}</DialogTitle>
          <DialogDescription>Bấm một ảnh để làm ảnh đại diện. Kéo ảnh để căn khung, trượt để phóng to.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div
            className="bg-muted relative size-64 cursor-grab touch-none overflow-hidden rounded-xl border active:cursor-grabbing"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={() => (drag.current = null)}
          >
            {chosen ? (
              <CandidateImg c={chosen} className="pointer-events-none size-full select-none" style={cropStyle(crop)} />
            ) : null}
            <span className="bg-primary text-primary-foreground pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium">
              <Star className="size-3 fill-current" />Đại diện
            </span>
          </div>
          <div className="flex w-64 items-center gap-3">
            <span className="text-muted-foreground text-xs">Phóng</span>
            <Slider min={1} max={3} step={0.05} value={[crop.zoom]} onValueChange={([z]) => setCrop((c) => ({ ...c, zoom: z }))} />
          </div>
          {candidates.length > 1 ? (
            <div className="scrollbar-fade flex w-full justify-center-safe gap-2 overflow-x-auto pb-1">
              {candidates.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => pick(c)}
                  title={c.name}
                  className={cn(
                    "bg-muted relative size-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                    c.key === selected ? "border-primary" : "hover:border-primary/40 border-transparent",
                  )}
                >
                  <CandidateImg c={c} className="size-full object-cover" />
                  {c.key === selected ? (
                    <span className="bg-primary text-primary-foreground absolute top-0.5 left-0.5 rounded-full p-0.5">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                  {c.file ? (
                    <span className="bg-background/85 absolute right-0.5 bottom-0.5 rounded px-1 text-[0.625rem] font-medium">Mới</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button type="button" onClick={() => void confirm()} disabled={busy || !chosen}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />}
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StripThumb({ file, active, onClick }: { file: AttachmentInfo; active: boolean; onClick: () => void }) {
  const url = useImageUrl(file.id);
  return (
    <button
      type="button"
      onClick={onClick}
      title={file.fileName}
      className={cn(
        "relative size-12 shrink-0 overflow-hidden rounded-md border-2 transition-opacity",
        active ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-90",
      )}
    >
      {url ? <img src={url} alt={file.fileName} className="size-full object-cover" /> : null}
    </button>
  );
}

/**
 * Xem ảnh lớn dạng THƯ VIỆN: mũi tên hai bên, phím ← →, vuốt trên màn cảm ứng, số thứ tự và
 * dải ảnh nhỏ bên dưới để nhảy thẳng tới ảnh cần xem. Ảnh hiện nguyên tỉ lệ, không đóng khung.
 */
/** Ảnh nhỏ ở cột trái hộp phòng: bấm mở ảnh lớn (phóng, đặt đại diện, xoá ở đó). */
function RailThumb({ file, onClick }: { file: AttachmentInfo; onClick: () => void }) {
  const url = useImageUrl(file.id);
  return (
    <button type="button" onClick={onClick} title={file.fileName}
      className="bg-muted hover:border-primary/60 relative size-9 shrink-0 overflow-hidden rounded-md border transition-colors">
      {url ? <img src={url} alt={file.fileName} className="size-full object-cover" /> : null}
      {file.cover ? (
        <span className="bg-primary text-primary-foreground absolute top-0.5 left-0.5 rounded-full p-0.5" title="Ảnh đại diện">
          <Star className="size-2 fill-current" />
        </span>
      ) : null}
    </button>
  );
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

function PhotoViewer({ images, index, onIndex, onClose, onCover, onDelete }: {
  images: AttachmentInfo[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  /** Có quyền sửa: nút "Làm ảnh đại diện" (đặt thẳng, khung giữa) và "Xoá ảnh" (hỏi lại). */
  onCover?: (f: AttachmentInfo) => Promise<void>;
  onDelete?: (f: AttachmentInfo) => Promise<void>;
}) {
  const file = index != null ? images[index] : undefined;
  const url = useImageUrl(file?.id);
  const n = images.length;
  const go = (d: number) => index != null && n > 1 && onIndex((index + d + n) % n);
  const touch = useRef<number | null>(null);
  // Phóng to / thu nhỏ: nút −/+, lăn chuột, bấm đúp; phóng rồi thì kéo để xem các góc. Đổi ảnh là về cỡ vừa khung.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [file?.id]);
  const zoomTo = (z: number) => {
    const next = clampZoom(z);
    setZoom(next);
    if (next === 1) setPan({ x: 0, y: 0 });
  };
  const [busy, setBusy] = useState<null | "cover" | "delete">(null);
  const [asking, setAsking] = useState(false);
  const run = async (kind: "cover" | "delete", fn?: (f: AttachmentInfo) => Promise<void>) => {
    if (!file || !fn) return;
    setBusy(kind);
    try {
      await fn(file);
    } finally {
      setBusy(null);
      setAsking(false);
    }
  };
  return (
    <Dialog open={index != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="auto"
        className="max-w-[min(72rem,calc(100vw-2rem))] gap-3 border-none bg-neutral-950 p-3 text-white sm:max-w-[min(72rem,calc(100vw-2rem))] [&>button]:text-white"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" && zoom === 1) go(-1);
          if (e.key === "ArrowRight" && zoom === 1) go(1);
          if (e.key === "+" || e.key === "=") zoomTo(zoom + 0.5);
          if (e.key === "-") zoomTo(zoom - 0.5);
          if (e.key === "0") zoomTo(1);
        }}
      >
        <DialogTitle className="flex items-center gap-2 pe-8 text-sm font-medium">
          <span className="truncate">{file?.fileName}</span>
          {n > 1 ? <span className="text-white/60 shrink-0 tabular-nums">{(index ?? 0) + 1} / {n}</span> : null}
          {file?.cover ? (
            <span className="bg-primary text-primary-foreground flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem]">
              <Star className="size-3 fill-current" />Đại diện
            </span>
          ) : null}
        </DialogTitle>
        <div
          className={cn("relative flex h-[70dvh] touch-none items-center justify-center overflow-hidden",
            zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
          onWheel={(e) => zoomTo(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))}
          onDoubleClick={() => zoomTo(zoom > 1 ? 1 : 2)}
          onPointerDown={(e) => {
            if (zoom === 1) return;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { px: e.clientX, py: e.clientY, x: pan.x, y: pan.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (d) setPan({ x: d.x + (e.clientX - d.px), y: d.y + (e.clientY - d.py) });
          }}
          onPointerUp={() => (drag.current = null)}
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touch.current == null || zoom > 1) return;
            const dx = e.changedTouches[0].clientX - touch.current;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            touch.current = null;
          }}
        >
          {url ? (
            <img src={url} alt={file?.fileName} draggable={false}
              className="max-h-full max-w-full rounded-md object-contain select-none"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} />
          ) : <Loader2 className="size-6 animate-spin opacity-60" />}
          {n > 1 ? (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Ảnh trước"
                className="absolute left-1 flex size-10 items-center justify-center rounded-full bg-white/10 backdrop-blur hover:bg-white/25">
                <ChevronLeft className="size-6" />
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Ảnh sau"
                className="absolute right-1 flex size-10 items-center justify-center rounded-full bg-white/10 backdrop-blur hover:bg-white/25">
                <ChevronRight className="size-6" />
              </button>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full bg-white/10">
            <button type="button" onClick={() => zoomTo(zoom - 0.5)} disabled={zoom <= ZOOM_MIN} aria-label="Thu nhỏ" title="Thu nhỏ (−)"
              className="flex size-8 items-center justify-center rounded-full hover:bg-white/20 disabled:opacity-40">
              <Minus className="size-4" />
            </button>
            <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => zoomTo(zoom + 0.5)} disabled={zoom >= ZOOM_MAX} aria-label="Phóng to" title="Phóng to (+)"
              className="flex size-8 items-center justify-center rounded-full hover:bg-white/20 disabled:opacity-40">
              <Plus className="size-4" />
            </button>
            <button type="button" onClick={() => zoomTo(1)} disabled={zoom === 1} aria-label="Vừa khung" title="Vừa khung (0)"
              className="flex size-8 items-center justify-center rounded-full hover:bg-white/20 disabled:opacity-40">
              <RotateCcw className="size-3.5" />
            </button>
          </div>
          <span className="text-xs text-white/50">Lăn chuột hoặc bấm đúp để phóng, kéo để xem các góc</span>
          {file && (onCover || onDelete) ? (
            <div className="ms-auto flex items-center gap-2">
              {onCover && !file.cover ? (
                <Button type="button" size="sm" variant="secondary" disabled={busy != null} onClick={() => void run("cover", onCover)}>
                  {busy === "cover" ? <Loader2 className="animate-spin" /> : <Star />}
                  Làm ảnh đại diện
                </Button>
              ) : null}
              {onDelete ? (
                <Button type="button" size="sm" variant="ghost" className="text-white hover:bg-white/15 hover:text-white"
                  disabled={busy != null} onClick={() => setAsking(true)}>
                  <Trash2 />
                  Xoá ảnh
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {n > 1 ? (
          <div className="scrollbar-fade flex justify-center-safe gap-2 overflow-x-auto pb-1">
            {images.map((f, i) => (
              <StripThumb key={f.id} file={f} active={i === index} onClick={() => onIndex(i)} />
            ))}
          </div>
        ) : null}
        <AlertDialog open={asking} onOpenChange={(o) => !busy && setAsking(o)}>
          {asking ? (
            <ConfirmContent tone="danger" title="Xoá ảnh này?"
              description={file?.cover ? "Đây là ảnh đại diện — xoá xong, ảnh đầu tiên còn lại làm đại diện." : "Ảnh bị xoá hẳn khỏi hồ sơ."}
              cancelLabel="Giữ lại" confirmLabel="Xoá ảnh" busy={busy === "delete"} keepOpen
              onConfirm={() => void run("delete", onDelete)} />
          ) : null}
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Ảnh thiết bị: khung VUÔNG hiện ảnh đại diện (đóng khung theo vùng đã căn), dưới là dải ảnh
 * nhỏ. Ảnh là tệp đính kèm dạng ảnh của tài sản. Ở trang Sửa: "Thêm ảnh" chọn nhiều tệp và
 * mở hộp chọn đại diện + căn khung trước khi tải lên; bấm vào khung ảnh để đổi / căn lại đại
 * diện. Chưa đặt đại diện thì dùng ảnh đầu tiên.
 */
export function EquipmentPhoto({ recordId, canWrite, editable, resource = "equipment", noun = "thiết bị", compact, rail }: {
  /** Ô vuông nhỏ (đầu hồ sơ trường): chỉ khung ảnh, không chữ, không nút — trống thì bấm vào để thêm ảnh. */
  compact?: boolean;
  /**
   * Cột trái hộp phòng (Xem / Sửa / Thêm dùng chung): khung ảnh đại diện, dải ảnh nhỏ + ô "+", dòng luật
   * "3/10 ảnh · JPG, PNG, WEBP · tối đa 10 MB/ảnh". Đổi ảnh ngay ở hộp Xem, không phải vào Sửa.
   */
  rail?: boolean;
  /** Bản ghi gắn ảnh — mặc định thiết bị; hồ sơ trường dùng `schools`. */
  resource?: string;
  /** Tên vật trong câu nhắc: "Chưa có ảnh thiết bị", "Lưu thiết bị xong…". */
  noun?: string;
  /** Chưa có (đang thêm mới): chưa có bản ghi để gắn ảnh. */
  recordId: number | undefined;
  canWrite: boolean;
  /** Ở trang Sửa: thêm ảnh, chọn ảnh đại diện. */
  editable?: boolean;
}) {
  const queryClient = useQueryClient();
  const { open: notify } = useNotification();
  const input = useRef<HTMLInputElement>(null);
  const key = ["attachments", resource, recordId];
  const { data } = useQuery({
    queryKey: key,
    enabled: recordId != null,
    queryFn: () =>
      kyInstance
        .get("attachments", { searchParams: { resource, recordId: String(recordId) } })
        .json<AttachmentInfo[]>(),
  });
  // Ảnh đại diện đứng đầu, còn lại theo thứ tự tải lên (cũ trước).
  const images = (Array.isArray(data) ? data : [])
    .filter((f) => f.contentType?.startsWith("image/"))
    .sort((a, b) => Number(!!b.cover) - Number(!!a.cover) || a.id - b.id);
  const cover = images[0];
  const [pickId, setPickId] = useState<number | null>(null);
  const current = images.find((f) => f.id === pickId) ?? cover;
  const url = useImageUrl(current?.id);
  const [viewing, setViewing] = useState<number | null>(null);
  const view = (f: AttachmentInfo | undefined) => f && setViewing(Math.max(0, images.findIndex((x) => x.id === f.id)));
  const [picker, setPicker] = useState<{ files: File[] } | null>(null);
  const mayEdit = editable && canWrite && recordId != null;
  const isCoverShown = current?.id === cover?.id;

  const openPicker = (files: File[]) => setPicker({ files });
  const onFrameClick = () => (mayEdit ? openPicker([]) : view(current));
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const fileInput = (
    <input ref={input} type="file" accept={PHOTO_ACCEPT} multiple className="hidden"
      onChange={(e) => {
        const { ok, problems } = screenPhotos(Array.from(e.target.files ?? []), images.length);
        if (problems.length) notify?.({ type: "error", message: ok.length ? "Bỏ qua một số tệp" : "Không thêm được ảnh", description: problems.join(" · ") });
        if (ok.length) openPicker(ok);
        e.target.value = "";
      }} />
  );
  const full = images.length >= PHOTO_MAX;
  const addPhotos = () => (full
    ? notify?.({ type: "error", message: `Đã đủ ${PHOTO_MAX} ảnh`, description: "Xoá bớt ảnh cũ (mở ảnh → Xoá ảnh) rồi thêm." })
    : input.current?.click());
  const setCover = async (f: AttachmentInfo) => {
    try {
      await kyInstance.post(`attachments/${f.id}/cover`, { json: { crop: "50.0,50.0,1.00" } });
      await refresh();
      notify?.({ type: "success", message: "Đã đổi ảnh đại diện" });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    }
  };
  const remove = async (f: AttachmentInfo) => {
    try {
      await kyInstance.delete(`attachments/${f.id}`);
      // Xoá ảnh đại diện: ảnh còn lại đầu tiên tự đứng đầu (sắp theo `cover` rồi id) — không cần đặt lại.
      const rest = images.filter((x) => x.id !== f.id);
      setViewing(rest.length ? Math.min(viewing ?? 0, rest.length - 1) : null);
      setPickId(null);
      await refresh();
      notify?.({ type: "success", message: "Đã xoá ảnh" });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    }
  };
  const dialogs = (
    <>
      {mayEdit && picker ? (
        <PhotoPickerDialog
          open
          onOpenChange={(o) => !o && setPicker(null)}
          resource={resource}
          recordId={recordId}
          existing={images}
          files={picker.files}
          onDone={() => { void refresh(); setPickId(null); }}
        />
      ) : null}
      <PhotoViewer images={images} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)}
        onCover={mayEdit ? setCover : undefined} onDelete={mayEdit ? remove : undefined} />
    </>
  );

  if (rail) {
    if (recordId == null) {
      return (
        <div className="text-muted-foreground flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-3 text-center text-xs">
          <ImagePlus className="size-5 opacity-60" />
          Lưu xong mới thêm được ảnh
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {fileInput}
        <div className="bg-muted/60 group relative aspect-[4/3] w-full overflow-hidden rounded-xl border">
          {cover ? (
            <button type="button" onClick={() => view(cover)} aria-label="Xem ảnh lớn" className="size-full cursor-zoom-in">
              {url && current?.id === cover.id ? (
                <img src={url} alt={cover.fileName} className="size-full"
                  style={cover.cover ? cropStyle(parseCrop(cover.coverCrop)) : { objectFit: "cover" }} />
              ) : null}
            </button>
          ) : (
            <button type="button" disabled={!mayEdit} onClick={addPhotos}
              className="text-muted-foreground hover:text-primary flex size-full flex-col items-center justify-center gap-1.5 text-xs transition-colors disabled:pointer-events-none">
              {mayEdit ? <ImagePlus className="size-6" /> : <ImageOff className="size-6 opacity-60" />}
              {mayEdit ? `Thêm ảnh ${noun}` : `Chưa có ảnh ${noun}`}
            </button>
          )}
          {cover ? (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between gap-1">
              {cover.cover ? (
                <span className="bg-primary text-primary-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium">
                  <Star className="size-3 fill-current" />Đại diện
                </span>
              ) : <span />}
              {mayEdit ? (
                <button type="button" onClick={() => openPicker([])} title="Chọn ảnh đại diện, căn khung"
                  className="bg-background/90 text-foreground shadow-e1 pointer-events-auto hidden items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium group-hover:flex">
                  <Pencil className="size-3.5" />Đổi đại diện
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {images.length > 1 || (mayEdit && images.length > 0) ? (
          <div className="flex flex-wrap gap-1.5">
            {images.map((f) => <RailThumb key={f.id} file={f} onClick={() => view(f)} />)}
            {mayEdit && !full ? (
              <button type="button" onClick={addPhotos} aria-label="Thêm ảnh" title="Thêm ảnh"
                className="text-muted-foreground hover:border-primary/50 hover:text-primary flex size-9 items-center justify-center rounded-md border border-dashed transition-colors">
                <Plus className="size-4" />
              </button>
            ) : null}
          </div>
        ) : null}
        {mayEdit ? (
          // Chỉ một dòng ngắn bên phải; định dạng và cỡ tệp ở chú thích khi rê chuột (và trong câu báo lỗi khi chọn sai).
          <p title={PHOTO_HINT}
            className={cn("text-muted-foreground text-end text-xs tabular-nums", full && "text-warning-text font-medium")}>
            {images.length ? `${images.length}/${PHOTO_MAX} ảnh` : `Tối đa ${PHOTO_MAX} ảnh`}
          </p>
        ) : null}
        {dialogs}
      </div>
    );
  }

  if (compact) {
    const label = current ? (mayEdit ? "Đổi ảnh" : "Xem ảnh lớn") : mayEdit ? `Thêm ảnh ${noun}` : `Chưa có ảnh ${noun}`;
    return (
      <>
        {fileInput}
        <button type="button" title={label} aria-label={label}
          disabled={!current && !mayEdit}
          onClick={() => (current ? onFrameClick() : input.current?.click())}
          className="bg-muted/60 text-muted-foreground hover:border-primary/50 hover:text-primary group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border transition-colors disabled:pointer-events-none">
          {current && url ? (
            <img src={url} alt={current.fileName} className="size-full"
              style={current.cover ? cropStyle(parseCrop(current.coverCrop)) : { objectFit: "cover" }} />
          ) : mayEdit ? <ImagePlus className="size-6" /> : <ImageOff className="size-6 opacity-60" />}
        </button>
        {dialogs}
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="bg-muted/60 relative mx-auto aspect-square w-full max-w-64 overflow-hidden rounded-xl border">
        {current ? (
          <button type="button" onClick={onFrameClick} className="group size-full"
            aria-label={mayEdit ? "Đổi ảnh đại diện" : "Xem ảnh lớn"}>
            {url ? (
              <img
                src={url}
                alt={current.fileName}
                className="size-full"
                style={isCoverShown && current.cover ? cropStyle(parseCrop(current.coverCrop)) : { objectFit: "cover" }}
              />
            ) : null}
            <span className="bg-background/85 text-foreground absolute top-2 right-2 hidden items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium shadow-e1 group-hover:flex">
              {mayEdit ? <><Pencil className="size-3.5" />Đổi đại diện</> : <Maximize2 className="size-4" />}
            </span>
          </button>
        ) : (
          <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-2 p-4 text-center">
            <ImageOff className="size-8 opacity-60" />
            <p className="text-sm">Chưa có ảnh {noun}</p>
            {editable ? (
              <p className="text-xs">{recordId == null ? `Lưu ${noun} xong mới thêm được ảnh.` : "Bấm “Thêm ảnh” bên dưới."}</p>
            ) : canWrite ? (
              <p className="text-xs">Thêm ảnh ở trang Sửa.</p>
            ) : null}
          </div>
        )}
        {current?.cover ? (
          <span className="bg-primary text-primary-foreground pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium">
            <Star className="size-3 fill-current" />Đại diện
          </span>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="scrollbar-fade mx-auto flex max-w-64 gap-2 overflow-x-auto pb-1">
          {images.map((f) => (
            <Thumb key={f.id} file={f} active={f.id === current?.id}
              onClick={() => (mayEdit ? setPickId(f.id) : view(f))} />
          ))}
        </div>
      ) : null}

      {mayEdit ? (
        <div className="mx-auto max-w-64">
          {fileInput}
          <Button type="button" variant="outline" className="w-full" onClick={() => input.current?.click()}>
            <ImagePlus />
            Thêm ảnh
          </Button>
        </div>
      ) : null}

      {dialogs}
    </div>
  );
}
