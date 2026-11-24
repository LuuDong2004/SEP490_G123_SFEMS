import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Rectangle, Sector, XAxis, YAxis } from "recharts";

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
   * Không viền thẻ — khi nằm chung một khung với nội dung khác (biểu đồ + bảng báo cáo). KHÔNG thu gọn được: thu gọn
   * thì khung bên cạnh vẫn giữ chiều cao, để lại một vùng trắng lớn (góp ý của người dùng) — biểu đồ luôn hiện.
   */
  bare?: boolean;
}) {
  const Frame = bare ? "section" : Card;
  return (
    <Frame className={cn("flex flex-col gap-0 py-0", className)}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b px-5 py-2.5">
        <div className="min-w-0 text-left">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {description ? <p className="text-muted-foreground truncate text-xs">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="flex flex-1 flex-col px-5 py-4">{children}</div>
    </Frame>
  );
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

/** Tỷ lệ của một phần: dưới 1% thì ghi một chữ số lẻ — 10 trên 5609 mà ghi 0% là sai. */
const sharePercent = (part: number, total: number) => {
  const share = total ? (part / total) * 100 : 0;
  if (share > 0 && share < 1) return share < 0.1 ? "<0,1" : share.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  return String(Math.round(share));
};

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
  onPick,
  bars,
}: {
  /**
   * Biểu đồ ĐỨNG MỘT MÌNH chiếm cả bề ngang khung: vòng tròn gọn bên trái, mỗi dòng chú giải có thêm thanh ngang dài
   * theo số lượng, lấp kín bề ngang — không còn vòng nhỏ giữa khung và chú giải bị đẩy ra mép (góp ý của người dùng).
   */
  bars?: boolean;
  items: Slice[];
  unit: string;
  emptyText?: string;
  /** Bấm một phần của vòng hoặc một dòng chú giải (phần có số > 0) — báo cáo mở số liệu chi tiết của mục đó. */
  onPick?: (slice: Slice) => void;
  /** Thẻ rộng (trang tổng hợp): vòng to hơn, vòng và chú giải rải đều bề ngang — không dồn giữa để trống hai bên. */
  spread?: boolean;
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  const config: ChartConfig = Object.fromEntries(
    items.map((it, i) => [it.key, { label: it.label, color: seriesColor(i) }]),
  );
  const shown = items.filter((i) => i.count > 0);
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
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
  const max = Math.max(0, ...items.map((i) => i.count));
  return (
    <div data-fit={bars || undefined} className={cn("my-auto",
      bars ?"mx-auto grid w-full max-w-6xl items-center gap-x-12 gap-y-4 sm:grid-cols-[auto_minmax(0,1fr)]" : "flex flex-wrap items-center justify-evenly gap-x-8 gap-y-4")}>
      <div className="relative shrink-0">
      <ChartContainer key={sig} config={config}
        className={cn("aspect-square shrink-0", spread ? "size-52" : "size-48", animate && total > 0 && "animate-donut-sweep", onPick && total > 0 && "[&_.recharts-pie-sector]:cursor-pointer")}>
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
            onClick={onPick && total ? (_, i) => shown[i] && onPick(shown[i]) : undefined}
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
      <ul className={cn("w-full text-sm", bars ? "min-w-0" : "max-w-80 min-w-52 flex-1")}>
        {items.map((it, i) => (
          // Các dòng hiện lần lượt từ trên xuống; trỏ vào dòng nào thì phần đó trên vòng phồng ra.
          <li key={it.key} onMouseEnter={() => it.count > 0 && setActive(it.key)} onMouseLeave={() => setActive(null)}
            {...(onPick && it.count > 0 ? {
              role: "button",
              tabIndex: 0,
              "aria-label": `Xem chi tiết ${it.label}`,
              onClick: () => onPick(it),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(it);
                }
              },
            } : {})}
            style={{
              animationDelay: `${200 + i * 70}ms`,
              // Dòng đang chọn nổi lên như một thẻ: nền pha màu của chính nhóm đó, viền mảnh cùng màu, bóng đổ.
              ...(active === it.key ? {
                background: `color-mix(in srgb, ${seriesColor(i)} 12%, var(--card))`,
                boxShadow: `0 10px 22px -12px color-mix(in srgb, ${seriesColor(i)} 70%, transparent), 0 0 0 1px color-mix(in srgb, ${seriesColor(i)} 35%, transparent)`,
              } : null),
            }}
            className={cn("animate-skeleton-in relative -mx-2 flex items-center gap-3", onPick && it.count > 0 ? "focus-visible:ring-ring/50 cursor-pointer outline-none focus-visible:ring-2" : "cursor-default", " rounded-lg border-b border-dashed px-2 py-2 last:border-b-0",
              "transition-[background-color,box-shadow,translate,border-color] duration-200 ease-[cubic-bezier(.2,.8,.2,1)]",
              active === it.key && "z-[1] -translate-y-px border-transparent")}>
            <Swatch color={seriesColor(i)} />
            <span className={cn("text-foreground min-w-0 truncate", bars ? "w-[38%] shrink-0" : "flex-1")} title={bars ? it.label : undefined}>{it.label}</span>
            {bars ? (
              // Thanh dài theo số lượng so với nhóm lớn nhất; nhóm 0 vẫn có rãnh rỗng để thấy là có nhóm đó.
              <span className="bg-muted relative h-2 min-w-0 flex-1 overflow-hidden rounded-full">
                <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${max ? (it.count / max) * 100 : 0}%`, background: seriesGradient(seriesColor(i), 90) }} />
              </span>
            ) : null}
            <span className="text-foreground w-12 text-right font-semibold tabular-nums">{count.format(it.count)}</span>
            <span className="text-muted-foreground w-10 text-right text-xs tabular-nums"
              title={total ? `${count.format(it.count)} / ${count.format(total)} ${unit}` : undefined}>
              {sharePercent(it.count, total)}%
            </span>
          </li>
        ))}
        {/* Tỷ lệ % trên cái gì: rê chuột vào ô % — không ghi công thức dưới chú giải. */}
        {total && onPick ? <li className="text-muted-foreground pt-1.5 text-xs">Bấm từng mục để xem chi tiết.</li> : null}
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
  onPick,
  legend = true,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: Series[];
  xFormatter?: (v: string) => string;
  height?: string;
  /** Bấm một cột: nhận dòng dữ liệu của nhóm đó. */
  onPick?: (row: Record<string, any>) => void;
  /** Xếp chồng (cơ cấu trong một cột) thay vì đặt cạnh nhau. */
  stacked?: boolean;
  /** Hiện chú thích màu dưới biểu đồ (mặc định có khi nhiều hơn một loạt). */
  legend?: boolean;
}) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [s.key, { label: s.label, color: seriesColor(i) }]),
  );
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
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
        {legend && series.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={`var(--color-${s.key})`}
            shape={(props: any) => <Rectangle {...props} fill={`url(#${gid}-${s.key})`} />}
            radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
            stackId={stacked ? "a" : undefined}
            cursor={onPick ? "pointer" : undefined}
            onClick={onPick ? (entry: any) => onPick(entry.payload) : undefined}
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
  /** Ô "?" cạnh nhãn: con số này tính từ đâu, theo công thức nào. */
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

const compact = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });
const shorten = (v: string, max = 14) => (v.length > max ? `${v.slice(0, max - 1)}…` : v);

/** Số trên trục: ghi đủ chữ số, chỉ rút gọn từ trăm nghìn trở lên ("6 N" không ai đọc ra 6000). */
const axisNumber = (v: number) => (Math.abs(v) < 100_000 ? count.format(v) : compact.format(v));

/**
 * Biểu đồ cột dọc theo nhóm (trường, loại thiết bị, phòng…): một loạt là cột đơn, nhiều loạt thì xếp chồng thành cơ
 * cấu trong từng cột. Nhãn trục rút gọn (đủ tên ở ô nổi khi rê chuột); nhiều nhóm thì nghiêng nhãn. Vẽ `limit` nhóm
 * đầu — người gọi sắp trước, phần còn lại xem ở số liệu chi tiết.
 */
export function ColumnChart({
  rows,
  labelKey,
  series,
  limit = 10,
  height = "h-[var(--chart-h,18rem)]",
  unit,
  onPick,
}: {
  rows: Record<string, unknown>[];
  labelKey: string;
  series: Series[];
  limit?: number;
  /** Bấm một cột: nhận dòng dữ liệu của nhóm đó. */
  onPick?: (row: Record<string, any>) => void;
  height?: string;
  /** Đơn vị trong ô nổi khi chỉ có một loạt ("tài sản", "phiếu"). */
  unit?: string;
}) {
  const data: Record<string, unknown>[] = rows.slice(0, limit).map((r) => ({ ...r, __label: String(r[labelKey] ?? "—") }));
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [s.key, { label: unit && series.length === 1 ? `${s.label} (${unit})` : s.label, color: seriesColor(i) }]),
  );
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const tilt = data.length > 5;
  const stacked = series.length > 1;
  // Dữ liệu đổi (chuyển báo cáo, đổi bộ lọc) thì dựng lại biểu đồ: Recharts chạy hiệu ứng từ hình cột CŨ, chuyển giữa
  // hai bộ dữ liệu khác số nhóm là cột lệch chỗ, thiếu cột.
  const sig = data.map((d) => [d.__label, ...series.map((x) => d[x.key])].join(":")).join("|") + series.map((x) => x.key).join(",");
  return (
    <div className="space-y-1.5">
      <ChartContainer key={sig} config={config} className={cn("w-full", height)}>
        <BarChart data={data} barCategoryGap={data.length <= 3 ? "38%" : "22%"} margin={{ left: tilt ? 24 : -4, right: 8, top: 8, bottom: 0 }}>
          {seriesGradients({ id: gid, keys: series.map((s) => s.key), dir: "down" })}
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="__label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} interval={0}
            tickFormatter={(v: string) => shorten(v, tilt ? 16 : 22)} angle={tilt ? -32 : 0} textAnchor={tilt ? "end" : "middle"}
            height={tilt ? 72 : 28} />
          <YAxis tickLine={false} axisLine={false} width={44} fontSize={11} tickFormatter={axisNumber} />
          <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltipContent />} />
          {stacked ? <ChartLegend content={<ChartLegendContent />} /> : null}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} stackId={stacked ? "a" : undefined} fill={`var(--color-${s.key})`}
              cursor={onPick ? "pointer" : undefined}
              onClick={onPick ? (entry: any) => onPick(entry.payload) : undefined}
              shape={(props: any) => <Rectangle {...props} fill={`url(#${gid}-${s.key})`} />}
              radius={!stacked || i === series.length - 1 ? [5, 5, 0, 0] : 0}
              maxBarSize={48}
              isAnimationActive={!reducedMotion()} animationBegin={100 + i * 120} animationDuration={800} animationEasing="ease-out" />
          ))}
        </BarChart>
      </ChartContainer>
      {rows.length > limit ? (
        <p className="text-muted-foreground text-xs">Vẽ {limit} / {count.format(rows.length)} nhóm, xem đủ ở số liệu chi tiết.{onPick ? " Bấm cột để xem chi tiết." : ""}</p>
      ) : onPick ? (
        <p className="text-muted-foreground text-xs">Bấm cột để xem chi tiết.</p>
      ) : null}
    </div>
  );
}

/** Đường xu hướng theo thời gian (tháng): mỗi loạt một vùng tô nhạt dưới đường — thấy ngay tháng nào tăng, giảm. */
export function TrendArea({
  data,
  xKey,
  series,
  height = "h-[var(--chart-h,18rem)]",
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: Series[];
  height?: string;
}) {
  const config: ChartConfig = Object.fromEntries(series.map((s, i) => [s.key, { label: s.label, color: seriesColor(i) }]));
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const sig = data.map((d) => [d[xKey], ...series.map((x) => d[x.key])].join(":")).join("|");
  return (
    <ChartContainer key={sig} config={config} className={cn("w-full", height)}>
      <AreaChart data={data} margin={{ left: -4, right: 12, top: 8 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: `var(--color-${s.key})`, stopOpacity: 0.32 }} />
              <stop offset="100%" style={{ stopColor: `var(--color-${s.key})`, stopOpacity: 0.02 }} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} fontSize={11} minTickGap={12} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} fontSize={11} tickFormatter={axisNumber} />
        <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<ChartTooltipContent indicator="line" />} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s, i) => (
          <Area key={s.key} dataKey={s.key} type="monotone" stroke={`var(--color-${s.key})`} strokeWidth={2.25}
            fill={`url(#${gid}-${s.key})`} dot={data.length <= 12 ? { r: 2.5, strokeWidth: 0, fill: `var(--color-${s.key})` } : false}
            activeDot={{ r: 4.5 }} isAnimationActive={!reducedMotion()} animationBegin={i * 120} animationDuration={900} />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}

/**
 * Đồng hồ tỷ lệ (nửa vòng): một con số % lớn ở giữa, cung tô theo mức — đạt (≥ `good`) xanh, giữa vàng, thấp đỏ.
 * Dành cho chỉ số "bao nhiêu phần trăm" (hồ sơ chuẩn, đang dùng, đáp ứng định mức) — đọc nhanh hơn một ô số.
 */
export function Meter({
  percent,
  label,
  hint,
  good = 80,
  warn = 50,
}: {
  percent: number | null;
  label: ReactNode;
  hint?: ReactNode;
  good?: number;
  warn?: number;
}) {
  const p = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  const shown = useCountUp(p);
  const color = percent == null ? "var(--muted-foreground)"
    : p >= good ? "var(--success)" : p >= warn ? "var(--warning)" : "var(--destructive)";
  // Nửa vòng bán kính 80, tâm (100, 100): dài π·80 ≈ 251.
  const len = Math.PI * 80;
  return (
    <div className="my-auto flex flex-col items-center gap-1 py-2">
      <svg viewBox="0 0 200 116" className="w-full max-w-64" aria-hidden>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--muted)" strokeWidth="16" strokeLinecap="round" />
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
          strokeDasharray={len} strokeDashoffset={len * (1 - shown / 100)}
          style={{ filter: `drop-shadow(0 4px 8px color-mix(in srgb, ${color} 35%, transparent))` }} />
        <text x="100" y="92" textAnchor="middle" className="fill-foreground" style={{ fontSize: 34, fontWeight: 700 }}>
          {percent == null ? "—" : `${shown}%`}
        </text>
      </svg>
      <p className="text-sm font-semibold">{label}</p>
      {hint ? <p className="text-muted-foreground max-w-64 text-center text-xs leading-snug">{hint}</p> : null}
    </div>
  );
}

