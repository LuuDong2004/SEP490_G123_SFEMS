import { useId, type ReactNode } from "react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "react-router";
import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, Rectangle, XAxis, YAxis } from "recharts";

import { count, seriesColor, seriesGradient, seriesLight } from "@/shared/lib/chart-palette";
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
  /** Không viền thẻ — khi nằm chung một khung với nội dung khác (biểu đồ + bảng báo cáo). */
  bare?: boolean;
}) {
  const Frame = bare ? "section" : Card;
  return (
    <Frame className={cn("flex flex-col gap-0 py-0", className)}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b px-5 py-2.5">
        <div className="min-w-0">
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
}: {
  items: Slice[];
  unit: string;
  emptyText?: string;
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  const config: ChartConfig = Object.fromEntries(
    items.map((it, i) => [it.key, { label: it.label, color: seriesColor(i) }]),
  );
  const shown = items.filter((i) => i.count > 0);
  const gid = useId().replace(/:/g, "");
  return (
    <div className="my-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
      <ChartContainer config={config} className="aspect-square h-44 w-44 shrink-0">
        <PieChart>
          {seriesGradients({ id: gid, keys: items.map((i) => i.key), dir: "diag" })}
          <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
          <Pie
            data={total ? shown.map((it) => ({ ...it, fill: `var(--color-${it.key})` })) : [{ key: "__empty", label: emptyText, count: 1 }]}
            dataKey="count"
            nameKey="key"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={total && shown.length > 1 ? 2 : 0}
            cornerRadius={4}
            startAngle={90}
            endAngle={-270}
            strokeWidth={0}
            isAnimationActive={false}
          >
            {total ? (
              shown.map((it) => <Cell key={it.key} fill={`url(#${gid}-${it.key})`} />)
            ) : (
              <Cell fill="var(--muted)" />
            )}
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox)) return null;
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) - 6} className="fill-foreground text-2xl font-bold">
                      {count.format(total)}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 16} className="fill-muted-foreground text-xs">
                      {unit}
                    </tspan>
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      {/* Chú giải là một cột gọn cạnh vòng tròn, không kéo hết bề ngang thẻ: nhãn ở đầu
          này, số ở tận đầu kia là một khoảng trống mắt phải đi qua để ghép hai thứ lại. */}
      <ul className="w-full max-w-80 min-w-52 flex-1 text-sm">
        {items.map((it, i) => (
          <li key={it.key} className="flex items-center gap-3 border-b border-dashed py-2 last:border-b-0">
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
            isAnimationActive={false}
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
  const shown = rows.slice(0, limit);
  const sumOf = (r: Record<string, unknown>) => series.reduce((s, x) => s + (Number(r[x.key]) || 0), 0);
  const totalOf = (r: Record<string, unknown>) => (totalKey ? Math.max(Number(r[totalKey]) || 0, sumOf(r)) : sumOf(r));
  const max = Math.max(1, ...shown.map(totalOf));
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
      <ul className="space-y-2.5">
        {shown.map((r, idx) => {
          const total = totalOf(r);
          return (
            <li key={idx} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{String(r[labelKey] ?? "—")}</span>
                <span className="font-semibold tabular-nums">{count.format(total)}</span>
              </div>
              <div className="bg-muted flex h-2.5 overflow-hidden rounded-full" style={{ width: `${Math.max((total / max) * 100, 2)}%` }}>
                {series.map((s, i) => {
                  const v = Number(r[s.key]) || 0;
                  return v ? (
                    <span key={s.key} title={`${s.label}: ${count.format(v)}`}
                      className="h-full border-e-2 border-[var(--card)] last:border-e-0"
                      style={{ width: `${(v / total) * 100}%`, background: seriesGradient(seriesColor(i)) }} />
                  ) : null;
                })}
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length > limit ? (
        <p className="text-muted-foreground text-xs">Chỉ vẽ {limit} / {rows.length} dòng lớn nhất. Xem đủ ở bảng bên dưới.</p>
      ) : null}
    </div>
  );
}

/** Thanh ngang một màu cho một đại lượng theo danh mục (vd. tình trạng kỹ thuật). */
export function BarList({ items, unit }: { items: Slice[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{it.label}</span>
            <span className="tabular-nums">
              <span className="font-semibold">{count.format(it.count)}</span>
              {unit ? <span className="text-muted-foreground text-xs"> {unit}</span> : null}
              <span className="text-muted-foreground ms-2 text-xs">{total ? Math.round((it.count / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="bg-muted h-2 rounded-full">
            <div className="h-2 rounded-full" style={{ width: `${(it.count / max) * 100}%`, background: seriesGradient("var(--chart-1)") }}
              title={`${it.label}: ${count.format(it.count)}`} />
          </div>
        </li>
      ))}
    </ul>
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
  const body = (
    <div className={cn(flat ? "flex items-center px-5 py-3.5" : "bg-card rounded-xl border px-5 py-4 shadow-e1", href && "hover:border-primary/40 transition-colors")}>
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
