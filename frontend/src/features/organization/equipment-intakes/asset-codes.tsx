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
  if (assets.length === 1) return <CodeLink asset={assets[0]} />;
  const range = codeRange(assets);
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      {range ? (
        <span className="truncate font-mono text-[0.78125rem]" title={range}>{range}</span>
      ) : (
        <span className="flex min-w-0 items-baseline gap-1">
          <CodeLink asset={assets[0]} />
          <span className="text-muted-foreground shrink-0 text-xs">+ {assets.length - 1} thiết bị khác</span>
        </span>
      )}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        onKeyDown={(e) => e.stopPropagation()}
        aria-expanded={open}
        className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
      >
        {assets.length} thiết bị
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
    </div>
  );
}

/**
 * Danh sách ĐỦ từng thiết bị đã ghi tăng (trưởng nhóm 14/11/2026: liệt kê thiết bị, không chỉ dãy mã): mã tài sản (bấm
 * mở hồ sơ), số serial, đang ở đâu, tình trạng. Khung cao tối đa 10 hàng, nhiều hơn thì cuộn bên trong.
 */
export function AssetCodeList({ assets, className }: { assets: IntakeAsset[]; className?: string }) {
  return (
    <div className={cn("bg-card col-span-full mt-2 overflow-hidden rounded-md border", className)} onClick={(e) => e.stopPropagation()}>
      <div className="text-muted-foreground bg-surface-subtle grid grid-cols-[2.5rem_13rem_10rem_minmax(0,1fr)_9rem] items-center gap-2 px-3 py-1.5 text-xs font-medium">
        <span>#</span><span>Mã tài sản</span><span>Số serial</span><span>Đang ở</span><span>Tình trạng</span>
      </div>
      <div className="max-h-[23rem] overflow-y-auto">
        {assets.map((a, i) => (
          <div key={a.id} className="grid grid-cols-[2.5rem_13rem_10rem_minmax(0,1fr)_9rem] items-center gap-2 border-t px-3 py-1.5 text-sm">
            <span className="text-muted-foreground tabular-nums">{i + 1}</span>
            <CodeLink asset={a} />
            {a.serialNumber ? <span className="truncate font-mono text-xs">{a.serialNumber}</span> : <span className="text-muted-foreground text-xs">Không có</span>}
            <span className="truncate">{a.room ?? "Kho"}</span>
            <span>{a.status ? <Badge variant={ASSET_STATUS_VARIANTS[a.status] ?? "secondary"}>{ASSET_STATUS_LABELS[a.status] ?? a.status}</Badge> : null}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
