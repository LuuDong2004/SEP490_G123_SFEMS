import { useCallback, useMemo } from "react";
import { Link } from "react-router";

import { format, numeric, rowAction, voucherLink, type RowAction } from "@/features/reports/report-extras";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { DetailTable, type DetailColumn } from "@/shared/components/data-table/detail-table";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableRow } from "@/shared/ui/table";
import type { Report } from "@/domains/report/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, any>;

/** Hộp chi tiết giữ tối đa chừng này cột: đủ chỗ để chữ hiện trọn, không bị cắt. */
const DRILL_MAX_COLUMNS = 7;
/** Cột phụ bỏ trước khi hộp quá nhiều cột — vẫn xem được ở bảng chính và hồ sơ thiết bị (bấm dòng). */
const DRILL_SECONDARY = ["catalog", "remaining_value", "original_value", "received_date", "unit"];

/**
 * Số liệu của một mục vừa bấm trên biểu đồ. `rows` + `columns`: danh sách các dòng thuộc mục đó (`columns` vắng thì đủ
 * cột của báo cáo). `record`: một nhóm trên cột — liệt kê các con số của nhóm, không dựng bảng một dòng rất rộng.
 */
export type ReportDrill = {
  title: string;
  summary?: string;
  rows?: Row[];
  columns?: Report["columns"];
  record?: Row;
};

/** Hộp số liệu chi tiết của một mục trên biểu đồ. Bấm dòng mở hồ sơ / phiếu như bảng chính của báo cáo. */
export function ReportDrillDialog({ report, drill, onClose, onOpenRow }: {
  report: Report;
  drill: ReportDrill;
  onClose: () => void;
  onOpenRow: (action: RowAction, newTab: boolean) => void;
}) {
  const record = drill.record;
  // Tài khoản trường chỉ thấy trường mình: cột Trường / Mã trường lặp một tên ở mọi dòng.
  const { perspective } = usePerspective();
  const allColumns = drill.columns ?? report.columns;
  const columns = useMemo(() => {
    let out = perspective === "school" ? allColumns.filter((c) => !/^(mã )?trường$/i.test(c.label)) : allColumns;
    // DM thiết bị thường trùng tên thiết bị; ngày, giá trị là cột phụ.
    for (const key of DRILL_SECONDARY) {
      if (out.length <= DRILL_MAX_COLUMNS) break;
      if (key === "catalog" && !out.some((c) => c.key === "name")) continue;
      out = out.filter((c) => c.key !== key);
    }
    return out;
  }, [allColumns, perspective]);
  const rows = drill.rows ?? [];
  const shownColumns = useMemo(() => columns.map((c) => ({ key: c.key, label: c.label, numeric: numeric(c.type) })), [columns]);
  const textOf = useCallback((row: Row, c: DetailColumn) => {
    const type = columns.find((x) => x.key === c.key)?.type;
    return type ? format(row[c.key], type) : String(row[c.key] ?? "");
  }, [columns]);
  // Số phiếu là liên kết mở phiếu, mã nhỏ và mờ; còn lại in chữ.
  const cellOf = (row: Row, c: DetailColumn) => {
    const value = textOf(row, c);
    const voucher = c.key === "voucher_code" ? voucherLink(row) : null;
    if (voucher && value) {
      return <Link to={voucher} className="text-primary hover:underline" title="Mở phiếu" onClick={(ev) => ev.stopPropagation()}>{value}</Link>;
    }
    return c.key.endsWith("code") ? <span className="text-muted-foreground text-xs">{value}</span> : value;
  };
  const recordAction = record ? rowAction(report.name, record) : null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size={record ? "form" : "wide"}
        onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="pe-6">{drill.title}</DialogTitle>
          <DialogDescription className={drill.summary ? undefined : "sr-only"}>{drill.summary ?? "Số liệu chi tiết của mục đã chọn"}</DialogDescription>
        </DialogHeader>
        {record ? (
          <div className="bg-card shadow-e1 min-h-0 flex-1 overflow-auto rounded-lg border">
            <Table>
              <TableBody>
                {report.columns.filter((c) => numeric(c.type)).map((c) => (
                  <TableRow key={c.key}>
                    <TableCell className="whitespace-normal">{c.label}</TableCell>
                    <TableCell align="right" className={cn("font-semibold", Number(record[c.key]) === 0 && "text-muted-foreground/60 font-normal")}>
                      {format(record[c.key], c.type) || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <DetailTable columns={shownColumns} rows={rows} context={[drill.title]} text={textOf} cell={cellOf}
            filterKey={columns.find((c) => c.key === "school" || c.label === "Trường")?.key}
            rowTitle={(row) => rowAction(report.name, row)?.title}
            onRowClick={{
              clickable: (row) => !!rowAction(report.name, row),
              open: (row, newTab) => {
                const act = rowAction(report.name, row);
                if (act) onOpenRow(act, newTab);
              },
            }} />
        )}
        {recordAction ? (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenRow(recordAction, false)}>{recordAction.title}</Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
