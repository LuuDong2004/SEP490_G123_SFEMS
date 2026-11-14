import { useInvalidate, useMany, useNotification, useOne } from "@refinedev/core";
import { AddLinesButton, AddLinesEmpty } from "@/shared/components/voucher/add-lines";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarCheck, CirclePause, CirclePlay, CircleStop, ClipboardPlus, Loader2, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useController, useFormContext, useWatch, type Control } from "react-hook-form";
import { useNavigate } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { RefField } from "@/shared/components/catalog/ref-field";
import { DateInput } from "@/shared/components/form/date-input";
import { DateField, SelectField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { CompletionList, SideFact, SideSection, StepTitle } from "@/shared/components/voucher/voucher-layout";
import { errorMessage } from "@/shared/lib/api-error";
import { dateError, maxLengthOf, textError } from "@/shared/lib/field-rules";
import { formatPlainDate, todayLocal } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { EquipmentPickerDialog } from "@/shared/components/voucher/equipment-lines-field";
import { RoomPickerField } from "@/features/organization/resources/room-picker";
import { schoolColumn, SchoolField } from "@/features/organization/resources/school-field";
import { ASSET_STATUS_LABELS, OFF_BOOK_STATUSES } from "@/domains/equipment/types";
import { RelatedVouchers } from "@/shared/components/voucher/related-vouchers";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { Segmented } from "@/shared/components/segmented";
import { Checkbox } from "@/shared/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { useSchoolNextCode } from "@/features/organization/resources/school-code";
import { cn } from "@/shared/lib/utils";
import { ApprovalBadge, MaintenanceApprovalButton, PlanApprovalCard } from "@/features/organization/resources/maintenance-approval";
import { PLAN_APPROVAL_LABELS, PLAN_TARGET_LABELS, type PlanTarget } from "@/domains/maintenance-plan/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const FREQUENCY_LABELS: Record<string, string> = {
  ONCE: "Một lần",
  WEEKLY: "Hằng tuần",
  MONTHLY: "Hằng tháng",
  QUARTERLY: "Hằng quý",
  SEMI_ANNUAL: "Nửa năm",
  ANNUAL: "Hằng năm",
  CUSTOM: "Khác",
};

export const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  VE_SINH: "Vệ sinh",
  KIEM_TRA: "Kiểm tra",
  HIEU_CHUAN: "Hiệu chuẩn",
  THAY_THE_VAT_TU: "Thay thế vật tư",
  KHAC: "Khác",
};

export const PLAN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Đang áp dụng",
  PAUSED: "Tạm dừng",
  ENDED: "Kết thúc",
};

const PLAN_STATUS_VARIANT: Record<string, "success" | "warning" | "neutral"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  ENDED: "neutral",
};

/** Các mốc nhắc trước hạn chọn được (BCKTKT 2.3.3: trước 7 ngày và 1 ngày). */
const REMIND_OPTIONS = [7, 1];

/** Chu kỳ đọc được: "Khác" kèm số ngày. */
const frequencyText = (r: any) =>
  r?.frequency === "CUSTOM" && r?.intervalDays ? `${r.intervalDays} ngày một lần` : FREQUENCY_LABELS[r?.frequency] ?? "—";

const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));

/** Bảo trì là việc của tài sản còn trên sổ — đã thanh lý, đã mất, đã dùng hết thì không lập kế hoạch. */
const ON_BOOK = Object.keys(ASSET_STATUS_LABELS).filter((s) => !OFF_BOOK_STATUSES.includes(s));

type PlanAsset = { id: number; code?: string; name: string };

/**
 * Thẻ "Tài sản trong kế hoạch" — cùng khuôn với thẻ "Tài sản trên phiếu" của các phiếu: tiêu đề kèm số lượng,
 * nút "Thêm tài sản" mở hộp chọn nhiều dùng chung (mã, tên, vị trí, trạng thái; tìm và phân trang ở máy chủ),
 * bảng mỗi dòng một tài sản có nút bỏ. Lưu vào `equipments` — danh sách `{id}`.
 */
function PlanAssetsCard({ control, schoolId }: { control: Control<any>; schoolId: number | null }) {
  const { field, fieldState } = useController({ control, name: "equipments" });
  const roomId: number | null = useWatch({ control, name: "room.id" }) ?? null;
  // Ô phòng chỉ lưu id — tên phòng (cho câu thông báo) đọc riêng, cùng khoá cache với danh sách phòng.
  const { result: room } = useOne<{ id: number; name: string }>({ resource: "rooms", id: roomId ?? undefined, queryOptions: { enabled: roomId != null } });
  const roomName = room?.name;
  const [open, setOpen] = useState(false);
  const { open: notify } = useNotification();
  const items: PlanAsset[] = Array.isArray(field.value) ? field.value : [];
  // Vị trí và trạng thái như bảng "Tài sản trên phiếu": kế hoạch chỉ lưu id, nên đọc hồ sơ theo đúng các id đang có.
  const { result } = useMany<any>({ resource: "equipment", ids: items.map((a) => a.id), queryOptions: { enabled: items.length > 0 } });
  const byId = new Map<number, any>((result?.data ?? []).map((e: any) => [e.id, e]));

  // Kế hoạch của một phòng chỉ gồm tài sản của phòng đó. Người dùng ĐỔI phòng khi đã thêm tài sản thì bỏ những tài
  // sản không ở phòng mới — chỉ khi đổi, không phải lúc mở màn sửa (dữ liệu cũ để máy chủ báo, không lặng lẽ xoá).
  const previousRoom = useRef(roomId);
  useEffect(() => {
    if (previousRoom.current === roomId) return;
    previousRoom.current = roomId;
    if (roomId == null || items.length === 0) return;
    const kept = items.filter((a) => {
      const asset = byId.get(a.id);
      return !asset || asset.room?.id === roomId;
    });
    if (kept.length < items.length) {
      field.onChange(kept);
      notify?.({ type: "success", message: `Đã bỏ ${items.length - kept.length} thiết bị không ở ${roomName ?? "phòng vừa chọn"}` });
    }
    // Chỉ chạy khi phòng đổi; danh sách và hồ sơ tài sản đọc ở thời điểm đó.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <StepTitle title="Thiết bị trong kế hoạch" aside={items.length ? `${items.length} thiết bị` : undefined} />
        {items.length ? <AddLinesButton label="Thêm thiết bị" disabled={!schoolId} onClick={() => setOpen(true)} /> : null}
      </div>
      {items.length === 0 ? (
        <AddLinesEmpty label="Thêm thiết bị" onClick={() => setOpen(true)} disabled={!schoolId} disabledLabel="Chọn trường trước"
          hint={roomId ? "Không thêm thiết bị là bảo trì cả phòng" : "Bảo trì cả một phòng thì chọn “Cả phòng” ở ô Đối tượng bảo trì"} />
      ) : (
        <div className="max-h-[28rem] overflow-auto border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Mã thiết bị</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Vị trí</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((a, i) => (
                <TableRow key={a.id} className={cn("group/row", LIFT_ROW)}>
                  <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{a.code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{byId.get(a.id)?.room?.name ?? (byId.has(a.id) ? <span className="text-muted-foreground">Kho</span> : null)}</TableCell>
                  <TableCell>
                    {byId.get(a.id)?.status ? <Badge variant="neutral">{ASSET_STATUS_LABELS[byId.get(a.id).status] ?? byId.get(a.id).status}</Badge> : null}
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" title="Bỏ khỏi kế hoạch" onClick={() => field.onChange(items.filter((x) => x.id !== a.id))}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {fieldState.error ? <p className="text-destructive border-t px-4 py-2 text-sm">{fieldState.error.message}</p> : null}
      <EquipmentPickerDialog skipHolds
        open={open}
        onOpenChange={setOpen}
        schoolId={schoolId}
        statuses={ON_BOOK}
        exclude={new Set(items.map((a) => a.id))}
        roomId={roomId}
        allowIncomplete
        addedLabel="Đã có trong kế hoạch"
        onPick={(picked) => {
          field.onChange([...items, ...picked.map((r) => ({ id: r.id, code: r.code, name: r.name }))]);
          setOpen(false);
        }}
      />
    </Card>
  );
}

/** Bảo trì thiết bị: các tài sản cụ thể, hay cả thiết bị của một phòng (máy lạnh, điện của phòng máy). Chỉ ở form. */
type Target = "assets" | "room";

/** Bảo trì công trình: một khối nhà, hay một phòng / hạng mục (mái, sân, hàng rào, nhà vệ sinh). Chỉ ở form. */
type FacilityKind = "building" | "room";

/** Ô "Nhắc trước" — các mốc số ngày trước hạn, lưu vào `remindDays`. */
function RemindField({ control }: { control: Control<any> }) {
  return (
    <FormField
      control={control}
      name="remindDays"
      rules={{ validate: (v) => (Array.isArray(v) && v.length > 0) || "Chọn ít nhất một mốc nhắc" }}
      render={({ field }) => {
        const value: number[] = Array.isArray(field.value) ? field.value : [];
        return (
          <FormItem>
            <FormLabel>Nhắc trước</FormLabel>
            <FormControl>
              <div className="flex h-9 items-center gap-5">
                {REMIND_OPTIONS.map((d) => (
                  <label key={d} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={value.includes(d)}
                      onCheckedChange={(on) => field.onChange(on ? [...value, d].sort((a, b) => b - a) : value.filter((x) => x !== d))} />
                    {d} ngày
                  </label>
                ))}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/**
 * Thân trang Thêm / Sửa kế hoạch bảo trì (QLTB-505, theo mockup): thẻ "Thông tin kế hoạch", thẻ "Lịch và chu kỳ",
 * rồi tài sản của kế hoạch hoặc phòng bảo trì. Mã do máy chủ cấp theo năm (BT-2026-001 — QLTB-584).
 */
function MaintenanceFormBody({ control, record, config }: { control: Control<any>; record?: any; config: any }) {
  const picked = useWatch({ control, name: "school.id" });
  const schoolId = record?.school?.id ?? picked ?? null;
  const scoped = schoolId ? [{ field: "school.id", operator: "eq" as const, value: schoolId }] : [];
  const hint = schoolId ? undefined : "Chọn trường trước";
  const { setValue } = useFormContext();
  useSchoolNextCode("maintenance_plans", control, record);
  const [frequency, nextDueDate] = useWatch({ control, name: ["frequency", "nextDueDate"] });
  const planTarget: PlanTarget = useWatch({ control, name: "target" }) ?? "EQUIPMENT";
  const target: Target = useWatch({ control, name: "assetScope" }) ?? "assets";
  const facilityKind: FacilityKind = useWatch({ control, name: "facilityKind" }) ?? "building";
  // Sửa: kế hoạch đã lưu không giữ hai ô chọn phụ — suy từ dữ liệu (có tài sản là theo tài sản, chỉ có phòng là cả
  // phòng; công trình có khối nhà là khối nhà, không thì phòng / hạng mục).
  useEffect(() => {
    if (!record) return;
    setValue("target", record.target ?? "EQUIPMENT");
    setValue("assetScope", record.equipments?.length || !record.room ? "assets" : "room");
    setValue("facilityKind", record.room && !record.building ? "room" : "building");
  }, [record, setValue]);
  const switchPlanTarget = (t: PlanTarget) => {
    setValue("target", t, { shouldDirty: true });
    // Đổi loại kế hoạch thì bỏ hết đối tượng đã chọn của loại kia.
    setValue("equipments", [], { shouldDirty: true });
    setValue("room", { id: null }, { shouldDirty: true });
    setValue("building", { id: null }, { shouldDirty: true });
  };
  const switchTarget = (t: Target) => {
    setValue("assetScope", t, { shouldDirty: true });
    // Một kế hoạch lo MỘT loại đối tượng: đổi sang cả phòng thì bỏ danh sách tài sản, và ngược lại.
    if (t === "room") setValue("equipments", [], { shouldDirty: true });
    else setValue("room", { id: null }, { shouldDirty: true });
  };
  const switchFacilityKind = (k: FacilityKind) => {
    setValue("facilityKind", k, { shouldDirty: true });
    if (k === "room") setValue("building", { id: null }, { shouldDirty: true });
    else setValue("room", { id: null }, { shouldDirty: true });
  };
  const today = todayLocal();
  return (
    <>
      <Card className="@container gap-4 px-4 py-4">
        <StepTitle title="Thông tin kế hoạch" />
        <div className="form-flow">
          <SchoolField control={control} record={record} hideWhenFixed />
          <TextField control={control} name="code" label="Mã kế hoạch" placeholder={config.codeExample}
            description={record ? undefined : "Tự sinh theo năm, không trùng trong trường"} rule="CODE" />
          <TextField control={control} name="name" label="Tên kế hoạch" placeholder={config.nameExample}
            rule="NAME" rules={{ required: "Nhập tên kế hoạch" }} />
          <SelectField control={control} name="maintenanceType" label="Loại bảo trì" options={opts(MAINTENANCE_TYPE_LABELS)}
            placeholder="Vui lòng chọn loại bảo trì" rules={{ required: "Chọn loại bảo trì" }} />
          <RefField control={control} name="responsible" resource="staff" staffPrefer="keeper" label="Người phụ trách"
            filters={scoped} current={record?.responsible} disabledHint={hint} required />
          <div className="flex flex-col gap-2">
            <span className="text-sm leading-none font-medium">Loại kế hoạch</span>
            <Segmented<PlanTarget> label="Loại kế hoạch" size="sm" variant="card" value={planTarget} onChange={switchPlanTarget}
              options={[{ value: "EQUIPMENT", label: "Bảo trì thiết bị" }, { value: "FACILITY", label: "Bảo trì công trình" }]} />
          </div>
          {planTarget === "FACILITY" ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm leading-none font-medium">Công trình</span>
                <Segmented<FacilityKind> label="Công trình" size="sm" variant="card" value={facilityKind} onChange={switchFacilityKind}
                  options={[{ value: "building", label: "Khối nhà" }, { value: "room", label: "Phòng, hạng mục" }]} />
              </div>
              {facilityKind === "building" ? (
                <RefField control={control} name="building" resource="buildings" label="Khối nhà"
                  filters={scoped} current={record?.building} disabledHint={hint} required />
              ) : (
                <RoomPickerField control={control} name="room" label="Phòng, hạng mục" schoolId={schoolId}
                  current={record?.room} placeholder="Vui lòng chọn phòng, hạng mục" disabledHint={hint}
                  required />
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm leading-none font-medium">Đối tượng bảo trì</span>
                <Segmented<Target> label="Đối tượng bảo trì" size="sm" variant="card" value={target} onChange={switchTarget}
                  options={[{ value: "assets", label: "Thiết bị" }, { value: "room", label: "Cả phòng" }]} />
              </div>
              {target === "room" ? (
                <RoomPickerField control={control} name="room" label="Phòng bảo trì" schoolId={schoolId}
                  current={record?.room} placeholder="Vui lòng chọn phòng" disabledHint={hint}
                  required />
              ) : null}
            </>
          )}
          <TextareaField control={control} name="workContent" label="Nội dung công việc" inGrid rule="NOTE" max={1000} />
          <TextareaField control={control} name="note" label="Ghi chú" inGrid rule="NOTE" />
        </div>
      </Card>
      <Card className="@container gap-4 px-4 py-4">
        <StepTitle title="Lịch và chu kỳ" />
        <div className="form-flow">
          <SelectField control={control} name="frequency" label="Chu kỳ" options={opts(FREQUENCY_LABELS)} rules={{ required: "Chọn chu kỳ" }} />
          {frequency === "CUSTOM" ? (
            <TextField control={control} name="intervalDays" label="Số ngày giữa hai lần" type="number" numberRule="COUNT"
              rules={{ required: "Nhập số ngày", validate: (v: any) => Number(v) >= 1 || "Ít nhất 1 ngày" }} />
          ) : null}
          <DateField control={control} name="nextDueDate" label="Lần bảo trì kế tiếp"
            description="Mốc đầu tiên; các lần sau hệ thống tự tính theo chu kỳ"
            rules={{ required: "Chọn ngày", validate: (v: string) => !v || !!record || v >= today || "Chọn ngày từ hôm nay trở đi" }} />
          {frequency === "ONCE" ? null : (
            <DateField control={control} name="endDate" label="Ngày kết thúc" description="Trống = lặp không giới hạn"
              rules={{ validate: (v: string) => !v || !nextDueDate || v >= nextDueDate || "Không được trước lần bảo trì kế tiếp" }} />
          )}
          <RemindField control={control} />
        </div>
      </Card>
      {planTarget === "EQUIPMENT" && target === "assets" ? <PlanAssetsCard control={control} schoolId={schoolId} /> : null}
    </>
  );
}

const focusField = (name: string) => () => document.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();

/**
 * Cột phải của trang Thêm / Sửa kế hoạch — cùng khuôn thẻ tóm tắt của form phiếu: kế hoạch lo cái gì, chu kỳ và
 * lần tới, "Cần hoàn thiện" (mỗi mục bấm tới đúng ô), rồi nút Lưu · Huỷ. Thay cho thanh lưu dưới đáy.
 */
function MaintenanceFormSide({ control, record, mode, submitting, onCancel }: {
  control: Control<any>;
  record?: any;
  mode: "create" | "edit";
  submitting: boolean;
  onCancel: () => void;
}) {
  const [code, name, nextDueDate, frequency, roomId, equipments, schoolId, maintenanceType, responsibleId, intervalDays, planTarget, buildingId] = useWatch({
    control,
    name: ["code", "name", "nextDueDate", "frequency", "room.id", "equipments", "school.id", "maintenanceType", "responsible.id", "intervalDays", "target", "building.id"],
  });
  const assets: PlanAsset[] = Array.isArray(equipments) ? equipments : [];
  const school = record?.school?.id ?? schoolId;
  const facility = planTarget === "FACILITY";
  const target = facility
    ? buildingId
      ? (record?.building?.id === buildingId ? `Khối nhà ${record.building.name}` : "Một khối nhà")
      : roomId ? (record?.room?.id === roomId ? record.room.name : "Một phòng, hạng mục") : null
    : assets.length
      ? `${assets.length} thiết bị${roomId ? " trong phòng" : ""}`
      : roomId ? (record?.room?.id === roomId ? `Cả phòng ${record.room.name}` : "Cả một phòng") : null;
  const filled = (v: unknown) => v != null && String(v).trim() !== "";
  const items = [
    { key: "school", label: "Chưa chọn trường", ok: filled(school), onClick: undefined },
    { key: "name", label: "Chưa nhập tên kế hoạch", ok: filled(name), onClick: focusField("name") },
    { key: "type", label: "Chưa chọn loại bảo trì", ok: filled(maintenanceType), onClick: undefined },
    { key: "responsible", label: "Chưa chọn người phụ trách", ok: filled(responsibleId), onClick: undefined },
    { key: "interval", label: "Chưa nhập số ngày giữa hai lần", ok: frequency !== "CUSTOM" || Number(intervalDays) >= 1, onClick: focusField("intervalDays") },
    { key: "due", label: "Chưa chọn lần bảo trì kế tiếp", ok: filled(nextDueDate), onClick: focusField("nextDueDate") },
    facility
      ? { key: "target", label: "Chưa chọn công trình", hint: "Chọn khối nhà, hoặc phòng / hạng mục", ok: Boolean(target), onClick: undefined }
      : { key: "target", label: "Chưa chọn thiết bị hoặc phòng", hint: "Thêm thiết bị, hoặc chọn “Cả phòng”", ok: Boolean(target), onClick: undefined },
  ];
  const missing = items.filter((i) => !i.ok);
  return (
    <Card className="gap-0 py-0">
      <SideSection title="Kế hoạch bảo trì">
        <SideFact label="Mã">{filled(code) ? <span className="font-mono">{code}</span> : null}</SideFact>
        <SideFact label="Loại">{MAINTENANCE_TYPE_LABELS[maintenanceType] ?? null}</SideFact>
        <SideFact label="Loại kế hoạch">{PLAN_TARGET_LABELS[(planTarget ?? "EQUIPMENT") as PlanTarget]}</SideFact>
        <SideFact label="Bảo trì">{target}</SideFact>
        <SideFact label="Chu kỳ">{frequency ? frequencyText({ frequency, intervalDays }) : null}</SideFact>
        <SideFact label="Lần tới">{nextDueDate ? formatPlainDate(nextDueDate) : null}</SideFact>
        {mode === "edit" ? <SideFact label="Lần gần nhất">{record?.lastDoneDate ? formatPlainDate(record.lastDoneDate) : "Chưa có"}</SideFact> : null}
      </SideSection>
      <SideSection title={missing.length ? `Cần hoàn thiện (${missing.length})` : "Kiểm tra trước khi lưu"}>
        <CompletionList doneText="Đủ để lưu" items={items.map((i) => ({ ...i, onClick: i.ok ? undefined : i.onClick }))} />
      </SideSection>
      <SideSection className="space-y-2">
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Save />}
          {mode === "create" ? "Lưu" : "Lưu thay đổi"}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="w-full" disabled={submitting} onClick={onCancel}>
          Huỷ
        </Button>
        <p className="text-muted-foreground text-center text-xs">Lãnh đạo trường duyệt xong thì cán bộ thiết bị nhận nhắc trước hạn (thông báo và email).</p>
      </SideSection>
    </Card>
  );
}

/** Kế hoạch này lo cái gì: một tài sản thì tên nó, nhiều thì số lượng, không thì phòng. */
function targetOf(r: any): string {
  if (r?.targetLabel) return r.targetLabel;
  const assets: PlanAsset[] = r?.equipments ?? [];
  if (assets.length > 1) return `${assets.length} thiết bị`;
  return assets[0]?.name ?? r?.room?.name ?? "—";
}

function DueBadge({ r }: { r: any }) {
  if (r?.planStatus === "ENDED") return <span className="text-muted-foreground">—</span>;
  if (!r?.nextDueDate) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      {formatPlainDate(r.nextDueDate)}
      {r.overdue ? <Badge variant="destructive">Quá hạn</Badge> : r.dueSoon ? <Badge variant="warning">Sắp đến hạn</Badge> : null}
    </span>
  );
}

/**
 * "Đã bảo trì xong" — ngày lần tới lùi một chu kỳ, lịch sử tài sản ghi một dòng.
 * Là một hành động chứ không phải sửa ô ngày: sửa tay ngày lần tới thì không còn
 * vết nào nói lần trước đã làm hay chưa.
 */
function MaintenanceDone({ record }: { record: any }) {
  const { open } = useNotification();
  const invalidate = useInvalidate();
  const [day, setDay] = useState(todayLocal);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const noteError = textError("NOTE", "Nội dung", note);
  const dayError = dateError("ANY", "Ngày làm", day);
  if (!record?._can?.write || record.planStatus !== "ACTIVE" || (record.approvalStatus ?? "APPROVED") !== "APPROVED") return null;

  async function done() {
    setBusy(true);
    try {
      await kyInstance.post(`maintenance_plans/${record.id}/done`, { json: { doneDate: day, note: note || null } });
      open?.({ type: "success", message: "Đã ghi nhận bảo trì, lịch lần tới đã lùi một chu kỳ" });
      setNote("");
      invalidate({ resource: "maintenance_plans", invalidates: ["list", "detail"], id: record.id });
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="size-4" />
          Ghi nhận đã bảo trì
        </CardTitle>
        <CardDescription>
          Lần gần nhất: {record.lastDoneDate ? formatPlainDate(record.lastDoneDate) : "chưa có"}.{" "}
          {record.frequency === "ONCE" ? "Làm xong là kế hoạch kết thúc." : `Lần tới tự tính theo chu kỳ: ${frequencyText(record).toLowerCase()}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>Ngày làm</Label>
          <DateInput value={day} onChange={(v) => setDay(v ?? day)} />
          {dayError ? <p className="text-destructive text-sm">{dayError}</p> : null}
        </div>
        <div className="min-w-60 flex-1 space-y-2">
          <Label>Nội dung</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: vệ sinh, thay lọc bụi"
            maxLength={maxLengthOf("NOTE")} aria-invalid={noteError ? true : undefined} />
          {noteError ? <p className="text-destructive text-sm">{noteError}</p> : null}
        </div>
        <Button type="button" onClick={() => void done()} disabled={busy || !!noteError || !!dayError}>
          Đã bảo trì xong
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Trạng thái kế hoạch (mockup "Thông tin hệ thống tự tính"): đang áp dụng / tạm dừng / kết thúc, lần gần nhất, cảnh
 * báo quá hạn, và nút "Tạo phiếu bảo dưỡng" — mở phiếu Sửa chữa, bảo trì loại Bảo trì, điền sẵn kế hoạch và tài sản.
 */
function PlanStatusCard({ record }: { record: any }) {
  const { open } = useNotification();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const canWrite = !!record?._can?.write;
  const status: string = record?.planStatus ?? "ACTIVE";
  const approved = (record?.approvalStatus ?? "APPROVED") === "APPROVED";

  async function change(next: string, message: string) {
    setBusy(next);
    try {
      await kyInstance.post(`maintenance_plans/${record.id}/status`, { json: { status: next } });
      open?.({ type: "success", message });
      invalidate({ resource: "maintenance_plans", invalidates: ["list", "detail"], id: record.id });
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  const createOrder = () => {
    const q = new URLSearchParams({ workKind: "MAINTENANCE", "plan.id": String(record.id) });
    const ids = (record?.equipments ?? []).map((a: PlanAsset) => a.id);
    if (ids.length) q.set("equipment.id", ids.join(","));
    navigate(`/repair-orders/create?${q.toString()}`);
  };

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Trạng thái kế hoạch
          <Badge variant={PLAN_STATUS_VARIANT[status]}>{PLAN_STATUS_LABELS[status]}</Badge>
          {record?.overdue ? <Badge variant="destructive">Quá hạn</Badge> : null}
        </CardTitle>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            {status === "ACTIVE" ? (
              <>
                {approved ? (
                  <Button type="button" size="sm" onClick={createOrder}>
                    <ClipboardPlus /> Tạo phiếu bảo dưỡng
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => void change("PAUSED", "Đã tạm dừng kế hoạch")}>
                  {busy === "PAUSED" ? <Loader2 className="animate-spin" /> : <CirclePause />} Tạm dừng
                </Button>
              </>
            ) : null}
            {status === "PAUSED" ? (
              <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => void change("ACTIVE", "Đã áp dụng lại kế hoạch")}>
                {busy === "ACTIVE" ? <Loader2 className="animate-spin" /> : <CirclePlay />} Áp dụng lại
              </Button>
            ) : null}
            {status !== "ENDED" ? (
              <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => void change("ENDED", "Đã kết thúc kế hoạch")}>
                {busy === "ENDED" ? <Loader2 className="animate-spin" /> : <CircleStop />} Kết thúc
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="text-muted-foreground grid gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
        <span>Lần bảo trì kế tiếp: <span className="text-foreground">{status === "ENDED" ? "—" : record?.nextDueDate ? formatPlainDate(record.nextDueDate) : "—"}</span></span>
        <span>Lần gần nhất: <span className="text-foreground">{record?.lastDoneDate ? formatPlainDate(record.lastDoneDate) : "Chưa có"}</span></span>
        <span>Nhắc trước: <span className="text-foreground">{record?.remindDays?.length ? record.remindDays.slice().sort((a: number, b: number) => b - a).map((d: number) => `${d} ngày`).join(", ") : "Không nhắc"}</span></span>
      </CardContent>
    </Card>
  );
}

/** Dưới hồ sơ kế hoạch: trạng thái, ghi nhận đã bảo trì, rồi các phiếu bảo dưỡng đã làm theo kế hoạch này. */
function MaintenancePlanBelow({ record }: { record: any }) {
  return (
    <>
      <PlanApprovalCard record={record} />
      <PlanStatusCard record={record} />
      <MaintenanceDone record={record} />
      <RelatedVouchers resource="maintenance_plans" id={record?.id} />
    </>
  );
}

export const MAINTENANCE_EXTRA = {
  section: { title: "Kế hoạch bảo trì" },
  // Kế hoạch tạo ra là được nhắc trước hạn, không có nút bật / tắt: không dùng nữa thì xoá kế hoạch.
  hideActive: true,
  defaults: {
    school: { id: null },
    code: "",
    target: "EQUIPMENT",
    assetScope: "assets",
    facilityKind: "building",
    building: { id: null },
    maintenanceType: "",
    workContent: "",
    equipments: [],
    room: { id: null },
    frequency: "SEMI_ANNUAL",
    intervalDays: "",
    endDate: null,
    remindDays: [7, 1],
    // Getter: tính lúc form mount, không chốt lúc tải trang.
    get nextDueDate() {
      return todayLocal();
    },
    responsible: { id: null },
  },
  // Trang có bố cục riêng (`FormBody`); `Fields` vắng — không còn nơi nào vẽ khung danh mục chung cho nó.
  Fields: () => null,
  FormBody: MaintenanceFormBody,
  FormSide: MaintenanceFormSide,
  // Mã ngắn (BT-MC-412): cột hẹp cố định. Mặc định cột Mã chia đôi phần dư với cột Tên, nên cột chữ
  // thật sự cần chỗ (tài sản / phòng) bị ép còn một mẩu và nhãn "Quá hạn" bị cắt.
  codeSize: 140,
  columns: [
    {
      id: "target",
      header: "Đối tượng",
      enableSorting: false,
      size: 240,
      meta: { fill: true },
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2">
          {row.original.target === "FACILITY" ? <Badge variant="neutral">Công trình</Badge> : null}
          <span className="truncate" title={(row.original.equipments ?? []).map((a: PlanAsset) => `${a.code} — ${a.name}`).join("\n") || undefined}>{targetOf(row.original)}</span>
        </span>
      ),
    },
    {
      id: "frequency",
      header: "Chu kỳ",
      enableSorting: false,
      size: 130,
      cell: ({ row }) => frequencyText(row.original),
    },
    {
      id: "maintenanceType",
      header: "Loại",
      enableSorting: false,
      size: 130,
      cell: ({ row }) => MAINTENANCE_TYPE_LABELS[row.original.maintenanceType] ?? "—",
    },
    {
      id: "planStatus",
      header: "Trạng thái",
      enableSorting: false,
      size: 130,
      cell: ({ row }) => {
        // Chưa duyệt thì kế hoạch chưa có hiệu lực: nói trạng thái duyệt thay cho "Đang áp dụng".
        if ((row.original.approvalStatus ?? "APPROVED") !== "APPROVED") return <ApprovalBadge status={row.original.approvalStatus} />;
        const st = row.original.planStatus ?? "ACTIVE";
        return <Badge variant={PLAN_STATUS_VARIANT[st]}>{PLAN_STATUS_LABELS[st]}</Badge>;
      },
    },
    {
      id: "nextDueDate",
      header: "Lần tới",
      // API danh mục chỉ sắp theo mã, tên, thứ tự.
      enableSorting: false,
      // Đủ chỗ cho ngày kèm nhãn "Sắp đến hạn".
      size: 220,
      cell: ({ row }) => <DueBadge r={row.original} />,
    },
    schoolColumn,
  ] as ColumnDef<any, any>[],
  filters: [
    { field: "dueSoon", label: "Đến hạn", type: "select" as const, options: [{ value: "true", label: "Trong 7 ngày tới hoặc quá hạn" }] },
    { field: "approvalStatus", label: "Duyệt", type: "select" as const, options: opts(PLAN_APPROVAL_LABELS) },
    { field: "target", label: "Loại kế hoạch", type: "select" as const, options: opts(PLAN_TARGET_LABELS) },
  ],
  show: (r: any) => [
    { label: "Trường", value: r?.school?.name ?? "—" },
    { label: "Loại kế hoạch", value: PLAN_TARGET_LABELS[(r?.target ?? "EQUIPMENT") as PlanTarget] },
    { label: "Duyệt", value: <ApprovalBadge status={r?.approvalStatus} /> },
    ...(r?.target === "FACILITY" ? [{ label: "Khối nhà", value: r?.building?.name ?? "—" }] : []),
    {
      label: (r?.equipments?.length ?? 0) > 1 ? `Thiết bị (${r.equipments.length})` : "Thiết bị",
      value: r?.equipments?.length ? (
        <ul className="max-h-40 space-y-0.5 overflow-y-auto">
          {r.equipments.map((a: PlanAsset) => (
            <li key={a.id}><span className="font-mono text-xs">{a.code}</span> — {a.name}</li>
          ))}
        </ul>
      ) : "—",
    },
    { label: r?.target === "FACILITY" ? "Phòng, hạng mục" : "Phòng", value: r?.room?.name ?? "—" },
    { label: "Loại bảo trì", value: MAINTENANCE_TYPE_LABELS[r?.maintenanceType] ?? "—" },
    { label: "Nội dung công việc", value: r?.workContent ?? "—" },
    { label: "Chu kỳ", value: frequencyText(r) },
    { label: "Lần tới", value: <DueBadge r={r} /> },
    { label: "Ngày kết thúc kế hoạch", value: r?.endDate ? formatPlainDate(r.endDate) : "Không giới hạn" },
    { label: "Lần gần nhất", value: r?.lastDoneDate ? formatPlainDate(r.lastDoneDate) : "—" },
    { label: "Người phụ trách", value: r?.responsible?.name ?? "—" },
  ],
  ShowBelow: MaintenancePlanBelow,
  ListActions: MaintenanceApprovalButton,
};
