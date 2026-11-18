import { expect, test } from "@playwright/test";

import { login, moduleTabs, sidebarLinks, watchErrors, type Role } from "./helpers";

/**
 * Đi qua MỌI màn trong menu (và mọi tab của phân hệ) của từng vai: không trắng trang, không lỗi JS, không lỗi
 * API, có tiêu đề, không tràn ngang. Không ghi dữ liệu.
 */
// Trang đầu nằm dưới cổng của loại tài khoản (docs/kien-truc/11): /school, /so, /ubnd, /admin.
const ROLES: { role: Role; home: string }[] = [
  { role: "canbo", home: "/school/equipment" },
  { role: "hieutruong", home: "/school/dashboard" },
  { role: "soChuyenVien", home: "/so/dashboard" },
  { role: "ubndChuyenVien", home: "/ubnd/dashboard" },
  { role: "admin", home: "/admin/users" },
];

for (const { role, home } of ROLES) {
  test(`smoke: mọi màn của vai ${role}`, async ({ page }) => {
    test.setTimeout(1_200_000);
    await login(page, role);
    expect(new URL(page.url()).pathname, "màn mở đầu sau đăng nhập").toBe(home);

    const queue = await sidebarLinks(page);
    const seen = new Set<string>();
    const problems: string[] = [];
    while (queue.length && seen.size < 150) {
      const path = queue.shift()!;
      if (seen.has(path)) continue;
      seen.add(path);
      const errors = watchErrors(page);
      await page.goto(path);
      // Vài màn giữ kết nối lâu (thông báo, báo cáo nặng): chờ yên mạng tối đa 8 giây rồi đọc màn.
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
      // Màn tải chunk sau (lazy): đợi tiêu đề hiện ra rồi mới kết luận là thiếu.
      await page.locator("main h1").first().waitFor({ timeout: 6_000 }).catch(() => {});
      const info = await page.evaluate(() => ({
        h1: !!document.querySelector("main h1"),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      }));
      if (errors.js.length) problems.push(`${path}: JS ${errors.js[0]}`);
      if (errors.api.length) problems.push(`${path}: API ${errors.api[0]}`);
      if (!info.h1) problems.push(`${path}: thiếu tiêu đề h1`);
      if (info.overflow) problems.push(`${path}: tràn ngang`);
      for (const t of await moduleTabs(page)) if (!seen.has(t)) queue.push(t);
      page.removeAllListeners("pageerror");
      page.removeAllListeners("response");
    }
    // Cổng Admin chỉ có màn quản trị (docs/kien-truc/11) — ít màn hơn các cổng nghiệp vụ.
    expect(seen.size, "số màn đã đi qua").toBeGreaterThan(role === "admin" ? 8 : 20);
    expect(problems, `vai ${role}`).toEqual([]);
  });
}
