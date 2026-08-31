-- SmartBank AI — Migration v2
-- Run this if you already have the database from v1 schema
-- psql -U postgres -d smartbank_db -f database/migrate_v2.sql

-- Add missing columns to branches table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='manager_id') THEN
    ALTER TABLE branches ADD COLUMN manager_id UUID;
    RAISE NOTICE 'Added manager_id to branches';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='province') THEN
    ALTER TABLE branches ADD COLUMN province VARCHAR(100);
    RAISE NOTICE 'Added province to branches';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='district') THEN
    ALTER TABLE branches ADD COLUMN district VARCHAR(100);
    RAISE NOTICE 'Added district to branches';
  END IF;
END $$;

-- Add missing columns to users table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='province') THEN
    ALTER TABLE users ADD COLUMN province VARCHAR(100);
    RAISE NOTICE 'Added province to users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='district') THEN
    ALTER TABLE users ADD COLUMN district VARCHAR(100);
    RAISE NOTICE 'Added district to users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='sector') THEN
    ALTER TABLE users ADD COLUMN sector VARCHAR(100);
    RAISE NOTICE 'Added sector to users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='village') THEN
    ALTER TABLE users ADD COLUMN village VARCHAR(100);
    RAISE NOTICE 'Added village to users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='preferred_branch_id') THEN
    ALTER TABLE users ADD COLUMN preferred_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added preferred_branch_id to users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='kyc_passport_photo') THEN
    ALTER TABLE users ADD COLUMN kyc_passport_photo TEXT;
    RAISE NOTICE 'Added kyc_passport_photo to users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='kyc_id_document') THEN
    ALTER TABLE users ADD COLUMN kyc_id_document TEXT;
    RAISE NOTICE 'Added kyc_id_document to users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='kyc_status') THEN
    ALTER TABLE users ADD COLUMN kyc_status VARCHAR(20) DEFAULT 'none';
    RAISE NOTICE 'Added kyc_status to users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='kyc_reviewed_by') THEN
    ALTER TABLE users ADD COLUMN kyc_reviewed_by UUID;
    RAISE NOTICE 'Added kyc_reviewed_by to users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='kyc_reviewed_at') THEN
    ALTER TABLE users ADD COLUMN kyc_reviewed_at TIMESTAMPTZ;
    RAISE NOTICE 'Added kyc_reviewed_at to users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='kyc_reject_reason') THEN
    ALTER TABLE users ADD COLUMN kyc_reject_reason TEXT;
    RAISE NOTICE 'Added kyc_reject_reason to users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='temp_password') THEN
    ALTER TABLE users ADD COLUMN temp_password TEXT;
    RAISE NOTICE 'Added temp_password to users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='temp_password_used') THEN
    ALTER TABLE users ADD COLUMN temp_password_used BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added temp_password_used to users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_photo') THEN
    ALTER TABLE users ADD COLUMN profile_photo TEXT;
    RAISE NOTICE 'Added profile_photo to users';
  END IF;
END $$;

-- Add pending_approval to user_status enum if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='pending_approval' AND enumtypid='user_status'::regtype) THEN
    ALTER TYPE user_status ADD VALUE 'pending_approval';
    RAISE NOTICE 'Added pending_approval to user_status enum';
  END IF;
END $$;

-- Add generate_account_number function
CREATE OR REPLACE FUNCTION generate_account_number() RETURNS VARCHAR(20) AS $$
DECLARE
  new_num VARCHAR(20);
  num_exists BOOLEAN;
BEGIN
  LOOP
    new_num := '100' || LPAD(FLOOR(RANDOM() * 9000000000 + 1000000000)::BIGINT::TEXT, 10, '0');
    SELECT EXISTS(SELECT 1 FROM accounts WHERE account_number = new_num) INTO num_exists;
    EXIT WHEN NOT num_exists;
  END LOOP;
  RETURN new_num;
END;
$$ LANGUAGE plpgsql;

-- Update branch locations with province/district
UPDATE branches SET province='Kigali', district='Gasabo'    WHERE code='HQ001'  AND province IS NULL;
UPDATE branches SET province='Kigali', district='Nyarugenge' WHERE code='KGL001' AND province IS NULL;
UPDATE branches SET province='Kigali', district='Nyarugenge' WHERE code='NYR001' AND province IS NULL;
UPDATE branches SET province='Northern Province', district='Musanze' WHERE code='MSZ001' AND province IS NULL;

-- Insert new branches if they don't exist
INSERT INTO branches(name,code,location,address,province,district,phone,email)
SELECT 'Huye Branch','HYE001','Huye District','NR3 Road, Huye','Southern Province','Huye','+250788000005','hye@smartbank.rw'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code='HYE001');

INSERT INTO branches(name,code,location,address,province,district,phone,email)
SELECT 'Rubavu Branch','RBV001','Rubavu District','Lake Road, Gisenyi','Western Province','Rubavu','+250788000006','rbv@smartbank.rw'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code='RBV001');

INSERT INTO branches(name,code,location,address,province,district,phone,email)
SELECT 'Rwamagana Branch','RWM001','Rwamagana District','Main Road, Rwamagana','Eastern Province','Rwamagana','+250788000007','rwm@smartbank.rw'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code='RWM001');

DO $$ BEGIN RAISE NOTICE '=== Migration v2 Complete ==='; END $$;

-- Add document fields to loans table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='doc_id_document') THEN
    ALTER TABLE loans ADD COLUMN doc_id_document TEXT;
    ALTER TABLE loans ADD COLUMN doc_income_proof TEXT;
    ALTER TABLE loans ADD COLUMN doc_business_plan TEXT;
    ALTER TABLE loans ADD COLUMN doc_collateral_doc TEXT;
    ALTER TABLE loans ADD COLUMN purpose TEXT;
    ALTER TABLE loans ADD COLUMN collateral TEXT;
    ALTER TABLE loans ADD COLUMN review_notes TEXT;
    RAISE NOTICE 'Added document columns to loans';
  END IF;
END $$;

-- Add 'under_review' and 'request_info' to loan_status if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='request_info' AND enumtypid='loan_status'::regtype) THEN
    ALTER TYPE loan_status ADD VALUE 'request_info';
    RAISE NOTICE 'Added request_info to loan_status';
  END IF;
END $$;
