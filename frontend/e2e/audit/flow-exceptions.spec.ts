/* eslint-disable @typescript-eslint/no-explicit-any -- phản hồi API trong kiểm thử là JSON tuỳ ý */
import fs from "fs";

import { test, type APIRequestContext, type Page } from "@playwright/test";

import { API, apiLogin, call, Recorder, shot, uiLogin, watch, type Role, type Session } from "./lib";
import { bell, loaded, main, voucherState } from "./ui";

/**
 * Nhánh ngoại lệ của các luồng duyệt (Trả lại, Từ chối) và các UC chưa có kịch bản ở bộ luồng chính:
 * NC-03/NC-04/NC-06 trả lại – từ chối, PN-03 trả lại – từ chối, KK-06 trả lại, KK-07 in biên bản, BC-06 xuất Excel,
 * TS-02/TS-05 mã cũ. Dữ liệu dựng nhanh qua API (đúng các bước người lập), còn bước của NGƯỜI DUYỆT bấm trên giao diện.
 * GHI dữ liệu thử có chữ "E2E-AUDIT". Kiểm kê dùng THCS Đặng Tấn Tài để khoá số liệu không đụng bộ khác.
 */
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1600, height: 900 } });
const rec = new Recorder("flow-exceptions");
test.afterAll(() => rec.flush());

const TODAY = "2026-11-20";
const ctx: { rejectedCode?: string; rejectedId?: number } = {};

async function as(request: APIRequestContext, role: Role) {
  return apiLogin(request, role);
}

/** Đề xuất một dòng (Phần mềm toán học — danh mục THCS) đã trình, trả về {id, code}. */
async function submittedProposal(request: APIRequestContext, s: Session, reason: string) {
  const c = await call(request, s, "POST", "purchase_proposals", {
    proposalDate: TODAY, budgetYear: 2027, reason,
    lines: [{ catalog: { id: 1046 }, kind: "NEW", name: "Phần mềm toán học", unitName: "Bộ", quantity: 1, unitPrice: 1_000_000 }],
  });
  const p = await call(request, s, "POST", `purchase_proposals/${c.body.id}/submit`);
  return { id: c.body.id as number, code: p.body.code as string, status: p.body.status as string };
}

/** Phiếu ghi tăng "Trường tự mua sắm" một dòng, kèm biên bản PDF, đã trình. */
async function submittedIntake(request: APIRequestContext, s: Session) {
  const doc = { docNo: 1, supplier: "Công ty E2E-AUDIT ngoại lệ", documentNo: `HDE2E${Date.now() % 100000}`, documentDate: "2026-11-19", fundingSource: "STATE_BUDGET", acquisitionMethod: { id: 2 } };
  const c = await call(request, s, "POST", "equipment_intakes", {
    intakeDate: TODAY, supplier: doc.supplier, documentNo: doc.documentNo, documentDate: doc.documentDate, fundingSource: "STATE_BUDGET",
    originSource: { id: 12 }, acquisitionMethod: { id: 2 }, documents: [doc],
    lines: [{ lineNo: 1, catalog: { id: 1046 }, name: "Phần mềm toán học", unit: { id: 3 }, documentQuantity: 1, receivedQuantity: 1, unitPrice: 1_500_000, room: { id: 1 }, docNo: 1 }],
  });
  const id = c.body.id as number;
  // Hàng mua: phiếu cần biên bản giao nhận, và MỖI hoá đơn cần tệp hoá đơn của chính nó.
  const upload = (resource: string, recordId: number) => request.post(`${API}/api/school/attachments`, {
    headers: { Authorization: `Bearer ${s.token}` },
    multipart: { resource, recordId: String(recordId), file: { name: "bien-ban.pdf", mimeType: "application/pdf", buffer: fs.readFileSync("e2e/audit/bien-ban.pdf") } },
  });
  await upload("equipment_intakes", id);
  for (const d of c.body.documents ?? []) await upload("equipment_intake_documents", d.id);
  const p = await call(request, s, "POST", `equipment_intakes/${id}/submit`);
  return { id, status: p.body.status as string, error: p.status >= 300 ? p.text.slice(0, 160) : "" };
}

/**
 * Người duyệt bấm Trả lại / Từ chối trên màn chi tiết: nút ngoài hoặc trong menu "Thao tác khác". Thử xác nhận khi
 * để trống ý kiến trước (phải bị chặn), rồi ghi ý kiến và xác nhận. Trả về có bị chặn khi trống không.
 */
async function decide(page: Page, label: "Trả lại" | "Từ chối", note: string) {
  const btn = main(page).getByRole("button", { name: new RegExp(`^${label}$`) }).first();
  if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) await btn.click();
  else {
    await main(page).getByRole("button", { name: "Thao tác khác" }).first().click();
    await page.getByRole("menuitem", { name: new RegExp(label) }).first().click();
  }
  const dlg = page.locator('[role="alertdialog"],[role="dialog"]').last();
  await dlg.waitFor({ timeout: 5_000 });
  const ok = dlg.getByRole("button", { name: new RegExp(`^${label}`) }).last();
  let blocked = await ok.isDisabled().catch(() => false);
  if (!blocked) {
    await ok.click({ timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(500);
    blocked = await dlg.isVisible().catch(() => false);
  }
  if (await dlg.isVisible().catch(() => false)) {
    await dlg.locator("textarea").first().fill(note);
    await ok.click();
  }
  // Chờ máy chủ xử lý xong: hộp hỏi lại chỉ đóng khi yêu cầu đã trả về.
  await dlg.waitFor({ state: "hidden", timeout: 20_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return { blocked };
}

const clean = (w: ReturnType<typeof watch>) => [...w.js, ...w.api].join(" | ") || "sạch";

test("E1 hiệu trưởng trả lại đề xuất, cán bộ sửa và trình lại (NC-03)", async ({ page, request }) => {
  const cb = await as(request, "canbo");
  const p = await submittedProposal(request, cb, "E2E-AUDIT ngoại lệ: trả lại");
  const w = watch(page);
  await uiLogin(page, "hieutruong");
  await page.goto(`/purchase-proposals/show/${p.id}`);
  await loaded(page);
  const note = "E2E-AUDIT: bổ sung thông số kỹ thuật";
  const { blocked } = await decide(page, "Trả lại", note);
  rec.check("E1:note-required", "Validate", "Trả lại khi để trống 'Cần sửa gì' thì bị chặn", blocked, "medium", "bị chặn", blocked ? "bị chặn" : "trả lại được khi không ghi lý do", { role: "hieutruong" });
  const state = await voucherState(page);
  const after = await call(request, cb, "GET", `purchase_proposals/${p.id}`);
  rec.check("E1:return", "Luồng ngoại lệ", "Hiệu trưởng trả lại đề xuất → về Nháp, giữ lời nhắn", after.body.status === "DRAFT" && after.body.returnNote === note, "critical", "DRAFT + lời nhắn", `${after.body.status} · "${after.body.returnNote}" · màn: ${state}`, { role: "hieutruong", evidence: await shot(page, "E1-returned") });
  rec.check("E1:clean", "Lỗi kỹ thuật", "Không lỗi JS / API ở E1", !w.js.length && !w.api.length, "high", "sạch", clean(w));
  w.stop();

  await uiLogin(page, "canbo");
  const b = await bell(page);
  rec.check("E1:bell", "Thông báo", "Người lập nhận thông báo phiếu bị trả lại", b.includes(p.code), "medium", `có ${p.code}`, b.slice(0, 160), { role: "canbo" });
  await page.goto(`/purchase-proposals/show/${p.id}`);
  await loaded(page);
  const seen = (await main(page).innerText()).includes(note);
  rec.check("E1:note-visible", "UI/UX", "Người lập thấy lời nhắn cần sửa trên phiếu", seen, "medium", "thấy lời nhắn", seen ? "thấy" : "không thấy", { role: "canbo", evidence: await shot(page, "E1-canbo-sees-note") });
  const again = await call(request, cb, "POST", `purchase_proposals/${p.id}/submit`);
  rec.check("E1:resubmit", "Luồng ngoại lệ", "Phiếu bị trả lại trình lại được, giữ số phiếu", again.body.status === "PENDING" && again.body.code === p.code, "high", `PENDING, ${p.code}`, `${again.body.status ?? again.status}, ${again.body.code}`, { role: "canbo" });
  ctx.rejectedId = p.id;
  ctx.rejectedCode = p.code;
});

test("E2 lãnh đạo Sở từ chối đề xuất → phiếu dừng hẳn (NC-04)", async ({ page, request }) => {
  test.skip(!ctx.rejectedId, "E1 không tạo được phiếu");
  const id = ctx.rejectedId!;
  await call(request, await as(request, "hieutruong"), "POST", `purchase_proposals/${id}/approve`, {});
  const w = watch(page);
  await uiLogin(page, "soLanhDao");
  await page.goto(`/purchase-proposals/show/${id}`);
  await loaded(page);
  const reason = "E2E-AUDIT: ngoài khả năng ngân sách năm 2027";
  const { blocked } = await decide(page, "Từ chối", reason);
  rec.check("E2:note-required", "Validate", "Từ chối khi để trống lý do thì bị chặn", blocked, "medium", "bị chặn", blocked ? "bị chặn" : "từ chối được khi không ghi lý do", { role: "soLanhDao" });
  const cb = await as(request, "canbo");
  const after = await call(request, cb, "GET", `purchase_proposals/${id}`);
  rec.check("E2:reject", "Luồng ngoại lệ", "Lãnh đạo Sở từ chối → trạng thái Từ chối, ghi lý do", after.body.status === "REJECTED" && after.body.rejectReason === reason, "critical", "REJECTED + lý do", `${after.body.status} · "${after.body.rejectReason}"`, { role: "soLanhDao", evidence: await shot(page, "E2-rejected") });
  rec.check("E2:clean", "Lỗi kỹ thuật", "Không lỗi JS / API ở E2", !w.js.length && !w.api.length, "high", "sạch", clean(w));
  w.stop();
  const resubmit = await call(request, cb, "POST", `purchase_proposals/${id}/submit`);
  rec.check("E2:final", "Luồng ngoại lệ", "Phiếu đã từ chối không trình lại được", resubmit.status >= 400 && resubmit.status < 500, "high", "4xx", `${resubmit.status} ${typeof resubmit.body === "object" ? resubmit.body.message ?? "" : ""}`.slice(0, 140), { role: "canbo" });
  await uiLogin(page, "canbo");
  await page.goto(`/purchase-proposals/show/${id}`);
  await loaded(page);
  const btns = (await main(page).getByRole("button").allInnerTexts()).map((s) => s.trim()).filter(Boolean);
  rec.check("E2:no-actions", "UI/UX", "Phiếu đã từ chối không còn nút Trình / Sửa", !btns.some((b) => /^(Trình duyệt|Sửa|Lưu)$/.test(b)), "medium", "không có", btns.join(", ").slice(0, 160), { role: "canbo" });
});

test("E3 Sở trả lại kế hoạch; đề xuất từ chối không vào được kế hoạch (NC-05, NC-06)", async ({ page, request }) => {
  const cb = await as(request, "canbo");
  const p = await submittedProposal(request, cb, "E2E-AUDIT ngoại lệ: kế hoạch bị trả lại");
  await call(request, await as(request, "hieutruong"), "POST", `purchase_proposals/${p.id}/approve`, {});
  const ld = await as(request, "soLanhDao");
  await call(request, ld, "POST", `purchase_proposals/${p.id}/approve`, {});
  const cv = await as(request, "soChuyenVien");
  const plan = await call(request, cv, "POST", "procurement_plans", { managingBody: { id: 1 }, title: `E2E-AUDIT kế hoạch trả lại ${p.code}`, budgetYear: 2027, planDate: TODAY });
  const planId = plan.body.id as number;
  const cand = await call(request, cv, "GET", `procurement_plans/${planId}/candidates`);
  const text = JSON.stringify(cand.body);
  rec.check("E3:candidates", "Luồng ngoại lệ", "Hộp chọn có đề xuất vừa duyệt, KHÔNG có đề xuất đã từ chối", text.includes(p.code) && (!ctx.rejectedCode || !text.includes(ctx.rejectedCode)), "high", `có ${p.code}, không có ${ctx.rejectedCode}`, `có mới: ${text.includes(p.code)} · có bị từ chối: ${ctx.rejectedCode ? text.includes(ctx.rejectedCode) : "-"}`, { role: "soChuyenVien" });
  const withLines = await call(request, cv, "PUT", `procurement_plans/${planId}/proposals`, { ids: [p.id] });
  await call(request, cv, "PATCH", `procurement_plans/${planId}`, { lines: withLines.body.lines.map((l: any) => ({ lineId: l.lineId, plannedQuantity: l.requestedQuantity, unitPrice: 1_000_000 })) });
  await call(request, cv, "POST", `procurement_plans/${planId}/submit`);

  const w = watch(page);
  await uiLogin(page, "soLanhDao");
  await page.goto(`/procurement-plans/show/${planId}`);
  await loaded(page);
  const { blocked } = await decide(page, "Trả lại", "E2E-AUDIT: giảm số lượng cho khớp dự toán");
  const after = await call(request, cv, "GET", `procurement_plans/${planId}`);
  rec.check("E3:note-required", "Validate", "Trả lại kế hoạch khi để trống lý do thì bị chặn", blocked, "low", "bị chặn", blocked ? "bị chặn" : "trả lại được khi không ghi lý do", { role: "soLanhDao" });
  rec.check("E3:return", "Luồng ngoại lệ", "Lãnh đạo Sở trả lại kế hoạch → về Nháp", after.body.status === "DRAFT", "critical", "DRAFT", String(after.body.status), { role: "soLanhDao", evidence: await shot(page, "E3-plan-returned") });
  const prop = await call(request, cb, "GET", `purchase_proposals/${p.id}`);
  rec.check("E3:proposal-kept", "Luồng ngoại lệ", "Kế hoạch bị trả lại thì đề xuất vẫn Đã duyệt (chưa Hoàn tất)", prop.body.status === "APPROVED", "high", "APPROVED", String(prop.body.status), { role: "soLanhDao" });
  rec.check("E3:clean", "Lỗi kỹ thuật", "Không lỗi JS / API ở E3", !w.js.length && !w.api.length, "high", "sạch", clean(w));
  w.stop();
  await call(request, cv, "POST", `procurement_plans/${planId}/submit`);
  const ok = await call(request, ld, "POST", `procurement_plans/${planId}/approve`, {});
  const done = await call(request, cb, "GET", `purchase_proposals/${p.id}`);
  rec.check("E3:resubmit", "Luồng ngoại lệ", "Kế hoạch trình lại và được duyệt → đề xuất Hoàn tất", ok.body.status === "APPROVED" && done.body.status === "COMPLETED", "high", "APPROVED / COMPLETED", `${ok.body.status ?? ok.status} / ${done.body.status}`, { role: "soLanhDao" });
});

test("E4 hiệu trưởng trả lại rồi từ chối phiếu ghi tăng → không sinh tài sản (PN-03)", async ({ page, request }) => {
  const cb = await as(request, "canbo");
  const total = async () => Number((await call(request, cb, "GET", "equipment?_start=0&_end=1")).headers["x-total-count"]);
  const before = await total();
  const it = await submittedIntake(request, cb);
  test.skip(it.status !== "PENDING", `không trình được phiếu: ${it.error}`);
  const w = watch(page);
  await uiLogin(page, "hieutruong");
  await page.goto(`/equipment-intakes/show/${it.id}`);
  await loaded(page);
  const r1 = await decide(page, "Trả lại", "E2E-AUDIT: hoá đơn chụp mờ, chụp lại");
  let s = await call(request, cb, "GET", `equipment_intakes/${it.id}`);
  rec.check("E4:note-required", "Validate", "Trả lại phiếu ghi tăng khi để trống lý do thì bị chặn", r1.blocked, "medium", "bị chặn", r1.blocked ? "bị chặn" : "không chặn", { role: "hieutruong" });
  rec.check("E4:return", "Luồng ngoại lệ", "Trả lại phiếu ghi tăng → về Nháp, giữ lời nhắn", s.body.status === "DRAFT" && !!s.body.returnNote, "critical", "DRAFT + lời nhắn", `${s.body.status} · "${s.body.returnNote}"`, { role: "hieutruong" });
  await call(request, cb, "POST", `equipment_intakes/${it.id}/submit`);
  await page.reload();
  await loaded(page);
  await decide(page, "Từ chối", "E2E-AUDIT: hàng không đúng hợp đồng");
  s = await call(request, cb, "GET", `equipment_intakes/${it.id}`);
  rec.check("E4:reject", "Luồng ngoại lệ", "Từ chối phiếu ghi tăng → Từ chối, ghi lý do", s.body.status === "REJECTED" && !!s.body.rejectReason, "critical", "REJECTED + lý do", `${s.body.status} · "${s.body.rejectReason}"`, { role: "hieutruong", evidence: await shot(page, "E4-intake-rejected") });
  const after = await total();
  rec.check("E4:no-assets", "Luồng ngoại lệ", "Phiếu bị từ chối không sinh hồ sơ thiết bị", after === before, "critical", `${before} thiết bị`, `${after} thiết bị`, { role: "hieutruong" });
  rec.check("E4:clean", "Lỗi kỹ thuật", "Không lỗi JS / API ở E4", !w.js.length && !w.api.length, "high", "sạch", clean(w));
  w.stop();
});

test("E5 hiệu trưởng trả lại biên bản kiểm kê; in biên bản (KK-06, KK-07)", async ({ page, request }) => {
  const c2 = await as(request, "thcs2Canbo");
  const created = await call(request, c2, "POST", "inventory_sessions", { title: `E2E-AUDIT phiếu trả lại ${Date.now() % 100000}`, inventoryDate: TODAY, council: "Tổ kiểm kê E2E" });
  test.skip(created.status >= 300, `không lập được phiếu kiểm kê: ${created.text.slice(0, 160)}`);
  const id = created.body.id as number;
  await call(request, c2, "POST", `inventory_sessions/${id}/count`, {
    lines: created.body.lines.map((l: any) => ({ lineId: l.id, found: true, foundRoom: l.expectedRoom ? { id: l.expectedRoom.id } : null, foundCondition: l.expectedCondition })),
  });
  await call(request, c2, "POST", `inventory_sessions/${id}/submit`);

  const w = watch(page);
  await uiLogin(page, "thcs2HieuTruong");
  await page.goto(`/inventory-sessions/show/${id}`);
  await loaded(page);
  const { blocked } = await decide(page, "Trả lại", "E2E-AUDIT: đếm lại phòng thí nghiệm");
  const s = await call(request, c2, "GET", `inventory_sessions/${id}`);
  rec.check("E5:note-required", "Validate", "Trả lại biên bản khi để trống lý do thì bị chặn", blocked, "medium", "bị chặn", blocked ? "bị chặn" : "không chặn", { role: "thcs2HieuTruong" });
  rec.check("E5:return", "Luồng ngoại lệ", "Hiệu trưởng trả lại biên bản → về Nháp, giữ kết quả đã đếm", s.body.status === "DRAFT" && s.body.summary?.checked === s.body.summary?.total, "critical", "DRAFT, giữ số đã đếm", `${s.body.status} · đã đếm ${s.body.summary?.checked}/${s.body.summary?.total}`, { role: "thcs2HieuTruong", evidence: await shot(page, "E5-returned") });
  rec.check("E5:clean", "Lỗi kỹ thuật", "Không lỗi JS / API ở E5", !w.js.length && !w.api.length, "high", "sạch", clean(w));
  w.stop();
  await call(request, c2, "POST", `inventory_sessions/${id}/submit`);
  const ok = await call(request, await as(request, "thcs2HieuTruong"), "POST", `inventory_sessions/${id}/approve`, {});
  rec.check("E5:approve", "Luồng ngoại lệ", "Trình lại và duyệt sau khi bị trả lại", ok.body.status === "COMPLETED", "high", "COMPLETED", String(ok.body.status ?? ok.status), { role: "thcs2HieuTruong" });

  // KK-07: bảng theo phòng + in biên bản từ menu.
  const bd = await call(request, c2, "GET", `inventory_sessions/${id}/breakdown`);
  rec.check("E5:breakdown", "Kiểm kê", "Biên bản có bảng tổng hợp theo phòng", bd.status === 200 && Array.isArray(bd.body.rooms) && bd.body.rooms.length > 0, "medium", "có số liệu theo phòng", `${bd.status} · ${bd.body.rooms?.length ?? 0} phòng`, { role: "thcs2Canbo" });
  await uiLogin(page, "thcs2Canbo");
  await page.goto(`/inventory-sessions/show/${id}`);
  await loaded(page);
  await page.evaluate(() => { (window as any).__printed = 0; window.print = () => { (window as any).__printed++; }; });
  await main(page).getByRole("button", { name: "Thao tác khác" }).first().click();
  await page.getByRole("menuitem", { name: /In biên bản/ }).click();
  await page.waitForTimeout(800);
  const printed = await page.evaluate(() => (window as any).__printed as number);
  await page.emulateMedia({ media: "print" });
  const printText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const evidence = await shot(page, "E5-print");
  await page.emulateMedia({ media: "screen" });
  rec.check("E5:print", "Kiểm kê", "Menu 'In biên bản' gọi lệnh in của trình duyệt", printed > 0, "high", "gọi in", printed ? "đã gọi" : "không gọi", { role: "thcs2Canbo" });
  rec.check("E5:print-content", "Kiểm kê", "Bản in có tiêu đề biên bản và chỗ ký", /BIÊN BẢN/i.test(printText) && /(Hiệu trưởng|ký)/i.test(printText), "medium", "tiêu đề + chỗ ký", printText.slice(0, 140), { role: "thcs2Canbo", evidence });
});

test("E6 xuất Excel báo cáo (BC-06)", async ({ page, request }) => {
  const cv = await as(request, "soChuyenVien");
  for (const name of ["equipment-by-school", "equipment-by-status", "adequacy", "purchase", "inventory"]) {
    const r = await request.get(`${API}/api/so/reports/${name}/export`, { headers: { Authorization: `Bearer ${cv.token}` }, failOnStatusCode: false, timeout: 120_000 });
    const body = await r.body();
    const type = r.headers()["content-type"] ?? "";
    const ok = r.status() === 200 && /spreadsheet|excel|octet/.test(type) && body.subarray(0, 2).toString() === "PK" && body.length > 1000;
    rec.check(`E6:api:${name}`, "Xuất dữ liệu", `Xuất Excel báo cáo ${name}`, ok, "high", "200, tệp .xlsx hợp lệ", `${r.status()} · ${type.slice(0, 40)} · ${body.length} byte`, { role: "soChuyenVien" });
  }
  const w = watch(page);
  await uiLogin(page, "soChuyenVien");
  await page.goto("/reports/equipment-by-school");
  await loaded(page);
  await main(page).getByRole("button", { name: /^Xuất/ }).first().click();
  const dl = page.waitForEvent("download", { timeout: 60_000 }).catch(() => null);
  await page.getByRole("menuitem", { name: /Excel/ }).first().click();
  const file = await dl;
  const name = file?.suggestedFilename() ?? "";
  rec.check("E6:ui", "Xuất dữ liệu", "Bấm Xuất → Excel trên màn báo cáo tải về tệp .xlsx", name.endsWith(".xlsx"), "high", "tải tệp .xlsx", name || "không tải được", { role: "soChuyenVien", evidence: await shot(page, "E6-export") });
  rec.check("E6:clean", "Lỗi kỹ thuật", "Không lỗi JS / API ở E6", !w.js.length && !w.api.length, "high", "sạch", clean(w));
  w.stop();
});

test("E7 thiết bị mang mã cũ: giữ mã cũ, bấm Cấp mã chuẩn, tra theo tem cũ (TS-02, TS-04, TS-05)", async ({ page, request }) => {
  const c2 = await as(request, "thcs2Canbo");
  // Hồ sơ mang mã cũ vào sổ qua nhập số dư đầu kỳ (TS-07); ở đây gọi thẳng API tạo hồ sơ như bước ghi của lần nhập.
  const sample = (await call(request, c2, "GET", "equipment?_start=0&_end=1")).body[0];
  const old = `TEMCU-E2E-${Date.now() % 100000}`;
  const created = await call(request, c2, "POST", "equipment", {
    code: old, name: "E2E-AUDIT thiết bị mã cũ", catalog: { id: sample.catalog.id }, unit: sample.unit ? { id: sample.unit.id } : undefined,
    quantity: 1, room: sample.room ? { id: sample.room.id } : undefined, originalValue: 1_000_000, remainingValue: 1_000_000, usageStartYear: 2020,
  });
  const id = created.body.id as number;
  rec.check("E7:old-code-kept", "Thiết bị", "Hồ sơ vào sổ với mã cũ: giữ mã cũ làm mã hiện hành, báo thiếu mã chuẩn", created.body.code === old && (created.body.missingProfile ?? []).some((m: string) => m.startsWith("mã chuẩn")), "high", `${old} + thiếu mã chuẩn`, `${created.status} · ${created.body.code} · ${JSON.stringify(created.body.missingProfile ?? [])}`.slice(0, 160), { role: "thcs2Canbo" });

  const w = watch(page);
  await uiLogin(page, "thcs2Canbo");
  await page.goto(`/equipment/show/${id}`);
  await loaded(page);
  const btn = main(page).getByRole("button", { name: /Cấp mã chuẩn/ }).first();
  const visible = await btn.isVisible({ timeout: 5_000 }).catch(() => false);
  if (visible) {
    const done = page.waitForResponse((r) => r.url().endsWith(`/equipment/${id}/standard-code`), { timeout: 15_000 }).catch(() => null);
    await btn.click();
    await done;
  }
  const after = await call(request, c2, "GET", `equipment/${id}`);
  const standard = /^\d{2}\.[A-Z0-9]{2}\.\d{2}\.(TB|PM|HL)\.\d{3}\.\d{2}$/;
  rec.check("E7:standard-code", "Thiết bị", "Bấm 'Cấp mã chuẩn' trên hồ sơ: mã chuẩn mới, mã cũ chuyển sang ô Mã cũ", visible && standard.test(after.body.code ?? "") && after.body.legacyCode === old, "critical", "mã chuẩn + mã cũ", `nút: ${visible ? "có" : "không"} · ${after.body.code} · mã cũ ${after.body.legacyCode}`, { role: "thcs2Canbo", evidence: await shot(page, "E7-standard-code") });

  // Tra cứu theo mã (TS-02) nằm ở ô tìm của màn Thiết bị, dạng Từng thiết bị: gõ đúng mã rồi Enter mở thẳng hồ sơ.
  await page.goto("/equipment");
  await loaded(page);
  await page.getByText("Từng thiết bị", { exact: true }).click();
  await page.getByPlaceholder("Tìm theo mã, tên…").fill(old);
  await page.keyboard.press("Enter");
  await main(page).getByText(after.body.code).first().waitFor({ timeout: 10_000 }).catch(() => {});
  const t = await main(page).innerText();
  rec.check("E7:lookup-ui", "Thiết bị", "Ô tìm màn Thiết bị: gõ mã cũ rồi Enter mở đúng hồ sơ thiết bị với mã chuẩn mới", t.includes(after.body.code), "high", after.body.code, t.includes(after.body.code) ? "ra đúng thiết bị" : t.slice(0, 120).replace(/\s+/g, " "), { role: "thcs2Canbo", evidence: await shot(page, "E7-lookup-old-code") });
  rec.check("E7:clean", "Lỗi kỹ thuật", "Không lỗi JS / API ở E7", !w.js.length && !w.api.length, "high", "sạch", clean(w));
  w.stop();

  const again = await call(request, c2, "POST", `equipment/${id}/standard-code`);
  rec.check("E7:already-standard", "Thiết bị", "Cấp mã chuẩn lần hai bị chặn, có lời giải thích", again.status === 422 && /mã chuẩn/.test(again.body?.message ?? ""), "medium", "422 + lời giải thích", `${again.status} · ${again.body?.message ?? ""}`.slice(0, 140), { role: "thcs2Canbo" });
  const hist = JSON.stringify((await call(request, c2, "GET", `equipment/${id}/history`)).body);
  rec.check("E7:history", "Thiết bị", "Lịch sử có lần vào sổ và lần đổi sang mã chuẩn", hist.includes("Vào sổ") && hist.includes("Cấp mã chuẩn"), "medium", "2 dòng", hist.slice(0, 160), { role: "thcs2Canbo" });
  const del = await call(request, c2, "DELETE", `equipment/${id}`);
  rec.check("E7:delete-mistaken", "Thiết bị", "Hồ sơ khai nhầm (chưa qua phiếu, trường chưa chốt số dư) xoá được", del.status === 200, "medium", "200", `${del.status} ${typeof del.body === "object" ? del.body?.message ?? "" : ""}`.slice(0, 140), { role: "thcs2Canbo" });
});

test("E8 số dư đầu kỳ: lãnh đạo trường thấy nút chốt, cán bộ không (TS-01, PN-01)", async ({ page, request }) => {
  const state = await call(request, await as(request, "thcs2HieuTruong"), "GET", "equipment/opening-balance");
  test.skip(!!state.body?.closedAt, "trường thử đã chốt số dư — không kiểm được nút chốt");
  const w = watch(page);
  await uiLogin(page, "thcs2HieuTruong");
  await page.goto("/equipment");
  await loaded(page);
  const leader = await main(page).getByRole("button", { name: /Chốt số dư đầu kỳ/ }).first().isVisible({ timeout: 8_000 }).catch(() => false);
  rec.check("E8:leader-button", "Thiết bị", "Lãnh đạo trường thấy nút 'Chốt số dư đầu kỳ' khi trường chưa chốt", leader, "medium", "có nút", leader ? "có" : "không thấy", { role: "thcs2HieuTruong", evidence: await shot(page, "E8-opening-balance") });
  if (leader) {
    // Mở hộp hỏi lại rồi KHÔNG chốt: chốt là một chiều, trường thử phải còn mở cho các kịch bản khác.
    await main(page).getByRole("button", { name: /Chốt số dư đầu kỳ/ }).first().click();
    const dlg = page.locator('[role="alertdialog"]').last();
    const text = (await dlg.innerText().catch(() => "")).replace(/\s+/g, " ");
    rec.check("E8:confirm-text", "UI/UX", "Hộp hỏi lại nói rõ hệ quả: thiết bị mới chỉ vào sổ qua phiếu ghi tăng, không mở lại", /phiếu ghi tăng/.test(text) && /không mở lại/.test(text), "low", "nói rõ hệ quả", text.slice(0, 160), { role: "thcs2HieuTruong" });
    await dlg.getByRole("button", { name: "Chưa chốt" }).click();
  }
  rec.check("E8:clean", "Lỗi kỹ thuật", "Không lỗi JS / API ở E8", !w.js.length && !w.api.length, "high", "sạch", clean(w));
  w.stop();
  await uiLogin(page, "thcs2Canbo");
  await page.goto("/equipment");
  await loaded(page);
  const staff = await main(page).getByRole("button", { name: /Chốt số dư đầu kỳ/ }).first().isVisible({ timeout: 3_000 }).catch(() => false);
  rec.check("E8:staff-no-button", "Phân quyền theo vai", "Cán bộ thiết bị không thấy nút chốt số dư", !staff, "medium", "không có", staff ? "có nút" : "không có", { role: "thcs2Canbo" });
});
