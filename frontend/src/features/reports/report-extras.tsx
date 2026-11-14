import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";

import { kyInstance } from "@/shared/api/data";
import { formatPlainDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { ReportColumnType } from "@/domains/report/types";
import { SESSION_LABELS } from "@/domains/voucher-ops/types";
import { usagePurposeText, type UsagePurpose } from "@/domains/voucher/types";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

const number = new Intl.NumberFormat("vi-VN");

export function format(value: string | number | null | undefined, type: ReportColumnType) {
  if (value == null || value === "") return "";
  if (type === "number" || type === "money") return number.format(Number(value));
  if (type === "date") return formatPlainDate(String(value));
  return String(value);
}

export const numeric = (t: ReportColumnType) => t === "number" || t === "money";

/**
 * Bộ lọc theo cột của từng báo cáo — lọc NGAY trên các dòng đã tải (không hỏi lại máy chủ), giá trị lấy từ chính
 * cột đó. Báo cáo không có ở đây thì không có ô lọc thêm. Xuất Excel vẫn ra đủ các dòng.
 */
export const REPORT_FILTERS: Record<string, { key: string; label: string }[]> = {
  // QLTB-544: môn, loại phòng, kết luận.
  "room-standard": [
    { key: "subject", label: "môn" },
    { key: "room_type", label: "loại phòng" },
    { key: "verdict", label: "kết luận" },
  ],
  // QLTB-549: khối nhà, loại phòng, môn (tháng / quý / năm học là ô chọn kỳ).
  "room-usage": [
    { key: "building", label: "khối nhà" },
    { key: "room_type", label: "loại phòng" },
    { key: "subject", label: "môn" },
  ],
};

/**
 * Bấm một dòng thì làm gì: mở hồ sơ tài sản / phiếu / phòng, hoặc xem các lượt mượn của phòng trong kỳ (QLTB-546).
 * Id đi kèm dòng dưới dạng khoá ẩn (không có trong `columns`, không ra Excel).
 */
export type RowAction =
  | { to: string; title: string }
  | { bookings: { id: number; name: string }; title: string }
  | { loans: { key: string; name: string }; title: string }
  | { standard: { id: number; name: string }; title: string };

export function rowAction(report: string, row: Record<string, any>): RowAction | null {
  if (report === "room-usage" && row.room_id != null)
    return { bookings: { id: Number(row.room_id), name: String(row.room ?? "") }, title: "Xem các lượt mượn trong kỳ" };
  // QLTB-597: một dòng "Thống kê mượn trả" mở các phiếu của nhóm đó trong kỳ.
  if (report === "loans" && row.group_key != null)
    return { loans: { key: String(row.group_key), name: String(row.name ?? "") }, title: "Xem các phiếu mượn trong kỳ" };
  // QLTB-649: một trường trên "Đánh giá mức độ chuẩn CSVC" mở bản đánh giá chi tiết của trường đó.
  if (report === "facility-standard" && row.school_id != null)
    return { standard: { id: Number(row.school_id), name: String(row.name ?? "") }, title: "Xem đánh giá chi tiết" };
  if (row.room_id != null) return { to: `/rooms/show/${row.room_id}`, title: "Mở hồ sơ phòng" };
  if (row.booking_id != null) return { to: `/room-bookings/show/${row.booking_id}`, title: "Mở phiếu mượn phòng" };
  if (row.equipment_id != null) return { to: `/equipment/show/${row.equipment_id}`, title: "Mở hồ sơ thiết bị" };
  if (row.loan_id != null) return { to: `/equipment-loans/show/${row.loan_id}`, title: "Mở phiếu mượn" };
  if (row.disposal_id != null) return { to: `/disposals/show/${row.disposal_id}`, title: "Mở phiếu ghi giảm" };
  return null;
}

/** Đường tới phiếu đã gây ra dòng lịch sử (báo cáo điều chuyển): `equipment_transfers` → `/equipment-transfers/show/1`. */
export function voucherLink(row: Record<string, any>): string | null {
  if (!row.voucher_resource || row.voucher_id == null) return null;
  return `/${String(row.voucher_resource).replaceAll("_", "-")}/show/${row.voucher_id}`;
}

type Booking = {
  id: number;
  code: string | null;
  status: string;
  bookingDate: string;
  bookingMode: "THEO_TIET" | "THEO_BUOI";
  periodFrom: number | null;
  periodTo: number | null;
  session: string | null;
  requester: { name: string } | null;
  subject: { name: string } | null;
  purposeType: UsagePurpose | null;
  purposeNote: string | null;
  lessonContent: string | null;
  roomCondition: "GOOD" | "ISSUE" | null;
  roomConditionNote: string | null;
};

const slot = (b: Booking) =>
  b.bookingMode === "THEO_BUOI"
    ? SESSION_LABELS[b.session ?? ""] ?? "—"
    : b.periodFrom == null ? "—" : b.periodTo && b.periodTo !== b.periodFrom ? `Tiết ${b.periodFrom}–${b.periodTo}` : `Tiết ${b.periodFrom}`;

/**
 * Lịch sử sử dụng MỘT phòng trong kỳ đang xem (QLTB-546): ngày, tiết / buổi, người mượn, môn, nội dung, mục đích,
 * tình trạng lúc trả. Đọc từ chính danh sách phiếu mượn phòng — cùng quyền, cùng phạm vi.
 */
export function RoomBookingsDialog({ room, from, to, onClose }: {
  room: { id: number; name: string };
  from?: string;
  to?: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["room_bookings", "by-room", room.id, from, to],
    queryFn: ({ signal }) => kyInstance.get("room_bookings", { signal, 
      searchParams: {
        "room.id": String(room.id),
        ...(from ? { bookingDate_gte: from } : {}),
        ...(to ? { bookingDate_lte: to } : {}),
        _start: "0", _end: "500", _sort: "bookingDate", _order: "desc",
      },
    }).json<Booking[]>(),
  });
  const rows = (data ?? []).filter((b) => !["DRAFT", "CANCELLED", "REJECTED"].includes(b.status));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="wide" className="flex flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4 pr-12">
          <DialogTitle>Lịch sử sử dụng · {room.name}</DialogTitle>
          <DialogDescription>
            {from && to ? `Từ ${formatPlainDate(from)} đến ${formatPlainDate(to)}` : "Mọi lượt mượn"} · {rows.length} lượt
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <Skeleton className="m-6 h-32" />
          ) : rows.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-14 text-sm">
              <Inbox className="size-8 opacity-50" />
              Phòng chưa có lượt mượn nào trong kỳ.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-surface-subtle sticky top-0 z-10">
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Tiết / buổi</TableHead>
                  <TableHead>Người mượn</TableHead>
                  <TableHead>Môn</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead>Mục đích</TableHead>
                  <TableHead>Tình trạng trả</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => (
                  <TableRow key={b.id} className={cn("group/row", LIFT_ROW)}>
                    <TableCell className="whitespace-nowrap">{formatPlainDate(b.bookingDate)}</TableCell>
                    <TableCell className="whitespace-nowrap">{slot(b)}</TableCell>
                    <TableCell>{b.requester?.name ?? "—"}</TableCell>
                    <TableCell>{b.subject?.name ?? "—"}</TableCell>
                    <TableCell className="max-w-56 truncate" title={b.lessonContent ?? undefined}>{b.lessonContent ?? "—"}</TableCell>
                    <TableCell>{b.purposeType ? usagePurposeText({ purposeType: b.purposeType, purposeNote: b.purposeNote }) : "—"}</TableCell>
                    <TableCell>
                      {b.roomCondition === "ISSUE" ? (
                        <span className="flex flex-col gap-0.5">
                          <Badge variant="warning" className="w-fit">Có vấn đề</Badge>
                          {b.roomConditionNote ? <span className="text-muted-foreground text-xs">{b.roomConditionNote}</span> : null}
                        </span>
                      ) : b.roomCondition === "GOOD" ? (
                        <Badge variant="success">Bình thường</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Chưa trả</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
