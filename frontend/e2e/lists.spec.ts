import { expect, test } from "@playwright/test";

import { login, watchErrors } from "./helpers";

/** Thành phần dùng chung của danh sách: tìm (có dấu / không dấu), bấm dòng, phân trang, form trống, Ctrl+K. */

test.beforeEach(async ({ page }) => {
  await login(page, "canbo");
});

test("tìm không dấu ra cùng kết quả với có dấu", async ({ page }) => {
  await page.goto("/equipment-loans");
  const search = page.locator('main input[placeholder^="Tìm"]').first();
  await search.fill("Nguyễn Thị");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const withAccent = await page.locator("main tbody tr").count();
  await search.fill("nguyen thi");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const plain = await page.locator("main tbody tr").count();
  expect(withAccent).toBeGreaterThan(0);
  expect(plain).toBe(withAccent);
});

test("bấm một lần vào dòng mở chi tiết phiếu", async ({ page }) => {
  await page.goto("/equipment-allocations");
  await page.waitForLoadState("networkidle");
  await page.locator("main tbody tr").first().locator("td").nth(2).click();
  await expect(page).toHaveURL(/\/equipment-allocations\/show\/\d+/);
});

test("phân trang: sang trang 2 đổi dữ liệu, F5 giữ trang", async ({ page }) => {
  await page.goto("/equipment-intakes");
  await page.waitForLoadState("networkidle");
  // So theo số phiếu (cột 2), không theo cả dòng: cột STT tính lại sau khi tải nên có lúc lệch một nhịp.
  const codeOfFirst = () => page.locator("main tbody tr").first().locator("td").nth(1).innerText();
  const first = await codeOfFirst();
  await page.getByRole("button", { name: "Trang sau" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/currentPage=2/);
  const second = await codeOfFirst();
  expect(second).not.toBe(first);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect.poll(codeOfFirst).toBe(second);
});

test("phiếu chưa có dòng nào thì nút Lưu khoá", async ({ page }) => {
  await page.goto("/damage-reports/create");
  const save = page.locator('[role="dialog"]').getByRole("button", { name: /^Lưu/ }).first();
  await expect(save).toBeDisabled();
  await expect(save).toHaveAttribute("title", /ít nhất một dòng/);
});

test("ô chọn bắt buộc để trống thì báo dưới ô", async ({ page }) => {
  await page.goto("/room-bookings/create");
  const dialog = page.locator('[role="dialog"]').first();
  await dialog.getByRole("button", { name: /^Lưu/ }).first().click();
  await expect(dialog.locator('[data-slot="form-message"]').first()).toHaveText(/Chọn phòng/);
});

test("Ctrl+K tìm theo số phiếu", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Tìm kiếm/ }).first().click();
  await page.keyboard.type("TL-2026");
  await expect(page.locator('[role="dialog"] [role="option"]').filter({ hasText: /TL-2026-\d+/ }).first()).toBeVisible();
  errors.expectClean("Ctrl+K");
});

test("danh sách báo hỏng có cột Thiết bị", async ({ page }) => {
  await page.goto("/damage-reports");
  await expect(page.locator("main thead th").filter({ hasText: /^Thiết bị$/i })).toBeVisible();
});

test("điện thoại: danh sách phiếu là các thẻ, bấm thẻ mở phiếu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/damage-reports");
  await page.waitForLoadState("networkidle");
  const card = page.locator("main .divide-y > button").first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/damage-reports\/show\/\d+/);
});
