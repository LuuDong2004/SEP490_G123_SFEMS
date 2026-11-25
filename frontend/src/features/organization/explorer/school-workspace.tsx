import { useCan, useInvalidate, useList, useOne } from "@refinedev/core";
import { Gauge, MapPinned, Pencil } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { currentPortal } from "@/shared/api/portal";
import { useSchoolYear } from "@/shared/hooks/use-school-year";
import { errorMessage } from "@/shared/lib/api-error";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { Button } from "@/shared/ui/button";
import { SchoolDialog } from "@/features/organization/schools/school-dialog";
import { EquipmentPhoto } from "@/features/organization/resources/equipment-photo";
import { SchoolInfoSections, type OwnProfileField, type SchoolPerson } from "@/features/organization/schools/school-info";
import { SchoolFacilityTabs, UncertainDepartment, type SchoolStats } from "@/features/organization/explorer/panels";
import { FacilityInfoPanel, useFacilityInfo } from "@/features/organization/explorer/facility-info";
import { SchoolYearStatus } from "@/features/organization/school-year/year-status";
import { SchoolYearProfileBody } from "@/features/organization/school-year/profile";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Bàn làm việc của MỘT trường — cái tài khoản trường thấy khi mở "Tổng quan trường học". Cố ý ít
 * thứ: chỉ dải tab mang số đếm của chính chúng, không thẻ tên trường (tên nằm ở đầu tab Hồ sơ trường). Số lớp, cán bộ, phòng chỉ nằm ở MỘT chỗ — trên tab —
 * chứ không lặp lại ở một hàng ô chỉ số ngay phía trên.
 */
export function SchoolWorkspace({ stats, tab: tabProp, onTab }: {
  stats: SchoolStats;
  /** Trang riêng của trường giữ tab trên địa chỉ (`?tab=`); vắng thì nhớ theo phiên như ở Tổng quan. */
  tab?: string;
  onTab?: (tab: string) => void;
}) {
  const id = stats.id!;
  const own = currentPortal() === "school";
  const [savedTab, setSavedTab] = usePersistentState("explorer.schoolTab", "profile");
  const tab = tabProp ?? savedTab;
  const setTab = onTab ?? setSavedTab;
  const { result: school } = useOne<any>({ resource: "schools", id });
  // Năm học đang làm việc (header) — hồ sơ trường ghi "Năm học …" theo năm đó.
  const { year: workingYear } = useSchoolYear();
  const mayEdit = useCan({ resource: "schools", action: "edit", params: { id } }).data?.can ?? false;
  // Trường tự sửa phần hồ sơ của mình (ảnh, địa chỉ, mã Bộ — 239). Người sửa được cả hồ sơ (UBND / Sở) dùng nút
  // "Sửa hồ sơ" như cũ, không cần lối hẹp này.
  const mayEditOwn = (useCan({ resource: "school_profile", action: "edit" }).data?.can ?? false) && !mayEdit;
  const invalidate = useInvalidate();
  const saveOwn = async (field: OwnProfileField, value: string) => {
    try {
      await kyInstance.patch("school_profile", { json: { [field]: value } }).json();
    } catch (error) {
      throw new Error(await errorMessage(error));
    }
    await invalidate({ resource: "schools", id, invalidates: ["detail", "list"] });
  };
  // Ban giám hiệu suy từ CHỨC VỤ của cán bộ; một trường vài chục người nên đọc một lần, chỉ khi mở tab Hồ sơ trường.
  const { result: staffResult } = useList<any>({
    resource: "staff",
    filters: [{ field: "school.id", operator: "eq", value: id }],
    pagination: { pageSize: 500 },
    queryOptions: { enabled: tab === "profile" },
  });
  const byPosition = (code: string): SchoolPerson[] =>
    (staffResult?.data ?? []).filter((p: any) => p.position === code && p.active !== false);

  const [editOpen, setEditOpen] = useState(false);
  // Mục ở cột trái cho hai phần CSVC: số đỏ = diện tích chưa khai, số xám = số cơ sở.
  const { data: facility } = useFacilityInfo(id);
  const csvcMissing = [facility && facility.landArea == null ? "Diện tích đất" : null, facility && facility.constructionArea == null ? "Diện tích xây dựng" : null].filter(Boolean) as string[];

  return (
    <div className="space-y-5">

      <SchoolDialog open={editOpen} id={id} onOpenChange={setEditOpen} />

      {/* Cơ quan quản lý xem một trường: dải trạng thái hồ sơ năm học của trường trong năm đang làm việc (mở lại năm đã
          chốt). Tài khoản trường làm hồ sơ năm học ở tab "Năm học" bên dưới. */}
      {own ? null : <SchoolYearStatus schoolId={id} schoolName={stats.name} />}

      {/* Dải tab đứng đầu, thẻ trường nằm dưới nó, nội dung của tab trên một tấm (trong SchoolFacilityTabs). */}
      <SchoolFacilityTabs
        schoolId={id}
        tab={tab}
        onTab={setTab}
        // Không vẽ thẻ / dòng tên trường: người dùng đã chọn trường mới vào màn này (tên ở đường dẫn, ở đầu hồ sơ).
        // Vẫn giữ h1 ẩn — tiêu đề của cả màn cho trình đọc màn hình (E2E-28).
        header={<h1 className="sr-only">{stats.name}</h1>}
        // Hồ sơ năm học (xác nhận điểm trường, chốt năm) là dữ liệu của trường — tab của màn Trường học, chỉ ở tài khoản
        // của chính trường (cơ quan quản lý thấy dải trạng thái ở trên).
        year={own ? <SchoolYearProfileBody /> : undefined}
        profile={
          // Hồ sơ trường: đầu hồ sơ (ảnh, tên, nút Sửa), dải quy mô, rồi các khối cùng một dáng xếp lưới hai cột —
          // Thông tin trường, Địa bàn, Số liệu chung CSVC, Cơ sở, Ban giám hiệu. Không thẻ lồng thẻ.
          <SchoolInfoSections
            record={school}
            year={workingYear?.name}
            photo={<EquipmentPhoto resource="schools" noun="trường" recordId={id} canWrite={mayEdit || mayEditOwn} editable={mayEdit || mayEditOwn} rail />}
            own={mayEditOwn ? { save: saveOwn } : undefined}
            onGo={setTab}
            action={
              <div className="flex items-center gap-2">
                <UncertainDepartment source={school?.departmentSource} />
                {mayEdit ? (
                  <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                    <Pencil />
                    Sửa hồ sơ
                  </Button>
                ) : null}
              </div>
            }
            leaders={{
              principal: byPosition("HIEU_TRUONG"),
              vice: byPosition("PHO_HIEU_TRUONG"),
              equipment: byPosition("CAN_BO_THIET_BI"),
            }}
            scale={{ classes: stats.classes, students: stats.students, staff: stats.staff, rooms: stats.rooms }}
            extra={<FacilityInfoPanel schoolId={id} general onGo={setTab} />}
            extraNav={[
              { key: "campuses", title: "Cơ sở, điểm trường", icon: MapPinned, group: "Hồ sơ", count: facility?.campuses.length ?? null },
              { key: "csvc", title: "Số liệu chung CSVC", icon: Gauge, group: "Số liệu", missing: csvcMissing },
            ]}
          />
        }
        counts={{
          classes: stats.classes,
          rooms: stats.rooms,
          buildings: stats.buildings,
          campuses: stats.campuses,
          staff: stats.staff,
          equipment: stats.equipment,
        }}
      />
    </div>
  );
}
