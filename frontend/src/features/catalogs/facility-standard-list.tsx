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
import { useFacilityLevels } from "@/features/catalogs/facility-catalog-extra";
import { fold } from "@/shared/components/data-table/icon-filter";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { STANDARD_TIER_LABELS, STANDARD_TIERS, perClassText, type FacilityStandardRule, type StandardTier } from "@/domains/facility/standard";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { kyInstance } from "@/shared/api/data";
import { useQuery } from "@tanstack/react-query";

import { LegalDocDialog, type LegalDocDialogState } from "./legal-doc-dialog";

const num = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const TIER_VARIANTS: Record<StandardTier, "neutral" | "info" | "success"> = { MIN: "neutral", LEVEL1: "info", LEVEL2: "success" };

type NumKey = "minCount" | "countPerClass" | "minRoomArea" | "areaPerStudent" | "minTotalArea";
// Tiêu đề viết đủ chữ, ô số ghi kèm đơn vị: "0,6" trơn không nói là phòng hay m², cho mỗi lớp hay cả trường.
// Rê chuột lên tiêu đề có câu giải thích và ví dụ.
const COLS: { key: NumKey; label: string; unit: string; title: string }[] = [
  { key: "minCount", label: "Số phòng tối thiểu", unit: "phòng",
    title: "Trường phải có ít nhất bấy nhiêu phòng, không phụ thuộc số lớp." },
  { key: "countPerClass", label: "Số phòng theo số lớp", unit: "",
    title: "Trường nhiều lớp thì cần nhiều phòng hơn. Ví dụ 1 phòng cho 10 lớp: trường 25 lớp cần 3 phòng (làm tròn lên)." },
  { key: "minRoomArea", label: "Diện tích mỗi phòng", unit: "m²",
    title: "Mỗi phòng phải rộng ít nhất bấy nhiêu m²." },
  { key: "areaPerStudent", label: "Diện tích theo số học sinh", unit: "m² mỗi học sinh",
    title: "Trường nhiều học sinh thì cần rộng hơn. Ví dụ 0,6 m² mỗi học sinh: trường 1.200 học sinh cần 720 m²." },
  { key: "minTotalArea", label: "Tổng diện tích tối thiểu", unit: "m²",
    title: "Tổng diện tích ít nhất của loại phòng này trong trường." },
];

const cell = (key: NumKey, v: number | null | undefined, unit: string) => {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  if (key === "countPerClass") return perClassText(v);
  return <>{num.format(Number(v))}<span className="text-muted-foreground ms-1 text-xs">{unit}</span></>;
};

/** Số đếm cạnh nhãn dải chọn — viên riêng, để "Mức độ 1" và "2" không đọc liền thành "Mức độ 12". */
const Count = ({ n }: { n: number }) => (
  <span className="ms-1.5 rounded-full bg-current/15 px-1.5 text-[0.6875rem] leading-[1.125rem] font-semibold tabular-nums">{n}</span>
);

const DOC_NO = /\d+\/\d{4}\/[A-ZĐ]+-[A-ZĐ]+/gi;

/** Văn bản căn cứ ghi tự do ("TT 23/2024/TT-BGDĐT, sửa khoản 2…"): số hiệu có trong danh mục Văn bản căn cứ thì bấm mở được. */
function LegalBasisText({ text, docs, onOpen }: { text: string; docs: Map<string, number>; onOpen: (id: number) => void }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(DOC_NO)) {
    const id = docs.get(m[0].toUpperCase());
    if (id == null) continue;
    parts.push(text.slice(last, m.index));
    parts.push(
      <button key={m.index} type="button" className="text-primary italic hover:underline" title="Xem văn bản"
        onClick={(e) => { e.stopPropagation(); onOpen(id); }}>
        {m[0]}
      </button>,
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

/**
 * Màn Chuẩn CSVC (Danh mục chung) — bố trí như Danh mục thiết bị tối thiểu: chọn CẤP HỌC ở dải trên, tìm + lọc theo
 * khối CSVC và mức trên một hàng, bảng chia theo khối (dòng khối đậm), mỗi điều kiện một cột số (giữ thứ tự khối →
 * loại → mức của máy chủ, không sắp theo cột). Bấm dòng mở hộp xem; Sửa / Xoá trên dòng; Thêm mở form của danh mục (điền sẵn cấp đang xem).
 */
export function FacilityStandardRulesPage({ config }: { config: CatalogConfig }) {
  const mayCreate = useCan({ resource: config.resource, action: "create" }).data?.can ?? false;
  const mayEdit = useCan({ resource: config.resource, action: "edit" }).data?.can ?? false;
  const mayDelete = useCan({ resource: config.resource, action: "delete" }).data?.can ?? false;
  // Cấp của hệ thống (danh mục Cấp học): một cấp thì đứng luôn ở cấp đó — không còn dải chọn cấp.
  const systemLevels = useFacilityLevels();
  const [savedLevel, setLevel] = usePersistentState<string>("facility-standard-rules.level", systemLevels[0].code);
  const level = systemLevels.some((l) => l.code === savedLevel) ? savedLevel : systemLevels[0].code;
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [dialog, setDialog] = useState<FormDialogState>({ open: false });
  const [viewing, setViewing] = useState<number | null>(null);
  const [legalView, setLegalView] = useState<LegalDocDialogState>(null);
  const { data: legalDocs } = useQuery({
    queryKey: ["legal_documents", "picker"],
    queryFn: () => kyInstance.get("legal_documents", { searchParams: { _start: "0", _end: "500" } }).json<{ id: number; code: string }[]>(),
  });
  const docByCode = useMemo(() => new Map((legalDocs ?? []).map((d) => [d.code.toUpperCase(), d.id])), [legalDocs]);

  // Cả danh mục một lần (vài trăm quy tắc): đếm theo cấp cho dải chọn, lọc / sắp / chia khối ngay trên trình duyệt.
  const { result, query } = useList<FacilityStandardRule>({
    resource: config.resource,
    pagination: { currentPage: 1, pageSize: 1000 },
  });
  const all = useMemo(() => result?.data ?? [], [result]);
  const levels = systemLevels.filter((l) => all.some((r) => r.levelCode === l.code) || l.code === level);
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
              label: <>{l.name}<Count n={all.filter((r) => r.levelCode === l.code).length} /></>,
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
            label: <>{t.short}<Count n={t.key === "ALL" ? ofLevel.length : ofLevel.filter((r) => r.tier === t.key).length} /></>,
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
                  {COLS.map((c) => (
                    <TableHead key={c.key} title={c.title} className="w-32 text-right leading-tight whitespace-normal">{c.label}</TableHead>
                  ))}
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
                          {COLS.map((c) => (
                            <TableCell key={c.key} className="text-right whitespace-nowrap tabular-nums">{cell(c.key, r[c.key] as number | null | undefined, c.unit)}</TableCell>
                          ))}
                          <TableCell className="text-muted-foreground truncate text-xs italic" title={r.legalBasis ?? ""}>
                            {r.legalBasis ? <LegalBasisText text={r.legalBasis} docs={docByCode} onOpen={(id) => setLegalView({ mode: "view", id })} /> : "—"}
                          </TableCell>
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
      <LegalDocDialog state={legalView} onClose={() => setLegalView(null)} />
    </ListView>
  );
}
