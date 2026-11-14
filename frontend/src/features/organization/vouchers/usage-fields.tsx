import { useOne } from "@refinedev/core";
import type { ReactNode } from "react";
import { type Control } from "react-hook-form";

import { RefField } from "@/shared/components/catalog/ref-field";
import { TextareaField } from "@/shared/components/form/simple-fields";
import { SelectNoteField } from "@/shared/components/form/choice-with-note";
import { PURPOSE_OPTIONS } from "./usage-form";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Ô nhập của khối "mượn để làm gì" (QLTB-531) — chung cho phiếu mượn phòng và phiếu mượn thiết bị. Mục đích và
 * môn là LỰA CHỌN để thống kê được (theo môn, tỷ lệ tiết thực hành); nội dung bài dạy là chữ tự do, không bắt
 * buộc. Môn học lọc theo cấp học của trường (trường THCS không chọn môn tiểu học). Đặt trong lưới `grid` của form.
 * Giá trị mặc định, payload, ô bắt buộc: `usage-form.ts`.
 */
export function UsageFields({ control, schoolId, record, beforeContent, contentClassName }: {
  control: Control<any>;
  schoolId?: number | null;
  record?: any;
  /** Ô chen trước "Nội dung bài dạy" (vd. ngày mượn, hẹn trả) để các ô ngắn nằm liền nhau, ô dài xuống cuối. */
  beforeContent?: ReactNode;
  /** Lớp thêm cho ô "Nội dung bài dạy" — form có lưới riêng chỉnh bề rộng ô (vd. phiếu mượn phòng). */
  contentClassName?: string;
}) {
  const { result: school } = useOne<any>({ resource: "schools", id: schoolId ?? "", queryOptions: { enabled: !!schoolId } });
  const levelId = school?.educationLevel?.id;
  const byLevel = levelId ? [{ field: "educationLevel.id", operator: "eq" as const, value: levelId }] : undefined;
  return (
    <>
      {/* "Khác" ghi rõ ngay trong ô Mục đích — không thêm ô "Ghi rõ mục đích". */}
      <SelectNoteField control={control} name="purposeType" noteName="purposeNote" otherValue="OTHER" label="Mục đích"
        options={PURPOSE_OPTIONS} placeholder="Vui lòng chọn mục đích" notePlaceholder="Mục đích khác, vd. thi học sinh giỏi" />
      <RefField control={control} name="subject" resource="subjects" label="Môn học" filters={byLevel}
        hint="Bắt buộc với tiết học"
        current={record?.subject} disabledHint={schoolId ? undefined : "Chọn trường trước"} />
      {beforeContent}
      <TextareaField control={control} name="lessonContent" label="Nội dung bài dạy" inGrid
        rule="LONG_TEXT" max={1000} className={contentClassName} />
    </>
  );
}
