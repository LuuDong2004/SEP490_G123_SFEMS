import { Building2, CheckCircle2, GitFork, GripVertical, Landmark, Plus, School, Send, X } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

import { ZoomCanvas } from "./zoom-canvas";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { APPROVAL_STEP_ORDER, APPROVAL_STEP_SHORT, APPROVAL_STEP_TITLES } from "@/domains/approval-flow/types";
import type { ApprovalStep } from "@/domains/voucher/types";

/* Kéo thả bằng HTML5 thuần. Dữ liệu kéo: "new:<bước>", "move:<làn>:<bước>" hoặc "gateway". */
const MIME = "text/x-approval-flow";
type Lane = "base" | "above";

export type FlowDraft = {
  steps: ApprovalStep[];
  /** `null` = không rẽ nhánh theo tiền; `0` = đã thêm nhánh nhưng chưa nhập ngưỡng. */
  threshold: number | null;
  above: ApprovalStep[];
};

/** Mỗi cấp một sắc riêng, để nhìn sơ đồ là phân biệt được cấp — không dựa vào chữ. */
const STEP_STYLE: Record<ApprovalStep, { icon: ReactNode; chip: string }> = {
  SCHOOL: { icon: <School />, chip: "bg-info-subtle text-info-text" },
  MANAGING_BODY: { icon: <Landmark />, chip: "bg-warning-subtle text-warning-text" },
  RECEIVING_BODY: { icon: <Building2 />, chip: "bg-success-subtle text-success-text" },
};

const money = new Intl.NumberFormat("vi-VN");

/** Thêm một bước vào làn, giữ đúng thứ tự cấp — trường luôn duyệt trước cơ quan quản lý. */
const withStep = (steps: ApprovalStep[], s: ApprovalStep) => APPROVAL_STEP_ORDER.filter((x) => x === s || steps.includes(x));

/** Đọc dữ liệu kéo — chỉ đọc được lúc thả (trình duyệt giấu nó trong lúc kéo qua). */
function readDrag(e: DragEvent): { kind: "new" | "move" | "gateway"; lane?: Lane; step?: ApprovalStep } | null {
  const raw = e.dataTransfer.getData(MIME);
  if (!raw) return null;
  const [kind, a, b] = raw.split(":");
  if (kind === "gateway") return { kind };
  if (kind === "new") return { kind, step: a as ApprovalStep };
  if (kind === "move") return { kind, lane: a as Lane, step: b as ApprovalStep };
  return null;
}

/** Điểm đầu và điểm cuối của luồng: viên thuốc có biểu tượng. */
function Terminal({ end, children }: { end?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "shadow-e1 relative flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium [&_svg]:size-4",
        end ? "border-success/40 bg-success-subtle text-success-text" : "bg-card text-foreground",
      )}
    >
      {end ? <CheckCircle2 /> : <Send className="text-primary" />}
      {children}
    </div>
  );
}

/**
 * Đoạn nối giữa hai nút, kèm nút "+" ở giữa để chèn bước. Đoạn nối cũng là chỗ THẢ: kéo một bước vào đây là
 * thêm vào nhánh này (vị trí trong nhánh vẫn theo thứ tự cấp).
 */
function Connector({ lane, available, onAdd, onDropStep, short }: {
  lane: Lane;
  available: ApprovalStep[];
  onAdd: (lane: Lane, step: ApprovalStep) => void;
  onDropStep: (lane: Lane, e: DragEvent) => void;
  short?: boolean;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(MIME)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        onDropStep(lane, e);
      }}
      className={cn("relative flex shrink-0 items-center justify-center self-stretch", short ? "w-8" : "w-16")}
    >
      <span className={cn("absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full transition-colors", over ? "bg-primary" : "bg-border")} />
      {/* Đầu mũi tên. */}
      <span aria-hidden className={cn("absolute top-1/2 right-0 size-0 -translate-y-1/2 border-y-[5px] border-l-[7px] border-y-transparent", over ? "border-l-primary" : "border-l-border")} />
      {over ? (
        <span className="border-primary bg-card text-primary relative rounded-full border border-dashed px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap">
          Thả
        </span>
      ) : available.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Thêm bước duyệt"
              className="bg-card text-muted-foreground hover:border-primary hover:text-primary shadow-e1 relative flex size-6 items-center justify-center rounded-full border transition-colors [&_svg]:size-3.5"
            >
              <Plus />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-72">
            <DropdownMenuLabel className="text-overline text-muted-foreground">Thêm bước duyệt</DropdownMenuLabel>
            {available.map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onAdd(lane, s)} className="items-start gap-2.5 py-2">
                <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-4", STEP_STYLE[s].chip)}>
                  {STEP_STYLE[s].icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{APPROVAL_STEP_TITLES[s].title}</span>
                  <span className="text-muted-foreground block text-xs leading-snug">{APPROVAL_STEP_TITLES[s].who}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

/** Thẻ một bước duyệt: biểu tượng màu của cấp, số bước, ai duyệt; kéo được sang nhánh khác, bỏ bằng ×. */
function StepCard({ step, index, lane, onRemove }: { step: ApprovalStep; index: number; lane: Lane; onRemove: () => void }) {
  const style = STEP_STYLE[step];
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(MIME, `move:${lane}:${step}`);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "bg-card shadow-e2 group relative flex w-60 shrink-0 cursor-grab items-center gap-3 overflow-hidden rounded-xl border py-3 ps-3 pe-2 active:cursor-grabbing",
      )}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[1.125rem]", style.chip)}>{style.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground block text-[0.6875rem] font-medium tracking-wide uppercase">Bước {index + 1}</span>
        <span className="block text-sm leading-snug font-semibold">{APPROVAL_STEP_TITLES[step].title}</span>
        <span className="text-muted-foreground block text-xs leading-snug">{APPROVAL_STEP_TITLES[step].who}</span>
      </span>
      <GripVertical className="text-muted-foreground/50 size-4 shrink-0 group-hover:hidden" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Bỏ bước ${APPROVAL_STEP_TITLES[step].title}`}
        className="text-muted-foreground hover:bg-destructive-subtle hover:text-destructive-text hidden size-7 shrink-0 items-center justify-center rounded-md group-hover:flex [&_svg]:size-4"
      >
        <X />
      </button>
    </div>
  );
}

/** Một nhánh NGANG: các bước của nhánh, nút + trên mọi đoạn nối, kết thúc bằng "Hoàn tất". */
function LaneRow({ lane, steps, palette, onAdd, onRemove, onDropStep, title }: {
  lane: Lane;
  steps: ApprovalStep[];
  palette: ApprovalStep[];
  onAdd: (lane: Lane, step: ApprovalStep) => void;
  onRemove: (lane: Lane, step: ApprovalStep) => void;
  onDropStep: (lane: Lane, e: DragEvent) => void;
  title?: ReactNode;
}) {
  const available = palette.filter((s) => !steps.includes(s));
  return (
    <div className="flex items-center">
      {title}
      {steps.length === 0 ? (
        <>
          <Connector lane={lane} available={available} onAdd={onAdd} onDropStep={onDropStep} />
          <span className="bg-card text-muted-foreground relative shrink-0 rounded-full border border-dashed px-3 py-1 text-xs">Không cần duyệt</span>
        </>
      ) : (
        steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <Connector lane={lane} available={available} onAdd={onAdd} onDropStep={onDropStep} />
            <StepCard step={s} index={i} lane={lane} onRemove={() => onRemove(lane, s)} />
          </div>
        ))
      )}
      <Connector lane={lane} available={available} onAdd={onAdd} onDropStep={onDropStep} />
      <Terminal end>Hoàn tất</Terminal>
    </div>
  );
}

/**
 * Bộ dựng luồng phê duyệt: sơ đồ NGANG, đọc từ trái sang phải như các công cụ dựng quy trình — điểm bắt đầu, các thẻ bước nối nhau,
 * điểm hoàn tất; rẽ nhánh theo tiền tách thành hai hàng song song sau một khối điều kiện.
 *
 * Thêm bước: bấm "+" trên đường nối, hoặc kéo một khối từ hàng công cụ trên cùng thả vào đường nối. Kéo một
 * thẻ sang nhánh kia để chuyển; bấm × để bỏ. Thứ tự KHÔNG kéo đổi được, và đó là cố ý: phiếu không thể lên cơ
 * quan quản lý trước khi trường duyệt, nên bước thả vào tự đứng đúng chỗ của cấp nó.
 */
export function FlowDesigner({ value, onChange, receiving, amountLabel }: {
  value: FlowDraft;
  onChange: (next: FlowDraft) => void;
  receiving: boolean;
  /** `null` = loại phiếu này không có số tiền, không rẽ nhánh được. */
  amountLabel: string | null;
}) {
  const branched = value.threshold !== null;
  const palette = APPROVAL_STEP_ORDER.filter((s) => s !== "RECEIVING_BODY" || receiving);

  const add = (lane: Lane, step: ApprovalStep, from?: Lane) => {
    let steps = value.steps;
    let above = value.above;
    if (from && from !== lane) {
      if (from === "base") steps = steps.filter((x) => x !== step);
      else above = above.filter((x) => x !== step);
    }
    if (lane === "base") steps = withStep(steps, step);
    else above = withStep(above, step);
    onChange({ ...value, steps, above });
  };
  const remove = (lane: Lane, step: ApprovalStep) =>
    onChange(lane === "base" ? { ...value, steps: value.steps.filter((x) => x !== step) } : { ...value, above: value.above.filter((x) => x !== step) });
  const addGateway = () => onChange({ ...value, threshold: value.threshold ?? 0, above: value.above.length ? value.above : value.steps });
  const removeGateway = () => onChange({ ...value, threshold: null, above: [] });

  const dropInto = (lane: Lane, e: DragEvent) => {
    const drag = readDrag(e);
    if (!drag) return;
    e.preventDefault();
    if (drag.kind === "gateway") {
      if (amountLabel) addGateway();
      return;
    }
    if (!drag.step || !palette.includes(drag.step)) return;
    add(lane, drag.step, drag.kind === "move" ? drag.lane : undefined);
  };

  const chip = "bg-card hover:border-primary/50 flex cursor-grab items-center gap-1.5 rounded-full border py-1 ps-1 pe-3 text-xs font-medium transition-colors active:cursor-grabbing";

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border">
      {/* Hàng công cụ: khối kéo được vào sơ đồ (bấm cũng thêm được vào nhánh chính). */}
      <div className="bg-surface-subtle flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="text-muted-foreground me-1 text-xs">Kéo vào sơ đồ:</span>
        {palette.map((s) => (
          <button
            key={s}
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(MIME, `new:${s}`);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => add("base", s)}
            title="Kéo vào đường nối trên sơ đồ, hoặc bấm để thêm"
            className={chip}
          >
            <span className={cn("flex size-5 items-center justify-center rounded-full [&_svg]:size-3", STEP_STYLE[s].chip)}>{STEP_STYLE[s].icon}</span>
            {APPROVAL_STEP_SHORT[s]}
          </button>
        ))}
        {amountLabel ? (
          <button
            type="button"
            draggable={!branched}
            disabled={branched}
            onDragStart={(e) => {
              e.dataTransfer.setData(MIME, "gateway");
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={addGateway}
            title={branched ? "Sơ đồ đã có rẽ nhánh" : "Rẽ nhánh theo số tiền của phiếu"}
            className={cn(chip, "disabled:cursor-not-allowed disabled:opacity-50")}
          >
            <span className="bg-muted text-foreground flex size-5 items-center justify-center rounded-full [&_svg]:size-3"><GitFork /></span>
            Rẽ nhánh theo tiền
          </button>
        ) : null}
      </div>

      {/* Sơ đồ trên nền lưới chấm, đọc từ trái sang phải. */}
      <ZoomCanvas fitKey={`${branched}-${value.steps.length}-${value.above.length}`} className="min-h-[26rem]">
        <div className="flex items-center px-4 py-12">
          <Terminal>Lập và trình phiếu</Terminal>
          {branched ? (
            <>
              <Connector lane="base" available={[]} onAdd={add} onDropStep={dropInto} short />
              {/* Khối điều kiện của nhánh: hình thoi, điều kiện ghi dưới. */}
              <div className="relative flex shrink-0 flex-col items-center gap-2">
                <span className="bg-card shadow-e2 text-foreground flex size-12 rotate-45 items-center justify-center rounded-xl border-2">
                  <GitFork className="size-5 -rotate-45" />
                </span>
                <button type="button" onClick={removeGateway} aria-label="Bỏ rẽ nhánh"
                  className="bg-card text-muted-foreground hover:bg-destructive hover:text-destructive-foreground absolute -top-2 -right-3 flex size-5 items-center justify-center rounded-full border [&_svg]:size-3">
                  <X />
                </button>
                <span className="absolute top-full mt-2 w-40 text-center text-[0.6875rem] leading-tight">
                  <span className="text-muted-foreground block">{amountLabel}</span>
                  {value.threshold ? (
                    <span className="font-semibold tabular-nums">≥ {money.format(value.threshold)} đ</span>
                  ) : (
                    <span className="text-warning-text">chưa nhập ngưỡng</span>
                  )}
                </span>
              </div>
              {/* Ngoặc nối khối điều kiện tới hai hàng. */}
              <div className="relative ms-8 flex flex-col gap-16 py-1 ps-6">
                <span aria-hidden className="bg-border absolute top-[2.4rem] bottom-[2.4rem] left-0 w-0.5" />
                <span aria-hidden className="bg-border absolute top-1/2 -left-3 h-0.5 w-3" />
                <div className="relative flex items-center">
                  <span aria-hidden className="bg-border absolute top-1/2 -left-6 h-0.5 w-6" />
                  <LaneRow lane="above" steps={value.above} palette={palette} onAdd={add} onRemove={remove} onDropStep={dropInto}
                    title={<span className="bg-card text-foreground border-primary/40 relative shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap">Từ ngưỡng trở lên</span>} />
                </div>
                <div className="relative flex items-center">
                  <span aria-hidden className="bg-border absolute top-1/2 -left-6 h-0.5 w-6" />
                  <LaneRow lane="base" steps={value.steps} palette={palette} onAdd={add} onRemove={remove} onDropStep={dropInto}
                    title={<span className="bg-card text-muted-foreground relative shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap">Dưới ngưỡng</span>} />
                </div>
              </div>
            </>
          ) : (
            <LaneRow lane="base" steps={value.steps} palette={palette} onAdd={add} onRemove={remove} onDropStep={dropInto} />
          )}
        </div>
      </ZoomCanvas>
    </div>
  );
}

/** Luồng viết thành câu — "Trường duyệt → Cơ quan quản lý duyệt", rỗng thì "trình là xong". */
// eslint-disable-next-line react-refresh/only-export-components
export const flowSentence = (steps: ApprovalStep[]) =>
  steps.length ? steps.map((s) => APPROVAL_STEP_TITLES[s].title).join(" → ") : "Trình là xong, không cần duyệt";

/** Sơ đồ thu nhỏ, chỉ xem — dùng trên danh sách các loại phiếu. */
export function FlowMini({ steps }: { steps: ApprovalStep[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground text-xs">Trình</span>
      {steps.length === 0 ? (
        <>
          <span aria-hidden className="bg-border h-px w-4" />
          <span className="text-muted-foreground text-xs">xong, không cần duyệt</span>
        </>
      ) : (
        steps.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="bg-border h-px w-4" />
            <span className={cn("inline-flex items-center gap-1 rounded-full py-0.5 ps-1 pe-2.5 text-xs font-medium [&_svg]:size-3", STEP_STYLE[s].chip)}>
              <span className="flex size-4 items-center justify-center">{STEP_STYLE[s].icon}</span>
              {APPROVAL_STEP_SHORT[s]}
            </span>
          </span>
        ))
      )}
      <span aria-hidden className="bg-border h-px w-4" />
      <CheckCircle2 className="text-success-text size-4" aria-label="Hoàn tất" />
    </span>
  );
}
