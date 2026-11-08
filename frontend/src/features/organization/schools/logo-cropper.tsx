import { ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Slider } from "@/shared/ui/slider";

/** Cạnh khung cắt trên màn hình và cạnh ảnh xuất ra. */
const VIEW = 280;
const OUTPUT = 256;

/**
 * Cắt logo về tỉ lệ 1:1: kéo ảnh để căn, thanh trượt để phóng to. Khung tròn
 * cho thấy phần sẽ hiện ở các chỗ dùng logo; ảnh xuất ra là hình VUÔNG 256px
 * (góc ngoài vòng tròn vẫn giữ, để nhãn in dùng được cả hình vuông).
 *
 * <p>Ảnh luôn phủ kín khung: mức thu nhỏ tối thiểu là mức vừa khít cạnh ngắn,
 * và vị trí bị kẹp để không lộ khoảng trống.
 */
export function LogoCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File | null;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      // Mở ra ở mức vừa khít, căn giữa ảnh trong khung.
      const s0 = VIEW / Math.min(image.width, image.height);
      setImg(image);
      setZoom(1);
      setPos({ x: (VIEW - image.width * s0) / 2, y: (VIEW - image.height * s0) / 2 });
    };
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Tỉ lệ cơ bản: cạnh ngắn của ảnh vừa khít khung.
  const base = img ? VIEW / Math.min(img.width, img.height) : 1;
  const scale = base * zoom;
  const w = img ? img.width * scale : 0;
  const h = img ? img.height * scale : 0;

  const clamp = (x: number, y: number) => ({
    x: Math.min(0, Math.max(VIEW - w, x)),
    y: Math.min(0, Math.max(VIEW - h, y)),
  });

  const changeZoom = (next: number) => {
    const center = { x: (VIEW / 2 - pos.x) / scale, y: (VIEW / 2 - pos.y) / scale };
    const nextScale = base * next;
    const nw = (img?.width ?? 0) * nextScale;
    const nh = (img?.height ?? 0) * nextScale;
    const x = VIEW / 2 - center.x * nextScale;
    const y = VIEW / 2 - center.y * nextScale;
    setZoom(next);
    setPos({ x: Math.min(0, Math.max(VIEW - nw, x)), y: Math.min(0, Math.max(VIEW - nh, y)) });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPos(clamp(drag.current.px + e.clientX - drag.current.x, drag.current.py + e.clientY - drag.current.y));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const exportImage = () => {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const k = OUTPUT / VIEW;
    canvas.getContext("2d")!.drawImage(img, pos.x * k, pos.y * k, w * k, h * k);
    onDone(canvas.toDataURL("image/png"));
  };

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cắt logo</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative cursor-grab touch-none overflow-hidden rounded-lg bg-muted select-none active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={(e) => changeZoom(Math.min(4, Math.max(1, zoom - e.deltaY * 0.002)))}
          >
            {img ? (
              <img
                src={img.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{ left: pos.x, top: pos.y, width: w, height: h }}
              />
            ) : null}
            {/* Khung tròn: phần ngoài vòng tròn làm tối để thấy logo sẽ hiện ra sao. */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ boxShadow: "0 0 0 999px rgb(0 0 0 / 0.45)", outline: "2px solid white" }}
            />
          </div>
          <div className="flex w-full items-center gap-3">
            <ZoomOut className="text-muted-foreground size-4" />
            <Slider min={1} max={4} step={0.01} value={[zoom]} onValueChange={([v]) => changeZoom(v)} />
            <ZoomIn className="text-muted-foreground size-4" />
          </div>
          <p className="text-muted-foreground text-xs">Kéo để căn vị trí, lăn chuột hoặc kéo thanh trượt để phóng to.</p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Huỷ
            </Button>
          </DialogClose>
          <Button type="button" onClick={exportImage} disabled={!img}>
            Dùng ảnh này
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
