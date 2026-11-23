# Kiến trúc và tổ chức code – SFEMS

Tài liệu này mô tả cách tổ chức mã nguồn của SFEMS (Hệ thống quản lý cơ sở vật chất và thiết bị trường học) cho
cả **backend (BE)** và **frontend (FE)**: thư mục nào chứa gì, tầng nào được gọi tầng nào, và khi thêm một chức
năng thì đặt code ở đâu.

Phạm vi đồ án: 46 use case, hai cấp quản lý (Sở GD&ĐT, trường), ba luồng nghiệp vụ chính (mua sắm, ghi tăng thiết
bị, kiểm kê). Quy tắc làm việc của nhóm (ai sửa gì, phạm vi, commit, verify) ở `AGENTS.md`.

---

## 1. Tổng quan

```
SEP490_G123_SFEMS/
├── backend/     Spring Boot – REST API, đăng nhập JWT, phân quyền, lưu dữ liệu (PostgreSQL)
└── frontend/    Refine + React – giao diện quản trị chạy trên trình duyệt
```

Hai dự án độc lập, mỗi bên tự build. Không sinh code client từ API: **hợp đồng API được giữ bằng tay ở cả hai
phía** (mục 4). Ngoại lệ duy nhất là bảng phân cổng (`npm run gen:portal`, mục 4.2).

```
Trình duyệt ──HTTP/JSON──▶ backend :8888 /api/<cổng>/... ──JDBC──▶ PostgreSQL (sfems)
     ▲                            │
     └──── WebSocket /ws (STOMP) ◀┘           MinIO (tệp đính kèm, cổng 9100)
```

| | Backend | Frontend |
|---|---|---|
| Nền | Java 25, Spring Boot 4.1.1, Gradle 9.7.1 | TypeScript, React 19, Vite 6 |
| Thư viện chính | Spring Web MVC, Data JPA, Security + OAuth2 Resource Server (JWT), Validation, WebSocket, Mail, Liquibase, springdoc | Refine 5, TanStack Query/Table, react-hook-form, Tailwind CSS 4, shadcn/ui, Recharts |
| Lưu trữ | PostgreSQL + Liquibase; MinIO cho tệp | – |
| Cổng dev | 8888 (`server.port`) | 5555 (hoặc cổng trống kế tiếp) |

### Chạy thử

```bash
# Backend (cần PostgreSQL, database "sfems" — tạo trống, app tự chạy changelog)
cd backend
./gradlew bootRun                 # Windows: .\gradlew.bat bootRun
./gradlew test                    # cần DB chạy được
docker compose up -d minio        # tuỳ chọn: MinIO local cho tệp đính kèm

# Frontend
cd frontend
npm install
npm run dev
npx tsc --noEmit                  # kiểm kiểu
npx eslint .                      # lint
npm run verify:arch               # luật phụ thuộc giữa các tầng (mục 3.2)
npm run verify:portal             # bảng cổng phía giao diện khớp máy chủ (mục 4.2)
```

- Cấu hình riêng từng máy để trong `backend/application-local.properties`, chép từ
  `application-local.properties.example` (đã ignore, nạp qua `spring.config.import`).
- Địa chỉ API của frontend lấy từ `VITE_API_URL`; không đặt thì `http://localhost:8888/api`
  (`src/shared/api/constants.ts`). Đổi `server.port` thì đổi cả chỗ này.
- Thư mục chứa dự án phải có tên không dấu (Gradle trên Windows không chạy trong đường dẫn có chữ tiếng Việt).

---

## 2. Backend

### 2.1 Cấu trúc package

Package gốc `com.g123.sfems`. Code chia theo **chức năng (feature-first)**; mọi entity JPA gom vào cây `domain/`
chia theo cùng nhóm.

```
com.g123.sfems
├── SfemsApplication.java
├── config/            SecurityConfig (chuỗi filter, JWT, chặn cổng), PortalConfig, WebMvcConfig (CORS),
│                      WebSocketConfig (STOMP /ws), OpenApiConfig, SchedulingConfig
├── shared/            hạ tầng dùng chung, không chứa nghiệp vụ
│   ├── web/           ListParams (_start/_end/_sort/_order/bộ lọc), portal/ (Portal, PortalRoutes,
│   │                  PortalHandlerMapping)
│   ├── exception/     ApiExceptionHandler — nơi DUY NHẤT quyết định dạng lỗi JSON
│   ├── security/      JwtService, CurrentUser, rowlevel/ (giao diện phạm vi dòng)
│   ├── data/          SecuredRepository, RLS của CSDL
│   ├── validation/    bộ quy tắc ô nhập chuẩn (@Text, @Num, @DateValue)
│   ├── messaging/     PostgresEventBus (LISTEN/NOTIFY giữa các node)
│   ├── storage/, mail/, office/ (Excel), cache/, scheduling/
├── domain/            MỌI @Entity
│   ├── base/          BaseEntity
│   ├── catalog/       danh mục dùng chung, danh mục thiết bị, chuẩn tối thiểu, quy tắc mã
│   ├── organization/  DepartmentOfEducation (Sở), School
│   ├── school/        phòng, thiết bị, phiếu (voucher), mua sắm, ghi tăng, kiểm kê, nhân sự và tổ chuyên
│   │                  môn (TC-03). Dữ liệu nền: lớp, khối nhà, cơ sở
│   ├── security/      User (+ SystemUser / SoUser / SchoolUser), Role, Permission, RowLevelPolicy
│   └── system/        Notification, Attachment, ApprovalFlow…
└── module/            mỗi chức năng một lát (slice)
    ├── catalog/<danh mục>/
    ├── organization/{school, departmentofeducation}/
    ├── school/{equipment, facility, intake, inventory, procurement, voucher, coderule, overview, …}/
    ├── security/{auth, user, role, permission, rowlevel, token}/
    ├── system/{notification, attachment, approvalflow, dataimport, dataexport, …}/
    └── report/        bảng điều khiển, báo cáo, xuất Excel
```

Một lát có đủ: controller (`@PreAuthorize`), request/response record, service (nghiệp vụ, giao dịch),
repository, specifications (bộ lọc danh sách), policies (phạm vi dòng). Lát lớn chia `api/` (+ `api/dto/`),
`service/`, `repo/`; lát nhỏ để phẳng.

**Luật giữa các lát:** gọi lát khác qua service, không qua repository; không dùng DTO của lát khác (cần tóm tắt
thì khai `XxxRef` riêng trong lát mình).

### 2.2 Tài khoản, vai, quyền

- **Ba loại tài khoản**, kế thừa JOINED theo cột `users.user_type`: `SystemUser` (`user_systems`, quản trị),
  `SoUser` (`user_sos`, cơ quan quản lý NOT NULL), `SchoolUser` (`user_schools`, trường NOT NULL). Bảng `users`
  chỉ giữ phần đăng nhập; mọi khoá ngoại "người lập / người duyệt" trỏ vào `users`. Loại cố định từ lúc tạo
  (`User.create`).
- **Vai** có `role_type` = loại tài khoản dùng vai; tài khoản chỉ mang vai cùng loại. Năm vai hệ thống: `ADMIN`,
  `SO_LEADER`, `SO_SPECIALIST`, `SCHOOL_LEADER`, `SCHOOL_STAFF`.
- **Quyền** dạng `<resource>:<động từ>` (read, write, delete, approve, export, configure). Token chỉ mang danh
  tính (sub, username, `userType`, phiên); quyền đọc từ CSDL mỗi request qua `AuthorityCache`, nên đổi vai có
  hiệu lực ngay. Header `X-Auth-Version` báo giao diện khi quyền đổi.

### 2.3 Bốn lớp bảo vệ dữ liệu

1. **Cổng theo loại tài khoản** (`SecurityConfig` + `PortalRoutes`): `/api/admin/**` chỉ `SYSTEM`,
   `/api/so/**` chỉ `SO`, `/api/school/**` chỉ `SCHOOL`. Sai loại = 403.
2. **Mã quyền** (`@PreAuthorize`).
3. **Phạm vi dòng** (`row_level_policy`, `SecuredRepository`, `rowLevel.scope(...)`): trường chỉ thấy dữ liệu
   trường mình, Sở thấy toàn ngành. Resource có phạm vi dòng mặc định `NONE` — quên chính sách là màn trống,
   không phải rò dữ liệu.
4. **RLS của PostgreSQL** cho các bảng của trường (lớp cuối, khi tài khoản ứng dụng không phải superuser).

Truy vấn gộp viết SQL thuần (báo cáo, bảng điều khiển) lọc qua `VisibleSchools`.

### 2.4 Phiếu có vòng duyệt

Đề xuất mua sắm, phiếu ghi tăng, biên bản kiểm kê dùng chung khung `school/voucher`: entity kế thừa
`SchoolVoucher`, service kế thừa `VoucherService`. Khung lo số phiếu, trình / duyệt từng cấp / trả lại / từ chối
/ huỷ / hoàn tất, nhật ký duyệt (`voucher_events`), các nút `_actions` cho màn hình. Luồng duyệt mặc định của
từng loại ở `ApprovalFlowType`, quản trị viên cấu hình lại được ở màn Luồng phê duyệt (HT-08).

### 2.5 CSDL và Liquibase

`ddl-auto=validate`: schema do Liquibase giữ, entity lệch bảng thì app không khởi động. Mỗi thay đổi là một file
`db/changelog/changes/NNN-<slug>.sql` khai cuối `db.changelog-master.yaml`; không sửa changeset đã chạy. Seed
nối theo khoá tự nhiên. Dải số mỗi người ở `AGENTS.md` mục 4. Changelog 252, 253 gỡ UBND và quyền của các chức năng
ngoài phạm vi. Changelog 285 xoá 39 bảng của các chức năng đó (cấp phát, điều chuyển, mượn – trả, mượn phòng, báo
hỏng, sửa chữa, bảo hành, bảo trì, thanh lý, hao mòn, kho vật tư, sửa chữa công trình, điều chỉnh chuẩn kiểu cũ,
minh chứng, kết nối ngoài) cùng danh mục học kỳ (`semesters`). CSDL còn 101 bảng: 99 bảng ứng dụng và 2 bảng của
Liquibase. Vài cột cũ ở bảng giữ lại vẫn còn vì entity còn ánh xạ (`rooms.loanable`, `open_days`, `open_sessions`,
`room_types.loanable`, cột hao mòn của `equipment_catalogs`, `school_year_closing_lines.pending_disposal`). Hàm
`rls_linked_school_ids()` nay trả mảng rỗng (không còn điều chuyển), nên chính sách đọc "linked" bằng "own".

---

## 3. Frontend

### 3.1 Cấu trúc thư mục

```
src/
├── app/        App.tsx, index.tsx; providers/ (auth, access-control, authorities-sync, i18n);
│               resources/ (index.tsx = mảng resources, modules.tsx = phân hệ có thanh tab, help.ts);
│               router/ (protected-routes.tsx = cây Route); locales/
├── features/   mỗi vùng màn hình một thư mục: identity, administration, catalogs, organization
│               (schools, explorer, resources = thiết bị, equipment-intakes, purchase-proposals,
│               procurement-plans, inventory-*, minimum-standard, vouchers…), dashboard, reports, notifications
├── domains/    TypeScript thuần, mỗi thực thể một `<tên>/types.ts`: kiểu payload, nhãn, lựa chọn;
│               portal/types.ts = bảng cổng sinh từ máy chủ
├── shared/     ui/ (shadcn gốc), components/ (views, buttons, data-table, form, layout, catalog, voucher,
│               charts, process…), hooks/, lib/, api/ (session, data + portalFetch, portal, live, constants)
└── styles/     index.css, theme.css
```

### 3.2 Luật phụ thuộc (`npm run verify:arch`)

| Tầng | Được import | Không được import |
|---|---|---|
| `app/` | mọi thứ | — |
| `features/X` | `shared/`, `domains/`, chính nó | `app/`, `features/Y` |
| `shared/` | `shared/`, `domains/` | `features/`, `app/` |
| `domains/` | `domains/` | mọi thứ khác (không React, Refine, UI) |

Mỗi feature chỉ lộ ra qua `index.ts` (màn hình tải lười bằng `lazyNamed`); `app/` import `@/features/<tên>`.

### 3.3 Menu, route, quyền

- **Resource** khai ở `app/resources/index.tsx`; phân hệ có thanh tab (Thiết bị, Mua sắm) khai ở
  `app/resources/modules.tsx`. Route ở `app/router/protected-routes.tsx`, mỗi nhánh bọc `CanAccess`.
- **Góc nhìn** theo loại tài khoản: trường thấy menu phân hệ; Sở thấy menu quản lý (`meta.mgmt`,
  `meta.mgmtParent`); quản trị thấy cả hai.
- **Ẩn theo quyền:** `access-control.ts` hỏi mã quyền (`permissionFor`), cổng của phiên (`portalAllows`) và cờ
  `_can` của từng dòng (phạm vi dòng). Giao diện chỉ ẩn; máy chủ luôn kiểm lại.

### 3.4 Gọi API

Mọi lời gọi đi qua data provider của Refine (`shared/api/data.ts`, simple-rest dialect): `useTable`, `useForm`,
`useOne`, `useList`, `useCustom`, `useCustomMutation`, hoặc `kyInstance` cho trường hợp đặc biệt. Data provider
gắn token, tự làm mới token khi 401, đọc `X-Auth-Version`, biến lỗi HTTP thành `HttpError` của Refine, và qua
`portalFetch` **chèn cổng** vào địa chỉ (`/api/equipment` → `/api/school/equipment`). Không gọi `fetch` trong
màn hình (ngoại lệ: đăng nhập / làm mới phiên ở `app/providers/auth.ts`).

---

## 4. Hợp đồng API

### 4.1 Dialect danh sách (simple-rest)

- `GET /api/<cổng>/<resource>?_start=0&_end=20&_sort=name&_order=asc&<field>=<v>&<field>_like=<v>&q=<tìm>` →
  mảng JSON trần + header `X-Total-Count`.
- `GET /<resource>/{id}`, `POST /<resource>`, `PATCH /<resource>/{id}`, `DELETE /<resource>/{id}` (trả body bản
  ghi vừa xoá). Endpoint con (`/{id}/submit`, `/{id}/approve`…) cho thao tác nghiệp vụ.
- Lỗi luôn là JSON `{ status, message, errors? }` do `ApiExceptionHandler` dựng: 404 không thấy (kể cả ngoài
  phạm vi dòng), 409 xung đột, 422 sai dữ liệu (`errors` theo tên ô), 403 thiếu quyền hoặc sai cổng.
- `X-Total-Count`, `X-Auth-Version` nằm trong `Access-Control-Expose-Headers`.

### 4.2 Cổng

Controller khai `/api/<x>`; `PortalHandlerMapping` đăng ký thêm `/api/admin|so|school/<x>` theo
`PortalRoutes.java` (cổng nào đọc = GET, cổng nào ghi = phương thức khác). Cổng Admin đọc mọi tài nguyên và ghi
những gì có cổng ghi được, trừ tài nguyên khai bằng `own(...)` (gắn với trường của người gọi). `/api/auth/**`
không qua cổng. Bản sao phía giao diện `frontend/src/domains/portal/types.ts` sinh bằng `npm run gen:portal`;
`verify:portal` báo khi lệch.

### 4.3 Xác thực

`POST /api/auth/login` → cặp access token (ngắn hạn) + refresh token (xoay vòng, thu hồi được);
`/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/permissions`. WebSocket `/ws` xác thực ở
khung STOMP CONNECT; thông báo đẩy qua `/user/queue/notifications`.
