--liquibase formatted sql

--changeset qltb:154-loan-slots
-- Tiết 1–15 cũ chuyển thành lựa chọn Tiết/Buổi; giờ cụ thể tiếp tục là cột riêng, có thể để trống.
ALTER TABLE equipment_loans
    DROP CONSTRAINT ck_equipment_loans_loan_period,
    DROP CONSTRAINT ck_equipment_loans_due_period,
    DROP CONSTRAINT ck_equipment_loans_returned_period;
ALTER TABLE equipment_loan_lines DROP CONSTRAINT ck_equipment_loan_lines_returned_period;

ALTER TABLE equipment_loans
    ALTER COLUMN loan_period TYPE VARCHAR(20) USING 'PERIOD_' || loan_period::text,
    ALTER COLUMN due_period TYPE VARCHAR(20) USING 'PERIOD_' || due_period::text,
    ALTER COLUMN returned_period TYPE VARCHAR(20) USING 'PERIOD_' || returned_period::text;
ALTER TABLE equipment_loan_lines
    ALTER COLUMN returned_period TYPE VARCHAR(20) USING 'PERIOD_' || returned_period::text;

ALTER TABLE equipment_loans
    RENAME COLUMN loan_period TO loan_slot;
ALTER TABLE equipment_loans
    RENAME COLUMN due_period TO due_slot;
ALTER TABLE equipment_loans
    RENAME COLUMN returned_period TO returned_slot;
ALTER TABLE equipment_loan_lines
    RENAME COLUMN returned_period TO returned_slot;

ALTER TABLE equipment_loans
    ADD CONSTRAINT ck_equipment_loans_loan_slot CHECK (loan_slot IN ('MORNING', 'AFTERNOON') OR loan_slot ~ '^PERIOD_([1-9]|1[0-5])$'),
    ADD CONSTRAINT ck_equipment_loans_due_slot CHECK (due_slot IN ('MORNING', 'AFTERNOON') OR due_slot ~ '^PERIOD_([1-9]|1[0-5])$'),
    ADD CONSTRAINT ck_equipment_loans_returned_slot CHECK (returned_slot IN ('MORNING', 'AFTERNOON') OR returned_slot ~ '^PERIOD_([1-9]|1[0-5])$');
ALTER TABLE equipment_loan_lines
    ADD CONSTRAINT ck_equipment_loan_lines_returned_slot CHECK (returned_slot IN ('MORNING', 'AFTERNOON') OR returned_slot ~ '^PERIOD_([1-9]|1[0-5])$');

--rollback ALTER TABLE equipment_loan_lines DROP CONSTRAINT ck_equipment_loan_lines_returned_slot;
--rollback ALTER TABLE equipment_loans DROP CONSTRAINT ck_equipment_loans_returned_slot, DROP CONSTRAINT ck_equipment_loans_due_slot, DROP CONSTRAINT ck_equipment_loans_loan_slot;
--rollback ALTER TABLE equipment_loan_lines RENAME COLUMN returned_slot TO returned_period;
--rollback ALTER TABLE equipment_loans RENAME COLUMN returned_slot TO returned_period;
--rollback ALTER TABLE equipment_loans RENAME COLUMN due_slot TO due_period;
--rollback ALTER TABLE equipment_loans RENAME COLUMN loan_slot TO loan_period;
--rollback ALTER TABLE equipment_loan_lines ALTER COLUMN returned_period TYPE INTEGER USING CASE WHEN returned_period LIKE 'PERIOD_%' THEN split_part(returned_period, '_', 2)::integer ELSE NULL END;
--rollback ALTER TABLE equipment_loans ALTER COLUMN loan_period TYPE INTEGER USING CASE WHEN loan_period LIKE 'PERIOD_%' THEN split_part(loan_period, '_', 2)::integer ELSE NULL END, ALTER COLUMN due_period TYPE INTEGER USING CASE WHEN due_period LIKE 'PERIOD_%' THEN split_part(due_period, '_', 2)::integer ELSE NULL END, ALTER COLUMN returned_period TYPE INTEGER USING CASE WHEN returned_period LIKE 'PERIOD_%' THEN split_part(returned_period, '_', 2)::integer ELSE NULL END;
--rollback ALTER TABLE equipment_loans ADD CONSTRAINT ck_equipment_loans_loan_period CHECK (loan_period BETWEEN 1 AND 15), ADD CONSTRAINT ck_equipment_loans_due_period CHECK (due_period BETWEEN 1 AND 15), ADD CONSTRAINT ck_equipment_loans_returned_period CHECK (returned_period BETWEEN 1 AND 15);
--rollback ALTER TABLE equipment_loan_lines ADD CONSTRAINT ck_equipment_loan_lines_returned_period CHECK (returned_period BETWEEN 1 AND 15);
