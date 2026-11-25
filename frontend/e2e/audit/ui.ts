import { expect, type Page } from "@playwright/test";

/** Thao tác giao diện dùng chung cho các luồng phiếu (đề xuất, kế hoạch, ghi tăng, kiểm kê). */

export const main = (page: Page) => page.locator("#main-content");

/** Bấm một nút hành động trên màn chi tiết phiếu, rồi xác nhận ở hộp hỏi lại (nếu có). */
export async function act(page: Page, label: RegExp | string, confirm?: RegExp | string, note?: string) {
  await main(page).getByRole("button", { name: label }).first().click();
  const dlg = page.locator('[role="alertdialog"],[role="dialog"]').last();
  if (await dlg.isVisible({ timeout: 3_000 }).catch(() => false)) {
    if (note) {
      const box = dlg.locator("textarea").first();
      if (await box.isVisible().catch(() => false)) await box.fill(note);
    }
    await dlg.getByRole("button", { name: confirm ?? label }).last().click();
  }
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

/** Chữ trạng thái ở cột phải của màn chi tiết phiếu. */
/** Chờ màn hết "Đang tải…". */
export async function loaded(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await expect(main(page)).not.toContainText("Đang tải", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(300);
}

export async function voucherState(page: Page) {
  await loaded(page);
  const re = /(Nháp|Chờ [^\n]*duyệt[^\n]*|Đã duyệt[^\n]*|Bị trả lại[^\n]*|Trả lại[^\n]*|Từ chối[^\n]*|Hoàn tất[^\n]*|Đã huỷ[^\n]*|Đã hoàn thành[^\n]*|Đang (?!tải)[^\n]*)/;
  let t = "";
  for (let i = 0; i < 20; i++) {
    t = await main(page).innerText();
    const m = t.match(re);
    if (m) return m[1].trim();
    await page.waitForTimeout(750);
  }
  return t.slice(0, 120).replace(/\s+/g, " ");
}

export async function mainButtons(page: Page) {
  return main(page).locator("button").evaluateAll((els) =>
    els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => ((e as HTMLElement).innerText || e.getAttribute("aria-label") || "").trim()).filter(Boolean));
}

export async function bell(page: Page) {
  await page.getByRole("button", { name: "Thông báo" }).first().click();
  const pop = page.locator("[data-radix-popper-content-wrapper]").last();
  await pop.waitFor({ timeout: 5_000 }).catch(() => {});
  const text = (await pop.innerText().catch(() => "")).replace(/\n+/g, " · ");
  await page.keyboard.press("Escape");
  return text;
}

export async function idFromUrl(page: Page) {
  await expect(page).toHaveURL(/\/show\/\d+/, { timeout: 15_000 });
  return Number(page.url().match(/show\/(\d+)/)![1]);
}
