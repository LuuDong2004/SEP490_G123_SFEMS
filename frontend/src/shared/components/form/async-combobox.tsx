import { useCan, useInfiniteList, useOne } from "@refinedev/core";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
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
  /** Số dòng mỗi lần tải. */
  pageSize?: number;
  /** Nhận cả bản ghi vừa chọn — cho ô dùng để THÊM vào một danh sách (vd. chọn nhiều trường), không giữ giá trị. */
  onPick?: (item: T) => void;
};

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
  pageSize = 25,
  onPick,
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

  const mayRead = useCan({ resource, action: "list" }).data?.can ?? false;

  // Bản Refine này trả về { query, result }: dữ liệu và cờ phân trang nằm ở
  // `result`, còn các thao tác của react-query nằm ở `query`.
  const { query, result } = useInfiniteList<T>({
      resource,
      pagination: { pageSize },
      sorters: [{ field: sortField, order: "asc" }],
      filters: search
        ? [{ field: "q", operator: "eq", value: search }]
        : [],
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

  return (
    // `modal`: nằm trong hộp thoại thì popover phải tự giữ cuộn, không thì lớp
    // khoá cuộn của hộp thoại nuốt mất bánh xe chuột trên danh sách.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !label && "text-muted-foreground"
          )}
        >
          <span className="truncate">{label ?? placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-64 p-0"
        align="start"
      >
        {/* `shouldFilter={false}`: lọc là việc của server. Để Command tự lọc
            thì nó sẽ lọc LẠI kết quả server vừa trả về, và những dòng khớp
            theo cách khác (mã, không dấu) sẽ bị chính nó loại đi. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={term}
            onValueChange={setTerm}
          />
          <CommandList className="max-h-72">
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
                <Check
                  className={cn(
                    "size-4",
                    value === item.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="truncate">{labelOf(item)}</span>
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
