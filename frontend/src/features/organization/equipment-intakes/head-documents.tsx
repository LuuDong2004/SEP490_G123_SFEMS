import { useList } from "@refinedev/core";
import { FileSearch, Lock, Upload } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useController, useFormContext, useWatch, type Control } from "react-hook-form";

import { ChoiceWithNote } from "@/shared/components/form/choice-with-note";
import { DateInput } from "@/shared/components/form/date-input";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { dateRules, maxLengthOf, mergeRules, textRules } from "@/shared/lib/field-rules";
import { Button } from "@/shared/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";
import { FUNDING_LABELS, FUNDING_OPTIONS, OTHER_ACQUISITION_CODE } from "@/domains/equipment/types";
import { SchoolField } from "@/features/organization/resources/school-field";
import { AcquisitionChoice } from "./acquisition-choice";
import { IntakeOriginFields } from "./origin-field";
import { isPurchaseCode } from "./readiness";
import { docMetaOf, documentDateRules, documentNoRules, headFieldsOf } from "./head-fields";
import { SectionHead } from "./section-head";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Thẻ "Thông tin phiếu" — hai tầng (mẫu chốt 13/11/2026):
 *
 * <ol>
 *   <li>hàng đầu, luôn bốn ô: nguồn hình thành, nguồn kinh phí (khoá / bắt buộc theo nguồn), ngày nhập, năm học (tự
 *       theo ngày nhập). Nguồn hình thành chọn MỘT lần ở đây; mọi ô phía dưới đi theo nó;</li>
 *   <li>khối chứng từ của nguồn đó, nền nhạt, tên khối đổi theo nguồn ("Hoá đơn mua hàng", "Quyết định điều chuyển"…):
 *       bên khai (rộng hai cột), số, ngày — nguồn nào cũng một khuôn nên hàng luôn đủ; mua sắm thêm hình thức mua
 *       sắm. Tệp chứng từ không ở đây mà ở cuối khối Giao nhận.</li>
 * </ol>
 *
 * Chứng từ khai MỘT LẦN ở đây, áp cho mọi dòng.
 */
export function IntakeSourceCard({ control, record, chooseSchool, onViewFiles, onUpload, filesCount, open, onToggle, summary }: {
  control: Control<any>;
  record?: any;
  /** Tài khoản phải chọn trường (Sở, UBND, quản trị) khi lập phiếu. */
  chooseSchool: boolean;
  onViewFiles: () => void;
  /** Chưa có tệp: nút "Tải tệp" đưa tệp vào ô tệp của phiếu (chờ lưu, hoặc tải lên ngay nếu phiếu đã lưu). */
  onUpload: (files: File[]) => void;
  filesCount: number;
  /** Khối đang mở; thu gọn thì chỉ còn tên khối và `summary` (các ô vẫn giữ trên form, chỉ ẩn đi). */
  open: boolean;
  onToggle: () => void;
  summary: ReactNode;
}) {
  const { setValue } = useFormContext();
  const { origins, ruleOf } = useOriginRules();
  const originId = useWatch({ control, name: "originSource.id" });
  const rule = ruleOf(originId);
  const code = origins.find((o) => String(o.id) === String(originId ?? ""))?.code;
  const head = headFieldsOf(code);
  const doc = docMetaOf(code);
  // Cùng truy vấn với `useDefaultSchoolYear` của form (cùng khoá) — không gọi thêm lần nào.
  const schoolYearId = useWatch({ control, name: "schoolYear.id" });
  const { result: yearList } = useList<any>({ resource: "school_years", pagination: { pageSize: 50 } });
  const schoolYearName: string | undefined = yearList?.data?.find((y: any) => String(y.id) === String(schoolYearId ?? ""))?.name
    ?? record?.schoolYear?.name;
  const purchase = isPurchaseCode(code);
  const headAcquisition = useWatch({ control, name: "acquisitionMethod" }) as { id?: number | null; code?: string | null } | undefined;
  const headAcquisitionNote = useWatch({ control, name: "acquisitionNoteHead" }) as string | undefined;
  const { field: funding } = useController({ control, name: "fundingSource" });
  const { fieldState: acquisitionNoteState } = useController({
    control, name: "acquisitionNoteHead",
    rules: headAcquisition?.code === OTHER_ACQUISITION_CODE ? textRules("SHORT_TEXT", "Ghi rõ hình thức mua sắm", { max: 200, min: 5 }) : undefined,
  });
  const allowed = rule?.fundingSources ?? FUNDING_OPTIONS;
  const fundingOptions = [
    ...(funding.value && !allowed.includes(funding.value) ? [{ value: funding.value, label: `${FUNDING_LABELS[funding.value] ?? funding.value} (không còn phù hợp)` }] : []),
    ...FUNDING_OPTIONS.filter((v) => allowed.includes(v)).map((v) => ({ value: v, label: FUNDING_LABELS[v] })),
  ];
  // Nguồn chỉ cho MỘT nguồn kinh phí (được điều chuyển → ngân sách, tặng → tài trợ): ô khoá, máy chủ tự điền.
  const fixedFunding = rule && allowed.length === 1 ? allowed[0] : null;
  // Máy điền thì máy gỡ: đổi sang nguồn không khoá (tặng → kiểm kê thừa) mà ô vẫn đang là giá trị máy điền thì xoá,
  // không để "Tài trợ" đi theo một phiếu kiểm kê thừa.
  const autoFunding = useRef<string | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (fixedFunding) {
      autoFunding.current = fixedFunding;
      if (funding.value !== fixedFunding) setValue("fundingSource", fixedFunding, { shouldDirty: true, shouldValidate: true });
    } else if (autoFunding.current) {
      if (funding.value === autoFunding.current) setValue("fundingSource", null, { shouldDirty: true, shouldValidate: true });
      autoFunding.current = null;
    }
  }, [fixedFunding, funding.value, setValue]);
  const hasDocFields = !!(head.supplier || head.documentNo || head.documentDate || rule?.acquisitionMethod);

  return (
    // Hai lưới (thông tin phiếu, chứng từ) chung một khuôn cột: cột 3 là cột NGÀY (ngày nhập / ngày chứng từ), rộng
    // đúng ô ngày — không thừa khoảng trống sau ô ngày, và hai hàng vẫn thẳng cột. Các cột khác có TRẦN theo nội dung
    // (tên nguồn dài nhất, "Năm học 2026-2027"): màn rộng thì phần thừa để trống bên phải, ô không kéo dài ngoằng.
    <div style={{ "--head-cols": "minmax(0,17rem) minmax(0,17rem) 10rem minmax(0,13rem)" } as CSSProperties}>
      <div className={cn("px-5", open ? "space-y-4 pt-4 pb-6" : "py-4")}>
        <SectionHead title="Thông tin phiếu" open={open} onToggle={onToggle} summary={summary} />
        {/* Thu gọn chỉ ẨN các ô — gỡ ra thì luật kiểm của ô mất theo và phiếu lưu được khi đang sai. */}
        <div className={cn("grid items-start gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-(--head-cols)", !open && "hidden")}>
          {chooseSchool ? (
            <div className="empty:hidden sm:col-span-2 lg:col-span-4 lg:max-w-[calc(50%-0.5rem)]" data-field="school">
              <SchoolField control={control} record={record} hideWhenLocked wide required />
            </div>
          ) : null}
          <div className="min-w-0" id="intake-origin" data-field="originSource.id">
            <IntakeOriginFields control={control} record={record} />
          </div>
          <FormField
            control={control}
            name="fundingNoteHead"
            rules={funding.value === "OTHER" ? textRules("SHORT_TEXT", "Ghi rõ nguồn kinh phí", { max: 200, min: 5 }) : undefined}
            render={({ field: note, fieldState }) => (
              <FormItem data-field="fundingSource">
                <FormLabel required={rule?.fundingRequired === "ALWAYS" || undefined}>Nguồn kinh phí</FormLabel>
                <ChoiceWithNote
                  value={funding.value ?? ""}
                  options={fundingOptions}
                  otherValue="OTHER"
                  disabled={!rule || !!fixedFunding}
                  clearable={!fixedFunding}
                  invalid={!!fieldState.error}
                  placeholder={rule ? "Vui lòng chọn nguồn kinh phí" : "Chọn nguồn hình thành trước"}
                  notePlaceholder="Nguồn khác: ghi rõ"
                  noteMax={maxLengthOf("SHORT_TEXT", 200)}
                  onChange={(v) => {
                    funding.onChange(v || null);
                    if (v !== "OTHER") setValue("fundingNoteHead", "", { shouldDirty: true });
                  }}
                  note={note.value}
                  onNoteChange={note.onChange}
                  onNoteBlur={note.onBlur}
                />
                {/* Ô bị khoá theo nguồn thì không cần dòng giải thích (trưởng nhóm 13/11/2026). */}
                {!fixedFunding && rule?.fundingRequired === "WHEN_COST" ? <p className="text-muted-foreground text-xs">Bắt buộc khi có chi phí</p> : null}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="intakeDate"
            rules={mergeRules(dateRules("PAST_OR_TODAY", "Ngày nhập"), { required: "Nhập ngày nhập", deps: ["documentDate"] })}
            render={({ field }) => (
              <FormItem data-field="intakeDate">
                <FormLabel required>Ngày nhập</FormLabel>
                <FormControl>
                  <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Năm học KHÔNG chọn được: nó là năm học chứa ngày nhập (máy chủ cũng tự đặt như vậy) — chọn được thì
              phiếu nhập hôm nay lại rơi vào một năm học đã qua và báo cáo theo năm đếm sai. Đổi ngày nhập là đổi năm. */}
          <div className="grid gap-2" data-field="schoolYear">
            <Label>Năm học</Label>
            <div className="relative">
              <Input disabled value={schoolYearName ?? ""} placeholder="Theo ngày nhập" aria-label="Năm học" className="pe-8" />
              <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2" />
            </div>
          </div>
        </div>
      </div>

      {/* Nguồn không có ô chứng từ (kiểm kê thừa, tự làm): không có khối này. Tệp chứng từ ở cuối khối Giao nhận. */}
      {hasDocFields ? (
      <div className={cn("space-y-5 rounded-b-xl px-5 pt-2 pb-6", !open && "hidden")}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="text-base leading-6 font-semibold">{doc.title}</h3>
            {/* Chưa có tệp thì là nút TẢI tệp (trưởng nhóm 13/11/2026) — nút "Xem tệp" bị khoá không làm gì được;
                có tệp rồi thì xem ở ngăn bên phải. */}
            {filesCount ? (
              <Button type="button" variant="outline" size="sm" className="ms-auto" onClick={onViewFiles}
                title="Mở tệp đính kèm bên phải, vẫn gõ được form">
                <FileSearch />
                Xem tệp
              </Button>
            ) : (
              <>
                <input ref={uploadInput} type="file" multiple className="hidden"
                  onChange={(e) => {
                    const list = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (list.length) onUpload(list);
                  }} />
                <Button type="button" variant="outline" size="sm" className="ms-auto" onClick={() => uploadInput.current?.click()}
                  title={`Đính kèm ${doc.files.toLowerCase()}`}>
                  <Upload />
                  Tải tệp
                </Button>
              </>
            )}
          </div>

          <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-(--head-cols)">
            {head.supplier ? (
              <FormField
                control={control}
                name="supplier"
                rules={textRules("SHORT_TEXT", head.supplier, { max: 200, min: 2 })}
                render={({ field }) => (
                  <FormItem data-field="supplier">
                    <FormLabel required={purchase || undefined}>{head.supplier}</FormLabel>
                    <FormControl>
                      <Input value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref}
                        maxLength={200} placeholder={purchase ? "Tên đơn vị bán hàng" : "Không bắt buộc"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            {head.documentNo ? (
              <FormField
                control={control}
                name="documentNo"
                rules={documentNoRules(head)}
                render={({ field }) => (
                  <FormItem data-field="documentNo">
                    <FormLabel required={purchase || undefined}>{head.documentNo!.label}</FormLabel>
                    <FormControl>
                      <Input value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref}
                        maxLength={head.documentNo!.invoice ? maxLengthOf("INVOICE_NO") : 100}
                        placeholder={head.documentNo!.invoice ? "VD: 0001234" : "Không bắt buộc"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            {head.documentDate ? (
              <FormField
                control={control}
                name="documentDate"
                rules={documentDateRules(head.documentDate)}
                render={({ field }) => (
                  <FormItem data-field="documentDate">
                    <FormLabel required={purchase || undefined}>{head.documentDate}</FormLabel>
                    <FormControl>
                      <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            {rule?.acquisitionMethod ? (
              <div data-field="acquisitionMethod">
                <AcquisitionChoice label="Hình thức mua sắm" clearable
                  value={headAcquisition?.id ? { ...record?.acquisitionMethod, ...headAcquisition } : null}
                  onChange={(m) => {
                    setValue("acquisitionMethod", m ? { id: m.id, code: m.code, name: m.name } : { id: null }, { shouldDirty: true });
                    if (m?.code !== OTHER_ACQUISITION_CODE) setValue("acquisitionNoteHead", "", { shouldDirty: true });
                  }}
                  note={headAcquisitionNote} onNoteChange={(n) => setValue("acquisitionNoteHead", n, { shouldDirty: true, shouldValidate: true })} />
                {acquisitionNoteState.error ? <p className="text-destructive mt-2 text-sm">{acquisitionNoteState.error.message}</p> : null}
              </div>
            ) : null}
          </div>
      </div>
      ) : null}
    </div>
  );
}
