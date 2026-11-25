# Quy tắc chung của nhóm SEP490_G123 – SFEMS

File này là bộ quy tắc DUY NHẤT của nhóm. Mọi công cụ AI (Claude Code, Cursor, Copilot, Gemini, Codex…)
đều đọc file này trước khi sửa code; các file `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`
chỉ trỏ về đây. Người mới vào đọc file này rồi đọc `ARCHITECTURE.md` (kiến trúc, tầng, hợp đồng API).

Tiếng Việt dùng cho tên màn, nhãn, thông báo lỗi, comment giải thích "vì sao", và commit message.
Tên biến, tên file, tên resource, mã quyền dùng tiếng Anh theo quy ước có sẵn.

> **Nền mới (14/11/2026).** Code đã chuyển sang nền mới trên nhánh `dong/nen-moi`: cấu trúc thư mục, DB và
> changelog khác hẳn bản cũ. Mỗi người: kéo nhánh mới, **xoá và tạo lại database `sfems`** (app tự chạy toàn
> bộ changelog lúc khởi động), làm tiếp trên nền mới. Không gộp nhánh cũ vào — chép phần còn dùng được sang.

---

## 0. Phạm vi đồ án

46 UC trong `docs/SFEMS_Danh-sach-UC-pham-vi-do-an.xlsx` (sheet 1), khớp Báo cáo 3 mục I.4.2. Bốn UC thêm sau:
HT-07 cấp tài khoản cho nhân sự trường, HT-08 cấu hình luồng phê duyệt, TC-03 quản lý nhân sự trường, TC-04 đánh giá
cơ sở vật chất theo chuẩn. Hai cấp quản lý: **Sở GD&ĐT** và **trường** — KHÔNG có UBND. Ba loại tài khoản: quản trị
(`SYSTEM`), Sở (`SO`), trường (`SCHOOL`).

Khi code lệch tài liệu thì **Báo cáo 1 – 5 là chuẩn**, file này có thể chậm hơn. Phân quyền theo ma trận Báo cáo 3 mục
4.4 (chốt 24/11/2026, changelog 289): vai chỉ mang quyền cổng của loại tài khoản đó mở (`PermissionGrants`), quản trị
viên chỉ xem, xuất dữ liệu nghiệp vụ, vai `ADMIN` khoá quyền, một vai không vừa lập vừa duyệt cùng loại phiếu, không xoá
người dùng và trường (chỉ khoá, ngừng dùng). Nhật ký hoạt động chỉ còn lịch sử đăng nhập của tài khoản.

Ngoài phạm vi (sheet 3, đã gỡ khỏi code và menu — không làm lại): xác thực bằng ứng dụng (chỉ còn mã 6 số qua email
lúc đăng nhập, HT-01), màn nhật ký hoạt động, tình trạng hệ thống, tổng quan một trường, cơ sở – điểm trường, khối nhà, in tem QR, danh mục học kỳ. Các nghiệp vụ
cấp phát – bàn giao, điều chuyển, mượn – trả, mượn phòng, báo hỏng – sửa chữa – bảo hành – bảo trì, thanh lý – ghi
giảm, tính hao mòn, tồn kho theo lô, xuất kho – lưu kho – tiêu hao vật tư, sửa chữa công trình, điều chỉnh chuẩn
kiểu cũ, minh chứng kiểm định, kết nối hệ thống ngoài cũng ngoài phạm vi. Bảng CSDL của chúng (39 bảng, gồm `semesters`) đã xoá ở
changelog 285. Lớp, khối nhà, cơ sở còn ở backend làm DỮ LIỆU NỀN (phòng, thiết bị trỏ tới), không có màn quản lý
riêng.

Tra cứu theo mã (TS-02) là ô tìm của màn Thiết bị, dạng Từng thiết bị: gõ đúng mã thiết bị (mã chuẩn hoặc mã cũ) rồi
Enter thì mở thẳng hồ sơ. Không có màn Tra cứu / quét mã riêng, không quét mã bằng camera, không in tem QR (trưởng
nhóm chốt 24/11/2026). Nhật ký duyệt là một phần của luồng duyệt và được giữ: mỗi phiếu ghi ai duyệt / trả lại / từ chối,
lúc nào, ý kiến gì, hiện ở mục "Quá trình duyệt" trên phiếu.

---

## 1. Ai làm gì, sửa ở đâu

| Thành viên | Use case | Frontend (`frontend/src/features/`) | Backend (`com.g123.sfems.module`) |
|---|---|---|---|
| DongLV (lead) | HT-01..05, HT-07, HT-08, PN-01..03 | `identity`, `administration/{users,roles,permissions,approval-flows}`, `organization/equipment-intakes`, `organization/vouchers` | `security/*`, `school/intake`, `school/voucher`, `system/approvalflow` |
| TuTN | DM-01..04, KK-01..07 | `catalogs`, `organization/minimum-standard`, `organization/inventory-campaigns`, `organization/inventory-sessions` | `catalog/*`, `school/inventory` |
| HoangPND | TC-01..04, NC-01..07 | `organization/schools`, `organization/explorer` (hồ sơ trường, phòng), `organization/departments-of-education`, `organization/purchase-proposals`, `organization/procurement-plans` | `organization/*`, `school/facility`, `school/procurement` |
| NghiaNV | TS-01..07 | `organization/resources` (thiết bị), `organization/equipment-labels` (tra cứu theo mã), `administration/data-imports` | `school/equipment`, `school/coderule`, `system/attachment`, `system/dataimport` |
| QuangTD | HT-06, BC-01..06 | `dashboard`, `reports`, `notifications` | `report`, `system/notification`, `system/dataexport` |

Kiểu dữ liệu đi kèm đặt ở `frontend/src/domains/<thực thể>/` và entity ở `domain/<nhóm>/` tương ứng, cùng
người giữ.

**Chỉ sửa trong vùng của mình.** Cần thứ gì nằm ngoài vùng (component dùng chung, entity của người khác,
cột mới ở bảng chung) thì nhắn người giữ, không tự sửa rồi báo sau.

### File dùng chung – sửa phải báo DongLV trước

- `frontend/src/app/resources/index.tsx`, `app/resources/modules.tsx` – menu và phân hệ của cả nhóm.
- `frontend/src/app/router/protected-routes.tsx` – cây route.
- `frontend/src/shared/**`, `frontend/src/app/providers/**`, `frontend/src/styles/**`,
  `frontend/src/domains/portal/types.ts` (sinh tự động, xem mục 4).
- `backend/.../config/**`, `backend/.../shared/**` (gồm `shared/web/portal/PortalRoutes.java`),
  `backend/.../domain/base/**`, `backend/.../domain/security/**`.
- Changelog đã có trên nhánh chính (KHÔNG sửa; sai thì viết changelog mới sửa lại).
- `ARCHITECTURE.md`, `AGENTS.md`.

---

## 2. Thêm một màn hình vào menu

1. Viết component trong thư mục feature của mình, xuất qua `index.ts` của feature (`lazyNamed`).
2. Khai resource trong `app/resources/index.tsx` (tên resource = đoạn API = nửa đầu mã quyền). Màn là tab của
   một phân hệ (Thiết bị, Mua sắm) thì thêm vào `tabs` của phân hệ đó trong `app/resources/modules.tsx`.
3. Thêm `<Route>` tương ứng trong `app/router/protected-routes.tsx`, bọc `CanAccess`.
4. Seed mã quyền `<resource>:read|write|delete|…` bằng changelog của mình và cấp cho vai (kể cả `ADMIN` —
   không tự có). Resource có phạm vi dòng thì seed luôn chính sách phạm vi cho vai đó (xem mục 4).
5. Controller mới `/api/<x>`: khai `<x>` trong `PortalRoutes.java` (cổng nào đọc / ghi) rồi chạy
   `npm run gen:portal` trong `frontend/`.

Nhãn, placeholder, thông báo tiếng Việt viết thẳng trong component hoặc `app/locales/vi.json`.

---

## 3. Frontend

Chi tiết ở `ARCHITECTURE.md` mục 3. Tóm tắt phần hay sai:

- **Bốn tầng** `app / features / domains / shared`. `features/X` không import `features/Y` và không import
  `app/`. `domains/` là TypeScript thuần, không React. `npm run verify:arch` bắt lỗi này.
- **Không gọi `fetch`/`axios` trong page.** Dữ liệu đi qua Refine (`useTable`, `useForm`, `useOne`, `useList`,
  `useCustom`, `useCustomMutation`) — data provider ở `shared/api/data.ts`.
- **Cổng API tự chèn.** `portalFetch` (`shared/api/data.ts`) đổi `/api/equipment` thành
  `/api/school/equipment`, `/api/so/...`, `/api/admin/...` theo loại tài khoản trong token. Feature viết
  `${API_URL}/equipment` như thường, KHÔNG tự ghép tiền tố cổng. `/api/auth/**` không qua cổng.
- Màn chưa xong khi chưa vẽ `ListViewHeader` / `CreateViewHeader` / `EditViewHeader` / `ShowViewHeader`.
- `useCustom` trả object rỗng (truthy) khi chưa có dữ liệu — đọc qua `hooks/use-custom-result.ts`. Radix
  `Select` không hiện giá trị khi option chưa về — gộp giá trị hiện tại vào danh sách.
- Tải tệp lên đi qua hook `FormData` trong `shared/api/data.ts`; nút không phải submit trong form phải
  `type="button"`.
- **Màu, ngày, trạng thái:** màu qua class token (`bg-primary`, `text-success`, họ `*-subtle` / `*-text`), không
  hex trong JSX; kích thước tự đặt viết bằng `rem`; ngày qua `shared/lib/format.ts`; nhãn trạng thái ở
  `domains/<x>/types.ts`, màu badge ở `shared/lib/status-variants.ts`.
- **Bảng tự vẽ** dùng khung và `Table` của `shared/ui/table`, dòng dữ liệu mang `LIFT_ROW`; bảng trống dùng
  `TableEmpty`, không viết dòng "Chưa có…" trơn. Hộp xem danh sách chi tiết dùng `DetailTable`.
- **Cỡ hộp thoại:** `DialogContent size="form" | "sm" | "picker" | "wide"`, không tự đặt `max-w-*` / `h-*`.
- **Thanh tab** dùng `TAB_STRIP` / `TAB_ITEM` (`shared/lib/tab-style.ts`).
- **Không sửa `shared/ui/`** (shadcn gốc). Thêm component shadcn bằng `npx shadcn add <tên>`.
- **Ẩn theo quyền** bằng `<CanAccess>` / `useCan`; API luôn kiểm lại, UI chỉ ẩn.

---

## 4. Backend

Chi tiết ở `ARCHITECTURE.md` mục 2, 4. Tóm tắt phần hay sai:

- **Một lát (slice) = một package** `module/<nhóm>/<chức năng>/`: controller, DTO, service, repository của một
  chức năng. Lát lớn chia `api/` (controller, `api/dto/`), `service/`, `repo/` (vd. `security/user`); lát nhỏ để
  phẳng (vd. `school/procurement`, `catalog/coderule`). Entity nằm ở `domain/<nhóm>/`.
- **Gọi lát khác qua `service/`**, không qua `repo/` của nó; không import `api/dto/` của lát khác.
- **Mỗi endpoint có `@PreAuthorize("hasAuthority('<resource>:<động từ>')")`.** Động từ: `read`, `write`,
  `delete`, `approve`, `export`, `configure`.
- **Cổng API theo loại tài khoản.** Controller khai `@RequestMapping("/api/<x>")`; `PortalHandlerMapping` đăng
  ký nó dưới `/api/admin|so|school/<x>` theo bảng `shared/web/portal/PortalRoutes.java`. Sai loại tài khoản =
  403 trước mọi kiểm quyền. Quên khai thì `PortalGateTest` đỏ. Đổi bảng thì chạy `npm run gen:portal`
  (`verify:portal` báo khi bản sao frontend lệch).
- **Ba loại tài khoản, kế thừa JOINED:** `users` + bảng con `user_systems` / `user_sos` / `user_schools`. Tạo qua
  `User.create(type, …, school, managingBody)`; loại và đơn vị cố định từ lúc tạo. `users` KHÔNG có
  `school_id` / `managing_body_id` — SQL thuần nối bảng con, JPQL đi qua `SchoolUser` / `SoUser`. Vai có
  `role_type`, tài khoản chỉ mang vai cùng loại. Token mang claim `userType`.
- **Phạm vi dòng:** resource dưới phạm vi dòng đọc qua `rowLevel.scope(...)`, ghi qua `checkWritable`. Cấp mã
  quyền mà quên chính sách phạm vi tương ứng = có nút mà bấm đâu cũng 422. Truy vấn gộp (báo cáo) lọc qua
  `VisibleSchools`.
- **Danh sách** trả mảng JSON trần + header `X-Total-Count`; lỗi ném `ResourceNotFoundException` /
  `ConflictException` / `FieldValidationException`; `DELETE` trả body.
- **Ô nhận vào** dùng `shared/validation` (`@Text(FieldRule.X, …)`, `@Num`, `@DateValue`); mọi `@RequestBody`
  phải `@Valid`.
- **Phiếu có vòng duyệt** (đề xuất mua sắm, phiếu ghi tăng, biên bản kiểm kê) dùng khung `school/voucher`
  (`SchoolVoucher`, `VoucherService`, luồng duyệt `ApprovalFlowType`). Không tự viết máy trạng thái riêng.
- **Phản hồi dựng SAU khi giao dịch đóng** (`open-in-view=false`): liên kết LAZY mà phản hồi đọc phải được chạm
  trong service.
- **Liquibase** giữ schema (`ddl-auto=validate`). Mỗi thay đổi là một file mới
  `NNN-<ten-khong-dau>.sql` trong `db/changelog/changes/`, khai cuối `db.changelog-master.yaml`, changeset
  `--changeset <username>:NNN-<slug>`. Seed nối theo khoá tự nhiên (mã, username), không ghim id. Seed tạo tài
  khoản phải ghi `user_type` và thêm dòng vào đúng bảng con. Dải số mỗi người (nền đang ở 253):

  | Dải số | Người |
  |---|---|
  | 254–299 | DongLV (nền, dùng chung) |
  | 300–319 | DongLV |
  | 320–339 | TuTN |
  | 340–359 | HoangPND |
  | 360–379 | NghiaNV |
  | 380–399 | QuangTD |

- **Tài khoản thử:** `admin` / `Admin@123`; Sở `so.lanhdao`, `so.chuyenvien`; trường `thcs.hieutruong`,
  `thcs.canbo`, `thcs.canbo2` (chỉ cơ sở phụ), `thcs2.*`, `thpt.*` — mật khẩu `Demo@123`. Quản trị viên chỉ
  cấu hình, hỗ trợ, quản trị hệ thống: dữ liệu nghiệp vụ chỉ xem, không lập / duyệt phiếu (changelog 284, đảo 281).
  Thử luồng nghiệp vụ thì đăng nhập bằng tài khoản đúng vai.
- **Kho tệp (MinIO) phải chạy** trước khi bật backend: `docker compose -f backend/compose.yaml up -d minio`. Thiếu
  MinIO thì mọi lần đính kèm trả 503, mà phiếu ghi tăng bắt buộc tệp quyết định giao — cả luồng ghi tăng bị chặn.
- **Tài liệu API** (`/swagger-ui.html`) mặc định TẮT; muốn xem trên máy mình thì chạy với `APP_API_DOCS=true`.
- **Cấu hình máy mình** (mật khẩu DB, cổng, MinIO) để ở `backend/application-local.properties` — chép từ
  `application-local.properties.example`, đã ignore, nạp qua `spring.config.import`; ví dụ
  `spring.datasource.password=...`, `server.port=...`. KHÔNG sửa `application.properties` để đổi cấu hình máy
  mình.
- **Gửi thư** chỉ qua `shared/mail/MailService` với nội dung `MailContent` (khung HTML chung `MailTemplate`, kèm bản
  chữ thuần) — không tự dựng `JavaMailSender` hay viết HTML thư riêng. Thông báo muốn đi kèm email thì gọi
  `NotificationService.notify(NotificationType.…, …)` với đúng loại; loại mới thêm hằng ở `NotificationType` + một dòng
  `notification_type_settings` bằng changelog. Máy chủ thư khai trong `application-local.properties` (mẫu trong
  `.example`): máy dev dùng Mailpit (`docker compose -f backend/compose.yaml up -d mailpit`, xem thư ở
  http://localhost:8025), khi demo dùng Gmail SMTP + mật khẩu ứng dụng. Không khai thì thư chỉ được ghi ra log.

---

## 5. Git

- Nhánh: `main` là nhánh tích hợp, luôn chạy được. Mỗi người làm trên nhánh riêng `<ten>_dev`; tính năng lớn
  có thể tách `<ten>/<uc>` rồi gộp về nhánh riêng.
- Lên `main` bằng Pull Request, DongLV review và merge. Không push thẳng `main`, không force push nhánh người
  khác.
- Trước khi commit chạy `.\verify.ps1` (Windows) hoặc `./verify.sh` ở thư mục gốc: tsc + eslint + verify:arch +
  verify:portal + biên dịch backend. Đỏ thì không commit. Sửa backend thì chạy thêm `./gradlew test`.
- Commit message tiếng Việt, dạng `loai(pham-vi): mô tả ngắn (mã UC)`:
  - `loai`: `feat`, `fix`, `refactor`, `docs`, `chore`, `db` (changelog).
  - `pham-vi`: tên nghiệp vụ không dấu: `vai-tro`, `phieu-nhap`, `kiem-ke`, `danh-muc`, `bao-cao`…
  - Ví dụ: `feat(phieu-nhap): lập và trình phiếu nhập thiết bị (PN-01)`.
  - Không có dòng `Co-Authored-By`, không nhắc tới công cụ AI, không nhắc tới dự án khác.
- Không commit: `node_modules`, `build/`, `dist/`, `application-local.properties`, `.env*`, file log, ảnh chụp
  màn hình thử nghiệm.
- Trước khi mở PR: `git pull --rebase origin main`, giải quyết xung đột ở máy mình, chạy lại verify.

---

## 6. Dùng công cụ AI

- Nói rõ vùng được sửa (mục 1) và yêu cầu AI không đụng file dùng chung. Đọc diff trước khi commit; AI viết
  thì mình chịu trách nhiệm.
- Không cho AI đổi tên resource, đường dẫn, mã quyền, hay "dọn" code ngoài vùng của mình. Không làm lại chức
  năng ngoài phạm vi (mục 0).
- Không để AI thêm thư viện mới mà chưa hỏi nhóm.
- Commit message theo mục 5, tự viết hoặc sửa lại, không giữ chữ ký AI.
- Lệnh kiểm tra để AI chạy: `.\verify.ps1` hoặc `./verify.sh`.
