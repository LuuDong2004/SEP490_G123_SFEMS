import JsBarcode from "jsbarcode";
import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

/**
 * Mã vạch Code 128 của mã tài sản. Vẽ sau khi phần tử đã có trong DOM, nên tách thành component riêng
 * (nằm trong portal của hộp thoại, không thể gọi trong effect của cha).
 */
function Barcode({ value }: { value: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!svg.current) return;
    try {
      JsBarcode(svg.current, value, { format: "CODE128", displayValue: true, height: 70, margin: 8, width: 2 });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [value]);

  if (failed) {
    return <p className="text-destructive text-sm">Mã tài sản có ký tự không đưa được vào mã vạch.</p>;
  }
  return <svg ref={svg} className="h-auto w-full max-w-xs" role="img" aria-label={`Mã vạch ${value}`} />;
}

/**
 * Nút mở hộp thoại mã QR và mã vạch của một thiết bị (TS-06). Chỉ để hiển thị và quét: QR mã hoá đường
 * dẫn tới đúng hồ sơ thiết bị này, mã vạch Code 128 mã hoá mã tài sản. Không có chức năng in tem.
 */
export function EquipmentCodesButton({ equipmentId, code }: { equipmentId: number; code: string }) {
  const profileUrl = `${window.location.origin}/equipment/show/${equipmentId}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <QrCode />
          Mã QR & mã vạch
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mã QR và mã vạch</DialogTitle>
          <DialogDescription>
            Quét mã QR để mở hồ sơ thiết bị. Mã vạch mang mã tài sản <span className="font-mono">{code}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6">
          <div className="rounded-md bg-white p-3">
            <QRCodeSVG value={profileUrl} size={200} level="M" includeMargin />
          </div>
          <Barcode value={code} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
