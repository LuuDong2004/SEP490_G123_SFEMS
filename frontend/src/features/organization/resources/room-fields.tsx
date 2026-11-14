import type { Control } from "react-hook-form";

import { RefField } from "@/shared/components/catalog/ref-field";
import { FormSection } from "@/shared/components/form/form-section";
import { SelectField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { maxLengthOf, mergeRules, numberRules, textRules } from "@/shared/lib/field-rules";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import {
  CONDITION_OPTIONS,
  USAGE_STATUS_OPTIONS,
  type FacilityCondition,
  type Room,
  type RoomUsageStatus,
} from "@/domains/facility/room";
import { SchoolField } from "@/shared/components/form/school-field";
import { useSchoolNextCode } from "@/features/organization/resources/school-code";

/* eslint-disable @typescript-eslint/no-explicit-any -- control của form phòng là Control<any> */

/** Giá trị trên form. Ô chọn giữ `{ id }`; máy chủ chỉ cần id. */
export type RoomFormValues = {
  code: string;
  name: string;
  school: { id: number | null };
  roomType: { id: number | null };
  subject: { id: number | null };
  building: string;
  floor: string;
  location: string;
  area: number | null;
  capacity: number | null;
  condition: FacilityCondition | "";
  usageStatus: RoomUsageStatus | "";
  managingUnit: string;
  note: string;
};

const NO_REF = { id: null };

/** Phòng mới mặc định tốt và đang dùng — lập phòng là để dùng; khác thì đổi. */
export const ROOM_DEFAULTS: RoomFormValues = {
  code: "",
  name: "",
  school: NO_REF,
  roomType: NO_REF,
  subject: NO_REF,
  building: "",
  floor: "",
  location: "",
  area: null,
  capacity: null,
  condition: "TOT",
  usageStatus: "DANG_SU_DUNG",
  managingUnit: "",
  note: "",
};

/** Từ bản ghi sang giá trị form. */
export function roomToForm(r: Room): RoomFormValues {
  return {
    code: r.code ?? "",
    name: r.name ?? "",
    school: { id: r.school?.id ?? null },
    roomType: { id: r.roomType?.id ?? null },
    subject: { id: r.subject?.id ?? null },
    building: r.building ?? "",
    floor: r.floor ?? "",
    location: r.location ?? "",
    area: r.area ?? null,
    capacity: r.capacity ?? null,
    condition: r.condition ?? "",
    usageStatus: r.usageStatus ?? "",
    managingUnit: r.managingUnit ?? "",
    note: r.note ?? "",
  };
}

const txt = (value: string | null | undefined) => (value ?? "").trim();
const refOf = (id: number | null | undefined) => ({ id: id ?? null });

/**
 * Payload tạo. Mã để trống là để máy chủ cấp theo quy tắc mã của trường ({@code PH0001} mặc định); chuỗi
 * rỗng ở ô chữ là "không khai". Không gửi `active`: máy chủ suy nó từ tình trạng sử dụng.
 */
export function toRoomCreatePayload(v: RoomFormValues) {
  return {
    code: txt(v.code),
    name: txt(v.name),
    note: txt(v.note) || null,
    school: refOf(v.school?.id),
    roomType: refOf(v.roomType?.id),
    subject: refOf(v.subject?.id),
    building: txt(v.building) || null,
    floor: txt(v.floor) || null,
    location: txt(v.location) || null,
    area: v.area,
    capacity: v.capacity,
    condition: v.condition || null,
    usageStatus: v.usageStatus || null,
    managingUnit: txt(v.managingUnit) || null,
  };
}

/**
 * Payload sửa (patch): `null` là để nguyên, chuỗi rỗng là XOÁ giá trị đang có. Mã và tên không được rỗng
 * (`@Size(min = 1)`), nên để trống thì bỏ hẳn khoá thay vì gửi chuỗi rỗng. Diện tích và sức chứa chưa xoá
 * được qua form — ghi nhận là giới hạn của ngữ nghĩa patch.
 */
export function toRoomPatchPayload(v: RoomFormValues) {
  return {
    ...toRoomCreatePayload(v),
    code: txt(v.code) || undefined,
    name: txt(v.name) || undefined,
    building: txt(v.building),
    floor: txt(v.floor),
    location: txt(v.location),
    managingUnit: txt(v.managingUnit),
    note: txt(v.note),
  };
}

/** Diện tích: 0–1.000.000 m², tối đa hai số lẻ — cùng luật với `RoomRequest` của máy chủ. */
const AREA_RULES = {
  validate: (v: unknown) => {
    if (v == null || v === "") return true;
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) return "Diện tích không được âm";
    if (n > 1_000_000) return "Diện tích tối đa 1.000.000 m²";
    if ((String(n).split(".")[1] ?? "").length > 2) return "Diện tích tối đa hai chữ số thập phân";
    return true;
  },
};

/**
 * Các ô nhập của phòng, dùng chung cho màn thêm và màn sửa.
 *
 * <p>`record` chỉ có ở màn sửa, và nó ở đây vì ba lý do: ghép giá trị hiện tại của hai ô chọn vào danh sách
 * tuỳ chọn, khoá ô Trường (không đổi được trường sau khi tạo), và tắt gợi ý mã (mã đã có thì giữ).
 */
export function RoomFields({ control, record }: { control: Control<any>; record?: Room }) {
  // Mã kế tiếp theo quy tắc mã của trường (DM-04). Chỉ điền khi THÊM MỚI và đã chọn trường; lúc lưu máy
  // chủ cấp lại từ dữ liệu nên hai người thêm cùng lúc không nhận trùng mã.
  useSchoolNextCode("rooms", control, record);

  return (
    <div className="space-y-6">
      <FormSection title="Thông tin phòng" compact>
        <div className="form-flow">
          <SchoolField control={control} record={record} hideWhenFixed />
          <FormField
            control={control}
            name="code"
            rules={mergeRules(textRules("CODE", "Mã phòng"), {
              pattern: { value: /^$|^[A-Za-z0-9._-]+$/, message: "Mã phòng chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối" },
            })}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mã phòng</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Để trống: tự cấp"
                    maxLength={maxLengthOf("CODE", 64)}
                    className="font-mono"
                  />
                </FormControl>
                <p className="text-muted-foreground text-xs">Mã tự cấp theo quy tắc mã của trường; sửa lại được.</p>
                <FormMessage />
              </FormItem>
            )}
          />
          <TextField
            control={control}
            name="name"
            label="Tên phòng"
            placeholder="Phòng 101"
            rules={mergeRules(textRules("NAME", "Tên phòng"), { required: "Tên phòng là bắt buộc" })}
          />
          <RefField control={control} name="roomType" resource="room_types" label="Loại phòng" current={record?.roomType ?? undefined} />
          <RefField
            control={control}
            name="subject"
            resource="subjects"
            label="Môn (phòng bộ môn)"
            current={record?.subject ?? undefined}
            hint="Chỉ phòng học bộ môn mới gắn môn. Định mức tính theo phòng bộ môn đọc từ đây."
          />
          <SelectField control={control} name="condition" label="Hiện trạng" options={CONDITION_OPTIONS} placeholder="Chưa đánh giá" />
          <SelectField
            control={control}
            name="usageStatus"
            label="Tình trạng sử dụng"
            options={USAGE_STATUS_OPTIONS}
            placeholder="Chưa xác định"
            description='Ngừng sử dụng là phòng tự rời khỏi các ô chọn phòng.'
          />
        </div>
      </FormSection>

      <FormSection title="Vị trí" compact>
        <div className="form-flow">
          <TextField control={control} name="building" label="Khối nhà" placeholder="Dãy A" rules={textRules("SHORT_TEXT", "Khối nhà", { max: 100 })} />
          <TextField control={control} name="floor" label="Tầng" placeholder="Tầng 2" rules={textRules("SHORT_TEXT", "Tầng", { max: 50 })} />
          <TextField control={control} name="location" label="Vị trí" placeholder="Đầu dãy, cạnh cầu thang" rules={textRules("SHORT_TEXT", "Vị trí", { max: 255 })} />
          <TextField control={control} name="area" label="Diện tích (m²)" type="number" step="0.01" rules={AREA_RULES} />
        </div>
      </FormSection>

      <FormSection title="Sử dụng, quản lý" compact>
        <div className="form-flow">
          <TextField control={control} name="capacity" label="Sức chứa (người)" type="number" rules={numberRules("COUNT", "Sức chứa")} />
          <TextField
            control={control}
            name="managingUnit"
            label="Đơn vị quản lý"
            placeholder="Tổ Vật lí"
            rules={textRules("SHORT_TEXT", "Đơn vị quản lý", { max: 255 })}
          />
          <TextareaField control={control} name="note" label="Ghi chú" rows={1} rules={textRules("NOTE", "Ghi chú", { max: 500 })} inGrid />
        </div>
      </FormSection>
    </div>
  );
}
