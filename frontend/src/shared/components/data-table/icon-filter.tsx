import { ChevronDown } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/** Bỏ dấu, chữ thường — để gõ "binh an" vẫn ra "Bình An". */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();

/** Từ bao nhiêu mục trở lên thì menu có ô tìm. */
const SEARCH_FROM = 10;

export type IconFilterGroup = { heading?: string; items: { key: string; label: string; count?: number }[] };

/**
 * Nút lọc tròn chỉ có biểu tượng trên hàng công cụ, mỗi điều kiện lọc một nút (cùng dáng `AsyncCombobox icon`): rê chuột hiện
 * tên, đang lọc thì viền màu + chấm ở góc, bấm mở menu chọn một mục. Dùng khi danh sách lựa chọn đã có sẵn trong trình duyệt;
 * danh sách lấy từ API thì dùng `AsyncCombobox icon`.
 */
export function IconFilter({ icon, label, allLabel, total, groups, value, onChange, fallback, alwaysSearch, baseline, disabled, labeled, prefix, actions }: {
  icon: ReactNode;
  /** Tên điều kiện, viết thường — "lớp", "môn học". */
  label: string;
  /** Mục đầu menu để bỏ lọc — "Tất cả lớp". Vắng: điều kiện luôn có một giá trị (năm học), không có mục bỏ lọc. */
  allLabel?: string;
  /** Số bên cạnh mục bỏ lọc. */
  total?: number;
  groups: IconFilterGroup[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Tên mục đang chọn khi nó không còn trong danh sách (điều kiện khác đã thu hẹp) — vẫn hiện để bỏ chọn được. */
  fallback?: string;
  /** Luôn có ô tìm, kể cả khi lúc này ít mục. */
  alwaysSearch?: boolean;
  /** Giá trị mặc định: đang ở giá trị này thì nút không báo là đang lọc (năm hiện hành). */
  baseline?: string;
  /** Điều kiện đang bị khoá theo chỗ khác (phòng đã chọn ở kế hoạch). */
  disabled?: boolean;
  /**
   * Hiện chữ cạnh biểu tượng ("Khối: Tất cả khối ▾") thay cho nút tròn. Dùng khi hàng công cụ còn rộng (chỉ ô tìm và
   * vài bộ lọc): người dùng thấy ngay đang lọc theo gì. Hàng đã chật (có dải chế độ xem, nhiều nút) thì để nút tròn.
   */
  labeled?: boolean;
  /** Chữ trước giá trị trên nút có chữ ("Nhóm: Khối nhà"). */
  prefix?: string;
  /** Việc làm ở cuối menu, chữ trơn không biểu tượng (vd. "Thu gọn tất cả") — bấm là làm, không đổi giá trị đang chọn. */
  actions?: { key: string; label: string; icon?: ReactNode; onSelect: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const all = groups.flatMap((g) => g.items);
  const searchable = alwaysSearch || all.length >= SEARCH_FROM;
  const picked = value ? all.find((i) => i.key === value)?.label ?? fallback ?? value : null;
  const missing = !!value && !all.some((i) => i.key === value);
  const filtering = !!value && value !== baseline;
  // Menu mở ra đứng ở mục đang chọn: mặc định Command tô mục đầu tiên, trông như có hai mục đang chọn.
  const current = groups.flatMap((g) => g.items.filter((i) => i.key === value).map((i) => `${g.heading ?? ""} ${i.label} ${i.key}`.trim()))[0];
  const choose = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };
  const row = (key: string, search: string, text: string, count: number | undefined, on: boolean, select: () => void) => (
    <CommandItem key={key} value={search} onSelect={select}>
      <span className={cn("min-w-0 flex-1 truncate", on && "text-primary font-medium")} title={text}>{text}</span>
      {count != null ? <span className="text-muted-foreground text-xs tabular-nums">{count}</span> : null}
    </CommandItem>
  );
  return (
    // `modal`: nằm trong hộp thoại thì menu phải tự giữ cuộn, không thì lớp khoá cuộn của hộp thoại nuốt bánh xe chuột.
    <Popover open={open} onOpenChange={setOpen} modal>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            {labeled ? (
              <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={`Lọc theo ${label}`} disabled={disabled}
                className={cn("max-w-72 min-w-0 shrink-0 justify-start font-normal", filtering && "border-primary/50 text-primary bg-primary/5")}>
                {icon}
                <span className="min-w-0 truncate">{prefix ? `${prefix}: ` : ""}{picked ?? allLabel ?? label}</span>
                <ChevronDown className="ms-auto size-4 opacity-60" />
              </Button>
            ) : (
              <Button type="button" variant="outline" size="icon" role="combobox" aria-expanded={open} aria-label={`Lọc theo ${label}`} disabled={disabled}
                className={cn("relative shrink-0", filtering && "border-primary/50 text-primary bg-primary/5")}>
                {icon}
                {filtering ? <span aria-hidden className="bg-primary ring-background absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2" /> : null}
              </Button>
            )}
          </PopoverTrigger>
        </TooltipTrigger>
        {open ? null : (
          <TooltipContent side="bottom" sideOffset={4} tone="light" className="font-medium">
            {picked ?? `Lọc theo ${label}`}
          </TooltipContent>
        )}
      </Tooltip>
      <PopoverContent align="start" className={cn("max-w-[calc(100vw-2rem)] p-0", searchable ? "w-96" : "w-max")}
        // Có ô tìm thì con trỏ vào ô tìm; không có thì vào danh sách, để phím mũi tên / Enter vẫn chọn được.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const root = rootRef.current;
          (root?.querySelector<HTMLElement>("[cmdk-input]") ?? root)?.focus();
        }}>
        {/* Tìm không dấu: bộ lọc mặc định của Command so nguyên dấu. */}
        <Command ref={rootRef} tabIndex={-1} className="outline-none" defaultValue={current ?? allLabel} filter={(item, search) => (fold(item).includes(fold(search.trim())) ? 1 : 0)}>
          {searchable ? <CommandInput placeholder={`Tìm ${label}…`} /> : null}
          {/* Ít mục (không có ô tìm): cao theo nội dung, chỉ cuộn khi cửa sổ quá thấp. Nhiều mục: khung cố định, cuộn bên trong. */}
          <CommandList className={searchable ? "max-h-80" : "max-h-(--radix-popover-content-available-height)"}>
            <CommandEmpty>Không tìm thấy.</CommandEmpty>
            {/* Mọi mục phải nằm trong CommandGroup: Command sắp lại DOM khi tìm, gặp thẻ bọc lạ là lỗi appendChild. */}
            {/* Mục "tất cả" và các lựa chọn liền nhau: nhóm không tiêu đề bỏ lề giữa hai nhóm, không để một khoảng trống. */}
            <CommandGroup className={cn(groups.length > 0 && "pb-0")}>
              {allLabel ? row("__all", allLabel, allLabel, total, !value, () => choose(null)) : null}
              {missing ? row("__picked", picked ?? "", picked ?? "", undefined, true, () => choose(null)) : null}
            </CommandGroup>
            {groups.map((g, i) => (
              <CommandGroup key={g.heading ?? i} heading={g.heading} className={cn(!g.heading && "pt-0")}>
                {g.items.map((o) =>
                  row(o.key, `${g.heading ?? ""} ${o.label} ${o.key}`, o.label, o.count, o.key === value, () => choose(o.key === value && allLabel ? null : o.key)))}
              </CommandGroup>
            ))}
            {actions?.length ? (
              <>
                <CommandGroup className="pt-0">
                  {actions.map((a) => (
                    <CommandItem key={a.key} value={`__action ${a.label}`} onSelect={() => { a.onSelect(); setOpen(false); }}>
                      {a.icon}
                      <span className="min-w-0 flex-1 truncate">{a.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
