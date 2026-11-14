import JsBarcode from "jsbarcode";
import { Printer, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { lookupUrl } from "./labels";

/** Mã vạch Code 128 của mã tài sản — đọc được bằng mọi máy quét cầm tay, kể cả loại không đọc QR. */
function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, { format: "CODE128", height: 56, width: 1.6, margin: 0, fontSize: 13, background: "transparent" });
    } catch {
      // Mã có ký tự ngoài bảng Code 128 thì không vẽ — QR bên cạnh vẫn dùng được.
      ref.current.replaceChildren();
    }
  }, [value]);
  return <svg ref={ref} className="h-auto w-full text-foreground [&_rect]:fill-current [&_text]:fill-current" />;
}

/**
 * Mã QR và mã vạch của MỘT tài sản trên hồ sơ thiết bị: nút "Mã QR & mã vạch" ngang tầm tên thiết bị, bấm mở
 * hộp có QR lớn, mã vạch và nút In tem. Cùng nội dung với tem in: QR trỏ về màn tra cứu của hệ thống, mã vạch mang mã
 * tài sản. Nút không chiếm chỗ của thẻ đầu — một thẻ riêng hay một cột mã cạnh tên đều để lại khoảng trống.
 */
export function AssetCodes({ id, code, name, iconOnly }: { id: number; code: string; name: string; iconOnly?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {iconOnly ? (
          // Hồ sơ thiết bị: chỉ biểu tượng, đứng ngay cạnh mã.
          <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-primary size-7 shrink-0"
            data-print="hide" title="Mã QR & mã vạch" aria-label="Mã QR & mã vạch">
            <QrCode />
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" className="shrink-0" data-print="hide">
            <QrCode /> Mã QR & mã vạch
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="auto" className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mã QR & mã vạch</DialogTitle>
          <DialogDescription className="truncate">{name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-5 py-2">
          <div className="flex flex-col items-center gap-1.5">
            <div className="ring-border rounded-md bg-white p-3 ring-1">
              <QRCodeSVG value={lookupUrl(code)} size={200} level="M" />
            </div>
            <span className="text-muted-foreground text-xs">Quét để mở tra cứu</span>
          </div>
          <div className="flex w-full max-w-64 flex-col items-center gap-1.5">
            <Barcode value={code} />
            <span className="text-muted-foreground text-xs">Mã vạch Code 128</span>
          </div>
        </div>
        <DialogFooter>
          <Button asChild>
            <Link to={`/equipment-labels?equipment=${id}`}><Printer />In tem</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
