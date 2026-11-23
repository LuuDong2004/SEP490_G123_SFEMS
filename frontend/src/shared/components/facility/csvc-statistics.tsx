import { Info } from "lucide-react";

import type { Report } from "@/domains/report/types";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

/** Tên báo cáo ở `/api/reports` — biểu số liệu CSVC theo mẫu Sở (`CsvcStatisticsReport`). */
export const CSVC_STATISTICS = "csvc-statistics";

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

const STRUCTURES = [
  { prefix: "kc", label: "Kiên cố" },
  { prefix: "bkc", label: "Bán kiên cố" },
  { prefix: "tam", label: "Tạm" },
  { prefix: "nmt", label: "Nhờ, mượn, thuê" },
] as const;

type Row = Report["rows"][number];

const num = (v: Row[string]) => (v == null || v === "" ? "" : number.format(Number(v)));

/**
 * Một ô của biểu như trên mẫu Sở: dòng phần A (`info`) ghi "x" ở các cột kết cấu; số định dạng vi-VN; ô trống là
 * không có. Dùng cho bản in (`PrintSheet`) — bảng trên màn vẽ ở {@link CsvcStatisticsTable}.
 */
export function csvcCell(row: Row, key: string, type: string) {
  if (row.kind === "info" && /_(count|area)$/.test(key)) return "x";
  if (type === "number") return num(row[key]);
  return String(row[key] ?? "").trim();
}

/**
 * Biểu số liệu CSVC — cùng cột, cùng thứ tự dòng với mẫu Sở (STT, Nội dung, Đơn vị, Tổng số, rồi số lượng và diện
 * tích theo từng kết cấu). Phần A, B và các khối in đậm; dòng phần A để "x" ở cột kết cấu như mẫu. Ghi chú (hạng
 * mục không có dòng trên biểu, chưa khai kết cấu) ở {@link CsvcStatisticsNotes}.
 */
export function CsvcStatisticsTable({ report }: { report: Report }) {
  const rows = report.rows.filter((r) => r.kind !== "note");
  const head = "h-auto border-l py-2 text-center whitespace-normal leading-snug";
  return (
    <Table className="min-w-[60rem]">
      <TableHeader className="bg-surface-subtle sticky top-0 z-10">
        <TableRow>
          <TableHead rowSpan={3} className={cn(head, "w-14 border-l-0")}>STT</TableHead>
          <TableHead rowSpan={3} className={cn(head, "min-w-72")}>Nội dung</TableHead>
          <TableHead rowSpan={3} className={cn(head, "w-24")}>Đơn vị</TableHead>
          <TableHead rowSpan={3} className={cn(head, "w-20")}>Tổng số</TableHead>
          <TableHead colSpan={8} className={cn(head, "border-b")}>Hiện trạng</TableHead>
        </TableRow>
        <TableRow>
          {STRUCTURES.map((s) => (
            <TableHead key={s.prefix} colSpan={2} className={cn(head, "border-b")}>{s.label}</TableHead>
          ))}
        </TableRow>
        <TableRow>
          {STRUCTURES.map((s) => [
            <TableHead key={`${s.prefix}-n`} className={cn(head, "w-20")}>Số lượng</TableHead>,
            <TableHead key={`${s.prefix}-a`} className={cn(head, "w-24")}>Diện tích (m²)</TableHead>,
          ])}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => {
          const kind = row.kind;
          const strong = kind === "section" || kind === "group";
          // Thụt theo cấp của STT: 2.1 → 0, 2.1.1 → 1, 2.1.1.1 → 2 (phần A: 1.1 → 0, 1.1.1 → 1).
          const depth = Math.max(0, String(row.stt ?? "").split(".").length - 2);
          return (
            <TableRow key={i} className={cn(
              kind === "section" ? "bg-surface-subtle hover:bg-surface-subtle" : cn("group/row", LIFT_ROW),
              strong && "font-semibold",
            )}>
              <TableCell className="text-muted-foreground tabular-nums">{row.stt}</TableCell>
              <TableCell className={cn("whitespace-normal", !strong && "font-normal")}
                style={depth ? { paddingLeft: `${0.5 + depth * 1.25}rem` } : undefined}>
                {String(row.content ?? "").trim()}
              </TableCell>
              <TableCell className="text-muted-foreground text-center font-normal">{row.unit}</TableCell>
              {kind === "section" ? (
                <TableCell colSpan={9} />
              ) : (
                <>
                  <TableCell className="text-right tabular-nums">{num(row.total)}</TableCell>
                  {STRUCTURES.map((s) => kind === "info" ? [
                    <TableCell key={`${s.prefix}-n`} className="text-muted-foreground/60 text-right">x</TableCell>,
                    <TableCell key={`${s.prefix}-a`} className="text-muted-foreground/60 text-right">x</TableCell>,
                  ] : [
                    <TableCell key={`${s.prefix}-n`} className="text-right tabular-nums">{num(row[`${s.prefix}_count`])}</TableCell>,
                    <TableCell key={`${s.prefix}-a`} className="text-right tabular-nums">{num(row[`${s.prefix}_area`])}</TableCell>,
                  ])}
                </>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Ghi chú dưới biểu: hạng mục chưa khai kết cấu, loại không có dòng trên biểu. */
export function CsvcStatisticsNotes({ report }: { report: Report }) {
  const notes = report.rows.filter((r) => r.kind === "note");
  if (!notes.length) return null;
  return (
    <ul className="text-muted-foreground space-y-1 border-t px-5 py-3 text-xs">
      {notes.map((n, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <Info className="mt-px size-3.5 shrink-0" />
          {n.content}
        </li>
      ))}
    </ul>
  );
}
