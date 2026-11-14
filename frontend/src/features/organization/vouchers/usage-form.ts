import { isLessonPurpose, USAGE_PURPOSE_LABELS, usagePurposeText, type VoucherUsage } from "@/domains/voucher/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Phần không phải component của khối "mượn để làm gì" (QLTB-531): giá trị mặc định, chuyển bản ghi ↔ form ↔
 * payload, ô bắt buộc lúc trình, dòng cho màn xem. Ô nhập ở `usage-fields.tsx`.
 */

export const PURPOSE_OPTIONS = Object.entries(USAGE_PURPOSE_LABELS).map(([value, label]) => ({ value, label }));

export const USAGE_DEFAULTS = { purposeType: null, purposeNote: "", subject: { id: null }, lessonContent: "" };

export const usageToForm = (r: Partial<VoucherUsage>) => ({
  purposeType: r.purposeType ?? null,
  purposeNote: r.purposeNote ?? "",
  subject: { id: r.subject?.id ?? null },
  lessonContent: r.lessonContent ?? "",
});

/** Gửi đủ cả khối mỗi lần lưu — máy chủ hiểu ô vắng là bỏ trống. "Ghi rõ" chỉ đi kèm mục "Khác". */
export const usagePayload = (v: any) => ({
  purposeType: v.purposeType || null,
  purposeNote: v.purposeType === "OTHER" ? v.purposeNote || null : null,
  subject: v.subject?.id ? { id: v.subject.id } : null,
  lessonContent: v.lessonContent || null,
});

/** Ô bắt buộc lúc trình, cùng luật với `VoucherUsageRules` ở máy chủ. */
export const USAGE_REQUIRED = [
  { name: "purposeType", label: "Mục đích" },
  { name: "purposeNote", label: "Ghi rõ mục đích", when: (v: Record<string, unknown>) => v.purposeType === "OTHER" },
  { name: "subject", label: "Môn học", when: (v: Record<string, unknown>) => isLessonPurpose(v.purposeType) },
];

/** Ba dòng cho màn xem phiếu. */
export const usageFacts = (r?: Partial<VoucherUsage> | null) => [
  { label: "Mục đích", value: r ? usagePurposeText({ purposeType: r.purposeType ?? null, purposeNote: r.purposeNote ?? null }) : "—" },
  { label: "Môn học", value: r?.subject?.name ?? "—" },
  { label: "Nội dung bài dạy", value: r?.lessonContent ?? "—" },
];
