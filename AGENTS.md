# Quy tắc chung của nhóm SEP490_G123 – SFEMS

File này là bộ quy tắc DUY NHẤT của nhóm. Mọi công cụ AI (Claude Code, Cursor, Copilot, Gemini, Codex…)
đều đọc file này trước khi sửa code; các file `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`
chỉ trỏ về đây. Người mới vào đọc file này rồi đọc `ARCHITECTURE.md` (kiến trúc, tầng, hợp đồng API).

Tiếng Việt dùng cho tên màn, nhãn, thông báo lỗi, comment giải thích "vì sao", và commit message.
Tên biến, tên file, tên resource, mã quyền dùng tiếng Anh theo quy ước có sẵn.

---

## 1. Ai làm gì, sửa ở đâu

| Thành viên | Use case | Frontend (`frontend/src/`) | Backend (`com.g123.sfems`) |
|---|---|---|---|
| DongLV (lead) | HT-01..05, PN-01..03 | `features/identity`, `features/administration`, `features/organization/equipment-intakes`, `features/organization/vouchers` | `module/security/*`, `module/school/intake`, `module/school/voucher`, `module/system/approvalflow` |
| TuTN | DM-01..04, KK-01..07 | `features/catalogs`, `features/organization/minimum-standard`, `features/organization/inventory-campaigns`, `features/organization/inventory-sessions` | `module/catalog/*`, `module/school/inventory` |
| HoangPND | TC-01..02, NC-01..07 | `features/organization/schools`, `features/organization/resources` (phòng), `features/organization/purchase-proposals`, `features/organization/procurement-plans` | `module/organization/*`, `module/school/facility`, `module/school/procurement` |
| NghiaNV | TS-01..07 | `features/organization/resources` (thiết bị, tra cứu, nhập từ tệp) | `module/school/equipment`, `module/school/coderule`, `module/system/attachment`, `module/system/dataimport` |
| QuangTD | HT-06, BC-01..06 | `features/dashboard`, `features/reports`, `features/notifications` | `module/report`, `module/system/notification`, `module/system/dataexport` |

Kiểu dữ liệu đi kèm đặt ở `domains/<thực thể>/` và entity ở `domain/<nhóm>/` tương ứng, cùng người giữ.

**Chỉ sửa trong vùng của mình.** Cần thứ gì nằm ngoài vùng (component dùng chung, entity của người khác,
cột mới ở bảng chung) thì nhắn người giữ, không tự sửa rồi báo sau.

### File dùng chung – sửa phải báo DongLV trước

- `frontend/src/app/resources/index.tsx` – menu của cả nhóm. KHÔNG đổi tên resource, đường dẫn, thứ tự.
- `frontend/src/app/router/routes.tsx` – chỉ thay `PlaceholderScreen` của màn mình bằng component thật.
- `frontend/src/shared/**`, `frontend/src/app/providers/**`, `frontend/src/styles/**`
- `backend/.../config/**`, `backend/.../shared/**`, `backend/.../domain/base/**`
- Changelog `001`–`006` (đã chạy trên máy mọi người, KHÔNG sửa; sai thì viết changelog mới sửa lại).
- `ARCHITECTURE.md`, `AGENTS.md`.

---

## 2. Thêm một màn hình vào menu

Menu đã dựng đủ 42 UC. Mỗi màn chưa làm đang hiện "Tính năng đang phát triển". Làm màn của mình:

1. Viết component trong thư mục feature của mình, xuất qua `index.ts` của feature.
2. Trong `routes.tsx`, tìm dòng của resource mình, truyền component vào `screens` của `crudRoutes(...)`
   hoặc tham số thứ ba của `listRoute(...)`. Không thêm `<Route>` mới ngoài danh sách đã có.
3. Không đổi `name`, `list/create/edit/show` trong `resources/index.tsx`. Cần một màn con (dialog, tab
   trong màn) thì làm bằng route con hoặc state trong feature, không thêm resource mới.
4. Nhãn, placeholder, thông báo tiếng Việt của màn đặt trong `app/locales/vi.json` theo khoá
   `<resource>.<field>`; nhãn chỉ dùng một chỗ thì viết thẳng trong component cũng được.

Thực sự cần màn mới ngoài 42 UC: nhắn DongLV kèm tên resource, đường dẫn, mã quyền; DongLV thêm vào
`resources/index.tsx` và seed quyền, rồi người làm mới viết màn.

---

## 3. Frontend

Chi tiết ở `ARCHITECTURE.md` mục 3. Tóm tắt phần hay sai:

- **Bốn tầng** `app / features / domains / shared`. `features/X` không import `features/Y` và không import
  `app/`. `domains/` là TypeScript thuần, không React. `npm run verify:arch` bắt lỗi này.
- **Tên resource = đoạn API = nửa đầu mã quyền.** `equipment_intakes` ⇔ `/api/equipment_intakes` ⇔
  `equipment_intakes:read`. Đường dẫn màn dùng gạch nối `/equipment-intakes`.
- **Không gọi `fetch`/`axios` trong page.** Dữ liệu CRUD đi qua `useTable`, `useForm`, `useOne`, `useList`
  của Refine (data provider ở `shared/api/data.ts`). Endpoint con (`/submit`, `/approve`…) gọi qua
  `useCustomMutation`.
- **Màn danh sách** dùng `ListView` + `ListViewHeader` + `DataTable` (mẫu:
  `features/administration/users/list.tsx`). **Màn tạo/sửa/xem** dùng `CreateView` / `EditView` /
  `ShowView` + `*ViewHeader` tương ứng; form bằng `react-hook-form` + `zod` qua `@refinedev/react-hook-form`.
- **Component dùng chung** đã có ở `shared/components/`: `buttons/` (Create/Edit/Show/Delete/Refresh),
  `data-table/` (bảng, phân trang, lọc nhanh, lọc tham chiếu, thao tác dòng), `form/` (combobox tải động,
  ngày, khoảng ngày, tiền, mật khẩu, ô chỉ đọc, section), `views/`, `confirm/`, `timeline.tsx`.
  Dùng trước, hỏi sau; thiếu thì nhắn DongLV, không tự tạo bản sao trong feature.
- **Bộ phiếu dùng chung** `shared/components/voucher/` cho đề xuất mua sắm, phiếu nhập, phiếu kiểm kê:
  `VoucherList` (danh sách: số phiếu, trường, trạng thái, lọc, "Chờ tôi duyệt"), `VoucherFormPage` (lập /
  sửa hai cột, Lưu nháp · Trình, danh sách "Cần hoàn thiện"), `VoucherShowShell` (chi tiết: nút vòng duyệt,
  lời nhắn trả lại, quá trình duyệt, menu ⚙), `VoucherActions`, `VoucherStatusBadge`, `VoucherTimeline`,
  `VoucherLinesCard` (chỗ đặt bảng dòng). Kiểu chung ở `domains/voucher/types.ts` (`VoucherBase`). Màn
  của một loại phiếu chỉ khai cột riêng, ô riêng và bảng dòng của nó.
- **Không sửa `shared/ui/`** (shadcn gốc). Thêm component shadcn mới bằng `npx shadcn add <tên>`.
- **Màu, ngày, trạng thái:** màu qua class token (`bg-primary`, `text-success`…), không hex trong JSX;
  ngày qua `shared/lib/format.ts`; nhãn trạng thái trong `domains/<x>/types.ts`, màu badge trong
  `shared/lib/status-variants.ts`.
- **Ẩn theo quyền** bằng `<CanAccess>` hoặc `useCan`; API luôn kiểm lại, UI chỉ ẩn.

---

## 4. Backend

Chi tiết ở `ARCHITECTURE.md` mục 2, 4, 6. Tóm tắt phần hay sai:

- **Một lát (slice) = một package phẳng** trong `module/...`: Controller, Request/Response, Service,
  Repository, Specifications, Policies. Mẫu: `module/catalog/coderule/`.
- **Gọi lát khác qua Service**, không qua Repository của nó. Không dùng DTO của lát khác; cần tóm tắt thì
  khai `XxxRef` riêng trong lát mình.
- **Mỗi endpoint có `@PreAuthorize("hasAuthority('<resource>:<động từ>')")`.** Sáu động từ: `read`,
  `write`, `delete`, `approve`, `export`, `configure`. Mã quyền của 42 UC đã seed ở changelog 006;
  cần mã mới thì nhắn DongLV.
- **Danh sách** trả mảng JSON trần + header `X-Total-Count`; đọc tham số qua `ListParams`. Lỗi ném
  `ResourceNotFoundException` / `ConflictException` / `FieldValidationException`, không tự trả JSON lỗi.
- **Phiếu có vòng duyệt** (đề xuất mua sắm, phiếu nhập, phiếu kiểm kê): entity kế thừa `SchoolVoucher`
  (`domain/school/voucher`), service kế thừa `VoucherService`, controller kế thừa `VoucherController`,
  policies kế thừa `VoucherPolicies` (`module/school/voucher`). Có sẵn: trình / duyệt từng cấp / trả lại /
  từ chối / huỷ / hoàn tất, số phiếu, nhật ký duyệt, bộ lọc chung, `_actions` cho màn hình. Loại phiếu
  chỉ viết `applyCreate`, `applyUpdate`, `filters`, `validateSubmit`, `onApproved`. Khai loại phiếu mới
  trong `ApprovalFlowType`. Không tự viết máy trạng thái riêng.
- **Dữ liệu thuộc trường** (phòng, thiết bị, đợt kiểm kê): entity kế thừa `SchoolOwnedEntity`, service
  kế thừa `SchoolOwnedService`, repository kế thừa `SchoolOwnedRepository`, policies kế thừa
  `SchoolOwnedPolicies` (`module/school/base`). Phạm vi "chỉ trường mình" cho 5 vai trò đã seed ở
  changelog 010 cho rooms, equipment, ba loại phiếu, inventory_campaigns.
- **Liquibase:** mỗi thay đổi schema là một file mới `NNN-<ten-khong-dau>.sql` trong
  `db/changelog/changes/`, khai vào `db.changelog-master.yaml`, changeset ghi
  `--changeset <username>:NNN-<slug>`. Không sửa file đã có trên `main`. Để không đụng số, mỗi người
  dùng dải riêng:

  | Dải số | Người |
  |---|---|
  | 010–029 | DongLV |
  | 030–049 | TuTN |
  | 050–069 | HoangPND |
  | 070–089 | NghiaNV |
  | 090–109 | QuangTD |

- **Dữ liệu mẫu** nối theo khoá tự nhiên (mã, username), không ghi cứng id. Bảng mới có đủ `id`,
  `created_at/by`, `updated_at/by` để khớp `BaseEntity`; `ddl-auto=validate` sẽ chặn khởi động nếu lệch.
- **Cấu hình máy mình** để ở `backend/application-local.properties` (đã ignore), không sửa
  `application.properties` để đổi mật khẩu DB.

---

## 5. Git

- Nhánh: `main` là nhánh tích hợp, luôn chạy được. Mỗi người làm trên nhánh riêng `<ten>_dev`
  (`dong_dev`, `tu_dev`, …); tính năng lớn có thể tách `<ten>/<uc>` rồi gộp về nhánh riêng.
- Lên `main` bằng Pull Request, DongLV review và merge. Không push thẳng `main`, không force push
  nhánh người khác.
- Trước khi commit chạy `.\verify.ps1` (Windows) hoặc `./verify.sh` ở thư mục gốc: tsc + eslint +
  verify:arch + biên dịch backend. Đỏ thì không commit.
- Commit message tiếng Việt, dạng `loai(pham-vi): mô tả ngắn (mã UC)`:
  - `loai`: `feat`, `fix`, `refactor`, `docs`, `chore`, `db` (changelog).
  - `pham-vi`: tên nghiệp vụ không dấu: `vai-tro`, `phieu-nhap`, `kiem-ke`, `danh-muc`, `bao-cao`…
  - Ví dụ: `feat(phieu-nhap): lập và trình phiếu nhập thiết bị (PN-01)`.
  - Không có dòng `Co-Authored-By`, không nhắc tới công cụ AI, không nhắc tới dự án khác.
- Không commit: `node_modules`, `build/`, `dist/`, `application-local.properties`, `.env*`, file log,
  ảnh chụp màn hình thử nghiệm.
- Trước khi mở PR: `git pull --rebase origin main`, giải quyết xung đột ở máy mình, chạy lại verify.

---

## 6. Dùng công cụ AI

- Nói rõ vùng được sửa (mục 1) và yêu cầu AI không đụng file dùng chung. Đọc diff trước khi commit;
  AI viết thì mình chịu trách nhiệm.
- Không cho AI đổi tên resource, đường dẫn, mã quyền, hay "dọn" code ngoài vùng của mình.
- Không để AI thêm thư viện mới mà chưa hỏi nhóm (mỗi thư viện là một thứ cả 5 máy phải cài).
- Commit message theo mục 5, tự viết hoặc sửa lại, không giữ chữ ký AI.
- Lệnh kiểm tra để AI chạy: `.\verify.ps1` hoặc `./verify.sh`.
