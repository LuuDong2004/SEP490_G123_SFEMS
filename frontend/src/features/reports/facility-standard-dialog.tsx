import { FacilityStandardPanel } from "@/shared/components/facility/facility-standard-panel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

/** Bấm một trường trên báo cáo "Đánh giá mức độ chuẩn CSVC" (QLTB-649): bản đánh giá chi tiết của trường đó. */
export function FacilityStandardDialog({ school, onClose }: { school: { id: number; name: string }; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="wide" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="pe-6">Đánh giá mức độ chuẩn CSVC · {school.name}</DialogTitle>
          <DialogDescription>Theo chuẩn Sở khai ở Danh mục chung → Chuẩn CSVC.</DialogDescription>
        </DialogHeader>
        <FacilityStandardPanel schoolId={school.id} />
      </DialogContent>
    </Dialog>
  );
}
