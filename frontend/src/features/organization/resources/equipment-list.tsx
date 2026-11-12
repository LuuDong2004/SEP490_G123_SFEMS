import { useCan, type CrudFilter } from "@refinedev/core";
import { PackagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";

import { Segmented } from "@/shared/components/segmented";
import { ListView, ToolbarExtrasProvider } from "@/shared/components/views/list-view";
import { useFillHeight } from "@/shared/hooks/use-fill-height";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { EquipmentAside } from "./equipment-aside";
import { EquipmentItems } from "./equipment-items";
import { EquipmentSummary } from "./equipment-summary";

type ViewKey = "catalog" | "room" | "items";

const VIEWS: { value: ViewKey; label: string; hint: string }[] = [
  { value: "catalog", label: "Tổng hợp", hint: "Số lượng theo từng thiết bị: tổng, dùng được, đang dùng, trong kho, hỏng" },
  { value: "room", label: "Theo kho/phòng", hint: "Thiết bị đang để ở từng kho, từng phòng" },
  { value: "items", label: "Theo tài sản", hint: "Từng tài sản có mã riêng" },
];

/**
 * Màn Thiết bị (TS-01, TS-02): cột lọc nhanh bên trái, bên phải là một trong ba chế độ xem — Tổng hợp (số lượng
 * theo nhóm thiết bị), Theo kho/phòng, và Theo tài sản (bảng từng hồ sơ). Bấm một dòng tổng hợp mở bảng Theo
 * tài sản đã lọc sẵn, kèm một chip gỡ được.
 *
 * Thiết bị MỚI vào sổ bằng phiếu ghi tăng (lập → lãnh đạo trường duyệt → sinh tài sản, PN-01..03), không tạo
 * thẳng ở đây: nút chính là "Ghi tăng". Thiết bị trường đã có từ trước khi dùng hệ thống thì nhập từ tệp (TS-07).
 */
export const EquipmentList = () => {
  // Chế độ xem là sở thích của người dùng — nhớ lâu dài, không chỉ trong phiên.
  const [view, setView] = usePersistentState<ViewKey>("equipment.view", "catalog", "local");
  const [asideFilters, setAsideFilters] = useState<CrudFilter[]>([]);
  const [drill, setDrill] = useState<{ filters: CrudFilter[]; label: string } | null>(null);
  const asideReported = useRef(false);
  const fillBox = useFillHeight();

  const onAsideFilters = (filters: CrudFilter[]) => {
    setAsideFilters(filters);
    // Lần báo đầu là lựa chọn được khôi phục sau F5 — giữ nguyên lần mở từ dòng tổng hợp (nếu có).
    if (asideReported.current) setDrill(null);
    asideReported.current = true;
  };

  const lead = (
    <>
      <Segmented
        label="Chế độ xem"
        value={view}
        options={VIEWS}
        onChange={(key) => {
          setView(key as ViewKey);
          // Bấm một chế độ xem (kể cả Theo tài sản) là xem lại toàn bộ — bỏ lọc mở từ dòng tổng hợp.
          setDrill(null);
        }}
      />
      {drill && view === "items" ? (
        <Badge variant="info" className="h-8 max-w-72 gap-1.5 px-3 text-sm" title={drill.label}>
          <span className="truncate">Đang xem: {drill.label}</span>
          <button type="button" onClick={() => setDrill(null)} aria-label="Bỏ lọc" className="hover:text-foreground -me-1 shrink-0">
            <X className="size-3.5" />
          </button>
        </Badge>
      ) : null}
    </>
  );

  return (
    <ListView>
      <h1 className="sr-only">Thiết bị</h1>
      <div
        ref={fillBox.ref}
        style={{ height: fillBox.height }}
        // Cột trái tự ẩn khi phạm vi chưa có thiết bị nào — khi đó bảng chiếm cả bề ngang.
        className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:[&:not(:has(>aside))]:grid-cols-[minmax(0,1fr)]"
      >
        <EquipmentAside onFiltersChange={onAsideFilters} />
        <div className="flex min-h-0 min-w-0 flex-col">
          {/* Nút chọn chế độ xem và nút Ghi tăng nằm ngay trong hàng công cụ của bảng, cùng hàng với ô tìm. */}
          <ToolbarExtrasProvider lead={lead} trail={<IntakeButton />}>
            {view === "items" ? (
              <EquipmentItems
                filters={[...asideFilters, ...(drill?.filters ?? [])]}
                fill
                externallyFiltered={asideFilters.length > 0 || !!drill}
              />
            ) : (
              <EquipmentSummary
                by={view}
                filters={asideFilters}
                drill={(filters, label) => {
                  setDrill({ filters, label });
                  setView("items");
                }}
              />
            )}
          </ToolbarExtrasProvider>
        </div>
      </div>
    </ListView>
  );
};

/** "Ghi tăng" — mở form lập phiếu ghi tăng; chỉ hiện với người lập được phiếu. */
function IntakeButton() {
  const { data } = useCan({ resource: "equipment_intakes", action: "create" });
  if (!data?.can) return null;
  return (
    <Button asChild>
      <Link to="/equipment-intakes/create">
        <PackagePlus />
        Ghi tăng
      </Link>
    </Button>
  );
}
