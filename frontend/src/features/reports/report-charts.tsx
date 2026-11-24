import { Banknote, Boxes, Building2, CircleHelp, CalendarClock, CircleAlert, ClipboardList, FileCheck2, Gauge, Package, Ruler, School, ShieldCheck, ShoppingCart, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { ChartCard, ColumnChart, DonutBreakdown, GroupedBars, Meter, StatTile, TrendArea, type Series, type Slice } from "@/shared/components/charts/charts";
import { count, foldOther, shortMoney } from "@/shared/lib/chart-palette";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import type { Report } from "@/domains/report/types";
import type { ReportDrill } from "@/features/reports/report-drill";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, any>;
const MOVES: Series[] = [
  { key: "GHI_TANG", label: "Ghi tăng" },
  { key: "MAT", label: "Mất" },
];
const n = (v: unknown) => Number(v) || 0;
const sum = (rows: Row[], key: string) => rows.reduce((s, r) => s + n(r[key]), 0);
const money = shortMoney;

/**
 * Ô chỉ số mang nhiều con số: MỘT số lớn, các phần ghi ở dòng phụ, mỗi số kèm chữ nói nó là gì — mọi ô cùng một dáng, không ô
 * nào nhồi ba số to. `sumOf`: các phần cộng được (thiếu + thừa). `leadOf`: không cộng được (khối nhà, phòng) — số lớn là phần đầu.
 */
const partsHint = (items: [number, string][]) => items.map(([v, word]) => `${count.format(v)} ${word}`).join(" · ");
const sumOf = (items: [number, string][]) => ({ value: count.format(items.reduce((t, [v]) => t + v, 0)), hint: partsHint(items) });
const leadOf = (items: [number, string][]) => ({ value: count.format(items[0][0]), hint: partsHint(items) });

/** Hai (ba) biểu đồ cạnh nhau trong một khung, ngăn bằng đường kẻ; màn hẹp thì xếp dọc. */
function Pair({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-[minmax(0,1fr)] divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0", className)}>{children}</div>;
}

/** Tổng từng loạt trên mọi dòng → các phần của vòng tròn cơ cấu. */
const seriesTotals = (rows: Row[], series: Series[]): Slice[] =>
  series.map((x) => ({ key: x.key, label: x.label, count: sum(rows, x.key) }));

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);

/** Số cột tối đa của biểu đồ theo nhóm — nhiều hơn thì chữ dưới cột không đọc nổi. */
const TOP = 10;

/**
 * Cặp biểu đồ thường gặp: vòng tròn cơ cấu CHUNG (tổng từng loạt trên mọi nhóm) bên trái, cột chồng theo từng nhóm
 * bên phải — nhìn tổng thể trước, rồi so các nhóm với nhau.
 */
function Breakdown({ rows, labelKey, series, unit, donutTitle, columnsTitle, noun, onSlice, onColumn }: {
  rows: Row[];
  labelKey: string;
  series: Series[];
  unit: string;
  donutTitle: string;
  columnsTitle: string;
  /** Một cột là gì: "trường", "loại thiết bị" — dòng phụ nói đang vẽ mấy cột trên tổng bao nhiêu. */
  noun: string;
  onSlice?: (slice: Slice) => void;
  onColumn?: (row: Row) => void;
}) {
  const shown = rows.length > TOP
    ? `${TOP} ${noun} nhiều ${unit} nhất, trên tổng ${count.format(rows.length)} ${noun}`
    : `Đủ ${count.format(rows.length)} ${noun} có ${unit}, nhiều nhất trước`;
  return (
    <Pair className="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <ChartCard bare title={donutTitle} description={`Tổng của ${count.format(rows.length)} ${noun}`}>
        <DonutBreakdown items={seriesTotals(rows, series)} unit={unit} onPick={onSlice} />
      </ChartCard>
      <ChartCard bare title={columnsTitle} description={shown}>
        <ColumnChart rows={rows} labelKey={labelKey} series={series} unit={unit} limit={TOP} onPick={onColumn} />
      </ChartCard>
    </Pair>
  );
}

function Tiles({ children }: { children: ReactNode }) {
  return (
    <Card className="gap-0 py-0">
      <div className="grid grid-cols-[minmax(0,1fr)] divide-y sm:grid-cols-2 sm:divide-y-0 xl:auto-cols-fr xl:grid-flow-col xl:grid-cols-none xl:divide-x">{children}</div>
    </Card>
  );
}

/**
 * Phần hình của từng báo cáo: một hàng chỉ số và một (hai) biểu đồ, vẽ từ chính các
 * dòng mà bảng bên dưới hiện — biểu đồ và bảng không bao giờ lệch nhau. Báo cáo nào
 * không có ở đây thì chỉ có bảng.
 */
/** Bộ lọc theo cột của trang báo cáo — để ô chỉ số bấm vào là lọc bảng. `all`: các dòng CHƯA lọc. */
export type ReportFilter = {
  active: Record<string, string>;
  set: (key: string, value: string | null) => void;
  all: Row[];
};

/** Ô chỉ số bấm được: bấm là lọc bảng theo một giá trị, bấm lại là bỏ lọc. Đang lọc thì ô có viền nhấn. */
function PickTile({ on, onPick, children }: { on: boolean; onPick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onPick}
      className={cn("block h-full w-full text-left transition-colors hover:bg-accent/40",
        on && "bg-primary/[0.05] shadow-[inset_0_-2px_0_var(--primary)]")}>
      {children}
    </button>
  );
}

export function ReportVisual({ report, part, filter, onDrill }: {
  report: Report;
  part: "stats" | "charts";
  filter?: ReportFilter;
  /** Bấm một mục trên biểu đồ: mở số liệu chi tiết của mục đó. Không truyền thì biểu đồ chỉ để xem. */
  onDrill?: (drill: ReportDrill) => void;
}) {
  const rows = report.rows as Row[];
  const summaryOf = (value: unknown, unit: string) => `${count.format(n(value))} ${unit}`;
  // Bỏ cột đang lọc theo: tiêu đề hộp đã nói, cả cột chỉ lặp một giá trị.
  const without = (key?: string) => (key ? report.columns.filter((c) => c.key !== key) : undefined);
  // Báo cáo có danh sách từng dòng: các dòng thuộc mục vừa bấm.
  const pickList = (unit: string, match: (row: Row, slice: Slice) => boolean, opts: { source?: Row[]; hide?: string } = {}) => onDrill && ((s: Slice) =>
    onDrill({ title: s.label, summary: summaryOf(s.count, unit), columns: without(opts.hide), rows: (opts.source ?? rows).filter((r) => match(r, s)) }));
  // Như trên cho vòng đã gộp đuôi thành "Khác": mục "Khác" là mọi dòng không thuộc các phần có tên.
  const pickFolded = (unit: string, items: Slice[], valueOf: (row: Row) => string, hide?: string) => {
    const named = new Set(items.filter((i) => i.key !== "__other").map((i) => i.label));
    return pickList(unit, (r, s) => (s.key === "__other" ? !named.has(valueOf(r)) : valueOf(r) === s.label), { hide });
  };
  // Cột "theo trường" của báo cáo có danh sách: các dòng của trường đó.
  const pickSchool = (unit: string) => onDrill && ((row: Row) =>
    onDrill({ title: String(row.label), summary: summaryOf(row.count, unit), columns: without("school"), rows: rows.filter((r) => r.school === row.label) }));
  // Báo cáo chỉ có số đếm theo nhóm: mục vừa bấm chia theo từng nhóm. `parts`: phần của vòng cộng từ cột nào của báo
  // cáo khi khoá của nó không phải tên cột.
  const pickSeries = (unit: string, source: Row[], parts: Record<string, string[]> = {}) => onDrill && ((s: Slice) => {
    const keys = parts[s.key] ?? [s.key];
    const value = (r: Row) => keys.reduce((t, k) => t + n(r[k]), 0);
    const own = report.columns.filter((c) => keys.includes(c.key));
    const shown = own.length === 1 && keys.length === 1 ? own
      : [...own, { key: "__value", label: own.length ? "Tổng" : s.label, type: "number" as const }];
    onDrill({
      title: s.label,
      summary: summaryOf(s.count, unit),
      columns: [...report.columns.filter((c) => c.type === "text"), ...shown],
      rows: source.map((r) => ({ ...r, __value: value(r) })).filter((r) => r.__value > 0).sort((a, b) => b.__value - a.__value),
    });
  });
  // Cột của một nhóm trong báo cáo số đếm: các con số của riêng nhóm đó.
  const pickRecord = (labelKey: string) => onDrill && ((row: Row) => onDrill({ title: String(row[labelKey] ?? "—"), record: row }));
  // Biểu đồ cột vẽ từ các phần đã tính sẵn (mỗi cột là một phần của vòng): dòng của cột chính là phần đó.
  const asSlice = (pick?: (s: Slice) => void) => pick && ((row: Row) => pick(row as Slice));
  switch (report.name) {
    case "room-standard": {
      // Đếm trên MỌI phòng (chưa lọc): bấm "Đạt" thì bảng còn phòng đạt, nhưng ba ô vẫn cho thấy cả bức tranh.
      const all = filter?.all ?? rows;
      const verdicts: [string, ReactNode, "success" | "destructive" | "warning", string][] = [
        ["Đạt", <ShieldCheck key="ok" />, "success", "Phòng đạt chuẩn"],
        ["Chưa đạt", <CircleAlert key="no" />, "destructive", "Phòng chưa đạt"],
        ["Chưa xác định", <CircleHelp key="na" />, "warning", "Chưa xác định"],
      ];
      const rated = all.filter((r) => r.percent != null);
      const avg = rated.length ? Math.round(rated.reduce((s2, r) => s2 + n(r.percent), 0) / rated.length) : null;
      return part === "stats" ? (
        <Tiles>
          {verdicts.map(([v, icon, tone, label]) => {
            const count2 = all.filter((r) => r.verdict === v).length;
            const tile = (
              <StatTile flat icon={icon} tone={tone} label={label} value={count.format(count2)}
                hint={v === "Chưa xác định" ? "Môn của phòng chưa có định mức theo phòng" : `${all.length ? Math.round((count2 / all.length) * 100) : 0}% số phòng`} />
            );
            return filter ? (
              <PickTile key={v} on={filter.active.verdict === v} onPick={() => filter.set("verdict", filter.active.verdict === v ? null : v)}>
                {tile}
              </PickTile>
            ) : <div key={v}>{tile}</div>;
          })}
          <StatTile flat icon={<Gauge />} label="Mức đạt bình quân" value={avg == null ? "—" : `${avg}%`}
            hint="Thiết bị đã đủ trên thiết bị phải có, bình quân các phòng" />
        </Tiles>
      ) : (
        <Pair>
          <ChartCard bare title="Kết luận theo phòng">
            <DonutBreakdown unit="phòng" items={verdicts.map(([v], i) => ({ key: `v${i}`, label: v, count: all.filter((x) => x.verdict === v).length }))}
              onPick={pickList("phòng", (r, s) => r.verdict === s.label, { source: all, hide: "verdict" })} />
          </ChartCard>
          <ChartCard bare title="Mức đạt bình quân" description="Thiết bị đã đủ trên thiết bị phải có">
            <Meter percent={avg} label="Bình quân các phòng" hint={`${count.format(rated.length)} phòng tính được`} />
          </ChartCard>
        </Pair>
      );
    }
    case "equipment-by-school": {
      const sorted = [...rows].sort((a, b) => n(b.total) - n(a.total));
      // Gộp theo đơn vị thì mỗi dòng là một trường; gộp theo chiều khác thì cột "Số trường" đã đếm sẵn.
      const bySchool = report.columns.some((c) => c.key === "code");
      const schools = bySchool ? rows.length : Math.max(0, ...rows.map((r) => n(r.schools)));
      const dimension = report.columns.find((c) => c.key === "name")?.label ?? "Nhóm";
      return part === "stats" ? (
        <>
          <Tiles>
            <StatTile flat icon={<School />} label={bySchool ? "Trường" : "Phạm vi"}
              {...(bySchool ? { value: count.format(schools) } : leadOf([[rows.length, dimension.toLowerCase()], [schools, "trường"]]))} />
            <StatTile flat icon={<Boxes />} label="Thiết bị trong hệ thống" value={count.format(sum(rows, "total"))} />
            <StatTile flat icon={<ShieldCheck />} tone="success" label="Đang dùng" value={count.format(sum(rows, "in_use"))} />
            <StatTile flat icon={<Package />} label="Trong kho" value={count.format(sum(rows, "in_stock"))} />
          </Tiles>
        </>
      ) : (
        <Breakdown rows={sorted} labelKey="name" unit="thiết bị" donutTitle="Cơ cấu thiết bị"
          onSlice={pickSeries("thiết bị", sorted)} onColumn={pickRecord("name")}
          columnsTitle={`Thiết bị theo ${dimension.toLowerCase()}`} noun={dimension.toLowerCase()} series={[
            { key: "in_use", label: "Đang dùng" },
            { key: "in_stock", label: "Trong kho" },
          ]} />
      );
    }
    case "equipment-by-catalog": {
      const sorted = [...rows].sort((a, b) => n(b.total) - n(a.total));
      return part === "stats" ? (
        <>
          <Tiles>
            <StatTile flat icon={<Package />} label="DM thiết bị" value={count.format(rows.length)} />
            <StatTile flat icon={<Boxes />} label="Thiết bị trong hệ thống" value={count.format(sum(rows, "total"))} />
            <StatTile flat icon={<ShieldCheck />} tone="success" label="Đang dùng" value={count.format(sum(rows, "in_use"))} />
            <StatTile flat icon={<Package />} label="Trong kho" value={count.format(sum(rows, "in_stock"))} />
          </Tiles>
        </>
      ) : (
        <Breakdown rows={sorted} labelKey="catalog" unit="thiết bị" donutTitle="Tình hình sử dụng"
          onSlice={pickSeries("thiết bị", sorted)} onColumn={pickRecord("catalog")}
          columnsTitle="Thiết bị theo danh mục" noun="danh mục" series={[
            { key: "in_use", label: "Đang dùng" },
            { key: "in_stock", label: "Trong kho" },
          ]} />
      );
    }
    case "equipment-by-status": {
      const data = [...rows].sort((a, b) => n(b.total) - n(a.total));
      const dimension = report.columns.find((c) => c.key === "name")?.label ?? "Nhóm";
      return part === "stats" ? (
        <Tiles>
          <StatTile flat icon={<Boxes />} label="Thiết bị trong hệ thống" value={count.format(sum(rows, "total"))} />
          <StatTile flat icon={<ShieldCheck />} tone="success" label="Đang dùng" value={count.format(sum(rows, "in_use"))} />
          <StatTile flat icon={<Package />} label="Trong kho" value={count.format(sum(rows, "in_stock"))} />
        </Tiles>
      ) : data.length ? (
        <Breakdown rows={data} labelKey="name" unit="thiết bị" donutTitle="Trạng thái sử dụng"
          onSlice={pickSeries("thiết bị", data)}
          onColumn={pickRecord("name")}
          columnsTitle={`Trạng thái theo ${dimension.toLowerCase()}`} noun={dimension.toLowerCase()} series={[
            { key: "in_use", label: "Đang dùng" },
            { key: "in_stock", label: "Trong kho" },
          ]} />
      ) : null;
    }
    case "equipment-by-condition": {
      const data = [...rows].sort((a, b) => n(b.total) - n(a.total));
      const total = sum(rows, "total");
      const pct = (v: number) => (total ? `${v > 0 && v / total < 0.01 ? ((v / total) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : Math.round((v / total) * 100)}% thiết bị` : undefined);
      const dimension = report.columns.find((c) => c.key === "name")?.label ?? "Nhóm";
      return part === "stats" ? (
        <Tiles>
          <StatTile flat icon={<ShieldCheck />} tone="success" label="Tốt" value={count.format(sum(rows, "good"))} hint={pct(sum(rows, "good"))} />
          <StatTile flat icon={<Gauge />} label="Trung bình" value={count.format(sum(rows, "average"))} hint={pct(sum(rows, "average"))} />
          <StatTile flat icon={<TrendingDown />} tone="warning" label="Kém" value={count.format(sum(rows, "poor"))} hint={pct(sum(rows, "poor"))} />
          <StatTile flat icon={<CircleHelp />} label="Chưa đánh giá" value={count.format(sum(rows, "unrated"))} hint={pct(sum(rows, "unrated"))} />
        </Tiles>
      ) : data.length ? (
        <Breakdown rows={data} labelKey="name" unit="thiết bị" donutTitle="Tình trạng kỹ thuật"
          onSlice={pickSeries("thiết bị", data)}
          onColumn={pickRecord("name")}
          columnsTitle={`Tình trạng theo ${dimension.toLowerCase()}`} noun={dimension.toLowerCase()} series={[
            { key: "good", label: "Tốt" },
            { key: "average", label: "Trung bình" },
            { key: "poor", label: "Kém" },
            { key: "unrated", label: "Chưa đánh giá" },
          ]} />
      ) : null;
    }
    case "equipment-list": {
      const bySchool = Object.entries(rows.reduce((m: Record<string, number>, r) => {
        m[r.school] = (m[r.school] ?? 0) + 1;
        return m;
      }, {})).map(([k, v]) => ({ key: k, label: k, count: v })).sort((a, b) => b.count - a.count).slice(0, 10);
      const byCatalog = foldOther(Object.entries(rows.reduce((m: Record<string, number>, r) => {
        const k = r.catalog ?? "Chưa gắn thiết bị";
        m[k] = (m[k] ?? 0) + 1;
        return m;
      }, {})).sort((a, b) => b[1] - a[1]).map(([k, v], i) => ({ key: `c${i}`, label: k, count: v })));
      return part === "stats" ? (
        <Tiles>
          <StatTile flat icon={<Boxes />} label="Thiết bị" value={count.format(rows.length)} />
          <StatTile flat icon={<School />} label="Trường" value={count.format(new Set(rows.map((r) => r.school)).size)} />
          <StatTile flat icon={<Building2 />} label="Chưa xếp chỗ" value={count.format(rows.filter((r) => !r.room).length)} />
        </Tiles>
      ) : rows.length ? (
        // Một trường (tài khoản trường, hoặc đang lọc một trường): biểu đồ "Theo trường" chỉ là một thanh 100%.
        <Pair className={bySchool.length > 1 ? undefined : "lg:grid-cols-1"}>
          <ChartCard bare title="Theo thiết bị">
            <DonutBreakdown items={byCatalog} unit="thiết bị" bars={bySchool.length <= 1} onPick={pickFolded("thiết bị", byCatalog, (r) => r.catalog ?? "Chưa gắn thiết bị", "catalog")} />
          </ChartCard>
          {bySchool.length > 1 ? (
            <ChartCard bare title="Theo trường" description="Trường nhiều thiết bị nhất">
              <ColumnChart rows={bySchool} labelKey="label" unit="thiết bị" series={[{ key: "count", label: "Thiết bị" }]} onPick={pickSchool("thiết bị")} />
            </ChartCard>
          ) : null}
        </Pair>
      ) : null;
    }
    case "data-quality": {
      const total = sum(rows, "total");
      const complete = sum(rows, "complete");
      const gaps: Slice[] = [
        { key: "code", label: "Thiếu mã chuẩn", count: sum(rows, "miss_code") },
        { key: "unit", label: "Thiếu đơn vị tính", count: sum(rows, "miss_unit") },
        { key: "funding", label: "Thiếu nguồn kinh phí", count: sum(rows, "miss_funding") },
        { key: "received", label: "Thiếu ngày tiếp nhận", count: sum(rows, "miss_received") },
        { key: "value", label: "Thiếu nguyên giá", count: sum(rows, "miss_value") },
        { key: "room", label: "Chưa xếp chỗ", count: sum(rows, "no_room") },
        { key: "manager", label: "Chưa có người quản lý", count: sum(rows, "no_manager") },
      ].sort((a, b) => b.count - a.count);
      const weak = rows.filter((r) => r.percent != null && n(r.percent) < 80).length;
      return part === "stats" ? (
        <Tiles>
          <StatTile flat icon={<ShieldCheck />} tone={total && complete / total >= 0.8 ? "success" : "warning"} label="Hồ sơ chuẩn"
            info="Thiết bị có đủ mã chuẩn, đơn vị tính, nguồn kinh phí, ngày tiếp nhận. Chỉ thiết bị đủ hồ sơ mới vào được phiếu."
            value={total ? `${Math.round((complete / total) * 100)}%` : "—"} hint={`${count.format(complete)} / ${count.format(total)} thiết bị`} />
          <StatTile flat icon={<CircleAlert />} tone="destructive" label="Hồ sơ chưa chuẩn" value={count.format(total - complete)} />
          <StatTile flat icon={<School />} tone="warning" label="Nhóm dưới 80% chuẩn" value={count.format(weak)}
            hint={`Trên ${count.format(rows.length)} nhóm`} />
          <StatTile flat icon={<Building2 />} label="Thiếu thông tin sử dụng"
            {...leadOf([[sum(rows, "no_room"), "chưa xếp chỗ"], [sum(rows, "no_manager"), "chưa có người quản lý"]])} />
        </Tiles>
      ) : gaps.some((g) => g.count > 0) ? (
        <Pair className="lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
          <ChartCard bare title="Hồ sơ chuẩn" description="Đủ mã, đơn vị tính, nguồn kinh phí, ngày tiếp nhận">
            <Meter percent={pct(complete, total)} label={`${count.format(complete)} / ${count.format(total)} thiết bị`}
              hint={`${count.format(total - complete)} thiết bị cần bổ sung hồ sơ`} />
          </ChartCard>
          <ChartCard bare title="Thiếu gì nhiều nhất" description="Số thiết bị thiếu từng thông tin (một thiết bị có thể thiếu nhiều thứ)">
            <ColumnChart rows={gaps.filter((g) => g.count > 0)} labelKey="label" unit="thiết bị" series={[{ key: "count", label: "Thiết bị thiếu" }]}
              onPick={asSlice(pickSeries("thiết bị", rows, {
                code: ["miss_code"], unit: ["miss_unit"], funding: ["miss_funding"], received: ["miss_received"],
                value: ["miss_value"], room: ["no_room"], manager: ["no_manager"],
              }))} />
          </ChartCard>
        </Pair>
      ) : null;
    }
    case "facilities": {
      // Chi tiết từng khối nhà / từng phòng: mỗi dòng một công trình — ô số đếm từ chính danh sách,
      // không có biểu đồ (bảng đã là thứ cần xem). `cond` là mã hiện trạng đi kèm dòng.
      const good = new Set(["TOT", "BINH_THUONG"]);
      const poor = new Set(["CAN_SUA_CHUA", "XUONG_CAP", "HU_HONG_NANG"]);
      const has = (key: string) => report.columns.some((c) => c.key === key);
      if (has("building_name") || has("room_name")) {
        if (part === "charts") return null;
        const rooms = has("room_name");
        const unrated = rows.filter((r) => !r.cond).length;
        return (
          <Tiles>
            <StatTile flat icon={<Building2 />} label={rooms ? "Phòng" : "Khối nhà, phòng"}
              {...(rooms ? { value: count.format(rows.length) } : leadOf([[rows.length, "khối nhà"], [sum(rows, "rooms"), "phòng"]]))} />
            <StatTile flat icon={<Ruler />} label={rooms ? "Diện tích phòng" : "Diện tích sàn"}
              value={`${count.format(sum(rows, rooms ? "area" : "floor_area"))} m²`}
              hint={`${count.format(rows.filter((r) => r[rooms ? "area" : "floor_area"] == null).length)} ${rooms ? "phòng" : "khối nhà"} chưa khai diện tích`} />
            <StatTile flat icon={<ShieldCheck />} tone="success" label="Tốt, bình thường"
              value={count.format(rows.filter((r) => good.has(r.cond)).length)} />
            <StatTile flat icon={<CircleAlert />} tone="destructive" label="Xuống cấp, cần sửa"
              value={count.format(rows.filter((r) => poor.has(r.cond)).length)}
              hint={unrated ? `${count.format(unrated)} chưa đánh giá hiện trạng` : undefined} />
          </Tiles>
        );
      }
      const sorted = [...rows].sort((a, b) => n(b.rooms) - n(a.rooms))
        .map((r) => ({ ...r, other: Math.max(n(r.rooms) - n(r.rooms_good) - n(r.rooms_poor), 0) }));
      const area = sum(rows, "room_area") || sum(rows, "floor_area");
      return part === "stats" ? (
        <Tiles>
          <StatTile flat icon={<Building2 />} label="Khối nhà, phòng"
            {...leadOf([[sum(rows, "buildings"), "khối nhà"], [sum(rows, "rooms"), "phòng"]])} />
          <StatTile flat icon={<Ruler />} label="Diện tích" value={`${count.format(area)} m²`}
            hint={sum(rows, "room_area") ? "Tổng diện tích phòng" : "Tổng diện tích sàn khối nhà"} />
          <StatTile flat icon={<ShieldCheck />} tone="success" label="Phòng tốt, bình thường" value={count.format(sum(rows, "rooms_good"))} />
          <StatTile flat icon={<CircleAlert />} tone="destructive" label="Phòng xuống cấp, cần sửa" value={count.format(sum(rows, "rooms_poor"))} />
        </Tiles>
      ) : sorted.length ? (
        <Breakdown rows={sorted} labelKey="name" unit="phòng" donutTitle="Tình trạng phòng" columnsTitle="Phòng theo nhóm"
          onSlice={pickSeries("phòng", sorted)} onColumn={pickRecord("name")}
          noun="nhóm" series={[
            { key: "rooms_good", label: "Tốt, bình thường" },
            { key: "other", label: "Chưa đánh giá" },
            { key: "rooms_poor", label: "Xuống cấp, cần sửa" },
          ]} />
      ) : null;
    }
    case "inventory": {
      const checked = sum(rows, "items");
      const missing = sum(rows, "missing");
      const surplus = sum(rows, "surplus");
      const misplaced = sum(rows, "wrong_room") + sum(rows, "wrong_condition");
      const diff: Slice[] = [
        { key: "missing", label: "Thiếu", count: missing },
        { key: "surplus", label: "Thừa", count: surplus },
        { key: "room", label: "Sai vị trí", count: sum(rows, "wrong_room") },
        { key: "condition", label: "Sai tình trạng", count: sum(rows, "wrong_condition") },
      ];
      return part === "stats" ? (
        <Tiles>
          <StatTile flat icon={<ClipboardList />} label="Đã kiểm kê"
            {...leadOf([[checked, "thiết bị"], [rows.length, "phiên"]])} />
          <StatTile flat icon={<ShieldCheck />} tone="success" label="Tìm thấy" value={count.format(sum(rows, "found"))}
            hint={checked ? `${Math.round((sum(rows, "found") / checked) * 100)}% số thiết bị kiểm` : undefined} />
          <StatTile flat icon={<CircleAlert />} tone="destructive" label="Chênh lệch"
            {...sumOf([[missing, "thiếu"], [surplus, "thừa"]])} />
          <StatTile flat icon={<TrendingDown />} tone="warning" label="Sai vị trí, sai tình trạng" value={count.format(misplaced)} />
        </Tiles>
      ) : diff.some((d) => d.count > 0) ? (
        <Pair className="lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
          <ChartCard bare title="Tỷ lệ tìm thấy" description="Trên số thiết bị đã kiểm">
            <Meter percent={pct(sum(rows, "found"), checked)} good={95} warn={85}
              label={`${count.format(sum(rows, "found"))} / ${count.format(checked)} thiết bị`} />
          </ChartCard>
          <ChartCard bare title="Chênh lệch sau kiểm kê" description="Tổng các phiên trong kỳ">
            <ColumnChart rows={diff} labelKey="label" unit="thiết bị" series={[{ key: "count", label: "Thiết bị" }]}
              onPick={asSlice(pickSeries("thiết bị", rows, { room: ["wrong_room"], condition: ["wrong_condition"] }))} />
          </ChartCard>
        </Pair>
      ) : null;
    }
    case "movements": {
      return part === "stats" ? (
        <>
          <Tiles>
            <StatTile flat icon={<TrendingUp />} tone="success" label="Ghi tăng" value={count.format(sum(rows, "GHI_TANG"))} />
            <StatTile flat icon={<TrendingDown />} tone="destructive" label="Mất" value={count.format(sum(rows, "MAT"))} />
          </Tiles>
        </>
      ) : (
        <Pair className="lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
          <ChartCard bare title="Xu hướng theo tháng" description="Số thiết bị có phát sinh trong kỳ">
            <TrendArea data={rows} xKey="month" series={MOVES} />
          </ChartCard>
          <ChartCard bare title="Cơ cấu biến động" description="Tổng cả kỳ">
            <DonutBreakdown items={seriesTotals(rows, MOVES)} unit="thiết bị"
              onPick={pickSeries("thiết bị", rows)} />
          </ChartCard>
        </Pair>
      );
    }
    case "vouchers": {
      const statuses: Slice[] = [
        { key: "completed", label: "Hoàn tất", count: sum(rows, "completed") },
        { key: "approved", label: "Đang thực hiện", count: sum(rows, "approved") },
        { key: "pending", label: "Chờ duyệt", count: sum(rows, "pending") },
        { key: "draft", label: "Nháp", count: sum(rows, "draft") },
        { key: "closed", label: "Từ chối, huỷ", count: sum(rows, "rejected") + sum(rows, "cancelled") },
      ];
      const byType = rows.map((r): Row => ({ ...r, closed: n(r.rejected) + n(r.cancelled) }))
        .filter((r) => n(r.total) > 0).sort((a, b) => n(b.total) - n(a.total));
      return part === "stats" ? (
        <>
          <Tiles>
            <StatTile flat icon={<FileCheck2 />} label="Phiếu trong kỳ" value={count.format(sum(rows, "total"))} />
            <StatTile flat icon={<CalendarClock />} tone="warning" label="Chờ duyệt" value={count.format(sum(rows, "pending"))} />
            <StatTile flat icon={<ClipboardList />} tone="success" label="Hoàn tất" value={count.format(sum(rows, "completed"))} />
            <StatTile flat icon={<CircleAlert />} tone="destructive" label="Từ chối, huỷ" value={count.format(statuses[4].count)} />
          </Tiles>
        </>
      ) : (
        <>
          <Pair className="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <ChartCard bare title="Tình trạng xử lý">
              <DonutBreakdown items={statuses} unit="phiếu" onPick={pickSeries("phiếu", rows, { closed: ["rejected", "cancelled"] })} />
            </ChartCard>
            <ChartCard bare title="Theo loại phiếu" description="Các loại có phát sinh trong kỳ">
              <ColumnChart rows={byType} labelKey="voucher" unit="phiếu" onPick={pickRecord("voucher")} series={[
                { key: "completed", label: "Hoàn tất" },
                { key: "approved", label: "Đang thực hiện" },
                { key: "pending", label: "Chờ duyệt" },
                { key: "draft", label: "Nháp" },
                { key: "closed", label: "Từ chối, huỷ" },
              ]} />
            </ChartCard>
          </Pair>
        </>
      );
    }
    case "adequacy": {
      const known = rows.filter((r) => r.percent != null && r.percent !== "");
      const bands: Slice[] = [
        { key: "full", label: "Đạt từ 80%", count: known.filter((r) => n(r.percent) >= 80).length },
        { key: "mid", label: "50% – dưới 80%", count: known.filter((r) => n(r.percent) >= 50 && n(r.percent) < 80).length },
        { key: "low", label: "Dưới 50%", count: known.filter((r) => n(r.percent) < 50).length },
        { key: "unknown", label: "Chưa tính được", count: rows.length - known.length },
      ];
      const avg = known.length ? Math.round(known.reduce((s, r) => s + n(r.percent), 0) / known.length) : 0;
      return part === "stats" ? (
        <>
          <Tiles>
            <StatTile flat icon={<School />} label="Trường" value={count.format(rows.length)} />
            <StatTile flat icon={<Gauge />} tone={avg >= 80 ? "success" : "warning"} label="Đáp ứng trung bình" value={`${avg}%`}
              info="Trung bình tỷ lệ đạt của các trường. Trường thiếu số lớp, số học sinh thì chưa tính." />
            <StatTile flat icon={<CircleAlert />} tone="destructive" label="Trường còn thiếu thiết bị"
              value={count.format(rows.filter((r) => n(r.shortage) > 0).length)} hint="Có ít nhất một loại chưa đủ số lượng" />
            <StatTile flat icon={<ClipboardList />} label="Định mức chưa tính được" value={count.format(sum(rows, "unknown"))}
              hint="Thiếu số lớp / số học sinh" />
          </Tiles>
        </>
      ) : (
        <>
          <Pair>
            <ChartCard bare title="Đáp ứng trung bình" description="Định mức tối thiểu đã đủ">
              <Meter percent={known.length ? avg : null} label={`${count.format(known.length)} trường tính được`}
                hint={`${count.format(rows.filter((r) => n(r.shortage) > 0).length)} trường còn thiếu thiết bị`} />
            </ChartCard>
            <ChartCard bare title="Phân bố mức đáp ứng" description="Số trường theo tỷ lệ định mức đạt">
              <DonutBreakdown items={bands} unit="trường" onPick={pickList("trường", (r, s) => {
                const known2 = r.percent != null && r.percent !== "";
                const p = n(r.percent);
                return s.key === "unknown" ? !known2 : known2 && (s.key === "full" ? p >= 80 : s.key === "mid" ? p >= 50 && p < 80 : p < 50);
              })} />
            </ChartCard>
          </Pair>
          {known.length > 1 ? (
            <div className="border-t">
              <ChartCard bare title="Trường đáp ứng thấp nhất" description="% định mức đạt">
                <ColumnChart rows={[...known].sort((a, b) => n(a.percent) - n(b.percent)).map((x) => ({ ...x, percent: n(x.percent) }))}
                  labelKey={report.columns.find((c) => c.type === "text" && !c.key.endsWith("code"))?.key ?? "school"}
                  unit="%" series={[{ key: "percent", label: "Đạt" }]}
                  onPick={pickRecord(report.columns.find((c) => c.type === "text" && !c.key.endsWith("code"))?.key ?? "school")} />
              </ChartCard>
            </div>
          ) : null}
        </>
      );
    }
    case "purchase": {
      const data = rows.map((r) => ({ ...r, amountM: Math.round(n(r.amount) / 1e6), approvedM: Math.round(n(r.approved_amount) / 1e6) }));
      return part === "stats" ? (
        <>
          <Tiles>
            <StatTile flat icon={<ShoppingCart />} label="Đề xuất" value={count.format(sum(rows, "proposals"))}
              hint={`${count.format(sum(rows, "pending"))} chờ duyệt`} />
            <StatTile flat icon={<FileCheck2 />} tone="success" label="Đã duyệt" value={count.format(sum(rows, "approved"))}
              hint={`${count.format(sum(rows, "planned"))} vào kế hoạch`} />
            <StatTile flat icon={<Banknote />} label="Dự toán đề xuất" value={money(sum(rows, "amount"))} />
            <StatTile flat icon={<Banknote />} tone="success" label="Dự toán đã duyệt" value={money(sum(rows, "approved_amount"))} />
          </Tiles>
        </>
      ) : (
        <Pair className="lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
          <ChartCard bare title="Dự toán được duyệt" description="Trên dự toán đề xuất">
            <Meter percent={pct(sum(rows, "approved_amount"), sum(rows, "amount"))} good={70} warn={40}
              label={`${money(sum(rows, "approved_amount"))} / ${money(sum(rows, "amount"))}`}
              hint={`${count.format(sum(rows, "approved"))} / ${count.format(sum(rows, "proposals"))} đề xuất đã duyệt`} />
          </ChartCard>
          <ChartCard bare title={`Dự toán — ${(report.columns.find((c) => c.key === "name")?.label ?? "").toLowerCase()}`}
            description="Triệu đồng · nhóm có dự toán lớn nhất">
            <GroupedBars data={data.slice(0, 12)} xKey="name" height="h-[var(--chart-h,18rem)]" onPick={pickRecord("name")} series={[
              { key: "amountM", label: "Đề xuất" },
              { key: "approvedM", label: "Đã duyệt" },
            ]} />
          </ChartCard>
        </Pair>
      );
    }
    case "supply-expiry": {
      const expired = rows.filter((r) => String(r.state ?? "").startsWith("Quá hạn"));
      const bySchool = Object.entries(rows.reduce((m: Record<string, number>, r) => {
        m[r.school] = (m[r.school] ?? 0) + 1;
        return m;
      }, {})).map(([k, v]) => ({ key: k, label: k, count: v })).sort((a, b) => b.count - a.count).slice(0, 10);
      return part === "stats" ? (
        <>
          <Tiles>
            <StatTile flat icon={<CalendarClock />} tone="destructive" label="Đã hết hạn" value={count.format(expired.length)} />
            <StatTile flat icon={<CalendarClock />} tone="warning" label="Sắp hết hạn" value={count.format(rows.length - expired.length)} />
            <StatTile flat icon={<School />} label="Trường có lô hết hạn" value={count.format(bySchool.length)} />
          </Tiles>
        </>
      ) : (
        <Pair className="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <ChartCard bare title="Hạn dùng">
            <DonutBreakdown unit="lô" items={[
              { key: "expired", label: "Đã hết hạn", count: expired.length },
              { key: "soon", label: "Sắp hết hạn", count: rows.length - expired.length },
            ]} onPick={pickList("lô", (r, s) => String(r.state ?? "").startsWith("Quá hạn") === (s.key === "expired"))} />
          </ChartCard>
          <ChartCard bare title="Số lô theo trường">
            <ColumnChart rows={bySchool} labelKey="label" unit="lô" series={[{ key: "count", label: "Lô" }]} onPick={pickSchool("lô")} />
          </ChartCard>
        </Pair>
      );
    }
    default:
      return null;
  }
}
