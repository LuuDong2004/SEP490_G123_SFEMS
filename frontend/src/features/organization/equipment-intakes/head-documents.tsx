import { useList } from "@refinedev/core";
import { Lock } from "lucide-react";
import { type CSSProperties, type ReactNode } from "react";
import { useWatch, type Control } from "react-hook-form";

import { formatPlainDate, localIsoDate, todayLocal } from "@/shared/lib/format";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";
import { SchoolField } from "@/features/organization/resources/school-field";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { DocumentFunding, hasDocumentHead } from "./document-fields";
import { IntakeOriginFields } from "./origin-field";
import { SectionHead } from "./section-head";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Thẻ "Thông tin phiếu" — những gì CHUNG cho cả đợt nhận (254, trưởng nhóm 14/11/2026): nguồn hình thành (kèm kế hoạch
 * mua sắm), ngày lập phiếu (tự động), năm học (theo ngày ghi tăng). Nhà cung cấp, hoá đơn, nguồn kinh phí, hình thức mua sắm và tệp
 * đi theo TỪNG hoá đơn ở khối "Hoá đơn và thiết bị".
 */
export function IntakeSourceCard({ control, record, chooseSchool, open, onToggle, summary }: {
  control: Control<any>;
  record?: any;
  /** Tài khoản phải chọn trường (Sở, UBND, quản trị) khi lập phiếu. */
  chooseSchool: boolean;
  /** Khối đang mở; thu gọn thì chỉ còn tên khối và `summary` (các ô vẫn giữ trên form, chỉ ẩn đi). */
  open: boolean;
  onToggle: () => void;
  summary: ReactNode;
}) {
  // Cùng truy vấn với `useDefaultSchoolYear` của form (cùng khoá) — không gọi thêm lần nào.
  const schoolYearId = useWatch({ control, name: "schoolYear.id" });
  const { result: yearList } = useList<any>({ resource: "school_years", pagination: { pageSize: 50 } });
  const schoolYearName: string | undefined = yearList?.data?.find((y: any) => String(y.id) === String(schoolYearId ?? ""))?.name
    ?? record?.schoolYear?.name;
  // Nguồn không có chứng từ (đơn vị tự làm, kiểm kê thừa…): nguồn kinh phí là ô duy nhất của "chứng từ" — đứng ngay hàng này.
  const originId = useWatch({ control, name: "originSource.id" });
  const { origins } = useOriginRules();
  const originCode = origins.find((o) => String(o.id) === String(originId ?? ""))?.code;
  const fundingHere = !!originCode && !hasDocumentHead(originCode);

  return (
    // Cột có TRẦN theo nội dung (tên nguồn dài nhất, ô ngày, "Năm học 2026-2027"): màn rộng thì phần thừa để trống bên
    // phải, ô không kéo dài ngoằng.
    <div style={{ "--head-cols": `minmax(0,17rem) 10rem minmax(0,13rem)${fundingHere ? " minmax(0,15rem)" : ""}` } as CSSProperties}>
      <div className={cn("px-5", open ? "space-y-4 pt-4 pb-6" : "py-4")}>
        <SectionHead title="Thông tin phiếu" open={open} onToggle={onToggle} summary={summary} />
        {/* Thu gọn chỉ ẨN các ô — gỡ ra thì luật kiểm của ô mất theo và phiếu lưu được khi đang sai. */}
        <div className={cn("grid items-start gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-(--head-cols)", !open && "hidden")}>
          {chooseSchool ? (
            <div className="empty:hidden sm:col-span-2 lg:col-span-3 lg:max-w-[calc(50%-0.5rem)]" data-field="school">
              <SchoolField control={control} record={record} hideWhenLocked wide required />
            </div>
          ) : null}
          <div className="min-w-0" id="intake-origin" data-field="originSource.id">
            <IntakeOriginFields control={control} record={record} />
          </div>
          {/* Ngày lập phiếu: hệ thống tự lấy lúc tạo phiếu và GIỮ NGUYÊN — lưu nháp, mấy hôm sau mở lại vẫn là ngày đó
              (trưởng nhóm 14/11/2026). Ngày ghi tăng là ngày DUYỆT; ngày nhận hàng của thiết bị là ngày hoá đơn. */}
          <div className="grid gap-2" data-field="createdAt">
            <Label>Ngày lập phiếu</Label>
            <div className="relative">
              <Input disabled value={formatPlainDate(record?.createdAt ? localIsoDate(new Date(record.createdAt)) : todayLocal())}
                aria-label="Ngày lập phiếu" className="pe-8 tabular-nums" />
              <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2" />
            </div>
          </div>
          {/* Năm học KHÔNG chọn được: năm học của ngày ghi tăng (máy chủ đặt lại lúc duyệt). */}
          <div className="grid gap-2" data-field="schoolYear">
            <Label>Năm học</Label>
            <div className="relative">
              <Input disabled value={schoolYearName ?? ""} placeholder="Theo ngày ghi tăng" aria-label="Năm học" className="pe-8" />
              <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2" />
            </div>
          </div>
          {fundingHere ? <DocumentFunding control={control} index={0} className="min-w-0" /> : null}
        </div>
      </div>
    </div>
  );
}
