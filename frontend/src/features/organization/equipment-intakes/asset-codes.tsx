import { ChevronDown } from "lucide-react";
import { Link } from "react-router";

import { ASSET_STATUS_LABELS } from "@/domains/equipment/types";
import { ASSET_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import type { IntakeAsset } from "./use-intake-assets";

/** Mã chuẩn `TT.TR.MH.LT.ST.NC` → phần đầu chung (`TT.TR.MH.LT.`), số thứ tự, và đuôi năm (`.NC`). */
function splitCode(code: string): { head: string; seq: number; seqText: string; tail: string } | null {
  const m = /^(.*\.)(\d{2,3})(\.\d{2})$/.exec(code);
  return m ? { head: m[1], seq: Number(m[2]), seqText: m[2], tail: m[3] } : null;
}

/** "79.T6.00.TB.003.26 → 042.26" khi các mã liền nhau, cùng phần đầu và cùng năm; không thì null. */
function codeRange(assets: IntakeAsset[]): string | null {
  if (assets.length < 2) return null;
  const parts = assets.map((a) => splitCode(a.code));
  if (parts.some((p) => p == null)) return null;
  const first = parts[0]!;
  const consecutive = parts.every((p, i) => p!.head === first.head && p!.tail === first.tail && p!.seq === first.seq + i);
  if (!consecutive) return null;
  const last = parts[parts.length - 1]!;
  return `${assets[0].code} → ${last.seqText}${last.tail}`;
}

function CodeLink({ asset }: { asset: IntakeAsset }) {
  return (
    <Link
      to={`/equipment/show/${asset.id}`}
      onClick={(e) => e.stopPropagation()}
      className="text-primary font-mono text-[0.78125rem] hover:underline"
      title="Mở hồ sơ thiết bị"
    >
      {asset.code}
    </Link>
  );
}

/**
 * Ô "Mã thiết bị" của một dòng phiếu đã ghi tăng. Một tài sản: đúng mã đó. Nhiều tài sản: "mã đầu → mã cuối"
 * (hoặc "mã đầu + N mã khác" khi không liền nhau) và nút xổ danh sách — danh sách vẽ ở `AssetCodeList`,
 * thành một hàng riêng ngay dưới dòng, vì 40 mã không vừa một ô.
 */
export function AssetCodesCell({ assets, loading, open, onToggle }: {
  assets: IntakeAsset[] | undefined;
  loading: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  if (loading) return <span className="text-muted-foreground text-xs">Đang tải…</span>;
  if (!assets || assets.length === 0) return <span className="text-muted-foreground">—</span>;
  // Luôn "N thiết bị ⌄", kể cả một cái (trưởng nhóm 15/11/2026: để chung một kiểu) — mã, serial, vị trí, tình trạng nằm
  // trong danh sách xổ ra.
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      onKeyDown={(e) => e.stopPropagation()}
      aria-expanded={open}
      title={codeRange(assets) ?? undefined}
      className="text-primary inline-flex w-fit items-center gap-0.5 text-sm font-medium hover:underline"
    >
      {assets.length} thiết bị
      <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
    </button>
  );
}

/**
 * Danh sách ĐỦ từng thiết bị đã ghi tăng (trưởng nhóm 14/11/2026: liệt kê thiết bị, không chỉ dãy mã): mã tài sản (bấm
 * mở hồ sơ), số serial, đang ở đâu, tình trạng. Khung cao tối đa 10 hàng, nhiều hơn thì cuộn bên trong.
 */
export function AssetCodeList({ assets, grid, unit, unitPrice, lineNo, quantityEach = 1, className }: {
  assets: IntakeAsset[];
  /** Số lượng của MỖI bản ghi: thiết bị từng cái là 1, lô vật tư là số lượng của cả lô. */
  quantityEach?: number;
  /** Số dòng phiếu: thiết bị đánh số "1.1, 1.2" — không trùng với số của dòng phiếu kế tiếp. */
  lineNo?: number | null;
  /**
   * Lưới cột của bảng dòng phiếu — danh sách dùng CHÍNH lưới đó (9 cột) để từng cột thẳng hàng với dòng trên. Vắng
   * (hộp chi tiết của dòng) thì dùng lưới riêng và khung viền.
   */
  grid?: string;
  unit?: string | null;
  unitPrice?: number | null;
  className?: string;
}) {
  const money = new Intl.NumberFormat("vi-VN");
  const inTable = !!grid;
  grid ??= "grid grid-cols-[1.75rem_minmax(9rem,12rem)_8rem_minmax(6rem,1fr)_4.5rem_4rem_6.5rem_7rem_0] items-center gap-x-3 [&>*]:min-w-0";
  // Cùng cột với bảng dòng (trưởng nhóm 15/11/2026): # · Mã thiết bị · Số serial (dưới Mã DM) · Vị trí (dưới Thiết bị)
  // · Số lượng · ĐVT · Đơn giá · Tình trạng (dưới Thành tiền). Kéo ra sát mép dòng (-mx-3) để cột trùng khớp.
  return (
    // Khối CON của dòng (trưởng nhóm 15/11/2026: "highlight cho hết rối"): nền xanh nhạt + vạch màu chính bên trái, tiêu
    // đề con chữ nhỏ cùng màu — nhìn là biết đây là các thiết bị của dòng trên, không phải dòng phiếu kế tiếp.
    <div className={cn(inTable ? "bg-info-subtle col-span-full -mx-3 mt-3 -mb-3 border-t border-l-[3px] border-l-primary" : "bg-info-subtle overflow-hidden rounded-md border", className)}
      onClick={(e) => e.stopPropagation()}>
      <div className={cn(grid, "text-table-head-text py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide", inTable ? "ps-[calc(0.75rem-3px)] pe-3" : "px-3")}>
        <span className="text-center">#</span><span>Mã thiết bị</span><span>Số serial</span><span>Vị trí</span>
        <span className="text-right">Số lượng</span><span>ĐVT</span><span className="text-right">Đơn giá</span>
        <span className="text-right">Tình trạng</span><span />
      </div>
      <div className="max-h-[23rem] overflow-y-auto">
        {assets.map((a, i) => (
          <div key={a.id} className={cn(grid, "border-t border-white/70 py-1.5 text-sm dark:border-white/5", inTable ? "ps-[calc(0.75rem-3px)] pe-3" : "px-3")}>
            <span className="text-muted-foreground text-center text-xs tabular-nums">{lineNo != null ? `${lineNo}.${i + 1}` : i + 1}</span>
            <CodeLink asset={a} />
            {a.serialNumber ? <span className="truncate font-mono text-xs">{a.serialNumber}</span> : <span className="text-muted-foreground text-xs">Không có</span>}
            <span className="truncate">{a.room ?? "Kho"}</span>
            <span className="text-right tabular-nums">{money.format(quantityEach)}</span>
            <span className="text-muted-foreground truncate">{unit ?? ""}</span>
            <span className="text-right tabular-nums">{unitPrice != null ? money.format(unitPrice) : ""}</span>
            <span className="flex justify-end">{a.status ? <Badge variant={ASSET_STATUS_VARIANTS[a.status] ?? "secondary"}>{ASSET_STATUS_LABELS[a.status] ?? a.status}</Badge> : null}</span>
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}
