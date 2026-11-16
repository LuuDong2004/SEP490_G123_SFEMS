import { useList } from "@refinedev/core";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Package, Search } from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { ASSET_STATUS_LABELS } from "@/domains/equipment/types";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { fold } from "@/shared/components/data-table/icon-filter";
import { TableEmpty, TableSkeletonRows } from "@/shared/components/data-table/table-empty";
import { useFillPanel } from "@/shared/components/layout/fill-panel";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { ASSET_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Group = {
  key: string;
  name: string;
  unit: string;
  catalog?: string;
  /** Vật tư theo số lượng (hoá chất, giấy…): số lượng tính theo đơn vị đo, không cộng vào số thiết bị. */
  bulk: boolean;
  qty: number;
  items: any[];
  status: Record<string, number>;
};

const PAGE_SIZE = 10;
const fmt = (n: number) => n.toLocaleString("vi-VN");

/** Chú thích khi rê chuột lên một mã: chỉ tên loại mã ("Mã danh mục thiết bị" / "Mã thiết bị"). */
function CodeHint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" tone="light" className="font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function StatusBadges({ status }: { status: Record<string, number> }) {
  const many = Object.keys(status).length > 1;
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(status).map(([s, n]) => (
        <Badge key={s} variant={ASSET_STATUS_VARIANTS[s] ?? "neutral"}>
          {many ? `${fmt(n)} ` : ""}{ASSET_STATUS_LABELS[s] ?? s}
        </Badge>
      ))}
    </div>
  );
}

/**
 * Tab Thiết bị của hộp phòng — dạng CÂY như cây cơ quan quản lý (trưởng nhóm 13/11/2026, thay hai bảng
 * cạnh nhau): mỗi dòng là một thiết bị GỘP (cùng tên, cùng đơn vị) với số lượng và tình trạng; bấm mũi tên xổ ra từng
 * tài sản ngay bên dưới (mã, serial, năm sử dụng, tình trạng) — bấm một tài sản là mở hồ sơ. Ô tìm lọc theo tên, mã,
 * serial và tự mở nhóm có kết quả. Vật tư theo số lượng (10.000 gam NaOH) đếm riêng. Chỉ xem: vào / ra phòng qua phiếu.
 */
export function RoomEquipment({ record }: { record: any }) {
  const navigate = useNavigate();
  const fill = useFillPanel();
  const enabled = !!record?.id && !!record?.school?.id;
  const { result, query } = useList<any>({
    resource: "equipment_items",
    filters: [{ field: "school.id", operator: "eq", value: record?.school?.id }, { field: "room.id", operator: "eq", value: record?.id }],
    pagination: { currentPage: 1, pageSize: 1000 },
    queryOptions: { enabled },
  });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const r of result?.data ?? []) {
      const key = `${r.catalog?.id ?? ""}|${r.name}|${r.unit ?? ""}`;
      const g: Group = map.get(key) ?? { key, name: r.name, unit: r.unit ?? "", catalog: r.catalog?.code, bulk: false, qty: 0, items: [], status: {} };
      const n = Number(r.quantity) || 0;
      g.bulk ||= r.kind === "bulk";
      g.qty += n;
      g.items.push(r);
      g.status[r.status] = (g.status[r.status] ?? 0) + (r.kind === "bulk" ? 1 : n);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [result?.data]);

  // Tìm: nhóm khớp tên / mã danh mục thì giữ cả nhóm; không thì chỉ giữ tài sản khớp mã / serial.
  const term = fold(q.trim());
  const shown = useMemo(() => {
    if (!term) return groups;
    return groups.flatMap((g) => {
      if (fold(`${g.name} ${g.catalog ?? ""}`).includes(term)) return [g];
      const items = g.items.filter((r) => fold(`${r.code ?? ""} ${r.serialNumber ?? ""}`).includes(term));
      return items.length ? [{ ...g, items }] : [];
    });
  }, [groups, term]);

  if (!enabled) return null;
  // Cột chi tiết chỉ hiện khi có ít nhất một tài sản có giá trị — phòng không ghi serial thì không để cột rỗng.
  const all = groups.flatMap((g) => g.items);
  const cols = {
    serial: all.some((r) => r.serialNumber),
    origin: all.some((r) => r.originSource?.name),
    year: all.some((r) => r.inUseYear != null),
  };
  const colCount = 4 + Number(cols.serial) + Number(cols.origin) + Number(cols.year);
  const loading = query.isLoading;
  const devices = groups.filter((g) => !g.bulk).reduce((s, g) => s + g.qty, 0);
  const supplies = groups.filter((g) => g.bulk).length;
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  // Đang tìm: mở sẵn mọi nhóm có kết quả. Chỉ một nhóm: mở sẵn.
  const isOpen = (key: string) => !!term || shown.length === 1 || open.has(key);
  const allOpen = visible.length > 0 && visible.every((g) => isOpen(g.key));
  const toggle = (key: string) => setOpen((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return (
    <div className={cn("flex flex-col gap-2", fill && "flex-1")}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-overline text-muted-foreground me-auto">
          {fill ? null : "Thiết bị trong phòng"}
          {groups.length ? (
            <span className={cn("text-foreground", !fill && "ms-2")}>
              {fmt(groups.length)} loại · {fmt(devices)} thiết bị{supplies ? ` · ${fmt(supplies)} vật tư theo lô` : ""}
            </span>
          ) : null}
        </p>
        {groups.length ? (
          <>
            <div className="relative w-56">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Tìm tên, mã, serial..."
                className="h-8 rounded-full pl-8" />
            </div>
            <Button type="button" variant="ghost" size="sm" disabled={!!term}
              onClick={() => setOpen(allOpen ? new Set() : new Set(visible.map((g) => g.key)))}>
              {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
              {allOpen ? "Thu gọn tất cả" : "Mở tất cả"}
            </Button>
          </>
        ) : null}
      </div>
      <div className={cn("bg-card shadow-e1 flex min-h-0 flex-col overflow-hidden rounded-lg border", fill ? "flex-1" : "h-[34rem]")}>
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-surface-subtle sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-56">Mã thiết bị</TableHead>
                <TableHead>Tên thiết bị</TableHead>
                {cols.serial ? <TableHead className="w-36">Số serial</TableHead> : null}
                {cols.origin ? <TableHead className="w-36">Nguồn hình thành</TableHead> : null}
                {cols.year ? <TableHead className="w-28">Năm sử dụng</TableHead> : null}
                <TableHead className="w-28 text-end">Số lượng</TableHead>
                <TableHead className="w-40">Tình trạng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableSkeletonRows rows={6} cols={colCount} /> : shown.length === 0 ? (
                <TableEmpty colSpan={colCount} icon={<Package />} filtered={!!term}
                  title={term ? "Không có thiết bị khớp" : "Chưa có thiết bị"}
                  description={term ? "Thử tên khác, hoặc mã / serial của thiết bị." : "Thiết bị vào phòng qua phiếu ghi tăng, cấp phát."} />
              ) : visible.map((g) => {
                const expanded = isOpen(g.key);
                return (
                  <Fragment key={g.key}>
                    {/* Dòng cha: mã danh mục + tên thiết bị; bấm cả dòng để xổ / gọn. */}
                    <TableRow onClick={() => !term && toggle(g.key)} aria-expanded={expanded}
                      className={cn("group/row cursor-pointer", LIFT_ROW, expanded && "bg-primary/[0.03]")}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ChevronRight className={cn("text-muted-foreground size-4 shrink-0 transition-transform duration-200", expanded && "rotate-90")} />
                          <Package className="text-info-text size-4 shrink-0" />
                          {/* Mã DANH MỤC thiết bị (dòng cha) khác mã THIẾT BỊ (dòng con): rê chuột thấy tên loại mã (13/11/2026). */}
                <CodeHint label="Mã danh mục thiết bị">
                  <span className="text-muted-foreground font-mono text-xs">{g.catalog ?? "Ngoài danh mục"}</span>
                </CodeHint>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-0">
                        <div className="truncate font-semibold" title={g.name}>{g.name}</div>
                      </TableCell>
                      {cols.serial ? <TableCell /> : null}
                      {cols.origin ? <TableCell /> : null}
                      {cols.year ? <TableCell /> : null}
                      <TableCell className="text-end tabular-nums">
                        <span className="font-semibold">{fmt(g.qty)}</span> <span className="text-muted-foreground">{g.unit}</span>
                      </TableCell>
                      <TableCell><StatusBadges status={g.status} /></TableCell>
                    </TableRow>
                    {/* Dòng con: từng tài sản, mã thụt vào dưới dòng cha — bấm mở hồ sơ. */}
                    {expanded ? g.items.map((r) => {
                      const clickable = r.equipmentId != null;
                      return (
                        <TableRow key={r.id ?? r.code}
                          onClick={(e) => clickable && (e.ctrlKey || e.metaKey
                            ? window.open(`/equipment/show/${r.equipmentId}`, "_blank")
                            : navigate(`/equipment/show/${r.equipmentId}`))}
                          className={cn("group/row bg-muted/20", LIFT_ROW, clickable && "cursor-pointer")}>
                          <TableCell className="py-2 ps-12 font-mono text-xs whitespace-nowrap">
                  <CodeHint label="Mã thiết bị"><span>{r.code}</span></CodeHint>
                </TableCell>
                          <TableCell className="text-muted-foreground max-w-0 py-2">
                            <div className="truncate text-sm" title={r.name}>{r.name}</div>
                          </TableCell>
                          {cols.serial ? <TableCell className="py-2 font-mono text-xs">{r.serialNumber ?? ""}</TableCell> : null}
                          {cols.origin ? <TableCell className="max-w-0 py-2 text-sm"><div className="truncate">{r.originSource?.name ?? ""}</div></TableCell> : null}
                          {cols.year ? <TableCell className="py-2 text-sm tabular-nums">{r.inUseYear ?? ""}</TableCell> : null}
                          <TableCell className="py-2 text-end text-sm tabular-nums">
                            {g.bulk || Number(r.quantity) !== 1 ? <>{fmt(Number(r.quantity) || 0)} <span className="text-muted-foreground">{g.unit}</span></> : null}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant={ASSET_STATUS_VARIANTS[r.status] ?? "neutral"}>{ASSET_STATUS_LABELS[r.status] ?? r.status}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    }) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {shown.length > PAGE_SIZE ? (
          <div className="shrink-0 border-t px-3 py-1.5">
            <DataTablePagination compact currentPage={current} pageCount={pageCount} setCurrentPage={setPage} total={shown.length}
              pageSize={PAGE_SIZE} setPageSize={() => undefined} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
