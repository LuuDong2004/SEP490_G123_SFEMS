import RULES from "@/shared/lib/field-rules.json";

/**
 * Quy tắc kiểm tra dữ liệu dùng chung — CÙNG số, cùng biểu thức với máy chủ (`shared/validation/FieldRule`,
 * `NumberRule`), đọc từ `field-rules.json` do backend SINH ra (`FieldRulesExportTest`). Màn hình báo lỗi ngay
 * khi gõ; máy chủ vẫn là nơi quyết và trả 422 đúng ô nếu có gì lọt qua.
 *
 * Cách dùng: `<TextField rule="NAME" ... />`, hoặc `rules={textRules("PHONE", "Số điện thoại")}` cho ô tự dựng.
 */
export type TextRule = keyof typeof RULES.text;
export type NumberRule = keyof typeof RULES.number;

type TextSpec = { max: number; pattern: string; message: string; strip?: string };
type NumberSpec = { min: number; max: number | null; scale: number };

const TEXT = RULES.text as Record<TextRule, TextSpec>;
const NUMBER = RULES.number as Record<NumberRule, NumberSpec>;
const PATTERNS = new Map<TextRule, RegExp>();

const pattern = (rule: TextRule) => {
  let re = PATTERNS.get(rule);
  if (!re) {
    re = new RegExp(TEXT[rule].pattern, "su");
    PATTERNS.set(rule, re);
  }
  return re;
};

/** Trần độ dài của ô (trần của kiểu, hoặc trần riêng nhỏ hơn khi cột ngắn hơn). */
export const maxLengthOf = (rule: TextRule, max?: number) => (max && max > 0 ? max : TEXT[rule].max);

/** Lỗi của giá trị theo kiểu, đã gắn nhãn — `undefined` khi hợp lệ. Rỗng luôn hợp lệ (bắt buộc là `required`). */
export function textError(rule: TextRule, label: string, value: unknown, max?: number): string | undefined {
  if (value == null || value === "") return undefined;
  const s = String(value).trim();
  if (s === "") return undefined;
  const limit = maxLengthOf(rule, max);
  if ([...s].length > limit) return `${label} tối đa ${limit} ký tự`;
  const spec = TEXT[rule];
  const checked = spec.strip ? s.replace(new RegExp(spec.strip, "g"), "") : s;
  if (checked === "" || !pattern(rule).test(checked)) return `${label} ${spec.message}`;
  return undefined;
}

const vn = (n: number) => n.toLocaleString("vi-VN");

export const numberMax = (rule: NumberRule) => NUMBER[rule].max ?? new Date().getFullYear() + 1;

export function numberError(rule: NumberRule, label: string, value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return `${label} phải là số`;
  const spec = NUMBER[rule];
  const top = numberMax(rule);
  if (n < spec.min || n > top) return `${label} phải từ ${vn(spec.min)} đến ${vn(top)}`;
  const decimals = (String(value).split(".")[1] ?? "").replace(/0+$/, "").length;
  if (decimals > spec.scale) {
    return spec.scale === 0 ? `${label} phải là số nguyên` : `${label} tối đa ${spec.scale} chữ số thập phân`;
  }
  return undefined;
}

/** `PAST_OR_TODAY`: việc đã xảy ra; `ANY`: ngày bất kỳ từ 1950 tới 2100. Giá trị là chuỗi `yyyy-MM-dd`. */
export type DateRule = "PAST_OR_TODAY" | "ANY";

const todayIso = () => {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function dateError(rule: DateRule, label: string, value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  const s = String(value).slice(0, 10);
  if (s < RULES.date.floor) return `${label} không được trước 01/01/1950`;
  if (rule === "PAST_OR_TODAY" && s > todayIso()) return `${label} không được sau hôm nay`;
  if (s > RULES.date.ceiling) return `${label} không được sau 31/12/2100`;
  return undefined;
}

type Rules = { required?: string; validate?: Record<string, (v: unknown) => true | string> };

const required = (label: string, on?: boolean) => (on ? { required: `${label} là bắt buộc` } : {});

/** Luật react-hook-form cho ô chữ. */
export const textRules = (rule: TextRule, label: string, opts: { required?: boolean; max?: number } = {}): Rules => ({
  ...required(label, opts.required),
  validate: { [rule]: (v) => textError(rule, label, v, opts.max) ?? true },
});

export const numberRules = (rule: NumberRule, label: string, opts: { required?: boolean } = {}): Rules => ({
  ...required(label, opts.required),
  validate: { [rule]: (v) => numberError(rule, label, v) ?? true },
});

export const dateRules = (rule: DateRule, label: string, opts: { required?: boolean } = {}): Rules => ({
  ...required(label, opts.required),
  validate: { [rule]: (v) => dateError(rule, label, v) ?? true },
});

/** Gộp luật kiểu với `rules` riêng của ô (giữ `required`, `validate` của cả hai). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeRules(base: Rules | undefined, extra: any): any {
  if (!base) return extra;
  if (!extra) return base;
  const extraValidate = typeof extra.validate === "function" ? { custom: extra.validate } : extra.validate;
  return { ...base, ...extra, validate: { ...base.validate, ...extraValidate } };
}

/** Bàn phím phù hợp trên điện thoại. */
export const inputModeOf = (rule?: TextRule): "tel" | "email" | "url" | undefined =>
  rule === "PHONE" ? "tel" : rule === "EMAIL" ? "email" : rule === "URL" ? "url" : undefined;

export const PASSWORD_LIMITS = RULES.password;
