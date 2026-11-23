import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft } from "lucide-react";

import { kyInstance } from "@/shared/api/data";
import { EmptyState } from "@/shared/components/data-table/table-empty";
import { LoadingText } from "@/shared/components/spinner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import type { YearRow } from "@/domains/school-year/types";

type Suggestion = { campusId: number; campusName: string; surplus: number; movable: number };

/**
 * Dòng thiếu (bước 5): các điểm trường khác đang thừa thiết bị này. Hệ thống chưa có phiếu cấp phát nội bộ, nên trường
 * tự chuyển phòng trên hồ sơ thiết bị; số thiếu tự giảm ở lần tính sau.
 */
export function SurplusDialog({ row, campusId, onClose }: { row: YearRow; campusId: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["year_standards", "suggestions", row.catalogId, campusId],
    queryFn: ({ signal }) => kyInstance.get("year_standards/suggestions", {
      signal, searchParams: { catalogId: String(row.catalogId), toCampusId: String(campusId) },
    }).json<Suggestion[]>(),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="pe-6">Điểm trường thừa: {row.name}</DialogTitle>
          <DialogDescription>Chuyển phòng cho thiết bị ở hồ sơ thiết bị; số thiếu tự giảm ở lần tính sau.</DialogDescription>
        </DialogHeader>
        {isLoading ? <LoadingText /> : !data?.length ? (
          <EmptyState icon={<ArrowRightLeft />} title="Không điểm trường nào thừa thiết bị này" />
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {data.map((s) => (
              <li key={s.campusId} className="px-4 py-2.5">
                <span className="block font-medium">{s.campusName}</span>
                <span className="text-muted-foreground text-xs tabular-nums">Thừa {s.surplus} · đang dùng {s.movable}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
