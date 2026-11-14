import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, History, Inbox } from "lucide-react";
import { useMemo, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { useFillHeight } from "@/shared/hooks/use-fill-height";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import type { ImportEdit, ImportEditSource, ImportRow, ImportSheetInfo } from "@/domains/data-import/types";

/** Nguồn sửa: nhãn và màu — cùng màu với ô "Dòng" trên lưới (`import-grid.tsx`). */
export const EDIT_SOURCE: Record<ImportEditSource, { label: string; badge: "neutral" | "outline" | "default" }> = {
  manual: { label: "Sửa tay", badge: "outline" },
  rule: { label: "Sửa nhanh", badge: "neutral" },
  ai: { label: "AI", badge: "default" },
};

const ALL = "__all";

/** Một ô đã đổi của một dòng: giá trị GỐC (lần sửa đầu) và giá trị HIỆN TẠI (lần sửa cuối) — nhiều lần sửa gộp một. */
type CellDiff = { field: string; from: string | null; to: string | null; sources: Set<ImportEditSource> };
type RowDiff = {
  key: string;
  sheet: string;
  rowNo: number;
  rowId: number | null;
  cells: CellDiff[];
  skipped: boolean | null;
  sources: Set<ImportEditSource>;
  lastAt: string;
  by: Set<string>;
};

/** Một giá trị trong bảng so sánh: chip vừa chữ (không kéo hết ô), cũ đỏ gạch / mới xanh, trống in nghiêng. */
function Value({ v, tone }: { v: string | null; tone: "old" | "new" }) {
  if (v == null || v === "") return <span className="text-muted-foreground text-xs italic">trống</span>;
  return (
    <span title={v} className={cn("inline-block max-w-full truncate rounded px-1.5 py-0.5 align-middle font-mono text-[0.8125rem]",
      tone === "old" ? "bg-destructive-subtle text-destructive-text line-through decoration-destructive/50"
        : "bg-success-subtle text-success-text font-medium")}>
      {v}
    </span>
  );
}

/**
 * "So sánh với tệp gốc" của MỘT trang: dữ liệu TỆP GỐC so với dữ liệu HIỆN TẠI của vùng chờ, như xem diff — mỗi
 * dòng đã đổi là một khối, trong đó mỗi ô đổi một hàng "cũ → mới" (đỏ gạch → xanh); dòng bị bỏ tô đỏ cả khối. Ô
 * sửa đi sửa lại chỉ hiện gốc → hiện tại. Lọc theo cách sửa để xem riêng những gì AI hay sửa nhanh đã đổi. Thay chỗ
 * bảng của trang đó, nút "Về bảng" quay lại.
 */
export function EditHistory({ batchId, sheet, rows, onClose }: {
  batchId: string;
  sheet: ImportSheetInfo;
  /** Dòng hiện tại của trang — để ghi mã, tên cạnh số dòng. */
  rows: ImportRow[];
  onClose: () => void;
}) {
  const [source, setSource] = useState<string>(ALL);
  // Cùng chiều cao với vùng bảng (`import-grid.tsx`): bật / tắt so sánh không làm khung co giãn.
  const fill = useFillHeight(56, 1024, 360);
  const { data, isLoading } = useQuery({
    queryKey: ["data_imports", "edits", batchId],
    queryFn: ({ signal }) => kyInstance.get(`data_imports/${batchId}/edits`, { signal }).json<ImportEdit[]>(),
  });

  const diffs = useMemo(() => {
    const byRow = new Map<string, RowDiff>();
    // API trả mới nhất trước — đảo lại để đi theo thời gian: "from" là gốc, "to" cuối là hiện tại.
    for (const e of [...(data ?? [])].reverse()) {
      if (e.sheet.toLowerCase() !== sheet.key) continue;
      const key = `${e.sheet}#${e.rowNo}#${e.rowId ?? ""}`;
      const r = byRow.get(key) ?? { key, sheet: e.sheet, rowNo: e.rowNo, rowId: e.rowId, cells: [], skipped: null,
        sources: new Set<ImportEditSource>(), lastAt: e.editedAt, by: new Set<string>() };
      r.sources.add(e.source);
      r.lastAt = e.editedAt;
      if (e.editedBy) r.by.add(e.editedBy);
      if (e.field === "_skip") {
        r.skipped = e.newValue === "bỏ";
      } else {
        const c = r.cells.find((x) => x.field === e.field);
        if (c) {
          c.to = e.newValue;
          c.sources.add(e.source);
        } else {
          r.cells.push({ field: e.field, from: e.oldValue, to: e.newValue, sources: new Set([e.source]) });
        }
      }
      byRow.set(key, r);
    }
    // Ô sửa rồi sửa lại về đúng giá trị gốc thì không còn là thay đổi.
    return [...byRow.values()]
      .map((r) => ({ ...r, cells: r.cells.filter((c) => (c.from ?? "") !== (c.to ?? "")) }))
      .filter((r) => r.cells.length || r.skipped != null)
      .sort((a, b) => a.sheet.localeCompare(b.sheet) || a.rowNo - b.rowNo);
  }, [data, sheet.key]);

  const shown = source === ALL ? diffs : diffs.filter((r) => r.sources.has(source as ImportEditSource));
  const labelOf = (field: string) => sheet.columns.find((c) => c.key === field)?.label ?? field;
  const nameOf = (r: RowDiff) => {
    const row = rows.find((x) => x.id === r.rowId);
    return row ? [row.data.code, row.data.name].filter(Boolean).join(" · ") : "";
  };
  const counts = (["manual", "rule", "ai"] as ImportEditSource[]).map((k) => [k, diffs.filter((r) => r.sources.has(k)).length] as const);
  const cellCount = shown.reduce((n, r) => n + r.cells.length, 0);
  const skipCount = shown.filter((r) => r.skipped === true).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}><ArrowLeft /> Về bảng</Button>
        <History className="text-muted-foreground size-4" />
        <span className="text-sm font-semibold">{sheet.title} · thay đổi so với tệp gốc</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {shown.length} dòng · {cellCount} ô đổi{skipCount ? ` · ${skipCount} dòng bỏ` : ""}
        </span>
        <div className="bg-muted ms-auto inline-flex gap-0.5 rounded-lg p-0.5">
          {[[ALL, "Tất cả", diffs.length] as const, ...counts.map(([k, n]) => [k, EDIT_SOURCE[k].label, n] as const)].map(([k, t, n]) => (
            <button key={k} type="button" aria-pressed={source === k} disabled={k !== ALL && n === 0} onClick={() => setSource(k)}
              className={cn("rounded-md px-2.5 py-1 text-sm disabled:opacity-40",
                source === k ? "bg-card text-primary font-medium shadow-sm" : "text-muted-foreground")}>
              {t} <span className="tabular-nums opacity-80">{n}</span>
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div ref={fill.ref} style={{ height: fill.height ?? "70vh" }}><Skeleton className="m-4 h-32" /></div>
      ) : shown.length === 0 ? (
        <div ref={fill.ref} style={{ height: fill.height ?? "70vh" }}
          className="text-muted-foreground flex flex-col items-center justify-center gap-2 text-sm">
          <Inbox className="size-8 opacity-50" />
          {diffs.length ? "Không có dòng nào sửa theo cách này." : `Trang ${sheet.title} vẫn y như tệp gốc — chưa sửa ô nào.`}
        </div>
      ) : (
        // Một bảng như diff: mỗi ô đổi một hàng (gốc → hiện tại); số dòng / tên chỉ ghi ở hàng đầu của dòng đó,
        // giờ và người sửa nằm trong tooltip của nhãn cách sửa — không lặp lại trên từng hàng.
        <div ref={fill.ref} style={{ height: fill.height ?? "70vh" }} className="overflow-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-16" />
              <col />
              <col className="w-40" />
              <col className="w-[20%]" />
              <col className="w-8" />
              <col className="w-[20%]" />
              <col className="w-28" />
            </colgroup>
            <thead className="bg-table-head text-table-head-text sticky top-0 z-10 text-xs font-semibold">
              <tr className="border-b text-left">
                <th className="px-3 py-2 font-medium">Dòng</th>
                <th className="px-3 py-2 font-medium">Mã · Tên</th>
                <th className="px-3 py-2 font-medium">Cột</th>
                <th className="px-3 py-2 font-medium">Tệp gốc</th>
                <th />
                <th className="px-3 py-2 font-medium">Hiện tại</th>
                <th className="px-3 py-2 font-medium">Cách sửa</th>
              </tr>
            </thead>
            {shown.map((r) => {
              const name = nameOf(r);
              const when = `${r.lastAt}${r.by.size ? ` · ${[...r.by].join(", ")}` : ""}`;
              const lines = r.cells.length ? r.cells : [null];
              // Dòng có nhiều ô đổi: số dòng / tên / cách sửa đứng ở hàng đầu; một ô thì nằm giữa như các ô khác.
              const span = lines.length > 1 ? "align-top" : "align-middle";
              return (
                <tbody key={r.key} className={cn("border-b", r.skipped && "bg-destructive-subtle/60")}>
                  {lines.map((c, i) => (
                    <tr key={c?.field ?? "_skip"} className="hover:bg-muted/40 align-middle">
                      {i === 0 ? (
                        <>
                          <td rowSpan={lines.length} className={cn("px-3 py-1.5 font-semibold tabular-nums", span)}>{r.rowNo}</td>
                          <td rowSpan={lines.length} className={cn("px-3 py-1.5", span)}>
                            <div className="flex min-w-0 items-center gap-2"><span className="truncate" title={name}>{name || <span className="text-muted-foreground">—</span>}</span>
                            {r.skipped === true ? <Badge variant="destructive" className="shrink-0">Bỏ dòng</Badge>
                              : r.skipped === false ? <Badge variant="success" className="shrink-0">Dùng lại dòng</Badge> : null}</div>
                          </td>
                        </>
                      ) : null}
                      {c ? (
                        <>
                          <td className="text-muted-foreground truncate px-3 py-1.5 text-xs" title={labelOf(c.field)}>{labelOf(c.field)}</td>
                          <td className="px-3 py-1.5"><Value v={c.from} tone="old" /></td>
                          <td className="text-muted-foreground"><ArrowRight className="size-3.5" /></td>
                          <td className="px-3 py-1.5"><Value v={c.to} tone="new" /></td>
                        </>
                      ) : (
                        <td colSpan={4} className="text-muted-foreground px-3 py-1.5 text-xs">
                          {r.skipped ? "Cả dòng không ghi vào hệ thống" : "Dòng được ghi lại như bình thường"}
                        </td>
                      )}
                      {i === 0 ? (
                        <td rowSpan={lines.length} className={cn("px-3 py-1.5", span)}>
                          <div className="flex flex-wrap gap-1" title={when}>
                            {[...r.sources].map((s) => <Badge key={s} variant={EDIT_SOURCE[s].badge}>{EDIT_SOURCE[s].label}</Badge>)}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </div>
  );
}
