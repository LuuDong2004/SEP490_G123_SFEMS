import { Check, ChevronsUpDown, Landmark, School } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { API_URL } from "@/shared/api/constants";
import { useInfiniteScroll } from "@/shared/hooks/use-infinite-scroll";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

export type SignInSchool = { id: number; name: string; area?: string | null; prefix: string };

const STORAGE_KEY = "signin.school";
/** Cùng số dòng một lần tải với máy chủ (`SchoolSignInLookupController.PAGE`). */
const PAGE = 30;

/** Trường đã chọn lần trước trên máy này — người của một trường đăng nhập lại thì khỏi chọn lại. */
export function rememberedSchool(): SignInSchool | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SignInSchool) : null;
  } catch {
    return null;
  }
}

function remember(school: SignInSchool | null) {
  try {
    if (school) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(school));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // bộ nhớ trình duyệt bị chặn — chỉ mất phần "nhớ lần trước"
  }
}

/**
 * Ô "Đơn vị" của màn đăng nhập: chọn TRƯỜNG theo tên, màn tự ghép tiền tố tài khoản ({@code <mã trường>.})
 * — tài khoản người trong trường là {@code <mã trường>.<mã cán bộ>} và không ai nhớ nổi mã trường. Sở, UBND,
 * quản trị không chọn trường, gõ đủ tên đăng nhập. Tìm ở máy chủ (`/auth/schools`, mở, không cần phiên).
 */
export function SignInSchoolPicker({ value, onChange }: { value: SignInSchool | null; onChange: (s: SignInSchool | null) => void }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [items, setItems] = useState<SignInSchool[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Tải theo trang (30 trường một lần), cuộn tới cuối là tải tiếp — gần nghìn trường, không chỉ 20 dòng đầu.
  const load = (from: number, signal?: AbortSignal) => {
    setLoading(true);
    return fetch(`${API_URL}/auth/schools?q=${encodeURIComponent(term.trim())}&_start=${from}`, { signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: SignInSchool[]) => {
        const page = Array.isArray(rows) ? rows : [];
        setItems((prev) => (from === 0 ? page : [...prev, ...page]));
        setHasMore(page.length === PAGE);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const id = setTimeout(() => void load(0, ctrl.signal), 250);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tải lại khi đổi từ khoá hoặc mở hộp
  }, [term, open]);

  const loadMoreRef = useInfiniteScroll({ hasMore, isFetching: loading, onLoadMore: () => void load(items.length) });

  const pick = (s: SignInSchool | null) => {
    onChange(s);
    remember(s);
    setOpen(false);
  };

  const row = (selected: boolean, icon: ReactNode, title: ReactNode, sub?: ReactNode) => (
    <span className="flex w-full min-w-0 items-center gap-3">
      {/* Nền NHẠT kể cả khi đang chọn: CommandItem tô mọi biểu tượng màu chữ phụ, nên trên nền xanh đặc
          biểu tượng chìm mất. Mục đang chọn chỉ đổi sang nền xanh nhạt + biểu tượng xanh. */}
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4",
        selected ? "bg-primary/12 [&_svg]:text-primary!" : "bg-muted [&_svg]:text-muted-foreground!")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {sub ? <span className="text-muted-foreground block truncate text-xs">{sub}</span> : null}
      </span>
      {selected ? <Check className="text-primary size-4 shrink-0" /> : null}
    </span>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-10 w-full justify-between px-3 font-normal">
          <span className="flex min-w-0 items-center gap-2.5">
            {value ? <School className="text-primary size-4 shrink-0" /> : <Landmark className="text-muted-foreground size-4 shrink-0" />}
            {value ? (
              <span className="min-w-0 truncate">
                {value.name}
                {value.area ? <span className="text-muted-foreground"> · {value.area}</span> : null}
              </span>
            ) : (
              <span className="text-muted-foreground truncate">Chọn trường của bạn</span>
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Gõ tên trường, không cần dấu…" value={term} onValueChange={setTerm} />
          <CommandList className="max-h-80">
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => pick(null)} className="py-2">
                {row(!value, <Landmark />, "Sở, UBND hoặc quản trị", "Không thuộc trường — gõ đủ tên đăng nhập")}
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading={term.trim() ? "Kết quả" : "Trường học"}>
              {!loading && items.length === 0 ? (
                <p className="text-muted-foreground px-2 py-5 text-center text-sm">Không tìm thấy trường.</p>
              ) : null}
              {items.map((s) => (
                <CommandItem key={s.id} value={String(s.id)} onSelect={() => pick(s)} className="py-2">
                  {row(value?.id === s.id, <School />, s.name, s.area)}
                </CommandItem>
              ))}
              {hasMore ? (
                <div ref={loadMoreRef} className="text-muted-foreground py-3 text-center text-xs">
                  {loading ? "Đang tải…" : "Cuộn để xem thêm trường"}
                </div>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
