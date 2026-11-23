import { test } from "@playwright/test";

import { Recorder, shot, toastText, uiLogin, watch } from "./lib";
import { act, bell, idFromUrl, loaded, main, mainButtons, voucherState } from "./ui";

/**
 * Luồng mua sắm đầu – cuối qua giao diện, đổi vai từng bước (NC-01 → NC-07, PN-01..03). GHI dữ liệu thử "E2E-AUDIT".
 */
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1600, height: 900 } });
const rec = new Recorder("flow-procurement");
const ctx: { proposalId?: number; proposalCode?: string; planId?: number; intakeId?: number; qty?: number } = {};
test.afterAll(() => rec.flush());

test("A1 cán bộ thiết bị xem mức đáp ứng và lập, trình đề xuất (NC-01, NC-02)", async ({ page }) => {
  const w = watch(page);
  await uiLogin(page, "canbo");
  await page.goto("/equipment-adequacy");
  await page.waitForLoadState("networkidle").catch(() => {});
  const adequacy = (await main(page).innerText()).slice(0, 300).replace(/\s+/g, " ");
  rec.check("A1:adequacy", "Luồng mua sắm", "Màn mức đáp ứng danh mục tối thiểu mở được và có số liệu", /thiếu|Đủ|đáp ứng/i.test(adequacy), "high", "có số liệu", adequacy.slice(0, 120), { role: "canbo", evidence: await shot(page, "A1-adequacy") });

  await page.goto("/purchase-proposals/create");
  await page.locator('textarea[name="reason"]').fill("E2E-AUDIT: thiếu so với định mức");
  await main(page).getByRole("button", { name: /Thêm thiết bị/ }).first().click();
  const dlg = page.locator('[role="dialog"]').last();
  // Mở nhóm môn đầu tiên còn thiếu (môn nào hết thiếu — do các lần chạy trước đã đề xuất — thì không còn trong danh sách).
  await dlg.locator("tbody tr").filter({ hasText: /loại thiết bị/ }).first().click();
  const row = dlg.locator("tbody tr").filter({ has: page.locator('[role=checkbox],input[type=checkbox]') }).first();
  await row.locator('[role=checkbox],input[type=checkbox]').first().click();
  await dlg.getByRole("button", { name: /^Thêm thiết bị|^Thêm \d/ }).last().click();
  await main(page).getByRole("button", { name: /^Trình/ }).last().click();
  const confirm = page.locator('[role="alertdialog"],[role="dialog"]').last();
  if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) await confirm.getByRole("button", { name: /Trình/ }).last().click();
  ctx.proposalId = await idFromUrl(page);
  const t = await toastText(page);
  const state = await voucherState(page);
  ctx.proposalCode = ((await main(page).innerText()).match(/ĐỀ XUẤT MUA SẮM\s+(MS-\d{4}-\d+)/i) ?? [])[1];
  rec.check("A1:submit", "Luồng mua sắm", "Lập và trình đề xuất từ định mức còn thiếu", /Chờ.*trường/i.test(state), "critical", "Chờ lãnh đạo trường duyệt", `${state} · toast: ${t}`, { role: "canbo", evidence: await shot(page, "A1-submitted") });
  const btns = await mainButtons(page);
  rec.check("A1:no-self-approve", "Phân quyền theo vai", "Người lập không thấy nút Duyệt trên phiếu của mình", !btns.some((b) => /^Duyệt$/.test(b)), "high", "không có nút Duyệt", btns.join(", "), { role: "canbo" });
  rec.check("A1:clean", "Lỗi kỹ thuật", "Không lỗi JS / API trong bước A1", !w.js.length && !w.api.length, "high", "sạch", [...w.js, ...w.api].join(" | ") || "sạch");
  w.stop();
});

test("A2 hiệu trưởng nhận thông báo và duyệt cấp trường (NC-03)", async ({ page }) => {
  test.skip(!ctx.proposalId, "A1 không tạo được phiếu");
  const w = watch(page);
  await uiLogin(page, "hieutruong");
  const b = await bell(page);
  rec.check("A2:bell", "Thông báo", "Hiệu trưởng nhận thông báo đề xuất chờ duyệt", b.includes(ctx.proposalCode ?? "MS-"), "medium", `có ${ctx.proposalCode}`, b.slice(0, 160), { role: "hieutruong" });
  await page.goto(`/purchase-proposals/show/${ctx.proposalId}`);
  await act(page, /^Duyệt$/, /Duyệt/);
  const state = await voucherState(page);
  rec.check("A2:approve", "Luồng mua sắm", "Hiệu trưởng duyệt → chuyển lên Sở", /Chờ.*(Sở|cơ quan|cấp trên)/i.test(state), "critical", "Chờ Sở duyệt", `${state} · toast: ${await toastText(page)}`, { role: "hieutruong", evidence: await shot(page, "A2-approved") });
  rec.check("A2:clean", "Lỗi kỹ thuật", "Không lỗi JS / API trong bước A2", !w.js.length && !w.api.length, "high", "sạch", [...w.js, ...w.api].join(" | ") || "sạch");
  w.stop();
});

test("A3 lãnh đạo Sở duyệt cấp Sở (NC-04)", async ({ page }) => {
  test.skip(!ctx.proposalId, "chưa có phiếu");
  const w = watch(page);
  await uiLogin(page, "soLanhDao");
  const b = await bell(page);
  rec.check("A3:bell", "Thông báo", "Lãnh đạo Sở nhận thông báo đề xuất chờ duyệt", b.includes(ctx.proposalCode ?? "MS-"), "medium", `có ${ctx.proposalCode}`, b.slice(0, 160), { role: "soLanhDao" });
  await page.goto(`/purchase-proposals/show/${ctx.proposalId}`);
  const before = await mainButtons(page);
  await act(page, /^Duyệt$/, /Duyệt/);
  const state = await voucherState(page);
  rec.check("A3:approve", "Luồng mua sắm", "Lãnh đạo Sở duyệt đề xuất", /Đã duyệt|Chờ.*kế hoạch|Chờ vào kế hoạch/i.test(state), "critical", "Đã duyệt / chờ vào kế hoạch", `${state} · nút trước: ${before.join(", ")}`, { role: "soLanhDao", evidence: await shot(page, "A3-approved") });
  rec.check("A3:clean", "Lỗi kỹ thuật", "Không lỗi JS / API trong bước A3", !w.js.length && !w.api.length, "high", "sạch", [...w.js, ...w.api].join(" | ") || "sạch");
  w.stop();
});

test("A4 chuyên viên Sở lập kế hoạch từ đề xuất đã duyệt và trình (NC-05)", async ({ page }) => {
  test.skip(!ctx.proposalCode, "chưa có đề xuất đã duyệt");
  const w = watch(page);
  await uiLogin(page, "soChuyenVien");
  await page.goto("/procurement-plans/create");
  await page.locator('input[name="title"]').fill(`E2E-AUDIT kế hoạch ${ctx.proposalCode}`);
  await page.locator('input[name="planDate"]').fill("20/11/2026");
  await page.keyboard.press("Tab");
  await main(page).getByRole("button", { name: /Thêm đề xuất/ }).click();
  const dlg = page.locator('[role="dialog"]').last();
  // Hộp chọn tải danh sách sau khi mở: chờ hết dòng "Đang tải…" rồi mới đọc.
  await dlg.locator("tbody tr", { hasNotText: /Đang tải/ }).first().waitFor({ timeout: 15_000 }).catch(() => {});
  const listed = await dlg.locator("tbody tr").allInnerTexts();
  rec.check("A4:candidates", "Luồng mua sắm", "Hộp chọn chỉ liệt kê đề xuất ĐÃ DUYỆT chưa vào kế hoạch", listed.some((t) => t.includes(ctx.proposalCode!)), "high", `có ${ctx.proposalCode}`, listed.map((t) => t.replace(/\s+/g, " ")).join(" | ").slice(0, 200), { role: "soChuyenVien" });
  await dlg.locator("tbody tr", { hasText: ctx.proposalCode! }).click();
  await dlg.getByRole("button", { name: /^Thêm \d+ đề xuất/ }).click();
  const submit = main(page).getByRole("button", { name: "Trình duyệt" }).last();
  const lockedWithoutPrice = await submit.isDisabled();
  rec.check("A4:price-required", "Validate", "Chưa nhập đơn giá dự toán thì không trình được kế hoạch", lockedWithoutPrice, "medium", "nút Trình khoá, có lý do", `${lockedWithoutPrice ? "khoá" : "KHÔNG khoá"} · ${await submit.getAttribute("title")}`, { role: "soChuyenVien" });
  for (const box of await page.getByRole("textbox", { name: "Đơn giá dự toán" }).all()) await box.fill("1500000");
  await page.keyboard.press("Tab");
  await act(page, "Trình duyệt", /Trình/);
  ctx.planId = await idFromUrl(page);
  const state = await voucherState(page);
  rec.check("A4:submit", "Luồng mua sắm", "Lập và trình kế hoạch mua sắm", /Chờ duyệt/i.test(state), "critical", "Chờ duyệt", `${state} · ${await toastText(page)}`, { role: "soChuyenVien", evidence: await shot(page, "A4-plan") });
  rec.check("A4:clean", "Lỗi kỹ thuật", "Không lỗi JS / API trong bước A4", !w.js.length && !w.api.length, "high", "sạch", [...w.js, ...w.api].join(" | ") || "sạch");
  w.stop();
});

test("A5 lãnh đạo Sở duyệt kế hoạch → đề xuất hoàn tất (NC-06)", async ({ page }) => {
  test.skip(!ctx.planId, "chưa có kế hoạch");
  const w = watch(page);
  await uiLogin(page, "soLanhDao");
  await page.goto(`/procurement-plans/show/${ctx.planId}`);
  await act(page, /^Duyệt$/, /^Duyệt$/);
  const state = await voucherState(page);
  rec.check("A5:approve", "Luồng mua sắm", "Lãnh đạo Sở duyệt kế hoạch", /Đã duyệt/i.test(state), "critical", "Đã duyệt", `${state} · ${await toastText(page)}`, { role: "soLanhDao", evidence: await shot(page, "A5-plan-approved") });
  rec.check("A5:clean", "Lỗi kỹ thuật", "Không lỗi JS / API trong bước A5", !w.js.length && !w.api.length, "high", "sạch", [...w.js, ...w.api].join(" | ") || "sạch");
  w.stop();
});

test("A6 cán bộ lập phiếu ghi tăng từ đề xuất đã hoàn tất và trình (NC-07, PN-01, PN-02)", async ({ page }) => {
  test.skip(!ctx.proposalId, "chưa có đề xuất");
  const w = watch(page);
  await uiLogin(page, "canbo");
  await page.goto(`/purchase-proposals/show/${ctx.proposalId}`);
  const pState = await voucherState(page);
  rec.check("A6:proposal-done", "Luồng mua sắm", "Đề xuất chuyển sang Hoàn tất sau khi kế hoạch được duyệt", /Hoàn tất/.test(pState), "high", "Hoàn tất", pState, { role: "canbo" });
  await main(page).getByRole("button", { name: /Hàng về, lập phiếu ghi tăng/ }).click();
  await page.waitForURL(/equipment-intakes\/(edit|create)/, { timeout: 15_000 });
  await loaded(page);
  await main(page).getByText("Trước khi trình").first().waitFor({ timeout: 15_000 }).catch(() => {});
  const m = main(page);
  const pre = await m.innerText();
  ctx.qty = Number((pre.match(/loại thiết bị · số lượng (\d+)/) ?? [])[1] ?? 0);
  rec.check("A6:prefill", "Luồng mua sắm", "Phiếu ghi tăng điền sẵn thiết bị, số lượng và nguồn 'Kế hoạch mua sắm' từ đề xuất", /Kế hoạch mua sắm/.test(pre) && (ctx.qty ?? 0) > 0, "high", "điền sẵn", pre.match(/\d+ loại thiết bị · số lượng \d+/)?.[0] ?? "không thấy", { role: "canbo" });
  // Validate: trình khi còn thiếu ô bắt buộc → danh sách "Trước khi trình" liệt kê đủ.
  const missing = (pre.match(/Trước khi trình\s*\n\s*còn (\d+)/) ?? [])[1];
  rec.check("A6:checklist", "Validate", "Form ghi tăng liệt kê các ô còn thiếu trước khi trình", !!missing, "medium", "có danh sách 'còn N'", missing ? `còn ${missing} mục` : "không có", { role: "canbo" });
  await m.locator('input[name="documents.0.supplier"]').fill("Công ty E2E-AUDIT Thiết bị");
  await page.keyboard.press("Escape");
  await m.locator('input[name="lines.0.unitPrice"]').fill("1500000");
  await m.locator('input[name="details.assignmentDecisionNo"]').fill("123/QĐ-SGDĐT");
  await m.locator('input[name="details.assignmentDecisionDate"]').fill("18/11/2026");
  await m.locator('input[name="details.handoverDate"]').fill("19/11/2026");
  await page.keyboard.press("Tab");
  // Tệp giả (HTML đổi đuôi .pdf) phải bị từ chối, rồi tải tệp PDF thật.
  const uploads: number[] = [];
  page.on("response", (r) => { if (/\/attachments$/.test(r.url()) && r.request().method() === "POST") uploads.push(r.status()); });
  let chooser = page.waitForEvent("filechooser");
  await m.getByRole("button", { name: "Chọn hoặc kéo thả tệp" }).last().click();
  await (await chooser).setFiles("e2e/audit/gia-mao.pdf");
  await page.waitForTimeout(1500);
  const fakeToast = await page.locator("[data-sonner-toast]").allInnerTexts();
  rec.check("A6:fake-file", "Bảo mật", "Tệp HTML đổi đuôi .pdf bị máy chủ từ chối", uploads[0] >= 400, "high", "4xx", String(uploads[0] ?? "không gửi"), { role: "canbo" });
  rec.check("A6:fake-file-msg", "UI/UX", "Tệp bị từ chối thì giao diện báo cho người dùng", fakeToast.length > 0 || /không hợp lệ|không đúng/i.test(await m.innerText()), "medium", "có thông báo", fakeToast.join(" / ") || "không báo gì — tệp lặng lẽ biến mất", { role: "canbo" });
  chooser = page.waitForEvent("filechooser");
  await m.getByRole("button", { name: "Chọn hoặc kéo thả tệp" }).last().click();
  await (await chooser).setFiles("e2e/audit/bien-ban.pdf");
  await page.waitForTimeout(1500);
  await act(page, "Trình duyệt", /Trình/);
  ctx.intakeId = await idFromUrl(page);
  const state = await voucherState(page);
  rec.check("A6:submit", "Luồng mua sắm", "Trình phiếu ghi tăng lập từ đề xuất", /Chờ.*duyệt/i.test(state), "critical", "Chờ lãnh đạo trường duyệt", `${state} · ${await toastText(page)}`, { role: "canbo", evidence: await shot(page, "A6-intake") });
  rec.check("A6:clean", "Lỗi kỹ thuật", "Không lỗi JS / API trong bước A6 (trừ tệp giả bị từ chối)", !w.js.length && !w.api.filter((a) => !/attachments/.test(a)).length, "high", "sạch", [...w.js, ...w.api].join(" | ") || "sạch");
  w.stop();
});

test("A7 hiệu trưởng duyệt phiếu ghi tăng → sinh hồ sơ và mã tài sản (PN-03, TS-06)", async ({ page }) => {
  test.skip(!ctx.intakeId, "chưa có phiếu ghi tăng");
  const w = watch(page);
  await uiLogin(page, "hieutruong");
  await page.goto(`/equipment-intakes/show/${ctx.intakeId}`);
  await loaded(page);
  await act(page, /^Duyệt và ghi tăng$/, /Duyệt và ghi tăng/);
  await main(page).getByText(/đã sinh \d+ hồ sơ/).waitFor({ timeout: 15_000 }).catch(() => {});
  const t = await main(page).innerText();
  const made = (t.match(/đã sinh (\d+) hồ sơ/) ?? [])[1];
  rec.check("A7:approve", "Luồng mua sắm", "Duyệt phiếu ghi tăng sinh đủ hồ sơ thiết bị", Number(made) === ctx.qty && !!made, "critical", `${ctx.qty} hồ sơ`, made ? `${made} hồ sơ · ${await toastText(page)}` : t.slice(-200), { role: "hieutruong", evidence: await shot(page, "A7-intake-approved") });
  rec.check("A7:clean", "Lỗi kỹ thuật", "Không lỗi JS / API trong bước A7", !w.js.length && !w.api.length, "high", "sạch", [...w.js, ...w.api].join(" | ") || "sạch");
  w.stop();
});
