import { expect, test, type Page } from "@playwright/test";

import { ACCOUNTS, Recorder, uiLogin, type Role } from "./lib";

/**
 * Đăng xuất / đăng nhập lại trong cùng một tab: đăng xuất về gốc (màn đăng nhập, không mang trang cũ); người khác
 * đăng nhập sau thì vào trang chủ cổng của họ, không bị đưa vào địa chỉ của người trước (403); cùng người thì về trang cũ.
 */
test.describe.configure({ mode: "serial" });
const rec = new Recorder("flow-session");
test.afterAll(() => rec.flush());

async function logout(page: Page) {
  await page.locator('header button[aria-haspopup="menu"]').last().click();
  await page.getByRole("menuitem", { name: /Đăng xuất/ }).click();
  await page.waitForURL((u) => u.pathname === "/" || u.pathname.endsWith("/login"), { timeout: 15_000 });
}

async function signIn(page: Page, role: Role) {
  await page.fill("#username", ACCOUNTS[role].username);
  await page.fill("#password", ACCOUNTS[role].password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith("/login") && u.pathname !== "/", { timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

test("L1 đăng xuất về gốc, thấy ngay màn đăng nhập", async ({ page }) => {
  await uiLogin(page, "admin");
  await page.goto("/equipment-minimum");
  await logout(page);
  const url = new URL(page.url());
  rec.check("L1:root", "Phiên đăng nhập", "Đăng xuất về gốc, không mang đường dẫn cũ", url.pathname === "/" && !url.search, "high",
    "/", url.pathname + url.search);
  expect(url.pathname).toBe("/");
  expect(url.search).toBe("");
  await expect(page.locator("#username")).toBeVisible();
});

test("L2 người khác đăng nhập sau không bị đưa vào trang cũ của admin", async ({ page }) => {
  await uiLogin(page, "admin");
  await logout(page);
  // Mở lại địa chỉ admin cũ (thanh địa chỉ, lịch sử trình duyệt) — bị đẩy ra màn đăng nhập kèm ?to=.
  await page.goto("/admin/equipment-minimum?school=1&year=1");
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  await signIn(page, "canbo");
  const path = new URL(page.url()).pathname;
  rec.check("L2:other-user", "Phiên đăng nhập", "Cán bộ trường đăng nhập sau admin vào trang chủ của trường", path === "/school/equipment",
    "high", "/school/equipment", path, { role: "canbo" });
  expect(path).toBe("/school/equipment");
  await expect(page.getByText(/403|không có quyền/i)).toHaveCount(0);
});

test("L3 cùng người đăng nhập lại thì về trang đang xem", async ({ page }) => {
  await uiLogin(page, "canbo");
  await logout(page);
  await page.goto("/school/inventory-sessions");
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  await signIn(page, "canbo");
  const path = new URL(page.url()).pathname;
  rec.check("L3:same-user", "Phiên đăng nhập", "Cùng người đăng nhập lại về đúng trang cũ", path === "/school/inventory-sessions",
    "medium", "/school/inventory-sessions", path, { role: "canbo" });
  expect(path).toBe("/school/inventory-sessions");
});
