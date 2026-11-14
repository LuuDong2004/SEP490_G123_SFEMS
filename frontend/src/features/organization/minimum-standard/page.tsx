import { useSearchParams } from "react-router";

import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { usePerspective } from "@/shared/hooks/use-perspective";

import { SchoolStandard } from "./school-standard";
import { StandardOverview } from "./standard-overview";

/**
 * Thân màn Thiết bị dạy học tối thiểu, theo người xem: tài khoản của một trường thấy chuẩn của chính
 * trường mình; Sở / UBND / quản trị thấy bảng tổng hợp địa bàn, bấm một trường thì mở chuẩn của
 * trường đó (`?school=<id>` — nằm trên URL để gửi liên kết và bấm Quay lại của trình duyệt được).
 */
export function MinimumStandardBody() {
  const { perspective } = usePerspective();
  const [params, setParams] = useSearchParams();
  const picked = Number(params.get("school")) || null;
  const open = (id: number | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (id) next.set("school", String(id));
      else next.delete("school");
      return next;
    });

  if (perspective === "school") return <SchoolStandard />;
  if (picked) return <SchoolStandard schoolId={picked} onBack={() => open(null)} />;
  return <StandardOverview onOpenSchool={open} />;
}

/** `/equipment-minimum` — tab "Chuẩn tối thiểu" của phân hệ Thiết bị, và mục menu của cấp quản lý. */
export const EquipmentMinimum = () => (
  <ListView>
    <ListViewHeader canCreate={false} title="Thiết bị dạy học tối thiểu" />
    <MinimumStandardBody />
  </ListView>
);
