import { useCan, useGetIdentity, useInvalidate, useList, useMany, useNavigation, useNotification } from "@refinedev/core";
import { Loader2, Save, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";

import { kyInstance } from "@/shared/api/data";
import { DateInput } from "@/shared/components/form/date-input";
import { PendingAttachments, usePendingAttachments } from "@/shared/components/voucher/pending-attachments";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { VoucherDetailsFields } from "@/shared/components/voucher/voucher-details";
import { CompletionList, SideFact, SideSection, StepTitle, VoucherTwoColumn } from "@/shared/components/voucher/voucher-layout";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { useVoucherForm } from "@/shared/hooks/use-voucher-form";
import { errorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Textarea } from "@/shared/ui/textarea";
import { SchoolField } from "@/shared/components/form/school-field";
import { RefField } from "@/shared/components/catalog/ref-field";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { IntakeLinesEditor, lineSaveProblem } from "./lines-editor";
import { IntakeOriginFields } from "./origin-field";
import { intakeReadiness, type ReadinessItem } from "./readiness";
import { dateRules, maxLengthOf, mergeRules, textRules } from "@/shared/lib/field-rules";

/* eslint-disable @typescript-eslint/no-explicit-any */

const money = new Intl.NumberFormat("vi-VN");

/**
 * Thân form Lập / Sửa phiếu nhập — HAI CỘT:
 *
 * <ul>
 *   <li>trái: bốn khối đọc từ trên xuống như điền một tờ phiếu — thông tin phiếu (ngày, người giao,
 *       ghi chú), thiết bị nhận (bấm dòng mở hộp chi tiết của dòng), biên bản giao nhận (tuỳ chọn,
 *       khai thẳng trên form), tệp đính kèm;</li>
 *   <li>phải, dính khi cuộn và GỌN để hai nút luôn trong màn hình: số phiếu, người lập, tổng tiền,
 *       "cần hoàn thiện" — mỗi mục bấm là mở đúng chỗ phải sửa — và hai nút Lưu nháp · Trình.</li>
 * </ul>
 *
 * <p>"Trình" = lưu rồi trình trong một lần bấm; chỉ bật khi danh sách "cần hoàn thiện" trống, cùng
 * luật máy chủ kiểm lúc trình.
 */
export function IntakeFormBody({ record, onFinish }: {
  record?: any;
  onFinish: (values: any) => Promise<any> | void;
}) {
  const form = useFormContext();
  const { control } = form;
  useDefaultSchoolYear(!record);
  const { show } = useNavigation();
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const config = useVoucherForm("equipment_intakes");
  const [fundingSource, lines, details, schoolId, originId, originNote, acquisitionMethod, acquisitionNoteHead] = useWatch({
    control,
    name: ["fundingSource", "lines", "details", "school.id", "originSource.id", "originNote", "acquisitionMethod", "acquisitionNoteHead"],
  });
  const rule = useOriginRules().ruleOf(originId);
  const { data: me } = useGetIdentity<{ fullName?: string; username?: string }>();
  const creator = record?.createdBy?.name ?? (record ? undefined : (me?.fullName ?? me?.username));
  const [editing, setEditing] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  // Lãnh đạo trường là người DUYỆT phiếu nhập — không có nút Trình (QLTB-386); phiếu đã lưu thì theo
  // danh sách hành động máy chủ trả về.
  const canApprove = useCan({ resource: "equipment_intakes", action: "approve" }).data?.can ?? false;
  const { perspective } = usePerspective();
  const maySubmit = record ? (record._actions ?? ["submit"]).includes("submit") : !(canApprove && perspective === "school");

  // Đọc ĐÚNG các thiết bị mà các dòng đang dùng — danh mục có hơn một nghìn thiết bị.
  const rows = (lines ?? []) as any[];
  const catalogIds: number[] = [...new Set(rows.map((l: any) => Number(l?.catalog?.id)).filter((id: number) => Number.isFinite(id) && id > 0))];
  const { result: catalogList } = useMany<any>({
    resource: "equipment_catalogs",
    ids: catalogIds,
    queryOptions: { enabled: catalogIds.length > 0 },
  });
  const catalogs = new Map<number, any>((catalogList?.data ?? []).map((c: any) => [c.id, c]));
  const schoolPicked = useWatch({ control, name: "school.id" });
  const items = [
    // Tài khoản phải CHỌN trường (quản trị, Sở, UBND) — ô đầu tiên của phiếu, như mọi phiếu khác.
    ...(!record && perspective !== "school" ? [{ key: "school", label: "Trường", ok: schoolPicked != null && schoolPicked !== "" }] : []),
    ...intakeReadiness(
      { fundingSource, lines, details, originSource: { id: originId }, originNote, acquisitionMethod, acquisitionNoteHead },
      (l) => (l?.catalog?.id ? catalogs.get(Number(l.catalog.id)) : undefined),
      config,
      rule,
    ),
  ];
  const missing = items.filter((i) => !i.ok);
  const totalReceived = rows.reduce((s, l) => s + Number(l?.receivedQuantity ?? 0), 0);
  const totalAmount = rows.reduce((s, l) => s + Number(l?.unitPrice ?? 0) * Number(l?.receivedQuantity ?? 0), 0);
  const unpriced = rows.filter((l) => l?.unitPrice == null || l.unitPrice === "").length;
  const linesError = (form.formState.errors.lines as any)?.root?.message as string | undefined;

  /** Không lưu được (dòng chưa có thiết bị, lệch không lý do…): mở thẳng dòng đầu tiên dính lỗi. */
  const onInvalid = () => {
    const bad = rows.findIndex((l) => lineSaveProblem(l));
    if (bad >= 0) setEditing(bad);
  };

  const pending = usePendingAttachments("equipment_intakes");
  // Tệp chọn lúc lập phiếu được đẩy lên ngay sau khi phiếu có id.
  const finish = async (values: any) => {
    const res: any = await onFinish(values);
    await pending.uploadTo(res?.data?.id);
    return res;
  };

  const save = form.handleSubmit(async (values) => {
    setBusy("save");
    try {
      await finish(values);
    } finally {
      setBusy(null);
    }
  }, onInvalid);

  const saveAndSubmit = form.handleSubmit(async (values) => {
    setBusy("submit");
    let id: number | undefined;
    try {
      // Lưu hỏng thì Refine đã tự báo lỗi — chỉ dừng lại.
      const res: any = await finish(values).catch(() => null);
      id = res?.data?.id ?? record?.id;
      if (!res || !id) return;
      await kyInstance.post(`equipment_intakes/${id}/submit`, { json: { note: null } });
      open?.({ type: "success", message: "Đã trình phiếu, chờ lãnh đạo trường duyệt" });
      invalidate({ resource: "equipment_intakes", invalidates: ["list", "detail"], id });
      show("equipment_intakes", id, "replace");
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error), description: "Đã lưu nháp nhưng chưa trình được" });
    } finally {
      setBusy(null);
    }
  }, onInvalid);

  const main = (
    <>
      {/* Bước 1 — thông tin chung nằm ĐẦU cột chính, đúng thứ tự người ta điền một tờ phiếu; trước
          đây các ô này nằm trong thẻ bên phải, đẩy nút Lưu / Trình xuống dưới mép màn hình. */}
      <Card className="gap-4 px-4 py-4">
        <StepTitle title="Thông tin phiếu" />
        <div className="form-flow">
          {/* Ô Trường chỉ hiện khi phải CHỌN (Sở, UBND, quản trị); tài khoản của một trường và màn sửa
              thì trường đã cố định — một ô khoá đứng đầu form chỉ chiếm chỗ và giành con trỏ. */}
          <div className="empty:hidden">
            <SchoolField control={control} record={record} hideWhenLocked wide required />
          </div>
          <FormField
            control={control}
            name="intakeDate"
            rules={mergeRules(dateRules("ANY", "Ngày nhập"), { required: "Nhập ngày nhập" })}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ngày nhập</FormLabel>
                <FormControl>
                  <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <RefField control={control} name="schoolYear" resource="school_years" label="Năm học" required current={record?.schoolYear ?? undefined} />
          {/* Nguồn hình thành: của CẢ PHIẾU, và là ô quyết định các ô nguồn ở từng dòng. */}
          <div id="intake-origin" className="contents">
            <IntakeOriginFields control={control} record={record} />
          </div>
          <FormField
            control={control}
            name="note"
            rules={textRules("NOTE", "Ghi chú")}
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Ghi chú</FormLabel>
                <FormControl>
                  <Textarea rows={1} className="min-h-9" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name}
                    maxLength={maxLengthOf("NOTE")} placeholder="Dự án, đợt cấp phát… (không bắt buộc)" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <IntakeLinesEditor
          control={control}
          catalogs={catalogs}
          editing={editing}
          onEdit={setEditing}
          picking={picking}
          onPicking={setPicking}
          headFunding={fundingSource}
        />
      </Card>

      {/* Biên bản hiện thẳng trên form — sáu ô tuỳ chọn không đáng một nút và một hộp thoại. */}
      <Card className="@container gap-0 px-4 py-4 empty:hidden">
        <Controller
          control={control}
          name="details"
          render={({ field }) => (
            <VoucherDetailsFields
              config={config}
              value={field.value}
              onChange={field.onChange}
              schoolId={schoolId ?? record?.school?.id}
              title="Biên bản giao nhận"
              hint="Người giao bắt buộc, còn lại không bắt buộc"
            />
          )}
        />
      </Card>

      {record?.id ? (
        <AttachmentsPanel
          resource="equipment_intakes"
          recordId={record.id}
          canWrite
          compact
          description="Biên bản giao nhận và giấy tờ chung của phiếu. Hoá đơn của dòng nào thì bấm vào dòng đó để đính kèm."
        />
      ) : (
        <PendingAttachments files={pending.files} onChange={pending.setFiles} />
      )}
    </>
  );

  const side = (
    <Card className="gap-0 py-0">
      <SideSection title="Phiếu ghi tăng">
        <SideFact label="Số phiếu">
          {record?.code ? <span className="font-mono">{record.code}</span> : <span className="text-muted-foreground font-normal">Cấp khi duyệt</span>}
        </SideFact>
        <SideFact label="Người lập">{creator}</SideFact>
      </SideSection>

      <SideSection title="Tổng cộng">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{rows.length && unpriced === rows.length ? "—" : `${money.format(totalAmount)} đ`}</div>
        <p className="text-muted-foreground text-xs tabular-nums">
          {rows.length} dòng · {totalReceived} đơn vị{unpriced && unpriced < rows.length ? ` · ${unpriced} dòng chưa có đơn giá` : ""}
        </p>
      </SideSection>

      <SideSection title={missing.length ? `Cần hoàn thiện (${missing.length})` : "Kiểm tra trước khi trình"}>
        <CompletionList
          showDone
          items={items.map((i: ReadinessItem) => ({
            ...i,
            onClick: i.ok
              ? undefined
              : i.key === "school"
                ? () => [...document.querySelectorAll("label")].find((l) => l.textContent?.replace("*", "").trim() === "Trường")
                  ?.parentElement?.querySelector<HTMLElement>("button")?.click()
              : i.origin
                ? () => document.querySelector<HTMLElement>("#intake-origin button, #intake-origin input")?.focus()
                : i.head
                ? () => [...document.querySelectorAll("label")].find((l) => l.textContent?.replace("*", "").trim() === "Người giao")
                  ?.parentElement?.querySelector<HTMLElement>("input")?.focus()
                : i.lines?.length
                  ? () => setEditing(i.lines![0])
                  : i.key === "lines"
                    ? () => setPicking(true)
                    : undefined,
          }))}
        />
      </SideSection>

      <SideSection className="space-y-2">
        {linesError ? <p className="text-destructive text-xs">{linesError}</p> : null}
        <div className={maySubmit ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
          <Button type="button" variant={maySubmit ? "outline" : "default"} disabled={busy != null} onClick={() => void save()}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
            Lưu nháp
          </Button>
          {maySubmit ? (
            <Button type="button" disabled={busy != null || missing.length > 0}
              title={missing.length ? "Hoàn thiện các mục ở trên rồi trình" : "Lưu và trình lãnh đạo trường duyệt"}
              onClick={() => void saveAndSubmit()}>
              {busy === "submit" ? <Loader2 className="animate-spin" /> : <Send />}
              Trình
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground text-center text-xs">Lãnh đạo trường duyệt thì tài sản được ghi tăng.</p>
      </SideSection>
    </Card>
  );

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void save(); }}
      // Enter trong một ô không lưu phiếu: lưu là việc của nút, gõ dở một ô số mà phiếu đã đi là mất chỗ.
      onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault(); }}
      className="w-full"
    >
      <VoucherTwoColumn main={main} side={side} />
    </form>
  );
}

/**
 * Năm học đi theo ngày nhập (QLTB-390): năm học chứa ngày nhập, không có thì năm học hiện hành — cho tới khi
 * người lập TỰ CHỌN một năm học khác với năm máy vừa điền, từ đó giữ lựa chọn của họ. Không dựa vào cờ "dirty"
 * của ô: `Select` của Radix bắn lại giá trị qua `onChange` mỗi lần máy điền, nên ô luôn thành dirty.
 * Màn sửa giữ năm học đã lưu. Máy chủ điền theo cùng luật khi trống.
 */
function useDefaultSchoolYear(creating: boolean) {
  const { control, setValue } = useFormContext();
  const [yearId, intakeDate] = useWatch({ control, name: ["schoolYear.id", "intakeDate"] });
  const { result } = useList<any>({ resource: "school_years", pagination: { pageSize: 50 } });
  const years = result?.data;
  const auto = useRef<number | null>(null);
  useEffect(() => {
    if (!years?.length) return;
    if (!creating && yearId) return;
    // Người lập đã chọn tay một năm khác năm máy điền: không đè lên.
    if (yearId && auto.current != null && Number(yearId) !== auto.current) return;
    const day = String(intakeDate ?? "");
    const hit = years.find((y) => day && y.startDate <= day && day <= y.endDate) ?? (yearId ? null : years.find((y) => y.current));
    if (hit && hit.id !== Number(yearId)) {
      auto.current = hit.id;
      setValue("schoolYear", { id: hit.id });
    } else if (hit && auto.current == null) {
      auto.current = hit.id;
    }
  }, [creating, yearId, intakeDate, years, setValue]);
}
