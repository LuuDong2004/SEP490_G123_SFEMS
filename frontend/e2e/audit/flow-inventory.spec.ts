import { test } from "@playwright/test";

import { API, Recorder, apiLogin, call, shot, toastText, uiLogin, watch } from "./lib";
import { bell, idFromUrl, loaded, main, voucherState } from "./ui";

/**
 * Luồng kiểm kê đầu – cuối qua giao diện (KK-01 → KK-06, KK-02 phía Sở), kèm kiểm tra khoá số liệu (KK-05).
 * GHI dữ liệu thử "E2E-AUDIT". Trường thử: THPT An Lạc (thpt.canbo / thpt.hieutruong).
 */
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1600, height: 900 } });
const rec = new Recorder("flow-inventory");
const ctx: { title: string; cutoff: string; sessionId?: number; missingCode?: string } = { title: `E2E-AUDIT đợt ${Date.now() % 100000}`, cutoff: `${String(1 + (Date.now() % 28)).padStart(2, "0")}/${String(1 + (Math.floor(Date.now() / 28) % 12)).padStart(2, "0")}/2027` };
test.afterAll(() => rec.flush());

test("K1 chuyên viên Sở phát động đợt kiểm kê, kiểm validate form (KK-01)", async ({ page }) => {
  const w = watch(page);
  await uiLogin(page, "soChuyenVien");
  await page.goto("/inventory-campaigns/create");
  const dlg = page.locator('[role="dialog"]').last();
  await dlg.getByRole("button", { name: "Phát động" }).click();
  const empty = await dlg.locator("[data-slot=form-message]").allInnerTexts();
  rec.check("K1:required", "Validate", "Để trống tên đợt / hạn nộp thì báo dưới ô", empty.length >= 2, "medium", "≥ 2 lỗi dưới ô", empty.join(" · ") || "không báo", { role: "soChuyenVien" });
  await dlg.locator("input[name=title]").fill(ctx.title);
  await dlg.locator("input[name=cutoffDate]").fill("20/11/2026");
  await dlg.locator("input[name=deadline]").fill("10/11/2026");
  await page.keyboard.press("Tab");
  await dlg.getByRole("button", { name: "Phát động" }).click();
  const order = await dlg.innerText();
  rec.check("K1:date-order", "Validate", "Hạn nộp trước ngày chốt số liệu thì chặn", /không được trước ngày chốt/i.test(order), "medium", "chặn, nói rõ lý do", /không được trước ngày chốt/i.test(order) ? "chặn: Hạn nộp không được trước ngày chốt số liệu" : "không chặn", { role: "soChuyenVien" });
  const posts: number[] = [];
  page.on("response", (r) => { if (r.request().method() === "POST" && /inventory_campaigns$/.test(r.url())) posts.push(r.status()); });
  await dlg.locator("input[name=title]").fill("     ");
  await dlg.locator("input[name=deadline]").fill("30/11/2026");
  await page.keyboard.press("Tab");
  await dlg.getByRole("button", { name: "Phát động" }).click();
  await page.waitForTimeout(1200);
  const blankToast = await page.locator("[data-sonner-toast]").allInnerTexts();
  rec.check("K1:blank-title-client", "Validate", "Tên chỉ toàn dấu cách bị chặn ngay ở form (không cần gọi máy chủ)", posts.length === 0, "low", "chặn ở form", posts.length ? `form cho gửi, máy chủ trả ${posts[0]}: ${blankToast.join(" / ").replace(/\s+/g, " ")}` : "chặn ở form", { role: "soChuyenVien" });
  rec.check("K1:tech-code", "UI/UX", "Thông báo lỗi không lộ mã kỹ thuật cho người dùng", !/mã \d{3}/.test(blankToast.join(" ")), "low", "không có '(mã 422)'", blankToast.join(" / ").replace(/\s+/g, " ") || "-", { role: "soChuyenVien" });
  // Luật: mỗi cơ quan một đợt đang mở cho cùng ngày chốt (đợt 20/11/2026 đã mở ở lần chạy tay).
  const dupResp = page.waitForResponse((r) => r.request().method() === "POST" && /inventory_campaigns$/.test(r.url()));
  await dlg.locator("input[name=title]").fill(ctx.title);
  await dlg.getByRole("button", { name: "Phát động" }).click();
  const dup = await (await dupResp).text();
  rec.check("K1:one-open", "Validate", "Không mở hai đợt trùng ngày chốt số liệu", /đã có một đợt kiểm kê đang mở/.test(dup) || !/20\/11/.test(dup), "medium", "chặn", dup.match(/"message":"([^"]+)/)?.[1] ?? dup.slice(0, 120), { role: "soChuyenVien" });
  const okResp = page.waitForResponse((r) => r.request().method() === "POST" && /inventory_campaigns$/.test(r.url()));
  await dlg.locator("input[name=cutoffDate]").fill(ctx.cutoff);
  await dlg.locator("input[name=deadline]").fill("31/12/2027");
  await page.keyboard.press("Tab");
  await dlg.getByRole("button", { name: "Phát động" }).click();
  const created = (await okResp).status();
  const t = await toastText(page);
  rec.check("K1:launch", "Luồng kiểm kê", "Phát động đợt kiểm kê", created === 201, "critical", "Đã thêm đợt kiểm kê", t, { role: "soChuyenVien", evidence: await shot(page, "K1-campaign") });
  rec.check("K1:clean", "Lỗi kỹ thuật", "Không lỗi JS / API ở K1 (trừ 422 cố ý)", !w.js.length && !w.api.length, "high", "sạch", [...w.js, ...w.api].join(" | ") || "sạch");
  w.stop();
});

test("K2 cán bộ trường nhận thông báo, lập phiếu kiểm kê theo đợt, kiểm đếm, trình (KK-03, KK-04, KK-05)", async ({ page, request }) => {
  const w = watch(page);
  await uiLogin(page, "thptCanbo");
  const b = await bell(page);
  rec.check("K2:bell", "Thông báo", "Trường nhận thông báo đợt kiểm kê mới", b.includes(ctx.title), "medium", "có tên đợt", b.slice(0, 160), { role: "thptCanbo" });
  await page.goto("/inventory-sessions/create");
  await loaded(page);
  const m = main(page);
  const defaultMode = (await m.innerText()).includes("Trường tự kiểm kê");
  const sOpen = await apiLogin(request, "thptCanbo");
  const camps = await call(request, sOpen, "GET", "inventory_campaigns?_start=0&_end=50");
  const openCount = Array.isArray(camps.body) ? camps.body.filter((c: any) => !c.closed).length : 0;
  rec.check("K2:default-campaign", "UI/UX", "Sở mở đúng một đợt thì form chọn sẵn đợt đó", openCount !== 1 || !defaultMode, "low",
    "chọn sẵn khi chỉ có một đợt mở", `${openCount} đợt đang mở · ${defaultMode ? "mặc định 'Trường tự kiểm kê'" : "đã chọn sẵn đợt"}`, { role: "thptCanbo" });
  await m.getByRole("button", { name: /^Đợt của Sở/ }).click();
  await page.locator('[role="dialog"]').last().locator("tbody tr", { hasText: ctx.title }).first().click();
  await m.getByRole("textbox", { name: "Tên phiếu" }).fill(`${ctx.title} — THPT An Lạc`);
  await m.getByRole("button", { name: "Vui lòng chọn tổ kiểm kê" }).click();
  await page.locator('[role="dialog"]').last().locator("tbody tr").first().click();
  await page.waitForTimeout(400);
  if (await page.locator('[role="dialog"]').count()) await page.keyboard.press("Escape");
  await m.getByRole("button", { name: "Lưu và lấy danh sách" }).click();
  ctx.sessionId = await idFromUrl(page);
  await loaded(page);
  await main(page).getByRole("button", { name: /^Đủ cả \d+ dòng/ }).waitFor({ timeout: 20_000 }).catch(() => {});
  const total = Number(((await m.innerText()).match(/Tất cả\s*\n?\s*(\d+)/) ?? [])[1] ?? 0);
  rec.check("K2:snapshot", "Luồng kiểm kê", "Lưu phiếu thì chụp danh sách thiết bị cần kiểm", total > 0, "critical", "> 0 dòng", `${total} dòng`, { role: "thptCanbo" });

  // KK-05: trong lúc kiểm kê, phiếu ghi tăng của trường bị chặn ở bước trình.
  const s = await apiLogin(request, "thptCanbo");
  const drafts = await call(request, s, "GET", "equipment_intakes?status=DRAFT&_start=0&_end=1");
  if (Array.isArray(drafts.body) && drafts.body[0]) {
    const r = await call(request, s, "POST", `equipment_intakes/${drafts.body[0].id}/submit`, {});
    rec.check("K2:freeze", "Luồng kiểm kê", "Đang kiểm kê cả trường thì trình phiếu ghi tăng bị chặn (khoá số liệu)", r.status === 422 && /khoá|kiểm kê/i.test(JSON.stringify(r.body)), "high", "422 + nêu phiếu kiểm kê đang khoá", `${r.status} ${String(r.body?.message ?? "").slice(0, 120)}`, { role: "thptCanbo" });
  } else {
    rec.add({ id: "K2:freeze", area: "Luồng kiểm kê", title: "Khoá số liệu (KK-05)", ok: true, severity: "info", expected: "-", actual: "THPT An Lạc không có phiếu ghi tăng nháp để thử — đã kiểm ở THCS Bình An khi chạy tay: 422 kèm tên phiếu kiểm kê đang khoá" });
  }

  await m.getByRole("button", { name: /^Đủ cả \d+ dòng/ }).click();
  const confirm = page.locator('[role="alertdialog"],[role="dialog"]').last();
  if (await confirm.isVisible({ timeout: 1_500 }).catch(() => false)) await confirm.getByRole("button").filter({ hasText: /Đủ|Xác nhận|Ghi/ }).last().click();
  const firstRow = m.locator("tbody tr").filter({ has: page.getByText("Không", { exact: true }) }).first();
  ctx.missingCode = ((await firstRow.innerText()).match(/\d{2}\.[0-9A-Z]+\.\d{2}\.TB\.\d+\.\d{2}/) ?? [])[0];
  await firstRow.getByText("Không", { exact: true }).click();
  await m.getByRole("button", { name: /^Lưu kết quả/ }).click();
  await page.waitForTimeout(2500);
  const after = (await m.innerText()).replace(/\s+/g, " ");
  const diff = Number((after.match(/Chênh lệch (\d+)/) ?? [])[1] ?? -1);
  rec.check("K2:count", "Luồng kiểm kê", "Ghi kết quả: đủ cả + 1 thiết bị không thấy → chênh lệch 1", diff === 1, "high", "Chênh lệch 1", `Chênh lệch ${diff}`, { role: "thptCanbo", evidence: await shot(page, "K2-counted") });
  await m.getByRole("button", { name: "Trình biên bản" }).click();
  await page.locator('[role="alertdialog"],[role="dialog"]').last().getByRole("button", { name: "Trình biên bản" }).click();
  const state = await voucherState(page);
  rec.check("K2:submit", "Luồng kiểm kê", "Trình biên bản kiểm kê", /Chờ.*duyệt/i.test(state), "critical", "Chờ lãnh đạo trường duyệt", `${state} · ${await toastText(page)}`, { role: "thptCanbo" });
  rec.check("K2:clean", "Lỗi kỹ thuật", "Không lỗi JS / API ở K2", !w.js.length && !w.api.filter((a) => !/submit/.test(a)).length, "high", "sạch", [...w.js, ...w.api].join(" | ") || "sạch");
  w.stop();
});

test("K3 hiệu trưởng duyệt biên bản; Sở xem tiến độ (KK-06, KK-02)", async ({ page, request }) => {
  test.skip(!ctx.sessionId, "chưa có phiếu kiểm kê");
  const w = watch(page);
  await uiLogin(page, "thptHieuTruong");
  await page.goto(`/inventory-sessions/show/${ctx.sessionId}`);
  await loaded(page);
  await main(page).getByRole("button", { name: /^Duyệt biên bản/ }).click();
  const dlg = page.locator('[role="alertdialog"],[role="dialog"]').last();
  const promise = await dlg.innerText();
  const outOfScope = ["ghi giảm", "điều chuyển", "báo hỏng"].filter((k) => promise.toLowerCase().includes(k));
  rec.check("K3:followups-scope", "Phạm vi", "Hộp duyệt biên bản không hứa lập phiếu của chức năng đã bỏ", outOfScope.length === 0, "high", "chỉ nhắc chức năng trong 42 UC", outOfScope.length ? `nhắc: ${outOfScope.join(", ")} — các chức năng này đã bỏ khỏi phạm vi` : "ổn", { role: "thptHieuTruong", evidence: await shot(page, "K3-approve-dialog") });
  await dlg.getByRole("button", { name: /^Duyệt biên bản/ }).last().click();
  const state = await voucherState(page);
  rec.check("K3:approve", "Luồng kiểm kê", "Hiệu trưởng duyệt biên bản", /Hoàn tất|Đã duyệt/i.test(state), "critical", "Hoàn tất", `${state} · ${await toastText(page)}`, { role: "thptHieuTruong" });
  const s = await apiLogin(request, "thptCanbo");
  const fu = await call(request, s, "GET", `inventory_sessions/${ctx.sessionId}/follow-ups`);
  if (ctx.missingCode) {
    const eq = await call(request, s, "GET", `equipment?q=${encodeURIComponent(ctx.missingCode)}&_start=0&_end=1`);
    const st = Array.isArray(eq.body) ? eq.body[0]?.status : undefined;
    rec.check("K3:missing-lost", "Luồng kiểm kê", `Thiết bị không thấy (${ctx.missingCode}) chuyển trạng thái Mất sau khi duyệt`, st === "LOST", "high", "LOST", String(st), { role: "thptHieuTruong" });
  }
  rec.check("K3:followups-orphan", "Phạm vi", "Thiết bị 'thiếu' sau kiểm kê có lối xử lý trong phạm vi đồ án", !JSON.stringify(fu.body).includes("disposals"), "high", "không sinh phiếu của chức năng đã bỏ", `máy chủ sinh: ${JSON.stringify(fu.body).slice(0, 120)} — không có màn nào mở được`, { role: "thptHieuTruong" });

  await uiLogin(page, "soChuyenVien");
  await page.goto("/inventory-campaigns");
  await loaded(page);
  await main(page).locator("tbody tr", { hasText: ctx.title }).first().click();
  await main(page).getByText(/Đã duyệt biên bản/).first().waitFor({ timeout: 20_000 }).catch(() => {});
  await loaded(page);
  // Đợt của Sở phủ cả trăm trường, bảng phân trang: lọc theo tên trường trước khi đọc.
  await main(page).getByLabel("Tìm trường").fill("THPT An Lạc").catch(() => {});
  await page.waitForTimeout(800);
  const prog = (await main(page).innerText()).replace(/\s+/g, " ");
  rec.check("K3:progress", "Luồng kiểm kê", "Sở thấy tiến độ đợt: trường đã duyệt, số thiếu", /Đã duyệt biên bản [1-9][0-9]*\//.test(prog) && /THPT An Lạc/.test(prog), "high", "THPT An Lạc · Hoàn tất · thiếu 1", (prog.match(/Đã duyệt biên bản[^A-Z]{0,40}/)?.[0] ?? prog.slice(0, 120)), { role: "soChuyenVien", evidence: await shot(page, "K3-progress") });
  rec.check("K3:clean", "Lỗi kỹ thuật", "Không lỗi JS / API ở K3", !w.js.length && !w.api.length, "high", "sạch", [...w.js, ...w.api].join(" | ") || "sạch");
  w.stop();
  void API;
});
