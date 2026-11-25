/* eslint-disable @typescript-eslint/no-explicit-any -- phản hồi API trong kiểm thử là JSON tuỳ ý */
import { test } from "@playwright/test";

import { Recorder, apiLogin, call, shot, uiLogin, type Session } from "./lib";
import { loaded, main } from "./ui";

/**
 * Validate dữ liệu đầu vào: gửi thẳng API (đúng cái máy chủ phải chặn dù giao diện có chặn hay không) và vài ca trên
 * giao diện (XSS hiển thị, đổi mật khẩu, đăng nhập). Phiếu thử là nháp "E2E-AUDIT", xoá ngay sau khi kiểm.
 */
test.describe.configure({ mode: "serial" });
const rec = new Recorder("validation");
const S: Record<string, Session> = {};
let catalogId: number | undefined;
test.beforeAll(async ({ request }) => {
  S.canbo = await apiLogin(request, "canbo");
  S.admin = await apiLogin(request, "admin");
  const p = await call(request, S.canbo, "GET", "purchase_proposals?_start=0&_end=1&_sort=id&_order=desc");
  const id = Array.isArray(p.body) ? p.body[0]?.id : undefined;
  if (id) {
    const d = await call(request, S.canbo, "GET", `purchase_proposals/${id}`);
    catalogId = d.body?.lines?.[0]?.catalog?.id;
  }
});
test.afterAll(() => rec.flush());

const base = () => ({ proposalDate: "2026-11-20", budgetYear: 2027, reason: "E2E-AUDIT validate", note: null });
const line = (over: Record<string, unknown>) => ({ catalog: { id: catalogId }, kind: "NEW", quantity: 2, unitPrice: 100000, ...over });

test("V1 đề xuất mua sắm: số lượng, đơn giá, năm, độ dài", async ({ request }) => {
  test.skip(!catalogId, "không lấy được mã thiết bị mẫu");
  const cases: [string, any, boolean][] = [
    ["số lượng 0", { ...base(), lines: [line({ quantity: 0 })] }, false],
    ["số lượng âm", { ...base(), lines: [line({ quantity: -5 })] }, false],
    ["số lượng rất lớn (10^9)", { ...base(), lines: [line({ quantity: 1_000_000_000 })] }, false],
    ["số lượng thập phân 1.5", { ...base(), lines: [line({ quantity: 1.5 })] }, false],
    ["đơn giá âm", { ...base(), lines: [line({ unitPrice: -1000 })] }, false],
    ["đơn giá 10^16", { ...base(), lines: [line({ unitPrice: 1e16 })] }, false],
    ["năm ngân sách 1900", { ...base(), budgetYear: 1900, lines: [line({})] }, false],
    ["lý do 5000 ký tự", { ...base(), reason: "x".repeat(5000), lines: [line({})] }, false],
    ["thiếu ngày đề xuất", { ...base(), proposalDate: null, lines: [line({})] }, false],
    ["thiết bị không tồn tại", { ...base(), lines: [line({ catalog: { id: 999999999 } })] }, false],
    ["hợp lệ (đối chứng)", { ...base(), lines: [line({})] }, true],
  ];
  for (const [name, body, valid] of cases) {
    const r = await call(request, S.canbo, "POST", "purchase_proposals", body);
    const accepted = r.status < 300;
    if (accepted && r.body?.id) await call(request, S.canbo, "DELETE", `purchase_proposals/${r.body.id}`);
    const msg = typeof r.body === "object" ? (r.body?.errors ? JSON.stringify(r.body.errors) : r.body?.message) : String(r.body);
    rec.check(`V1:${name}`, "Validate", `Đề xuất mua sắm — ${name}`, accepted === valid && r.status < 500, r.status >= 500 ? "high" : "medium",
      valid ? "nhận (2xx)" : "từ chối 4xx kèm câu báo lỗi", `${r.status} ${String(msg ?? "").slice(0, 140)}`, { role: "canbo" });
  }
  // Trình phiếu không có dòng / không lý do.
  const empty = await call(request, S.canbo, "POST", "purchase_proposals", { ...base(), reason: null, lines: [] });
  if (empty.status < 300 && empty.body?.id) {
    const s = await call(request, S.canbo, "POST", `purchase_proposals/${empty.body.id}/submit`, {});
    rec.check("V1:submit-empty", "Validate", "Trình đề xuất không có dòng, không có lý do", s.status >= 400 && s.status < 500, "high", "từ chối, nêu lý do", `${s.status} ${String(s.body?.message ?? "").slice(0, 140)}`, { role: "canbo" });
    await call(request, S.canbo, "DELETE", `purchase_proposals/${empty.body.id}`);
  }
});

test("V2 tài khoản người dùng (quản trị viên)", async ({ request }) => {
  const roles = await call(request, S.admin, "GET", "roles?_start=0&_end=50");
  const schoolRole = Array.isArray(roles.body) ? roles.body.find((r: any) => /SCHOOL|TRUONG|EQUIPMENT/i.test(r.code ?? "") && (r.roleType ?? r.type ?? "SCHOOL") === "SCHOOL") ?? roles.body[0] : null;
  const me = await call(request, S.canbo, "GET", "auth/me", undefined, "");
  const schoolId = me.body?.school?.id ?? me.body?.schoolId;
  const u = (over: Record<string, unknown>) => ({ username: `e2e.audit.${Date.now() % 100000}`, email: `e2e.${Date.now() % 100000}@example.com`, fullName: "E2E Audit", password: "Kiem-Thu#2611x", userType: "SCHOOL", school: schoolId ? { id: schoolId } : null, roles: schoolRole ? [{ id: schoolRole.id }] : [], ...over });
  const cases: [string, any][] = [
    ["email sai định dạng", u({ email: "khong-phai-email" })],
    ["tên đăng nhập 2 ký tự", u({ username: "ab" })],
    ["tên đăng nhập có dấu cách / tiếng Việt", u({ username: "nguyễn văn a" })],
    ["trùng tên đăng nhập có sẵn", u({ username: "thcs.canbo" })],
    ["mật khẩu yếu '123456'", u({ password: "123456" })],
    ["không chọn vai trò", u({ roles: [] })],
    ["họ tên rỗng", u({ fullName: "   " })],
    ["họ tên chứa thẻ <script>", u({ fullName: "<script>alert(1)</script>" })],
  ];
  for (const [name, body] of cases) {
    const r = await call(request, S.admin, "POST", "users", body);
    if (r.status < 300 && r.body?.id) await call(request, S.admin, "DELETE", `users/${r.body.id}`);
    const msg = r.body?.errors ? JSON.stringify(r.body.errors) : r.body?.message;
    rec.check(`V2:${name}`, "Validate", `Tạo tài khoản — ${name}`, r.status >= 400 && r.status < 500, r.status >= 500 || r.status < 300 ? "high" : "medium", "từ chối 4xx", `${r.status} ${String(msg ?? "").slice(0, 140)}`, { role: "admin" });
  }
});

test("V3 XSS: nội dung người dùng gõ hiển thị là chữ, không chạy mã", async ({ page, request }) => {
  test.skip(!catalogId, "không có mã thiết bị mẫu");
  const payload = `E2E-AUDIT <img src=x onerror="window.__xss=1"> <script>window.__xss=2</script>`;
  const r = await call(request, S.canbo, "POST", "purchase_proposals", { ...base(), reason: payload, note: payload, lines: [line({ note: payload })] });
  if (r.status >= 300) { rec.check("V3:create", "Bảo mật", "Tạo phiếu chứa mã HTML để thử XSS", true, "info", "-", `máy chủ từ chối ${r.status} — an toàn`); return; }
  await uiLogin(page, "canbo");
  await page.goto(`/purchase-proposals/show/${r.body.id}`);
  await loaded(page);
  const x = await page.evaluate(() => (window as any).__xss);
  const shown = (await main(page).innerText()).includes("<img src=x");
  rec.check("V3:xss", "Bảo mật", "Lý do / ghi chú chứa <img onerror> và <script> hiển thị là chữ thô, không chạy", x === undefined, "critical", "không chạy mã", `${x === undefined ? "không chạy" : "CHẠY MÃ: __xss=" + x}${shown ? " · hiện đúng là chữ" : ""}`, { role: "canbo", evidence: await shot(page, "V3-xss") });
  await page.goto("/purchase-proposals");
  await loaded(page);
  const x2 = await page.evaluate(() => (window as any).__xss);
  rec.check("V3:xss-list", "Bảo mật", "… và ở màn danh sách", x2 === undefined, "critical", "không chạy mã", x2 === undefined ? "không chạy" : "CHẠY MÃ", { role: "canbo" });
  await call(request, S.canbo, "DELETE", `purchase_proposals/${r.body.id}`);
});

test("V4 đăng nhập và đổi mật khẩu trên giao diện", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/login");
  await page.fill("#username", "");
  await page.fill("#password", "");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(600);
  const stay = page.url().includes("/login");
  const msgs = await page.locator("[data-slot=form-message], [role=alert]").allInnerTexts();
  rec.check("V4:login-empty", "Validate", "Bấm Đăng nhập khi để trống", stay, "medium", "ở lại, báo thiếu", `${stay ? "ở lại" : "chuyển trang"} · ${msgs.join(" / ") || "(không có câu báo dưới ô)"}`);
  await page.fill("#username", "thpt.hieutruong");
  await page.fill("#password", "sai-mat-khau-e2e");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  const err = (await page.locator("body").innerText()).match(/Sai tên đăng nhập[^\n]*/)?.[0];
  rec.check("V4:login-wrong", "Validate", "Sai mật khẩu: báo chung chung, không lộ tài khoản có tồn tại", !!err, "medium", "Sai tên đăng nhập hoặc mật khẩu", err ?? "không thấy câu báo");

  await uiLogin(page, "thptCanbo");
  await page.goto("/profile");
  await loaded(page);
  const pw = page.locator('input[type="password"]');
  const n = await pw.count();
  if (n >= 3) {
    await pw.nth(0).fill("sai-mat-khau-cu");
    await pw.nth(1).fill("123");
    await pw.nth(2).fill("123");
    const btn = main(page).getByRole("button", { name: /Đổi mật khẩu|Lưu/ }).last();
    const weakBlocked = await btn.isDisabled().catch(() => false);
    rec.check("V4:pw-weak", "Validate", "Mật khẩu mới yếu ('123') thì không cho đổi", weakBlocked, "medium", "nút khoá + gợi ý luật", weakBlocked ? "nút khoá" : "nút vẫn bấm được", { role: "thptCanbo" });
    await pw.nth(1).fill("Mat-Khau#Moi2026");
    await pw.nth(2).fill("Mat-Khau#Moi2027");
    const mismatch = (await main(page).innerText()).match(/không khớp[^\n]*/i)?.[0];
    rec.check("V4:pw-mismatch", "Validate", "Nhập lại mật khẩu không khớp thì báo", !!mismatch, "low", "báo không khớp", mismatch ?? "không báo", { role: "thptCanbo" });
    await pw.nth(2).fill("Mat-Khau#Moi2026");
    const resp = page.waitForResponse((r) => /change-password/.test(r.url())).catch(() => null);
    await btn.click().catch(() => {});
    const r = await resp;
    rec.check("V4:pw-wrong-current", "Bảo mật", "Đổi mật khẩu với mật khẩu hiện tại sai thì máy chủ từ chối", !!r && r.status() >= 400, "high", "4xx", r ? String(r.status()) : "không gửi", { role: "thptCanbo" });
  } else {
    rec.add({ id: "V4:pw", area: "Validate", title: "Màn đổi mật khẩu", ok: false, severity: "low", expected: "có 3 ô mật khẩu", actual: `${n} ô — không kiểm được`, role: "thptCanbo" });
  }
});
