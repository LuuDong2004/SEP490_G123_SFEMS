import { ShieldCheck } from "lucide-react";
import { Link } from "react-router";

import { formatPlainDate } from "@/shared/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { VOUCHER_ROUTES } from "@/domains/equipment/types";
import type { AfterRepairWarranty } from "@/domains/voucher-ops/types";
import { useAfterRepairWarranties } from "@/features/organization/vouchers/use-after-repair-warranties";

function OrderLink({ w }: { w: AfterRepairWarranty }) {
  return (
    <Link className="text-primary hover:underline" to={`${VOUCHER_ROUTES.repair_orders}/show/${w.orderId}`}>
      {w.orderCode ?? `phiếu #${w.orderId}`}
    </Link>
  );
}

/**
 * Ô "Bảo hành sau sửa chữa" trên hồ sơ thiết bị: đến ngày nào, theo phiếu sửa chữa nào (bấm mở), bên nào sửa.
 * Đứng cạnh "Hết hạn bảo hành" của hãng chứ không đè lên nó.
 */
export function AfterRepairWarrantyValue({ equipmentId }: { equipmentId: number }) {
  const w = useAfterRepairWarranties([equipmentId]).get(equipmentId);
  if (!w) {
    return <>—</>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <span>đến {formatPlainDate(w.until)}</span>
      {w.active ? null : <Badge variant="neutral">Đã hết hạn</Badge>}
      <span className="text-muted-foreground font-normal">
        · theo phiếu <OrderLink w={w} />{w.vendor ? ` · ${w.vendor}` : ""}
      </span>
    </span>
  );
}

/**
 * Nhắc trên form báo hỏng: tài sản còn bảo hành của bên sửa thì nên gửi bảo hành chứ không thuê sửa trả tiền
 * lần nữa. Chỉ nhắc, không chặn — cán bộ có thể có lý do khác (bên sửa đã đóng cửa, hỏng chỗ khác).
 */
export function AfterRepairWarrantyHint({ equipmentIds, handling, onUseWarranty }: {
  equipmentIds: number[];
  handling: string;
  /** Chọn "Gửi bảo hành" và điền bên sửa làm nhà cung cấp bảo hành. */
  onUseWarranty: (vendor: string | null) => void;
}) {
  const active = [...useAfterRepairWarranties(equipmentIds).values()].filter((w) => w.active);
  if (active.length === 0) {
    return null;
  }
  const vendor = active.find((w) => w.vendor)?.vendor ?? null;
  return (
    <Alert>
      <ShieldCheck className="text-success-text" />
      <AlertTitle>Còn bảo hành của bên sửa</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-0.5 ps-4">
          {active.map((w) => (
            <li key={w.equipmentId}>
              Đến {formatPlainDate(w.until)}{w.vendor ? ` — ${w.vendor}` : ""}, theo phiếu <OrderLink w={w} />
            </li>
          ))}
        </ul>
        {handling === "WARRANTY" ? null : (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span>Nên gửi bảo hành thay vì sửa lại.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => onUseWarranty(vendor)}>
              Chọn "Gửi bảo hành"
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
