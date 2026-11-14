import { expect, type Page } from "@playwright/test";

/**
 * Tài khoản mẫu của môi trường dev — cùng bộ với `056-seed-demo-operations.sql` / `005-seed-security.sql` và khung
 * "Tài khoản dùng thử" ở màn đăng nhập (chỉ có ở bản dev). Không dùng cho môi trường thật.
 */
export const ACCOUNTS = {
  canbo: { username: "thcs.canbo", password: "Demo@123" },
  hieutruong: { username: "thcs.hieutruong", password: "Demo@123" },
  soChuyenVien: { username: "so.chuyenvien", password: "Demo@123" },
  ubndLanhDao: { username: "ubnd.lanhdao", password: "Demo@123" },
  ubndChuyenVien: { username: "ubnd.chuyenvien", password: "Demo@123" },
  admin: { username: "admin", password: process.env.E2E_ADMIN_PASSWORD ?? "Admin@123" },
} as const;

export type Role = keyof typeof ACCOUNTS;

/** Đăng xuất sạch rồi đăng nhập qua form, chờ tới khi rời màn đăng nhập. */
export async function login(page: Page, role: Role) {
  const { username, password } = ACCOUNTS[role];
  // Quản trị viên đăng nhập ở khu riêng /admin/login (cổng Admin cách ly); máy local tắt bắt buộc 2 lớp
  // (APP_PORTAL_ADMIN_MFA_REQUIRED=false) thì vào thẳng được.
  const loginPath = role === "admin" ? "/admin/login" : "/login";
  await page.goto(loginPath);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(loginPath);
  await page.fill("#username", username);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}

/**
 * Ghi lại lỗi JS và lỗi API trong lúc chạy một bước. Bỏ qua 401 lúc chuyển tài khoản (phiên cũ hết hạn) và
 * lỗi nghiệp vụ có chủ đích (422) — bước nào cần kiểm 422 thì tự đọc thông báo.
 */
export function watchErrors(page: Page) {
  const js: string[] = [];
  const api: string[] = [];
  page.on("pageerror", (e) => js.push(e.message));
  page.on("response", (r) => {
    const url = r.url();
    if (!url.includes("/api/")) return;
    const s = r.status();
    if (s >= 500 || (s >= 400 && s !== 401 && s !== 422)) api.push(`${s} ${r.request().method()} ${url.replace(/^https?:\/\/[^/]+/, "")}`);
  });
  return {
    js,
    api,
    expectClean(label: string) {
      expect(js, `${label}: lỗi JS`).toEqual([]);
      expect(api, `${label}: lỗi API`).toEqual([]);
    },
  };
}

/** Đường dẫn các mục menu đang thấy ở thanh bên (đã mở mọi nhóm). */
export async function sidebarLinks(page: Page): Promise<string[]> {
  for (let i = 0; i < 3; i++) {
    for (const b of await page.$$('button[aria-expanded="false"]')) {
      const box = await b.boundingBox();
      if (box && box.x < 270) await b.click().catch(() => {});
    }
  }
  const links = await page.$$eval("a[href]", (as) =>
    as
      .filter((a) => {
        const r = a.getBoundingClientRect();
        return r.x < 270 && r.width > 0;
      })
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.startsWith("/")),
  );
  return [...new Set(links.map((h) => h.split("?")[0]))];
}

/** Các tab của phân hệ đang mở (thanh tab dưới đường dẫn). */
export async function moduleTabs(page: Page): Promise<string[]> {
  return page.$$eval("nav[aria-label^='Chức năng của phân hệ'] a[href]", (as) =>
    as.map((a) => (a.getAttribute("href") ?? "").split("?")[0]),
  );
}

/** Đọc các thông báo nổi đang hiện. */
export async function toasts(page: Page): Promise<string> {
  return (await page.locator("[data-sonner-toast]").allInnerTexts()).map((s) => s.replace(/\s+/g, " ")).join(" / ");
}

/** Mở chuông thông báo, trả về chữ trong hộp, rồi đóng. */
export async function bellText(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Thông báo" }).first().click();
  const pop = page.locator("[data-radix-popper-content-wrapper]").last();
  await pop.waitFor();
  const text = (await pop.innerText()).replace(/\n+/g, " · ");
  await page.keyboard.press("Escape");
  return text;
}
