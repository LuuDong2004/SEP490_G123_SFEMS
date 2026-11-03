import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Rectangle, Sector, XAxis, YAxis } from "recharts";

import { count, seriesColor, seriesGradient, seriesLight } from "@/shared/lib/chart-palette";
import { isMotionReduced } from "@/shared/lib/theme";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { HelpHint } from "@/shared/components/form/help-hint";

/**
 * Khung một biểu đồ: tiêu đề bên trái, bộ chọn kỳ bên phải, một đường kẻ mảnh dưới đầu
 * thẻ. Mọi biểu đồ trên bảng điều khiển và màn báo cáo dùng chung khung này để đọc như
 * một hệ, không phải mỗi thẻ một kiểu.
 */
export function ChartCard({
  title,
  description,
  action,
  children,
  className,
  bare,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * Không viền thẻ — khi nằm chung một khung với nội dung khác (biểu đồ + bảng báo cáo). Khung này thu gọn
   * được: bấm đầu khung là ẩn biểu đồ, lựa chọn nhớ chung cho mọi báo cáo (`useChartsCollapsed`).
   */
  bare?: boolean;
}) {
  const [collapsed, setCollapsed] = useChartsCollapsed();
  const shut = !!bare && collapsed;
  const Frame = bare ? "section" : Card;
  const heading = (
    <div className="min-w-0 text-left">
      <h3 className="truncate text-sm font-semibold">{title}</h3>
      {description && !shut ? <p className="text-muted-foreground truncate text-xs">{description}</p> : null}
    </div>
  );
  return (
    <Frame className={cn("flex flex-col gap-0 py-0", className)}>
      <div className={cn("flex items-center justify-between gap-3 px-5 py-2.5", !shut && "min-h-14 border-b")}>
        {bare ? (
          <button type="button" onClick={() => setCollapsed(!collapsed)} aria-expanded={!shut}
            className="hover:text-primary flex min-w-0 items-center gap-2 transition-colors"
            title={shut ? "Hiện biểu đồ" : "Thu gọn biểu đồ"}>
            <ChevronDown className={cn("text-muted-foreground size-4 shrink-0 transition-transform", shut && "-rotate-90")} />
            {heading}
          </button>
        ) : heading}
        {shut ? null : action}
      </div>
      {shut ? null : <div className="flex flex-1 flex-col px-5 py-4">{children}</div>}
    </Frame>
  );
}

/* Thu gọn biểu đồ báo cáo: một lựa chọn chung cho mọi khung `bare`, nhớ qua F5; các khung cạnh nhau cùng đóng / mở. */
const COLLAPSE_KEY = "report-charts.collapsed";
const collapseListeners = new Set<() => void>();

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function useChartsCollapsed(): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      collapseListeners.add(cb);
      return () => collapseListeners.delete(cb);
    },
    readCollapsed,
    () => false,
  );
  const set = (v: boolean) => {
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
    } catch {
      // Không lưu được thì chỉ không nhớ qua F5.
    }
    collapseListeners.forEach((l) => l());
  };
  return [value, set];
}

/** Nút chọn kỳ nhỏ ở góc thẻ ("Tháng này", "7 ngày qua"). */
export function RangeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="text-muted-foreground h-7 w-auto gap-1.5 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type Slice = { key: string; label: string; count: number };

/**
 * Một dải gradient SVG cho mỗi loạt — từ màu loạt sang chính nó pha sáng. GỌI NHƯ HÀM, không
 * như component: Recharts chỉ vẽ con trực tiếp mà nó nhận ra, và bỏ qua một <SeriesGradients/>.
 */
function seriesGradients({ id, keys, dir }: { id: string; keys: string[]; dir: "down" | "diag" }) {
  const [x2, y2] = dir === "down" ? ["0", "1"] : ["1", "1"];
  return (
    <defs>
      {keys.map((k) => (
        <linearGradient key={k} id={`${id}-${k}`} x1="0" y1="0" x2={x2} y2={y2}>
          <stop offset="0%" style={{ stopColor: `var(--color-${k})` }} />
          <stop offset="100%" style={{ stopColor: seriesLight(`var(--color-${k})`) }} />
        </linearGradient>
      ))}
    </defs>
  );
}

/** Đang giảm chuyển động (Tuỳ chỉnh → Hiệu ứng chuyển động) thì biểu đồ hiện thẳng, không chạy. */
const reducedMotion = isMotionReduced;

/** Con số đếm từ giá trị cũ (lần đầu: 0) lên giá trị mới, nhanh rồi chậm dần (~0,9 giây). */
function useCountUp(value: number, ms = 900) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0);
  const from = useRef(shown);
  useEffect(() => {
    if (reducedMotion()) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const v = a + (value - a) * (1 - Math.pow(1 - t, 3));
      setShown(v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return Math.round(shown);
}

function CountUp({ value, className }: { value: number; className?: string }) {
  return <span className={className}>{count.format(useCountUp(value))}</span>;
}

/** Ô màu chú giải: cùng dải gradient với loạt. */
function Swatch({ color }: { color: string }) {
  return <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: seriesGradient(color, 135) }} />;
}

/**
 * Vòng tròn cơ cấu + bảng chú giải (số lượng, %). Tổng nằm giữa vòng. Mỗi phần một
 * màu theo thứ tự cố định; chú giải luôn có nên không bao giờ đọc bằng màu một mình.
 * Tối đa 5 phần — người gọi gộp "Khác" trước ({@code foldOther}).
 */
export function DonutBreakdown({
  items,
  unit,
  emptyText = "Chưa có dữ liệu",
  spread,
}: {
  items: Slice[];
  unit: string;
  emptyText?: string;
  /** Thẻ rộng (trang tổng hợp): vòng to hơn, vòng và chú giải rải đều bề ngang — không dồn giữa để trống hai bên. */
  spread?: boolean;
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  const config: ChartConfig = Object.fromEntries(
    items.map((it, i) => [it.key, { label: it.label, color: seriesColor(i) }]),
  );
  const shown = items.filter((i) => i.count > 0);
  const gid = useId().replace(/:/g, "");
  const animate = !reducedMotion();
  // Dữ liệu vòng giữ nguyên tham chiếu giữa các lần vẽ: mảng mới mỗi lần là Recharts chạy lại hiệu ứng từ đầu.
  const sig = shown.map((i) => `${i.key}:${i.count}`).join("|");
  const pieData = useMemo(
    () => (total ? shown.map((it) => ({ ...it, fill: `var(--color-${it.key})` })) : [{ key: "__empty", label: emptyText, count: 1 }]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sig, total, emptyText],
  );
  // Phần đang được trỏ (trên vòng hoặc trên dòng chú giải) phồng ra; dòng chú giải tương ứng sáng lên.
  const [active, setActive] = useState<string | null>(null);
  const activeIndex = active ? shown.findIndex((i) => i.key === active) : -1;
  return (
    <div className="my-auto flex flex-wrap items-center justify-evenly gap-x-8 gap-y-4">
      <div className="relative shrink-0">
      <ChartContainer key={sig} config={config}
        className={cn("aspect-square shrink-0", spread ? "size-52" : "size-48", animate && total > 0 && "animate-donut-sweep")}>
        <PieChart>
          {seriesGradients({ id: gid, keys: items.map((i) => i.key), dir: "diag" })}
          {/* Không chú thích nổi khi rê chuột: dòng chú giải của phần đang trỏ đã sáng lên kèm số — ô nổi chỉ che vòng. */}
          <Pie
            data={pieData}
            dataKey="count"
            nameKey="key"
            // Chừa mép cho phần đang chọn phồng ra (+9px) mà không bị cắt ở cạnh khung.
            innerRadius="62%"
            outerRadius="90%"
            paddingAngle={total && shown.length > 1 ? 2 : 0}
            cornerRadius={4}
            startAngle={90}
            endAngle={-270}
            strokeWidth={0}
            // Vòng vẽ dần quanh tâm (theo chiều kim đồng hồ từ 12 giờ), nhanh rồi chậm dần.
            // Hiệu ứng vẽ của Recharts không chạy ổn trong khung tự đo cỡ — vòng vẽ dần bằng mặt nạ CSS ở khối bọc.
            isAnimationActive={false}
            activeIndex={activeIndex >= 0 ? activeIndex : undefined}
            activeShape={(p: any) => (
              <Sector {...p} innerRadius={p.innerRadius - 2} outerRadius={p.outerRadius + 9}
                style={{ filter: "brightness(1.06) drop-shadow(0 6px 10px rgb(0 0 0 / .22))" }} />
            )}
            onMouseEnter={(_, i) => setActive(shown[i]?.key ?? null)}
            onMouseLeave={() => setActive(null)}
          >
            {total ? (
              shown.map((it) => <Cell key={it.key} fill={`url(#${gid}-${it.key})`} />)
            ) : (
              <Cell fill="var(--muted)" />
            )}
          </Pie>
        </PieChart>
      </ChartContainer>
        {/* Tổng ở giữa vòng: khối riêng đè lên biểu đồ để con số đếm lên mà không bắt cả vòng vẽ lại. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <CountUp value={total} className="text-foreground text-2xl leading-none font-bold tabular-nums" />
          <span className="text-muted-foreground mt-1 text-xs">{unit}</span>
        </div>
      </div>
      {/* Chú giải là một cột gọn cạnh vòng tròn, không kéo hết bề ngang thẻ: nhãn ở đầu
          này, số ở tận đầu kia là một khoảng trống mắt phải đi qua để ghép hai thứ lại. */}
      {/* Chú giải rộng vừa đủ đọc (số không xa tên); khoảng trống còn lại chia đều hai mép và khe giữa vòng với chú
          giải (`justify-evenly`) — không dồn thành một mảng trống lớn ở một bên (theo trưởng nhóm). */}
      <ul className="w-full max-w-80 min-w-52 flex-1 text-sm">
        {items.map((it, i) => (
          // Các dòng hiện lần lượt từ trên xuống; trỏ vào dòng nào thì phần đó trên vòng phồng ra.
          <li key={it.key} onMouseEnter={() => it.count > 0 && setActive(it.key)} onMouseLeave={() => setActive(null)}
            style={{
              animationDelay: `${200 + i * 70}ms`,
              // Dòng đang chọn nổi lên như một thẻ: nền pha màu của chính nhóm đó, viền mảnh cùng màu, bóng đổ.
              ...(active === it.key ? {
                background: `color-mix(in srgb, ${seriesColor(i)} 12%, var(--card))`,
                boxShadow: `0 10px 22px -12px color-mix(in srgb, ${seriesColor(i)} 70%, transparent), 0 0 0 1px color-mix(in srgb, ${seriesColor(i)} 35%, transparent)`,
              } : null),
            }}
            className={cn("animate-skeleton-in relative -mx-2 flex cursor-default items-center gap-3 rounded-lg border-b border-dashed px-2 py-2 last:border-b-0",
              "transition-[background-color,box-shadow,translate,border-color] duration-200 ease-[cubic-bezier(.2,.8,.2,1)]",
              active === it.key && "z-[1] -translate-y-px border-transparent")}>
            <Swatch color={seriesColor(i)} />
            <span className="text-foreground min-w-0 flex-1 truncate">{it.label}</span>
            <span className="text-foreground w-12 text-right font-semibold tabular-nums">{count.format(it.count)}</span>
            <span className="text-muted-foreground w-10 text-right text-xs tabular-nums"
              title={total ? `${count.format(it.count)} / ${count.format(total)} ${unit}` : undefined}>
              {total ? Math.round((it.count / total) * 100) : 0}%
            </span>
          </li>
        ))}
        {/* Cột % nói tỷ lệ trên CÁI GÌ (QLTB-515): trên tổng số ở giữa vòng tròn. */}
        {total ? (
          <li className="text-muted-foreground pt-1.5 text-xs">% = số của từng nhóm ÷ tổng {count.format(total)} {unit} ở giữa vòng tròn.</li>
        ) : null}
      </ul>
    </div>
  );
}

export type Series = { key: string; label: string };

/**
 * Cột nhóm theo trục thời gian / danh mục: mỗi loạt một cột, đầu cột bo 4px, khe 2px
 * giữa các cột, lưới ngang mờ, chú giải dưới. Một trục Y duy nhất — hai đại lượng khác
 * đơn vị thì hai biểu đồ.
 */
export function GroupedBars({
  data,
  xKey,
  series,
  xFormatter,
  height = "h-64",
  stacked,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: Series[];
  xFormatter?: (v: string) => string;
  height?: string;
  /** Xếp chồng (cơ cấu trong một cột) thay vì đặt cạnh nhau. */
  stacked?: boolean;
}) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [s.key, { label: s.label, color: seriesColor(i) }]),
  );
  const gid = useId().replace(/:/g, "");
  return (
    <ChartContainer config={config} className={cn("w-full", height)}>
      <BarChart data={data} barGap={2} barCategoryGap={series.length > 2 ? "18%" : "28%"} margin={{ left: -8, right: 4, top: 4 }}>
        {seriesGradients({ id: gid, keys: series.map((s) => s.key), dir: "down" })}
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} fontSize={11}
          tickFormatter={xFormatter} interval="preserveStartEnd" minTickGap={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} fontSize={11} />
        <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={<ChartTooltipContent labelFormatter={(v) => (xFormatter ? xFormatter(String(v)) : String(v))} />} />
        {series.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={`var(--color-${s.key})`}
            shape={(props: any) => <Rectangle {...props} fill={`url(#${gid}-${s.key})`} />}
            radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
            stackId={stacked ? "a" : undefined}
            // Ít nhóm (vd. hai tháng) thì cột rộng ra — 18px trên một trục 1.500px trông như vạch kẻ.
            maxBarSize={stacked ? 36 : data.length <= 4 ? 40 : 18}
            // Cột mọc từ đáy lên, các loạt nối nhau một nhịp.
            isAnimationActive={!reducedMotion()}
            animationBegin={150 + i * 120}
            animationDuration={900}
            animationEasing="ease-out"
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

/**
 * Thanh ngang xếp chồng theo từng dòng (vd. cơ cấu tài sản của mỗi trường). Nhãn dòng
 * nằm trên thanh, không xoay chữ trục.
 */
export function StackedRows({
  rows,
  series,
  labelKey,
  limit = 10,
  totalKey,
}: {
  rows: Record<string, unknown>[];
  series: Series[];
  labelKey: string;
  limit?: number;
  /**
   * Cột tổng của chính bảng. Có thì con số cuối dòng là tổng ấy — khớp bảng bên dưới — và phần không thuộc
   * loạt nào (trạng thái không vẽ riêng) hiện thành đoạn xám thay vì biến mất khỏi tổng.
   */
  totalKey?: string;
}) {
  const [all, setAll] = useState(false);
  const cap = Math.min(limit, 6);
  const drawable = rows.slice(0, limit);
  const shown = all ? drawable : drawable.slice(0, cap);
  const sumOf = (r: Record<string, unknown>) => series.reduce((s, x) => s + (Number(r[x.key]) || 0), 0);
  const totalOf = (r: Record<string, unknown>) => (totalKey ? Math.max(Number(r[totalKey]) || 0, sumOf(r)) : sumOf(r));
  const max = Math.max(1, ...drawable.map(totalOf));
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {series.map((s, i) => (
          <li key={s.key} className="text-muted-foreground flex items-center gap-1.5">
            <Swatch color={seriesColor(i)} />
            {s.label}
          </li>
        ))}
      </ul>
      {/* Mỗi dòng MỘT hàng: tên | thanh | tổng. Rê chuột vào dòng thì hiện số từng phần. */}
      <ul className="-mx-2">
        {shown.map((r, idx) => {
          const total = totalOf(r);
          const name = String(r[labelKey] ?? "—");
          return (
            <li key={idx} className="group hover:bg-accent/50 relative grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_4.5rem] items-center gap-3 rounded-md px-2 py-1.5">
              <span className="truncate text-sm" title={name}>{name}</span>
              <div className="animate-bar-grow flex h-3 origin-left gap-0.5" style={{ width: `${Math.max((total / max) * 100, 1.5)}%`, animationDelay: `${idx * 50}ms` }}>
                {series.map((s, i) => {
                  const v = Number(r[s.key]) || 0;
                  return v ? (
                    <span key={s.key} className="h-full rounded-[2px] first:rounded-s-[4px] last:rounded-e-[4px]"
                      style={{ width: `${(v / total) * 100}%`, background: seriesColor(i) }} />
                  ) : null;
                })}
              </div>
              <span className="text-right text-sm font-semibold tabular-nums">{count.format(total)}</span>
              <div className="bg-popover text-popover-foreground shadow-e2 pointer-events-none absolute top-full right-2 z-20 mt-0.5 hidden min-w-56 rounded-lg border p-2.5 text-xs group-hover:block">
                <p className="mb-1.5 truncate font-semibold">{name}</p>
                {series.map((s, i) => (
                  <p key={s.key} className="flex items-center gap-2 py-0.5">
                    <Swatch color={seriesColor(i)} />
                    <span className="text-muted-foreground flex-1">{s.label}</span>
                    <span className="font-medium tabular-nums">{count.format(Number(r[s.key]) || 0)}</span>
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length > cap ? (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {drawable.length > cap ? (
            <button type="button" className="text-primary font-medium hover:underline" onClick={() => setAll(!all)}>
              {all ? "Thu gọn" : `Xem thêm ${drawable.length - cap} dòng`}
            </button>
          ) : null}
          <span>
            {all && rows.length > limit
              ? `Chỉ vẽ ${limit} / ${rows.length} dòng lớn nhất — xem đủ ở bảng.`
              : `Đang hiện ${shown.length} / ${rows.length} dòng lớn nhất`}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Thanh ngang một màu cho một đại lượng theo danh mục (vd. tình trạng kỹ thuật). */
export function BarList({ items, unit }: { items: Slice[]; unit?: string }) {
  const [all, setAll] = useState(false);
  const cap = 6;
  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((s, i) => s + i.count, 0);
  const shown = all ? items : items.slice(0, cap);
  // Mỗi mục MỘT hàng: tên | thanh | số + %. Quá 6 mục thì thu lại, bấm "Xem thêm".
  return (
    <div className="space-y-2">
      <ul className="-mx-2">
        {shown.map((it) => (
          <li key={it.key} title={`${it.label}: ${count.format(it.count)}${unit ? ` ${unit}` : ""}`}
            className="hover:bg-accent/50 grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_6.5rem] items-center gap-3 rounded-md px-2 py-1.5">
            <span className="truncate text-sm">{it.label}</span>
            <div className="h-3">
              <div className="animate-bar-grow h-3 origin-left rounded-[4px]"
                style={{ width: `${it.count ? Math.max((it.count / max) * 100, 1.5) : 0}%`, background: "var(--chart-1)", animationDelay: `${shown.indexOf(it) * 60}ms` }} />
            </div>
            <span className="text-right text-sm tabular-nums">
              <span className="font-semibold">{count.format(it.count)}</span>
              <span className="text-muted-foreground ms-1.5 text-xs">{total ? Math.round((it.count / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
      {items.length > cap ? (
        <button type="button" className="text-primary text-xs font-medium hover:underline" onClick={() => setAll(!all)}>
          {all ? "Thu gọn" : `Xem thêm ${items.length - cap} dòng`}
        </button>
      ) : null}
    </div>
  );
}

/** Ô chỉ số: nhãn, số lớn, dòng phụ; biểu tượng trong một ô vuông tô nhẹ. */
export function StatTile({
  icon,
  label,
  value,
  hint,
  tone = "primary",
  href,
  flat,
  info,
}: {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** Ô "?" cạnh nhãn: con số này tính từ đâu, theo công thức nào (QLTB-515). */
  info?: ReactNode;
  tone?: "primary" | "warning" | "destructive" | "success";
  href?: string;
  /** Không thẻ riêng — một ô trong dải chỉ số. */
  flat?: boolean;
}) {
  const toneClass = {
    // Biểu tượng không nền: chỉ tô màu theo sắc thái — ô màu đặc / nền nhạt sau mỗi icon làm dải chỉ số nặng.
    primary: "text-primary",
    warning: "text-warning-text",
    destructive: "text-destructive-text",
    success: "text-success-text",
  }[tone];
  // Ô trong dải chỉ số: biểu tượng nhỏ đi cùng nhãn, số to bên dưới, chú thích xuống dòng được — biểu tượng to
  // đứng riêng bên trái làm nội dung dồn về một góc ô và cắt cụt chú thích.
  const body = flat ? (
    <div className={cn("h-full px-5 py-4", href && "hover:bg-accent/40 transition-colors")}>
      <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <span className={cn("flex shrink-0 [&_svg]:size-4", toneClass)}>{icon}</span>
        <span className="truncate">{label}</span>
        {info ? <HelpHint>{info}</HelpHint> : null}
      </p>
      <p className="mt-1.5 text-3xl leading-none font-bold tabular-nums">{value}</p>
      {hint ? <p className="text-muted-foreground mt-1.5 text-xs leading-snug">{hint}</p> : null}
    </div>
  ) : (
    <div className={cn("bg-card rounded-xl border px-5 py-4 shadow-e1", href && "hover:border-primary/40 transition-colors")}>
      <div className="flex h-full items-center gap-3">
        <span className={cn("flex shrink-0 items-center justify-center [&_svg]:size-6", toneClass)}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <span className="truncate">{label}</span>
            {info ? <HelpHint>{info}</HelpHint> : null}
          </p>
          <p className="text-2xl leading-tight font-bold tabular-nums">{value}</p>
          {hint ? <p className="text-muted-foreground mt-0.5 truncate text-xs">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
  return href ? <Link to={href} className="block">{body}</Link> : body;
}

/**
 * Dải chỉ số MỘT hàng: các ô ngăn bằng đường kẻ mảnh, không mỗi số một thẻ — bốn thẻ
 * to cho bốn con số là bốn ô trống lớn trên đầu trang.
 */
export function StatStrip({
  items,
}: {
  items: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode; info?: ReactNode; tone?: "primary" | "warning" | "destructive" | "success" }[];
}) {
  const toneClass = {
    // Biểu tượng không nền: chỉ tô màu theo sắc thái — ô màu đặc / nền nhạt sau mỗi icon làm dải chỉ số nặng.
    primary: "text-primary",
    warning: "text-warning-text",
    destructive: "text-destructive-text",
    success: "text-success-text",
  };
  return (
    <Card className="gap-0 py-0">
      <div>
        <div className={cn("grid divide-y sm:divide-y-0 lg:divide-x", gridCols(items.length))}>
          {items.map((it) => (
            <div key={it.label} className="flex items-center gap-3 px-5 py-3.5">
              <span className={cn("flex shrink-0 items-center justify-center [&_svg]:size-6", toneClass[it.tone ?? "primary"])}>
                {it.icon}
              </span>
              <div className="min-w-0">
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <span className="truncate">{it.label}</span>
                  {it.info ? <HelpHint>{it.info}</HelpHint> : null}
                </p>
                <p className="text-xl leading-tight font-bold tabular-nums">{it.value}</p>
                {it.hint ? <p className="text-muted-foreground text-xs leading-snug">{it.hint}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function gridCols(n: number) {
  return n >= 5 ? "sm:grid-cols-2 lg:grid-cols-5" : n === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : n === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
}
