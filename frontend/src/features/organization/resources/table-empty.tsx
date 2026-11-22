import { Inbox, SearchX } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import { TableCell, TableRow } from "@/shared/ui/table";
import { Spinner } from "@/shared/components/spinner";

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
 * Chữ "Đang tải…" kèm vòng quay nhỏ.
 *
 * <p>Repo nguồn có hàm này trong `shared/components/spinner.tsx`, nhưng bản `spinner.tsx` của nhóm đã được
 * viết lại và không còn nó. `shared/**` phải báo DongLV trước khi sửa, nên dựng tại chỗ bằng `Spinner` sẵn có.
 */
function LoadingText({ label = "Đang tải…" }: { label?: string }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
      <Spinner size="sm" />
      {label}
    </span>
  );
}

/**
 * Dòng TRỐNG của bảng tự vẽ (không qua `DataTable`): biểu tượng tròn, tiêu đề, gợi ý — đứng GIỮA và cao KÍN phần
 * còn lại của khung dưới đầu bảng (tự đo vùng cuộn chứa bảng, đổi theo khi khung đổi cỡ).
 *
 * <p>Bản cục bộ của `shared/components/data-table/table-empty.tsx` (repo nguồn) — giữ trong feature thay vì
 * `shared/**` vì file dùng chung phải báo DongLV trước khi thêm.
 *
 * - `filtered`: đang lọc / tìm mà không ra dòng nào — biểu tượng tìm, tiêu đề mặc định "Không có kết quả phù hợp".
 * - `compact`: bảng nhỏ nằm giữa form (dòng phiếu, bảng phụ) — cao vừa đủ (~10rem), không đo khung.
 * - `loading`: đang tải — cùng chỗ, chỉ chữ "Đang tải…" mờ, không biểu tượng "trống".
 */
export function TableEmpty({ colSpan, title, description, filtered, compact, icon, loading }: {
  colSpan: number;
  title?: ReactNode;
  description?: ReactNode;
  filtered?: boolean;
  compact?: boolean;
  icon?: ReactNode;
  loading?: boolean;
}) {
  const ref = useRef<HTMLTableCellElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (compact) return;
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
  }, [compact]);
  return (
    <TableRow className="hover:bg-transparent border-0">
      <TableCell ref={ref} colSpan={colSpan} className="p-0" style={compact ? undefined : { height: height ?? 320 }}>
        <EmptyBody title={title} description={description} filtered={filtered} icon={icon} loading={loading}
          className={compact ? "py-10" : "h-full"} />
      </TableCell>
    </TableRow>
  );
}

function EmptyBody({ title, description, filtered, icon, loading, className }: {
  title?: ReactNode; description?: ReactNode; filtered?: boolean; icon?: ReactNode; loading?: boolean; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 text-center", className)}>
      {loading ? <LoadingText /> : <>
        <span className="bg-accent text-muted-foreground mb-1 flex size-12 items-center justify-center rounded-full [&_svg]:size-5">
          {icon ?? (filtered ? <SearchX /> : <Inbox />)}
        </span>
        <p className="text-foreground text-sm font-semibold">{title ?? (filtered ? "Không có kết quả phù hợp" : "Chưa có dữ liệu")}</p>
        {description ? <p className="text-muted-foreground max-w-sm text-sm">{description}</p> : null}
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
