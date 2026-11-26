import { Check, Copy, QrCode, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

/** Địa chỉ chỉ máy này mở được: điện thoại quét sẽ không vào được. */
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Kiểm kê bằng ĐIỆN THOẠI: mã QR mang đúng đường dẫn biên bản đang mở. Tổ kiểm kê quét, đăng nhập cùng tài khoản, rồi
 * cầm máy đi từng phòng đánh dấu thiết bị và hạng mục CSVC. Biên bản còn kiểm đếm được thì tự gợi ý
 * mỗi lần vào phiếu; nút QR ở tiêu đề khối Thiết bị mở lại bất cứ lúc nào.
 */
export function MobileQrButton({ sessionId, suggest }: { sessionId: number; suggest: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Mở biên bản còn kiểm đếm là gợi ý ngay — mỗi lần vào phiếu (trưởng nhóm 27/11/2026).
  // Trong khung xem thử điện thoại (iframe của /mobile-preview) thì không gợi ý lại.
  const framed = window.self !== window.top;
  useEffect(() => {
    if (suggest && !framed) setOpen(true);
  }, [sessionId, suggest, framed]);
  const openPreview = () => {
    window.open(`/mobile-preview?path=${encodeURIComponent(window.location.pathname + window.location.search)}`, "_blank", "noopener");
    setOpen(false);
  };
  const url = window.location.href.split("#")[0];
  const local = LOCAL_HOSTS.includes(window.location.hostname);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="icon" className="rounded-full" aria-label="Kiểm kê bằng điện thoại"
        title="Kiểm kê bằng điện thoại — quét mã QR" onClick={() => setOpen(true)}>
        <QrCode />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="text-primary size-5" />
              Kiểm kê bằng điện thoại
            </DialogTitle>
            <DialogDescription>Quét mã để kiểm kê từng phòng trên điện thoại.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {/* Hiệu ứng quét: bốn góc khung ngắm và một vạch sáng chạy lên xuống (tắt khi người dùng chọn giảm chuyển động). */}
            <style>{`@keyframes inventory-qr-scan { 0%, 100% { top: 10%; } 50% { top: 92%; } }`}</style>
            <div className="relative overflow-hidden rounded-xl border bg-white p-4">
              <QRCodeSVG value={url} size={200} />
              {["top-1.5 left-1.5 border-t-3 border-l-3 rounded-tl-lg", "top-1.5 right-1.5 border-t-3 border-r-3 rounded-tr-lg",
                "bottom-1.5 left-1.5 border-b-3 border-l-3 rounded-bl-lg", "bottom-1.5 right-1.5 border-b-3 border-r-3 rounded-br-lg"].map((c) => (
                <span key={c} aria-hidden className={`border-primary pointer-events-none absolute size-7 ${c}`} />
              ))}
              {/* Vệt sáng mờ phía trên + vạch quét đậm ở đáy — cùng chạy lên xuống. */}
              <span aria-hidden className="pointer-events-none absolute inset-x-2 -mt-12 h-12 motion-reduce:hidden"
                style={{ animation: "inventory-qr-scan 5s ease-in-out infinite" }}>
                <span className="from-primary/0 to-primary/25 absolute inset-0 bg-gradient-to-b" />
                <span className="bg-primary absolute inset-x-0 bottom-0 h-[3px] rounded-full shadow-[0_0_16px_4px] shadow-primary/60" />
              </span>
            </div>
            <ol className="text-muted-foreground w-full list-decimal space-y-0.5 ps-5 text-sm">
              <li>Quét mã bằng camera điện thoại.</li>
              <li>Đăng nhập tài khoản của mình.</li>
              <li>Mở từng phòng, tích xong bấm "Lưu kết quả".</li>
            </ol>
            {local ? (
              <p className="text-warning-text text-center text-xs">
                Địa chỉ {window.location.host} chỉ mở được trên máy này — bấm "Xem giao diện điện thoại" để thử ngay.
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => void copy()}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Đã chép đường dẫn" : "Chép đường dẫn"}
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={openPreview}>
                <Smartphone />
                Xem giao diện điện thoại
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>Dùng trên máy tính</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
