import fs from "fs";
import path from "path";

import { expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Bộ kiểm thử đánh giá (audit): GHI NHẬN kết quả thay vì dừng ở lỗi đầu tiên — mỗi kiểm tra là một dòng
 * `Finding` ghi ra `e2e-audit/<bộ>.json`, báo cáo tổng hợp đọc các tệp đó.
 *
 * Chỉ chạy trên bản local: frontend `E2E_BASE_URL` (mặc định của playwright.config), API `E2E_API_URL` (mặc định
 * localhost:8888). Chạy: `E2E_BASE_URL=http://127.0.0.1:5555 E2E_API_URL=http://localhost:8888 npx playwright test e2e/audit`.
 * Tài khoản là tài khoản dùng thử của bản dev (khung "Đăng nhập nhanh" ở màn đăng nhập).
 */
export const API = process.env.E2E_API_URL ?? "http://localhost:8888";
export const OUT = path.resolve(process.cwd(), "e2e-audit");

const DEMO = process.env.E2E_DEMO_PASSWORD ?? "Demo@123";
export const ACCOUNTS = {
  admin: { username: "admin", password: process.env.E2E_ADMIN_PASSWORD ?? "Admin@123", portal: "admin", label: "Quản trị viên" },
  soLanhDao: { username: "so.lanhdao", password: DEMO, portal: "so", label: "Lãnh đạo Sở" },
  soChuyenVien: { username: "so.chuyenvien", password: DEMO, portal: "so", label: "Chuyên viên Sở" },
  canbo: { username: "thcs.canbo", password: DEMO, portal: "school", label: "Cán bộ TB — THCS Bình An (cơ sở chính)" },
  canbo2: { username: "thcs.canbo2", password: DEMO, portal: "school", label: "Cán bộ TB — THCS Bình An (cơ sở phụ)" },
  hieutruong: { username: "thcs.hieutruong", password: DEMO, portal: "school", label: "Hiệu trưởng — THCS Bình An" },
  thcs2Canbo: { username: "thcs2.canbo", password: DEMO, portal: "school", label: "Cán bộ TB — THCS Đặng Tấn Tài" },
  thcs2HieuTruong: { username: "thcs2.hieutruong", password: DEMO, portal: "school", label: "Hiệu trưởng — THCS Đặng Tấn Tài" },
  thptCanbo: { username: "thpt.canbo", password: DEMO, portal: "school", label: "Cán bộ TB — THPT An Lạc" },
  thptHieuTruong: { username: "thpt.hieutruong", password: DEMO, portal: "school", label: "Hiệu trưởng — THPT An Lạc" },
} as const;
export type Role = keyof typeof ACCOUNTS;

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Finding = {
  id: string;
  area: string;
  title: string;
  ok: boolean;
  severity: Severity;
  expected: string;
  actual: string;
  role?: string;
  evidence?: string;
};

/** Gom kết quả của một bộ, ghi ra JSON khi xong. */
export class Recorder {
  readonly items: Finding[] = [];
  readonly suite: string;
  constructor(suite: string) { this.suite = suite; }
  add(f: Finding) {
    this.items.push(f);
    const mark = f.ok ? "PASS" : `FAIL[${f.severity}]`;
    console.log(`${mark} ${f.id} ${f.title} — ${f.actual}`);
  }
  check(id: string, area: string, title: string, ok: boolean, severity: Severity, expected: string, actual: string, extra: Partial<Finding> = {}) {
    this.add({ id, area, title, ok, severity: ok ? "info" : severity, expected, actual, ...extra });
  }
  flush() {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `${this.suite}.json`), JSON.stringify(this.items, null, 2), "utf-8");
  }
}

export type Session = { token: string; refresh: string; user: any; portal: string };

export async function apiLogin(request: APIRequestContext, role: Role): Promise<Session> {
  const a = ACCOUNTS[role];
  const r = await request.post(`${API}/api/auth/login`, { data: { username: a.username, password: a.password } });
  expect(r.status(), `đăng nhập ${a.username}`).toBe(200);
  const b = await r.json();
  return { token: b.accessToken, refresh: b.refreshToken, user: b.user, portal: a.portal };
}

export function auth(s: Session) {
  return { Authorization: `Bearer ${s.token}` };
}

/** Gọi API dưới cổng của phiên (`/api/<cổng>/...`). */
export async function call(request: APIRequestContext, s: Session | null, method: string, p: string, data?: unknown, portal?: string) {
  const prefix = portal ?? s?.portal;
  const url = `${API}/api/${prefix ? prefix + "/" : ""}${p.replace(/^\//, "")}`;
  const r = await request.fetch(url, { method, headers: s ? auth(s) : {}, data, failOnStatusCode: false });
  let body: any = null;
  const text = await r.text();
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status(), body, headers: r.headers(), text };
}

/** Đăng nhập qua màn hình (form thật), chờ rời màn đăng nhập. */
export async function uiLogin(page: Page, role: Role) {
  const a = ACCOUNTS[role];
  await page.goto("/login");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/login");
  await page.fill("#username", a.username);
  await page.fill("#password", a.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

/** Ghi lỗi JS, lỗi console và lỗi API trong lúc chạy. */
export function watch(page: Page) {
  const js: string[] = [];
  const consoleErr: string[] = [];
  const api: string[] = [];
  const onErr = (e: Error) => js.push(e.message && e.message !== "Object" ? e.message : `Lỗi chưa bắt (unhandled rejection): ${String((e as any)?.stack ?? e).slice(0, 80)}`);
  const onConsole = (m: any) => { if (m.type() === "error") consoleErr.push(m.text().slice(0, 200)); };
  const onResp = (r: any) => {
    const url: string = r.url();
    if (!url.includes("/api/")) return;
    const s: number = r.status();
    if (s >= 500 || (s >= 400 && s !== 401 && s !== 422 && s !== 409)) api.push(`${s} ${r.request().method()} ${url.replace(/^https?:\/\/[^/]+/, "")}`);
  };
  page.on("pageerror", onErr);
  page.on("console", onConsole);
  page.on("response", onResp);
  return {
    js, consoleErr, api,
    stop() { page.off("pageerror", onErr); page.off("console", onConsole); page.off("response", onResp); },
  };
}

export async function shot(page: Page, name: string) {
  fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
  await page.screenshot({ path: path.join(OUT, "shots", `${name}.png`), timeout: 10_000 }).catch(() => {});
  return `shots/${name}.png`;
}

export async function toastText(page: Page) {
  await page.locator("[data-sonner-toast]").first().waitFor({ timeout: 8_000 }).catch(() => {});
  return (await page.locator("[data-sonner-toast]").allInnerTexts()).map((s) => s.replace(/\s+/g, " ")).join(" / ");
}
