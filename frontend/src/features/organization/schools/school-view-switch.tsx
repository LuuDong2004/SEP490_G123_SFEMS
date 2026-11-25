import { LayoutGrid, List, ListTree } from "lucide-react";
import { useNavigate } from "react-router";

import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

export type SchoolView = "tree" | "grid" | "list";

/** Khoá `usePersistentState` của Tổng quan các trường — cây / khối là sở thích, nhớ lâu dài. */
const EXPLORER_VIEW_KEY = "explorer.view";

const ITEMS: { value: SchoolView; label: string; icon: typeof List }[] = [
  { value: "tree", label: "Dạng cây", icon: ListTree },
  { value: "grid", label: "Dạng khối", icon: LayoutGrid },
  { value: "list", label: "Danh sách trường", icon: List },
];

/**
 * Ba cách xem trường, cùng MỘT bộ nút ở cả Tổng quan các trường (cây, khối) và Danh sách trường (`/schools`).
 * Cây và khối đổi ngay tại Tổng quan; "Danh sách" mở `/schools`. Từ `/schools` bấm cây / khối thì về Tổng quan
 * với đúng cách xem đó.
 */
export function SchoolViewSwitch({ current, onPick, showList = true }: {
  current: SchoolView;
  /** Có ở Tổng quan: đổi cây / khối tại chỗ. Không có thì chuyển sang Tổng quan. */
  onPick?: (view: Exclude<SchoolView, "list">) => void;
  showList?: boolean;
}) {
  const navigate = useNavigate();
  const pick = (view: SchoolView) => {
    if (view === current) return;
    if (view === "list") {
      navigate("/schools");
    } else if (onPick) {
      onPick(view);
    } else {
      // Ghi ngay, không chờ effect của hook: trang này rời đi trước khi effect kịp chạy.
      try {
        window.localStorage.setItem(EXPLORER_VIEW_KEY, JSON.stringify(view));
      } catch {
        // bộ nhớ bị chặn: Tổng quan mở ở cách xem mặc định
      }
      navigate("/school-explorer");
    }
  };
  return (
    <div role="radiogroup" aria-label="Cách xem trường" className="bg-muted/60 flex h-8 items-center gap-0.5 rounded-lg border p-0.5">
      {ITEMS.filter((i) => showList || i.value !== "list").map((i, index) => (
        <span key={i.value} className="flex h-full items-center">
          {i.value === "list" && index > 0 ? <span aria-hidden className="bg-border mx-0.5 h-4 w-px" /> : null}
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button type="button" role="radio" aria-checked={current === i.value} aria-label={i.label}
                onClick={() => pick(i.value)}
                className={cn(
                  "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-full items-center rounded-md px-2.5 outline-none focus-visible:ring-[3px] [&_svg]:size-4",
                  current === i.value ? "bg-card text-foreground shadow-e1" : "hover:bg-card/70",
                )}>
                <i.icon />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4} tone="light" className="font-medium">{i.label}</TooltipContent>
          </Tooltip>
        </span>
      ))}
    </div>
  );
}
