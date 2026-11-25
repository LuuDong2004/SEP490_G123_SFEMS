import { useSearchParams } from "react-router";

import { FillBox } from "@/shared/components/layout/fill-box";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { usePerspective } from "@/shared/hooks/use-perspective";

import { YearOverview } from "../school-year/year-overview";
import { YearStandardView } from "../school-year/year-standard";
import { SchoolStandard } from "./school-standard";
import { StandardOverview } from "./standard-overview";

/** `?school=<id>` trên địa chỉ — gửi liên kết, bấm Quay lại của trình duyệt được. */
function usePickedSchool() {
  const [params, setParams] = useSearchParams();
  const picked = Number(params.get("school")) || null;
  const open = (id: number | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (id) next.set("school", String(id));
      else next.delete("school");
      return next;
    });
  return { picked, open };
}

/**
 * Thân màn chuẩn tối thiểu HÔM NAY (số dùng được, cả trường) — màn Mua sắm (`equipment_adequacy`) dùng. Tài khoản
 * trường thấy chuẩn của mình; Sở thấy bảng tổng hợp, bấm một trường thì mở trường đó.
 */
export function MinimumStandardBody() {
  const { perspective } = usePerspective();
  const { picked, open } = usePickedSchool();
  if (perspective === "school") return <SchoolStandard />;
  if (picked) return <SchoolStandard schoolId={picked} onBack={() => open(null)} />;
  return <StandardOverview onOpenSchool={open} />;
}

/**
 * `/equipment-minimum` — chuẩn tối thiểu THEO NĂM HỌC, theo điểm trường (docs/du-lieu-theo-nam-hoc.md, màn D). Trường thấy trường
 * mình; Sở thấy các trường (lọc có điều chỉnh, ngoài thông tư, chênh lệch lớn) và tab "Tổng hợp địa bàn" (cân đối
 * thừa – thiếu theo thiết bị, như trước).
 */
export const EquipmentMinimum = () => {
  const { perspective } = usePerspective();
  const { picked, open } = usePickedSchool();
  return (
    <ListView>
      <ListViewHeader canCreate={false} title="Thiết bị dạy học tối thiểu" />
      {perspective === "school" ? (
        <FillBox><YearStandardView /></FillBox>
      ) : picked ? (
        <FillBox><YearStandardView schoolId={picked} onBack={() => open(null)} /></FillBox>
      ) : (
        <>
          {/* Một màn (trưởng nhóm 24/11/2026): "Tổng hợp địa bàn" gộp vào bảng các trường theo năm học — dòng tổng
              của địa bàn và Xuất Excel nằm trên hàng công cụ của bảng. */}
          <FillBox><YearOverview onOpenSchool={open} /></FillBox>
        </>
      )}
    </ListView>
  );
};
