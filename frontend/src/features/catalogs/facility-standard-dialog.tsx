import { useInvalidate, useNotification } from "@refinedev/core";
import { Check, ChevronDown, Loader2, Plus, Save, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import {
  joinPerClass,
  splitPerClass,
  STANDARD_TIERS,
  STANDARD_TIER_LABELS,
  type FacilityStandardRule,
  type StandardTier,
} from "@/domains/facility/standard";
import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { maxLengthOf, numberError, type NumberRule } from "@/shared/lib/field-rules";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

import { LegalDocDialog, type LegalDocDialogState } from "./legal-doc-dialog";
import { useLegalDocs } from "./legal-doc-picker";

/** Một loại CSVC cùng các quy tắc đang lưu của nó. */
export type StandardType = { id: number; name: string; group: string; unit: string; rules: FacilityStandardRule[] };

/** Một yêu cầu — mỗi cái là một câu có ô số trong câu. */
type Cond = "count" | "perClass" | "large" | "roomArea" | "perStudent" | "total";

/** Các ô số của từng yêu cầu. */
const COND_FIELDS: Record<Cond, NumField[]> = {
  count: ["minCount"],
  perClass: ["perClasses", "perRooms"],
  large: ["largeClassFrom", "largeMinCount"],
  roomArea: ["minRoomArea"],
  perStudent: ["areaPerStudent", "studentPercent"],
  total: ["minTotalArea"],
};
const CONDS = Object.keys(COND_FIELDS) as Cond[];

const condMenu = (unit: string): Record<Cond, string> => ({
  count: `Có ít nhất … ${unit}`,
  perClass: `Cứ … lớp có … ${unit}`,
  large: `Trường trên … lớp có ít nhất … ${unit}`,
  roomArea: `Mỗi ${unit} rộng ít nhất … m²`,
  perStudent: "Tổng diện tích ít nhất … m² cho mỗi học sinh",
  total: "Tổng diện tích ít nhất … m²",
});

type NumField = "minCount" | "perRooms" | "perClasses" | "largeClassFrom" | "largeMinCount" | "minRoomArea" | "areaPerStudent"
  | "studentPercent" | "minTotalArea";

/** Một mức trên form. Ô số giữ ở dạng CHỮ như người dùng gõ. */
type Column = Record<NumField, string> & {
  /** Có yêu cầu riêng; tắt = theo mức dưới (mức Tối thiểu: không yêu cầu). */
  on: boolean;
  conds: Cond[];
  onlyIfPresent: boolean;
  legalDocuments: number[];
  legalBasis: string;
  note: string;
};

type Columns = Record<StandardTier, Column>;
type Errors = Record<string, string>;

const EMPTY: Column = {
  on: false, conds: [], minCount: "", perRooms: "", perClasses: "", largeClassFrom: "", largeMinCount: "", minRoomArea: "",
  areaPerStudent: "", studentPercent: "", minTotalArea: "", onlyIfPresent: false, legalDocuments: [], legalBasis: "", note: "",
};

const text = (v: number | string | null | undefined) => (v == null ? "" : String(Number(v)));
const vn = (v: number) => String(Math.round(v * 1000) / 1000).replace(".", ",");
const lower = (k: StandardTier) => STANDARD_TIER_LABELS[k].toLowerCase();
const below = (k: StandardTier) => STANDARD_TIERS.slice(0, STANDARD_TIERS.findIndex((t) => t.key === k)).map((t) => t.key);

function columnOf(r: FacilityStandardRule | undefined): Column {
  // Quy tắc đang ngừng dùng không nạp vào form: mức đó coi như chưa khai.
  if (!r || r.active === false) return EMPTY;
  const per = r.countPerClass == null ? null : splitPerClass(r.countPerClass);
  const col: Column = {
    ...EMPTY, on: true, minCount: text(r.minCount), perRooms: per ? String(per.rooms) : "", perClasses: per ? String(per.classes) : "",
    largeClassFrom: text(r.largeClassFrom), largeMinCount: text(r.largeMinCount), minRoomArea: text(r.minRoomArea),
    areaPerStudent: text(r.areaPerStudent), studentPercent: text(r.studentPercent), minTotalArea: text(r.minTotalArea),
    onlyIfPresent: !!r.onlyIfPresent, legalDocuments: (r.legalDocuments ?? []).map((d) => d.id), legalBasis: r.legalBasis ?? "",
    note: r.note ?? "",
  };
  return { ...col, conds: CONDS.filter((k) => COND_FIELDS[k].some((f) => col[f] !== "")) };
}

const columnsOf = (type: StandardType | null): Columns =>
  Object.fromEntries(STANDARD_TIERS.map((t) => [t.key, columnOf(type?.rules.find((r) => r.tier === t.key))])) as Columns;

/** Số của một ô, chỉ khi yêu cầu chứa nó đang có trên form. */
function num(c: Column, field: NumField): number | null {
  const cond = CONDS.find((k) => COND_FIELDS[k].includes(field))!;
  return c.on && c.conds.includes(cond) && c[field].trim() !== "" ? Number(c[field]) : null;
}

const RULES: Record<NumField, NumberRule> = {
  minCount: "COUNT", perRooms: "COUNT", perClasses: "COUNT", largeClassFrom: "COUNT", largeMinCount: "COUNT",
  minRoomArea: "DECIMAL_QUANTITY", areaPerStudent: "DECIMAL_QUANTITY", studentPercent: "PERCENT", minTotalArea: "DECIMAL_QUANTITY",
};

/** Lỗi theo `mức.yêu-cầu` (hoặc `mức.legalDocuments`, `mức.conds`). */
function check(cols: Columns): Errors {
  const out: Errors = {};
  for (const { key } of STANDARD_TIERS) {
    const c = cols[key];
    if (!c.on) continue;
    if (!c.conds.some((k) => k !== "large")) out[`${key}.conds`] = "Thêm ít nhất một yêu cầu về số lượng hoặc diện tích";
    for (const k of c.conds) {
      const fields = COND_FIELDS[k];
      const needed = fields.filter((f) => f !== "studentPercent");
      if (needed.some((f) => c[f].trim() === "")) { out[`${key}.${k}`] = "Vui lòng nhập số"; continue; }
      const bad = fields.map((f) => numberError(RULES[f], "Số", c[f])).find(Boolean);
      if (bad) { out[`${key}.${k}`] = bad; continue; }
      if (k === "perClass" && (Number(c.perClasses) < 1 || Number(c.perRooms) < 1)) out[`${key}.${k}`] = "Số từ 1 trở lên";
      if (k === "perStudent" && c.studentPercent.trim() && Number(c.studentPercent) <= 0) out[`${key}.${k}`] = "Phần trăm phải lớn hơn 0";
    }
    if (!c.legalDocuments.length) out[`${key}.legalDocuments`] = "Vui lòng chọn văn bản căn cứ";
  }
  return out;
}

const COND_OF_FIELD: Record<string, Cond> = {
  minCount: "count", countPerClass: "perClass", largeClassFrom: "large", largeMinCount: "large", minRoomArea: "roomArea",
  areaPerStudent: "perStudent", studentPercent: "perStudent", minTotalArea: "total",
};

/** Lỗi máy chủ trả theo ô: `MIN.minCount`, hay `tiers[0].minCount` của kiểm kiểu dữ liệu. */
function serverErrors(error: unknown): Errors {
  const errors = (error as { errors?: Record<string, string | string[]> })?.errors ?? {};
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => {
    const [tier, field] = k.replace(/^tiers\[(\d)\]/, (_, i) => STANDARD_TIERS[Number(i)]?.key ?? "").split(".");
    return [`${tier}.${COND_OF_FIELD[field] ?? field}`, Array.isArray(v) ? v[0] : v];
  }));
}

/** Tóm tắt một mức: "1 phòng · 24 m²/phòng" — cùng cách ghi với bảng của màn. */
function summary(c: Column, unit: string): string {
  const v = (f: NumField) => num(c, f);
  return [
    v("minCount") != null ? `${v("minCount")} ${unit}` : null,
    v("perRooms") != null && v("perClasses") != null ? `${v("perRooms")} ${unit}/${v("perClasses") === 1 ? "" : `${v("perClasses")} `}lớp` : null,
    v("largeClassFrom") != null && v("largeMinCount") != null ? `trên ${v("largeClassFrom")} lớp: ${v("largeMinCount")} ${unit}` : null,
    v("minRoomArea") != null ? `${vn(v("minRoomArea")!)} m²/${unit}` : null,
    v("areaPerStudent") != null ? `${vn(v("areaPerStudent")!)} m²/học sinh${v("studentPercent") != null ? ` (${vn(v("studentPercent")!)}% học sinh)` : ""}` : null,
    v("minTotalArea") != null ? `tổng ≥ ${vn(v("minTotalArea")!)} m²` : null,
  ].filter(Boolean).join(" · ");
}

const SAMPLE = { classes: 40, students: 1800 };

/** Trường mẫu cần gì để đạt mức `tier` — cộng dồn các mức dưới, cùng cách tính với bộ chấm. */
function example(cols: Columns, tier: StandardTier, unit: string): string | null {
  const used = [...below(tier), tier].map((k) => cols[k]).filter((c) => c.on);
  const max = (list: (number | null)[]) => list.reduce<number | null>((a, b) => (b == null || Number.isNaN(b) ? a : a == null ? b : Math.max(a, b)), null);
  const count = max(used.flatMap((c) => {
    const rooms = num(c, "perRooms");
    const classes = num(c, "perClasses");
    const from = num(c, "largeClassFrom");
    return [
      num(c, "minCount"),
      rooms && classes ? Math.ceil(joinPerClass(rooms, classes) * SAMPLE.classes - 1e-9) : null,
      from != null && SAMPLE.classes > from ? num(c, "largeMinCount") : null,
    ];
  }));
  const room = max(used.map((c) => num(c, "minRoomArea")));
  const total = max(used.flatMap((c) => {
    const per = num(c, "areaPerStudent");
    return [num(c, "minTotalArea"), per == null ? null : (per * SAMPLE.students * (num(c, "studentPercent") ?? 100)) / 100];
  }));
  const parts = [
    count != null ? `ít nhất ${count} ${unit}` : null,
    room != null ? `mỗi ${unit} từ ${vn(room)} m²` : null,
    total != null ? `tổng diện tích từ ${vn(total)} m²` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** Chọn loại CSVC theo khối, gõ để tìm — chỉ các loại CHƯA có quy định: loại đã có thì sửa ở dòng của nó. */
function TypePicker({ types, value, onChange, invalid }: {
  types: StandardType[];
  value: StandardType | null;
  onChange: (t: StandardType) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const groups = [...new Set(types.map((t) => t.group))];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" role="combobox" aria-expanded={open}
          className={cn("bg-field focus-visible:border-ring flex h-9 w-full items-center justify-between gap-2 rounded-full border px-3.5 text-sm outline-none",
            invalid && "border-destructive")}>
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value?.name ?? "Vui lòng chọn loại CSVC"}</span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <Command>
          <CommandInput placeholder="Tìm loại CSVC…" />
          <CommandList className="max-h-80">
            <CommandEmpty>{types.length ? "Không tìm thấy loại CSVC chưa có quy định." : "Mọi loại CSVC đã có quy định. Sửa ở dòng của loại đó."}</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g} heading={g}>
                {types.filter((t) => t.group === g).map((t) => (
                  <CommandItem key={t.id} value={`${t.name} ${t.id}`} onSelect={() => { onChange(t); setOpen(false); }}>
                    <Check className={cn("size-4", t.id === value?.id ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Chọn văn bản từ danh mục Văn bản căn cứ (nhiều văn bản), thêm văn bản mới ngay tại chỗ. */
function DocsPicker({ ids, onChange, readOnly, invalid, label }: {
  ids: number[];
  onChange: (ids: number[]) => void;
  readOnly: boolean;
  invalid?: boolean;
  label: string;
}) {
  const { data, refetch } = useLegalDocs();
  const [form, setForm] = useState<LegalDocDialogState>(null);
  const docs = data ?? [];
  const codeOf = (id: number) => docs.find((d) => d.id === id)?.code ?? "…";
  if (readOnly) {
    return <div className="px-1 py-1.5 text-sm">{ids.length ? ids.map((id) => <div key={id}>{codeOf(id)}</div>) : null}</div>;
  }
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={label}
            className={cn("bg-field focus-visible:border-ring flex min-h-9 w-full items-center justify-between gap-2 rounded-2xl border px-3 py-1.5 text-start text-sm outline-none",
              invalid && "border-destructive")}>
            <span className={cn("min-w-0 flex-1", !ids.length && "text-muted-foreground")}>
              {ids.length ? ids.map((id) => <span key={id} className="block truncate">{codeOf(id)}</span>) : "Chọn văn bản"}
            </span>
            <ChevronDown className="text-muted-foreground size-4 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[26rem] max-w-[calc(100vw-2rem)] p-1">
          <div className="max-h-72 overflow-y-auto">
            {docs.map((d) => (
              <label key={d.id} className="hover:bg-muted flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm">
                <Checkbox className="mt-0.5" checked={ids.includes(d.id)}
                  onCheckedChange={() => onChange(ids.includes(d.id) ? ids.filter((x) => x !== d.id) : [...ids, d.id])} />
                <span className="min-w-0">
                  <span className="font-medium">{d.code}</span>
                  <span className="text-muted-foreground line-clamp-2 text-xs">{d.name}</span>
                </span>
              </label>
            ))}
            {docs.length === 0 ? <p className="text-muted-foreground px-2 py-3 text-center text-sm">Danh mục chưa có văn bản nào.</p> : null}
          </div>
          <button type="button" className="text-primary hover:bg-muted mt-1 flex w-full items-center gap-1.5 rounded-sm border-t px-2 py-1.5 text-sm"
            onClick={() => setForm({ mode: "create" })}>
            <Plus className="size-4" />
            Thêm văn bản vào danh mục
          </button>
        </PopoverContent>
      </Popover>
      <LegalDocDialog state={form} onClose={() => setForm(null)}
        onSaved={(record) => {
          void refetch();
          onChange([...ids, record.id]);
        }} />
    </>
  );
}

/**
 * Hộp Thêm / Sửa / Xem chuẩn CSVC của MỘT loại — Sửa, Xem mở từ dòng của loại; Thêm thì chọn loại chưa có quy định (trưởng nhóm 24/11/2026: bảng 33 ô "quá khó hiểu"). Chọn mức ở ba thẻ phía
 * trên — thẻ nào cũng ghi mức đó đang đòi gì; bên dưới chỉ khai mức đang chọn, mỗi yêu cầu là một câu, cần mới thêm. Dòng ví
 * dụ tính ra số của một trường cụ thể. Lưu cả ba mức một lần.
 */
export function FacilityStandardDialog({ open, type, types, levelCode, readOnly, onClose }: {
  open: boolean;
  /** Loại đang mở; vắng = thêm mới, chọn loại trong hộp. */
  type: StandardType | null;
  /** Mọi loại của cấp học — hộp Thêm chỉ đưa ra loại chưa có quy định. */
  types: StandardType[];
  levelCode: string;
  readOnly: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open ? <Body key={type?.id ?? "new"} {...{ type, types, levelCode, readOnly, onClose }} /> : null}
    </Dialog>
  );
}

function Body({ type: initial, types, levelCode, readOnly, onClose }: {
  type: StandardType | null; types: StandardType[]; levelCode: string; readOnly: boolean; onClose: () => void;
}) {
  const [type, setType] = useState<StandardType | null>(initial);
  const [cols, setCols] = useState<Columns>(() => columnsOf(initial));
  const [tier, setTier] = useState<StandardTier>("MIN");
  const [server, setServer] = useState<Errors>({});
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();
  const found = useMemo(() => check(cols), [cols]);
  const errors: Errors = { ...(touched ? found : {}), ...server };
  const unit = type?.unit ?? "phòng";
  const c = cols[tier];
  const lowerOn = [...below(tier)].reverse().find((k) => cols[k].on);
  const offLabel = lowerOn ? `Như ${lower(lowerOn)}` : "Không yêu cầu";

  const set = (patch: Partial<Column>) => {
    setServer({});
    setCols((all) => ({ ...all, [tier]: { ...all[tier], ...patch } }));
  };
  const turn = (on: boolean) => {
    if (!on) return set({ on: false });
    // Mức vừa bật: mở sẵn câu "Có ít nhất …", lấy văn bản của mức dưới gần nhất (thường cùng thông tư).
    const from = [...below(tier)].reverse().find((k) => cols[k].legalDocuments.length);
    set({
      on: true,
      conds: c.conds.length ? c.conds : ["count"],
      legalDocuments: c.legalDocuments.length || !from ? c.legalDocuments : [...cols[from].legalDocuments],
    });
  };

  const box = (field: NumField, aria: string, wide?: boolean) => readOnly
    ? <b className="font-semibold tabular-nums">{c[field].replace(".", ",")}</b>
    : (
      <Input type="number" min={0} step={RULES[field] === "COUNT" ? 1 : "any"} inputMode="decimal" aria-label={aria}
        aria-invalid={!!errors[`${tier}.${COND_OF_FIELD[field] ?? (field === "perRooms" || field === "perClasses" ? "perClass" : field)}`]}
        className={cn("h-9 px-2 text-center font-semibold", wide ? "w-24" : "w-20")} placeholder={field === "studentPercent" ? "100" : undefined}
        value={c[field]} onChange={(e) => set({ [field]: e.target.value } as Partial<Column>)} />
    );
  const sentence: Record<Cond, ReactNode> = {
    count: <>Có ít nhất {box("minCount", "Số phòng")} {unit}</>,
    perClass: <>Cứ {box("perClasses", "Số lớp")} lớp có {box("perRooms", "Số phòng")} {unit}</>,
    large: <>Trường trên {box("largeClassFrom", "Trên số lớp")} lớp có ít nhất {box("largeMinCount", "Số phòng của trường lớn")} {unit}</>,
    roomArea: <>Mỗi {unit} rộng ít nhất {box("minRoomArea", "Diện tích mỗi phòng", true)} m²</>,
    perStudent: (
      <>
        Tổng diện tích ít nhất {box("areaPerStudent", "Diện tích mỗi học sinh", true)} m² cho mỗi học sinh
        {readOnly && !c.studentPercent ? null : <>, tính trên {box("studentPercent", "Phần trăm học sinh")} % học sinh</>}
      </>
    ),
    total: <>Tổng diện tích ít nhất {box("minTotalArea", "Tổng diện tích", true)} m²</>,
  };
  const menu = condMenu(unit);
  const rest = CONDS.filter((k) => !c.conds.includes(k));
  const sample = example(cols, tier, unit);
  const optional = [...below(tier), tier].map((k) => cols[k]).filter((x) => x.on).every((x) => x.onlyIfPresent);

  const save = async () => {
    setTouched(true);
    if (!type) return;
    if (!initial && STANDARD_TIERS.every((k) => !cols[k.key].on)) {
      notify?.({ type: "error", message: "Đặt yêu cầu cho ít nhất một mức" });
      return;
    }
    const bad = Object.keys(found)[0];
    if (bad) return setTier(bad.split(".")[0] as StandardTier);
    setBusy(true);
    try {
      await kyInstance.put(`facility_standard_rules/types/${type.id}`, {
        json: {
          levelCode,
          tiers: STANDARD_TIERS.map(({ key }) => {
            const x = cols[key];
            const rooms = num(x, "perRooms");
            const classes = num(x, "perClasses");
            return {
              tier: key, minCount: num(x, "minCount"), countPerClass: rooms && classes ? joinPerClass(rooms, classes) : null,
              minRoomArea: num(x, "minRoomArea"), areaPerStudent: num(x, "areaPerStudent"), minTotalArea: num(x, "minTotalArea"),
              largeClassFrom: num(x, "largeClassFrom"), largeMinCount: num(x, "largeMinCount"), studentPercent: num(x, "studentPercent"),
              onlyIfPresent: x.on && x.onlyIfPresent, legalDocuments: x.on ? x.legalDocuments.map((id) => ({ id })) : [],
              legalBasis: x.on ? x.legalBasis.trim() || null : null, note: x.on ? x.note.trim() || null : null,
            };
          }),
        },
      }).json();
      await invalidate({ resource: "facility_standard_rules", invalidates: ["list", "detail"] });
      notify?.({ type: "success", message: `Đã lưu chuẩn của ${type.name}` });
      onClose();
    } catch (e) {
      const from = serverErrors(e);
      setServer(from);
      const first = Object.keys(from)[0]?.split(".")[0] as StandardTier | undefined;
      if (first && STANDARD_TIERS.some((t) => t.key === first)) setTier(first);
      notify?.({ type: "error", message: await errorMessage(e), description: "Không lưu được chuẩn CSVC" });
    } finally {
      setBusy(false);
    }
  };

  return (
    // Cao CỐ ĐỊNH: đổi mức, bật tắt yêu cầu thì khung, ba thẻ và nút Lưu đứng yên, chỉ phần giữa cuộn.
    <DialogContent size="form" className="h-[min(48rem,92dvh)]">
      <DialogHeader>
        <DialogTitle>
          {initial ? `${readOnly ? "Chuẩn CSVC" : "Sửa chuẩn CSVC"}: ${initial.name}` : "Thêm chuẩn CSVC"}
        </DialogTitle>
      </DialogHeader>
      <div className="-m-1 flex min-h-0 flex-1 flex-col gap-4 p-1">
            {initial ? null : (
              <div className="w-80 max-w-full shrink-0 space-y-1.5">
                <div className="text-sm font-medium">Loại CSVC<span className="text-destructive"> *</span></div>
                <TypePicker types={types.filter((x) => x.rules.every((r) => r.active === false))} value={type} invalid={touched && !type}
                  onChange={(x) => {
                    // Đổi loại giữ nguyên những gì đã khai, chỉ đổi đơn vị (phòng / hạng mục).
                    setType(x);
                    setServer({});
                    if (STANDARD_TIERS.every((k) => !cols[k.key].on)) turn(true);
                  }} />
                {touched && !type ? <p className="text-destructive text-xs">Vui lòng chọn loại CSVC</p> : null}
              </div>
            )}

            {/* Ba mức: thẻ nào cũng nói mức đó đang đòi gì, bấm để khai mức đó. */}
            <div className="grid shrink-0 grid-cols-3 gap-2" role="tablist" aria-label="Mức chuẩn">
              {STANDARD_TIERS.map((t) => {
                const x = cols[t.key];
                const from = [...below(t.key)].reverse().find((k) => cols[k].on);
                const error = Object.keys(errors).some((k) => k.startsWith(`${t.key}.`));
                return (
                  <button key={t.key} type="button" role="tab" aria-selected={tier === t.key} onClick={() => setTier(t.key)}
                    className={cn("focus-visible:ring-ring flex h-18 flex-col rounded-lg border px-3 py-2 text-start outline-none focus-visible:ring-2",
                      tier === t.key ? "border-primary bg-primary/8 ring-primary ring-1" : "bg-card hover:border-primary/50",
                      error && "border-destructive")}>
                    <div className={cn("text-sm font-semibold", tier === t.key && "text-primary")}>{t.short}</div>
                    <div className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                      {x.on ? summary(x, unit) || "Chưa nhập yêu cầu" : from ? `Như ${lower(from)}` : "Không yêu cầu"}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="bg-card min-h-0 flex-1 space-y-4 overflow-y-auto rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-sm font-semibold">{STANDARD_TIER_LABELS[tier]}</span>
                {readOnly ? (c.on ? null : <span className="text-muted-foreground text-sm">{offLabel}</span>) : (
                  <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Yêu cầu của mức này">
                    {[{ on: false, label: offLabel }, { on: true, label: tier === "MIN" ? "Có yêu cầu" : "Có yêu cầu riêng" }].map((o) => (
                      <label key={String(o.on)} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="radio" name="tier-on" className="accent-primary size-4" checked={c.on === o.on} onChange={() => turn(o.on)} />
                        {o.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {c.on ? (
                <>
                  {lowerOn ? (
                    <p className="text-muted-foreground text-sm">
                      Vẫn phải đạt {lower(lowerOn)} ({summary(cols[lowerOn], unit)}), cộng thêm:
                    </p>
                  ) : null}
                  <ul className="space-y-2">
                    {CONDS.filter((k) => c.conds.includes(k)).map((k) => (
                      <li key={k}>
                        <div className="bg-muted/40 flex items-center gap-2 rounded-md px-3 py-2">
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">{sentence[k]}</div>
                          {readOnly ? null : (
                            <Button type="button" variant="ghost" size="icon-sm" title="Bỏ yêu cầu này" aria-label="Bỏ yêu cầu này"
                              onClick={() => set({
                                conds: c.conds.filter((x) => x !== k),
                                ...Object.fromEntries(COND_FIELDS[k].map((f) => [f, ""])),
                              } as Partial<Column>)}>
                              <X />
                            </Button>
                          )}
                        </div>
                        {errors[`${tier}.${k}`] ? <p className="text-destructive mt-1 text-xs">{errors[`${tier}.${k}`]}</p> : null}
                      </li>
                    ))}
                  </ul>
                  {errors[`${tier}.conds`] ? <p className="text-destructive text-xs">{errors[`${tier}.conds`]}</p> : null}
                  {!readOnly && rest.length ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm"><Plus />Thêm yêu cầu</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {rest.map((k) => <DropdownMenuItem key={k} onSelect={() => set({ conds: [...c.conds, k] })}>{menu[k]}</DropdownMenuItem>)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  {readOnly ? (c.onlyIfPresent ? <p className="text-sm">Trường không có loại này thì bỏ qua, không tính là thiếu.</p> : null) : (
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={c.onlyIfPresent} onCheckedChange={(v) => set({ onlyIfPresent: v === true })} />
                      Trường không có loại này thì bỏ qua, không tính là thiếu
                    </label>
                  )}

                  <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium">Văn bản căn cứ{readOnly ? null : <span className="text-destructive"> *</span>}</div>
                      <DocsPicker ids={c.legalDocuments} readOnly={readOnly} invalid={!!errors[`${tier}.legalDocuments`]}
                        label="Văn bản căn cứ" onChange={(ids) => set({ legalDocuments: ids })} />
                      {errors[`${tier}.legalDocuments`] ? <p className="text-destructive text-xs">{errors[`${tier}.legalDocuments`]}</p> : null}
                    </div>
                    {readOnly && !c.legalBasis ? null : (
                      <div className="space-y-1.5">
                        <div className="text-sm font-medium">Điều, khoản</div>
                        {readOnly ? <div className="py-1.5 text-sm">{c.legalBasis}</div> : (
                          <Input className="h-9" aria-label="Điều, khoản" maxLength={maxLengthOf("SHORT_TEXT")} placeholder="VD: Khoản 4 Điều 18"
                            value={c.legalBasis} onChange={(e) => set({ legalBasis: e.target.value })} />
                        )}
                        {errors[`${tier}.legalBasis`] ? <p className="text-destructive text-xs">{errors[`${tier}.legalBasis`]}</p> : null}
                      </div>
                    )}
                    {readOnly && !c.note ? null : (
                      <div className="space-y-1.5 sm:col-span-2">
                        <div className="text-sm font-medium">Ghi chú</div>
                        {readOnly ? <div className="py-1.5 text-sm">{c.note}</div> : (
                          <Input className="h-9" aria-label="Ghi chú" maxLength={maxLengthOf("NOTE")} placeholder="Không bắt buộc"
                            value={c.note} onChange={(e) => set({ note: e.target.value })} />
                        )}
                        {errors[`${tier}.note`] ? <p className="text-destructive text-xs">{errors[`${tier}.note`]}</p> : null}
                      </div>
                    )}
                  </div>
                </>
              ) : readOnly ? null : type?.rules.some((r) => r.tier === tier && r.active !== false) ? (
                <p className="text-warning-text text-sm">Lưu sẽ bỏ yêu cầu riêng đang có của mức này.</p>
              ) : (
                <p className="text-muted-foreground text-sm">Chọn “{tier === "MIN" ? "Có yêu cầu" : "Có yêu cầu riêng"}” để đặt yêu cầu cho mức này.</p>
              )}
            </div>

            <p className={cn("flex min-h-12 shrink-0 items-center rounded-md px-3 py-1.5 text-sm", sample ? "bg-info-subtle text-info-text" : "bg-muted/40 text-muted-foreground")}>
              {sample ? `Ví dụ trường ${SAMPLE.classes} lớp, ${SAMPLE.students} học sinh${optional ? ", nếu có loại này," : ""} muốn đạt ${lower(tier)} cần ${sample}.`
                : `Trường không phải có loại này để đạt ${lower(tier)}.`}
            </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{readOnly ? "Đóng" : "Huỷ"}</Button>
        {readOnly ? null : (
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="animate-spin" /> : <Save />}
            Lưu
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
