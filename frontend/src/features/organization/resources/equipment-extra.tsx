import { canWriteRecord } from "@/shared/lib/can-write";
import { ASSET_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { FormHint } from "@/shared/components/form/help-hint";
import { LengthCounter } from "@/shared/components/form/simple-fields";
import { useCan, useCustom, useInvalidate, useList, useNotification, useOne } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import { ArchiveRestore, BadgeCheck, Lock, PackagePlus, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";
import { EquipmentDetail, EquipmentEditBelow, EquipmentStats } from "./equipment-detail";
import { EquipmentPhoto } from "./equipment-photo";
import { ExpiryValue } from "./expiry";
import { RoomPickerField } from "./room-picker";
import { FundingSelect } from "@/shared/components/form/funding-select";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { UsageTiles } from "./usage-tiles";
import { Card, CardContent } from "@/shared/ui/card";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";
import { EquipmentMoreMenu } from "./equipment-history";
import { EquipmentAside } from "./equipment-aside";
import { OpeningBalanceButton, useOpeningBalance } from "./opening-balance";
import { OFF_BOOK_STATUSES } from "@/domains/equipment/types";

import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { DateInput } from "@/shared/components/form/date-input";
import { Switch } from "@/shared/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { customResult } from "@/shared/hooks/use-custom-result";
import { API_URL } from "@/shared/api/constants";
import { getAuthorities } from "@/shared/api/session";
import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { Button } from "@/shared/ui/button";
import { formatPlainDate } from "@/shared/lib/format";
import {
  dateRules,
  maxLengthOf,
  mergeRules,
  numberRules,
  textRules,
  type DateRule,
  type NumberRule,
  type TextRule,
} from "@/shared/lib/field-rules";
import { RefField, type RefValue } from "@/shared/components/catalog/ref-field";
import { SchoolField, schoolColumn } from "@/features/organization/resources/school-field";
import { EquipmentSummary } from "./equipment-summary";
import { EquipmentItems } from "./equipment-items";

type ListViewCtx = {
  filters: import("@refinedev/core").CrudFilter[];
  drill: (filters: import("@refinedev/core").CrudFilter[], label: string) => void;
};
import { PHYSICAL_TYPE_LABELS, EQUIPMENT_CONDITION_LABELS, ASSET_STATUS_LABELS, ASSET_CATEGORY_LABELS, FUNDING_LABELS, fundingAllowed } from "@/domains/equipment/types";

/* eslint-disable @typescript-eslint/no-explicit-any */







const NONE = "__none__";

const money = new Intl.NumberFormat("vi-VN");

function EnumSelect({
  control,
  name,
  label,
  options,
  hint,
}: {
  control: Control<any>;
  name: string;
  label: string;
  options: Record<string, string>;
  hint?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {hint ? <FormHint>{hint}</FormHint> : null}
          <Select
            onValueChange={(v) => {
              // Radix bắn `""` lúc màn sửa nạp bản ghi — bỏ qua, nếu không giá trị bị xoá và lưu ra 400.
              if (v === "") return;
              field.onChange(v === NONE ? null : v);
            }}
            value={field.value ?? ""}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Vui lòng chọn ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {Object.entries(options).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      )}
    />
  );
}

function Field({
  control,
  name,
  label,
  type = "text",
  placeholder,
  rules,
  hint,
  rule,
  max,
  min,
  upper,
  numberRule,
  dateRule = "ANY",
}: {
  control: Control<any>;
  name: string;
  label: string;
  type?: "text" | "number" | "date";
  placeholder?: string;
  rules?: any;
  hint?: string;
  /** Kiểu chuẩn (`shared/lib/field-rules`) — cùng trần, cùng câu báo lỗi với máy chủ. */
  rule?: TextRule;
  max?: number;
  /** Độ dài tối thiểu khi có khai (cùng `min` của `@Text` ở máy chủ). */
  min?: number;
  /** Số serial: bỏ khoảng trắng, viết HOA ngay khi gõ — như máy chủ lưu. */
  upper?: boolean;
  numberRule?: NumberRule;
  /** Ô ngày: `PAST_OR_TODAY` cho việc đã xảy ra. */
  dateRule?: DateRule;
}) {
  const base = type === "date" ? dateRules(dateRule, label)
    : rule ? textRules(rule, label, { max, min })
      : numberRule ? numberRules(numberRule, label) : undefined;
  return (
    <FormField
      control={control}
      name={name}
      rules={mergeRules(base, rules)}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {hint ? <FormHint>{hint}</FormHint> : null}
          <FormControl>
            {type === "date" ? (
              <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
            ) : (
              <Input
                type={type}
                step={type === "number" ? "any" : undefined}
                value={field.value ?? ""}
                onChange={(e) => {
                  const v = upper ? e.target.value.replace(/\s+/g, "").toUpperCase() : e.target.value;
                  field.onChange(type === "number" ? (v === "" ? null : Number(v)) : v);
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                placeholder={placeholder}
                maxLength={rule ? maxLengthOf(rule, max) : undefined}
              />
            )}
          </FormControl>
          {rule && type === "text" ? <LengthCounter value={field.value} max={maxLengthOf(rule, max)} /> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-muted-foreground pt-2 text-xs font-semibold tracking-wide uppercase">{children}</h4>;
}

/**
 * Mã gợi ý theo chuẩn TT.TR.MH.LT.ST.NC — gọi lại mỗi khi mặt hàng, loại,
 * trường hay ngày tiếp nhận/mua đổi. Chỉ ghi đè ô Mã khi ô đang trống hoặc vẫn
 * là gợi ý CŨ: người dùng đã tự gõ thì để nguyên.
 */
function CodeSuggestion({ control }: { control: Control<any> }) {
  const { setValue, getValues } = useFormContext();
  const [catalogId, schoolId, type, received, purchased] = useWatch({
    control,
    name: ["catalog.id", "school.id", "physicalOrDigital", "receivedDate", "purchaseDate"],
  });
  const query: Record<string, string> = {};
  if (catalogId) query.catalogId = String(catalogId);
  if (schoolId) query.schoolId = String(schoolId);
  if (type) query.physicalOrDigital = type;
  if (received) query.receivedDate = received;
  if (purchased) query.purchaseDate = purchased;

  const { result } = useCustom<{ code: string | null; reason: string | null }>({
    url: `${API_URL}/equipment/next-code`,
    method: "get",
    config: { query },
    queryOptions: { enabled: !!catalogId, staleTime: 0, gcTime: 0 },
  });
  const data = customResult(result?.data, "code");
  const suggested = data?.code ?? null;
  const last = useRef<string | null>(null);

  useEffect(() => {
    // Ô mã chỉ đọc: luôn là mã hệ thống sẽ cấp. Máy chủ chốt số lúc lưu (có thể ra số
    // kế tiếp nếu vừa có người lưu trước).
    if (suggested && suggested !== last.current) {
      setValue("code", suggested, { shouldDirty: true });
    } else if (!suggested && getValues("code") === last.current) {
      setValue("code", "", { shouldDirty: true });
    }
    last.current = suggested;
  }, [suggested, getValues, setValue]);

  if (!catalogId) {
    return <p className="text-muted-foreground text-xs">Chọn thiết bị trong danh mục để được cấp mã.</p>;
  }
  return suggested ? (
    <p className="text-muted-foreground flex items-center gap-1 text-xs">
      <Sparkles className="size-3" />
      Mã sẽ cấp: <span className="text-foreground font-mono font-medium">{suggested}</span>
    </p>
  ) : data?.reason ? (
    <p className="text-warning-text text-xs">
      Chưa cấp được mã chuẩn: {data.reason}. Bổ sung ở danh mục rồi quay lại, vì không lưu được với mã tự đặt.
    </p>
  ) : null;
}

/** Các ô thông số kỹ thuật theo bộ đã chọn, lưu vào `specs.<mã>`. */
function SpecsFields({ control, className = "form-flow" }: { control: Control<any>; className?: string }) {
  const configId = useWatch({ control, name: "config.id" });
  const { result } = useOne<any>({
    resource: "equipment_configs",
    id: configId ?? "",
    queryOptions: { enabled: !!configId },
  });
  const attrs: any[] = configId ? (result?.attributes ?? []) : [];
  if (!configId) return null;
  if (attrs.length === 0) {
    return <p className="text-muted-foreground text-sm">Bộ thông số này chưa có thông số nào.</p>;
  }
  return (
    <div className={className}>
      {attrs.map((a) => (
        <FormField
          key={a.code}
          control={control}
          name={`specs.${a.code}`}
          rules={a.required ? { required: `Nhập ${a.name.toLowerCase()}` } : undefined}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {a.name}
                {a.measureUnit ? <span className="text-muted-foreground font-normal"> ({a.measureUnit})</span> : null}
              </FormLabel>
              {a.dataType === "boolean" ? (
                <FormControl>
                  <Switch
                    checked={field.value === "true"}
                    onCheckedChange={(c) => field.onChange(c ? "true" : "false")}
                  />
                </FormControl>
              ) : a.dataType === "enum" ? (
                <Select onValueChange={(v) => field.onChange(v === NONE ? "" : v)} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(a.options ?? []).map((o: string) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : a.dataType === "date" ? (
                <FormControl>
                  <DateInput value={field.value || null} onChange={(v) => field.onChange(v ?? "")} onBlur={field.onBlur} name={field.name} />
                </FormControl>
              ) : (
                <FormControl>
                  <Input
                    type={a.dataType === "text" ? "text" : "number"}
                    step={a.dataType === "decimal" ? "any" : undefined}
                    placeholder={a.dataType === "text" ? "Nhập giá trị" : "Nhập số"}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </div>
  );
}

function SameSchoolRef({
  control,
  record,
  name,
  resource,
  label,
  current,
  hideLabel,
  hint,
}: {
  control: Control<any>;
  record?: any;
  name: string;
  resource: string;
  label: string;
  current?: RefValue;
  hideLabel?: boolean;
  hint?: string;
}) {
  const chosen = useWatch({ control, name: "school.id" });
  const schoolId = record?.school?.id ?? chosen;
  return (
    <RefField
      control={control}
      name={name}
      resource={resource}
      label={label}
      current={current}
      hideLabel={hideLabel}
      hint={hint}
      filters={schoolId ? [{ field: "school.id", operator: "eq", value: schoolId }] : undefined}
    />
  );
}

/**
 * Ô "Bộ thông số" nửa hàng. Danh mục bộ thông số trống (Sở chưa khai) thì không bày một ô
 * chọn rỗng: nói rõ là chưa có, và ai khai báo được thì có lối tới danh mục. Trường không tạo
 * bộ thông số — đó là danh mục dùng chung của Sở.
 */
function ConfigField({ control, current }: { control: Control<any>; current?: RefValue }) {
  const { result } = useList({ resource: "equipment_configs", pagination: { currentPage: 1, pageSize: 1 },
    filters: [{ field: "active", operator: "eq", value: true }] });
  const canCreate = useCan({ resource: "equipment_configs", action: "create" }).data?.can ?? false;
  if (result?.total === 0 && !current) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Bộ thông số</p>
        <p className="text-muted-foreground bg-muted/40 rounded-md border border-dashed px-3 py-2 text-xs">
          Chưa có bộ thông số nào.{" "}
          {canCreate ? (
            <Link to="/equipment-configs/create" className="text-primary font-medium hover:underline">Khai báo bộ thông số</Link>
          ) : (
            "Do Sở khai báo ở Danh mục dùng chung."
          )}
        </p>
      </div>
    );
  }
  return <RefField control={control} name="config" resource="equipment_configs" label="Bộ thông số" current={current} />;
}

/** Ô chọn phòng ở trang thêm mới: trường là trường đang chọn trên form. */
function CreateRoomPicker({ control }: { control: Control<any> }) {
  const schoolId = useWatch({ control, name: "school.id" });
  return <RoomPickerField control={control} name="room" label="Vị trí hiện tại" schoolId={schoolId} />;
}

/** Cấp mã chuẩn thay mã cũ; mã cũ giữ lại để tra tem cũ. */
function StandardCodeButton({ id }: { id: number }) {
  const invalidate = useInvalidate();
  const { open: notify } = useNotification();
  const [busy, setBusy] = useState(false);
  return (
    <Button type="button" size="sm" variant="outline" disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await kyInstance.post(`equipment/${id}/standard-code`).json<{ code: string }>();
          notify?.({ type: "success", message: `Đã cấp mã chuẩn ${res.code}` });
          invalidate({ resource: "equipment", invalidates: ["list", "detail"], id });
        } catch (error) {
          notify?.({ type: "error", message: await errorMessage(error) });
        } finally {
          setBusy(false);
        }
      }}>
      <BadgeCheck />
      Cấp mã chuẩn
    </Button>
  );
}

type FieldPart = "all" | "classify" | "origin" | "tech" | "usage";

/**
 * Ba ô NGUỒN của hồ sơ, đi với nhau theo đúng luật của phiếu ghi tăng (`useOriginRules`): nguồn hình
 * thành quyết định nguồn kinh phí nào chọn được, và chỉ hàng mua mới có hình thức mua sắm. Đổi nguồn
 * hình thành thì nguồn kinh phí không còn hợp lệ được gỡ ngay — máy chủ cũng từ chối cặp đó.
 */
function SourceFields({ control, record }: { control: Control<any>; record?: any }) {
  const { setValue, getValues } = useFormContext();
  const originId = useWatch({ control, name: "originSource.id" });
  const { ruleOf } = useOriginRules();
  const rule = ruleOf(originId);
  const last = useRef<unknown>(originId);
  useEffect(() => {
    if (last.current === originId) return;
    last.current = originId;
    if (!rule) return;
    if (!fundingAllowed(rule, getValues("fundingSource"))) setValue("fundingSource", null, { shouldDirty: true });
    if (!rule.acquisitionMethod) setValue("acquisitionMethod", { id: null }, { shouldDirty: true });
  }, [originId, rule, getValues, setValue]);
  return (
    <>
      {record?.originSource ? <LockedValue label="Nguồn hình thành" value={record.originSource.name} why={keptWhy(record)} />
        : <RefField control={control} name="originSource" resource="origin_sources" label="Nguồn hình thành" current={record?.originSource} />}
      {record?.acquisitionMethod ? <LockedValue label="Hình thức mua sắm" value={record.acquisitionMethod.name} why={keptWhy(record)} />
        : !rule || rule.acquisitionMethod ? (
        <RefField control={control} name="acquisitionMethod" resource="acquisition_methods" label="Hình thức mua sắm" current={record?.acquisitionMethod} />
      ) : null}
      {record?.fundingSource ? (
        <LockedValue label="Nguồn kinh phí" value={FUNDING_LABELS[record.fundingSource as keyof typeof FUNDING_LABELS] ?? record.fundingSource} why={keptWhy(record)} />
      ) : <FormField
        control={control}
        name="fundingSource"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nguồn kinh phí</FormLabel>
            <FormHint>
              {rule
                ? `Bắt buộc. Chỉ chọn được nguồn đi với nguồn hình thành "${rule.name}".`
                : "Bắt buộc. Thiếu thì thiết bị không đưa vào phiếu được."}
            </FormHint>
            <FundingSelect value={field.value} onChange={field.onChange} allowed={rule?.fundingSources} />
            <FormMessage />
          </FormItem>
        )}
      />}
    </>
  );
}

/**
 * Ô đã khoá trên form sửa: cùng hình ô Mã thiết bị (nền xám, ổ khoá); vì sao khoá hiện khi rê chuột. Dùng cho thông tin sổ
 * sách đã khai / theo phiếu — máy chủ cũng chặn (`EquipmentService.requireRecordFieldsKept`).
 */
function LockedValue({ label, value, why, note }: { label: string; value: React.ReactNode; why: string; note?: string }) {
  return (
    <div data-slot="form-item" className="grid gap-2">
      <span data-slot="form-label" className="flex items-center gap-2 text-sm font-medium">{label}</span>
      <div data-locked className="bg-muted/60 text-muted-foreground flex h-9 items-center justify-between gap-2 rounded-md border px-3" title={why}>
        <span className="text-foreground truncate text-sm">{value}</span>
        <Lock className="size-3.5 shrink-0" />
      </div>
      {note ? <p data-slot="form-description" className="text-muted-foreground text-xs">{note}</p> : null}
    </div>
  );
}

/** Lý do khoá thông tin sổ sách của một hồ sơ: theo phiếu ghi tăng nào, hay đã khai từ trước. */
const keptWhy = (record: any) => (record?.intake?.code ? `Theo phiếu ${record.intake.code}.` : "Đã khai, không sửa.");

/** Ô xếp một cột trong ba cột của form — cùng ba cột "Phân loại / Nguồn gốc và giá trị / Kỹ thuật, bảo hành" của hồ sơ. */
const STACK = "grid grid-cols-1 items-start gap-y-5 sm:grid-cols-2 sm:gap-x-4 xl:grid-cols-1";

/** Số serial, model, hãng — nhóm "Kỹ thuật, bảo hành". */
function TechIdentity({ control }: { control: Control<any> }) {
  return (
    <>
      <Field control={control} name="serialNumber" label="Số serial" rule="SERIAL" min={3} upper
        hint="Số của nhà sản xuất in trên thiết bị, nếu có: 3–50 ký tự, tự viết hoa, bỏ khoảng trắng. Không trùng với thiết bị khác của trường." />
      <Field control={control} name="model" label="Model" hint="Mẫu của cái / lô này — khác nhau giữa các lần mua." rule="SHORT_TEXT" max={50} />
      <Field control={control} name="manufacturer" label="Hãng sản xuất" rule="SHORT_TEXT" max={100} />
    </>
  );
}

/** Năm sản xuất, hết hạn bảo hành, hạn sử dụng (lô vật tư) — nhóm "Kỹ thuật, bảo hành". */
function TechDates({ control, consumable }: { control: Control<any>; consumable: boolean }) {
  // Cùng luật với máy chủ (`EquipmentService.requireDatesConsistent`). Ngày là chuỗi yyyy-MM-dd nên so chuỗi được.
  const { getValues } = useFormContext();
  const vn = (d: string) => d.split("-").reverse().join("/");
  return (
    <>
      <Field control={control} name="productionYear" label="Năm sản xuất" type="number" numberRule="YEAR"
        rules={{ validate: { notAfterUse: (v: number | null) => {
          const use = getValues("usageStartYear");
          return v == null || use == null || v <= use || `Năm sản xuất không được sau năm đưa vào sử dụng (${use})`;
        } } }} />
      <Field control={control} name="warrantyExpiry" label="Hết hạn bảo hành" type="date"
        rules={{ validate: { afterPurchase: (v: string | null) => {
          const bought: string | null = getValues("purchaseDate") || getValues("receivedDate") || null;
          return !v || !bought || v > bought
            || `Hết hạn bảo hành phải sau ${getValues("purchaseDate") ? "ngày mua" : "ngày tiếp nhận"} (${vn(bought)})`;
        } } }} />
      {consumable ? <Field control={control} name="expiryDate" label="Hạn sử dụng" type="date" hint="Của lô vật tư, hoá chất. Còn dưới 30 ngày thì màn Thiết bị báo sắp hết hạn."
        rules={{ validate: { afterReceived: (v: string | null) => {
          const received: string | null = getValues("receivedDate") || null;
          return !v || !received || v > received || `Hạn sử dụng phải sau ngày tiếp nhận (${vn(received)})`;
        } } }} /> : null}
    </>
  );
}

function EquipmentFields({ control, record, part = "all" }: { control: Control<any>; record?: any; part?: FieldPart }) {
  const show = (p: FieldPart) => part === "all" || part === p;
  const heading = (t: string) => (part === "all" ? <SubHeading>{t}</SubHeading> : null);
  // Trong ba cột của form (cùng ba cột của hồ sơ): ô xếp một cột, rộng bằng cột. Form gộp ("all"): ô nối tiếp.
  const flow = part === "all" ? "form-flow" : STACK;
  const { setValue, getValues } = useFormContext();
  // Các bộ thông số — để chọn sẵn bộ MẶC ĐỊNH của loại thiết bị khi chọn nhóm.
  const { result: configs } = useList<any>({
    resource: "equipment_configs",
    pagination: { pageSize: 200 },
    filters: [{ field: "active", operator: "eq", value: true }],
  });

  /**
   * Chọn mặt hàng thì điền sẵn những gì danh mục đã biết.
   *
   * <p>Hai mức, và sự khác nhau là cố ý. Tên, đơn vị tính và bộ thông số chỉ
   * điền vào ô CÒN TRỐNG — chúng là thứ người nhập có lý do chính đáng để sửa
   * cho riêng cái tài sản này ("Máy chiếu Epson EB-X51" thay cho "Máy chiếu đa
   * năng"), nên đè lên là xoá công người ta vừa gõ.
   *
   * <p>Loại tài sản và vật lý/số thì ĐÈ, vì chúng không phải tính chất của
   * từng cái mà của mặt hàng: đổi nhóm nghĩa là đổi hẳn thứ đang khai, và giữ
   * lại "TSCĐ" của nhóm trước là cách hồ sơ ghi sai một cách im lặng. Nhóm nào
   * chưa khai (giá trị rỗng) thì không đụng tới, để người nhập tự chọn như cũ.
   */
  const onCatalogPicked = (cat: any) => {
    if (!getValues("name") && cat?.name) setValue("name", cat.name, { shouldDirty: true });
    if (!getValues("unit.id") && cat?.unit?.id) setValue("unit.id", cat.unit.id, { shouldDirty: true });
    if (cat?.assetCategory) setValue("assetCategory", cat.assetCategory, { shouldDirty: true });
    if (cat?.physicalOrDigital) setValue("physicalOrDigital", cat.physicalOrDigital, { shouldDirty: true });
    if (!getValues("config.id")) {
      const typeId = cat?.equipmentType?.id;
      const def = (configs?.data ?? []).find(
        (c: any) =>
          c.defaultConfig &&
          ((c.scopeTypes ?? []).length === 0 || (typeId && c.scopeTypes.some((t: any) => t.id === typeId))),
      );
      if (def) setValue("config.id", def.id, { shouldDirty: true });
    }
  };

  const assetCategory = useWatch({ control, name: "assetCategory" });
  const consumable = assetCategory === "SUPPLY" || assetCategory === "CHEMICAL";
  const physical = useWatch({ control, name: "physicalOrDigital" });
  return (
    <>
      {part === "all" ? <SchoolField control={control} record={record} /> : null}

      {show("classify") ? (<>
      {heading("Phân loại")}
      <div className={flow}>
        {record?.intake && record?.catalog ? (
          <LockedValue label="DM thiết bị" value={record.catalog.name} why={`${keptWhy(record)} Tên đổi được, thiết bị trong danh mục thì giữ nguyên.`} />
        ) : (
          <RefField control={control} name="catalog" resource="equipment_catalogs" label="DM thiết bị" current={record?.catalog} required
            hint="Thiết bị trong danh mục. Đổi thiết bị thì Loại và Phân loại kế toán đổi theo." onPicked={onCatalogPicked} />
        )}
        {record?.physicalOrDigital ? (
          <LockedValue label="Dạng thiết bị" value={PHYSICAL_TYPE_LABELS[physical as keyof typeof PHYSICAL_TYPE_LABELS] ?? physical} why="Theo thiết bị trong danh mục." />
        ) : (
          <EnumSelect control={control} name="physicalOrDigital" label="Dạng thiết bị" options={PHYSICAL_TYPE_LABELS}
            hint="Thiết bị, phần mềm hay học liệu. Tự lấy theo thiết bị trong danh mục." />
        )}
        {record?.assetCategory ? (
          <LockedValue label="Phân loại kế toán" value={ASSET_CATEGORY_LABELS[assetCategory as keyof typeof ASSET_CATEGORY_LABELS] ?? assetCategory} why="Theo thiết bị trong danh mục." />
        ) : (
          <EnumSelect control={control} name="assetCategory" label="Phân loại kế toán" options={ASSET_CATEGORY_LABELS}
            hint="Tài sản cố định, công cụ dụng cụ, vật tư hay hoá chất. Tự lấy theo thiết bị trong danh mục." />
        )}
        {part === "all" ? <TechIdentity control={control} /> : null}
        {record?.unit ? (
          <LockedValue label="Đơn vị tính" value={record.unit.name} why={keptWhy(record)} />
        ) : (
          <RefField control={control} name="unit" resource="units" label="Đơn vị tính" current={record?.unit}
            hint="Thiếu thì thiết bị không đưa vào phiếu được." />
        )}
        {record ? (
          // Số lượng do phiếu quản (nhập, xuất kho, ghi tiêu hao) — chỉ xem trên hồ sơ.
          <LockedValue label="Số lượng" value={`${record.quantity ?? 1}${record.unit?.name ? ` ${record.unit.name}` : ""}`}
            why="Chỉ đổi qua phiếu ghi tăng, xuất kho, ghi tiêu hao." />
        ) : (
          <Field control={control} name="quantity" label="Số lượng" type="number"
            hint="Thiết bị quản lý từng cái thì để 1. Vật tư tiêu hao thì ghi số lượng của cả lô." numberRule="DECIMAL_QUANTITY"
            rules={{ min: { value: 1, message: "Tối thiểu 1" } }} />
        )}
      </div>
      {/* Câu này nói về ô Thiết bị ngay trên nó, nên nó phải đứng ở đây.
          Đặt dưới ô Trường thì đọc thành mô tả của ô Trường — và người dùng đi
          tìm "thiết bị" trong danh sách trường. */}
      {record ? null : <CodeSuggestion control={control} />}
      </>) : null}

      {show("origin") ? (<>
      {heading("Nguồn gốc và giá trị")}
      <div className={flow}>
        <SourceFields control={control} record={record} />
        {record?.receivedDate ? <LockedValue label="Ngày tiếp nhận" value={formatPlainDate(record.receivedDate)} why={keptWhy(record)} />
          : <Field control={control} name="receivedDate" label="Ngày tiếp nhận" type="date" dateRule="PAST_OR_TODAY" />}
        {record?.purchaseDate ? <LockedValue label="Ngày mua" value={formatPlainDate(record.purchaseDate)} why={keptWhy(record)} />
          : <Field control={control} name="purchaseDate" label="Ngày mua" type="date" dateRule="PAST_OR_TODAY" />}
        {part === "all" ? <TechDates control={control} consumable={consumable} /> : null}
        {record?.usageStartYear != null ? <LockedValue label="Năm đưa vào sử dụng" value={record.usageStartYear} why={keptWhy(record)} />
          : <Field control={control} name="usageStartYear" label="Năm đưa vào sử dụng" type="number" numberRule="YEAR" />}
        {record?.originalValue != null ? <LockedValue label="Nguyên giá (đ)" value={money.format(Number(record.originalValue))} why={keptWhy(record)} />
          : <Field control={control} name="originalValue" label="Nguyên giá (đ)" type="number" numberRule="MONEY" />}
      </div>

      </>) : null}

      {part === "tech" ? (
        <div className={flow}>
          <TechIdentity control={control} />
          <TechDates control={control} consumable={consumable} />
          <ConfigField control={control} current={record?.config} />
          <SpecsFields control={control} className={STACK} />
        </div>
      ) : null}

      {show("usage") ? (<>
      {heading("Sử dụng")}
      {record ? (
        <UsageTiles
          record={record}
          statusBadge={record.status ? <Badge variant={ASSET_STATUS_VARIANTS[record.status] ?? "neutral"}>{ASSET_STATUS_LABELS[record.status]}</Badge> : null}
          roomSlot={<RoomPickerField control={control} name="room" label="Vị trí" schoolId={record.school?.id} hideLabel />}
          managerSlot={<SameSchoolRef control={control} record={record} name="manager" resource="staff" label="Người quản lý" current={record.manager} hideLabel />}
        />
      ) : (
        <>
          <div className="form-flow">
            <CreateRoomPicker control={control} />
            <SameSchoolRef control={control} record={record} name="manager" resource="staff" label="Người quản lý" current={record?.manager}
              hint="Người giữ thiết bị, thuộc cùng trường." />
            <EnumSelect control={control} name="condition" label="Tình trạng" options={EQUIPMENT_CONDITION_LABELS} />
          </div>
          <p className="text-muted-foreground text-xs">
            Chỉ khai tay cho thiết bị trường đã có từ trước. Thiết bị mới mua, được cấp, được tặng thì lập phiếu ghi tăng.
          </p>
        </>
      )}

      </>) : null}

      {part === "all" ? (<>
      <SubHeading>Thông số kỹ thuật</SubHeading>
      <RefField
        control={control}
        name="config"
        resource="equipment_configs"
        label="Bộ thông số"
        current={record?.config}
        className="sm:max-w-md"
      />
      <SpecsFields control={control} />
      </>) : null}
    </>
  );
}

/** Trần tên thiết bị — cùng `EquipmentRequest` (200: tên dài nhất của danh mục thông tư là 176). */
const NAME_MAX = 200;

/**
 * Ba cột thông tin dạng "Nhãn: giá trị" như tab Tổng quan của hồ sơ: nhãn bên trái (chữ nhạt, có dấu hai chấm), ô nhập
 * bên phải; ô không sửa được (`LockedValue`) là chữ thường kèm ổ khoá, không có khung — đọc như màn xem. Câu báo lỗi,
 * dòng giải thích đứng dưới ô, ở cột giá trị.
 */
const INLINE = cn(
  "[&_[data-slot=form-item]]:grid-cols-[minmax(7rem,9.5rem)_minmax(0,1fr)] [&_[data-slot=form-item]]:items-center",
  "[&_[data-slot=form-item]]:gap-x-3 [&_[data-slot=form-item]]:gap-y-1",
  "[&_[data-slot=form-label]]:text-muted-foreground [&_[data-slot=form-label]]:font-normal",
  // Dấu hai chấm ngay sau chữ, TRƯỚC biểu tượng ⓘ / dấu *: nhãn là flex, nên đẩy các phần tử con ra sau dấu và bù khoảng gap.
  "[&_[data-slot=form-label]]:after:order-1 [&_[data-slot=form-label]]:after:-ms-2 [&_[data-slot=form-label]]:after:content-[':'] [&_[data-slot=form-label]>*]:order-2",
  "[&_[data-slot=form-message]]:col-start-2 [&_[data-slot=form-description]]:col-start-2 [&_[data-slot=form-counter]]:col-start-2",
  "[&_[data-locked]]:h-auto [&_[data-locked]]:min-h-9 [&_[data-locked]]:justify-start [&_[data-locked]]:border-transparent",
  "[&_[data-locked]]:bg-transparent [&_[data-locked]]:px-0 [&_[data-locked]_span]:font-medium [&_[data-locked]_span]:whitespace-normal",
);

/**
 * Form Thêm / Sửa thiết bị.
 *
 * <p>Sửa: CHÍNH màn hồ sơ (`EquipmentDetail`, phương án AB-1) chuyển sang ô nhập — thẻ trái (ảnh, tên, mã, chip, ghi
 * chú), dải năm ô, rồi ba cột Phân loại / Nguồn gốc và giá trị / Kỹ thuật, bảo hành. Ô nào không sửa được (theo phiếu,
 * đã khai) vẫn là chữ kèm ổ khoá; ô sổ sách còn trống thì khai bổ sung được, lưu rồi thì khoá (máy chủ chặn ở
 * `EquipmentService.requireRecordFieldsKept`).
 *
 * <p>Thêm: cùng khung, chưa có dải năm ô (chưa có gì để xem), thẻ "Sử dụng" để xếp chỗ, giao người, tình trạng.
 * Không có khối "Hiển thị" (thứ tự, bật/tắt) của danh mục chung.
 */
function EquipmentFormBody({ control, record, config }: { control: Control<any>; record?: any; config: any }) {
  const section = (title: string, children: React.ReactNode) => (
    <section className="min-w-0 space-y-3">
      <h3 className="text-overline text-muted-foreground flex items-center gap-2 after:h-px after:flex-1 after:bg-border">{title}</h3>
      {children}
    </section>
  );
  // Thiết bị trong danh mục của Sở: tên theo danh mục, không sửa (trưởng nhóm 15/11/2026) — máy chủ cũng chặn
  // (`EquipmentService.requireRecordFieldsKept`). Thiết bị ngoài danh mục của trường thì vẫn đặt tên được.
  const nameLocked = !!record?.catalog?.id && record?.outOfCatalog === false;
  const name = nameLocked ? (
    <LockedValue label="Tên thiết bị" value={record.name} why="Theo danh mục thiết bị, không sửa tên." />
  ) : (
    <FormField control={control} name="name"
      rules={mergeRules(textRules("NAME", "Tên thiết bị", { max: NAME_MAX, min: 2 }), { required: "Nhập tên thiết bị" })}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Tên thiết bị</FormLabel>
          <FormControl>
            <Textarea {...field} value={field.value ?? ""} rows={1} placeholder={config.nameExample} maxLength={NAME_MAX}
              className="min-h-9 resize-none font-semibold [field-sizing:content]" />
          </FormControl>
          <LengthCounter value={field.value} max={NAME_MAX} />
          <FormMessage />
        </FormItem>
      )} />
  );
  const note = (
    <FormField control={control} name="note" rules={textRules("NOTE", "Ghi chú")}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Ghi chú</FormLabel>
          <FormControl><Textarea {...field} value={field.value ?? ""} rows={2} placeholder="Không bắt buộc" maxLength={maxLengthOf("NOTE")}
            className="max-h-40 min-h-16 resize-none [field-sizing:content]" /></FormControl>
          <LengthCounter value={field.value} max={maxLengthOf("NOTE")} />
          <FormMessage />
        </FormItem>
      )} />
  );
  const columns = (
    <Card className="gap-0 py-0">
      <CardContent className={cn("grid gap-x-8 gap-y-6 p-5 xl:grid-cols-3", record && INLINE)}>
        {section("Phân loại", <EquipmentFields control={control} record={record} part="classify" />)}
        {section("Nguồn gốc và giá trị", <EquipmentFields control={control} record={record} part="origin" />)}
        {section("Kỹ thuật, bảo hành", <EquipmentFields control={control} record={record} part="tech" />)}
      </CardContent>
    </Card>
  );

  if (record) {
    const writable = canWriteRecord("equipment", record);
    return (
      <div className="grid items-start gap-4 lg:grid-cols-[18.75rem_minmax(0,1fr)]">
        <Card className="gap-0 py-0 lg:sticky lg:top-4">
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="h-36 [&>button]:aspect-auto [&>button]:h-full">
              <EquipmentPhoto recordId={record.id} canWrite={writable} editable compact />
            </div>
            {name}
            <div className="-mt-2 flex flex-col gap-2.5">
              <div className="text-muted-foreground font-mono text-xs" title="Mã được cấp tự động, không sửa tay">{record.code}</div>
              <div className="flex flex-wrap gap-1.5">
                {record.status ? <Badge variant={ASSET_STATUS_VARIANTS[record.status] ?? "neutral"}>{ASSET_STATUS_LABELS[record.status]}</Badge> : null}
                <Badge variant={record.condition === "KEM" ? "warning" : "info"}
                  title="Đổi qua các phiếu nghiệp vụ">
                  Tình trạng: {EQUIPMENT_CONDITION_LABELS[record.condition] ?? "Chưa đánh giá"}
                </Badge>
              </div>
            </div>
            {note}
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-3">
          {/* Vị trí, người quản lý đổi qua phiếu; chỉ hồ sơ chưa xếp chỗ / chưa giao mới chọn được ở đây (lần đầu). */}
          <EquipmentStats r={record}
            roomSlot={<RoomPickerField control={control} name="room" label="Vị trí" schoolId={record.school?.id} hideLabel />}
            managerSlot={<SameSchoolRef control={control} record={record} name="manager" resource="staff" label="Người quản lý" current={record.manager} hideLabel />} />
          {columns}
          {/* Tệp đính kèm ở TRONG form, trước thanh Lưu / Huỷ (nút của nó là type="button"). */}
          <EquipmentEditBelow record={record} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[18.75rem_minmax(0,1fr)]">
      <Card className="gap-0 py-0 lg:sticky lg:top-4">
        <CardContent className="flex flex-col gap-5 p-4">
          <EquipmentPhoto recordId={undefined} canWrite rail />
          {name}
          <FormField control={control} name="code" render={({ field }) => (
            <FormItem>
              <FormLabel>Mã thiết bị</FormLabel>
              {/* Chỉ xem, cùng hình với ô Trường bị khoá: mã do hệ thống cấp theo chuẩn, không sửa tay. */}
              <div className="bg-muted/60 text-muted-foreground flex h-9 items-center justify-between gap-2 rounded-md border px-3"
                title="Mã được cấp tự động, không sửa tay">
                <span className="text-foreground truncate font-mono text-sm">{field.value || config.codeExample}</span>
                <Lock className="size-3.5 shrink-0" />
              </div>
              <FormMessage />
            </FormItem>
          )} />
          <SchoolField control={control} record={record} />
          {note}
        </CardContent>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        {columns}
        <Card className="gap-0 py-0">
          <CardContent className="p-5">{section("Sử dụng", <EquipmentFields control={control} record={record} part="usage" />)}</CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Nút chính của màn Thiết bị. Tra cứu theo mã nằm ở ô tìm của dạng Từng thiết bị (gõ đúng mã rồi Enter). */
function EquipmentListActions() {
  const canIntake = useCan({ resource: "equipment_intakes", action: "create" }).data?.can ?? false;
  // Thiết bị MỚI vào sổ bằng phiếu nhập (lập → duyệt → sinh tài sản), không tạo thẳng. Cạnh đó là việc chốt số dư
  // đầu kỳ của lãnh đạo trường — chốt xong thì phiếu ghi tăng là lối DUY NHẤT.
  return (
    <>
      <OpeningBalanceButton />
      {canIntake ? (
        <Button asChild>
          <Link to="/equipment-intakes/create"><PackagePlus />Ghi tăng</Link>
        </Button>
      ) : null}
    </>
  );
}

/** Lối phụ của màn Thiết bị — trong menu bánh răng của bảng, không thành một dãy nút biểu tượng. */
function EquipmentListMenu() {
  const canOpening = useCan({ resource: "data_imports", action: "create" }).data?.can ?? false;
  // Khai số dư đầu kỳ là việc làm MỘT LẦN lúc đưa hệ thống vào chạy — không phải cách thiết bị
  // mới vào sổ, nên giao cho lãnh đạo trường (đầu mối của trường) và quản trị, không để cạnh
  // nút chính cho cán bộ dùng nhầm thay phiếu nhập.
  const roles = getAuthorities()?.roles ?? [];
  // Đã chốt số dư đầu kỳ thì không còn lối nhập thiết bị đang có — máy chủ cũng từ chối.
  const closed = !!useOpeningBalance().data?.closedAt;
  const mayOpening = canOpening && !closed && (roles.includes("SCHOOL_LEADER") || roles.includes("ADMIN"));
  return (
    <>
      {mayOpening ? (
        // Số dư đầu kỳ là NHẬP DỮ LIỆU ĐẦU VÀO từ tệp Excel (tải mẫu, sửa trên lưới, cập nhật) — không gõ từng cái.
        <DropdownMenuItem asChild title="Nhập thiết bị trường đã có từ trước, từ tệp Excel">
          <Link to="/data-imports"><ArchiveRestore />Nhập thiết bị đang có từ tệp</Link>
        </DropdownMenuItem>
      ) : null}
    </>
  );
}

export const EQUIPMENT_EXTRA = {
  // Hồ sơ thiết bị có bố cục riêng (ảnh, nhóm trường, lịch sử trong hộp thoại); tệp đính kèm
  // chỉ thêm / xoá ở trang Sửa.
  Detail: ({ record }: { record: any }) => <EquipmentDetail record={record} fields={EQUIPMENT_EXTRA.show(record)} />,
  FormBody: EquipmentFormBody,
  ShowMore: EquipmentMoreMenu,
  ListActions: EquipmentListActions,
  ListMenu: EquipmentListMenu,
  hideCreate: true,
  // Không xoá thẳng thiết bị đang trên sổ: chỉ hồ sơ đã ra khỏi sổ (kiểm kê xác nhận Mất…) mới xoá được.
  canDelete: (r: any) => OFF_BOOK_STATUSES.includes(r?.status),
  // Đã ra khỏi sổ (mất) thì hồ sơ chỉ còn để tra — không sửa.
  canEdit: (r: any) => !OFF_BOOK_STATUSES.includes(r?.status),
  ListAside: EquipmentAside,
  // Màn Thiết bị mở ở dạng TỔNG HỢP SỐ LƯỢNG (như "Tổng đầu thiết bị" của MISA); bảng từng
  // tài sản là chế độ thứ ba, và là nơi một dòng tổng hợp mở ra khi bấm vào.
  ListViews: [
    { key: "catalog", label: "Tổng hợp", hint: "Số lượng theo từng thiết bị: tổng, đang dùng, trong kho", render: (ctx: ListViewCtx) => <EquipmentSummary by="catalog" {...ctx} /> },
    { key: "room", label: "Theo kho/phòng", hint: "Thiết bị đang để ở từng kho, từng phòng", render: (ctx: ListViewCtx) => <EquipmentSummary by="room" {...ctx} /> },
  ],
  // Chế độ thứ ba là bảng CHI TIẾT: tài sản từng cái và lô hàng trong một bảng — thay cho
  // bảng từng tài sản cộng tab "Vật tư, hàng theo lô" riêng.
  itemsLabel: "Từng thiết bị",
  itemsHint: "Từng thiết bị có mã riêng và từng lô vật tư",
  ItemsView: EquipmentItems,
  section: { title: "Hồ sơ thiết bị" },
  defaults: {
    school: { id: null },
    catalog: { id: null },
    physicalOrDigital: "PHYSICAL",
    assetCategory: null,
    serialNumber: "",
    model: "",
    manufacturer: "",
    unit: { id: null },
    quantity: 1,
    originSource: { id: null },
    acquisitionMethod: { id: null },
    fundingSource: null,
    productionYear: null,
    usageStartYear: null,
    receivedDate: null,
    purchaseDate: null,
    originalValue: null,
    warrantyExpiry: null,
    expiryDate: null,
    room: { id: null },
    manager: { id: null },
    condition: "TOT",
    config: { id: null },
    specs: {},
  },
  Fields: EquipmentFields,
  // Một cột "Thiết bị": tên trên hồ sơ, dòng phụ là mặt hàng (khi khác tên) và ghi chú —
  // thay cho hai cột Tên / Thiết bị cạnh nhau nói gần cùng một điều.
  // Một cột "Thiết bị", một dòng: tên trên hồ sơ. Không dòng phụ — mặt hàng xem ở chế độ
  // Tổng hợp (hoặc lọc theo mặt hàng), ghi chú ở hồ sơ.
  nameColumn: { header: "Thiết bị", subline: () => null },
  hideActiveColumn: true,
  codeSize: 200,
  assetCode: true,
  columns: [
    {
      id: "room",
      header: "Phòng",
      enableSorting: false,
      cell: ({ row }) => row.original.room?.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "status",
      header: "Trạng thái",
      enableSorting: false,
      cell: ({ row }) => {
        const v = row.original.status;
        return <Badge variant={ASSET_STATUS_VARIANTS[v] ?? "neutral"}>{ASSET_STATUS_LABELS[v] ?? v}</Badge>;
      },
    },
    // Hồ sơ đủ hay chưa. Đi kèm ô lọc bên dưới, và hai thứ đó cộng lại chính
    // là màn "Tài sản chưa hoàn thiện hồ sơ" của tài liệu nghiệp vụ — không
    // cần một màn riêng, chỉ cần lọc được.
    {
      id: "profileComplete",
      header: "Hồ sơ",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.profileComplete === false ? (
          <Badge variant="warning" title={`Thiếu: ${(row.original.missingProfile ?? []).join(", ")}`}>
            Chưa chuẩn
          </Badge>
        ) : (
          <Badge variant="success">Chuẩn</Badge>
        ),
    },
    {
      id: "intake",
      header: "Phiếu ghi tăng",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.intake ? (
          <Link to={`/equipment-intakes/show/${row.original.intake.id}`} title="Mở phiếu nhập" onClick={(e) => e.stopPropagation()}
            className="text-primary text-xs tabular-nums underline-offset-2 hover:underline">
            {row.original.intake.code ?? "Phiếu nháp"}
          </Link>
        ) : (
          <span className="text-muted-foreground text-xs">khai đầu kỳ</span>
        ),
    },
    schoolColumn,
  ] as ColumnDef<any, any>[],
  show: (r: any) => [
    { label: "Trường", value: r?.school?.name ?? "—" },
    {
      label: "Nguồn gốc",
      value: r?.intake ? (
        <Link className="text-primary underline-offset-2 hover:underline" to={`/equipment-intakes/show/${r.intake.id}`}>
          Phiếu ghi tăng {r.intake.code}
        </Link>
      ) : (
        "Khai đầu kỳ (thiết bị có sẵn, không qua phiếu ghi tăng)"
      ),
    },
    {
      label: "Hồ sơ",
      value:
        r?.profileComplete === false ? (
          <div className="space-y-1">
            <Badge variant="warning">Chưa đủ thông tin để lập phiếu</Badge>
            <p className="text-muted-foreground text-xs">Thiếu: {(r.missingProfile ?? []).join(", ")}</p>
          </div>
        ) : (
          <Badge variant="success">Đủ thông tin, dùng được trong phiếu</Badge>
        ),
    },
    ...(r?.legacyCode || r?.missingProfile?.some((m: string) => m.startsWith("mã chuẩn"))
      ? [{
          label: "Mã cũ",
          value: (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{r.legacyCode ?? r.code}</span>
              {r?.missingProfile?.some((m: string) => m.startsWith("mã chuẩn")) && canWriteRecord("equipment", r) ? (
                <StandardCodeButton id={r.id} />
              ) : null}
            </div>
          ),
        }]
      : []),
    { label: "Thiết bị", value: r?.catalog?.name ?? "—" },
    // Môn của thiết bị trong danh mục: môn chính trước, rồi các môn thêm. Không gắn môn = dùng chung.
    { label: "Môn học", value: r?.subjects?.length ? r.subjects.map((s: { name: string }) => s.name).join(", ") : "Dùng chung" },
    { label: "Dạng thiết bị", value: PHYSICAL_TYPE_LABELS[r?.physicalOrDigital] ?? "—" },
    { label: "Phân loại kế toán", value: ASSET_CATEGORY_LABELS[r?.assetCategory] ?? "—" },
    { label: "Số serial", value: r?.serialNumber ?? "—" },
    { label: "Model", value: r?.model ?? "—" },
    { label: "Hãng sản xuất", value: r?.manufacturer ?? "—" },
    { label: "Số lượng", value: `${r?.quantity ?? "—"} ${r?.unit?.name ?? ""}` },
    { label: "Nguồn hình thành", value: r?.originSource ? `${r.originSource.name}${r.originNote ? `: ${r.originNote}` : ""}` : "—" },
    // Chỉ hàng mua mới có hình thức mua sắm — nguồn khác thì không có dòng này, thay vì một dấu "—" trông như thiếu.
    ...(r?.acquisitionMethod ? [{ label: "Hình thức mua sắm", value: `${r.acquisitionMethod.name}${r.acquisitionNote ? `: ${r.acquisitionNote}` : ""}` }] : []),
    { label: "Nguồn kinh phí", value: r?.fundingSource ? `${FUNDING_LABELS[r.fundingSource] ?? r.fundingSource}${r.fundingNote ? `: ${r.fundingNote}` : ""}` : "—" },
    // Chứng từ của dòng phiếu nhập đã sinh ra tài sản — tài sản khai đầu kỳ thì không có.
    ...(r?.intakeDocument
      ? [
          { label: "Nhà cung cấp", value: r.intakeDocument.supplier ?? "—" },
          { label: "Số hoá đơn", value: r.intakeDocument.documentNo ?? "—" },
          { label: "Ngày hoá đơn", value: formatPlainDate(r.intakeDocument.documentDate) },
        ]
      : []),
    { label: "Ngày tiếp nhận", value: formatPlainDate(r?.receivedDate) },
    // Ngày mua trùng ngày hoá đơn (thiết bị qua phiếu ghi tăng) hoặc ngày tiếp nhận thì không lặp lại.
    ...(r?.purchaseDate && [r?.intakeDocument?.documentDate, r?.receivedDate].includes(r.purchaseDate)
      ? [] : [{ label: "Ngày mua", value: formatPlainDate(r?.purchaseDate) }]),
    { label: "Hết hạn bảo hành", value: formatPlainDate(r?.warrantyExpiry) },
    // Hạn sử dụng chỉ vật tư tiêu hao, hoá chất có — thiết bị khác không có dòng này.
    ...(r?.expiryDate || r?.assetCategory === "SUPPLY" || r?.assetCategory === "CHEMICAL"
      ? [{ label: "Hạn sử dụng", value: <ExpiryValue date={r?.expiryDate} /> }]
      : []),
    { label: "Năm sản xuất", value: r?.productionYear ?? "—" },
    // Năm đưa vào sử dụng mặc định là năm tiếp nhận: chỉ hiện khi khác năm đó.
    ...(r?.usageStartYear != null && String(r.usageStartYear) !== String(r?.receivedDate ?? "").slice(0, 4)
      ? [{ label: "Năm đưa vào sử dụng", value: r.usageStartYear }] : []),
    { label: "Nguyên giá", value: r?.originalValue != null ? `${money.format(r.originalValue)} đ` : "—" },
    { label: "Phòng", value: r?.room?.name ?? "—" },
    { label: "Người quản lý", value: r?.manager?.name ?? "—" },
    { label: "Tình trạng", value: EQUIPMENT_CONDITION_LABELS[r?.condition] ?? "Chưa đánh giá" },
    {
      label: "Trạng thái",
      value: r?.status ? <Badge variant={ASSET_STATUS_VARIANTS[r.status] ?? "neutral"}>{ASSET_STATUS_LABELS[r.status]}</Badge> : "—",
    },
    {
      label: "Thông số kỹ thuật",
      value:
        !r?.config ? (
          "—"
        ) : (
          <div className="space-y-1">
            <p className="text-muted-foreground font-normal">{r.config.name}</p>
            {Object.entries(r.specs ?? {}).map(([k, v]) => (
              <p key={k}>
                <span className="text-muted-foreground font-normal">{k}:</span> {String(v)}
              </p>
            ))}
          </div>
        ),
    },
  ],
};
