--liquibase formatted sql

-- Báo hỏng "thuê sửa, có chi phí" không còn chờ lãnh đạo trường duyệt ở phiếu báo hỏng.
--
-- Lúc báo hỏng chưa có báo giá, nên số tiền lãnh đạo duyệt ở đó chỉ là ước tính. Từ nay báo hỏng trình là
-- xong (như tự sửa, bảo hành, hỏng nặng), phiếu sửa chữa nháp ra đời, cán bộ khai đơn vị sửa và chi phí ở
-- đó rồi trình — lãnh đạo trường duyệt chi phí ở PHIẾU SỬA CHỮA (`RepairOrder.approvalExempt()`).
--
-- Phiếu báo hỏng thuê sửa còn đang chờ duyệt theo luồng cũ thì duyệt xong sẽ sinh một phiếu sửa chữa lại
-- phải duyệt lần nữa — lãnh đạo ký hai lần cho một việc. Trả chúng về nháp: cán bộ trình lại, phiếu đi
-- theo luồng mới. Tài sản giữ "hỏng, chờ xử lý" như lúc báo hỏng, vì nó vẫn đúng là đang hỏng.

--changeset qltb:121-damage-report-outsource-no-approval
UPDATE damage_reports
SET status        = 'DRAFT',
    approval_step = NULL,
    return_note   = 'Luồng thuê sửa đã đổi: trình lại phiếu này, rồi khai đơn vị sửa và chi phí ở phiếu sửa chữa nháp — lãnh đạo trường duyệt chi phí ở đó.'
WHERE handling = 'OUTSOURCE'
  AND status = 'PENDING';
