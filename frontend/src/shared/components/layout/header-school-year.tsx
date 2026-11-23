import { CalendarRange, Check, ChevronDown } from "lucide-react";

import { useSchoolYear, useYearFromUrl, yearLabel } from "@/shared/hooks/use-school-year";
import { cn } from "@/shared/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

/**
 * Ô NĂM HỌC trên header — chọn bộ dữ liệu của cả hệ thống (lớp, phân công, chuẩn theo năm, hồ sơ năm học, kỳ báo cáo).
 * Năm đã qua tô vàng để không ai tưởng mình đang khai cho năm hiện tại. Danh mục chưa có năm học thì ô ghi rõ như vậy.
 */
export function HeaderSchoolYear() {
  useYearFromUrl();
  const { id, setId, year, years, current, loading, past } = useSchoolYear();
  if (loading) return null;

  // Các màn theo năm đưa năm vào khoá truy vấn, nên đổi năm là chúng tự tải lại — không cần xoá bộ đệm.
  const pick = (next: number) => next !== id && setId(next);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!years.length}
        title={past ? "Đang xem dữ liệu một năm học đã qua" : "Năm học đang làm việc"}
        className={cn(
          "flex h-9 items-center gap-2 rounded-full border px-3 text-sm whitespace-nowrap transition-colors outline-none",
          "focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-60",
          past ? "border-warning/50 bg-warning-subtle text-warning-text" : "bg-muted/50 hover:bg-card hover:shadow-e1",
        )}
      >
        <CalendarRange className="size-4 opacity-70" />
        {year ? (
          <>
            <span className="text-muted-foreground hidden xl:inline">Năm học</span>
            <span className="font-semibold tabular-nums">{yearLabel(year)}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Chưa có năm học</span>
        )}
        {years.length ? <ChevronDown className="size-3.5 opacity-50" /> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="max-h-80 w-56 overflow-y-auto">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">Năm học đang làm việc</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {years.map((y) => (
          <DropdownMenuItem key={y.id} onSelect={() => pick(y.id)} className="gap-2 tabular-nums">
            <Check className={cn("size-4", y.id === id ? "opacity-100" : "opacity-0")} />
            <span className={cn(y.id === id && "font-semibold")}>{yearLabel(y)}</span>
            {y.id === current?.id ? <span className="text-muted-foreground ms-auto text-xs">hiện tại</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
