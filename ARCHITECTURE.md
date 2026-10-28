# Kiến trúc và tổ chức code – SFEMS

Tài liệu này mô tả cách tổ chức mã nguồn của SFEMS (Hệ thống quản lý cơ sở vật chất và thiết bị trường học) cho cả **backend (BE)** và **frontend (FE)**: thư mục nào chứa gì, tầng nào được gọi tầng nào, và khi thêm một chức năng thì đặt code ở đâu.

Khung được lấy từ dự án qltb và thu gọn theo phạm vi đồ án: 3 luồng nghiệp vụ (mua sắm, nhập thiết bị – ghi tăng tài sản, kiểm kê), 42 use case. Mọi tên class, endpoint, mã quyền và phụ thuộc trong file này đối chiếu với code qltb (nhánh `dong_dev`, commit `3c263c8`).

---

## 1. Tổng quan

```
do-an/
├── backend/     Spring Boot – REST API, đăng nhập JWT, phân quyền, lưu dữ liệu (PostgreSQL)
└── frontend/    Refine + React – giao diện quản trị chạy trên trình duyệt
```

Hai dự án độc lập, mỗi bên tự build. Không có bước build chung, không sinh code client từ API: **hợp đồng API được giữ bằng tay ở cả hai phía** (mục 4).

```
Trình duyệt ──HTTP/JSON──▶ backend :8888 /api/... ──JDBC──▶ PostgreSQL (sfems)
     ▲                            │
     └──── WebSocket /ws (STOMP) ◀┘           MinIO (tệp đính kèm, cổng 9100)
```

| | Backend | Frontend |
|---|---|---|
| Ngôn ngữ / nền | Java 25, Spring Boot 4.1.1, Gradle 9.7.1 | TypeScript, React 19, Vite 6 |
| Thư viện chính | Spring Web MVC, Data JPA, Security + OAuth2 Resource Server (JWT), Validation, WebSocket, Mail, Actuator, springdoc | Refine 5 (core, react-router, react-table, react-hook-form), TanStack Query/Table, Tailwind CSS 4, shadcn/ui, i18next, Zod, Recharts |
| Lưu trữ | PostgreSQL + Liquibase; MinIO cho tệp | – |
| Cổng dev | 8888 | 5555 |

### Chạy thử

```bash
# Backend (cần PostgreSQL, database "sfems")
cd backend
./gradlew bootRun                 # Windows: .\gradlew.bat bootRun
docker compose up -d minio        # tuỳ chọn: MinIO local cho tệp đính kèm

# Frontend
cd frontend
npm install
npm run dev                       # http://localhost:5555
npx tsc --noEmit                  # kiểm kiểu
npx eslint .                      # lint
npm run verify:arch               # kiểm luật phụ thuộc giữa các tầng (mục 3.2)
```

- Cấu hình riêng từng máy (khoá MinIO, mật khẩu…) để trong `backend/application-local.properties`, chép từ `application-local.properties.example`. File này đã nằm trong `.gitignore`.
- Địa chỉ API của frontend lấy từ `VITE_API_URL`. Không đặt thì dùng `http://localhost:8888/api` (`src/shared/api/constants.ts`).
- **Thư mục chứa dự án phải có tên không dấu.** Gradle trên Windows không chạy được trong đường dẫn có chữ tiếng Việt (ví dụ `đồ án`).

---

## 2. Backend

### 2.1 Cấu trúc package

Package gốc `com.g123.sfems`. Code chia theo **chức năng (feature-first)**; riêng các entity JPA được gom vào một cây `domain/` chung, cũng chia theo cùng nhóm.

```
com.g123.sfems
├── SfemsApplication.java      điểm khởi động; Spring quét mọi package từ đây xuống
├── config/                    SecurityConfig (chuỗi filter, JWT), WebMvcConfig (CORS, header),
│                              WebSocketConfig (STOMP /ws), OpenApiConfig, SchedulingConfig
├── shared/                    hạ tầng dùng chung, không chứa nghiệp vụ
│   ├── web/                   ListParams (đọc _start/_end/_sort/_order/bộ lọc), ListResponse
│   ├── exception/             ApiExceptionHandler – nơi DUY NHẤT quyết định dạng lỗi JSON
│   ├── data/                  SecuredRepository – repository có áp phạm vi dữ liệu
│   ├── security/              JwtService, CurrentUser, Permissions, RestAuthenticationEntryPoint…
│   │   └── rowlevel/          giao diện cho phạm vi dữ liệu theo dòng (feature cài đặt / khai báo)
│   ├── messaging/             PostgresEventBus – LISTEN/NOTIFY giữa các node
│   ├── storage/               ObjectStorage – đọc/ghi tệp trên MinIO
│   ├── mail/                  MailService
│   └── office/                (trống) đọc/ghi Excel cho nhập – xuất dữ liệu
├── domain/                    MỌI @Entity nằm ở đây
│   ├── base/                  BaseEntity – id, thông tin tạo/sửa
│   ├── catalog/               danh mục dùng chung: cấp học, khối lớp, năm học, môn học, đơn vị tính,
│   │                          địa bàn, loại phòng, nguồn hình thành, phương thức hình thành,
│   │                          loại thiết bị, danh mục thiết bị, danh mục tối thiểu, quy tắc mã
│   ├── organization/          DepartmentOfEducation (Sở), School (trường)
│   ├── school/                dữ liệu của trường: phòng, thiết bị, bộ đếm mã, chứng từ,
│   │                          mua sắm, nhập thiết bị, kiểm kê
│   ├── security/              User, Role, Permission, RowLevelPolicy, RefreshToken
│   └── system/                Notification, Attachment, DataChange, Activity, ApprovalFlow
└── module/                    mỗi chức năng một "lát" (slice)
    ├── catalog/<danh mục>/
    ├── organization/{school, departmentofeducation}/
    ├── school/<chức năng>/
    ├── report/
    ├── security/{auth, user, role, permission, token, rowlevel}/
    └── system/{notification, attachment, datachange, dataimport, dataexport, activity, approvalflow}/
```

Một lát có đủ các vai trò: Controller (nhận HTTP, `@PreAuthorize`), Request/Response (DTO), Service (nghiệp vụ, `@Transactional`), Repository + Specifications (truy vấn, bộ lọc), Policies (phạm vi dữ liệu). qltb đặt chúng theo **hai kiểu**:

| Kiểu | Cách đặt | Module đang dùng |
|---|---|---|
| Chia thư mục | `api/` (+ `api/dto/`), `service/`, `repo/` | `security/*`, `organization/*`, `system/notification`, `catalog/educationlevel` |
| Gói phẳng | mọi file của chức năng trong một package | đa số module nghiệp vụ: `school/*`, `catalog/*`, `report`, phần còn lại của `system/*` |

Ví dụ gói phẳng (qltb `module/school/intake/`):

```
module/school/intake/
├── EquipmentIntakeController.java      /api/equipment_intakes, @PreAuthorize từng endpoint
├── EquipmentIntakeRequest.java, EquipmentIntakePatchRequest.java, EquipmentIntakeResponse.java
├── EquipmentIntakeService.java         nghiệp vụ; trình/duyệt qua VoucherWorkflow
├── EquipmentIntakeRepository.java, EquipmentIntakeSpecifications.java
└── EquipmentIntakePolicies.java        trường dùng cho phạm vi dữ liệu, DefaultScope.NONE
```

Lớp nền dùng chung (kế thừa, không viết lại): `catalog/base` (`CatalogRepository`), `school/base` (`SchoolOwnedRepository`, `SchoolOwnedService`), `school/voucher` (`SchoolVoucher`, `VoucherWorkflow`, `DocumentNumberService`); luồng duyệt theo cấp ở `system/approvalflow`.

### 2.2 Luật giữa các lát

1. **Gọi lát khác qua Service, không qua Repository của nó** (trừ kế thừa repository nền). Ví dụ `UserService` lấy trường qua `SchoolService.get(id)`. Như vậy id không tồn tại sẽ ra cùng lỗi 404 như ở endpoint của chính lát đó.
2. **Không dùng Request/Response (DTO) của lát khác.** Mỗi lát tự khai bản tóm tắt nó cần (ví dụ `SchoolRef` trong lát user), kể cả khi hình dạng giống hệt. Như vậy mở rộng payload của endpoint này không vô tình làm phình payload của endpoint kia.
3. **Entity dùng chung nằm ở `domain/`**, vì quan hệ giữa chúng (User – Role, School – Sở) không thuộc riêng lát nào. Mọi thứ khác nằm trong lát.
4. **Ràng buộc chéo bảng giao cho database** (khoá ngoại `RESTRICT`, `CHECK`, khoá ngoại ghép), không đếm bằng code ở lát khác. `ApiExceptionHandler` đổi lỗi ràng buộc thành 409.
5. **Hai service cần nhau thì tách phần chung thành lát riêng hoặc dùng sự kiện**, vì Spring không dựng được vòng phụ thuộc. Đó là lý do `token/` là lát riêng: cả `AuthService` lẫn `UserService` cùng dùng.

### 2.3 Đăng nhập và phân quyền

- **Hai loại token.**
  - Access token: JWT HS256, sống 15 phút. Chỉ mang *ai* (`sub`, username), không mang quyền.
  - Refresh token: chuỗi ngẫu nhiên, sống 7 ngày. Bảng `refresh_tokens` chỉ lưu bản băm SHA-256. Token đổi mới sau mỗi lần dùng.
- **Endpoint mở:** `POST /api/auth/login`, `/refresh`, `/logout`. Mọi endpoint khác cần token Bearer.
- **Mã quyền là `{resource}:{động từ}`**, sáu động từ: `read`, `write` (tạo, sửa, trình, huỷ), `delete`, `approve` (duyệt, trả lại, từ chối), `export`, `configure`. Phần resource trùng y tên resource ở frontend, ví dụ `equipment_intakes:approve`. Mỗi endpoint kiểm bằng `@PreAuthorize`.
- **Quyền của người dùng** đọc từ `AuthorityCache` (bộ nhớ, không truy vấn DB mỗi request). Cache bị xoá khi vai hoặc tài khoản đổi, qua sự kiện `AuthoritiesChanged`; giữa nhiều node thì qua `AuthorityChangeChannel` (Postgres NOTIFY).
- **Báo thay đổi quyền cho frontend.** Mỗi response mang header `X-Auth-Version`. Thấy giá trị đổi, frontend đọc lại quyền.
- **Phạm vi dữ liệu theo dòng (row-level).** Quyền chức năng trả lời "có được gọi endpoint này không", còn phạm vi dòng trả lời "được thấy những dòng nào". Chính sách phạm vi gắn với vai trò; mỗi resource khai trường dùng để lọc trong `*Policies` (phiếu nhập: `school`, `status`, `intakeDate`…) và mức mặc định (`DefaultScope.NONE` = vai trò chưa khai phạm vi thì không thấy dòng nào). Phạm vi được gộp vào truy vấn; dòng ngoài phạm vi coi như không tồn tại (404).
- **Khoá ký JWT** `app.security.jwt.secret` phải dài ít nhất 32 byte. Mỗi môi trường thật đặt lại bằng biến `APP_SECURITY_JWT_SECRET`.

### 2.4 Cơ sở dữ liệu

- **Liquibase giữ schema.** `spring.jpa.hibernate.ddl-auto=validate`: Hibernate chỉ kiểm entity có khớp bảng không, sai thì báo lỗi lúc khởi động.
- **Thêm migration:** tạo file trong `src/main/resources/db/changelog/changes/`, rồi khai vào `db.changelog-master.yaml`.
- **Dữ liệu mẫu nối theo khoá tự nhiên** (mã, username), không ghi cứng id.
- **Trạng thái hiện tại: thư mục changelog còn trống.** Nhóm cần viết changelog tạo các bảng mà các entity đang có, gồm user/role/permission, refresh token, phạm vi dữ liệu, trường, Sở, cấp học, địa bàn, quy tắc mã và nhật ký. Thêm dữ liệu mẫu: tài khoản admin, mã quyền, vai. Chưa có changelog thì ứng dụng không khởi động được.

---

## 3. Frontend

### 3.1 Bốn tầng trong `src/`

```
src/
├── app/          lắp ráp ứng dụng
│   ├── App.tsx, index.tsx        <Refine> + các provider
│   ├── providers/                auth (đăng nhập), access-control (quyền), authorities-sync,
│   │                             i18n, document-title
│   ├── resources/index.tsx       mảng resources khai cho Refine (đang trống)
│   ├── router/routes.tsx         cây <Route> (đang có: /login và trang chủ trống)
│   └── locales/vi.json           chuỗi giao diện tiếng Việt
├── features/     mỗi vùng màn hình một thư mục, chỉ lộ ra qua index.ts
│   ├── identity/                 login (có code), profile
│   ├── administration/           users, roles
│   ├── catalogs/                 các màn danh mục
│   ├── organization/             schools, resources (phòng, thiết bị), minimum-standard,
│   │                             purchase-proposals, procurement-plans, equipment-intakes,
│   │                             vouchers, inventory-campaigns, inventory-sessions
│   ├── dashboard/, reports/, notifications/
├── domains/      TypeScript thuần: kiểu payload, nhãn, danh sách lựa chọn của từng thực thể
│                 (user, role, permission, enum-catalog có code; còn lại trống)
├── shared/       dùng chung, không biết feature nào tồn tại
│   ├── ui/                       shadcn/ui gốc – sinh lại qua components.json, hạn chế sửa tay
│   ├── components/               lớp đã gắn Refine: layout (khung, sidebar, header), data-table,
│   │                             form, views, buttons, confirm, notification, theme, tabs, charts
│   ├── hooks/                    hook dùng chung
│   ├── lib/                      format ngày, permissions, status-variants, theme, utils
│   └── api/                      data provider, session (token), live (WebSocket), API_URL
└── styles/       index.css, theme.css – hệ màu và token giao diện
```

### 3.2 Luật import giữa các tầng

| Tầng | Được import | Không được import |
|---|---|---|
| `app/` | mọi tầng | – |
| `features/X` | `shared/`, `domains/`, chính nó | `app/`, `features/Y` |
| `shared/` | `shared/`, `domains/` | `features/`, `app/` |
| `domains/` | `domains/` | mọi tầng khác (không React, không Refine, không UI) |

Kiểm bằng `npm run verify:arch` (`scripts/verify-architecture.mjs`). Chạy lệnh này cùng `tsc` và `eslint` trước khi commit.

Quy ước kèm theo:

- **`app/` chỉ import feature qua `@/features/<tên>`**, không đi vào file bên trong. Index của feature không xuất lại kiểu dữ liệu; kiểu import thẳng từ `domains/`.
- **`domains/` nói một trạng thái *là gì*** (nhãn, kiểu). Màu badge của trạng thái đặt ở `shared/lib/status-variants.ts`.
- **Hai feature cần dùng chung thứ gì thì đưa thứ đó xuống `shared/`** (giao diện) hoặc `domains/` (kiểu).

### 3.3 Resource và route: hai nửa của một khai báo

Refine suy ra "đang ở resource nào" từ URL. Nhờ vậy `useTable`, `useForm` và các nút Sửa/Xoá tự biết mình làm việc với resource nào. Vì thế:

- **Thêm một màn = sửa cả hai file:** `app/resources/index.tsx` (đường dẫn list/create/edit/show) và `app/router/routes.tsx` (các `<Route>` tương ứng). Lệch nhau thì nút và breadcrumb dẫn tới chỗ không có gì.
- **Tên resource cũng là đoạn đường dẫn API và là phần đầu của mã quyền.** Ví dụ `equipment_intakes` ứng với `GET /api/equipment_intakes` và quyền `equipment_intakes:read`.
- **Menu bên trái** (`shared/components/layout/sidebar.tsx`) dựng từ mảng resources và tự ẩn mục mà tài khoản không có quyền xem.

### 3.4 Dữ liệu, đăng nhập, quyền

- **Đọc/ghi dữ liệu:** `shared/api/data.ts` là data provider REST, nói đúng "phương ngữ" ở mục 4. Không page nào gọi `fetch` trực tiếp tới các resource.
- **Phiên đăng nhập:** chỉ `shared/api/session.ts` giữ token, thông tin người dùng và danh sách quyền đã cache. Không page nào tự cầm token.
- **Ba provider đọc chung phiên đó:**
  - `providers/auth.ts`: đăng nhập, làm mới token, đăng xuất, lấy danh tính.
  - `shared/api/data.ts`: gắn token vào mọi request.
  - `providers/access-control.ts`: trả lời `can(resource, action)` từ mã quyền (bảng đổi ở `shared/lib/permissions.ts`): `list`/`show` → `read`, `create`/`edit`/`clone` → `write`, `delete` → `delete`, `approve` → `approve`.
- **Phân quyền ở giao diện chỉ để ẩn, không để bảo vệ.** API luôn kiểm lại quyền.
- **Cây route có hai nửa.** Mọi thứ dưới `<Authenticated>` cần đăng nhập và vẽ trong `Layout`; `/login` nằm ngoài.

### 3.5 Giao diện

- **Phân lớp component:** `shared/ui/` là shadcn gốc; `shared/components/` là lớp gắn Refine dựng trên đó. Hành vi riêng của dự án đặt ở `shared/components/`, không sửa vào `shared/ui/`.
- **Màn danh sách** gồm `ListViewHeader` (breadcrumb, tiêu đề, nút) và `DataTable` (thanh công cụ, các dòng, phân trang). Màn tạo, sửa, xem dùng `CreateView` / `EditView` / `ShowView`.
- **Header không tự hiện.** `*View` không tự vẽ header, mỗi page phải tự render `*ViewHeader` tương ứng; quên thì màn không có breadcrumb và không có nút quay lại.
- **Màu sắc:** component không tự giữ màu. Mọi màu đi qua token trong `styles/theme.css` → `styles/index.css` → class Tailwind như `bg-primary`, `text-success`. Đổi chủ đề sáng/tối, bộ màu, bo góc, mật độ qua `useTheme()`.
- **Ngày tháng** luôn định dạng qua `shared/lib/format.ts`.

---

## 4. Hợp đồng API giữa FE và BE

Không có code sinh tự động. Bảng dưới là hợp đồng, sửa thì sửa cả hai phía.

| Thao tác (Refine) | Request | Ghi chú |
|---|---|---|
| getList | `GET /api/{resource}?_start=&_end=&_sort=&_order=&{trường}{toán tử}=` | body là **mảng JSON trần**; tổng số dòng ở header `X-Total-Count` |
| getMany | `GET /api/{resource}?ids[0]=&ids[1]=` | |
| getOne | `GET /api/{resource}/{id}` | |
| create | `POST /api/{resource}` | |
| update | `PATCH /api/{resource}/{id}` | |
| deleteOne | `DELETE /api/{resource}/{id}` | **phải trả body** |

- **Toán tử lọc** là hậu tố gắn sau tên trường: `_ne`, `_gte`, `_lte`, `_like`; không có hậu tố nghĩa là bằng. `q` là ô tìm nhanh. `ListParams` đọc các tham số này; `*Specifications` của từng lát biến chúng thành điều kiện truy vấn.
- **Thao tác không phải sửa trường** là endpoint con: `POST /{id}/submit`, `/cancel` (quyền `write`); `/approve`, `/return`, `/reject` (quyền `approve`). Lần duyệt cuối của phiếu nhập chính là lúc ghi tăng, cùng giao dịch.
- **Ba cái tên của một resource:** tên resource và đường API dùng gạch dưới (`equipment_intakes`, `/api/equipment_intakes`), đường dẫn màn hình dùng gạch ngang (`/equipment-intakes`).
- **Ba điều hỏng âm thầm nếu đổi:**
  - Tên resource phải trùng nhau ở FE và BE, kể cả dấu gạch dưới.
  - `X-Total-Count` và `X-Auth-Version` phải nằm trong `Access-Control-Expose-Headers` (`WebMvcConfig`).
  - Mọi lỗi phải trả body JSON (`ApiExceptionHandler`).
- **`/api/auth/*` không theo bảng trên**, mà là hợp đồng riêng của auth provider (login, refresh, logout, me, permissions, change-password).
- **Tài liệu API** tự sinh ở `/swagger-ui.html`.

---

## 5. Use case nằm ở đâu

| Nhóm UC | Backend (`domain/` + `module/`) | Frontend (`features/`) |
|---|---|---|
| HT-01 – HT-03 Đăng nhập, đăng xuất, đổi mật khẩu | `security/auth`, `security/token` | `identity/login`, `identity/profile` |
| HT-04 Tài khoản người dùng | `security/user` | `administration/users` |
| HT-05 Vai trò và quyền | `security/role`, `security/permission` | `administration/roles` |
| HT-06 Thông báo | `system/notification` | `notifications` |
| DM-01 Danh mục dùng chung | `catalog/{educationlevel, grade, schoolyear, subject, unit, ward, roomtype, originsource, acquisitionmethod, equipmenttype, enumcatalog}` | `catalogs` |
| DM-02 Danh mục thiết bị | `catalog/equipmentcatalog` | `catalogs` |
| DM-03 Danh mục tối thiểu và định mức | `catalog/standard`, `catalog/norm` | `organization/minimum-standard` |
| DM-04 Quy tắc sinh mã | `catalog/coderule` | `catalogs` |
| TC-01 Trường học | `organization/school`, `organization/departmentofeducation` | `organization/schools` |
| TC-02 Phòng | `school/facility` | `organization/resources` |
| TS-01 – TS-04 Hồ sơ thiết bị, tra cứu, đính kèm, lịch sử | `school/equipment`, `system/attachment` + `shared/storage` | `organization/resources` |
| TS-05, TS-06 Cấp mã, sinh mã tài sản | `school/coderule` | `organization/resources` |
| TS-07 Nhập dữ liệu ban đầu từ tệp | `system/dataimport` + `shared/office` | `organization/resources` |
| NC-01 – NC-07 Nhu cầu và kế hoạch mua sắm | `school/procurement`, `school/voucher` | `organization/purchase-proposals`, `organization/procurement-plans` |
| PN-01 – PN-03 Nhập thiết bị, ghi tăng tài sản | `school/intake`, `school/voucher` | `organization/equipment-intakes`, `organization/vouchers` |
| KK-01 – KK-07 Kiểm kê | `school/inventory` | `organization/inventory-campaigns`, `organization/inventory-sessions` |
| BC-01 Bảng điều khiển | `report` | `dashboard` |
| BC-02 – BC-05 Bốn báo cáo | `report` | `reports` |
| BC-06 Xuất dữ liệu | `system/dataexport` + `shared/office` | `reports` (và nút Xuất trên mọi danh sách) |

`school/voucher` là phần chung của mọi chứng từ: số phiếu, vòng duyệt, lịch sử duyệt. Trạng thái (`VoucherStatus`): `DRAFT`, `PENDING`, `APPROVED`, `COMPLETED`, `REJECTED`, `CANCELLED`; trả lại = về `DRAFT` kèm lời nhắn. Đề xuất mua sắm, phiếu nhập và biên bản kiểm kê dùng lại phần này thay vì mỗi loại tự viết.

---

## 6. Thêm một chức năng mới: các bước

Ví dụ: phiếu nhập thiết bị (`equipment_intakes`).

**Backend**
1. Entity `EquipmentIntake` trong `domain/school/intake/`, kế thừa `SchoolVoucher` (dữ liệu không phải phiếu thì `BaseEntity`).
2. Changelog Liquibase: tạo bảng và seed mã quyền `equipment_intakes:read|write|approve|delete`, cấp cho vai phù hợp.
3. Gói phẳng `module/school/intake/`: Controller, Request/Response, Service, Repository, Specifications, Policies.
4. Trình/duyệt/trả lại/từ chối/huỷ đi qua `VoucherWorkflow`. Mỗi endpoint đặt `@PreAuthorize` với đúng mã quyền; đường dẫn `/api/equipment_intakes`.

**Frontend**
1. Kiểu dữ liệu trong `domains/equipment-intake/types.ts`.
2. Màn hình trong `features/organization/equipment-intakes/`, gồm list/create/edit/show, có `*ViewHeader`; xuất ra qua `index.ts`.
3. Khai resource `equipment_intakes` trong `app/resources/index.tsx` **và** route trong `app/router/routes.tsx`.
4. Chuỗi giao diện trong `app/locales/vi.json`.
5. Chạy `npx tsc --noEmit`, `npx eslint .`, `npm run verify:arch`.

---

## 7. Hiện trạng khung

| Phần | Trạng thái |
|---|---|
| Cấu hình build FE và BE | Có. FE: typecheck, lint, kiểm kiến trúc đều sạch. BE: biên dịch được. |
| UI cơ sở FE (`shared/`, `styles/`) | Có code |
| Đăng nhập, phân quyền FE (providers, màn login, kiểu user/role/permission) | Có code |
| Đăng nhập, phân quyền BE (`security/*`, `shared/security`) | Có code |
| Code BE kéo theo phần đăng nhập | Có code, đọc lại cho đúng phạm vi đồ án: trường, Sở, cấp học, địa bàn, quy tắc mã, nhật ký hoạt động, mail, lưu tệp |
| Các package nghiệp vụ còn lại (gồm `system/approvalflow` mà `school/voucher` cần) | Thư mục rỗng (có `.gitkeep`) |
| Liquibase changelog | Chưa có, xem mục 2.4 |
| Deploy, CI | Chưa có |

Phạm vi đồ án không có chức năng gắn thiết bị vật lý: không in hay quét mã QR, không in ấn. Biên bản và báo cáo chỉ xuất ra tệp (Excel/PDF).
