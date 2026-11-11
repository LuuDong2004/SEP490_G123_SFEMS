# Đánh giá tiến độ nhóm — 10/11/2026

Đánh giá trên nhánh `dong_dev` sau khi gộp nhánh của mọi người (Hoang_dev, quang_dev, Tu_dev, nghia_dev).
Đối chiếu với `AGENTS.md` (vùng code, quy tắc) và Đặc tả yêu cầu phần mềm (Report 3). Chỉ đọc code và gọi thử
API, không sửa phần của ai.

| Người | Tình trạng chung | Đang chặn người khác |
|---|---|---|
| HoangPND (TC, NC) | Mới có một phần TC-01; TC-02 và NC-01..07 gần như chưa có | Có: chưa có API phòng, đề xuất, kế hoạch mua sắm |
| TuTN (DM, KK) | Danh mục làm kỹ; kiểm kê mới dừng ở KK-01, KK-03 | Không |
| QuangTD (HT-06, BC) | Dashboard và BC-02..05 chạy được; Thông báo chưa làm | Có: `/api/notifications/*` 404 ở mọi màn |
| NghiaNV (TS) | Sinh mã TS-06 và lịch sử TS-04 chắc; TS-03, TS-07 chưa làm | Không |

Cả bốn phần đều **chưa có test nào** (backend chỉ có `SfemsApplicationTests`).

---

## HoangPND — TC-01..02, NC-01..07

**Cần làm gấp** theo thứ tự: `/api/rooms` → đề xuất mua sắm → kế hoạch mua sắm → NC-07 (lập phiếu nhập từ đề xuất).
Hiện cả ba API đều trả 404, nên màn Ghi tăng chưa chọn được phòng nhận và chưa lập phiếu từ đề xuất được; kiểm kê
và thiết bị cũng cần danh sách phòng.

| UC | Backend | Frontend | Đánh giá |
|---|---|---|---|
| TC-01 Trường học | Đủ CRUD trường, cơ quan quản lý, logo | Chỉ có màn danh sách; thêm, sửa, xem vẫn là màn chờ | Một phần |
| TC-02 Phòng | Chỉ có `RoomRepository` | Màn chờ | Thiếu |
| NC-01 Mức đáp ứng định mức | Không có | Không có | Thiếu |
| NC-02..04 Đề xuất, duyệt | Chỉ có repository | Màn chờ | Thiếu |
| NC-05..06 Kế hoạch, duyệt | Chỉ có repository | Màn chờ | Thiếu |
| NC-07 Lập phiếu nhập từ đề xuất | Không có | Không có | Thiếu |

**Lỗi**
- Danh sách trường có nút Sửa/Xem nhưng đều dẫn vào màn chờ; link "Cơ quan quản lý" dẫn tới trang không tồn tại
  (`schools/list.tsx:63`).
- Mã hai ký tự của trường (phần TR trong mã tài sản) sửa được tuỳ ý và không kiểm trùng
  (`SchoolService.java:128,216`).
- Gỡ cơ quan quản lý bằng `{id:null}` bị lỗi (`SchoolService.java:197`).
- Cấp mã trường không khoá, hai người thêm cùng lúc có thể trùng mã (`SchoolService.java:151-180`).

**Quy tắc**
- Phần logo gọi thẳng `JdbcTemplate` trong controller, bỏ qua tầng service (`SchoolLogoController.java:46,78,94`).
- Changelog 050 thiếu `--rollback`.
- `routes.tsx` import thẳng `schools/list` thay vì qua `index.ts`; `school-code.ts` đặt trong `resources/` thay vì `schools/`.
- Nhiều component và repository viết xong nhưng không chỗ nào dùng.

**Commit:** đề xuất (NC-02) và kế hoạch (NC-05) mới chỉ có interface repository rỗng mà đã ghi `feat(...)`. Mỗi commit
`feat` nên là một phần chạy được từ API tới màn hình.

**Góp ý:** đề xuất mua sắm nên kế thừa `SchoolVoucher` / `VoucherService`, không tự viết lại luồng duyệt.

---

## TuTN — DM-01..04, KK-01..07

Phần danh mục làm tốt. Kiểm kê chưa chạy được từ đầu đến cuối.

| UC | Đánh giá | Ghi chú |
|---|---|---|
| DM-01 | Đủ | Nguồn hình thành thành danh mục cố định chỉ đọc, khác SRS — cần xác nhận đã thống nhất |
| DM-02 | Đủ | |
| DM-03 | Đủ | |
| DM-04 | Một phần | Chưa có quy tắc mã phòng trong `CodeTargets.java` |
| KK-01 | Một phần | Sau khi phát động chưa mở màn Tiến độ |
| KK-02 | Thiếu | Chưa có tiến độ từng trường |
| KK-03 | Đủ | |
| KK-04 | Thiếu | Chưa có API, màn ghi kết quả kiểm đếm và tài sản thừa |
| KK-05 | Thiếu | Trình được khi còn dòng chưa kiểm (thiếu MSG45) |
| KK-06 | Thiếu | Duyệt không cập nhật sổ tài sản, không lập phiếu nhập cho tài sản thừa |
| KK-07 | Thiếu | Chưa xuất biên bản |

**Lỗi**
- Cao: phiếu kiểm kê chưa kiểm dòng nào vẫn trình và duyệt được tới Hoàn tất, sổ tài sản không đổi —
  `InventorySessionService` chưa có `validateSubmit` và `onApproved`.
- Danh sách phiếu chạy mỗi dòng một truy vấn (`InventorySessionController.java:36`).
- Sửa đợt kiểm kê không kiểm trùng đợt đang mở (MSG40) — `InventoryCampaignService.update`.
- `EquipmentStandardService.apply` tự tạo thiết bị mã `THPT-NORM-<id>`, bỏ qua quy tắc sinh mã và kiểm trùng tên.

**Quy tắc (cần báo DongLV trước khi làm)**
- Tự thêm 8 resource vào `app/resources/index.tsx` và đổi tên 2 mục menu.
- Tự seed mã quyền mới (changelog 032, 033, 041).
- Changelog 040 sửa dữ liệu bảng phiếu nhập và thiết bị (đặt `acquisition_method_id = NULL` toàn bộ dòng) và xoá
  quyền `origin_sources:write/delete`.
- Sửa `domains/permission/types.ts` (vùng DongLV).
- Ghi thẳng SQL vào bảng `schools`, `departments_of_education`, `notifications` thay vì qua service.

**Commit:** thiếu mã UC ở `f789840`, `ceec330`, `5f1db55`, `b316d0e`; mã UC không nằm trong ngoặc ở `154c327`,
`33ba09a`. Tên nhánh nên là `tu_dev`.

---

## QuangTD — HT-06, BC-01..06

**Cần làm trước:** HT-06 (Thông báo). Chuông thông báo gọi `/api/notifications/unread-count` và `/recent` ở mọi màn, đều
trả 404.

| UC | Đánh giá | Ghi chú |
|---|---|---|
| HT-06 Thông báo | Thiếu | Backend chỉ có `.gitkeep`, màn `/notifications` là màn chờ |
| BC-01 Bảng điều khiển | Đủ | Còn rủi ro hiệu năng (dưới) |
| BC-02 Tài sản | Đủ | |
| BC-03 Mức đáp ứng | Một phần | Chưa có chi tiết theo môn, khối |
| BC-04 Mua sắm | Đủ | |
| BC-05 Kiểm kê | Đủ | |
| BC-06 Xuất dữ liệu | Một phần | Chưa xuất danh sách đang xem, chưa có CSV |

Phạm vi theo trường đã đúng: tài khoản trường không xem được số liệu trường khác.

**Lỗi**
- Dashboard cấp Sở chạy 4 truy vấn cho mỗi trường (`DashboardService.java:91-114`), vài trăm trường sẽ rất chậm.
- Tỷ lệ đáp ứng tính ở hai nơi theo hai cách (`DashboardService.java:170-220`, `AdequacyReportService.java:175-182`),
  số trên dashboard và BC-03 có thể lệch nhau.
- File xuất bị cắt ở 1000 dòng mà không báo (`AssetReportService.java:17,88`).
- Ngày sai định dạng trả 500 thay vì 400 (`AssetReportService.java:126`).
- File Excel dựng từ dữ liệu frontend gửi lên; server nên tự truy vấn lại.
- Đầu bản in ghi cứng "Sở GD&ĐT TP Hồ Chí Minh" kể cả khi tài khoản trường in (`report-print-sheet.tsx:29`).

**Quy tắc**
- Sửa `styles/index.css` (file dùng chung).
- `DashboardService` gọi thẳng `SchoolYearRepository` của lát khác.
- Báo lỗi bằng `window.alert` (`report-export-menu.tsx:33`) thay vì `useNotification`.
- Vài câu SQL ghép thẳng id vào chuỗi thay vì bind tham số (`AdequacyReportService.java:171,277,300`,
  `PurchaseReportService.java:39,44,45`).

**Commit:** có dấu cách trước dấu hai chấm (`feat(export) :`), phạm vi có dấu (`báo cáo`), dùng loại `style` không có
trong danh sách, ba commit đầu không có loại, không commit nào có mã UC.

---

## NghiaNV — TS-01..07

Sinh mã TS-06 và lịch sử TS-04 làm chắc. TS-03 (đính kèm tệp cho thiết bị) và TS-07 (nhập từ tệp) chưa bắt đầu.
Lưu ý: màn danh sách ba chế độ xem, phần lớn hồ sơ thiết bị và API tệp đính kèm do DongLV làm, không tính vào đây.

| UC | Đánh giá | Ghi chú |
|---|---|---|
| TS-01 Hồ sơ | Một phần | Khai số dư đầu kỳ chưa có lối vào, form không có ô Phòng |
| TS-02 Tra cứu | Đủ | |
| TS-03 Đính kèm | Thiếu | Dùng được module attachment có sẵn, cần thêm quyền cho thiết bị |
| TS-04 Lịch sử | Một phần | Đổi mã, tên, danh mục, đơn vị… không ghi lịch sử |
| TS-05 Cấp mã chuẩn | Gần đủ | Nút nằm trong form Sửa, SRS đặt ở màn Hồ sơ |
| TS-06 Sinh mã | Đủ | |
| TS-07 Nhập từ tệp | Thiếu | `dataimport/` rỗng, màn chờ |

**Lỗi**
- Cao: mã tài sản vẫn đổi được ngoài phiếu — PATCH nhận `code`, khi tạo giữ mã client gửi lên; trái GBR-10/14
  (`EquipmentPatchRequest.java:27`, `EquipmentService.java:148`).
- Form tạo gửi mã xem trước lên; hai người lưu cùng lúc thì người sau bị 409.
- Đổi danh mục thì mã vẫn giữ phần mã môn (MH) cũ (`EquipmentService.java:329`).
- Khai số dư không có phòng mà mặc định "Đang sử dụng" (`Equipment.java:161`).
- `next-code?schoolId=` của trường khác vẫn trả mã kế tiếp của trường đó.
- Mã tỉnh viết cứng `"79"` (`AssetCodeService.java:36`).

**Còn thiếu**
- Link "Xem tài sản" bên Ghi tăng (`/equipment?drill=intake.id:…`) chưa lọc theo phiếu: màn không đọc `drill`,
  backend bỏ qua lọc `intake.id`.
- Chưa có menu ⚙ (Tra cứu, Khai số dư, Nhập từ tệp).

**Quy tắc:** sửa `Subject.java` (vùng TuTN), thêm `teachingCode` trùng vai trò với `shortCode` — hai bạn cần chốt dùng
trường nào làm mã môn và đưa ô đó lên màn DM-01.

**Commit:** cả 11 commit sai định dạng (`TS01_FE_QLy Hstb`, `TS06_BE_Fix`); nên viết `feat(thiet-bi): … (TS-0x)`.

---

## Việc DongLV cần chốt

1. Có làm "In tem QR" không — SRS chỉ có tên mục ở mục lục, không có use case.
2. Duyệt hoặc yêu cầu TuTN gỡ các resource và mã quyền đã tự thêm.
3. HoangPND ưu tiên `/api/rooms` và các API mua sắm để mở khoá màn Ghi tăng.
