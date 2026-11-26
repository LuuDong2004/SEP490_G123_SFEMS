--liquibase formatted sql

--changeset luudong:307-so-cong-van-dot-kiem-ke
--comment Số công văn phát động đợt kiểm kê (vd. 1234/SGDĐT-KHTC): Sở ghi lúc phát động, trường đối chiếu với công văn đính kèm.
ALTER TABLE inventory_campaigns ADD COLUMN document_no VARCHAR(100);
--rollback ALTER TABLE inventory_campaigns DROP COLUMN document_no;
