import type { CrudFilter } from "@refinedev/core";
import { useCan, useInfiniteList, useOne } from "@refinedev/core";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/shared/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { Spinner } from "@/shared/components/spinner";
import { useInfiniteScroll } from "@/shared/hooks/use-infinite-scroll";

/**
 * Ô chọn một bản ghi từ một resource, **tìm kiếm ở server và tải thêm theo
 * trang**.
 *
 * <p>Thứ nó thay thế là mẫu `useList({ pagination: { pageSize: 200 } })` rồi
 * lọc trong trình duyệt. Mẫu đó đúng khi danh mục có vài chục dòng và hỏng khi
 * có vài nghìn — hỏng trong im lặng, vì ô chọn vẫn hiện ra bình thường, chỉ là
 * thiếu dòng thứ 201 trở đi và không có gì nói cho người dùng biết. Với 1.162
 * trường thì gần 83% danh sách biến mất.
 *
 * <p>Ba điều làm nên sự khác biệt:
 *
 * <ul>
 *   <li><b>Tìm ở server.</b> Chữ gõ vào đi thành tham số {@code q} của API, nên
 *       tìm được cả những dòng chưa tải về. Lọc phía trình duyệt chỉ tìm được
 *       trong phần đã tải — tức là tìm trong đúng cái tập đang thiếu.</li>
 *   <li><b>Tải theo trang.</b> Mỗi lần 25 dòng, có nút tải thêm. Mở ô chọn
 *       không còn kéo về cả nghìn bản ghi.</li>
 *   <li><b>Giá trị hiện tại luôn hiển thị.</b> Bản ghi đang chọn được đọc
 *       riêng bằng {@code useOne}, nên nó hiện đúng tên ngay cả khi không nằm
 *       trong trang đầu, và cả khi tài khoản không có quyền đọc danh sách.</li>
 * </ul>
 *
 * <p>Quyền đọc danh sách là quyền RIÊNG so với quyền sửa bản ghi đang mở. Không
 * có quyền thì không gọi — hỏi bừa là tiêu một request cho một cái 403 chắc
 * chắn và dựng một toast lỗi đè lên form.
 */

type AsyncComboboxProps<T> = {
  resource: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  /** Nhãn hiển thị của một bản ghi. */
  labelOf: (item: T) => string;
  /** Nhãn dự phòng khi chưa đọc được bản ghi đang chọn (ví dụ tên đã có sẵn trên form). */
  fallbackLabel?: string | null;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Sắp xếp trang đầu. Mặc định theo tên. */
  sortField?: string;
  /** Cho phép bỏ chọn. */
  clearable?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  /** Ô đang lỗi (form báo thiếu / sai): viền đỏ như ô nhập khác — `aria-invalid` trên nút. */
  invalid?: boolean;
  /** Số dòng mỗi lần tải. */
  pageSize?: number;
  /** Nhận cả bản ghi vừa chọn — cho ô dùng để THÊM vào một danh sách (vd. chọn nhiều trường), không giữ giá trị. */
  onPick?: (item: T) => void;
  /**
   * Nút chỉ có biểu tượng (hàng công cụ chật): tên đang chọn / chữ gợi ý hiện khi rê chuột; đã chọn thì nút viền màu
   * chính và có chấm ở góc.
   */
  icon?: ReactNode;
  /** Lọc sẵn danh sách, vd. chỉ mục còn dùng (`active = true`). */
  filters?: CrudFilter[];
};

/** Từ bao nhiêu mục trở lên thì danh sách có ô tìm. */
const SEARCH_FROM = 10;

export function AsyncCombobox<T extends { id: number }>({
  resource,
  value,
  onChange,
  labelOf,
  fallbackLabel,
  placeholder = "Chọn...",
  searchPlaceholder = "Gõ để tìm...",
  sortField = "name",
  clearable = true,
  clearLabel = "— Không chọn —",
  disabled,
  invalid,
  pageSize = 25,
  onPick,
  icon,
  filters: baseFilters,
}: AsyncComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");

  // Gõ tới đâu gọi tới đó sẽ bắn một request mỗi phím. 300ms là đủ để một
  // người gõ xong một từ, và đủ ngắn để không thấy trễ.
  useEffect(() => {
    const id = setTimeout(() => setSearch(term.trim()), 300);
    return () => clearTimeout(id);
  }, [term]);

  const access = useCan({ resource, action: "list" });
  const mayRead = access.data?.can ?? false;

  // Bản Refine này trả về { query, result }: dữ liệu và cờ phân trang nằm ở
  // `result`, còn các thao tác của react-query nằm ở `query`.
  const { query, result } = useInfiniteList<T>({
      resource,
      pagination: { pageSize },
      sorters: [{ field: sortField, order: "asc" }],
      filters: [...(baseFilters ?? []), ...(search ? [{ field: "q", operator: "eq" as const, value: search }] : [])],
      // Chỉ gọi khi ô chọn đang mở: một form có năm ô chọn thì mở form không
      // nên là năm request cho dữ liệu chưa ai nhìn tới.
      queryOptions: { enabled: mayRead && open },
    });

  const { fetchNextPage, isFetchingNextPage, isLoading } = query;
  const hasNextPage = result.hasNextPage ?? false;

  const items = useMemo(
    () =>
      (result.data?.pages ?? []).flatMap((page) => (page.data ?? []) as T[]),
    [result.data]
  );

  // Dưới 10 mục (cấp học, loại hình…) nhìn là thấy hết: không cần ô tìm. Đang gõ thì giữ ô, không ô biến mất dưới tay.
  const fewItems = !term && !search && !hasNextPage && items.length < SEARCH_FROM;
  const rootRef = useRef<HTMLDivElement>(null);

  // Bản ghi đang chọn, đọc riêng. Chỉ gọi khi nó KHÔNG nằm trong danh sách đã
  // tải — không thì đây là một request thừa cho dữ liệu đã có trong tay.
  const inList = items.some((item: T) => item.id === value);
  const { result: currentRecord } = useOne<T>({
    resource,
    id: value ?? undefined,
    queryOptions: { enabled: mayRead && value != null && !inList },
  });

  const loadMoreRef = useInfiniteScroll({
    hasMore: hasNextPage,
    isFetching: isFetchingNextPage,
    onLoadMore: () => void fetchNextPage(),
  });

  const label = useMemo(() => {
    if (value == null) return null;
    const fromList = items.find((item: T) => item.id === value);
    if (fromList) return labelOf(fromList);
    return currentRecord ? labelOf(currentRecord as T) : fallbackLabel;
  }, [value, items, currentRecord, labelOf, fallbackLabel]);

  // Nút lọc biểu tượng mà tài khoản không được đọc danh sách (vd. UBND với danh sách địa bàn): không vẽ — bấm vào chỉ ra menu trống.
  if (icon && access.data?.can === false) return null;

  return (
    // `modal`: nằm trong hộp thoại thì popover phải tự giữ cuộn, không thì lớp
    // khoá cuộn của hộp thoại nuốt mất bánh xe chuột trên danh sách.
    <Popover open={open} onOpenChange={setOpen} modal>
      {icon ? (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="icon" role="combobox" aria-expanded={open} disabled={disabled}
                aria-label={label ?? placeholder}
                className={cn("relative shrink-0", value != null && "border-primary/50 text-primary bg-primary/5")}>
                {icon}
                {value != null ? <span aria-hidden className="bg-primary ring-background absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2" /> : null}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          {open ? null : (
            <TooltipContent side="bottom" sideOffset={4} tone="light" className="font-medium">
              {label ?? placeholder}
            </TooltipContent>
          )}
        </Tooltip>
      ) : (
      <PopoverTrigger asChild>
          {/* Cùng dáng với ô chọn của form (`SelectTrigger`): nền ô nhập, viền mảnh, đỏ khi lỗi. */}
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(
              "border-input bg-field hover:bg-accent/60 shadow-e1 flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
              "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
              !label && "text-muted-foreground"
            )}
          >
            <span className="min-w-0 truncate">{label ?? placeholder}</span>
            <ChevronsUpDown className="text-muted-foreground size-4 shrink-0 opacity-50" />
          </button>
      </PopoverTrigger>
      )}
      <PopoverContent
        // Có ô tìm: rộng đủ cho tên dài (tên trường). Danh sách ngắn (cấp học…): vừa chữ, không kéo dài theo ô tìm không có;
        // nút chỉ biểu tượng hẹp nên hộp tự lấy bề rộng theo nội dung.
        className={cn(
          "max-w-[calc(100vw-2rem)] p-0",
          !fewItems ? "w-(--radix-popover-trigger-width) min-w-96" : icon ? "w-max min-w-44" : "w-(--radix-popover-trigger-width)"
        )}
        align="start"
        // Có ô tìm thì con trỏ vào ô tìm; không có thì vào danh sách, để phím mũi tên / Enter vẫn chọn được.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const root = rootRef.current;
          (root?.querySelector<HTMLElement>("[cmdk-input]") ?? root)?.focus();
        }}
      >
        {/* `shouldFilter={false}`: lọc là việc của server. Để Command tự lọc
            thì nó sẽ lọc LẠI kết quả server vừa trả về, và những dòng khớp
            theo cách khác (mã, không dấu) sẽ bị chính nó loại đi. */}
        <Command ref={rootRef} tabIndex={-1} shouldFilter={false} className="outline-none">
          {fewItems ? null : (
            <CommandInput
              autoFocus
              placeholder={searchPlaceholder}
              value={term}
              onValueChange={setTerm}
            />
          )}
          <CommandList className="max-h-96">
            {isLoading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
                <Spinner size="sm" />
                Đang tải...
              </div>
            ) : items.length === 0 ? (
              <CommandEmpty>Không tìm thấy.</CommandEmpty>
            ) : null}

            {clearable && value != null ? (
              <CommandItem
                value="__clear__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <span className="text-muted-foreground">{clearLabel}</span>
              </CommandItem>
            ) : null}

            {items.map((item: T) => (
              <CommandItem
                key={item.id}
                value={String(item.id)}
                onSelect={() => {
                  onChange(item.id);
                  onPick?.(item);
                  setOpen(false);
                }}
              >
                {/* Nút lọc biểu tượng: không cột dấu tích, mục đang chọn đổi màu chữ như `IconFilter`. */}
                {icon ? null : (
                  <Check
                    className={cn(
                      "size-4",
                      value === item.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                )}
                <span className={cn("truncate", icon && value === item.id && "text-primary font-medium")}>{labelOf(item)}</span>
              </CommandItem>
            ))}

            {/* Thẻ canh thay cho nút "Tải thêm": cuộn tới đáy là tải trang
                sau. Một nút trong CommandList còn phải chặn sự kiện chọn của
                Command, nếu không popover đóng ngay lúc vừa tải xong. */}
            {hasNextPage ? (
              <div
                ref={loadMoreRef}
                className="text-muted-foreground flex items-center justify-center gap-2 py-3 text-xs"
              >
                {isFetchingNextPage ? (
                  <>
                    <Spinner size="sm" />
                    Đang tải...
                  </>
                ) : (
                  "Cuộn để tải thêm"
                )}
              </div>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
