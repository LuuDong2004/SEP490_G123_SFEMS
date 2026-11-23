import type { TreeMenuItem } from "@refinedev/core";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { isMotionReduced } from "@/shared/lib/theme";
import { cn } from "@/shared/lib/utils";

import type { ProcessStep } from "./process-page";

/**
 * Bảng màu từng bước (lặp vòng). Chữ dùng họ màu trạng thái / biểu đồ của hệ thống, nền chip
 * là chính màu đó pha loãng; đường nối chạy gradient từ màu bước này sang màu bước sau.
 */
const TONES = [
  { text: "text-[oklch(0.52_0.16_255)]", chip: "bg-[oklch(0.95_0.03_255)]", stroke: "oklch(0.62 0.15 255)" },
  { text: "text-[oklch(0.52_0.1_190)]", chip: "bg-[oklch(0.95_0.03_190)]", stroke: "oklch(0.66 0.1 190)" },
  { text: "text-[oklch(0.5_0.18_300)]", chip: "bg-[oklch(0.95_0.03_300)]", stroke: "oklch(0.65 0.15 300)" },
  { text: "text-[oklch(0.55_0.14_65)]", chip: "bg-[oklch(0.96_0.04_80)]", stroke: "oklch(0.74 0.14 70)" },
  { text: "text-[oklch(0.5_0.14_150)]", chip: "bg-[oklch(0.95_0.04_150)]", stroke: "oklch(0.64 0.13 150)" },
  { text: "text-[oklch(0.52_0.17_15)]", chip: "bg-[oklch(0.95_0.03_15)]", stroke: "oklch(0.66 0.15 15)" },
];

const CARD_H = 68;
/** Nhịp tiếp sức giữa hai đoạn, và thời gian một thẻ nhãn chạy hết một đoạn (giây). */
const SEG = 2;
const TRAVEL = 2.2;
/** Biên độ dọc của làn sóng mà các thẻ nằm trên — đủ cao để đường nối uốn thành chữ S dài. */
const WAVE = 190;
/**
 * Độ cao của từng thẻ trên làn sóng (0 = đỉnh, 1 = đáy), lặp lại nếu quy trình dài hơn. KHÔNG so le đều
 * trên / dưới: mỗi thẻ một độ cao khác nhau thì các đường cong dài ngắn, dốc thoải khác nhau — cả chuỗi
 * trông như một dòng chảy chứ không như răng cưa.
 */
const LEVELS = [0.12, 0.82, 0.0, 1.0, 0.3, 0.72, 0.08, 0.9];

/** Đang giảm chuyển động (Tuỳ chỉnh → Hiệu ứng chuyển động) thì đường nối đứng yên, không có chấm chạy. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(isMotionReduced);
  useEffect(() => {
    // Cờ `data-reduce-motion` trên <html> đổi khi người dùng đổi lựa chọn hoặc Windows bật / tắt hiệu ứng.
    const obs = new MutationObserver(() => setReduced(isMotionReduced()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
    return () => obs.disconnect();
  }, []);
  return reduced;
}

type Laid = { x: number; y: number; w: number };

/**
 * Quy trình dạng LUỒNG: các bước là thẻ nhỏ nằm trên một làn sóng, nối bằng những đường cong dài, mềm,
 * có quầng sáng và chấm chạy từ trái sang phải — đọc một lượt là thấy thứ tự và ai làm gì. Mỗi thẻ: biểu tượng của
 * màn đó, số bước, tên bước, người lập, và dòng màu là người duyệt (hoặc "không cần duyệt").
 * Kết quả của bước hiện khi rê chuột. Màn hẹp thì xếp dọc.
 */
export function ProcessFlow({
  steps,
  byName,
  allowed,
  labelOf,
}: {
  steps: ProcessStep[];
  byName: Map<string, TreeMenuItem>;
  allowed: (s: ProcessStep) => boolean;
  labelOf: (name: string) => string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const reduced = useReducedMotion();
  const n = steps.length;
  // Thẻ NHỎ và khe RỘNG: đường cong cần chỗ để uốn dài. Thẻ chiếm chừng 60% phần của nó, phần còn lại
  // là khe; hẹp quá thì thẻ giữ tối thiểu 176px và khe co lại.
  const slot = n > 0 ? width / n : 0;
  const w = Math.max(176, Math.min(232, slot * 0.62));
  const spacing = n > 1 ? (width - w) / (n - 1) : 0;
  const laid: Laid[] = steps.map((_, i) => ({ x: i * spacing, y: 10 + LEVELS[i % LEVELS.length] * WAVE, w }));
  const height = CARD_H + WAVE + 12;

  const card = (s: ProcessStep, i: number, className?: string, style?: React.CSSProperties) => {
    const tone = TONES[i % TONES.length];
    const item = byName.get(s.resource);
    const ok = allowed(s);
    const body: ReactNode = (
      <>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-[1.125rem]", tone.chip, tone.text)}>
          {(item?.meta?.icon as ReactNode) ?? null}
        </span>
        <span className="min-w-0 flex-1 pe-5">
          {/* Thẻ chỉ mang TÊN BƯỚC: ai lập, ai duyệt và kết quả nằm trong chú thích khi rê chuột — hai dòng
              chữ nhỏ bị cắt ba chấm ("Cán bộ thi…", "Duyệt: Lãn…") không đọc được mà chỉ làm thẻ rối. */}
          <span className="line-clamp-2 text-sm leading-snug font-semibold">{s.title}</span>
        </span>
        <span className={cn("absolute top-2 right-2 flex size-5 items-center justify-center rounded-full text-[0.6875rem] font-semibold tabular-nums", tone.chip, tone.text)}>{i + 1}</span>
      </>
    );
    const cls = cn(
      "bg-card shadow-e1 relative flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-[box-shadow,border-color,translate] duration-300 ease-out",
      "animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500",
      ok ? "hover:shadow-e3 hover:border-primary/40 hover:-translate-y-1" : "border-dashed opacity-70",
      className,
    );
    const title = [labelOf(s.resource), s.optional ? "Khi cần" : null, `Lập: ${s.maker}`, s.approver ? `Duyệt: ${s.approver}` : "Không cần duyệt", s.result]
      .filter(Boolean).join(" · ");
    style = { ...style, animationDelay: `${i * 90}ms` };
    return ok && item?.route ? (
      <Link key={i} to={item.route} className={cls} style={style} title={title}>{body}</Link>
    ) : (
      <div key={i} className={cls} style={style} title={`${title}${ok ? "" : " (bạn không có quyền mở màn này)"}`}>{body}</div>
    );
  };

  /**
   * Đường nối: một chữ S DÀI từ giữa cạnh phải thẻ này sang giữa cạnh trái thẻ sau. Hai tay nắm nằm
   * ngang và vươn xa (65% khoảng cách, không dưới 60px) nên đường rời thẻ thật êm rồi mới đổi độ cao —
   * hai thẻ sát nhau thì tay nắm vươn quá điểm đến, đường vòng nhẹ ra ngoài thay vì gãy góc.
   */
  const path = (a: Laid, b: Laid) => {
    const x1 = a.x + a.w, y1 = a.y + CARD_H / 2, x2 = b.x, y2 = b.y + CARD_H / 2;
    const d = Math.max(60, (x2 - x1) * 0.65);
    return `M ${x1} ${y1} C ${x1 + d} ${y1}, ${x2 - d} ${y2}, ${x2} ${y2}`;
  };

  return (
    <>
      {/* Màn rộng: luồng so le có đường nối. */}
      <div
        ref={box}
        className="relative hidden bg-[radial-gradient(circle,color-mix(in_oklch,var(--border)_70%,transparent)_1px,transparent_1px)] [background-size:22px_22px] lg:block"
        style={{ height: height + 8 }}
      >
        {width > 0 ? (
          <>
            <svg className="pointer-events-none absolute inset-0" width={width} height={height + 8} aria-hidden>
              <defs>
                <filter id="pf-shadow" x="-20%" y="-50%" width="140%" height="200%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.12" />
                </filter>
                <filter id="pf-halo" filterUnits="userSpaceOnUse" x={-20} y={-20} width={width + 40} height={height + 60}>
                  <feGaussianBlur stdDeviation="5" />
                </filter>
                <filter id="pf-glow" x="-200%" y="-200%" width="500%" height="500%">
                  <feGaussianBlur stdDeviation="2.5" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                {laid.slice(1).map((_, i) => (
                  <linearGradient key={i} id={`pf-g${i}`} gradientUnits="userSpaceOnUse"
                    x1={laid[i].x + laid[i].w / 2} x2={laid[i + 1].x + laid[i + 1].w / 2} y1={0} y2={0}>
                    <stop offset="0" stopColor={TONES[i % TONES.length].stroke} />
                    <stop offset="1" stopColor={TONES[(i + 1) % TONES.length].stroke} />
                  </linearGradient>
                ))}
              </defs>
              {laid.slice(1).map((b, i) => {
                const d = path(laid[i], b);
                const from = TONES[i % TONES.length].stroke;
                const to = TONES[(i + 1) % TONES.length].stroke;
                const label = steps[i].handoff;
                // Tiếp sức: đoạn i xuất phát sau đoạn i-1 một nhịp, cả chuỗi lặp lại cùng một chu kỳ.
                const dur = Math.max(8, (n - 1) * SEG + 2);
                const f = TRAVEL / dur;
                const chipW = label ? label.length * 6.1 + 26 : 0;
                return (
                  <g key={i}>
                    {/* Ba lớp: quầng sáng mờ, nét mảnh liền, rồi chấm trôi — đường nối sáng lên như một dòng chảy. */}
                    <path d={d} fill="none" stroke={`url(#pf-g${i})`} strokeOpacity={0.3} strokeWidth={9} strokeLinecap="round" filter="url(#pf-halo)" />
                    <path d={d} fill="none" stroke={`url(#pf-g${i})`} strokeOpacity={0.7} strokeWidth={1.8} strokeLinecap="round" />
                    <path d={d} fill="none" stroke={`url(#pf-g${i})`} strokeWidth={2.8} strokeLinecap="round"
                      strokeDasharray="1.5 11" className={reduced ? undefined : "animate-flow-dash"} style={{ animationDelay: `${-i * 0.8}s` }} />
                    {reduced ? null : (
                      <g opacity={0}>
                        <animateMotion dur={`${dur}s`} begin={`${i * SEG}s`} repeatCount="indefinite" path={d}
                          keyPoints="0;1;1" keyTimes={`0;${f.toFixed(3)};1`} calcMode="spline" keySplines="0.45 0 0.2 1; 0 0 1 1" />
                        <animate attributeName="opacity" values="0;0;1;1;0;0" dur={`${dur}s`} begin={`${i * SEG}s`} repeatCount="indefinite"
                          keyTimes={`0;${(f * 0.2).toFixed(3)};${(f * 0.4).toFixed(3)};${(f * 0.7).toFixed(3)};${(f * 0.9).toFixed(3)};1`} />
                        {label ? (
                          <>
                            <rect x={-chipW / 2} y={-10.5} width={chipW} height={21} rx={10.5} className="fill-card" stroke={to} strokeOpacity={0.45}
                              filter="url(#pf-shadow)" />
                            <circle cx={-chipW / 2 + 10} cy={0} r={2.8} fill={to} />
                            <text x={-chipW / 2 + 17} y={0.5} dominantBaseline="middle" fontSize={10.5} fontWeight={650} fill={to}>{label}</text>
                          </>
                        ) : (
                          <circle r={4} fill={from} filter="url(#pf-glow)" />
                        )}
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
            {steps.map((s, i) =>
              card(s, i, "absolute", { left: laid[i].x, top: laid[i].y, width: laid[i].w, height: CARD_H }),
            )}
          </>
        ) : null}
      </div>
      {/* Màn hẹp: danh sách dọc. */}
      <ol className="grid gap-3 lg:hidden">
        {steps.map((s, i) => (
          <li key={i}>{card(s, i)}</li>
        ))}
      </ol>
    </>
  );
}
