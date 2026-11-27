import { useQuery } from "@tanstack/react-query";
import type { Control } from "react-hook-form";

import { kyInstance } from "@/shared/api/data";
import { formatDateTime } from "@/shared/lib/format";
import { FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";

import { LegalBasisPicker } from "./legal-doc-picker";

/**
 * Danh mục tối thiểu là danh sách PHẲNG (trưởng nhóm 17/11/2026): thêm / sửa / xoá trực tiếp, không phiên bản, không
 * ngày áp dụng; mọi thay đổi ghi vào nhật ký (`data_changes`: thêm, từng trường sửa, xoá — ai, lúc nào, cũ → mới).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const NORMS = "equipment_norms";

type Change = {
  id: number;
  createdAt: string;
  actorName: string | null;
  recordId: number;
  recordLabel: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

/** Tên trường trên nhật ký, theo chữ của màn hình. */
const FIELD_LABEL: Record<string, string> = {
  "(thêm)": "Thêm vào danh mục",
  "(xoá)": "Xoá khỏi danh mục",
  name: "Tên thiết bị",
  minQuantity: "Cần có",
  unit: "ĐVT",
  basisSize: "Số đối tượng",
  normBasis: "Đối tượng",
  gradeLevels: "Lớp",
  subject: "Môn",
  catalog: "Thiết bị trong danh mục",
  quantityText: "Số lượng (theo phụ lục)",
  topic: "Chủ đề",
  sectionName: "Nhóm",
  purpose: "Mục đích",
  description: "Mô tả",
  optional: "Tự chọn",
  forTeacher: "Giáo viên dùng",
  forStudent: "Học sinh dùng",
  sourceDocument: "Căn cứ",
  endDocument: "Căn cứ ngừng / xoá",
  effectiveFrom: "Áp dụng từ",
  effectiveTo: "Ngày thôi áp dụng",
  note: "Ghi chú",
  itemNo: "Số thứ tự",
  adjustKind: "Điều chỉnh",
  adjustQuantity: "Còn",
  adjustBasis: "Theo",
  adjustBasisSize: "Mỗi",
  adjustCondition: "Khi",
  adjustSubstituteCatalog: "Thay bằng thiết bị",
  adjustSubstituteText: "Thay bằng hình thức",
  adjustSubstituteRequired: "Đã có thứ thay thì không tính",
  adjustGroup: "Nhóm",
  adjustGroupPick: "Được chọn",
  adjustBasisText: "Câu căn cứ",
  adjustShared: "Dùng chung với",
};

const fieldLabel = (f: string) => FIELD_LABEL[f] ?? f;

/** Trường nội bộ — không hiện riêng. Căn cứ và ngày thôi áp dụng thì hiện: đó là lần "Ngừng áp dụng". */
const HIDDEN_FIELDS = new Set(["replaces"]);

/** Giá trị trên nhật ký đọc như chữ trên màn: ngày dd/mm/yyyy, có / không, mã nội bộ qua `format` của màn gọi. */
function valueText(field: string, v: string | null, format?: (field: string, v: string) => string | undefined): string {
  if (v === null || v === "") return "trống";
  const custom = format?.(field, v);
  if (custom) return custom;
  if (v === "true") return "Có";
  if (v === "false") return "Không";
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (day) return `${day[3]}/${day[2]}/${day[1]}`;
  return v;
}

const changeText = (c: Change, format?: (field: string, v: string) => string | undefined) =>
  c.field === "(thêm)" || c.field === "(xoá)" ? ""
    : `${valueText(c.field, c.oldValue, format)} → ${valueText(c.field, c.newValue, format)}`;

/**
 * Nhật ký một dòng — đặt trong ngăn chi tiết, cùng kiểu mốc (chấm + chữ + dòng phụ) với "Có từ TT …". Các trường sửa
 * trong CÙNG một lần lưu gộp thành một mốc: "Sửa Cần có, ĐVT" rồi từng dòng cũ → mới.
 */
export function NormChangeLog({ id, format }: { id: number; format?: (field: string, v: string) => string | undefined }) {
  const { data, isLoading } = useQuery({
    queryKey: [NORMS, id, "changes"],
    queryFn: () => kyInstance.get(`${NORMS}/${id}/changes`).json<Change[]>(),
  });
  if (isLoading || !data) return null;
  const groups: { key: string; at: string; who: string; items: Change[] }[] = [];
  for (const c of data.filter((x) => !HIDDEN_FIELDS.has(x.field))) {
    const key = `${c.createdAt.slice(0, 19)}|${c.actorName ?? ""}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(c);
    else groups.push({ key, at: c.createdAt, who: c.actorName ?? "không rõ người sửa", items: [c] });
  }
  return (
    <>
      {groups.map((g) => {
        const kind = g.items.find((c) => c.field === "(thêm)" || c.field === "(xoá)");
        const edits = g.items.filter((c) => c !== kind);
        const title = kind ? fieldLabel(kind.field) : `Sửa ${edits.map((c) => fieldLabel(c.field).toLowerCase()).join(", ")}`;
        return (
          <div key={g.key} className="flex gap-2">
            <i className={kind?.field === "(xoá)" ? "bg-destructive mt-1.5 size-2 shrink-0 rounded-full"
              : kind ? "bg-success mt-1.5 size-2 shrink-0 rounded-full" : "bg-warning mt-1.5 size-2 shrink-0 rounded-full"} />
            <div className="min-w-0">
              <div>{title}</div>
              {!kind && edits.length ? (
                <ul className="text-foreground/80 mt-0.5">
                  {edits.map((c) => (
                    <li key={c.id} className="break-words">
                      {edits.length > 1 ? <span className="text-muted-foreground">{fieldLabel(c.field)}: </span> : null}
                      {changeText(c, format)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="text-muted-foreground">{formatDateTime(g.at)} · {g.who}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Ô "Văn bản căn cứ" của form thêm / sửa (khoá `legalDocument`). */
export function LegalBasisField({ control, block }: { control: Control<any>; block?: boolean }) {
  return (
    <FormField
      control={control}
      name="legalDocument.id"
      rules={{ required: "Vui lòng chọn văn bản căn cứ" }}
      render={({ field, fieldState }) => (
        <FormItem className={block ? "min-w-0 grid-cols-[minmax(0,1fr)]" : undefined}>
          <FormLabel>Văn bản căn cứ</FormLabel>
          <LegalBasisPicker value={field.value ?? null} onChange={field.onChange} invalid={!!fieldState.error} block={block} />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
