import fs from "fs";
import path from "path";

import { expect, test, type Page } from "@playwright/test";

import { login, toasts, watchErrors } from "./helpers";

/**
 * Kịch bản `docs/kich-ban-test/nhap-du-lieu-truong-moi/README.md`: một trường chưa có gì (mặc định THCS Thanh Bình), được cấp tài
 * khoản rồi tự nhập dữ liệu đầu vào. GHI dữ liệu — chỉ chạy trên bản local, trường phải đang trống.
 *
 *   E2E_BASE_URL=http://localhost:5575 npx playwright test onboarding-school --headed
 */
test.describe.configure({ mode: "serial" });
test.use({ launchOptions: { slowMo: Number(process.env.E2E_SLOWMO ?? 150) } });

/** Trường thử: phải ĐANG TRỐNG. Đổi trường bằng biến môi trường để chạy lại mà không phải dọn trường cũ. */
const SCHOOL = process.env.E2E_SCHOOL ?? "THCS Thanh Bình";
const SCHOOL_SEARCH = process.env.E2E_SCHOOL_SEARCH ?? "Thanh Bình";
const PREFIX = process.env.E2E_PREFIX ?? "thanhbinh";
/** Log backend: máy dev chưa khai máy chủ thư nên thư mời được ghi ra đây — lấy link đặt mật khẩu từ log. */
const BACKEND_LOG = process.env.E2E_BACKEND_LOG;
/** Tệp dữ liệu; trường khác thì sinh bộ riêng (gen_data.py … <tên miền email>) và trỏ E2E_DATA_DIR vào đó. */
const DATA = process.env.E2E_DATA_DIR ?? path.resolve(process.cwd(), "../docs/kich-ban-test/nhap-du-lieu-truong-moi");
const SHOTS = process.env.E2E_SHOTS ?? "e2e-onboarding";
const PASSWORD = process.env.E2E_NEW_PASSWORD ?? "Kiem-Thu#2611";

/** Ảnh từng bước — chỉ để xem lại, không bao giờ làm hỏng test. */
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false, timeout: 10_000 }).catch(() => console.log(`(bỏ ảnh ${name})`));

async function loginAs(page: Page, username: string, password = PASSWORD) {
  await page.goto("/login");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/login");
  await page.fill("#username", username);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}

test("bước 1: quản trị cấp tài khoản cho trường", async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, "admin");
  // Hiệu trưởng: người tạo đặt mật khẩu. Cán bộ: để trống mật khẩu → hệ thống gửi thư mời tự đặt mật khẩu.
  for (const [username, fullName, role, password] of [
    [`${PREFIX}.hieutruong`, "Phạm Văn Hùng", "Lãnh đạo trường", PASSWORD],
    [`${PREFIX}.canbo`, "Trần Minh Tâm", "Cán bộ thiết bị - CSVC trường", ""],
  ] as const) {
    await page.goto("/users/create");
    const dlg = page.getByRole("dialog");
    await dlg.locator('input[name="fullName"]').fill(fullName);
    await dlg.locator('input[name="username"]').fill(username);
    await dlg.locator('input[name="email"]').fill(`${username}@truong.edu.vn`);
    if (password) await dlg.locator('input[name="password"]').fill(password);
    await dlg.getByText("Vui lòng chọn trường").click();
    await page.keyboard.type(SCHOOL_SEARCH);
    await page.getByRole("option", { name: new RegExp(SCHOOL) }).first().click();
    await dlg.getByText(role, { exact: true }).click();
    await shot(page, `1-${username}`);
    await dlg.getByRole("button", { name: /^(Lưu|Tạo|Thêm)/ }).last().click();
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
    const said = await toasts(page);
    console.log(username, "→", said);
    if (!password) expect(said).toContain("gửi thư mời");
  }
  errors.expectClean("cấp tài khoản");
});

/** Link đặt mật khẩu mới nhất gửi cho `username` (đọc từ log backend). */
function inviteLink(username: string): string {
  test.skip(!BACKEND_LOG, "Cần E2E_BACKEND_LOG trỏ tới log backend để lấy link thư mời");
  const log = fs.readFileSync(BACKEND_LOG!, "utf8");
  const at = log.lastIndexOf(`Tên đăng nhập: ${username}`);
  expect(at, `chưa thấy thư mời của ${username} trong log`).toBeGreaterThan(-1);
  const link = log.slice(at).match(/https?:\/\/\S+\/reset-password\?token=[A-Za-z0-9_-]+(&invite=1)?/);
  expect(link, "thư mời không có link").not.toBeNull();
  return link![0];
}

test("bước 1b: cán bộ mở thư mời, tự đặt mật khẩu", async ({ page }) => {
  const errors = watchErrors(page);
  const link = inviteLink(`${PREFIX}.canbo`);
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(page.getByText("Đặt mật khẩu cho tài khoản mới")).toBeVisible();
  await page.locator("#new-password").fill(PASSWORD);
  await page.locator("#confirm-password").fill(PASSWORD);
  await shot(page, "1b-dat-mat-khau");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1500);
  await shot(page, "1c-dat-xong");
  console.log("sau đặt mật khẩu:", page.url(), "|", await toasts(page));
  await loginAs(page, `${PREFIX}.canbo`);
  expect(page.url()).not.toContain("/login");
  // Link chỉ dùng một lần (đăng xuất trước: đang đăng nhập thì trang đặt mật khẩu chuyển đi).
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await page.locator("#new-password").fill(PASSWORD);
  await page.locator("#confirm-password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1500);
  await shot(page, "1d-dung-lai-link");
  await expect(page.getByText(/hết hạn hoặc đã dùng/)).toBeVisible();
  // 422 của lần dùng lại link là lỗi có chủ đích — watchErrors đã bỏ qua 422.
  errors.expectClean("thư mời");
});

let batchUrl = "";

test("bước 2–3: cán bộ tải mẫu, tải tệp có lỗi lên", async ({ page }) => {
  const errors = watchErrors(page);
  await loginAs(page, `${PREFIX}.canbo`);
  await page.goto("/data-imports");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải tệp mẫu" }).click();
  const tpl = await download;
  console.log("tệp mẫu:", tpl.suggestedFilename());
  await shot(page, "2-danh-sach-lo");

  await page.getByRole("button", { name: "Tải tệp lên" }).click();
  await page.locator('input[type="file"]').setInputFiles(path.join(DATA, "THCS-Thanh-Binh_1-co-loi.xlsx"));
  await shot(page, "3a-chon-tep");
  await page.getByRole("dialog").getByRole("button", { name: "Tải lên" }).click();
  await page.waitForURL(/\/data-imports\/(show\/)?\d+/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  batchUrl = page.url();
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(`${SHOTS}/batch-url.txt`, batchUrl);
  console.log("lô:", batchUrl);
  const tabs = page.getByRole("tab");
  await tabs.first().waitFor({ timeout: 20_000 });
  for (let i = 0; i < (await tabs.count()); i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(400);
    console.log("trang:", (await tabs.nth(i).innerText()).replace(/\s+/g, " "), "|", await tabs.nth(i).getAttribute("title"));
    await shot(page, `3b-trang-${i}`);
  }
  errors.expectClean("tải tệp lên");
});

/** Lô đang làm: bước trước ghi lại, chạy riêng từng bước (-g) vẫn tìm được. */
const currentBatch = () => batchUrl || fs.readFileSync(`${SHOTS}/batch-url.txt`, "utf8").trim();

/** Ô ở lưới glide (canvas): lọc còn một dòng, bấm ô "Dòng", sang phải `col` ô, gõ giá trị (null = xoá ô). */
async function fixCell(page: Page, sheet: RegExp, search: string, col: number, value: string | null) {
  await page.getByRole("tab", { name: sheet }).click();
  const box = page.getByPlaceholder("Tìm trong trang này");
  await box.fill(search);
  await page.waitForTimeout(400);
  await page.mouse.click(310, 229);
  for (let i = 0; i < col; i++) await page.keyboard.press("ArrowRight");
  if (value === null) await page.keyboard.press("Delete");
  else {
    // Ký tự đầu mở ô sửa; gõ liền cả chuỗi thì mấy ký tự sau rơi trước khi ô kịp nhận.
    await page.keyboard.type(value.slice(0, 1));
    await page.waitForTimeout(300);
    await page.keyboard.type(value.slice(1), { delay: 40 });
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(900);
  await box.fill("");
}

/** Nhãn "Còn N dòng lỗi" ở đầu lô; hết lỗi thì nhãn biến mất — đếm chứ không chờ (chờ là treo tới hết giờ). */
const errorsLeft = async (page: Page) => {
  const badge = page.getByText(/Còn \d+ dòng lỗi/).first();
  return (await badge.count()) ? await badge.innerText() : "Còn 0 dòng lỗi";
};

test("bước 4: sửa lỗi trên lưới", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await loginAs(page, `${PREFIX}.canbo`);
  await page.goto(currentBatch());
  await page.getByRole("tab").first().waitFor();
  console.log("trước khi sửa:", await errorsLeft(page));

  await fixCell(page, /^Cán bộ/, "Võ Thị Mai", 1, "CB0005");
  console.log("sửa mã cán bộ trùng →", await errorsLeft(page));
  await shot(page, "4a-sua-can-bo");
  // Lỗi kéo theo: thư viện B.201 trỏ CB0005 — phải tự hết.
  await page.getByRole("tab", { name: /^Phòng/ }).click();
  console.log("trang Phòng sau khi sửa cán bộ:", await page.getByRole("tab", { name: /^Phòng/ }).getAttribute("title"));

  await fixCell(page, /^Khối nhà/, "NDN", 5, "2019");
  await fixCell(page, /^Phòng/, "A.301", 4, "3");
  await fixCell(page, /^Phòng/, "A.302", 5, "Phòng học");
  await shot(page, "4b-sua-loai-phong");
  await fixCell(page, /^Lớp học/, "9A1", 6, "A.302");
  await fixCell(page, /^Thiết bị/, "TS-0003", 7, null);
  await fixCell(page, /^Thiết bị/, "TS-0022", 4, "12");
  console.log("sau khi sửa tay:", await errorsLeft(page));

  // Còn mã phòng "a101": để Sửa nhanh làm.
  await page.getByRole("tab", { name: /^Thiết bị/ }).click();
  await page.getByRole("button", { name: "Sửa nhanh" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  await page.waitForTimeout(1500);
  await shot(page, "4c-sua-nhanh");
  await dlg.getByRole("button", { name: /^Áp dụng/ }).click();
  await page.waitForTimeout(1500);
  console.log("sau Sửa nhanh:", await errorsLeft(page));
  await shot(page, "4d-het-loi");

  // Sửa mã cán bộ thì trang Phòng tự kiểm lại (lỗi kéo theo ở B.201 tự hết); bấm "Kiểm tra lại" để chắc cả lô.
  await page.getByRole("button", { name: "Kiểm tra lại" }).click();
  await page.waitForTimeout(2500);
  console.log("sau Kiểm tra lại:", await errorsLeft(page));
  for (const t of await page.getByRole("tab").all()) console.log("  ", await t.getAttribute("title"));
  await expect(page.getByRole("button", { name: "Cập nhật" })).toBeEnabled();
  errors.expectClean("sửa lỗi");
});

test("bước 5: ghi vào hệ thống", async ({ page }) => {
  const errors = watchErrors(page);
  await loginAs(page, `${PREFIX}.canbo`);
  await page.goto(currentBatch());
  await page.getByRole("button", { name: "Cập nhật" }).click();
  await shot(page, "5a-xac-nhan");
  await page.getByRole("alertdialog").or(page.getByRole("dialog")).last().getByRole("button", { name: /Cập nhật/ }).last().click();
  await expect(page.getByRole("button", { name: "Hoàn tác" })).toBeVisible({ timeout: 60_000 });
  await shot(page, "5b-da-ghi");
  console.log("toast:", await toasts(page));
  errors.expectClean("ghi");
});

const staffRow = (page: Page, code: string) => page.locator("tr", { has: page.getByRole("cell", { name: code, exact: true }) });

async function openStaff(page: Page) {
  await page.goto("/school-explorer");
  await page.getByRole("tab", { name: /Nhân sự/ }).first().click();
  await page.waitForLoadState("networkidle");
}

test("bước 6: hiệu trưởng đặt chức vụ, cấp tài khoản theo cơ sở", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await loginAs(page, `${PREFIX}.hieutruong`);
  await openStaff(page);
  for (const [code, position] of [["CB0001", "Hiệu trưởng"], ["CB0002", "Phó hiệu trưởng"]]) {
    await page.getByPlaceholder(/Tìm cán bộ, giáo viên/).fill(code);
    await page.waitForTimeout(600);
    await staffRow(page, code).getByRole("button").last().click();
    await page.getByText("Sửa", { exact: true }).last().click();
    const dlg = page.getByRole("dialog");
    await dlg.waitFor();
    await dlg.getByRole("combobox", { name: /Chức vụ/ }).or(dlg.getByText("Vui lòng chọn chức vụ")).first().click();
    await page.getByRole("option", { name: position, exact: true }).click();
    await shot(page, `6c-chuc-vu-${code}`);
    await dlg.getByRole("button", { name: /^Lưu/ }).click();
    await expect(dlg).toBeHidden();
  }
  await page.getByPlaceholder(/Tìm cán bộ, giáo viên/).fill("CB000");
  await page.waitForTimeout(600);
  await expect(staffRow(page, "CB0001")).toContainText("Hiệu trưởng");
  await expect(staffRow(page, "CB0002")).toContainText("Phó hiệu trưởng");

  await staffRow(page, "CB0004").getByRole("button", { name: "Cấp tài khoản" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByRole("combobox").first()).toContainText("Cán bộ thiết bị");
  await dlg.getByLabel("Tên đăng nhập").fill(`${PREFIX}.ap3`);
  await dlg.getByRole("combobox").last().click();
  await page.getByRole("option", { name: /Ấp 3/ }).click();
  await shot(page, "6d-cap-tai-khoan");
  await dlg.getByRole("button", { name: "Cấp tài khoản" }).click();
  const cred = page.getByRole("dialog", { name: /Tài khoản của/ });
  await cred.waitFor();
  await shot(page, "6e-mat-khau-tam");
  // CB0004 có email trong tệp → máy chủ gửi thư mời; hộp nói rõ, mật khẩu tạm chỉ là lối dự phòng.
  await expect(cred).toContainText("Đã gửi thư mời tới");
  // Mật khẩu tạm hiện một lần: lấy để bước sau đăng nhập, không in ra.
  const text = await cred.innerText();
  const temp = text.split(/\s+/).find((w) => w.length >= 8 && /[A-Z]/.test(w) && /\d/.test(w) && w !== `${PREFIX}.ap3`);
  fs.writeFileSync(`${SHOTS}/ap3.txt`, temp ?? "");
  await cred.getByRole("button", { name: "Xong" }).click();
  errors.expectClean("hiệu trưởng");
});

test("bước 6b: tài khoản điểm trường chỉ thấy cơ sở mình", async ({ page }) => {
  const errors = watchErrors(page);
  const temp = fs.readFileSync(`${SHOTS}/ap3.txt`, "utf8").trim();
  await page.goto("/login");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/login");
  await page.fill("#username", `${PREFIX}.ap3`);
  await page.fill("#password", temp);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  if (page.url().endsWith("/login")) {
    // Đã đổi mật khẩu tạm ở lần chạy trước.
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }
  await shot(page, "6f-ap3-dang-nhap");
  console.log("sau đăng nhập:", page.url());
  // Lần đầu bắt đổi mật khẩu tạm thì đổi sang mật khẩu thử nghiệm.
  if (await page.locator('input[type="password"]').count() >= 2) {
    const boxes = page.locator('input[type="password"]');
    const n = await boxes.count();
    if (n === 3) await boxes.nth(0).fill(temp);
    await boxes.nth(n - 2).fill(PASSWORD);
    await boxes.nth(n - 1).fill(PASSWORD);
    await page.getByRole("button", { name: /Đổi mật khẩu|Lưu|Xác nhận|Tiếp tục/ }).last().click();
    await page.waitForTimeout(2500);
    console.log("sau đổi mật khẩu:", page.url());
  }
  await page.goto("/school-explorer");
  await page.waitForLoadState("networkidle");
  await shot(page, "6g-ap3-ho-so");
  console.log("hồ sơ:", (await page.locator("#main-content").innerText()).replace(/\s+/g, " ").slice(0, 700));
  await page.getByRole("tab", { name: /Cơ sở vật chất/ }).first().click();
  await page.waitForLoadState("networkidle");
  await shot(page, "6h-ap3-csvc");
  console.log("csvc:", (await page.locator("#main-content").innerText()).replace(/\s+/g, " ").slice(0, 900));
  errors.expectClean("tài khoản điểm trường");
});

test("bước 7a: nhập lại tệp sạch — báo Đã có, không tạo trùng", async ({ page }) => {
  const errors = watchErrors(page);
  await loginAs(page, `${PREFIX}.canbo`);
  await page.goto("/data-imports");
  await page.getByRole("button", { name: "Tải tệp lên" }).click();
  await page.locator('input[type="file"]').setInputFiles(path.join(DATA, "THCS-Thanh-Binh_2-sach.xlsx"));
  await page.getByRole("dialog").getByRole("button", { name: "Tải lên" }).click();
  await page.waitForURL(/\/data-imports\/(show\/)?\d+/, { timeout: 60_000 });
  await page.getByRole("tab").first().waitFor();
  fs.writeFileSync(`${SHOTS}/reimport-url.txt`, page.url());
  for (const t of await page.getByRole("tab").all()) console.log("  ", (await t.innerText()).replace(/\s+/g, " "), "|", await t.getAttribute("title"));
  await shot(page, "7a-nhap-lai");
  for (const sheet of [/^Cơ sở/, /^Cán bộ/, /^Khối nhà/, /^Phòng/, /^Lớp học/, /^Thiết bị/])
    expect(await page.getByRole("tab", { name: sheet }).getAttribute("title")).toMatch(/(\d+) dòng · \1 đã có/);
  // Lô nhập lại chỉ để xem — xoá, không ghi.
  await page.getByRole("button", { name: "Thao tác khác" }).click();
  await page.getByText("Xoá lô", { exact: false }).last().click();
  await page.getByRole("alertdialog").or(page.getByRole("dialog")).last().getByRole("button", { name: "Xoá", exact: true }).click();
  await page.waitForURL(/\/data-imports$/);
  errors.expectClean("nhập lại");
});

test("bước 7b: hoàn tác lô đã ghi", async ({ page }) => {
  const errors = watchErrors(page);
  await loginAs(page, `${PREFIX}.canbo`);
  await page.goto(currentBatch());
  await page.getByRole("button", { name: "Hoàn tác" }).click();
  await shot(page, "7b-xac-nhan-hoan-tac");
  await page.getByRole("alertdialog").or(page.getByRole("dialog")).last().getByRole("button", { name: /Hoàn tác/ }).last().click();
  // Cán bộ CB0004 đã được cấp tài khoản ở bước 6 → máy chủ chặn (409), lô giữ "Đã ghi".
  await expect(page.locator("[data-sonner-toast]").first()).toContainText("không hoàn tác được");
  await shot(page, "7c-sau-hoan-tac");
  await expect(page.getByText("Đã ghi vào hệ thống")).toBeVisible();
  expect(errors.js).toEqual([]);
});
