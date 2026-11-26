import { CheckCircle2, GripVertical, Landmark, Plus, School, Send, X } from "lucide-react";
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

/* Kéo thả bằng HTML5 thuần. Dữ liệu kéo: "new:<bước>". */
const MIME = "text/x-approval-flow";

export type FlowDraft = {
  steps: ApprovalStep[];
};

/** Mỗi cấp một sắc riêng, để nhìn sơ đồ là phân biệt được cấp — không dựa vào chữ. */
const STEP_STYLE: Record<ApprovalStep, { icon: ReactNode; chip: string }> = {
  SCHOOL: { icon: <School />, chip: "bg-info-subtle text-info-text" },
  MANAGING_BODY: { icon: <Landmark />, chip: "bg-warning-subtle text-warning-text" },
};

/** Thêm một bước, giữ đúng thứ tự cấp — trường luôn duyệt trước Sở. */
const withStep = (steps: ApprovalStep[], s: ApprovalStep) => APPROVAL_STEP_ORDER.filter((x) => x === s || steps.includes(x));

/** Đọc dữ liệu kéo — chỉ đọc được lúc thả (trình duyệt giấu nó trong lúc kéo qua). */
function readDrag(e: DragEvent): ApprovalStep | null {
  const raw = e.dataTransfer.getData(MIME);
  const [kind, step] = raw ? raw.split(":") : [];
  return kind === "new" ? (step as ApprovalStep) : null;
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
 * thêm vào luồng (vị trí vẫn theo thứ tự cấp).
 */
function Connector({ available, onAdd, onDropStep }: {
  available: ApprovalStep[];
  onAdd: (step: ApprovalStep) => void;
  onDropStep: (e: DragEvent) => void;
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
        onDropStep(e);
      }}
      className="relative flex w-16 shrink-0 items-center justify-center self-stretch"
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
              <DropdownMenuItem key={s} onSelect={() => onAdd(s)} className="items-start gap-2.5 py-2">
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

/** Thẻ một bước duyệt: biểu tượng màu của cấp, số bước, ai duyệt; bỏ bằng ×. */
function StepCard({ step, index, onRemove }: { step: ApprovalStep; index: number; onRemove: () => void }) {
  const style = STEP_STYLE[step];
  return (
    <div className="bg-card shadow-e2 group relative flex w-60 shrink-0 items-center gap-3 overflow-hidden rounded-xl border py-3 ps-3 pe-2">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[1.125rem]", style.chip)}>{style.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground block text-[0.6875rem] font-medium tracking-wide uppercase">Bước {index + 1}</span>
        <span className="block text-sm leading-snug font-semibold">{APPROVAL_STEP_TITLES[step].title}</span>
        <span className="text-muted-foreground block text-xs leading-snug">{APPROVAL_STEP_TITLES[step].who}</span>
      </span>
      <GripVertical className="text-muted-foreground/50 size-4 shrink-0 group-hover:hidden" aria-hidden />
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

/**
 * Bộ dựng luồng phê duyệt: sơ đồ NGANG, đọc từ trái sang phải như các công cụ dựng quy trình — điểm bắt đầu, các thẻ
 * bước nối nhau, điểm hoàn tất.
 *
 * Thêm bước: bấm "+" trên đường nối, hoặc kéo một khối từ hàng công cụ trên cùng thả vào đường nối; bấm × để bỏ. Thứ tự
 * KHÔNG kéo đổi được, và đó là cố ý: phiếu không thể lên Sở trước khi trường duyệt, nên bước thả vào tự đứng đúng chỗ
 * của cấp nó.
 */
export function FlowDesigner({ value, onChange }: {
  value: FlowDraft;
  onChange: (next: FlowDraft) => void;
}) {
  const palette = APPROVAL_STEP_ORDER;
  const available = palette.filter((s) => !value.steps.includes(s));
  const add = (step: ApprovalStep) => onChange({ steps: withStep(value.steps, step) });
  const remove = (step: ApprovalStep) => onChange({ steps: value.steps.filter((x) => x !== step) });
  const dropInto = (e: DragEvent) => {
    const step = readDrag(e);
    if (!step || !palette.includes(step)) return;
    e.preventDefault();
    add(step);
  };

  const chip = "bg-card hover:border-primary/50 flex cursor-grab items-center gap-1.5 rounded-full border py-1 ps-1 pe-3 text-xs font-medium transition-colors active:cursor-grabbing";

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border">
      {/* Hàng công cụ: khối kéo được vào sơ đồ (bấm cũng thêm được). */}
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
            onClick={() => add(s)}
            title="Kéo vào đường nối trên sơ đồ, hoặc bấm để thêm"
            className={chip}
          >
            <span className={cn("flex size-5 items-center justify-center rounded-full [&_svg]:size-3", STEP_STYLE[s].chip)}>{STEP_STYLE[s].icon}</span>
            {APPROVAL_STEP_SHORT[s]}
          </button>
        ))}
      </div>

      {/* Sơ đồ trên nền lưới chấm, đọc từ trái sang phải. */}
      <ZoomCanvas fitKey={String(value.steps.length)} className="min-h-[18rem]">
        <div className="flex items-center px-4 py-12">
          <Terminal>Lập và trình phiếu</Terminal>
          {value.steps.length === 0 ? (
            <>
              <Connector available={available} onAdd={add} onDropStep={dropInto} />
              <span className="bg-card text-muted-foreground relative shrink-0 rounded-full border border-dashed px-3 py-1 text-xs">Không cần duyệt</span>
            </>
          ) : (
            value.steps.map((s, i) => (
              <div key={s} className="flex items-center">
                <Connector available={available} onAdd={add} onDropStep={dropInto} />
                <StepCard step={s} index={i} onRemove={() => remove(s)} />
              </div>
            ))
          )}
          <Connector available={available} onAdd={add} onDropStep={dropInto} />
          <Terminal end>Hoàn tất</Terminal>
        </div>
      </ZoomCanvas>
    </div>
  );
}

/** Luồng viết thành câu — "Trường duyệt → Sở duyệt", rỗng thì "trình là xong". */
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
