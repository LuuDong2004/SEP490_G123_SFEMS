import { useCan, useList } from "@refinedev/core";
import { Eye, LayoutGrid, Pencil, Plus, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import type { CatalogConfig } from "@/shared/components/catalog/types";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { FillBox } from "@/shared/components/layout/fill-box";
import { Segmented } from "@/shared/components/segmented";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { useFacilityLevels } from "@/features/catalogs/facility-catalog-extra";
import { fold } from "@/shared/components/data-table/icon-filter";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { STANDARD_TIER_LABELS, STANDARD_TIERS, perClassText, type FacilityStandardRule, type StandardTier } from "@/domains/facility/standard";
import { TableEmpty } from "@/shared/components/data-table/table-empty";

import { FacilityStandardDialog } from "./facility-standard-dialog";
import { LegalDocDialog, type LegalDocDialogState } from "./legal-doc-dialog";

const num = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2, useGrouping: false });
const TIER_VARIANTS: Record<StandardTier, "neutral" | "info" | "success"> = { MIN: "neutral", LEVEL1: "info", LEVEL2: "success" };

const NO_GROUP = "Chưa xếp khối";
const TIER_HINTS = [
  "Mọi trường phải đạt.",
  "Đạt mọi yêu cầu tối thiểu và thêm các yêu cầu ở cột này.",
  "Đạt mọi yêu cầu mức độ 1 và thêm các yêu cầu ở cột này.",
];

/** Loại CSVC của danh mục — mỗi loại một dòng của bảng, dù chưa có quy tắc nào. */
type RoomTypeRow = { id: number; code: string; name: string; sortOrder: number | null; kind: string; group: { name: string } | null };

type TypeRow = { id: number; code: string; name: string; group: string; order: number; unit: string; rules: FacilityStandardRule[] };

/** Điều kiện của một quy tắc: `main` là con số chính (chữ đậm), `extra` là ngưỡng đi kèm (chữ vàng). */
function conditions(r: FacilityStandardRule, unit: string) {
  const n = (v: number) => num.format(Number(v));
  const main = [
    r.minCount != null ? `${r.minCount} ${unit}` : null,
    r.countPerClass != null ? perClassText(r.countPerClass) : null,
    r.minRoomArea != null ? `${n(r.minRoomArea)} m²/${unit}` : null,
    r.areaPerStudent != null ? `${n(r.areaPerStudent)} m²/học sinh` : null,
    r.minTotalArea != null ? `tổng ≥ ${n(r.minTotalArea)} m²` : null,
  ].filter(Boolean) as string[];
  const extra = [
    r.largeClassFrom != null ? `trên ${r.largeClassFrom} lớp: ${r.largeMinCount} ${unit}` : null,
    r.studentPercent != null ? `tính ${n(r.studentPercent)}% học sinh` : null,
  ].filter(Boolean) as string[];
  return { main, extra };
}

const CONDITION_KEYS = ["minCount", "countPerClass", "minRoomArea", "areaPerStudent", "minTotalArea"] as const;

/**
 * Ô của một loại ở một mức. Văn bản tính CỘNG DỒN (mức độ 1 = tối thiểu + thêm, mức độ 2 = mức độ 1 + thêm): mức không có
 * yêu cầu riêng ghi "Như tối thiểu" / "Như mức độ 1", chưa tới mức phải có ghi "Không yêu cầu" — ô nào cũng đọc được, không
 * ô nào trống (trưởng nhóm 24/11/2026: "1 loại phòng thì phải có 3 mức để set"). Sửa bằng nút cuối dòng.
 */
function TierCell({ type, tier }: { type: TypeRow; tier: StandardTier }) {
  const at = STANDARD_TIERS.findIndex((x) => x.key === tier);
  const ruleOf = (k: StandardTier) => type.rules.find((r) => r.tier === k);
  const stored = ruleOf(tier);
  const own = stored && stored.active !== false ? stored : undefined;
  const lower = [...STANDARD_TIERS.slice(0, at)].reverse().map((x) => ({ key: x.key, rule: ruleOf(x.key) }))
    .find((x) => x.rule && x.rule.active !== false);
  const lowerName = lower ? STANDARD_TIER_LABELS[lower.key].toLowerCase() : "";
  // Mức này có yêu cầu riêng nhưng vẫn còn điều kiện của mức dưới mà nó không nhắc lại.
  const carries = !!own && !!lower && CONDITION_KEYS.some((k) => lower.rule![k] != null && own[k] == null);
  const empty = type.rules.every((r) => r.active === false);
  const body = own ? (
    <>
      {own.onlyIfPresent ? <div className="text-muted-foreground text-xs">Chỉ xét khi trường có</div> : null}
      <div className="font-medium tabular-nums">{conditions(own, type.unit).main.join(" · ")}</div>
      {conditions(own, type.unit).extra.map((x) => <div key={x} className="text-warning-text text-xs font-medium">{x}</div>)}
      {own.note ? <div className="text-muted-foreground text-xs">{own.note}</div> : null}
      {carries ? <div className="text-muted-foreground text-xs">kèm yêu cầu {lowerName}</div> : null}
    </>
  ) : (
    <div className="text-muted-foreground text-sm">
      {lower ? `Như ${lowerName}` : empty ? "Không quy định" : "Không yêu cầu"}
      {stored ? <div className="text-xs italic">có quy tắc đang ngừng dùng</div> : null}
    </div>
  );
  return (
    <TableCell className="ps-3 align-middle whitespace-normal">
      {body}
    </TableCell>
  );
}

/** Số đếm cạnh nhãn dải chọn — viên riêng, để "Mức độ 1" và "2" không đọc liền thành "Mức độ 12". */
const Count = ({ n }: { n: number }) => (
  <span className="ms-1.5 rounded-full bg-current/15 px-1.5 text-[0.6875rem] leading-[1.125rem] font-semibold tabular-nums">{n}</span>
);

/**
 * Màn Chuẩn CSVC (Danh mục chung) — mỗi loại CSVC MỘT dòng, ba cột Tối thiểu · Mức độ 1 · Mức độ 2 như Phụ lục IV của
 * thông tư (trưởng nhóm 24/11/2026), bảng chia theo khối. Sửa (hoặc xem) bằng nút cuối dòng.
 */
export function FacilityStandardRulesPage({ config }: { config: CatalogConfig }) {
  const mayCreate = useCan({ resource: config.resource, action: "create" }).data?.can ?? false;
  const mayEdit = useCan({ resource: config.resource, action: "edit" }).data?.can ?? false;
  const canSet = mayCreate && mayEdit;
  // Cấp của hệ thống (danh mục Cấp học): một cấp thì đứng luôn ở cấp đó — không còn dải chọn cấp.
  const systemLevels = useFacilityLevels();
  const [savedLevel, setLevel] = usePersistentState<string>("facility-standard-rules.level", systemLevels[0].code);
  const level = systemLevels.some((l) => l.code === savedLevel) ? savedLevel : systemLevels[0].code;
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [cover, setCover] = useState<string>("ALL");
  const [editing, setEditing] = useState<{ type: TypeRow | null } | null>(null);
  const [legalView, setLegalView] = useState<LegalDocDialogState>(null);
  // Cả danh mục một lần (vài trăm quy tắc): đếm theo cấp cho dải chọn, lọc / sắp / chia khối ngay trên trình duyệt.
  const { result, query } = useList<FacilityStandardRule>({
    resource: config.resource,
    pagination: { currentPage: 1, pageSize: 1000 },
  });
  const all = useMemo(() => result?.data ?? [], [result]);
  // Mọi loại CSVC của cấp học: loại chưa có quy tắc cũng là một dòng, để thấy còn thiếu gì và đặt ngay.
  const { result: typeResult, query: typeQuery } = useList<RoomTypeRow>({
    resource: "room_types",
    pagination: { currentPage: 1, pageSize: 500 },
    filters: [{ field: "standard", operator: "eq", value: true }, { field: "active", operator: "eq", value: true },
      { field: "level", operator: "eq", value: level }],
  });
  const { result: groupResult } = useList<{ id: number; name: string; sortOrder: number | null }>({
    resource: "facility_groups",
    pagination: { currentPage: 1, pageSize: 100 },
  });
  const levels = systemLevels.filter((l) => all.some((r) => r.levelCode === l.code) || l.code === level);

  // Thứ tự khối → loại, cùng công thức với `sortOrder` của quy tắc ở máy chủ (khối × 10000 + loại × 10).
  const types = useMemo(() => {
    const rules = all.filter((r) => r.levelCode === level);
    const rank = new Map((groupResult?.data ?? []).map((g) => [g.name, g.sortOrder ?? 0]));
    const map = new Map<number, TypeRow>();
    for (const x of typeResult?.data ?? []) {
      const name = x.group?.name ?? NO_GROUP;
      map.set(x.id, { id: x.id, code: x.code, name: x.name, group: name, unit: x.kind === "AREA" ? "hạng mục" : "phòng",
        order: (rank.get(name) ?? 99) * 10000 + (x.sortOrder ?? 0) * 10, rules: [] });
    }
    for (const r of rules) {
      const x = r.roomType;
      if (!x) continue;
      if (!map.has(x.id)) {
        map.set(x.id, { id: x.id, code: x.code, name: x.name, group: x.groupName ?? NO_GROUP, unit: "phòng", order: r.sortOrder ?? 0, rules: [] });
      }
      map.get(x.id)!.rules.push(r);
    }
    return [...map.values()].sort((x, y) => x.order - y.order);
  }, [all, level, typeResult, groupResult]);
  const groups = [...new Set(types.map((x) => x.group))];
  const ruled = (x: TypeRow) => x.rules.some((r) => r.active !== false);
  const term = fold(q.trim());
  const shown = types.filter((x) =>
    (!term || fold([x.name, x.code, ...x.rules.flatMap((r) => [r.legalBasis ?? "", ...(r.legalDocuments ?? []).map((d) => d.code)])].join(" ")).includes(term))
    && (!group || x.group === group)
    && (cover === "ALL" || (cover === "RULED") === ruled(x)));
  const sections = groups.map((g) => [g, shown.filter((x) => x.group === g)] as const).filter(([, rows]) => rows.length);

  const cols = 4 + STANDARD_TIERS.length;
  let stt = 0;

  return (
    <ListView>
      <ListViewHeader canCreate={false} title={config.label} />
      {levels.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Cấp học" value={level} onChange={(v) => { setLevel(v); setGroup(null); }}
            options={levels.map((l) => ({
              value: l.code,
              label: l.name,
              hint: `Chuẩn CSVC cấp ${l.name}`,
            }))} />
        </div>
      ) : null}

      <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm loại CSVC, mã, văn bản…" className="pl-8" />
        </div>
        <Segmented label="Quy định" value={cover} onChange={setCover}
          options={[
            { value: "ALL", hint: "Mọi loại CSVC", label: <>Tất cả<Count n={types.length} /></> },
            { value: "RULED", hint: "Loại đã có yêu cầu ở ít nhất một mức", label: <>Có quy định<Count n={types.filter(ruled).length} /></> },
            { value: "NONE", hint: "Loại chưa có yêu cầu ở mức nào", label: <>Không quy định<Count n={types.filter((x) => !ruled(x)).length} /></> },
          ]} />
        <IconFilter labeled icon={<LayoutGrid />} label="khối CSVC" allLabel="Tất cả khối" value={group} onChange={setGroup}
          groups={[{ items: groups.map((g) => ({ key: g, label: g, count: types.filter((x) => x.group === g).length })) }]} />
        <div className="ms-auto flex items-center gap-2">
          <span className="text-muted-foreground text-sm tabular-nums">{shown.length} loại CSVC</span>
          {canSet ? (
            <Button type="button" onClick={() => setEditing({ type: null })}>
              <Plus />
              Thêm chuẩn
            </Button>
          ) : null}
        </div>
      </div>

      <FillBox>
        <div className="bg-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
          <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible">
            <Table className="min-w-[76rem] table-fixed">
              <TableHeader sticky>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-14 text-center">STT</TableHead>
                  <TableHead>Loại CSVC</TableHead>
                  {STANDARD_TIERS.map((x, i) => (
                    <TableHead key={x.key} className="w-64 ps-3" title={TIER_HINTS[i]}>
                      <Badge variant={TIER_VARIANTS[x.key]} className="whitespace-nowrap">{x.short}</Badge>
                    </TableHead>
                  ))}
                  <TableHead className="w-48 ps-6">Văn bản căn cứ</TableHead>
                  <TableHead className="w-14"><span className="sr-only">Thao tác</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isLoading || typeQuery.isLoading ? (
                  Array.from({ length: 6 }, (_, i) => (
                    <TableRow key={i}><TableCell colSpan={cols}><Skeleton className="h-5" /></TableCell></TableRow>
                  ))
                ) : sections.length === 0 ? (
                  <TableEmpty colSpan={cols} title={types.length ? "Không có loại CSVC nào khớp bộ lọc." : "Cấp học này chưa có loại CSVC."} />
                ) : sections.map(([name, rows]) => (
                  <Fragment key={name}>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={cols} className="py-2">
                        <span className="text-primary text-sm font-semibold uppercase">{name}</span>
                        <span className="text-muted-foreground ms-2 text-xs tabular-nums">{rows.length} loại</span>
                      </TableCell>
                    </TableRow>
                    {rows.map((x) => {
                      stt += 1;
                      const used = x.rules.filter((r) => r.active !== false);
                      const docs = [...new Map(used.flatMap((r) => r.legalDocuments ?? []).map((d) => [d.id, d])).values()];
                      const clauses = STANDARD_TIERS.map((k) => ({ k, r: used.find((r) => r.tier === k.key) })).filter(({ r }) => r?.legalBasis)
                        .map(({ k, r }) => `${k.short}: ${r!.legalBasis}`).join("\n");
                      return (
                        <TableRow key={x.id} className="group/row">
                          <TableCell className="text-muted-foreground text-center tabular-nums">{stt}</TableCell>
                          <TableCell className="font-medium whitespace-normal">{x.name}</TableCell>
                          {STANDARD_TIERS.map((k) => (
                            <TierCell key={k.key} type={x} tier={k.key} />
                          ))}
                          <TableCell className="text-muted-foreground ps-6 text-xs whitespace-normal italic" title={clauses || undefined}>
                            {docs.length ? docs.map((d) => (
                              <button key={d.id} type="button" className="text-primary block hover:underline" title={d.name}
                                onClick={() => setLegalView({ mode: "view", id: d.id })}>
                                {d.code}
                              </button>
                            )) : "Chưa khai"}
                          </TableCell>
                          <TableCell className="px-1 text-center">
                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing({ type: x })}
                              title={canSet ? "Sửa chuẩn" : "Xem chuẩn"} aria-label={`${canSet ? "Sửa" : "Xem"} chuẩn ${x.name}`}>
                              {canSet ? <Pencil /> : <Eye />}
                            </Button>
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

      <FacilityStandardDialog open={editing != null} type={editing?.type ?? null} types={types} levelCode={level}
        readOnly={!canSet} onClose={() => setEditing(null)} />
      <LegalDocDialog state={legalView} onClose={() => setLegalView(null)} />
    </ListView>
  );
}
