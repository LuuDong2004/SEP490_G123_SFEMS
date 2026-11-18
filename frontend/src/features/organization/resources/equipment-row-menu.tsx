import {
  FlaskConical,
  HandHelping,
  PackageMinus,
  PackageOpen,
  QrCode,
  Truck,
  TriangleAlert,
  Undo2,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";

import { getAuthorities } from "@/shared/api/session";
import { usePerspective } from "@/shared/hooks/use-perspective";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

/** Phần của một dòng bảng Theo tài sản mà menu cần. */
export type MenuAsset = { equipmentId: number; kind: "serial" | "bulk"; status: string; school: { id: number } };

/**
 * Một nghiệp vụ lập phiếu từ tài sản đang chọn. `statuses` là đúng tập trạng thái mà form phiếu đó cho chọn (cùng hằng
 * trên form của từng phiếu và ở service phía máy chủ) — mục bị khoá khi có tài sản không hợp, kèm lý do.
 */
type VoucherAction = {
  key: string;
  label: string;
  icon: ReactNode;
  resource: string;
  path: string;
  query?: string;
  statuses: string[];
  /** `bulk`: chỉ lô vật tư; mặc định chỉ thiết bị quản lý từng cái. */
  kind?: "bulk";
  /** Phiếu chỉ nhận một tài sản. */
  single?: boolean;
};

const IN_STOCK = ["IN_STOCK"];
const IN_USE = ["IN_USE"];
const USABLE = ["IN_STOCK", "IN_USE"];
const REPAIRABLE = ["BROKEN", "IN_USE", "IN_STOCK"];

/**
 * Nghiệp vụ hay dùng — LUÔN có trong menu theo đúng thứ tự này; không làm được với tài sản đang chọn (sai trạng thái,
 * không có quyền) thì mờ đi, rê chuột thấy lý do. `optional`: chỉ hiện khi làm được (thanh lý, tiêu hao vật tư).
 */
const ACTIONS: (VoucherAction & { optional?: boolean })[] = [
  { key: "allocate", label: "Cấp phát", icon: <PackageOpen />, resource: "equipment_allocations", path: "/equipment-allocations/create", query: "kind=ALLOCATE", statuses: IN_STOCK },
  { key: "loan", label: "Cho mượn", icon: <HandHelping />, resource: "equipment_loans", path: "/equipment-loans/create", statuses: USABLE },
  { key: "damage", label: "Báo hỏng", icon: <TriangleAlert />, resource: "damage_reports", path: "/damage-reports/create", statuses: USABLE },
  { key: "repair", label: "Sửa chữa", icon: <Wrench />, resource: "repair_orders", path: "/repair-orders/create", statuses: REPAIRABLE },
  { key: "recall", label: "Thu hồi về kho", icon: <Undo2 />, resource: "equipment_allocations", path: "/equipment-allocations/create", query: "kind=RECALL", statuses: IN_USE },
  { key: "transfer", label: "Điều chuyển sang trường khác", icon: <Truck />, resource: "equipment_transfers", path: "/equipment-transfers/create", statuses: ["IN_STOCK", "IN_USE", "BROKEN", "UNREPAIRABLE"] },
  { key: "liquidate", label: "Đề nghị thanh lý", icon: <PackageMinus />, resource: "disposals", path: "/disposals/create", query: "kind=LIQUIDATION", statuses: ["UNREPAIRABLE"], optional: true },
  { key: "consume", label: "Ghi tiêu hao", icon: <FlaskConical />, resource: "consumption_records", path: "/consumption-records/create", statuses: USABLE, kind: "bulk", single: true, optional: true },
];

/** Vì sao một nghiệp vụ không làm được với các tài sản đang chọn — `null` là làm được. */
function blocked(a: VoucherAction, assets: MenuAsset[]): string | null {
  if (a.single && assets.length > 1) return "Chỉ chọn một";
  if (a.kind === "bulk" ? assets.some((x) => x.kind !== "bulk") : assets.some((x) => x.kind === "bulk")) {
    return a.kind === "bulk" ? "Chỉ vật tư tiêu hao" : "Không áp cho vật tư tiêu hao";
  }
  if (assets.some((x) => !a.statuses.includes(x.status))) return "Có thiết bị không đúng trạng thái";
  return null;
}

/**
 * Các nghiệp vụ lập phiếu làm được với những thiết bị đang chọn, kèm lý do khi không làm được — dùng chung cho menu
 * chuột phải của danh sách và khối "Làm gì tiếp" của hồ sơ thiết bị. Mục tuỳ chọn chỉ hiện khi làm được.
 */
export function useVoucherActions(assets: MenuAsset[]) {
  const { perspective } = usePerspective();
  const held = new Set(getAuthorities()?.permissions ?? []);
  const sameSchool = new Set(assets.map((a) => a.school?.id)).size <= 1;
  const why = (a: VoucherAction): string | null =>
    perspective === "management" ? "Phiếu do trường lập"
      : !sameSchool ? "Thiết bị của nhiều trường"
        : !held.has(`${a.resource}:write`) ? "Tài khoản không lập được phiếu này"
          : blocked(a, assets);
  const actions = ACTIONS.filter((a) => !a.optional || !why(a));
  const ids = assets.map((a) => a.equipmentId).join(",");
  const href = (a: VoucherAction) => `${a.path}?${a.query ? `${a.query}&` : ""}equipment.id=${ids}`;
  return { actions, why, href };
}

/**
 * Menu chuột phải của bảng Theo tài sản: mở ngay tại con trỏ, áp cho MỌI tài sản đang tích. Nghiệp vụ hay dùng luôn
 * có (mờ khi không làm được); bấm là mở form phiếu với tài sản điền sẵn (`?equipment.id=1,2,3`).
 */
export function EquipmentRowMenu({ at, assets, onClose }: {
  at: { x: number; y: number } | null;
  assets: MenuAsset[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const ids = assets.map((a) => a.equipmentId).join(",");
  const { actions, why } = useVoucherActions(assets);

  const open = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    // Không chặn cú bấm ra ngoài (modal={false}): đang mở menu mà bấm ô tích của dòng khác thì menu đóng VÀ dòng đó
    // được tích luôn — chế độ chặn nuốt cú bấm đó.
    <DropdownMenu modal={false} open={!!at} onOpenChange={(o) => !o && onClose()}>
      {/* Neo vô hình đặt đúng chỗ con trỏ — menu mở ra từ đó như menu chuột phải. */}
      <DropdownMenuTrigger asChild>
        <span aria-hidden className="pointer-events-none fixed size-0" style={{ left: at?.x ?? 0, top: at?.y ?? 0 }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="min-w-52">
        {assets.length > 1 ? (
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">{assets.length} thiết bị đã chọn</DropdownMenuLabel>
        ) : null}
        {actions.map((a) => {
          const reason = why(a);
          return (
            <DropdownMenuItem key={a.key} disabled={!!reason} title={reason ?? undefined}
              className="data-[disabled]:pointer-events-auto"
              onSelect={() => open(`${a.path}?${a.query ? `${a.query}&` : ""}equipment.id=${ids}`)}>
              {a.icon}
              {a.label}
            </DropdownMenuItem>
          );
        })}
        {actions.length ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem onSelect={() => open(`/equipment-labels?equipment=${ids}`)}>
          <QrCode />In tem QR
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
