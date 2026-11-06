import { useEffect } from "react";
import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { FormPanel, FormActions } from "@/shared/components/form/form-panel";
import { FormSection } from "@/shared/components/form/form-section";
import { MoneyInput } from "@/shared/components/form/money-input";
import { DateField, SelectField, TextField } from "@/shared/components/form/simple-fields";
import { CodeField, CodeSuggestion } from "./equipment-code";
import { CreateView, CreateViewHeader } from "@/shared/components/views/create-view";
import { EditView, EditViewHeader } from "@/shared/components/views/edit-view";
import { RecordNotFound, isRecordMissing } from "@/shared/components/views/record-not-found";
import { Button } from "@/shared/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { ASSET_CATEGORY_OPTIONS, FUNDING_SOURCE_OPTIONS, type Ref } from "@/domains/equipment-intake/types";
import {
  ASSET_STATUS_OPTIONS,
  CONDITION_OPTIONS,
  PHYSICAL_DIGITAL_OPTIONS,
  type AssetStatus,
  type Equipment,
  type EquipmentCondition,
  type EquipmentRef,
} from "@/domains/equipment/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Giá trị trên form. Ô chọn giữ `{ id, name }`; máy chủ chỉ cần `{ id }`. */
type RefValue = { id: number | null; name?: string | null };

const NO_REF: RefValue = { id: null };

type FormValues = {
  code: string;
  name: string;
  catalog: RefValue;
  physicalOrDigital: string;
  assetCategory: string;
  legacyCode: string;
  serialNumber: string;
  model: string;
  manufacturer: string;
  unit: RefValue;
  quantity: string;
  originSource: RefValue;
  acquisitionMethod: RefValue;
  fundingSource: string;
  originNote: string;
  fundingNote: string;
  acquisitionNote: string;
  productionYear: string;
  usageStartYear: string;
  receivedDate: string;
  purchaseDate: string;
  originalValue: number | null;
  warrantyExpiry: string;
  note: string;
  /** Chỉ màn sửa. */
  status: string;
  condition: string;
};

const DEFAULTS: FormValues = {
  code: "",
  name: "",
  catalog: NO_REF,
  physicalOrDigital: "PHYSICAL",
  assetCategory: "",
  legacyCode: "",
  serialNumber: "",
  model: "",
  manufacturer: "",
  unit: NO_REF,
  quantity: "1",
  originSource: NO_REF,
  acquisitionMethod: NO_REF,
  fundingSource: "",
  originNote: "",
  fundingNote: "",
  acquisitionNote: "",
  productionYear: "",
  usageStartYear: "",
  receivedDate: "",
  purchaseDate: "",
  originalValue: null,
  warrantyExpiry: "",
  note: "",
  status: "IN_USE",
  condition: "",
};

const refOf = (r: EquipmentRef | Ref | null | undefined): RefValue => (r ? { id: r.id, name: r.name } : NO_REF);
const idOf = (r: RefValue | null | undefined) => ({ id: r?.id ?? null });
const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));
const dateOrNull = (v: string) => (v ? v : null);

/** Từ bản ghi sang giá trị form. */
function toForm(r: Equipment): FormValues {
  return {
    code: r.code ?? "",
    name: r.name ?? "",
    catalog: refOf(r.catalog),
    physicalOrDigital: r.physicalOrDigital ?? "PHYSICAL",
    assetCategory: r.assetCategory ?? "",
    legacyCode: r.legacyCode ?? "",
    serialNumber: r.serialNumber ?? "",
    model: r.model ?? "",
    manufacturer: r.manufacturer ?? "",
    unit: refOf(r.unit),
    quantity: String(r.quantity ?? 1),
    originSource: refOf(r.originSource),
    acquisitionMethod: refOf(r.acquisitionMethod),
    fundingSource: r.fundingSource ?? "",
    originNote: r.originNote ?? "",
    fundingNote: r.fundingNote ?? "",
    acquisitionNote: r.acquisitionNote ?? "",
    productionYear: r.productionYear != null ? String(r.productionYear) : "",
    usageStartYear: r.usageStartYear != null ? String(r.usageStartYear) : "",
    receivedDate: r.receivedDate ?? "",
    purchaseDate: r.purchaseDate ?? "",
    originalValue: r.originalValue ?? null,
    warrantyExpiry: r.warrantyExpiry ?? "",
    note: r.note ?? "",
    status: r.status ?? "IN_USE",
    condition: r.condition ?? "",
  };
}

/**
 * Payload tạo: chuỗi rỗng là "không khai" (gửi null). Mã để trống là để máy cấp (TS-06); hiện chưa có,
 * nên form bắt buộc nhập mã.
 */
function toCreatePayload(v: FormValues) {
  return {
    code: v.code.trim(),
    name: v.name.trim(),
    note: v.note.trim() || null,
    catalog: idOf(v.catalog),
    physicalOrDigital: v.physicalOrDigital || null,
    assetCategory: v.assetCategory || null,
    legacyCode: v.legacyCode.trim() || null,
    serialNumber: v.serialNumber.trim() || null,
    model: v.model.trim() || null,
    manufacturer: v.manufacturer.trim() || null,
    unit: idOf(v.unit),
    quantity: numOrNull(v.quantity),
    originSource: idOf(v.originSource),
    acquisitionMethod: idOf(v.acquisitionMethod),
    fundingSource: v.fundingSource || null,
    originNote: v.originNote.trim() || null,
    fundingNote: v.fundingNote.trim() || null,
    acquisitionNote: v.acquisitionNote.trim() || null,
    productionYear: numOrNull(v.productionYear),
    usageStartYear: numOrNull(v.usageStartYear),
    receivedDate: dateOrNull(v.receivedDate),
    purchaseDate: dateOrNull(v.purchaseDate),
    originalValue: v.originalValue,
    warrantyExpiry: dateOrNull(v.warrantyExpiry),
  };
}

/**
 * Payload sửa (patch): trường để rỗng thì gửi chuỗi rỗng, máy chủ đọc thành xoá; ngày và số rỗng gửi
 * null nên giữ nguyên (chưa xoá được ngày/số qua form — ghi nhận là giới hạn).
 */
function toPatchPayload(v: FormValues) {
  return {
    ...toCreatePayload(v),
    code: v.code.trim() || undefined,
    legacyCode: v.legacyCode.trim(),
    serialNumber: v.serialNumber.trim(),
    model: v.model.trim(),
    manufacturer: v.manufacturer.trim(),
    originNote: v.originNote.trim(),
    fundingNote: v.fundingNote.trim(),
    acquisitionNote: v.acquisitionNote.trim(),
    note: v.note.trim(),
    status: (v.status || undefined) as AssetStatus | undefined,
    condition: (v.condition || undefined) as EquipmentCondition | undefined,
  };
}

/** Ô chọn một bản ghi danh mục. Giá trị giữ `{ id, name }`. */
function RefField({ control, name, label, resource, placeholder }: {
  control: any;
  name: string;
  label: string;
  resource: string;
  placeholder?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <AsyncCombobox<{ id: number; code?: string | null; name: string }>
              resource={resource}
              value={field.value?.id ?? null}
              fallbackLabel={field.value?.name}
              onChange={(id) => field.onChange(id == null ? NO_REF : { id })}
              onPick={(item) => field.onChange({ id: item.id, name: item.name })}
              labelOf={(item) => (item.code ? `${item.code} · ${item.name}` : item.name)}
              placeholder={placeholder ?? `Chọn ${label.toLowerCase()}`}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

const GRID = "grid items-start gap-5 @md:grid-cols-2 @3xl:grid-cols-3";

/** Phần khung form dùng chung cho tạo và sửa. */
function EquipmentFields({
  control,
  mode,
  recordId,
  onCodeChanged,
}: {
  control: any;
  mode: "create" | "edit";
  recordId?: number;
  onCodeChanged?: () => void;
}) {
  return (
    <>
      <FormSection title="Nhận diện" compact>
        <div className={GRID}>
          {mode === "create" ? (
            <CodeSuggestion control={control} />
          ) : (
            <CodeField control={control} recordId={recordId} onChanged={onCodeChanged ?? (() => {})} />
          )}
          <TextField control={control} name="name" label="Tên thiết bị" className="@3xl:col-span-2" />
          <RefField control={control} name="catalog" label="Danh mục thiết bị" resource="equipment_catalogs" />
          <SelectField control={control} name="physicalOrDigital" label="Loại" options={PHYSICAL_DIGITAL_OPTIONS} />
          <SelectField control={control} name="assetCategory" label="Phân loại tài sản" options={ASSET_CATEGORY_OPTIONS} placeholder="Chọn" />
          <TextField control={control} name="legacyCode" label="Mã cũ" />
          <TextField control={control} name="serialNumber" label="Số serial" />
          <TextField control={control} name="model" label="Model" />
          <TextField control={control} name="manufacturer" label="Hãng sản xuất" />
        </div>
      </FormSection>

      <FormSection title="Số lượng và nguồn gốc" compact>
        <div className={GRID}>
          <TextField control={control} name="quantity" label="Số lượng" type="number" step="0.001" />
          <RefField control={control} name="unit" label="Đơn vị tính" resource="units" />
          <RefField control={control} name="originSource" label="Nguồn hình thành" resource="origin_sources" />
          <RefField control={control} name="acquisitionMethod" label="Phương thức hình thành" resource="acquisition_methods" />
          <SelectField control={control} name="fundingSource" label="Nguồn kinh phí" options={FUNDING_SOURCE_OPTIONS} placeholder="Chọn" />
          <TextField control={control} name="originNote" label="Ghi chú nguồn hình thành" />
          <TextField control={control} name="fundingNote" label="Ghi chú nguồn kinh phí" />
          <TextField control={control} name="acquisitionNote" label="Ghi chú phương thức" />
        </div>
      </FormSection>

      <FormSection title="Ngày và giá trị" compact>
        <div className={GRID}>
          <TextField control={control} name="productionYear" label="Năm sản xuất" type="number" />
          <TextField control={control} name="usageStartYear" label="Năm đưa vào sử dụng" type="number" />
          <DateField control={control} name="receivedDate" label="Ngày tiếp nhận" />
          <DateField control={control} name="purchaseDate" label="Ngày mua" />
          <FormField
            control={control}
            name="originalValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nguyên giá (đồng)</FormLabel>
                <FormControl>
                  <MoneyInput value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DateField control={control} name="warrantyExpiry" label="Hết bảo hành" />
        </div>
      </FormSection>

      {mode === "edit" ? (
        <FormSection title="Trạng thái" compact>
          <div className={GRID}>
            <SelectField control={control} name="status" label="Trạng thái" options={ASSET_STATUS_OPTIONS} />
            <SelectField control={control} name="condition" label="Tình trạng" options={CONDITION_OPTIONS} placeholder="Chưa đánh giá" />
          </div>
          <p className="text-muted-foreground text-xs">
            Đổi trạng thái hoặc tình trạng sẽ được ghi vào lịch sử của thiết bị.
          </p>
        </FormSection>
      ) : null}

      <FormSection title="Ghi chú" compact>
        <TextField control={control} name="note" label="Ghi chú chung" />
      </FormSection>
    </>
  );
}

/** Tạo hồ sơ thiết bị thủ công (TS-01). Mã do máy cấp theo quy tắc của trường (TS-06). */
export const EquipmentCreate = () => {
  const navigate = useNavigate();
  const {
    refineCore: { onFinish },
    ...form
  } = useForm<FormValues>({
    refineCoreProps: {},
    defaultValues: DEFAULTS,
  });

  const onSubmit = (values: Record<string, unknown>) => onFinish(toCreatePayload(values as unknown as FormValues));

  return (
    <CreateView>
      <CreateViewHeader />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormPanel contentClassName="@container space-y-6">
            <EquipmentFields control={form.control} mode="create" />
            <FormActions>
              <Button type="submit">Lưu hồ sơ</Button>
              <Button type="button" variant="outline" onClick={() => navigate("/equipment")}>
                Huỷ
              </Button>
            </FormActions>
          </FormPanel>
        </form>
      </Form>
    </CreateView>
  );
};

/** Sửa hồ sơ thiết bị (TS-01). */
export const EquipmentEdit = () => {
  const navigate = useNavigate();
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm<FormValues>({
    refineCoreProps: {},
    defaultValues: DEFAULTS,
  });

  const record = query?.data?.data as Equipment | undefined;
  const { reset } = form;
  // Nạp bản ghi vào form một lần khi đã có dữ liệu. `keepDirtyValues` giữ phần người dùng đã sửa khi
  // dữ liệu được làm mới nền.
  useEffect(() => {
    if (!record) return;
    reset(toForm(record), { keepDirtyValues: true });
  }, [record, reset]);

  if (isRecordMissing(query)) {
    return (
      <EditView>
        <EditViewHeader />
        <RecordNotFound what="thiết bị" />
      </EditView>
    );
  }

  const onSubmit = (values: Record<string, unknown>) => onFinish(toPatchPayload(values as unknown as FormValues));

  return (
    <EditView>
      <EditViewHeader />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormPanel contentClassName="@container space-y-6">
            <EquipmentFields
              control={form.control}
              mode="edit"
              recordId={record?.id}
              onCodeChanged={() => query?.refetch?.()}
            />
            <FormActions>
              <Button type="submit">Lưu thay đổi</Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/equipment/show/${record?.id ?? ""}`)}>
                Huỷ
              </Button>
            </FormActions>
          </FormPanel>
        </form>
      </Form>
    </EditView>
  );
};
