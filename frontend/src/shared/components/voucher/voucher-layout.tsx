import { Check, CircleAlert, ChevronRight } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Card } from "@/shared/ui/card";
import { HelpHint } from "@/shared/components/form/help-hint";
import { cn } from "@/shared/lib/utils";

/**
 * Bố cục HAI CỘT của màn phiếu (lập, sửa, xem): bên trái là việc chính — bảng dòng và các khối
 * đi kèm; bên phải là thẻ tóm tắt dính khi cuộn — thông tin phiếu, tổng tiền, còn thiếu gì, và
 * nút hành động. Màn hẹp thì cột phải xuống dưới.
 *
 * <p>Thay cho dải bước lớn trên đầu và thanh nổi dưới đáy: cả hai che nội dung, còn cột phải luôn
 * trong tầm mắt mà không đè lên gì.
 */
export function VoucherTwoColumn({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="grid w-full items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid min-w-0 gap-4">{main}</div>
      {/* Thẻ tóm tắt là của màn hình làm việc — bản in chỉ có chứng từ. */}
      <aside data-print="hide" className="grid gap-4 lg:sticky lg:top-16">{side}</aside>
    </div>
  );
}

/**
 * Tiêu đề một khối của form phiếu: tên khối, và (nếu cần) vài chữ mờ ngay cạnh tên — "không bắt
 * buộc", "3/7 mục". Không có dòng phụ đề dưới tiêu đề: năm khối là năm dòng chữ nhỏ không ai đọc. Các khối xếp từ trên xuống
 * theo thứ tự điền — không đánh số, không thụt lề: cột số bên trái chỉ ăn chỗ và làm lệch mép các ô.
 */
export function StepTitle({ title, aside, hint }: {
  title: string;
  /** Trạng thái ngắn của khối ("3 tài sản", "2/7 mục") — hiện thẳng. */
  aside?: ReactNode;
  /** Lời giải thích ("không bắt buộc", "đính kèm được sau khi lưu nháp") — thành dấu "?" cạnh tên khối. */
  hint?: ReactNode;
}) {
  return (
    <h3 className="flex min-w-0 items-center gap-2 text-base leading-6 font-semibold">
      {title}
      {hint ? <HelpHint>{hint}</HelpHint> : null}
      {aside ? <span className="text-muted-foreground text-xs font-normal">{aside}</span> : null}
    </h3>
  );
}

/** Một khối trong thẻ tóm tắt: nhãn chữ hoa nhỏ rồi nội dung; các khối ngăn nhau bằng đường kẻ. */
export function SideSection({ title, aside, children, className }: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2.5 border-t px-4 py-3.5 first:border-t-0", className)}>
      {title ? (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-overline text-muted-foreground">{title}</h3>
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Một cặp nhãn — giá trị gọn trong thẻ tóm tắt. */
export function SideFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="min-w-0 text-end font-medium break-words">{children ?? <span className="text-muted-foreground font-normal">—</span>}</span>
    </div>
  );
}

export type ChecklistItem = { key: string; label: string; ok: boolean; hint?: string; onClick?: () => void };

/**
 * "Cần hoàn thiện" — chỉ những mục CÒN THIẾU, mỗi mục bấm được để mở đúng chỗ phải sửa. Đủ hết
 * thì một dòng "Đủ để trình".
 */
export function CompletionList({ items, doneText = "Đủ để trình" }: {
  items: ChecklistItem[];
  /** Câu khi đã đủ hết — form không có bước trình (kế hoạch bảo trì) thì "Đủ để lưu". */
  doneText?: string;
}) {
  const missing = items.filter((i) => !i.ok);
  if (!missing.length) {
    return (
      <p className="text-success-text flex items-center gap-2 text-sm font-medium">
        <span className="bg-success text-success-foreground flex size-4 items-center justify-center rounded-full">
          <Check className="size-3" strokeWidth={3} />
        </span>
        {doneText}
      </p>
    );
  }
  return (
    <ul className="-mx-2 space-y-0.5">
      {missing.map((i) => {
        const body = (
          <>
            <CircleAlert className="text-warning-text mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{i.label}</span>
              {i.hint ? <span className="text-muted-foreground block text-xs">{i.hint}</span> : null}
            </span>
            {i.onClick ? <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" /> : null}
          </>
        );
        return (
          <li key={i.key}>
            {i.onClick ? (
              <button type="button" onClick={i.onClick} className="hover:bg-muted flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start">
                {body}
              </button>
            ) : (
              <div className="flex items-start gap-2 px-2 py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Chỗ đặt BẢNG DÒNG của phiếu: một thẻ riêng ngay dưới thẻ "Thông tin phiếu". Form của từng loại
 * phiếu vẽ ô đầu phiếu và bảng dòng trong cùng một cây; `VoucherLinesCard` đưa bảng dòng (qua
 * portal, nên vẫn trong form và giữ nguyên context) sang thẻ đó — trang form dùng chung có bố cục
 * như phiếu nhập mà form từng loại không phải tách đôi.
 */
export const VoucherLinesSlot = createContext<HTMLElement | null | undefined>(undefined);

/** Bảng dòng của phiếu. Trong trang form dùng chung thì nằm ở thẻ riêng; ở chỗ khác thì vẽ tại chỗ. */
export function VoucherLinesCard({ children }: { children: ReactNode }) {
  const slot = useContext(VoucherLinesSlot);
  if (slot === undefined) return <Card className="gap-0 overflow-hidden py-0">{children}</Card>;
  return slot ? createPortal(children, slot) : null;
}
