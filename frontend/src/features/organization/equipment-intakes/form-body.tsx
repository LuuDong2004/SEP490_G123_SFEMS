import { useCan, useInvalidate, useList, useMany, useNavigation, useNotification } from "@refinedev/core";
import { Check, CircleAlert, Loader2, Save, Send, TriangleAlert } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useFormContext, useWatch } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";

import { kyInstance } from "@/shared/api/data";
import { DateField, SelectField, TextField, TextareaField } from "@/shared/components/form/simple-fields";
import { useLeaveOptions } from "@/shared/components/form/unsaved-changes-guard";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { PendingAttachments, usePendingAttachments } from "@/shared/components/voucher/pending-attachments";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { useVoucherForm } from "@/shared/hooks/use-voucher-form";
import { errorMessage } from "@/shared/lib/api-error";
import type { TextRule } from "@/shared/lib/field-rules";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { RequiredFieldsProvider } from "@/shared/ui/form";
import { FUNDING_LABELS } from "@/domains/equipment/types";
import { toPayload } from "./fields";
import { docMetaOf, isCentralized } from "./head-fields";
import { SectionHead } from "./section-head";
import { ReceiverField, ReceiverPositionField } from "./receiver-field";
import { formatPlainDate, localIsoDate, todayLocal } from "@/shared/lib/format";
import { IntakeSourceCard } from "./head-documents";
import { useDocumentFileCounts, useIntakeFiles } from "./invoice-drawer";
import { countText, documentNoun, IntakeLinesEditor, lineSaveProblem } from "./lines-editor";
import { InventoryFreezeNotice } from "@/shared/components/voucher/inventory-freeze-notice";
import { intakeReadiness, isPurchaseCode, type ReadinessGroup, type ReadinessItem } from "./readiness";

/* eslint-disable @typescript-eslint/no-explicit-any */

const money = new Intl.NumberFormat("vi-VN");

const GROUP_LABELS: Record<ReadinessGroup, string> = {
  source: "Thông tin phiếu",
  lines: "Danh sách thiết bị ghi tăng",
  handover: "Giao nhận và tệp đính kèm",
};

/** Đưa con trỏ tới một ô theo tên (`data-field`, không thì thuộc tính `name`), cuộn ô vào giữa màn hình. */
function focusField(name: string) {
  const box = document.querySelector<HTMLElement>(`[data-field="${name}"]`);
  const el = box?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, button[role=combobox], button")
    ?? document.querySelector<HTMLElement>(`[name="${name}"]`);
  (box ?? el)?.scrollIntoView({ block: "center", behavior: "smooth" });
  el?.focus({ preventScroll: true });
}

/**
 * Thân form Lập / Sửa phiếu ghi tăng — MỘT TRANG, hai cột (mẫu chốt 13/11/2026). Cột trái, từ trên xuống:
 *
 * <ol>
 *   <li>"Thông tin phiếu" (`IntakeSourceCard`): nguồn hình thành, nguồn kinh phí, ngày nhập, năm học; rồi khối chứng từ
 *       mang tên theo nguồn, kèm tệp chứng từ;</li>
 *   <li>"Danh sách thiết bị ghi tăng": ô tìm ở đầu bảng, bảng lưới, ⌄ mở chi tiết ngay dưới dòng;</li>
 *   <li>"Giao nhận": người giao, người nhận, chức vụ, kết quả kiểm tra, số biên bản, ghi chú.</li>
 * </ol>
 *
 * Cột phải dính khi cuộn: tổng giá trị và tóm tắt; "Trước khi trình" (thanh tiến độ, đúng những chỗ còn thiếu, bấm
 * là tới ô đó); "Khi được duyệt" (sẽ sinh bao nhiêu hồ sơ, bao nhiêu lô). Lưu nháp / Trình duyệt ở đầu trang
 * (`header`), không còn thanh chân đè lên nội dung.
 *
 * <p>"Trình" = lưu rồi trình trong một lần bấm; cùng luật máy chủ kiểm lúc trình.
 */
export function IntakeFormBody({ record, onFinish, header }: {
  record?: any;
  onFinish: (values: any) => Promise<any> | void;
  /** Đầu trang (Lập / Sửa) — form đưa vào đó hai nút Lưu nháp, Trình duyệt. */
  header: (actions: ReactNode) => ReactNode;
}) {
  const form = useFormContext();
  const { control } = form;
  useDefaultSchoolYear();
  const { show, list, edit } = useNavigation();
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const config = useVoucherForm("equipment_intakes");
  // Phiếu hệ thống VỪA LẬP SẴN khi chọn kế hoạch mua sắm (`?fresh=1`): người dùng chưa quyết lưu. Rời màn thì hỏi
  // "Lưu nháp?" — không lưu thì xoá phiếu đó (trưởng nhóm 14/11/2026: thoát không tự lưu nháp, về danh sách).
  const [params] = useSearchParams();
  const saved = useRef(false);
  const markSaved = () => { saved.current = true; };
  // Ghi nhận NGAY lúc mở: đường dẫn bị viết lại sau khi trang tải (mất `?fresh=1`).
  const openedFresh = useRef(params.get("fresh") === "1");
  // Cùng giá trị, đọc được lúc render: phiếu lập sẵn từ kế hoạch điền người nhận mặc định như lập tay (B10).
  const [freshAtOpen] = useState(() => params.get("fresh") === "1");
  const isFresh = () => openedFresh.current && record?.status === "DRAFT" && !saved.current;
  const values = useWatch({ control }) as any;
  const lines = (values.lines ?? []) as any[];
  const { origins, ruleOf } = useOriginRules();
  const originId = values.originSource?.id;
  const rule = ruleOf(originId);
  const originCode = origins.find((o) => String(o.id) === String(originId ?? ""))?.code;
  // Cấp trên (Sở / UBND) mua tập trung rồi giao về — `details.centralized` (trưởng nhóm 17/11/2026).
  const centralized = isCentralized(originCode, values.details?.centralized);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [reveal, setReveal] = useState<{ index: number; at: number } | null>(null);
  // Ba khối thu gọn được (trưởng nhóm 13/11/2026). Bấm một mục "Trước khi trình" hay lưu hỏng thì mở hết ra rồi
  // mới tới ô — ô nằm trong khối đang thu gọn thì không cuộn tới được.
  const [opened, setOpened] = useState({ info: true, lines: true, handover: true });
  const toggle = (key: keyof typeof opened) => setOpened((o) => ({ ...o, [key]: !o[key] }));
  // Mở mọi hoá đơn đang thu gọn: ô cần tới có thể nằm trong một hoá đơn.
  const [expandAt, setExpandAt] = useState(0);
  const openAll = (then: () => void) => {
    setOpened({ info: true, lines: true, handover: true });
    setExpandAt(Date.now());
    setTimeout(then, 0);
  };
  // Lãnh đạo trường là người DUYỆT phiếu nhập — không có nút Trình; phiếu đã lưu thì theo
  // danh sách hành động máy chủ trả về.
  const canApprove = useCan({ resource: "equipment_intakes", action: "approve" }).data?.can ?? false;
  const { perspective } = usePerspective();
  const maySubmit = record ? (record._actions ?? ["submit"]).includes("submit") : !(canApprove && perspective === "school");
  const chooseSchool = !record && perspective !== "school";

  // Đọc ĐÚNG các thiết bị mà các dòng đang dùng — danh mục có hơn một nghìn thiết bị.
  const catalogIds: number[] = [...new Set(lines.map((l: any) => Number(l?.catalog?.id)).filter((id: number) => Number.isFinite(id) && id > 0))];
  const { result: catalogList } = useMany<any>({
    resource: "equipment_catalogs",
    ids: catalogIds,
    queryOptions: { enabled: catalogIds.length > 0 },
  });
  const catalogs = new Map<number, any>((catalogList?.data ?? []).map((c: any) => [c.id, c]));

  const pending = usePendingAttachments("equipment_intakes");
  const documents = (values.documents ?? []) as any[];
  const documentIds = documents.map((d) => Number(d?.id)).filter((id) => Number.isFinite(id) && id > 0);
  const files = useIntakeFiles(record?.id, documentIds, pending.files);
  // Tệp của chính phiếu (quyết định giao / biên bản bàn giao khi mua tập trung) — không tính tệp hoá đơn.
  const ownFiles = useIntakeFiles(record?.id, [], pending.files);
  const docFileCounts = useDocumentFileCounts(documentIds);
  const queryClient = useQueryClient();
  const noun = documentNoun(originCode);

  // "Trước khi trình": luật máy chủ kiểm lúc trình + lỗi của từng ô đang có trên form + tệp đính kèm.
  const errors = form.formState.errors as any;
  const fieldErrors: ReadinessItem[] = [];
  const pushError = (field: string, group: ReadinessGroup) => {
    const e = field.split(".").reduce((v: any, k) => v?.[k], errors);
    if (e?.message) fieldErrors.push({ key: `err:${field}`, label: String(e.message), ok: false, group, field });
  };
  for (const f of ["originNote"]) pushError(f, "source");
  documents.forEach((_, i) => {
    for (const k of ["supplier", "contact", "documentNo", "documentDate", "fundingNote", "acquisitionNote"]) pushError(`documents.${i}.${k}`, "lines");
  });
  for (const f of (config?.sections ?? []).flatMap((s) => s.fields)) pushError(`details.${f.key}`, "handover");
  pushError("note", "handover");
  const lineErrorIndexes = Array.isArray(errors.lines) ? errors.lines.map((e: any, i: number) => (e ? i : -1)).filter((i: number) => i >= 0) : [];
  if (lineErrorIndexes.length) {
    fieldErrors.push({ key: "err:lines", label: "Ô nhập sai ở dòng thiết bị", ok: false, group: "lines", lines: lineErrorIndexes, hint: `Dòng ${lineErrorIndexes.map((i: number) => i + 1).join(", ")}` });
  }
  const items: ReadinessItem[] = [
    ...(chooseSchool ? [{ key: "school", label: "Trường", ok: values.school?.id != null && values.school?.id !== "", group: "source" as const, field: "school" }] : []),
    ...intakeReadiness(values, (l) => (l?.catalog?.id ? catalogs.get(Number(l.catalog.id)) : undefined), config, rule, {
      noun,
      hasFile: (d) => (d?.id ? (docFileCounts.get(Number(d.id)) ?? 0) > 0 : (d?.pendingFiles ?? []).length > 0),
    }),
    // Hàng mua: tệp theo từng hoá đơn (mục ở trên). Nguồn khác: ít nhất một tệp — của chứng từ hoặc ở khối Giao nhận.
    ...(centralized ? [{
      key: "files", label: "Đính kèm quyết định giao / biên bản bàn giao", group: "handover" as const, field: "attachments",
      ok: ownFiles.length > 0,
    }] : isPurchaseCode(originCode) ? [] : [{
      key: "files", label: "Đính kèm biên bản hoặc chứng từ", group: "handover" as const, field: "attachments",
      ok: files.length > 0 || documents.some((d) => (d?.pendingFiles ?? []).length > 0),
    }]),
    ...fieldErrors,
  ];
  const missing = items.filter((i) => !i.ok);
  // Thông tin phiếu chưa khai xong thì chưa thêm thiết bị (trưởng nhóm 13/11/2026): dòng thiết bị đọc nguồn hình thành,
  // nguồn kinh phí của phiếu. Chỉ các ô bắt buộc của hàng đầu — chứng từ (hoá đơn…) đòi lúc trình, không chặn ở đây.
  const headMissing = [
    chooseSchool && (values.school?.id == null || values.school?.id === "") ? "trường" : null,
    originId == null || originId === "" ? "nguồn hình thành" : null,
    rule?.noteRequired && !String(values.originNote ?? "").trim() ? "ghi rõ nguồn hình thành" : null,
  ].filter(Boolean);
  const linesLocked = headMissing.length ? `Khai ${headMissing.join(", ")} trước` : undefined;
  const total = lines.reduce((s, l) => s + Number(l?.unitPrice ?? 0) * Number(l?.receivedQuantity ?? 0), 0);
  const linesError = errors.lines?.root?.message as string | undefined;
  const fundingTotals = new Map<string, number>();
  for (const l of lines) {
    const f = documents.find((d) => d?.key === l?.docKey)?.fundingSource ?? "";
    fundingTotals.set(f, (fundingTotals.get(f) ?? 0) + Number(l?.unitPrice ?? 0) * Number(l?.receivedQuantity ?? 0));
  }
  const byFunding = [...fundingTotals.entries()];

  const go = (i: ReadinessItem) => openAll(() => {
    if (i.lines?.length) setReveal({ index: i.lines[0], at: Date.now() });
    else if (i.key === "lines" || i.key === "catalog") focusField("catalog-search");
    else if (i.field) {
      if (!i.field.startsWith("details.") && i.field !== "attachments") void form.trigger(i.field);
      focusField(i.field);
    }
  });

  /** Không lưu được: mở dòng đầu tiên dính lỗi, không thì tới ô đầu tiên báo lỗi. */
  const onInvalid = (errs: any) => openAll(() => {
    const bad = Array.isArray(errs?.lines) ? errs.lines.findIndex((e: any) => !!e) : lines.findIndex((l) => lineSaveProblem(l));
    if (bad >= 0) setReveal({ index: bad, at: Date.now() });
    else {
      const first = fieldErrors[0] ?? Object.keys(errs ?? {}).map((k) => ({ field: k } as ReadinessItem))[0];
      if (first?.field) focusField(first.field);
    }
  });

  // Tệp chọn lúc lập phiếu được đẩy lên ngay sau khi phiếu có id.
  const finish = async (formValues: any) => {
    const res: any = await onFinish(toPayload(formValues));
    await pending.uploadTo(res?.data?.id);
    await uploadDocumentFiles(formValues, res?.data);
    return res;
  };
  /** Tệp chọn ở hoá đơn CHƯA lưu: hoá đơn thứ i của form ↔ hoá đơn số i+1 của phiếu vừa lưu. */
  const uploadDocumentFiles = async (formValues: any, saved: any) => {
    const savedDocs: any[] = saved?.documents ?? [];
    const formDocs: any[] = formValues?.documents ?? [];
    for (let i = 0; i < formDocs.length; i++) {
      const list: File[] = formDocs[i]?.pendingFiles ?? [];
      const docId = savedDocs.find((x) => Number(x?.docNo) === i + 1)?.id ?? savedDocs[i]?.id;
      if (!list.length || docId == null) continue;
      for (const file of list) {
        const body = new FormData();
        body.append("resource", "equipment_intake_documents");
        body.append("recordId", String(docId));
        body.append("file", file);
        try {
          await kyInstance.post("attachments", { body });
        } catch (error) {
          open?.({ type: "error", message: await errorMessage(error), description: `Phiếu đã lưu nhưng chưa đính kèm được ${file.name}` });
        }
      }
      form.setValue(`documents.${i}.pendingFiles`, []);
      await queryClient.invalidateQueries({ queryKey: ["attachments", "equipment_intake_documents", docId] });
    }
  };

  const save = form.handleSubmit(async (formValues) => {
    setBusy("save");
    try {
      const res = await finish(formValues).catch(() => null);
      if (res) {
        markSaved();
        list("equipment_intakes");
      }
    } finally {
      setBusy(null);
    }
  }, onInvalid);

  // Hộp hỏi khi rời màn: thêm nút "Lưu nháp" (lưu rồi đi tiếp); phiếu lập sẵn mà chọn không lưu thì xoá nó.
  useLeaveOptions({
    save: () => new Promise<boolean>((resolve) => {
      void form.handleSubmit(async (formValues) => {
        const res = await finish(formValues).catch(() => null);
        if (res) markSaved();
        resolve(!!res);
      }, (errs) => {
        onInvalid(errs);
        resolve(false);
      })();
    }),
    discard: async () => {
      if (!isFresh() || !record?.id) return;
      markSaved();
      await kyInstance.delete(`equipment_intakes/${record.id}`);
      invalidate({ resource: "equipment_intakes", invalidates: ["list"] });
    },
    force: isFresh,
    // Một câu, không dòng phụ (trưởng nhóm 14/11/2026).
    title: "Thông tin phiếu ghi tăng chưa được lưu",
    message: "",
  });

  const saveAndSubmit = form.handleSubmit(async (formValues) => {
    setBusy("submit");
    let id: number | undefined;
    try {
      // Lưu hỏng thì Refine đã tự báo lỗi — chỉ dừng lại.
      const res: any = await finish(formValues).catch(() => null);
      id = res?.data?.id ?? record?.id;
      if (!res || !id) return;
      markSaved();
      await kyInstance.post(`equipment_intakes/${id}/submit`, { json: { note: null } });
      open?.({ type: "success", message: "Đã trình phiếu, chờ lãnh đạo trường duyệt" });
      invalidate({ resource: "equipment_intakes", invalidates: ["list", "detail"], id });
      show("equipment_intakes", id, "replace");
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error), description: "Đã lưu nháp nhưng chưa trình được" });
      // Lập mới mà lưu được, trình hỏng: sang màn SỬA của chính phiếu vừa lưu. Đứng lại ở màn lập thì bấm "Trình duyệt"
      // lần nữa là lưu thêm một phiếu nháp mới — mỗi lần thử lại đẻ một bản trùng.
      if (!record?.id && id) edit("equipment_intakes", id, "replace");
    } finally {
      setBusy(null);
    }
  }, onInvalid);

  // Dấu * của ô bắt buộc LÚC TRÌNH (lưu nháp không đòi): biên bản giao nhận và, với hàng mua sắm, chứng từ.
  // Cấp trên mua tập trung (trưởng nhóm 17/11/2026): quyết định giao + biên bản bàn giao của CẢ phiếu — khối riêng ở đầu
  // "Thông tin giao nhận", bắt buộc lúc trình (cùng `requireAssignment` máy chủ).
  const decisionFields = (config?.sections ?? []).filter((s) => s.when?.field === "centralized").flatMap((s) => s.fields)
    .filter((f) => f.key !== "centralized");
  const submitRequired = new Set<string>([
    ...(config?.sections ?? []).flatMap((s) => s.fields).filter((f) => f.required && !f.stage).map((f) => `details.${f.key}`),
    ...(centralized ? decisionFields.map((f) => `details.${f.key}`) : []),
  ]);
  const handoverFields = (config?.sections ?? []).filter((s) => !s.stage && !s.when).flatMap((s) => s.fields);

  // "Khi được duyệt": nói trước hệ thống sẽ sinh gì — mỗi cái một hồ sơ, mỗi dòng vật tư một lô.
  const trackingOf = (l: any) => l?.trackingType ?? catalogs.get(Number(l?.catalog?.id))?.trackingType;
  const serialUnits = lines.filter((l) => trackingOf(l) !== "bulk").reduce((s, l) => s + Number(l?.receivedQuantity ?? 0), 0);
  const bulkLines = lines.filter((l) => trackingOf(l) === "bulk" && Number(l?.receivedQuantity ?? 0) > 0).length;
  const outcome = [
    serialUnits ? `${money.format(serialUnits)} hồ sơ thiết bị` : null,
    bulkLines ? `${bulkLines} lô vật tư` : null,
  ].filter(Boolean).join(" và ");
  const originName = origins.find((o) => String(o.id) === String(originId ?? ""))?.name;
  const doc = docMetaOf(originCode);
  const done = items.length - missing.length;
  const join = (parts: unknown[]) => parts.filter((x) => x != null && x !== "").join(" · ");
  /** Chỗ còn thiếu trong dòng tóm tắt in chữ đỏ — thu gọn khối vẫn thấy ngay cần khai gì. */
  const missingText = (text: string) => <span className="text-destructive">{text}</span>;
  const infoParts: ReactNode[] = [
    originName ? (values.originNote ? `${originName} (${values.originNote})` : originName) : missingText("Chưa chọn nguồn hình thành"),
    `Lập ngày ${formatPlainDate(record?.createdAt ? localIsoDate(new Date(record.createdAt)) : todayLocal())}`,
  ].filter((x) => x != null);
  const dotted = (parts: ReactNode[]) => parts.map((p, i) => <Fragment key={i}>{i ? " · " : null}{p}</Fragment>);
  const infoSummary = dotted(infoParts);
  const handoverSummary = dotted([
    join(handoverFields.map((f) => values.details?.[f.key])) || missingText("Chưa khai"),
    files.length ? `${files.length} tệp` : missingText("Chưa có tệp"),
  ]);
  // Ghi chú lấp nốt hàng cuối của lưới bốn cột, không đứng riêng một hàng dài.
  // Khối Giao nhận chia hai bên + phần chung; ô nào cấu hình thêm mà không thuộc hai bên thì vào phần chung.
  const GIVER_KEYS = ["deliveredBy", "delivererPhone"];
  const RECEIVER_KEYS = ["receiverName", "receiverPosition"];
  const giverFields = handoverFields.filter((f) => GIVER_KEYS.includes(f.key));
  const receiverFields = handoverFields.filter((f) => RECEIVER_KEYS.includes(f.key));
  const commonFields = handoverFields.filter((f) => !GIVER_KEYS.includes(f.key) && !RECEIVER_KEYS.includes(f.key));
  const noteSpan = ["lg:col-span-4", "lg:col-span-3", "lg:col-span-2", "lg:col-span-1"][commonFields.length % 4];
  const handoverField = (f: (typeof handoverFields)[number]) => f.key === "receiverName" ? (
    <ReceiverField key={f.key} control={control} schoolId={values.school?.id ?? null} creating={!record || freshAtOpen}
      label={f.label} max={f.max} min={f.min} />
  ) : f.key === "receiverPosition" ? (
    <ReceiverPositionField key={f.key} control={control} label={f.label} />
  ) : f.kind === "date" ? (
    <DateField key={f.key} control={control} name={`details.${f.key}`} label={f.label} dateRule={f.date === "past" ? "PAST_OR_TODAY" : "ANY"} />
  ) : f.kind === "enum" ? (
    <SelectField key={f.key} control={control} name={`details.${f.key}`} label={f.label}
      placeholder={`Vui lòng chọn ${f.label.toLowerCase()}`}
      options={(config?.enums?.[f.enum ?? ""] ?? []).map((o) => ({ value: o.value, label: o.label }))} />
  ) : (
    <TextField key={f.key} control={control} name={`details.${f.key}`} label={f.label}
      rule={(f.rule as TextRule | undefined) ?? "SHORT_TEXT"} max={f.max} min={f.min}
      placeholder={f.key === "deliveredBy" ? "Họ tên người giao" : f.key === "delivererPhone" ? "VD: 0912 345 678"
        : f.key === "handoverMinutesNo" ? "VD: 15/BB-THCS" : f.key === "assignmentDecisionNo" ? "VD: 1234/QĐ-SGDĐT" : undefined} />
  );

  // Lưu nháp / Trình duyệt đứng ngay dưới "Trước khi trình" (trưởng nhóm 13/11/2026): xem còn thiếu gì rồi bấm.
  const actions = (
    <div className="grid gap-2">
      {linesError ? <span className="text-destructive text-xs">{linesError}</span> : null}
      <div className={cn("grid gap-2", maySubmit && "grid-cols-2")}>
      <Button type="button" variant={maySubmit ? "outline" : "default"} disabled={busy != null} onClick={() => void save()}>
        {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
        Lưu nháp
      </Button>
      {maySubmit ? (
        <Button type="button" disabled={busy != null || missing.length > 0}
          title={missing.length ? `Còn ${missing.length} chỗ trong "Trước khi trình"` : "Lưu và trình lãnh đạo trường duyệt"}
          onClick={() => void saveAndSubmit()}>
          {busy === "submit" ? <Loader2 className="animate-spin" /> : <Send />}
          Trình duyệt
        </Button>
      ) : null}
      </div>
    </div>
  );

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void save(); }}
      // Enter trong một ô không lưu phiếu: lưu là việc của nút, gõ dở một ô số mà phiếu đã đi là mất chỗ.
      onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault(); }}
      className="grid w-full gap-4"
    >
      {header(null)}
      {/* Trường đang kiểm kê thì trình phiếu bị chặn — nói trước, khỏi điền xong cả phiếu mới biết (KK-05). */}
      <InventoryFreezeNotice resource="equipment_intakes" />
      <RequiredFieldsProvider names={submitRequired}>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid min-w-0 gap-4">
            {/* MỘT khung cho cả phiếu (trưởng nhóm 14/11/2026: ba thẻ rời rối mắt) — ba phần ngăn bằng đường kẻ, mỗi phần
                vẫn thu gọn được. */}
            <Card className="gap-0 divide-y overflow-visible py-0">
              <IntakeSourceCard control={control} record={record} chooseSchool={chooseSchool}
                open={opened.info} onToggle={() => toggle("info")} summary={infoSummary} />

              <IntakeLinesEditor control={control} catalogs={catalogs} reveal={reveal} locked={linesLocked} intakeId={record?.id ?? null} expandAll={expandAt}
                open={opened.lines} onToggle={() => toggle("lines")} />

              <div className={cn("@container grid gap-5 px-5", opened.handover ? "pt-4 pb-6" : "py-4")}>
              <SectionHead title="Thông tin giao nhận" open={opened.handover} onToggle={() => toggle("handover")} summary={handoverSummary} />
              {centralized && decisionFields.length ? (
                <section className={cn("bg-surface-subtle grid content-start gap-3 rounded-lg border px-4 pt-3 pb-4", !opened.handover && "hidden")}>
                  <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Quyết định giao tài sản và biên bản bàn giao</h4>
                  <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,22rem)_minmax(0,14rem)_10rem_10rem]">
                    {decisionFields.map(handoverField)}
                  </div>
                </section>
              ) : null}
              {/* Hai bên ký biên bản đứng cạnh nhau (trưởng nhóm 13/11/2026): bên giao — họ tên, số điện thoại để liên hệ khi
                  hàng có vấn đề; bên nhận — người nhận, chức vụ theo hồ sơ cán bộ. Dưới là phần chung của biên bản. */}
              <div className={cn("grid items-start gap-4 lg:grid-cols-2", !opened.handover && "hidden")}>
                {([["Bên giao", giverFields], ["Bên nhận", receiverFields]] as const).map(([title, fields]) => (
                  <section key={title} className="bg-surface-subtle grid content-start gap-3 rounded-lg border px-4 pt-3 pb-4">
                    <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</h4>
                    <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2">{fields.map(handoverField)}</div>
                  </section>
                ))}
              </div>
              <div className={cn("grid items-start gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-4", !opened.handover && "hidden")}>
                {commonFields.map(handoverField)}
                <div className={cn("sm:col-span-2", noteSpan)}>
                  <TextareaField control={control} name="note" label="Ghi chú" rule="NOTE" placeholder="Không bắt buộc" rows={1}
                    className="max-w-none @2xl:max-w-none @4xl:max-w-none [&_textarea]:min-h-9" />
                </div>
              </div>
              {/* Tệp hoá đơn, biên bản đứng cuối khối Giao nhận (trưởng nhóm 13/11/2026) — cùng nhóm "Giao nhận và tệp đính
                  kèm" của "Trước khi trình". Dạng trường form, trước và sau khi lưu cùng một dáng; chỉ khác tệp lưu lúc nào. */}
              <div data-field="attachments" className={cn(!opened.handover && "hidden")}>
                {record?.id ? (
                  <AttachmentsPanel field compact resource="equipment_intakes" recordId={record.id} canWrite required={!noun || centralized} title={centralized ? "Tệp quyết định giao / biên bản bàn giao" : noun ? "Tệp khác (biên bản giao nhận…)" : doc.files}
                    hint="Bản đã ký, đóng dấu · lưu ngay khi chọn" />
                ) : (
                  <PendingAttachments field compact files={pending.files} onChange={pending.setFiles} required={!noun || centralized} title={centralized ? "Tệp quyết định giao / biên bản bàn giao" : noun ? "Tệp khác (biên bản giao nhận…)" : doc.files}
                    hint="Bản đã ký, đóng dấu · tải lên khi lưu phiếu" />
                )}
              </div>
              </div>
            </Card>
          </div>

          <aside data-print="hide" className="grid gap-4 lg:sticky lg:top-16">
            <Card className="gap-0 py-0">
              <div className="space-y-1 px-4 pt-4 pb-3.5">
                <p className="text-muted-foreground text-xs">Tổng giá trị ghi tăng</p>
                <p className="text-2xl leading-8 font-bold tracking-tight tabular-nums">{money.format(total)} đ</p>
              </div>
              <dl className="space-y-2 border-t px-4 py-3.5 text-sm">
                <SummaryFact label="Nguồn hình thành">{originName}</SummaryFact>
                <SummaryFact label="Thiết bị">{lines.length ? countText(lines) : null}</SummaryFact>
              </dl>
              {/* Một phiếu nhiều nguồn kinh phí (theo hoá đơn): cộng tiền theo từng nguồn. */}
              {byFunding.length ? (
                <dl className="space-y-1.5 border-t px-4 py-3.5 text-sm">
                  <dt className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Theo nguồn kinh phí</dt>
                  {byFunding.map(([f, v]) => (
                    <div key={f} className="flex items-baseline justify-between gap-3">
                      <dd className="text-muted-foreground min-w-0 truncate">{f ? FUNDING_LABELS[f] ?? f : "Chưa chọn nguồn"}</dd>
                      <dd className="font-medium tabular-nums">{money.format(v)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </Card>

            <Card className="gap-3 px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Trước khi trình</h3>
                {missing.length ? (
                  <span className="bg-warning-subtle text-warning-text rounded-full px-2 py-0.5 text-xs font-semibold">còn {missing.length}</span>
                ) : (
                  <span className="bg-success-subtle text-success-text rounded-full px-2 py-0.5 text-xs font-semibold">đủ để trình</span>
                )}
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
                <div className={cn("h-full rounded-full transition-[width]", missing.length ? "bg-warning" : "bg-success")}
                  style={{ width: `${Math.max(6, Math.round((done / Math.max(items.length, 1)) * 100))}%` }} />
              </div>
              <Checklist items={items} onGo={go}
                labels={{ ...GROUP_LABELS, lines: noun ? `${noun.charAt(0).toUpperCase()}${noun.slice(1)} và thiết bị` : GROUP_LABELS.lines }} />
            </Card>

            {actions}

            {outcome ? (
              // Màu cảnh báo (trưởng nhóm 14/11/2026): duyệt rồi là không sửa được — kiểm tra kỹ trước khi trình.
              <div className="bg-warning-subtle border-warning/30 space-y-1 rounded-xl border px-4 py-3.5">
                <p className="text-warning-text flex items-center gap-1.5 text-sm font-semibold"><TriangleAlert className="size-4 shrink-0" />Kiểm tra kỹ trước khi trình</p>
                <p className="text-sm leading-relaxed">Phiếu được duyệt sẽ không sửa được nữa. Hệ thống cấp số phiếu khi trình và tạo {outcome} khi phiếu được duyệt.</p>
              </div>
            ) : null}
          </aside>
        </div>
      </RequiredFieldsProvider>

    </form>
  );
}

/** Một cặp nhãn — giá trị trong thẻ tổng của cột phải; chưa có thì gạch ngang mờ. */
function SummaryFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="min-w-0 text-end font-medium break-words">{children || <span className="text-muted-foreground font-normal">Chưa nhập</span>}</dd>
    </div>
  );
}

/**
 * "Trước khi trình" theo ba khối của form: khối nào đủ thì một dòng xanh mang tên khối, khối nào thiếu thì liệt kê
 * đúng chỗ thiếu — bấm là tới ô đó (hoặc mở dòng đó).
 */
function Checklist({ items, onGo, labels = GROUP_LABELS }: { items: ReadinessItem[]; onGo: (i: ReadinessItem) => void; labels?: Record<ReadinessGroup, string> }) {
  return (
    <ul className="-mx-2 space-y-0.5">
      {(Object.keys(labels) as ReadinessGroup[]).map((group) => {
        const bad = items.filter((i) => !i.ok && (i.group ?? "lines") === group);
        if (!bad.length) {
          return (
            <li key={group} className="text-muted-foreground flex items-center gap-2 px-2 py-1.5 text-sm">
              <span className="bg-success-subtle text-success-text flex size-5 shrink-0 items-center justify-center rounded-full">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {labels[group]}
            </li>
          );
        }
        return bad.map((i) => (
          <li key={i.key}>
            <button type="button" onClick={() => onGo(i)}
              className={cn("hover:bg-muted flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start")}>
              <span className="bg-warning-subtle text-warning-text mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                <CircleAlert className="size-3" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{i.label}</span>
                {i.hint ? <span className="text-muted-foreground block text-xs">{i.hint}</span> : null}
              </span>
            </button>
          </li>
        ));
      })}
    </ul>
  );
}

/**
 * Năm học LUÔN là năm học chứa ngày nhập (trưởng nhóm 13/11/2026: không chọn được năm học đã qua) — ô Năm
 * học chỉ hiện, đổi ngày nhập là đổi năm, cả ở màn sửa. Ngày nhập không rơi vào năm học nào thì lấy năm học hiện hành.
 * Máy chủ tự đặt theo cùng luật và bỏ qua năm học form gửi lên; ở đây điền để người lập thấy ngay.
 */
function useDefaultSchoolYear() {
  const { control, setValue } = useFormContext();
  const [yearId, intakeDate] = useWatch({ control, name: ["schoolYear.id", "intakeDate"] });
  const { result } = useList<any>({ resource: "school_years", pagination: { pageSize: 50 } });
  const years = result?.data;
  useEffect(() => {
    if (!years?.length) return;
    const day = String(intakeDate ?? "");
    const hit = years.find((y) => day && y.startDate <= day && day <= y.endDate) ?? years.find((y) => y.current);
    if (hit && hit.id !== Number(yearId)) setValue("schoolYear", { id: hit.id });
  }, [yearId, intakeDate, years, setValue]);
}
