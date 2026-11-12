# Đánh giá tiến độ nhóm — 13/11/2026

Đánh giá lại trên `dong_dev` tại `c988c8c`, sau khi gộp cả bốn nhánh (Hoang_dev 13/11 00:08, Tu_dev 12/11 00:20,
nghia_dev 12/11 17:59, quang_dev 12/11 16:29). Đối chiếu với `AGENTS.md` và SRS. Chỉ đọc code, không sửa phần của ai
(trừ một chỗ ghi ở mục QuangTD). Bản trước: `danh-gia-tien-do-2026-11-10.md`.

| Người | So với 10/11 | Đang chặn người khác |
|---|---|---|
| HoangPND (TC, NC) | Có API phòng và NC-01; màn Phòng, màn xem trường, đề xuất, kế hoạch, NC-07 vẫn chưa có | **Có**: màn Ghi tăng vẫn chưa lập phiếu từ đề xuất được |
| TuTN (DM, KK) | Kiểm kê chạy được tới duyệt; KK-06 duyệt chưa cập nhật sổ | Có: khoá số liệu chặn phiếu nhập kể cả khi phiếu kiểm kê còn nháp |
| QuangTD (HT-06, BC) | Sửa gần hết lỗi cũ; đã có Thông báo | Không |
| NghiaNV (TS) | TS-04, TS-05, TS-06 đủ; đã có TS-07 | Không |

**Vấn đề chung:** nhiều bạn sửa file ngoài vùng của mình mà không hỏi trước: `VoucherWorkflow.java` (Tú, Quang),
`EquipmentIntakeService.java` (Tú), `SchoolYearService`/`CatalogService` (Quang), `shared/components/*` (Tú). Nhiều
màn vẫn gọi `kyInstance` trực tiếp thay vì qua hook Refine. Nhánh `quang_dev` không build được (lỗi `tsc`), tức là
có bạn commit mà không chạy `npm run verify`.

---

## HoangPND — TC-01..02, NC-01..07

| UC | Backend | Frontend | Đánh giá |
|---|---|---|---|
| TC-01 Trường | Đủ CRUD, mã hai ký tự đã kiểm trùng | Danh sách, thêm, sửa có; **Xem** vẫn là màn chờ (`routes.tsx:156-160`) | Một phần |
| TC-02 Phòng | `/api/rooms` CRUD, cấp mã theo quy tắc, chặn xoá phòng còn thiết bị | `/rooms` vẫn là màn chờ (`routes.tsx:161`); `room-picker.tsx` chưa nơi nào dùng | Một phần (mới có backend) |
| NC-01 Mức đáp ứng | Có API nhưng **tính sai** (dưới) | `/equipment-adequacy` vẫn là màn chờ | Một phần |
| NC-02..04 Đề xuất | Chỉ có repository | Màn chờ | Thiếu |
| NC-05..06 Kế hoạch | Chỉ có repository | Màn chờ | Thiếu |
| NC-07 Lập phiếu nhập từ đề xuất | Không có | Không có | Thiếu |

Cả bốn endpoint màn Ghi tăng cần (`GET /purchase_proposals`, `GET /procurement_plans`,
`GET /purchase_proposals/{id}/intake-lines`, `POST /purchase_proposals/{id}/intake`) **vẫn chưa có**.

**Lỗi cũ:** đã sửa link 404, kiểm trùng mã hai ký tự, rollback changelog 050. **Còn:** gỡ cơ quan quản lý bằng
`{id:null}` trả 404 (`SchoolService.java:191`); cấp mã hai ký tự không khoá (nay có chỉ mục duy nhất chặn trùng, nhưng
người sau nhận lỗi ràng buộc); controller logo gọi thẳng `JdbcTemplate`; `routes.tsx` import thẳng file; code không ai
dùng (nhiều hơn trước).

**Lỗi mới**
- **Cao — sửa được quy tắc mã phòng của trường khác.** `RoomCodeRuleController.schoolOf` dùng thẳng `school.id` client
  gửi lên; `RoomCodeService.save/reset` chỉ gọi `schools.get` mà bảng `schools` không có chính sách phạm vi dòng. Cán
  bộ trường A gọi `PUT /api/school_code_rules/rooms?school.id=<B>` là đổi quy tắc của trường B.
- **Xoá trắng mã hai ký tự khi sửa trường:** để trống ô "Mã 2 ký tự" thì lưu `short_code = NULL`
  (`SchoolService.java:210-215`), trường mất phần TR, không cấp được mã tài sản.
- **NC-01 tính sai** (`AdequacyService.java:133-154`): định mức theo từng thiết bị nhưng SQL cộng theo *loại* thiết bị
  (máy chiếu được tính cho định mức màn chiếu); bỏ qua `basis_size` ("1 máy/2 HS" thành 1 máy/HS); định mức theo phòng
  bị coi như theo trường; định mức lẻ bị cắt phần thập phân. Chưa có cột "thừa" như SRS. Số liệu có thể lệch với BC-03
  của Quang.
- Gọi sang lát khác không qua Service: `RoomCodeService` dùng `SchoolCodeRuleRepository` (vùng NghiaNV);
  `RoomService.beforeDelete` và `AdequacyService` chạy SQL thô vào bảng của người khác.
- Tự seed mã quyền `departments_of_education:*` (changelog 052) chưa qua DongLV.
- `features/organization/resources/school-field.tsx` là bản sao của `shared/components/form/school-field.tsx` (thiếu phần
  giới hạn theo trường của tài khoản), không ai dùng — xoá, dùng bản trong `shared/`.
- Code chưa dùng: `CallerSchoolLevel`, `FacilityStructure`, `ConfirmState`, `OpeningHours`, `domains/facility/*`,
  `compact-section`, `form-groups`, `table-empty`, `school-dialog`, `school-info`, `school-code.ts`.

**Commit:** loại `perf` không có trong danh sách; 6 commit nhắc tới repo nguồn/bản gốc (`a7e20dc fb350f4 fd90e2f bf8486b
de5a23b b0178b6`) và trong code còn khoảng 13 chỗ tương tự — bỏ đi; nhiều commit `feat` cho code chưa dùng; `de5a23b`
ghi DM-04 (UC của TuTN).

**Cần làm tiếp:** đề xuất mua sắm (kế thừa `VoucherService`) → kế hoạch → NC-07; song song sửa lỗi quy tắc mã phòng,
mã hai ký tự, NC-01; làm màn Phòng và màn xem trường như đã chốt (không chép explorer).

---

## TuTN — DM-01..04, KK-01..07

| UC | Đánh giá | Ghi chú |
|---|---|---|
| DM-01..03 | Đủ | DM-03 đã đính kèm văn bản căn cứ, nhưng bộ đang áp dụng vẫn thêm/xoá tệp được |
| DM-04 | Đủ | Quy tắc mã phòng do HoangPND làm |
| KK-01 | Đủ | Sửa đợt vẫn chưa kiểm MSG40 |
| KK-02 | Đủ | Tiến độ từng trường; Sở chỉ xem biên bản đã duyệt |
| KK-03 | Đủ | |
| KK-04 | Đủ | Kiểm đếm theo trang, lọc phòng, tài sản thừa, quét mã |
| KK-05 | Đủ | `validateSubmit` có MSG45 (`InventorySessionService.java:166-177`) |
| KK-06 | **Một phần** | `onApproved` chỉ ghi lịch sử và đổi sang Hỏng; sai phòng không cập nhật phòng, không thấy không chuyển Báo mất; phiếu nhập tài sản thừa phải bấm "lập nhanh" sau khi duyệt, không tự lập |
| KK-07 | Một phần | Có bản in và dạng Văn bản; chưa đính kèm lại bản đã ký |

**Lỗi cũ:** lỗi cao "trình khi chưa kiểm" **đã sửa**; phần duyệt cập nhật sổ **còn** (KK-06). **Còn:** danh sách phiếu
mỗi dòng một truy vấn (`InventorySessionController.java:89`); MSG40 khi sửa đợt (`InventoryCampaignService.update`);
mã `THPT-NORM-<id>` (`EquipmentStandardService.java:110`); resource, mã quyền 032/033/041, changelog 040,
`domains/permission/types.ts` chưa hoàn lại; SQL thẳng vào `schools`, `departments_of_education`
(`InventoryCampaignService.java:141,228,260`) và nay thêm `equipment_intakes` (`InventorySessionService.java:336`).
**Đã sửa:** thông báo đi qua `NotificationService`; định dạng commit.

**Lỗi mới**
- **Sửa vùng DongLV không hỏi trước:** `VoucherWorkflow.java:89,117` (chèn khoá vào `submit`/`approve` của mọi loại
  phiếu), `EquipmentIntakeService.onSurplus`, `InventoryFreeze.java`, `InventoryFindings.java`, các màn
  `equipment-intakes/*`, `domains/voucher/types.ts`, changelog 044 sửa `row_level_policy`; file dùng chung
  `shared/components/{print/print-sheet, data-table/icon-filter, segmented, voucher/inventory-freeze-notice}`.
- **Khoá số liệu chặn cả khi phiếu kiểm kê còn nháp:** một phiếu kiểm kê nháp bị bỏ quên sẽ chặn trình/duyệt mọi phiếu
  nhập của trường vô thời hạn (`InventoryFreeze.java`). SRS không có luật khoá này.
- "Lập nhanh" bấm hai lần tạo hai phiếu nhập nháp (`InventorySessionService.java:320` kiểm mà không khoá).
- `onSurplus` để nguồn hình thành `null` nếu thiếu danh mục `KIEM_KE_THUA`, không báo lỗi.
- Thêm thư viện `jsqr` chưa hỏi nhóm; `counting-panel.tsx:241`, `follow-ups.tsx:34,79` gọi `kyInstance` trực tiếp.

**Cần làm tiếp:** viết lại `onApproved` theo KK-06 (cập nhật phòng, Báo mất, tự lập phiếu nhập nháp trong cùng giao
dịch); MSG40 khi sửa đợt; truy vấn danh sách phiếu; mã `THPT-NORM`. DongLV chốt giữ hay gỡ `InventoryFreeze`,
`onSurplus`, changelog 044.

---

## QuangTD — HT-06, BC-01..06

| UC | Đánh giá | Ghi chú |
|---|---|---|
| HT-06 Thông báo | Một phần | Có `/unread-count`, `/recent`, đọc, đọc hết, xoá, đẩy STOMP. Thông báo phiếu có thể không được lưu, link sai, thiếu báo "đã duyệt" |
| BC-01 | Đủ | Đã gộp truy vấn, dùng chung phép tính với BC-03 |
| BC-02 | Đủ | |
| BC-03 | Đủ | Đã có chi tiết theo môn, khối |
| BC-04, BC-05 | Đủ | |
| BC-06 | Đủ | Server tự truy vấn lại, có XLSX và CSV |

**Lỗi cũ — đã sửa:** 4 truy vấn mỗi trường; tỷ lệ đáp ứng tính hai cách; cắt 1000 dòng; ngày sai trả 500; Excel dựng
từ dữ liệu frontend; `window.alert`; SQL ghép id; `DashboardService` dùng repository lát khác. **Còn:** đầu bản in BC-04
vẫn ghi "Sở" khi trường in (`purchase.tsx:75`), cấp cơ quan quản lý in ra chữ "Cơ quan quản lý của bạn"; `@page reports`
trong `styles/index.css`.

**Lỗi mới**
- **Build hỏng trên `quang_dev`:** ba màn báo cáo truyền `issuingUnit` vào `ReportPrintSheet` mà component chưa nhận.
  DongLV đã vá ở `c988c8c` (thêm prop `issuingUnit` tuỳ chọn) — Quang kéo `dong_dev` về trước khi làm tiếp.
- **Thông báo phiếu có thể không được lưu:** `VoucherNotificationListener` chạy `@TransactionalEventListener(AFTER_COMMIT)`
  rồi gọi `NotificationService.notify` (`@Transactional` mặc định). Ở pha này giao dịch đã commit, lệnh ghi không được
  commit. Dùng `@EventListener` (như javadoc `VoucherDecided` dặn) hoặc `REQUIRES_NEW`. Cần thử: trình một phiếu rồi
  đếm bảng `notifications`.
- **Link trong thông báo sai:** `"/" + resource + "/show/"` ra `/equipment_intakes/show/5`, route thật là
  `/equipment-intakes` (`VoucherNotificationListener.java:57,71`).
- Thiếu thông báo khi phiếu được duyệt xong (SRS có).
- Xuất tài sản tìm không dấu không khớp màn hình (`assets.tsx:48` bỏ dấu, server `ILIKE` chuỗi gốc).
- Sửa ngoài vùng: `VoucherWorkflow.java`, thêm `VoucherAwaitingApproval.java` (DongLV); `CampaignLaunchNotifier`,
  `CatalogService`, `SchoolYearService` (TuTN); listener truy vấn JDBC thẳng bảng `users`, `roles`, `permissions`.
- Comment trong `NotificationService.java` là tiếng Anh chép từ nơi khác (`/blog_posts/show/3`) — viết lại.

**Commit:** chưa commit nào có mã UC; `feat(thông báo): Nhận…` (phạm vi có dấu, chữ hoa); `fix(BC03)`; `fix: …` gộp ba
việc và sửa file của người khác.

---

## NghiaNV — TS-01..07

| UC | Đánh giá | Ghi chú |
|---|---|---|
| TS-01 Hồ sơ | Một phần | Chưa có lối Khai số dư đầu kỳ, chưa có menu ⚙ |
| TS-02 Tra cứu | Đủ | Tra được cả mã cũ |
| TS-03 Đính kèm | Gần đủ | API của DongLV; Nghĩa làm quyền và màn ảnh, tệp |
| TS-04 Lịch sử | Đủ | |
| TS-05 Cấp mã chuẩn | Đủ | Nút đã ở màn Hồ sơ |
| TS-06 Sinh mã | Đủ | Luôn tự cấp, khoá theo trường, mã tỉnh lấy từ cấu hình |
| TS-07 Nhập từ tệp | Một phần | Có một dòng lỗi là không ghi dòng nào (`EquipmentImportService.java:84-91`); SRS yêu cầu ghi các dòng hợp lệ. Chưa có nút tải mẫu |

**Lỗi cũ — đã sửa:** PATCH đổi mã; mã xem trước gây 409; đổi danh mục giữ MH cũ; `next-code` lộ trường khác; mã tỉnh
"79"; định dạng commit (5 commit mới). **Còn:** khai số dư không phòng mặc định "Đang sử dụng" (`Equipment.java:161`);
drill "Xem tài sản" bên Ghi tăng chưa lọc theo phiếu; chưa có menu ⚙; `teachingCode` chưa lên màn DM-01.

**Lỗi mới**
- TS-07 không kiểm trùng: tải cùng một tệp hai lần thì nhân đôi toàn bộ thiết bị.
- TS-07 bước Kiểm tra báo hợp lệ nhưng Ghi lại hỏng "Chưa cấp được mã" (Kiểm tra không kiểm cấp mã được không).
- TS-07 nhận tên đăng nhập của cán bộ trường khác (`findUser` không lọc trường, `:364-368`).
- Thiết bị nhập từ tệp ghi lịch sử "Nhập hồ sơ thủ công"; phòng, trạng thái gán sau không có dòng lịch sử.
- Đổi nhóm trên form Sửa đổi luôn mã mà không qua phiếu duyệt — cần chốt với GBR-14.
- Code chết: `generateFromIntakeLine`, `allocateCode`, `AttachmentPolicy.java`.
- `EquipmentImportService` đọc thẳng `Room`, `User`, `Unit`, `OriginSource` và dùng `SpreadsheetReader` của TuTN;
  các màn `equipment-import/attachments/photo` gọi `kyInstance` trực tiếp.

---

## Việc DongLV cần chốt

1. `InventoryFreeze` (Tú) chèn vào `VoucherWorkflow`: giữ thì chỉ khoá khi phiếu kiểm kê **đang kiểm** (không tính
   nháp), hay gỡ vì SRS không có.
2. `EquipmentIntakeService.onSurplus` (Tú) và `VoucherAwaitingApproval` (Quang) nằm trong vùng DongLV: nhận về giữ hay
   yêu cầu chuyển sang listener ở vùng của mỗi bạn.
3. Đổi nhóm thiết bị trên form Sửa có được đổi mã ngay không (GBR-14).
4. Còn từ lần trước: In tem QR; resource, mã quyền Tú và Hoàng tự thêm.
