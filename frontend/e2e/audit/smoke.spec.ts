import { test, type Page } from "@playwright/test";

import { ACCOUNTS, Recorder, shot, uiLogin, watch, type Role } from "./lib";

/**
 * Đi qua MỌI màn trong menu (và mọi tab phân hệ) của từng vai, không ghi dữ liệu. Mỗi màn: lỗi JS, lỗi API, tiêu đề,
 * tràn ngang, thời gian tải, nút không có tên (khả năng tiếp cận). Thêm: màn hình điện thoại 390px cho vài màn chính.
 */
test.describe.configure({ mode: "serial" });
const rec = new Recorder("smoke");
const timing: Record<string, { path: string; ms: number }[]> = {};
test.afterAll(() => {
  rec.add({ id: "SM:timing", area: "Hiệu năng", title: "Thời gian tải từng màn (ms)", ok: true, severity: "info", expected: "< 3000 ms", actual: JSON.stringify(timing) });
  rec.flush();
});

async function sidebar(page: Page): Promise<string[]> {
  for (let i = 0; i < 3; i++) {
    for (const b of await page.$$('button[aria-expanded="false"]')) {
      const box = await b.boundingBox();
      if (box && box.x < 270) await b.click().catch(() => {});
    }
  }
  const links = await page.$$eval("a[href]", (as) => as.filter((a) => { const r = a.getBoundingClientRect(); return r.x < 270 && r.width > 0; })
    .map((a) => a.getAttribute("href") ?? "").filter((h) => h.startsWith("/")));
  return [...new Set(links.map((h) => h.split("?")[0]))];
}
const tabs = (page: Page) => page.$$eval("nav[aria-label^='Chức năng của phân hệ'] a[href], [role=tablist] a[href]", (as) => as.map((a) => (a.getAttribute("href") ?? "").split("?")[0]).filter((h) => h.startsWith("/")));

const ROLES: Role[] = ["admin", "soLanhDao", "soChuyenVien", "canbo", "hieutruong", "thptCanbo", "thptHieuTruong"];

for (const role of ROLES) {
  test(`SM ${role}: mọi màn trong menu`, async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await uiLogin(page, role);
    const home = new URL(page.url()).pathname;
    rec.add({ id: `SM:${role}:home`, area: "Điều hướng", title: `${ACCOUNTS[role].label}: màn mở đầu sau đăng nhập`, ok: true, severity: "info", expected: "-", actual: home, role });
    const queue = await sidebar(page);
    const seen = new Set<string>();
    timing[role] = [];
    let bad = 0;
    while (queue.length && seen.size < 120) {
      const path = queue.shift()!;
      if (seen.has(path) || /logout/.test(path)) continue;
      seen.add(path);
      const w = watch(page);
      const t0 = Date.now();
      await page.goto(path);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await page.locator("main h1").first().waitFor({ timeout: 6_000 }).catch(() => {});
      const ms = Date.now() - t0;
      timing[role].push({ path, ms });
      const info = await page.evaluate(() => ({
        h1: (document.querySelector("#main-content h1, main h1") as HTMLElement | null)?.innerText ?? "",
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        unnamed: [...document.querySelectorAll("#main-content button")].filter((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && !(b.textContent ?? "").trim() && !b.getAttribute("aria-label") && !b.getAttribute("title") && !b.getAttribute("aria-labelledby");
        }).length,
        notFound: /không tìm thấy trang|404/i.test(document.body.innerText.slice(0, 400)),
      }));
      const problems: string[] = [];
      if (w.js.length) problems.push(`JS: ${w.js[0]}`);
      if (w.api.length) problems.push(`API: ${w.api.slice(0, 2).join(", ")}`);
      if (!info.h1) problems.push("không có tiêu đề h1");
      if (info.overflow) problems.push("tràn ngang");
      if (info.notFound) problems.push("trang 404");
      if (ms > 5000) problems.push(`tải chậm ${ms} ms`);
      if (problems.length) bad++;
      rec.check(`SM:${role}:${path}`, "Đi qua màn", `${ACCOUNTS[role].label}: ${path} (${info.h1 || "?"})`, problems.length === 0,
        problems.some((p) => p.startsWith("JS") || p.includes("404") || /API: 5/.test(p)) ? "high" : "medium", "không lỗi", problems.join(" · ") || `ok · ${ms} ms`, { role, evidence: problems.length ? await shot(page, `SM-${role}-${path.replace(/\W+/g, "_")}`) : undefined });
      if (info.unnamed) rec.check(`SM:${role}:${path}:a11y`, "Khả năng tiếp cận", `${path}: nút chỉ có biểu tượng, không có tên`, false, "low", "mọi nút có tên (aria-label)", `${info.unnamed} nút`, { role });
      for (const t of await tabs(page)) if (!seen.has(t)) queue.push(t);
      w.stop();
    }
    rec.add({ id: `SM:${role}:count`, area: "Đi qua màn", title: `${ACCOUNTS[role].label}: số màn đã đi qua`, ok: true, severity: "info", expected: "-", actual: `${seen.size} màn, ${bad} màn có vấn đề`, role });
  });
}

test("SM mobile: màn chính trên điện thoại 390×844", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await uiLogin(page, "canbo");
  for (const path of ["/dashboard", "/purchase-proposals", "/purchase-proposals/create", "/equipment-intakes", "/inventory-sessions", "/equipment", "/notifications"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      tiny: [...document.querySelectorAll("#main-content button, #main-content a")].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24); }).length,
    }));
    rec.check(`SM:mobile:${path}`, "UI/UX điện thoại", `Điện thoại 390px: ${path}`, info.overflow <= 2 && info.tiny === 0, "medium", "không tràn ngang, nút/liên kết ≥ 24px", `${info.overflow > 2 ? `tràn ${info.overflow}px` : "không tràn"} · ${info.tiny} nút/liên kết nhỏ hơn 24px`, { role: "canbo", evidence: await shot(page, `mobile-${path.replace(/\W+/g, "_")}`) });
  }
});
