import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { FillBox } from "@/shared/components/layout/fill-box";

import { StaffAssignmentsPanel } from "./staff-assignments";

/** `/staff-assignments` — phân công giáo viên theo năm học của trường người xem. */
export function StaffAssignmentsPage() {
  return (
    <ListView>
      <ListViewHeader canCreate={false} title="Phân công giáo viên" />
      <FillBox>
        <StaffAssignmentsPanel />
      </FillBox>
    </ListView>
  );
}

export { SchoolYearProfilePage } from "./profile";
