"""Sinh cấu hình form phiếu (backend/src/main/resources/voucher-forms/*.json) từ app Jmix cũ.

Chạy:  python backend/tools/jmix_voucher_forms.py E:/Jmix/school-equipment

Đọc Jmix qua `git show dev:...` — không đụng tới cây làm việc của repo đó. Với mỗi
phiếu bên này, lấy các mục và trường của form chi tiết Jmix tương ứng, BỎ các trường
đã là cột thật bên này (số phiếu, trường, trạng thái, ngày chứng từ, người mượn...),
và ghi phần còn lại thành một cấu hình mà backend dùng để kiểm tra `details`, frontend
dùng để vẽ form, màn chi tiết và bản in.

Sửa tay tệp JSON sinh ra thì lần chạy sau sẽ ghi đè — sửa ở MAPPINGS bên dưới.
"""
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

REPO = sys.argv[1] if len(sys.argv) > 1 else r"E:\Jmix\school-equipment"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "main", "resources", "voucher-forms")
NS = "{http://jmix.io/schema/flowui/view}"

# Trường chung đã là cột thật trên mọi phiếu bên này.
COMMON_CORE = {"code", "school", "status", "note", "allocationCode", "proposalCode", "planCode"}

# Mỗi phiếu: form đầu phiếu (một hoặc nhiều, kèm điều kiện hiện), form dòng, trường Jmix đã là cột
# thật (bỏ qua), các giai đoạn (form hiện ở hộp thoại hành động thay vì form lập phiếu).
MAPPINGS = {
    "equipment_intakes": {
        "header": [("stock-in-order-detail-view.xml", None)],
        "line": "stock-in-line-detail-view.xml",
        "core": {"changeDate", "fundingSource", "supplier", "equipment", "quantity", "unitValue", "condition",
                 "documentNo"},
    },
    "equipment_allocations": {
        "header": [("allocation-proposal-detail-view.xml", None)],
        "line": "allocation-proposal-item-detail-view.xml",
        "core": {"proposalDate", "allocatedDate", "recipientRoom", "recipientSchool", "usagePurpose",
                 "equipment", "equipmentType", "equipmentCatalog", "quantity"},
    },
    "equipment_transfers": {
        "header": [("transfer-order-detail-view.xml", None)],
        "line": "transfer-order-item-detail-view.xml",
        "core": {"fromSchool", "toSchool", "toRoom", "transferDate", "reason", "equipment", "quantity",
                 "conditionAtTransfer"},
    },
    "equipment_loans": {
        "header": [("borrow-order-detail-view.xml", None)],
        "line": "borrow-order-item-detail-view.xml",
        "stages": {"return": ("return-order-detail-view.xml", ["4.", "5.", "6."])},
        "core": {"borrower", "borrowDate", "dueDate", "returnDate", "purpose", "equipment", "quantity",
                 "referenceOrder", "conditionOnReturn"},
        # Trường của lúc TRẢ, không phải lúc lập phiếu mượn: hiện ở hộp thoại "Ghi nhận trả".
        "headerStage": {"return": {"returnCompleteness"}},
        "lineStage": {"return": {"returnedQuantity", "conclusion"}},
    },
    "damage_reports": {
        "header": [("damage-loss-report-detail-view.xml", None)],
        "line": "damage-loss-report-item-detail-view.xml",
        "core": {"reportDate", "severity", "equipment", "quantity"},
    },
    "repair_orders": {
        # Trường của lúc GHI KẾT QUẢ, không phải lúc lập phiếu: hiện trong hộp "Ghi kết quả".
        "headerStage": {"result": {"warrantyExpiryAfterRepair", "acceptanceMinutesNo", "handoverBy", "receivedAfterBy"}},
        "stageTitles": {"result": "Biên bản nghiệm thu, bàn giao"},
        "header": [("repair-order-detail-view.xml", None)],
        "line": "repair-order-item-detail-view.xml",
        "core": {"equipment", "quantity", "startDate", "completedDate", "repairVendor", "costActual",
                 "conditionAfter", "result", "damageDescription"},
    },
    "warranty_claims": {
        # Trường của lúc GHI KẾT QUẢ, không phải lúc lập phiếu: hiện trong hộp "Ghi kết quả".
        "headerStage": {"result": {"receivedBackBy", "warrantyExtensionNote", "handoverMinutesNo"}},
        "stageTitles": {"result": "Biên bản nghiệm thu, bàn giao"},
        "header": [("warranty-claim-detail-view.xml", None)],
        "line": "warranty-claim-item-detail-view.xml",
        "core": {"equipment", "quantity", "requestDate", "vendor", "conditionAfter", "cost", "reason",
                 "conditionBefore"},
    },
    "maintenance_orders": {
        # Trường của lúc GHI KẾT QUẢ, không phải lúc lập phiếu: hiện trong hộp "Ghi kết quả".
        "headerStage": {"result": {"partsUsed", "acceptanceMinutesNo", "handoverBy", "receivedAfterBy"}},
        "stageTitles": {"result": "Biên bản nghiệm thu, bàn giao"},
        "header": [("maintenance-order-detail-view.xml", None)],
        "line": "maintenance-item-detail-view.xml",
        "core": {"equipment", "quantity", "maintenanceDate", "vendor", "actualEndDate", "costActual",
                 "resultStatus", "conditionAfter"},
    },
    "inventory_sessions": {
        "header": [("inventory-session-detail-view.xml", None)],
        "line": "inventory-item-detail-view.xml",
        "core": {"inventoryDate", "cutoffDate", "equipment", "actualQty", "conditionFound", "foundLocation",
                 "expectedRoom", "conclusion"},
    },
    "disposals": {
        "header": [("dispose-order-detail-view.xml", ["LIQUIDATION"]),
                   ("destruction-order-detail-view.xml", ["DESTRUCTION"])],
        "line": "dispose-order-item-detail-view.xml",
        "core": {"disposeDate", "disposalMethod", "reason", "council", "recoveredValue", "disposalCost",
                 "equipment", "quantity", "originalValue", "remainingValue"},
    },
    "purchase_proposals": {
        "header": [("purchase-proposal-detail-view.xml", None)],
        "line": "purchase-proposal-item-detail-view.xml",
        "lineTables": {"specs": "purchase-proposal-item-spec-detail-view.xml",
                       "accessoryLines": "purchase-proposal-item-accessory-detail-view.xml"},
        "core": {"proposalDate", "reason", "fundingSource", "budgetYear", "proposer", "approvedDate",
                 "rejectionReason", "totalEstimatedAmount", "name", "catalogCode", "unit", "quantity",
                 "unitPrice", "estimatedTotal", "itemPriority", "existingQuantity"},
    },
    "procurement_plans": {
        "header": [("procurement-plan-detail-view.xml", None)],
        "core": {"title", "planDate", "note", "approvalNote", "approvalDate"},
    },
    "stock_issues": {
        "header": [("stock-out-order-detail-view.xml", None)],
        "line": "stock-out-line-detail-view.xml",
        "core": {"changeDate", "equipment", "quantity", "reason"},
    },
    "storage_orders": {
        "header": [("storage-order-detail-view.xml", None)],
        "line": "storage-order-item-detail-view.xml",
        "core": {"issueDate", "entryDate", "status", "equipment", "requestedBy"},
    },
    "depreciation_orders": {
        "header": [("depreciation-order-detail-view.xml", None)],
        "line": "depreciation-item-detail-view.xml",
        "core": {"calculationDate", "method", "equipment", "originalValue", "depreciationRate",
                 "depreciationAmount", "accumulatedDepreciation", "remainingValue", "accumulatedStart",
                 "usefulLifeYears", "depreciationStartDate", "totalOriginalValue", "totalRemainingValue"},
    },
    "consumption_records": {
        "header": [("consumption-record-detail-view.xml", None)],
        "core": {"school", "equipment", "consumedDate", "quantity"},
    },
    "room_bookings": {
        "header": [("room-booking-detail-view.xml", None)],
        "line": "room-booking-item-detail-view.xml",
        "core": {"school", "room", "bookingDate", "periodFrom", "periodTo", "requester", "purpose", "status",
                 "approvedBy", "approvedDate", "rejectReason", "equipment", "quantity"},
    },
}

# --------------------------------------------------------------- gọn form
# Jmix mang sang ~30-45 trường mỗi phiếu và tới 26 cờ bắt buộc. Phần lớn là thứ hệ
# thống ĐÃ BIẾT (người lập = người đăng nhập, ngày lập, năm học suy từ ngày, số phiếu
# tự cấp, đơn vị = trường của phiếu), thứ TRÙNG với phần chính của phiếu / dòng / hồ sơ
# tài sản (kho, phòng, người đang giữ, tình trạng khai thác do trạng thái phiếu quyết
# định, tổng tiền cộng từ dòng) hoặc hình thức hành chính của riêng Jmix (loại / tên
# chứng từ, người soạn, người ký — bước duyệt đã ghi ai duyệt). Những trường đó bị BỎ.
#
# Cờ `required` của Jmix KHÔNG được dùng: chỉ các khoá trong `require` của từng phiếu
# là bắt buộc — thứ nghiệp vụ thật sự cần mà phần chính của phiếu chưa có. Còn lại là
# tuỳ chọn, để in biên bản đầy đủ khi cần.
#
# Khoá bị bỏ được ghi vào `retired` của cấu hình: phiếu nháp cũ còn mang chúng trong
# `details` thì backend lặng lẽ gạt đi thay vì từ chối "Trường không hợp lệ".
DROP = {
    # hệ thống đã biết
    "documentTitle", "issueDate", "preparedBy", "requestedBy", "recordedBy", "proposer",
    "schoolYear", "fiscalYear", "documentNo", "description",
    # hình thức chứng từ của Jmix
    "documentCategory", "documentName", "issuingUnit", "documentPreparedBy", "signedBy", "linkedDocuments",
    # đơn vị = trường của phiếu
    "reportingUnit", "requestingUnit", "disposalUnit", "inventoryUnit", "maintenanceUnit", "calculationUnit",
    "managingUnitAfter", "managingUnitBefore", "managingDept",
    # kho / phòng / người giữ: dòng phiếu và hồ sơ tài sản đã có
    "warehouseName", "issuingWarehouse", "lendingWarehouse", "receivingWarehouse", "storageLocationBefore",
    "storageLocationAfter", "usageRoomAfter", "equipmentRegisteredLocation", "equipmentLocation", "roomLocation",
    "currentRoom", "fromRoom", "managingDepartment", "managerUser", "manager", "fromManager",
    # trạng thái khai thác: do trạng thái phiếu quyết định
    "exploitationStatus", "exploitationStatusAfter", "exploitationStatusAfterReturn",
    "exploitationDuringWarranty",
    # tính từ dòng / hồ sơ tài sản
    "totalValue", "totalWriteOffValue", "totalCheckedValue", "unit", "accumulatedDepreciation",
    "remainingValue", "assetType",
}
# Bỏ thêm theo từng phiếu: trùng cột thật của chính phiếu đó.
DROP_BY = {
    # Phiếu nhập: chứng từ, nguồn hình thành, hình thức mua sắm đã là cột thật theo TỪNG DÒNG; "mục đích"
    # trùng ghi chú / lý do tăng của dòng; năm ngân sách và VAT không ai đọc tới (đơn giá đã là nguyên giá).
    # "Lý do tăng" của dòng (movementReason) cùng nghĩa với NGUỒN HÌNH THÀNH, nay là cột thật ở đầu phiếu (109).
    "equipment_intakes": {"storageLocation", "reason", "sourceDocument", "formationMethod", "budgetYear", "vatAmount",
                          "movementReason",
                          # đơn vị nhận = trường của phiếu; tem QR in sau khi duyệt, ở màn In tem
                          "receiverUnit", "qrLabelApplied", "qrLabelDate",
                          # hàng ghi tăng luôn về kho, thủ kho = cán bộ phụ trách phòng kho (rooms.managing_staff_id);
                          # khai tay là chỗ để biên bản nói khác hồ sơ tài sản (góp ý của tester)
                          "warehouseKeeper"},
    "stock_issues": {"storageLocation"},
    # Nguồn hình thành của thiết bị là thông tin trên HỒ SƠ tài sản, không phải của phiếu báo hỏng.
    # Báo hỏng: chức vụ / bộ phận của người báo có trên hồ sơ cán bộ; ngày giờ phát hiện, tình trạng và hướng
    # xử lý đã là "Ngày phát hiện", "Mức độ", "Cách xử lý" ở phần chính; các ô về MẤT (nguyên nhân mất, hình
    # thức mất, trình báo cơ quan chức năng) thuộc phiếu ghi giảm do mất, không phải phiếu báo hỏng; tổng
    # thiệt hại cộng từ "Chi phí khắc phục" của từng dòng; số đã thu bồi thường chưa có lúc lập phiếu.
    "damage_reports": {"reportedBy", "estimatedRepairCost", "location", "equipmentFormationSource",
                       "reporterPosition", "reporterDepartment", "occurredDate", "occurredTime",
                       "conditionWhenDetected", "handlingProposal", "lossCauseCircumstances", "lossForm",
                       "reportedToAuthority", "policeReportNo", "totalDamageValue", "valueHandlingForm",
                       "collectedCompensation", "sourceDocument",
                       # nguy cơ / biện pháp an toàn, người xác nhận, số biên bản, kết quả xác minh: thủ tục của
                       # một vụ việc lớn — phiếu báo hỏng chỉ cần nói hỏng vì đâu và ai chịu; hạn nộp bồi thường
                       # theo dõi ngoài hệ thống; nguồn chi do lãnh đạo quyết lúc duyệt chi phí thuê sửa.
                       "safetyRisk", "safetyMeasures", "confirmedBy", "confirmMinutesNo", "verificationResult",
                       "compensationDeadline", "fundingSource"},
    # Sửa chữa: "Loại công việc" hỏi lại "Hình thức sửa" của phần chính; tình trạng thiết bị là hồ sơ tài sản
    # (đang hỏng); số / cấp phê duyệt do bước duyệt ghi; phiếu nguồn đã có ở "Căn cứ phiếu"; ghi tăng giá trị
    # sau sửa là việc của kế toán, không phải của phiếu; "nội dung đã thực hiện" của dòng = ghi chú kết quả.
    "repair_orders": {"repairType", "conditionBefore", "approvalDocNo", "approvalLevel", "sourceDocument",
                      "valueIncreaseAfterRepair", "line:workDone"},
    # Bảo hành: hạn bảo hành nằm trên hồ sơ tài sản (và đã gửi bảo hành thì đương nhiên còn hạn); tổng chi
    # phí, nội dung đã xử lý, lý do từ chối là phần "Ghi kết quả" (chi phí thực tế, ghi chú).
    "warranty_claims": {"sourceDocument", "warrantyStartDate", "warrantyEndDate", "warrantyPeriodMonths",
                        "underWarranty", "vatPercent", "totalCost", "processedContent", "rejectionReason"},
    # Bảo dưỡng: cả mục "kết quả bảo hành" là của phiếu bảo hành; ngày bắt đầu = "Ngày bảo dưỡng"; chu kỳ và
    # lần kế tiếp do KẾ HOẠCH bảo trì giữ (ghi kết quả là kế hoạch tự dời); phiếu nguồn là ô kế hoạch.
    "maintenance_orders": {"sourceDocument", "startDate", "cycleMonths", "nextMaintenanceDate",
                           "warrantyAfterNote", "valueIncreaseAfterRepair",
                           "warrantyReason", "vendorContact", "warrantyScope", "warrantyExpectedReturnDate",
                           "warrantyActualReturnDate", "warrantyResult", "warrantyRejectionReason",
                           "replacementSerialNo", "warrantyExtensionNote",
                           "line:underWarranty", "line:outsideWarrantyCost", "line:content", "line:result"},
    # Mượn: người mượn chọn từ danh sách cán bộ nên đối tượng, tổ, điện thoại đã có trên hồ sơ cán bộ; "Môn,
    # lớp sử dụng" hỏi lại ô "Mục đích" của phần chính; sổ theo dõi cho mượn chính là danh sách phiếu này; văn
    # bản căn cứ thì đính kèm tệp. Lúc TRẢ: tình trạng, số thiếu, kết luận từng thiết bị đã là "Kết quả" của
    # từng dòng (bình thường / hỏng / mất); xử lý sau trả và bồi thường nằm ở phiếu báo hỏng / ghi giảm nháp
    # mà hệ thống lập khi trả về hỏng hoặc mất.
    "equipment_loans": {"approvedBy", "handoverBy",
                        "borrowerType", "borrowingDepartment", "borrowerContact", "usageContext",
                        "trackingBookNo", "sourceDocument", "commitmentNote",
                        # bài dạy, tiết, phòng dùng: ô "Mục đích" của phần chính đã nói mượn để làm gì, ở đâu
                        "lesson", "periodFrom", "periodTo", "usageLocation",
                        "returnCompleteness", "returnShortageQty", "postReturnHandling",
                        "compensationValue", "penalty", "compensationReceiptNo", "compensationForm",
                        "line:returnedQuantity", "line:conclusion"},
    # Đặt phòng: cách đăng ký, buổi, giờ bắt đầu / kết thúc đã là ô của phần chính (và giờ do máy chủ tính theo
    # tiết / buổi); giờ nhận - trả phòng, tình trạng phòng khi trả, tình trạng thiết bị khi trả là việc SAU buổi
    # dùng — phiếu đặt phòng dừng ở "đã xác nhận", không có bước trả nào để khai chúng.
    # Lớp, môn học: ô "Mục đích, nội dung bài dạy" của phần chính đã nói — mượn phòng chỉ là ghi nhận.
    "room_bookings": {"bookingMode", "session", "startTime", "endTime", "handoverTime", "returnTime",
                      "roomConditionOnReturn", "handoverNote", "line:conditionOnReturn",
                      "schoolClass", "subject"},
    # Kiểm kê: phạm vi và tên / kỳ đã là ô của phần chính; chênh lệch, nguyên nhân, kiến nghị khai theo TỪNG
    # DÒNG lúc kiểm đếm ("head:" = chỉ bỏ ở đầu phiếu) và tổng kết ở "Kết luận của tổ kiểm kê"; văn bản căn cứ
    # thì đính kèm tệp.
    "inventory_sessions": {"sourceDocument", "scope", "periodYear",
                           "head:differenceValue", "head:differenceReason", "head:handlingProposal"},
    # Cấp phát: người nhận và phòng nhận đã là cột thật của phiếu (receiver, room) — "Người nhận",
    # "Người quản lý nhận", "Bộ phận nhận" hỏi lại đúng hai thứ đó; nguồn kinh phí nằm trên hồ sơ tài sản
    # (và là điều kiện hồ sơ chuẩn, nên tài sản vào được phiếu thì đã có).
    # Bỏ thêm: văn bản nguồn thì đính kèm tệp; tình trạng lúc cấp phát là tình trạng trên hồ sơ tài sản;
    # thời hạn sử dụng và cam kết không ai đọc lại trên một phiếu giao tài sản trong nội bộ trường.
    "equipment_allocations": {"handoverBy", "receiverName", "recipientManager", "recipientDepartment",
                              "fundingSource", "sourceDocument", "conditionAtAllocation", "usageTermNote",
                              "commitmentNote"},
    # Điều chuyển giữa hai trường: văn bản nguồn là "Số quyết định" của phần chính; loại điều chuyển luôn là
    # liên trường; thẩm quyền phê duyệt do luồng duyệt quyết; ngày bàn giao là "Ngày điều chuyển", ngày tiếp
    # nhận do hệ thống ghi lúc trường nhận xác nhận; người quản lý tiếp nhận là người của TRƯỜNG NHẬN (ô chọn
    # cán bộ chỉ tra được trường lập phiếu) và trường nhận tự xếp khi nhận; xử lý giá trị là việc của kế toán.
    "equipment_transfers": {"sourceDocument", "transferType", "approvalAuthority", "handoverDate", "receiptDate",
                            "toManager", "valueHandlingNote"},
    # Đề xuất mua sắm: mục đích và hiện trạng thiết bị đã nói ở "Sự cần thiết"; loại đề nghị là cột "Loại" của
    # từng dòng; nơi dùng và người quản lý quyết lúc cấp phát, hình thức mua sắm và VAT quyết lúc lập kế hoạch
    # và ghi tăng; thẩm quyền, ý kiến chuyên viên / phê duyệt, kết quả xử lý là việc của luồng duyệt (lời nhắn
    # nằm ở quá trình duyệt); văn bản nguồn thì đính kèm tệp.
    "purchase_proposals": {"sourceDocument", "vatAmount", "procurementMethod", "intendedDepartment",
                           "intendedRoom", "intendedManager", "purchasePurpose", "proposalType",
                           "currentEquipmentStatus", "approvalAuthority", "specialistOpinion", "approvalOpinion",
                           "processingResult"},
    # Hao mòn tính từ sổ: nguồn hình thành, nguồn kinh phí đọc từ hồ sơ từng tài sản.
    "depreciation_orders": {"approvedBy", "equipmentFormationSource", "fundingSource"},
    # Thanh lý: nguồn hình thành, nguồn kinh phí, người đang giữ đều trên hồ sơ tài sản của từng dòng.
    # Bỏ thêm: chứng từ nguồn (phiếu đã nhớ phiếu sinh ra nó), chủ tịch / thư ký hội đồng (ô "Hội đồng thanh lý"
    # của phần chính chọn từ nhân sự), ngày hoàn tất (là ngày thực hiện của biên bản), VAT. Ở DÒNG: thứ đã có
    # trên hồ sơ tài sản (năm đưa vào dùng, tình trạng), lý do (đã ở đầu phiếu), hao mòn (chưa làm), và tiền
    # thu / chi / nộp từng dòng (khai một lần cho cả phiếu lúc ghi biên bản).
    # Mockup ghi giảm: bỏ "Nơi lưu giữ chờ thanh lý" (mặc định về kho) và "Tình trạng khi thanh lý" (tình trạng
    # của từng tài sản đã ở bảng dòng).
    "disposals": {"storageLocation", "conditionAtLiquidation",
                  "formationSource", "fundingSource", "equipmentManager", "sourceDocument", "councilChair",
                  "councilSecretary", "completionDate", "vatAmount", "line:yearPutIntoUse",
                  "line:currentCondition", "line:liquidationReason", "line:depreciationExpired",
                  "line:actualRecoveredAmount", "line:liquidationCost", "line:amountPaidToBudget"},
}
# Khoá của DÒNG phiếu viết "line:<khoá>" — cùng một khoá có thể có ở cả đầu phiếu và dòng.
REQUIRE = {
    "equipment_intakes": {"deliveredBy"},
    "equipment_loans": {"line:conditionOnBorrow"},
    "stock_issues": {"receiverName"},
    "storage_orders": {"location", "storageType"},
    "maintenance_orders": {"maintenanceType", "content"},
    "disposals": {"destructionMethod", "executingUnit"},
}


# Danh mục chọn của riêng bên này (không có trong Jmix).
OWN_ENUMS = {
    "InspectionResult": [
        {"value": "PASSED", "label": "Đạt"},
        {"value": "PARTIAL", "label": "Đạt một phần"},
        {"value": "FAILED", "label": "Không đạt"},
    ],
    # Nguồn kinh phí của một lần sửa chữa — cùng ba mã với `RepairFunding` ở máy chủ, mà sổ sửa
    # chữa, cải tạo công trình (`facility_works.funding_source`) cũng dùng.
    "RepairFunding": [
        {"value": "STATE_BUDGET", "label": "Ngân sách chi thường xuyên"},
        {"value": "SCHOOL_REVENUE", "label": "Nguồn thu hợp pháp của trường"},
        {"value": "OTHER", "label": "Nguồn khác"},
    ],
    # Cấp ra quyết định thanh lý / tiêu huỷ theo mockup ghi giảm — ba cấp; "Phòng GD" của Jmix không còn (153 đổi
    # dữ liệu cũ sang UBND).
    "ApprovalAuthority": [
        {"value": "PRINCIPAL", "label": "Hiệu trưởng"},
        {"value": "PEOPLE_COMMITTEE", "label": "UBND phường/xã"},
        {"value": "DEPARTMENT", "label": "Sở GD&ĐT"},
    ],
    "DestructionMethod": [
        {"value": "BURN", "label": "Đốt"},
        {"value": "BURY", "label": "Chôn lấp"},
        {"value": "CRUSH", "label": "Đập phá"},
        {"value": "RECYCLE", "label": "Tái chế"},
        {"value": "WASTE_COLLECTION", "label": "Thu gom xử lý chất thải"},
        {"value": "OTHER", "label": "Khác (ghi rõ ở ghi chú)"},
    ],
    "DestructionUnit": [
        {"value": "SELF", "label": "Tự thực hiện (nhà trường)"},
        {"value": "WASTE_COMPANY", "label": "Đơn vị thu gom xử lý chất thải"},
        {"value": "OTHER", "label": "Đơn vị khác"},
    ],
}
# Chỉnh lại sau khi sinh: đổi kiểu một trường, gộp mọi mục thành một mục có tên và thứ tự trường cho sẵn.
RESHAPE = {
    "equipment_intakes": {
        "kind": {"inspectionResult": {"kind": "enum", "enum": "InspectionResult"}},
        "merge": ("Biên bản giao nhận", ["deliveredBy", "deliveryRepresentative", "receiverName", "receiverPosition",
                                         "inspectionResult", "handoverMinutesNo"]),
    },
    # Phiếu mượn: ba mục Jmix (chứng từ / khai thác / người mượn) trộn lẫn "ai mượn" với "dùng vào việc gì".
    # Gộp và xếp theo thứ tự người ta điền: ai mượn → dùng cho bài nào, tiết nào, ở đâu → sổ sách → ghi chú dài.
    "equipment_loans": {
        "merge": ("Thông tin mượn", ["accessories"]),
        "stageMerge": {"return": ("Biên bản trả", ["receivedBy", "returnMinutesNo", "accessoriesReturned"])},
    },
}

# Thanh lý có BIẾN THỂ theo hình thức và có giai đoạn "execute" (ghi biên bản đã thực hiện), nên xếp mục
# tường minh: mỗi mục nói nó của hình thức nào, giai đoạn nào, gồm những ô nào theo thứ tự nào. Ô của lúc
# THỰC HIỆN (biên bản, bên mua, hợp đồng, tiền nộp…) khai trong hộp "Ghi biên bản", không trên form đề nghị.
# Ghi giảm do MẤT không có mục nào: không có hiện trạng để tả, không bán, không có biên bản thực hiện —
# sự việc mất ghi ở ô Ghi chú của phiếu.
_LIQUIDATION = ["LIQUIDATION"]
RESHAPE["disposals"] = {
  # Mockup ghi giảm: hình thức và đơn vị tiêu huỷ là ô CHỌN; tiêu huỷ có cấp quyết định riêng.
  "kind": {"destructionMethod": {"kind": "enum", "enum": "DestructionMethod"},
           "executingUnit": {"kind": "enum", "enum": "DestructionUnit"},
           "approvalAuthority": {"wide": False}},
  "add": [{"key": "destructionAuthority", "label": "Cấp quyết định tiêu huỷ", "kind": "enum",
           "enum": "ApprovalAuthority"}],
  "layout": [
    {"title": "Nội dung phiếu", "when": _LIQUIDATION, "keys": ["approvalAuthority"]},
    {"title": "Nội dung phiếu", "when": ["DESTRUCTION"],
     "keys": ["destructionMethod", "executingUnit", "destructionAuthority", "destructionLocation", "costFunding",
              "environmentalNote"]},
    # Số QĐ lập hội đồng và đánh giá của hội đồng có SAU khi duyệt — khai lúc hoàn tất.
    {"title": "Hội đồng thanh lý", "when": _LIQUIDATION, "stage": "execute",
     "keys": ["councilDecisionNo", "councilAssessment"]},
    {"title": "Biên bản thanh lý", "when": _LIQUIDATION, "stage": "execute",
     "keys": ["minutesNo", "handoverMinutesNo", "valuationOrg", "auctionOrg", "buyer", "saleContractNo",
              "paymentMethod", "amountPaidToBudget"]},
    {"title": "Biên bản tiêu huỷ", "when": ["DESTRUCTION"], "stage": "execute", "keys": ["destructionResult"]},
]}

# Bốn phiếu của phân hệ Sửa chữa & bảo trì: sau khi bỏ ô trùng, phần còn lại gộp MỘT mục.
RESHAPE.update({
    "damage_reports": {"merge": ("Nguyên nhân và trách nhiệm", ["cause", "responsiblePerson", "compensation"])},
    "inventory_sessions": {"merge": ("Hội đồng kiểm kê", [
        "inventoryType", "councilDecisionNo", "councilChair", "councilSecretary", "inventoryMinutesNo"])},
    "equipment_transfers": {"merge": ("Bàn giao và chi phí", [
        "handoverMinutesNo", "transportCost", "transportCostFunding"])},
    "purchase_proposals": {"merge": ("Thời hạn và căn cứ", ["neededByDate", "priceBasis", "submittedDocNo"])},
    "equipment_allocations": {"merge": ("Bàn giao", ["handoverMinutesNo", "accessories"])},
    # "Nguồn kinh phí chi trả" của Jmix (nhà cung cấp / đơn vị / chia sẻ) là AI trả; trường cần biết TIỀN NÀO
    # Ô mới `repairFunding`, `costPayer` cũ thành khoá đã bỏ.
    "repair_orders": {"rename": {"costPayer": ("repairFunding", {"kind": "enum", "enum": "RepairFunding"})},
                      "merge": ("Chi phí", ["repairFunding", "vatAmount"])},
    "warranty_claims": {"merge": ("Thông tin bảo hành", ["warrantyScope", "vendorContact", "costPayer", "handoverBy"])},
    "maintenance_orders": {"merge": ("Nội dung bảo dưỡng", [
        "maintenanceType", "content", "performedByName", "conditionBefore", "costPayer", "vatAmount"])},
})

# Nhãn viết lại cho NGẮN và dễ hiểu. Nhãn của Jmix là cả một câu ("Số sổ theo dõi cho mượn, đăng ký sử dụng
# thiết bị"): trên lưới bốn cột nó xuống hai dòng và đẩy ô của nó lệch khỏi hàng. "*" áp cho mọi phiếu;
# khoá trùng tên mà khác nghĩa giữa các phiếu thì đặt theo từng phiếu (thắng "*").
RELABEL = {
    "*": {
        "councilDecisionNo": "Số QĐ lập hội đồng",
        "valueIncreaseAfterRepair": "Giá trị ghi tăng sau sửa",
        "acceptanceMinutesNo": "Số biên bản nghiệm thu",
        "receivedAfterBy": "Người nhận lại",
        "underWarranty": "Còn bảo hành",
        "warrantyExtensionNote": "Gia hạn bảo hành",
        "differenceValue": "Giá trị chênh lệch",
    },
    "equipment_loans": {
        "borrowingDepartment": "Tổ, bộ phận mượn",
        "borrowerContact": "Điện thoại người mượn",
        "usageContext": "Môn, lớp sử dụng",
        "lesson": "Bài dạy",
        "usageLocation": "Phòng sử dụng",
        "trackingBookNo": "Số sổ theo dõi",
        "sourceDocument": "Chứng từ gốc",
        "accessories": "Phụ kiện kèm theo",
        "commitmentNote": "Cam kết đền bù",
        "returnCompleteness": "Tình trạng khi trả",
        "compensationValue": "Giá trị phải bồi thường",
        "penalty": "Số tiền đã bồi thường",
    },
    "damage_reports": {
        "fundingSource": "Nguồn chi dự kiến",
        "compensation": "Bồi thường phải thu",
        "collectedCompensation": "Bồi thường đã thu",
        "conditionWhenDetected": "Tình trạng khi phát hiện",
        "reporterPosition": "Chức vụ người báo",
        "lossCauseCircumstances": "Nguyên nhân mất",
        "reportedToAuthority": "Đã báo cơ quan chức năng",
        "safetyMeasures": "Biện pháp an toàn đã làm",
        "responsiblePerson": "Người chịu trách nhiệm",
        "confirmedBy": "Người xác nhận hiện trạng",
        "damageValue": "Chi phí khắc phục",
    },
    "depreciation_orders": {
        "depreciationPeriod": "Kỳ tính",
        "usageConditionPeriod": "Tình trạng sử dụng",
        "calculationType": "Loại tính",
        "periodDurationNote": "Số tháng, ngày tính",
        "accountingEntry": "Bút toán hạch toán",
    },
    "disposals": {
        "amountPaidToBudget": "Số tiền thực nộp",
        "storageLocation": "Nơi lưu giữ chờ thanh lý",
        "conditionAtLiquidation": "Tình trạng khi thanh lý",
        "approvalAuthority": "Cấp quyết định thanh lý",
        "councilAssessment": "Đánh giá của hội đồng",
        "buyer": "Bên mua, bên nhận",
        "saleContractNo": "Số hợp đồng mua bán",
        "paymentMethod": "Hình thức nộp tiền",
        "minutesNo": "Số biên bản thanh lý",
        "handoverMinutesNo": "Số biên bản bàn giao",
        "destructionMethod": "Hình thức tiêu huỷ",
        "destructionLocation": "Địa điểm tiêu huỷ",
        "costFunding": "Nguồn chi phí tiêu huỷ",
        "executingUnit": "Đơn vị tiêu huỷ",
        "environmentalNote": "Yêu cầu môi trường, an toàn",
        "destructionResult": "Kết quả tiêu huỷ",
        "depreciationExpired": "Đã hết thời gian hao mòn",
        "disposalValue": "Giá trị thanh lý",
        "liquidationReason": "Lý do thanh lý",
    },
    "inventory_sessions": {
        "councilChair": "Chủ tịch hội đồng",
        "handlingStatus": "Kết luận kiểm kê",
    },
    "maintenance_orders": {
        "content": "Nội dung công việc",
        "conditionBefore": "Tình trạng trước khi làm",
        "warrantyAfterNote": "Bảo hành sau sửa chữa",
        "vendorContact": "Liên hệ đơn vị bảo hành",
        "warrantyScope": "Phạm vi bảo hành",
        "replacementSerialNo": "Linh kiện thay, serial mới",
        "outsideWarrantyCost": "Chi phí ngoài bảo hành",
    },
    "purchase_proposals": {
        "currentEquipmentStatus": "Hiện trạng thiết bị",
    },
    "repair_orders": {
        "warrantyExpiryAfterRepair": "Bảo hành sau sửa chữa",
        "repairFunding": "Nguồn kinh phí sửa chữa",
    },
    "warranty_claims": {
        "warrantyPeriodMonths": "Bảo hành (tháng)",
        "handoverBy": "Người giao đi bảo hành",
        "processedContent": "Nội dung đã xử lý",
        "handoverMinutesNo": "Số biên bản giao nhận",
    },
}


# Lời giải thích (dấu "?" cạnh nhãn) — CHỈ cho ô mà nhãn ngắn chưa đủ nói phải điền gì. Nhãn tự nói đủ
# thì không có: một dấu "?" ở mọi ô là không ô nào được đọc.
HINTS = {
    "equipment_loans": {
        "usageContext": "Môn học, khối lớp và tiết hoặc buổi dùng thiết bị. VD: Vật lí, lớp 8A2, tiết 3 sáng thứ Ba.",
        "trackingBookNo": "Số thứ tự trong sổ theo dõi cho mượn, đăng ký sử dụng thiết bị của trường.",
        "sourceDocument": "Văn bản làm căn cứ cho mượn: kế hoạch bài dạy, giấy đề nghị, lịch thực hành.",
        "commitmentNote": "Thoả thuận đền bù khi làm mất hoặc làm hỏng thiết bị.",
        "returnCompleteness": "Thiết bị trả về có đủ và còn dùng được không.",
    },
    "damage_reports": {
        "fundingSource": "Nguồn tiền dự kiến dùng để sửa chữa hoặc thay thế.",
        "responsiblePerson": "Người phải chịu trách nhiệm, và có phải bồi thường không.",
        "safetyMeasures": "Việc đã làm để bảo đảm an toàn sau khi phát hiện (ngắt điện, niêm phong, cách ly…).",
    },
    "depreciation_orders": {
        "depreciationPeriod": "Tính theo tháng, quý hay năm.",
        "calculationType": "Hao mòn (tài sản dùng cho hoạt động sự nghiệp) hay khấu hao (tài sản dùng cho dịch vụ có thu).",
        "periodDurationNote": "Số tháng, số ngày được tính trong kỳ khi tài sản không dùng trọn kỳ.",
    },
    "disposals": {
        "amountPaidToBudget": "Số tiền thu được đã nộp ngân sách hoặc quỹ của đơn vị.",
        "approvalAuthority": "Cấp có thẩm quyền ra quyết định thanh lý.",
        "depreciationExpired": "Tài sản đã tính hết thời gian hao mòn / khấu hao chưa.",
        "disposalValue": "Giá khởi điểm hoặc giá trị thanh lý được xác định.",
    },
    "inventory_sessions": {
        "differenceValue": "Giá trị phần thừa hoặc thiếu so với sổ sau khi kiểm kê.",
    },
    "maintenance_orders": {
        "replacementSerialNo": "Thiết bị, linh kiện đã thay và số serial mới của chúng.",
        "valueIncreaseAfterRepair": "Chỉ khai khi sửa chữa lớn làm tăng nguyên giá tài sản.",
        "warrantyExtensionNote": "Thời hạn bảo hành được gia hạn hoặc cộng dồn sau lần xử lý này.",
    },
    "repair_orders": {
        "valueIncreaseAfterRepair": "Chỉ khai khi sửa chữa lớn làm tăng nguyên giá tài sản.",
    },
    "warranty_claims": {
        "warrantyExtensionNote": "Thời hạn bảo hành được gia hạn hoặc cộng dồn sau lần xử lý này.",
    },
}


def relabel(resource, form):
    names = {**RELABEL["*"], **RELABEL.get(resource, {})}
    hints = HINTS.get(resource, {})
    for f in [f for sec in form["sections"] for f in sec["fields"]] + form["line"]:
        if f["key"] in names:
            f["label"] = names[f["key"]]
        if f["key"] in hints:
            f["hint"] = hints[f["key"]]


def reshape(resource, form):
    spec = RESHAPE.get(resource)
    if not spec:
        return
    for sec in form["sections"]:
        for f in sec["fields"]:
            if f["key"] in spec.get("rename", {}):
                old = f["key"]
                f["key"], kind = spec["rename"][old]
                f.pop("max", None)
                f.pop("suggest", None)
                f.update(kind)
                form["retired"] = sorted(set(form.get("retired", [])) | {old})
            if f["key"] in spec.get("kind", {}):
                if spec["kind"][f["key"]].get("kind"):
                    f.pop("max", None)
                    f.pop("suggest", None)
                f.update(spec["kind"][f["key"]])
                if f.get("wide") is False:
                    f.pop("wide")
    # Ô không có trong Jmix: thêm vào mục đầu, rồi `layout` xếp chỗ cho nó.
    if spec.get("add") and form["sections"]:
        form["sections"][0]["fields"] += [dict(f) for f in spec["add"]]
        for f in spec["add"]:
            if f.get("enum"):
                ENUMS_USED.add(f["enum"])
    if "merge" in spec:
        title, order = spec["merge"]
        fields = {f["key"]: f for sec in form["sections"] if not sec.get("stage") for f in sec["fields"]}
        rest = [k for k in fields if k not in order]
        merged = [fields[k] for k in order + rest if k in fields]
        form["sections"] = [{"title": title, "fields": merged}] + [s for s in form["sections"] if s.get("stage")]
    if "layout" in spec:
        fields = {f["key"]: f for sec in form["sections"] for f in sec["fields"]}
        listed = {k for entry in spec["layout"] for k in entry["keys"]}
        left = set(fields) - listed
        assert not left, f"{resource}: ô chưa xếp vào mục nào (xếp vào layout hoặc bỏ ở DROP_BY): {sorted(left)}"
        form["sections"] = []
        for entry in spec["layout"]:
            sec = {"title": entry["title"], "fields": [fields[k] for k in entry["keys"] if k in fields]}
            if entry.get("when"):
                sec["when"] = {"field": "kind", "in": entry["when"]}
            if entry.get("stage"):
                sec["stage"] = entry["stage"]
            if sec["fields"]:
                form["sections"].append(sec)
    # Các mục của một GIAI ĐOẠN (vd. lúc trả) cũng gộp một mục, theo thứ tự cho sẵn.
    for stage, (title, order) in spec.get("stageMerge", {}).items():
        fields = {f["key"]: f for sec in form["sections"] if sec.get("stage") == stage for f in sec["fields"]}
        merged = [fields[k] for k in order + [k for k in fields if k not in order] if k in fields]
        form["sections"] = [s for s in form["sections"] if s.get("stage") != stage]
        if merged:
            form["sections"].append({"title": title, "stage": stage, "fields": merged})


def tidy(resource, form):
    """Bỏ trường thừa, đặt lại cờ bắt buộc; trả về tập khoá đã bỏ."""
    drop = DROP | DROP_BY.get(resource, set())
    need = REQUIRE.get(resource, set())
    retired = set()

    def keep(fields, prefix=""):
        out = []
        for f in fields:
            if f["key"] in drop or prefix + f["key"] in drop:
                retired.add(f["key"])
                continue
            f.pop("required", None)
            if (prefix if prefix == "line:" else "") + f["key"] in need:
                f["required"] = True
            out.append(f)
        return out

    for s in form["sections"]:
        s["fields"] = keep(s["fields"], "head:")
    form["sections"] = [s for s in form["sections"] if s["fields"]]
    form["line"] = keep(form["line"], "line:")
    kept = {f["key"] for s in form["sections"] for f in s["fields"]} | {f["key"] for f in form["line"]}
    form["retired"] = sorted(retired - kept)


# Trường chuỗi mà Jmix cho chọn từ danh sách gợi ý — bên này gõ tự do, kèm gợi ý.
# Người giao / đại diện bên giao của phiếu nhập là người BÊN GIAO HÀNG, không phải cán bộ của trường —
# không gợi ý tên cán bộ cho hai ô đó (gợi ý sai còn tệ hơn không gợi ý).
SUGGEST = {
    "schoolYear": "schoolYear", "fiscalYear": "year", "budgetYear": "year", "periodYear": "year",
    "documentPreparedBy": "staff", "signedBy": "staff", "handoverBy": "staff", "receivedAfterBy": "staff",
    "receivedBackBy": "staff", "receiverName": "staff", "managerUser": "staff",
    "equipmentManager": "staff", "responsiblePerson": "staff", "councilSecretary": "staff",
    "checkedBy": "staff", "recipientManager": "staff", "intendedManager": "staff", "performedByName": "staff",
    "lendingWarehouse": "room", "receivingWarehouse": "room", "storageLocationBefore": "room",
    "storageLocationAfter": "room", "usageLocation": "room", "storageLocation": "room", "roomLocation": "room",
    "equipmentLocation": "room", "equipmentRegisteredLocation": "room", "location": "room",
    "warehouseName": "room", "issuingWarehouse": "room", "usageRoomAfter": "room", "intendedRoom": "room",
    "fundingSource": "funding", "formationSource": "origin", "equipmentFormationSource": "origin",
    "formationMethod": "origin",
}
# Trường chuỗi mà Jmix thực chất chọn trong một enum (nhưng khai kiểu String).
STRING_ENUMS = {
    "exploitationStatus": "OperationalStatus", "exploitationStatusAfter": "OperationalStatus",
    "exploitationStatusAfterReturn": "OperationalStatus", "exploitationDuringWarranty": "OperationalStatus",
    "conditionBefore": "EquipmentCondition", "conditionAtLiquidation": "EquipmentCondition",
    "conditionWhenDetected": "EquipmentCondition", "conditionBeforeDestruction": "EquipmentCondition",
}
PERCENT = {"depreciationRate", "vatPercent"}


def git(*args):
    r = subprocess.run(["git", "-C", REPO, *args], capture_output=True)
    if r.returncode:
        return None
    return r.stdout.decode("utf-8")


FILES = git("ls-tree", "-r", "--name-only", "dev").splitlines()
MODEL = {f.rsplit("/", 1)[1][:-5]: f for f in FILES if f.startswith("src/main/java/com/vn/sem/model/") and f.endswith(".java")}
VIEWS = {f.rsplit("/", 1)[1]: f for f in FILES if "/view/" in f and f.endswith(".xml")}
MSGS = {}
for line in git("show", "dev:src/main/resources/com/vn/sem/messages_vi.properties").splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        MSGS[k.strip()] = v.strip()
ENUMS_USED = set()


def entity_fields(cls):
    src = git("show", "dev:" + MODEL[cls])
    out = {}
    for m in re.finditer(r"((?:\s*@[^\n]+\n)*)\s*private ([\w<>., ]+) (\w+);", src):
        ann, jtype, name = m.group(1), m.group(2).strip().split(".")[-1], m.group(3)
        info = {"java": jtype}
        lm = re.search(r"length\s*=\s*(\d+)", ann)
        if lm:
            info["length"] = int(lm.group(1))
        if "@Lob" in ann:
            info["lob"] = True
        gm = re.search(r"public (\w+) get" + name[0].upper() + name[1:] + r"\(\)", src)
        if gm and gm.group(1) in MODEL and "/enums/" in MODEL[gm.group(1)]:
            info["enum"] = gm.group(1)
        if jtype in MODEL and "/enums/" in MODEL[jtype]:
            info["enum"] = jtype
        out[name] = info
    return out


def enum_values(name):
    src = git("show", "dev:" + MODEL[name])
    vals = re.findall(r"^\s*([A-Z][A-Z0-9_]+)\s*\(", src, re.M)
    return [{"value": v, "label": MSGS.get(f"com.vn.sem.model.enums/{v and name}.{v}", v)} for v in vals]


def label(key, pkg, cls, prop):
    if key and key.startswith("msg://"):
        k = key[6:]
        if "/" in k:
            return MSGS.get(k, k)
        return MSGS.get(f"{pkg}/{k}", MSGS.get(f"com.vn.sem/{k}", k))
    if key:
        return key
    mpkg = MODEL[cls].split("/model/")[1].rsplit("/", 1)[0].replace("/", ".")
    return MSGS.get(f"com.vn.sem.model.{mpkg}/{cls}.{prop}", prop)


def field_of(comp, pkg, cls, ef):
    prop = comp.get("property")
    info = ef.get(prop)
    if info is None or "." in prop:
        return None
    jt = info["java"]
    tag = comp.tag.replace(NS, "")
    f = {"key": prop, "label": label(comp.get("label"), pkg, cls, prop)}
    enum = info.get("enum") or STRING_ENUMS.get(prop)
    if enum:
        f["kind"] = "enum"
        f["enum"] = enum
        ENUMS_USED.add(enum)
    elif jt == "String":
        f["kind"] = "textarea" if (tag == "textArea" or info.get("lob")) else "text"
        f["max"] = info.get("length", 4000)
        if prop in SUGGEST:
            f["suggest"] = SUGGEST[prop]
    elif jt == "LocalDate":
        f["kind"] = "date"
    elif jt == "LocalTime":
        f["kind"] = "time"
    elif jt == "Integer":
        f["kind"] = "integer"
    elif jt == "BigDecimal":
        f["kind"] = "percent" if prop in PERCENT else "money"
    elif jt == "Boolean":
        f["kind"] = "boolean"
    elif jt in ("Staff", "User"):
        f["kind"] = "staff"
    elif jt == "Room":
        f["kind"] = "room"
    elif jt == "School":
        f["kind"] = "school"
    elif jt in ("Lesson", "SchoolClass", "Subject", "BorrowOrder"):
        f["kind"] = "text"
        f["max"] = 255
    else:
        return None  # MovementReason: danh mục đã gỡ (309); FileRef, Equipment, danh mục thiết bị: đã có chỗ khác
    if comp.get("colspan"):
        f["wide"] = True
    if f["kind"] == "textarea":
        f["wide"] = True
    if "required" in (comp.get("classNames") or ""):
        f["required"] = True
    return f


def sections_of(view_name, core):
    path = VIEWS[view_name]
    root = ET.fromstring(git("show", "dev:" + path))
    pkg = "com.vn.sem.view." + path.split("/view/")[1].split("/")[0]
    cls = root.find(f"{NS}data/{NS}instance").get("class").rsplit(".", 1)[1]
    ef = entity_fields(cls)
    out = []
    boxes = [vb for vb in root.iter(f"{NS}vbox") if "phieu-section" in (vb.get("classNames") or "").split()]
    if not boxes:
        boxes = [root]
    for vb in boxes:
        h4 = vb.find(f".//{NS}h4")
        title = label(h4.get("text"), pkg, cls, "") if h4 is not None else "Thông tin chi tiết"
        fields, seen = [], set()
        for fl in vb.iter(f"{NS}formLayout"):
            if "summary" in (fl.get("classNames") or ""):
                continue
            for comp in fl.iter():
                prop = comp.get("property")
                if not prop or prop in seen or prop in core or prop in COMMON_CORE:
                    continue
                f = field_of(comp, pkg, cls, ef)
                if f:
                    seen.add(prop)
                    fields.append(f)
        if fields:
            out.append({"title": re.sub(r"^\d+\.\s*", "", title).capitalize() if title.isupper() else re.sub(r"^\d+\.\s*", "", title),
                        "fields": fields})
    return out


def line_fields(view_name, core, stage_of=None):
    secs = sections_of(view_name, core - (set().union(*stage_of.values()) if stage_of else set()))
    fields = [f for s in secs for f in s["fields"]]
    for f in fields:
        for st, keys in (stage_of or {}).items():
            if f["key"] in keys:
                f["stage"] = st
    return fields


def build(resource, m):
    core = set(m.get("core", set()))
    form = {"resource": resource, "sections": [], "line": [], "lineTables": {}}
    seen = set()
    for view, when in m["header"]:
        for sec in sections_of(view, core):
            fields = []
            for f in sec["fields"]:
                if f["key"] in seen:
                    continue
                seen.add(f["key"])
                fields.append(f)
            if not fields:
                continue
            if when:
                sec["when"] = {"field": "kind", "in": when}
            sec["fields"] = fields
            form["sections"].append(sec)
    for stage, keys in m.get("headerStage", {}).items():
        moved = []
        for sec in form["sections"]:
            moved += [f for f in sec["fields"] if f["key"] in keys]
            sec["fields"] = [f for f in sec["fields"] if f["key"] not in keys]
        form["sections"] = [s for s in form["sections"] if s["fields"]]
        if moved:
            title = m.get("stageTitles", {}).get(stage, "Kết quả trả")
            form["sections"].append({"title": title, "stage": stage, "fields": moved})
    for stage, (view, prefixes) in m.get("stages", {}).items():
        path = VIEWS[view]
        for sec in sections_of(view, core):
            fields = [f for f in sec["fields"] if f["key"] not in seen]
            for f in fields:
                seen.add(f["key"])
            if fields:
                form["sections"].append({"title": sec["title"], "stage": stage, "fields": fields})
    if m.get("line"):
        lc = core - {"equipment"}
        form["line"] = line_fields(m["line"], lc | {"equipment"}, None)
        for f in form["line"]:
            for st, keys in m.get("lineStage", {}).items():
                if f["key"] in keys:
                    f["stage"] = st
    for key, view in m.get("lineTables", {}).items():
        form["lineTables"][key] = [f for s in sections_of(view, {"sortOrder"}) for f in s["fields"]]
    return form


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    forms = {r: build(r, m) for r, m in MAPPINGS.items()}
    for r, form in forms.items():
        tidy(r, form)
        reshape(r, form)
        relabel(r, form)
    enums = {}
    for e in sorted(ENUMS_USED - set(OWN_ENUMS)):
        src = git("show", "dev:" + MODEL[e])
        vals = re.findall(r"^\s*([A-Z][A-Z0-9_]+)\s*\(", src, re.M)
        enums[e] = [{"value": v, "label": MSGS.get(f"com.vn.sem.model.enums/{e}.{v}", v)} for v in vals]
    for r, form in forms.items():
        used = {f["enum"] for s in form["sections"] for f in s["fields"] if f.get("enum")}
        used |= {f["enum"] for f in form["line"] if f.get("enum")}
        form["enums"] = {e: (OWN_ENUMS[e] if e in OWN_ENUMS else enums[e]) for e in sorted(used)}
        with open(os.path.join(OUT, r + ".json"), "w", encoding="utf-8") as fh:
            json.dump(form, fh, ensure_ascii=False, indent=1)
        n = sum(len(s["fields"]) for s in form["sections"])
        print(f"{r:24s} {len(form['sections'])} mục, {n} trường đầu phiếu, {len(form['line'])} trường dòng")
