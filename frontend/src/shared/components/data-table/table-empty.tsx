import { Inbox, SearchX } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";
import { TableCell, TableRow } from "@/shared/ui/table";
import { LoadingText } from "@/shared/components/spinner";

const SKELETON_WIDTHS = ["72%", "48%", "86%", "60%", "38%", "66%", "54%"];

/**
 * Dòng xương của bảng tự vẽ lúc đang tải — cùng hiệu ứng với `DataTable` (thanh dài ngắn khác nhau có vệt sáng, các
 * dòng hiện dần từ trên xuống): thấy trước hình dạng bảng, không phải chữ "Đang tải…" trơn.
 */
export function TableSkeletonRows({ rows = 6, cols }: { rows?: number; cols: number }) {
  return Array.from({ length: rows }).map((_, r) => (
    <TableRow key={`sk-${r}`} aria-hidden="true" className="animate-skeleton-in hover:bg-transparent" style={{ animationDelay: `${r * 45}ms` }}>
      {Array.from({ length: cols }).map((__, c) => (
        <TableCell key={c}>
          <div className="flex h-8 items-center">
            <Skeleton className="h-3.5 rounded-full" style={{ width: SKELETON_WIDTHS[(r * 3 + c) % SKELETON_WIDTHS.length] }} />
          </div>
        </TableCell>
      ))}
    </TableRow>
  ));
}

/** Phần tử gần nhất (từ ô lên) tự cuộn — vùng mà ô trống phải lấp kín. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.clientHeight > 0) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Dòng TRỐNG của mọi bảng tự vẽ (không qua `DataTable`): biểu tượng tròn, tiêu đề, gợi ý — đứng GIỮA và cao KÍN phần
 * còn lại của khung dưới đầu bảng (tự đo vùng cuộn chứa bảng, đổi theo khi khung đổi cỡ). Không dùng một dòng chữ nhỏ
 * trên đầu bảng: bảng trống trông như trang chưa tải xong (góp ý của trưởng nhóm, nhắc nhiều lần).
 *
 * - `filtered`: đang lọc / tìm mà không ra dòng nào — biểu tượng tìm, tiêu đề mặc định "Không có kết quả phù hợp".
 * - `compact`: bảng nhỏ nằm giữa form (dòng phiếu, bảng phụ) — cao vừa đủ (~10rem), không đo khung.
 * - `loading`: đang tải — cùng chỗ, chỉ chữ "Đang tải…" mờ, không biểu tượng "trống".
 */
/**
 * Chiều cao còn lại của vùng cuộn dưới đầu bảng — cho ô "bảng trống" lấp kín khung (không để một khoảng trắng và vạch kẻ
 * ở giữa). `off` thì không đo (bảng nhỏ trong form).
 */
export function useRemainingHeight(off?: boolean) {
  const ref = useRef<HTMLTableCellElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (off) return;
    const cell = ref.current;
    const box = scrollParent(cell);
    if (!cell || !box) return;
    const measure = () => {
      const head = cell.closest("table")?.querySelector("thead")?.getBoundingClientRect().height ?? 0;
      // Lấp phần còn lại của vùng cuộn; tối thiểu 12rem để không bẹp ở khung thấp.
      setHeight(Math.max(192, box.clientHeight - head - 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [off]);
  return [ref, height] as const;
}

export function TableEmpty({ colSpan, title, description, action, filtered, compact, icon, loading }: {
  colSpan: number;
  title?: ReactNode;
  description?: ReactNode;
  /** Lối ra khi bảng trống (nút "Thêm …") — đứng dưới tiêu đề, giữa khung. */
  action?: ReactNode;
  filtered?: boolean;
  compact?: boolean;
  icon?: ReactNode;
  loading?: boolean;
}) {
  const [ref, height] = useRemainingHeight(compact);
  return (
    <TableRow className="hover:bg-transparent border-0">
      <TableCell ref={ref} colSpan={colSpan} className="p-0" style={compact ? undefined : { height: height ?? 320 }}>
        <EmptyBody title={title} description={description} action={action} filtered={filtered} icon={icon} loading={loading}
          className={compact ? "py-10" : "h-full"} />
      </TableCell>
    </TableRow>
  );
}

function EmptyBody({ title, description, action, filtered, icon, loading, className }: {
  title?: ReactNode; description?: ReactNode; action?: ReactNode; filtered?: boolean; icon?: ReactNode; loading?: boolean; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 text-center", className)}>
      {loading ? <LoadingText /> : <>
        <span className="bg-accent text-muted-foreground mb-1 flex size-12 items-center justify-center rounded-full [&_svg]:size-5">
          {icon ?? (filtered ? <SearchX /> : <Inbox />)}
        </span>
        <p className="text-foreground line-clamp-2 max-w-xl text-sm font-semibold [overflow-wrap:anywhere]">{title ?? (filtered ? "Không có kết quả phù hợp" : "Chưa có dữ liệu")}</p>
        {description ? <p className="text-muted-foreground max-w-sm text-sm [overflow-wrap:anywhere]">{description}</p> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </>}
    </div>
  );
}

/**
 * Trạng thái TRỐNG cho vùng KHÔNG phải bảng (danh sách thẻ, khung lưới): cùng dáng `TableEmpty`, giãn kín khung cha
 * (`flex-1`, tối thiểu 12rem) và đứng giữa. Vùng là bảng thì vẫn vẽ bảng + `TableEmpty`, không thay bảng bằng khối này.
 */
export function EmptyState({ title, description, filtered, icon, loading, className }: {
  title?: ReactNode; description?: ReactNode; filtered?: boolean; icon?: ReactNode; loading?: boolean; className?: string;
}) {
  return <EmptyBody title={title} description={description} filtered={filtered} icon={icon} loading={loading}
    className={cn("min-h-48 flex-1 py-10", className)} />;
}
