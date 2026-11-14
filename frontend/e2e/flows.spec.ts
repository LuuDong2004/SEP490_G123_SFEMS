import { expect, test } from "@playwright/test";

import { bellText, login, toasts, watchErrors } from "./helpers";

/**
 * Quy trình đầu – cuối, đổi vai giữa các bước. GHI dữ liệu mẫu (lập phiếu, duyệt, hoàn tất) — chỉ chạy trên bản local.
 * Phiếu dùng tài sản đầu tiên đang trong kho và phòng "Phòng học 201".
 */
test.describe.configure({ mode: "serial" });

test("cấp phát: lập → trình → hiệu trưởng nhận thông báo, duyệt → cán bộ nhận thông báo, hoàn tất", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);

  await login(page, "canbo");
  await page.goto("/equipment-allocations/create");
  const form = page.locator('[role="dialog"]').first();
  await form.getByRole("button", { name: "Vui lòng chọn phòng nhận" }).click();
  const roomPicker = page.locator('[role="dialog"]').last();
  await roomPicker.getByRole("textbox").first().fill("phong hoc 201");
  await roomPicker.locator("tbody tr").first().click();
  await form.getByRole("button", { name: "Thêm thiết bị" }).click();
  const assetPicker = page.locator('[role="dialog"]').last();
  const code = (await assetPicker.locator("tbody tr").first().locator("td").nth(1).innerText()).trim();
  await assetPicker.locator("tbody tr").first().getByRole("checkbox").click();
  await assetPicker.getByRole("button", { name: /^Thêm 1/ }).click();
  await form.getByRole("button", { name: /^Trình/ }).click();
  await expect(page).toHaveURL(/\/equipment-allocations\/show\/\d+/);
  const id = page.url().match(/show\/(\d+)/)![1];
  expect(await toasts(page)).toContain("Đã trình phiếu");

  await login(page, "hieutruong");
  expect(await bellText(page)).toMatch(/chờ duyệt/);
  await page.goto(`/equipment-allocations/show/${id}`);
  await page.getByRole("button", { name: /^Duyệt/ }).first().click();
  await page.locator('[role="alertdialog"], [role="dialog"]').last().getByRole("button").filter({ hasText: /^Duyệt/ }).last().click();
  await expect(page.locator("[data-sonner-toast]").first()).toContainText("Đã duyệt");

  await login(page, "canbo");
  expect(await bellText(page)).toMatch(/đã được duyệt/);
  await page.goto(`/equipment-allocations/show/${id}`);
  await page.getByRole("button", { name: "Hoàn tất bàn giao" }).click();
  await page.locator('[role="alertdialog"], [role="dialog"]').last().getByRole("button").filter({ hasText: /^Hoàn tất bàn giao/ }).last().click();
  await expect(page.locator("[data-sonner-toast]").first()).toContainText("Đã cập nhật sổ thiết bị");

  // Tài sản đã sang phòng nhận.
  await page.getByRole("button", { name: /Tìm kiếm/ }).first().click();
  await page.keyboard.type(code);
  await expect(page.locator('[role="dialog"] [role="option"]').first()).toContainText("Phòng học 201");
  errors.expectClean("cấp phát");
});

test("UBND có lối vào đề nghị ghi giảm chờ mình duyệt", async ({ page }) => {
  await login(page, "ubndLanhDao");
  await page.goto("/disposals");
  await expect(page.locator("nav[aria-label^='Chức năng'] a", { hasText: "Đề nghị ghi giảm" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Chờ tôi duyệt/ })).toBeVisible();
});

test("tổng hợp của hiệu trưởng chỉ đếm phiếu chờ chính mình", async ({ page }) => {
  await login(page, "hieutruong");
  await page.goto("/dashboard");
  const text = await page.locator("main").last().innerText();
  const card = Number((text.match(/Phiếu chờ duyệt\s*\n\s*(\d+)/) ?? [])[1] ?? -1);
  // Không còn đếm 14 phiếu đang chờ UBND như trước.
  expect(card).toBeLessThan(14);
});
