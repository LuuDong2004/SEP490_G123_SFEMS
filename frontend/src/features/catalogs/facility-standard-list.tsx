import type { ReactNode } from "react";
import { useCan, useList } from "@refinedev/core";
import { LayoutGrid, Plus, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { CatalogFormDialog, CatalogShowDialog } from "@/shared/components/catalog/pages";
import type { CatalogConfig } from "@/shared/components/catalog/types";
import type { FormDialogState } from "@/shared/components/catalog/form-dialog";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { FillBox } from "@/shared/components/layout/fill-box";
import { Segmented } from "@/shared/components/segmented";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { fold } from "@/shared/components/data-table/icon-filter";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { FACILITY_LEVELS } from "@/domains/facility/catalog";
import { STANDARD_TIER_LABELS, STANDARD_TIERS, type FacilityStandardRule, type StandardTier } from "@/domains/facility/standard";
import { TableEmpty } from "@/shared/components/data-table/table-empty";

const num = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const TIER_VARIANTS: Record<StandardTier, "neutral" | "info" | "success"> = { MIN: "neutral", LEVEL1: "info", LEVEL2: "success" };

type NumKey = "minCount" | "countPerClass" | "minRoomArea" | "areaPerStudent" | "minTotalArea";
// Tiêu đề ngắn một dòng; tên đầy đủ hiện khi rê chuột.
// Đơn vị m² giữ chữ thường (tiêu đề bảng viết hoa).
const M2 = <span className="normal-case">m²</span>;
const COLS: { key: NumKey; label: ReactNode; title: string; className: string }[] = [
  { key: "minCount", label: "Số phòng", title: "Số phòng tối thiểu", className: "w-24 text-right" },
  { key: "countPerClass", label: "Phòng/lớp", title: "Số phòng trên mỗi lớp", className: "w-24 text-right" },
  { key: "minRoomArea", label: <>{M2}/phòng</>, title: "Diện tích tối thiểu mỗi phòng (m²)", className: "w-24 text-right" },
  { key: "areaPerStudent", label: <>{M2}/HS</>, title: "Diện tích trên mỗi học sinh (m²)", className: "w-24 text-right" },
  { key: "minTotalArea", label: <>Tổng {M2}</>, title: "Tổng diện tích tối thiểu (m²)", className: "w-24 text-right" },
];

const cell = (v: number | null | undefined) => (v == null ? <span className="text-muted-foreground">—</span> : num.format(Number(v)));

/**
 * Màn Chuẩn CSVC (Danh mục chung) — bố trí như Danh mục thiết bị tối thiểu: chọn CẤP HỌC ở dải trên, tìm + lọc theo
 * khối CSVC và mức trên một hàng, bảng chia theo khối (dòng khối đậm), mỗi điều kiện một cột số (giữ thứ tự khối →
 * loại → mức của máy chủ, không sắp theo cột). Bấm dòng mở hộp xem; Sửa / Xoá trên dòng; Thêm mở form của danh mục (điền sẵn cấp đang xem).
 */
export function FacilityStandardRulesPage({ config }: { config: CatalogConfig }) {
  const mayCreate = useCan({ resource: config.resource, action: "create" }).data?.can ?? false;
  const mayEdit = useCan({ resource: config.resource, action: "edit" }).data?.can ?? false;
  const mayDelete = useCan({ resource: config.resource, action: "delete" }).data?.can ?? false;
  const [level, setLevel] = usePersistentState<string>("facility-standard-rules.level", "THCS");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [dialog, setDialog] = useState<FormDialogState>({ open: false });
  const [viewing, setViewing] = useState<number | null>(null);

  // Cả danh mục một lần (vài trăm quy tắc): đếm theo cấp cho dải chọn, lọc / sắp / chia khối ngay trên trình duyệt.
  const { result, query } = useList<FacilityStandardRule>({
    resource: config.resource,
    pagination: { currentPage: 1, pageSize: 1000 },
  });
  const all = useMemo(() => result?.data ?? [], [result]);
  const levels = FACILITY_LEVELS.filter((l) => all.some((r) => r.levelCode === l.code) || l.code === level);
  const ofLevel = all.filter((r) => r.levelCode === level);
  const groups = [...new Set(ofLevel.map((r) => r.roomType?.groupName ?? "Chưa xếp khối"))];

  const shown = useMemo(() => {
    const term = fold(q.trim());
    return ofLevel.filter((r) =>
      (!term || fold(`${r.roomType?.name ?? ""} ${r.code ?? ""} ${r.legalBasis ?? ""}`).includes(term))
      && (!group || (r.roomType?.groupName ?? "Chưa xếp khối") === group)
      && (!tier || r.tier === tier));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, level, q, group, tier]);

  // Chia khối: giữ thứ tự của máy chủ (khối → loại → mức).
  const sections = useMemo(() => {
    const map = new Map<string, FacilityStandardRule[]>();
    for (const r of shown) {
      const g = r.roomType?.groupName ?? "Chưa xếp khối";
      map.set(g, [...(map.get(g) ?? []), r]);
    }
    return [...map.entries()];
  }, [shown]);

  const cols = 4 + COLS.length + 1;
  let stt = 0;

  return (
    <ListView>
      <ListViewHeader canCreate={false} title={config.label} />
      {levels.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Cấp học" value={level} onChange={(v) => { setLevel(v); setGroup(null); }}
            options={levels.map((l) => ({
              value: l.code,
              label: <>{l.name} <span className="font-semibold tabular-nums opacity-80">{all.filter((r) => r.levelCode === l.code).length}</span></>,
              hint: `Chuẩn CSVC cấp ${l.name}`,
            }))} />
        </div>
      ) : null}

      <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm loại CSVC, mã, văn bản…" className="pl-8" />
        </div>
        {/* Mức chỉ ba giá trị: dải chọn nhìn là biết đang xem mức nào. Khối nhiều giá trị: nút thả xuống có chữ. */}
        <Segmented label="Mức chuẩn" value={tier ?? "ALL"} onChange={(v) => setTier(v === "ALL" ? null : v)}
          options={[{ key: "ALL", short: "Tất cả", label: "Mọi mức" }, ...STANDARD_TIERS].map((t) => ({
            value: t.key,
            hint: t.label,
            label: <>{t.short} <span className="font-semibold tabular-nums opacity-80">
              {t.key === "ALL" ? ofLevel.length : ofLevel.filter((r) => r.tier === t.key).length}</span></>,
          }))} />
        <IconFilter labeled icon={<LayoutGrid />} label="khối CSVC" allLabel="Tất cả khối" value={group} onChange={setGroup}
          groups={[{ items: groups.map((g) => ({ key: g, label: g, count: ofLevel.filter((r) => (r.roomType?.groupName ?? "Chưa xếp khối") === g).length })) }]} />
        <div className="ms-auto flex items-center gap-2">
          <span className="text-muted-foreground text-sm tabular-nums">{shown.length} quy tắc</span>
          {mayCreate ? (
            <Button type="button" onClick={() => setDialog({ open: true })}>
              <Plus />
              Thêm chuẩn
            </Button>
          ) : null}
        </div>
      </div>

      <FillBox>
        <div className="bg-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
          <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible">
            <Table className="min-w-[72rem] table-fixed">
              <TableHeader sticky>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-center">STT</TableHead>
                  <TableHead>Loại CSVC</TableHead>
                  <TableHead className="w-28">Mức</TableHead>
                  {COLS.map((c) => <TableHead key={c.key} title={c.title} className={c.className}>{c.label}</TableHead>)}
                  <TableHead className="w-64">Văn bản căn cứ</TableHead>
                  <TableHead className="w-20"><span className="sr-only">Thao tác</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isLoading ? (
                  Array.from({ length: 6 }, (_, i) => (
                    <TableRow key={i}><TableCell colSpan={cols}><Skeleton className="h-5" /></TableCell></TableRow>
                  ))
                ) : sections.length === 0 ? (
                  <TableEmpty colSpan={cols} title={ofLevel.length ? "Không có quy tắc nào khớp bộ lọc." : "Cấp học này chưa có chuẩn CSVC."} />
                ) : sections.map(([name, rows]) => (
                  <Fragment key={name}>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={cols} className="py-2">
                        <span className="text-primary text-sm font-semibold uppercase">{name}</span>
                        <span className="text-muted-foreground ms-2 text-xs tabular-nums">{rows.length} quy tắc</span>
                      </TableCell>
                    </TableRow>
                    {rows.map((r) => {
                      stt += 1;
                      return (
                        <TableRow key={r.id} className={cn("group/row cursor-pointer", LIFT_ROW)} onClick={() => setViewing(r.id)}>
                          <TableCell className="text-muted-foreground text-center tabular-nums">{stt}</TableCell>
                          <TableCell className="truncate font-medium" title={r.roomType?.name ?? ""}>{r.roomType?.name ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={TIER_VARIANTS[r.tier as StandardTier] ?? "neutral"} className="whitespace-nowrap">
                              {STANDARD_TIER_LABELS[r.tier as StandardTier] ?? r.tier}
                            </Badge>
                          </TableCell>
                          {COLS.map((c) => <TableCell key={c.key} className="text-right tabular-nums">{cell(r[c.key] as number | null | undefined)}</TableCell>)}
                          <TableCell className="text-muted-foreground truncate text-xs" title={r.legalBasis ?? ""}>{r.legalBasis ?? "—"}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                              {mayEdit ? (
                                <EditButton resource={config.resource} recordItemId={r.id} iconOnly size="icon-sm"
                                  onClick={() => setDialog({ open: true, id: r.id })} />
                              ) : null}
                              {mayDelete ? (
                                <DeleteButton resource={config.resource} recordItemId={r.id} record={r} iconOnly size="icon-sm" />
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </FillBox>

      <CatalogFormDialog config={config} state={dialog} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        presets={dialog.id ? undefined : { levelCode: level, tier: tier ?? "" }} />
      <CatalogShowDialog config={config} id={viewing} onOpenChange={(open) => !open && setViewing(null)}
        onEdit={(id) => { setViewing(null); setDialog({ open: true, id }); }} />
    </ListView>
  );
}
