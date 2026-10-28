import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useFormField } from "@/shared/ui/form";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/**
 * Dấu "?" cạnh một nhãn — rê chuột, focus hoặc bấm thì hiện lời giải thích.
 *
 * Dùng cho thứ người ta chỉ cần đọc MỘT lần (ô này để làm gì, cột này đếm gì): để thành dòng chữ nhỏ
 * dưới mỗi ô thì form dài gấp rưỡi và hàng ô lệch nhau; để trong `title` thì không ai biết là có.
 * Thứ là TRẠNG THÁI của ô ("Đã chọn 3 môn", "Mã tự động") thì vẫn hiện thẳng, không giấu sau dấu "?".
 */
export function HelpHint({ children, className, label = "Giải thích" }: {
  children: ReactNode;
  className?: string;
  /** Tên của nút cho trình đọc màn hình. */
  label?: string;
}) {
  // Mở theo cả rê chuột lẫn BẤM: màn cảm ứng không có rê chuột.
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          // Ngoài thứ tự Tab: hộp thoại mở ra tự focus phần tử đầu tiên, và nếu đó là dấu "?" thì chú
          // thích của nó che luôn tiêu đề hộp thoại. Rê chuột hoặc bấm vẫn mở được.
          tabIndex={-1}
          data-print="hide"
          onClick={(e) => {
            // Nằm trong <label> hoặc nút sắp xếp của tiêu đề cột: bấm dấu "?" không được kích ô nhập / sắp xếp.
            e.preventDefault();
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className={cn(
            "text-muted-foreground hover:text-primary -my-0.5 inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full align-middle transition-colors",
            "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
            className,
          )}
        >
          <CircleHelp className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-start text-xs leading-relaxed font-normal tracking-normal normal-case text-pretty whitespace-normal">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Lời giải thích của một ô nhập, thay cho `FormDescription`: đặt ở đúng chỗ cũ (trong `FormItem`),
 * nhưng hiện thành dấu "?" NGAY CẠNH NHÃN của ô. Chữ vẫn nằm trong DOM (ẩn khỏi mắt) dưới đúng id
 * mà `FormControl` trỏ `aria-describedby` tới, nên trình đọc màn hình đọc như trước.
 *
 * Tìm nhãn theo `for` rồi đưa dấu "?" vào đó qua portal — nhờ vậy các form sẵn có chỉ đổi tên
 * component, không phải dời chữ lên nhãn ở từng chỗ. Ô không có nhãn thì dấu "?" nằm tại chỗ.
 */
export function FormHint({ children }: { children: ReactNode; className?: string }) {
  const { formItemId, formDescriptionId } = useFormField();
  const [target, setTarget] = useState<{ label: Element | null } | null>(null);
  const anchor = useCallback(
    (el: HTMLElement | null) =>
      setTarget(el ? { label: document.querySelector(`label[for="${CSS.escape(formItemId)}"]`) } : null),
    [formItemId],
  );
  const hint = <HelpHint>{children}</HelpHint>;
  return (
    <>
      <p ref={anchor} id={formDescriptionId} className="sr-only">
        {children}
      </p>
      {target ? (target.label ? createPortal(hint, target.label) : hint) : null}
    </>
  );
}
