import { useCan, useList, useShow } from "@refinedev/core";
import { DoorOpen, GraduationCap, Pencil } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { CrossLink } from "@/shared/components/cross-link";
import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { TAB_ACTIVE, TAB_IDLE, TAB_ITEM, TAB_STRIP } from "@/shared/lib/tab-style";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { CONDITION_LABELS, USAGE_STATUS_LABELS } from "@/domains/facility/types";
import type { Room } from "@/domains/facility/room";
import type { School } from "@/domains/school/types";
import { ProfileBlock, SchoolInfoSections } from "@/features/organization/schools/school-info";
import { TableEmpty } from "@/features/organization/resources/table-empty";

const count = new Intl.NumberFormat("vi-VN");

type Tab = "profile" | "rooms";

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: "profile", label: "Hồ sơ", icon: <GraduationCap /> },
  { value: "rooms", label: "Phòng", icon: <DoorOpen /> },
];

/**
 * Bảng phòng của MỘT trường, mở từ màn xem trường. Đọc `/api/rooms?school.id=` chứ không đọc cả bảng rồi
 * lọc ở trình duyệt: Sở có gần nghìn trường, và máy chủ đã lọc theo phạm vi người xem được thấy.
 *
 * <p>Cột "Hiện trạng" và "Sử dụng" đứng cạnh nhau: một cái nói chất lượng công trình, một cái nói phòng có
 * đang dùng hay không — hai câu khác nhau, và người xem thường hỏi đúng câu thứ hai.
 */
function SchoolRooms({ schoolId }: { schoolId: number }) {
  const { result, query } = useList<Room>({
    resource: "rooms",
    filters: [{ field: "school.id", operator: "eq", value: schoolId }],
    sorters: [{ field: "name", order: "asc" }],
    // Một trường nhiều nhất vài trăm phòng; tải một lần cho bảng đứng yên, khỏi phân trang trong một tab.
    pagination: { pageSize: 500 },
  });
  const rows = result?.data ?? [];

  return (
    <ProfileBlock
      icon={<DoorOpen />}
      title="Phòng"
      bare
      action={
        <CrossLink to={`/rooms?school.id=${schoolId}`} resource="rooms" action="create" plain className="text-sm font-medium">
          Khai phòng
        </CrossLink>
      }
    >
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <colgroup>
            <col className="w-28" />
            <col />
            <col className="w-32" />
            <col className="w-20" />
            <col className="w-40" />
            <col className="w-36" />
            <col className="w-32" />
          </colgroup>
          <TableHeader sticky>
            <TableRow>
              <TableHead className="px-3">Mã</TableHead>
              <TableHead className="px-3">Phòng</TableHead>
              <TableHead className="px-3">Khối nhà</TableHead>
              <TableHead className="px-3">Tầng</TableHead>
              <TableHead className="px-3">Loại phòng</TableHead>
              <TableHead className="px-3">Sử dụng</TableHead>
              <TableHead className="px-3">Hiện trạng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading || rows.length === 0 ? (
              <TableEmpty
                colSpan={7}
                loading={query.isLoading}
                title={
                  <>
                    Trường chưa khai phòng nào.{" "}
                    <CrossLink to={`/rooms?school.id=${schoolId}`} resource="rooms" action="create" className="text-primary font-medium">
                      Khai phòng đầu tiên
                    </CrossLink>
                  </>
                }
              />
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className={cn("group/row", LIFT_ROW, "h-11")}>
                  <TableCell className="text-muted-foreground truncate px-3 font-mono text-xs">{r.code}</TableCell>
                  <TableCell className="truncate px-3 font-medium" title={r.name}>{r.name}</TableCell>
                  <TableCell className="text-muted-foreground truncate px-3" title={r.building ?? undefined}>
                    {r.building ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground px-3 tabular-nums">{r.floor ?? "—"}</TableCell>
                  <TableCell className="truncate px-3">
                    {r.roomType?.name ? <Badge variant="neutral">{r.roomType.name}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="px-3">
                    {r.usageStatus ? (
                      <span className="text-sm">{USAGE_STATUS_LABELS[r.usageStatus] ?? r.usageStatus}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3">
                    {r.condition ? (
                      <span className="text-sm">{CONDITION_LABELS[r.condition] ?? r.condition}</span>
                    ) : (
                      <span className="text-muted-foreground">Chưa đánh giá</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </ProfileBlock>
  );
}

/**
 * Trang của MỘT trường (TC-01 mở rộng): hồ sơ trường, quy mô, và các bảng con của trường — hiện có tab
 * Phòng.
 *
 * <p>Tab nằm trên ĐỊA CHỈ (`?tab=rooms`) để một liên kết mở đúng bảng cần xem và F5 không nhảy về tab đầu.
 *
 * <p>Quy mô lấy từ chính bản ghi trường (`classCount`, `studentCount`) chứ không gọi thêm endpoint tổng hợp:
 * hai số đó vốn đã nằm trên `schools`.
 */
export const SchoolShow = () => {
  const { query } = useShow<School>({});
  const school = query.data?.data;

  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "profile";
  const setTab = (next: Tab) =>
    setParams(
      (p) => {
        p.set("tab", next);
        return p;
      },
      { replace: true },
    );

  // Số phòng của trường: hỏi đúng một dòng để lấy `total`, không tải cả danh sách chỉ để đếm trên thẻ.
  const { result: rooms } = useList<Room>({
    resource: "rooms",
    filters: school ? [{ field: "school.id", operator: "eq", value: school.id }] : [],
    pagination: { pageSize: 1 },
    queryOptions: { enabled: !!school },
  });

  // `School` không mang `_can` (API trường không trả): nút Sửa hiện theo quyền, và `SchoolEdit` tự chặn khi
  // người xem không có `schools:edit`.
  const canWrite = useCan({ resource: "schools", action: "edit" }).data?.can ?? false;

  return (
    <ShowView>
      <ShowViewHeader
        title={school?.name}
        actions={
          canWrite && school ? (
            <Button variant="outline" asChild>
              <Link to={`/schools/edit/${school.id}`}>
                <Pencil />
                Sửa hồ sơ
              </Link>
            </Button>
          ) : null
        }
        canDelete={false}
      />
      <LoadingOverlay loading={query.isLoading}>
        {school ? (
          <div className="space-y-4">
            <div role="tablist" aria-label="Nội dung trường" className={TAB_STRIP}>
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.value}
                  className={cn(TAB_ITEM, tab === t.value ? TAB_ACTIVE : TAB_IDLE)}
                  onClick={() => setTab(t.value)}
                >
                  {t.icon}
                  {t.label}
                  {t.value === "rooms" && rooms?.total ? (
                    <span className="text-muted-foreground tabular-nums">({count.format(rooms.total)})</span>
                  ) : null}
                </button>
              ))}
            </div>

            {tab === "profile" ? (
              <SchoolInfoSections
                record={school}
                // Chỉ ba số trường thật sự có: hệ thống chưa có bảng cán bộ nên `staff` để vắng — ô
                // "Cán bộ, GV" tự ẩn thay vì hiện một số 0 sai.
                scale={{
                  classes: school.classCount ?? 0,
                  students: school.studentCount ?? 0,
                  rooms: rooms?.total ?? 0,
                }}
              />
            ) : (
              <SchoolRooms schoolId={school.id} />
            )}
          </div>
        ) : null}
      </LoadingOverlay>
    </ShowView>
  );
};
