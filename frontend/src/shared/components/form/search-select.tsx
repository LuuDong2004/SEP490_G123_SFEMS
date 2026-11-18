import { Check, ChevronDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { cn } from "@/shared/lib/utils";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

export type SearchOption = { value: string; label: string };

/** Bỏ dấu, viết thường — "Phòng Hiệu trưởng" tìm được bằng "hieu truong". */
const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/**
 * Ô chọn một mục từ danh sách ĐÃ TẢI SẴN, có ô tìm (không dấu). Cùng dáng `SelectTrigger`; dùng thay Radix `Select`
 * khi danh sách dài — `RefField` tự đổi sang ô này khi quá {@link SEARCH_THRESHOLD} lựa chọn.
 */
export function SearchSelect({ options, value, onChange, placeholder, disabled, invalid, clearLabel }: {
  options: SearchOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Có thì đầu danh sách có mục bỏ chọn (ô không bắt buộc). */
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const q = plain(term.trim());
    return q ? options.filter((o) => plain(o.label).includes(q)) : options;
  }, [options, term]);
  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
    setTerm("");
  };
  return (
    // `modal`: trong hộp thoại, popover tự giữ cuộn (như AsyncCombobox).
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTerm(""); }} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            "border-input bg-field hover:bg-accent/60 shadow-e1 flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-full border px-3.5 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none",
            "focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] min-w-64 p-0"
        align="start"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const root = rootRef.current;
          root?.querySelector<HTMLElement>("[cmdk-input]")?.focus();
          // Mở ra thấy ngay mục đang chọn, không phải đầu danh sách.
          requestAnimationFrame(() => root?.querySelector("[cmdk-item][data-selected=true]")?.scrollIntoView({ block: "nearest" }));
        }}
      >
        <Command ref={rootRef} shouldFilter={false} defaultValue={value ?? undefined}>
          <CommandInput placeholder="Tìm..." value={term} onValueChange={setTerm} />
          <CommandList className="max-h-64">
            {shown.length === 0 ? <CommandEmpty>Không tìm thấy.</CommandEmpty> : null}
            {clearLabel && value != null && !term ? (
              <CommandItem value="__clear__" onSelect={() => pick(null)}>
                <span className="text-muted-foreground">{clearLabel}</span>
              </CommandItem>
            ) : null}
            {shown.map((o) => (
              <CommandItem key={o.value} value={o.value} onSelect={() => pick(o.value)}>
                <span className="min-w-0 flex-1 truncate" title={o.label}>{o.label}</span>
                {o.value === value ? <Check className="text-primary size-4 shrink-0" /> : null}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Danh sách dài hơn số này thì ô chọn có ô tìm. */
export const SEARCH_THRESHOLD = 8;
