import { CameraOff, CheckCircle2, CircleAlert, Info, ScanLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";

/** Kết quả một lần quét, để hiện trong nhật ký của hộp quét. */
export type ScanResult = {
  tone: "success" | "info" | "warning";
  text: string;
  action?: { label: string; run: () => void };
};

/**
 * Mã tài sản trong nội dung tem. Tem QR có thể mang đường dẫn tra cứu có tham số `code`; mã vạch và máy quét cầm
 * tay thì mang thẳng mã.
 */
function codeFromScan(text: string): string {
  const raw = text.trim();
  try {
    const code = new URL(raw).searchParams.get("code");
    if (code) return code.trim();
  } catch {
    // Không phải đường dẫn — chính là mã.
  }
  return raw;
}

/** Phần tối thiểu của `BarcodeDetector` (chưa có trong lib.dom của TypeScript). */
type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorClass = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

/** Một hàm đọc mã từ khung hình video: `BarcodeDetector` nếu trình duyệt có, không thì jsQR (chỉ QR). */
async function makeReader(): Promise<(video: HTMLVideoElement) => Promise<string | null>> {
  const Native = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (Native) {
    try {
      const supported = (await Native.getSupportedFormats?.()) ?? ["qr_code"];
      const formats = ["qr_code", "code_128"].filter((f) => supported.includes(f));
      if (formats.length) {
        const detector = new Native({ formats });
        return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
      }
    } catch {
      // Có lớp mà không dùng được (một số bản Chrome trên Windows) — rơi xuống jsQR.
    }
  }
  // iOS Safari, Firefox, Chrome trên Windows chưa có BarcodeDetector. Tải jsQR khi cần, không vào gói chính.
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!ctx || !video.videoWidth) return null;
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

type LogEntry = ScanResult & { key: number; code: string };

const TONE: Record<ScanResult["tone"], { icon: ReactNode; className: string }> = {
  success: { icon: <CheckCircle2 />, className: "text-success-text" },
  info: { icon: <Info />, className: "text-info-text" },
  warning: { icon: <CircleAlert />, className: "text-warning-text" },
};

/**
 * Quét tem để ghi kết quả kiểm đếm: camera sau của máy, quét liên tiếp, mỗi mã một dòng nhật ký. Cùng một mã
 * quét lại trong vài giây thì bỏ qua (camera thấy tem nhiều khung liền). Luôn có ô gõ / dán mã — máy không có
 * camera, trình duyệt chặn camera, hoặc dùng máy quét cầm tay (gõ mã như bàn phím rồi Enter).
 */
export function ScanDialog({ open, onOpenChange, onScan }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => Promise<ScanResult> | ScanResult;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "off">("starting");
  const [term, setTerm] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const last = useRef<{ code: string; at: number } | null>(null);
  const busy = useRef(false);
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  const handle = useCallback(async (text: string) => {
    const code = codeFromScan(text);
    if (!code) return;
    const now = Date.now();
    if (last.current && last.current.code.toLowerCase() === code.toLowerCase() && now - last.current.at < 2500) return;
    last.current = { code, at: now };
    const result = await onScanRef.current(code);
    setLog((prev) => [{ ...result, code, key: now }, ...prev].slice(0, 30));
    if (result.tone === "success") navigator.vibrate?.(60);
  }, []);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    setCamera("starting");
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera("off");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped || !video.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current.srcObject = stream;
        await video.current.play();
        const read = await makeReader();
        setCamera("on");
        const tick = async () => {
          if (stopped) return;
          if (!busy.current && video.current && video.current.readyState >= 2) {
            busy.current = true;
            try {
              const text = await read(video.current);
              if (text) await handle(text);
            } catch {
              // Một khung hỏng thì thôi, khung sau đọc lại.
            } finally {
              busy.current = false;
            }
          }
          timer = window.setTimeout(() => void tick(), 250);
        };
        void tick();
      } catch {
        if (!stopped) setCamera("off");
      }
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, handle]);

  useEffect(() => {
    if (!open) {
      setLog([]);
      setTerm("");
      last.current = null;
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_auto_auto_minmax(0,1fr)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quét mã tài sản</DialogTitle>
          <DialogDescription>Đưa tem QR vào khung. Tài sản trên phiếu được đánh dấu “Có”.</DialogDescription>
        </DialogHeader>

        <div className="bg-muted relative aspect-[4/3] overflow-hidden rounded-lg">
          <video ref={video} muted playsInline className={cn("size-full object-cover", camera !== "on" && "invisible")} />
          {camera === "on" ? (
            <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.25)]" />
          ) : (
            <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm">
              {camera === "starting" ? <ScanLine className="size-6" /> : <CameraOff className="size-6" />}
              {camera === "starting" ? "Đang mở camera…" : "Không mở được camera. Gõ hoặc dán mã bên dưới."}
            </div>
          )}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = term.trim();
            if (!value) return;
            last.current = null;
            setTerm("");
            void handle(value);
            input.current?.focus();
          }}
        >
          <Input
            ref={input}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Gõ hoặc dán mã tài sản"
            aria-label="Mã tài sản"
            className="font-mono"
          />
          <Button type="submit" disabled={!term.trim()}>Ghi nhận</Button>
        </form>

        <div className="min-h-0 overflow-auto">
          {log.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-xs">Chưa quét mã nào.</p>
          ) : (
            <ul className="divide-y text-sm">
              {log.map((entry) => (
                <li key={entry.key} className="flex items-start gap-2 py-2">
                  <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", TONE[entry.tone].className)}>{TONE[entry.tone].icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{entry.text}</span>
                    <span className="text-muted-foreground block truncate font-mono text-xs">{entry.code}</span>
                  </span>
                  {entry.action ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0"
                      onClick={() => {
                        entry.action?.run();
                        setLog((prev) => prev.map((x) => (x.key === entry.key ? { ...x, action: undefined, text: `${x.text} — đã thêm vào tài sản thừa` } : x)));
                      }}
                    >
                      {entry.action.label}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
