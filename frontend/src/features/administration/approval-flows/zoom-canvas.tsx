import { Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

const MIN = 0.4;
const MAX = 1.6;
const clamp = (z: number) => Math.min(MAX, Math.max(MIN, z));

/**
 * Khung sơ đồ thu phóng được, như các công cụ vẽ quy trình: lăn chuột để thu phóng quanh con trỏ, kéo nền để
 * di chuyển, nút ở góc dưới để thu / phóng / vừa khung. Không có thanh cuộn — sơ đồ to hơn khung thì kéo.
 *
 * Kéo NỀN mới di chuyển; bấm lên một nút của sơ đồ (thẻ bước, nút "+") thì để nguyên cho nút đó — thẻ bước
 * dùng kéo thả HTML5 riêng, hai thứ không được giành nhau.
 *
 * `fitKey` đổi (vd. thêm / bỏ nhánh) thì tự vừa khung lại.
 */
export function ZoomCanvas({ children, fitKey, className }: { children: ReactNode; fitKey?: string; className?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  /** Vừa khung: thu nhỏ cho lọt cả sơ đồ (không phóng quá 100%), rồi đặt vào giữa. */
  const fit = useCallback(() => {
    const f = frame.current;
    const c = content.current;
    if (!f || !c) return;
    const pad = 48;
    const z = clamp(Math.min(1, (f.clientWidth - pad) / c.offsetWidth, (f.clientHeight - pad) / c.offsetHeight));
    setZoom(z);
    setPan({ x: (f.clientWidth - c.offsetWidth * z) / 2, y: (f.clientHeight - c.offsetHeight * z) / 2 });
  }, []);

  useLayoutEffect(() => {
    fit();
  }, [fit, fitKey]);

  /** Thu phóng quanh một điểm của khung (con trỏ, hoặc giữa khung khi bấm nút). */
  const zoomAt = useCallback((next: number, cx?: number, cy?: number) => {
    const f = frame.current;
    if (!f) return;
    const x = cx ?? f.clientWidth / 2;
    const y = cy ?? f.clientHeight / 2;
    setZoom((z) => {
      const nz = clamp(next > 0 ? next : z);
      setPan((p) => ({ x: x - ((x - p.x) * nz) / z, y: y - ((y - p.y) * nz) / z }));
      return nz;
    });
  }, []);

  // Lăn chuột: phải gắn listener không-passive thì mới chặn được trang cuộn theo.
  useEffect(() => {
    const f = frame.current;
    if (!f) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = f.getBoundingClientRect();
      setZoom((z) => {
        const nz = clamp(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setPan((p) => ({ x: x - ((x - p.x) * nz) / z, y: y - ((y - p.y) * nz) / z }));
        return nz;
      });
    };
    f.addEventListener("wheel", onWheel, { passive: false });
    return () => f.removeEventListener("wheel", onWheel);
  }, []);

  const button = "text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors [&_svg]:size-3.5";

  return (
    <div
      ref={frame}
      onPointerDown={(e) => {
        // Chỉ kéo khi bấm vào NỀN — không phải vào thẻ, nút hay ô nhập trong sơ đồ.
        if (e.button !== 0 || (e.target as HTMLElement).closest("button, [draggable=true], input, [role=menu]")) return;
        drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      className={cn(
        "relative min-h-72 flex-1 cursor-grab touch-none overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] select-none active:cursor-grabbing",
        className,
      )}
      style={{ backgroundSize: `${18 * zoom}px ${18 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
    >
      <div
        ref={content}
        className="absolute top-0 left-0 w-max origin-top-left p-2"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {children}
      </div>

      {/* Điều khiển thu phóng, góc dưới phải. */}
      <div className="bg-card shadow-e2 absolute right-3 bottom-3 flex items-center gap-0.5 rounded-lg border p-0.5" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className={button} onClick={() => zoomAt(zoom / 1.2)} aria-label="Thu nhỏ" title="Thu nhỏ">
          <Minus />
        </button>
        <button type="button" className="text-muted-foreground hover:bg-muted w-12 rounded-md py-1 text-xs tabular-nums" onClick={() => zoomAt(1)} title="Về 100%">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className={button} onClick={() => zoomAt(zoom * 1.2)} aria-label="Phóng to" title="Phóng to">
          <Plus />
        </button>
        <span className="bg-border mx-0.5 h-4 w-px" />
        <button type="button" className={button} onClick={fit} aria-label="Vừa khung" title="Vừa khung">
          <Maximize2 />
        </button>
      </div>
    </div>
  );
}
