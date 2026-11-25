--liquibase formatted sql

--changeset qltb:134-loan-time-periods
-- Existing vouchers keep null times and periods because those details were never recorded.
ALTER TABLE equipment_loans
    ADD COLUMN loan_time TIME,
    ADD COLUMN loan_period INTEGER,
    ADD COLUMN due_time TIME,
    ADD COLUMN due_period INTEGER,
    ADD COLUMN returned_time TIME,
    ADD COLUMN returned_period INTEGER;

ALTER TABLE equipment_loan_lines
    ADD COLUMN returned_time TIME,
    ADD COLUMN returned_period INTEGER;

ALTER TABLE equipment_loans
    ADD CONSTRAINT ck_equipment_loans_loan_period CHECK (loan_period BETWEEN 1 AND 15),
    ADD CONSTRAINT ck_equipment_loans_due_period CHECK (due_period BETWEEN 1 AND 15),
    ADD CONSTRAINT ck_equipment_loans_returned_period CHECK (returned_period BETWEEN 1 AND 15);

ALTER TABLE equipment_loan_lines
    ADD CONSTRAINT ck_equipment_loan_lines_returned_period CHECK (returned_period BETWEEN 1 AND 15);

--rollback ALTER TABLE equipment_loan_lines DROP CONSTRAINT ck_equipment_loan_lines_returned_period;
--rollback ALTER TABLE equipment_loans DROP CONSTRAINT ck_equipment_loans_returned_period, DROP CONSTRAINT ck_equipment_loans_due_period, DROP CONSTRAINT ck_equipment_loans_loan_period;
--rollback ALTER TABLE equipment_loan_lines DROP COLUMN returned_period, DROP COLUMN returned_time;
--rollback ALTER TABLE equipment_loans DROP COLUMN returned_period, DROP COLUMN returned_time, DROP COLUMN due_period, DROP COLUMN due_time, DROP COLUMN loan_period, DROP COLUMN loan_time;
