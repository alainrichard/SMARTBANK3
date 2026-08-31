-- SmartBank AI - Complete PostgreSQL Schema
-- Run: psql -U postgres -d smartbank_db -f schema.sql
SET client_encoding = 'UTF8';
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop everything cleanly
DROP TABLE IF EXISTS ml_model_logs,chat_messages,chat_sessions,audit_logs,otp_tokens,notifications,bill_payments,fraud_cases,loans,transactions,accounts,users,branches CASCADE;
DROP TYPE IF EXISTS notif_type,fraud_severity,fraud_status,loan_status,loan_type,txn_channel,txn_status,txn_type,currency_code,account_status,account_type,user_status,user_role CASCADE;

-- ── BRANCHES ────────────────────────────────────────────────────
CREATE TABLE branches(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL, code VARCHAR(20) UNIQUE NOT NULL,
  location TEXT, address TEXT, phone VARCHAR(20), email VARCHAR(100),
  province VARCHAR(100), district VARCHAR(100),
  manager_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── USERS ────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM('super_admin','branch_manager','bank_staff','fraud_analyst','auditor','customer');
CREATE TYPE user_status AS ENUM('active','inactive','suspended','pending_kyc','pending_approval');
CREATE TABLE users(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL, phone VARCHAR(20) UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'customer',
  status user_status DEFAULT 'active',
  national_id VARCHAR(50) UNIQUE, date_of_birth DATE, address TEXT,
  province VARCHAR(100), district VARCHAR(100), sector VARCHAR(100), village VARCHAR(100),
  preferred_branch_id UUID,
  kyc_verified BOOLEAN DEFAULT FALSE, kyc_document_url TEXT,
  kyc_passport_photo TEXT, kyc_id_document TEXT,
  kyc_status VARCHAR(20) DEFAULT 'none', kyc_reviewed_by UUID, kyc_reviewed_at TIMESTAMPTZ, kyc_reject_reason TEXT,
  temp_password TEXT, temp_password_used BOOLEAN DEFAULT FALSE,
  two_fa_enabled BOOLEAN DEFAULT FALSE, two_fa_secret TEXT,
  oauth_provider VARCHAR(50), oauth_id VARCHAR(200), profile_photo TEXT,
  refresh_token TEXT, last_login_at TIMESTAMPTZ, last_login_ip VARCHAR(45),
  last_login_device TEXT, last_login_location TEXT,
  failed_login_count INT DEFAULT 0, locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_branch ON users(branch_id);

-- ── ACCOUNTS ────────────────────────────────────────────────────
CREATE TYPE account_type AS ENUM('savings','checking','business','fixed_deposit');
CREATE TYPE account_status AS ENUM('active','frozen','closed','pending');
CREATE TYPE currency_code AS ENUM('RWF','USD','EUR','GBP','KES','UGX');
CREATE TABLE accounts(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  account_number VARCHAR(20) UNIQUE NOT NULL,
  account_type account_type NOT NULL DEFAULT 'savings',
  currency currency_code DEFAULT 'RWF',
  balance DECIMAL(18,4) NOT NULL DEFAULT 0,
  daily_limit DECIMAL(18,4) DEFAULT 1000000,
  monthly_limit DECIMAL(18,4) DEFAULT 10000000,
  status account_status DEFAULT 'active',
  opened_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_accounts_number ON accounts(account_number);

-- ── TRANSACTIONS ─────────────────────────────────────────────────
CREATE TYPE txn_type AS ENUM('deposit','withdrawal','transfer','bill_payment','loan_disbursement','loan_repayment','fee','reversal','qr_payment');
CREATE TYPE txn_status AS ENUM('pending','completed','failed','reversed','flagged','blocked');
CREATE TYPE txn_channel AS ENUM('mobile','web','atm','teller','api','qr','voice');
CREATE TABLE transactions(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference VARCHAR(50) UNIQUE NOT NULL,
  sender_account_id UUID REFERENCES accounts(id),
  receiver_account_id UUID REFERENCES accounts(id),
  amount DECIMAL(18,4) NOT NULL, currency currency_code DEFAULT 'RWF',
  fee DECIMAL(18,4) DEFAULT 0,
  type txn_type NOT NULL, status txn_status DEFAULT 'pending',
  channel txn_channel DEFAULT 'web',
  description TEXT, ip_address VARCHAR(45), device_info TEXT,
  geo_lat DECIMAL(10,7), geo_lng DECIMAL(10,7), geo_country VARCHAR(100),
  fraud_score DECIMAL(5,4), is_flagged BOOLEAN DEFAULT FALSE, flagged_reason TEXT,
  processed_by UUID REFERENCES users(id),
  metadata JSONB, created_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ
);
CREATE INDEX idx_txn_sender ON transactions(sender_account_id);
CREATE INDEX idx_txn_receiver ON transactions(receiver_account_id);
CREATE INDEX idx_txn_created ON transactions(created_at DESC);
CREATE INDEX idx_txn_flagged ON transactions(is_flagged) WHERE is_flagged=TRUE;

-- ── FRAUD CASES ──────────────────────────────────────────────────
CREATE TYPE fraud_status AS ENUM('open','investigating','resolved_fraud','resolved_false_positive','escalated');
CREATE TYPE fraud_severity AS ENUM('low','medium','high','critical');
CREATE TABLE fraud_cases(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id),
  account_id UUID REFERENCES accounts(id),
  user_id UUID REFERENCES users(id),
  assigned_analyst UUID REFERENCES users(id),
  status fraud_status DEFAULT 'open', severity fraud_severity DEFAULT 'medium',
  description TEXT, ai_score DECIMAL(5,4), ai_reason TEXT[],
  ai_model_version VARCHAR(50),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), resolved_at TIMESTAMPTZ
);

-- ── LOANS ────────────────────────────────────────────────────────
CREATE TYPE loan_type AS ENUM('personal','business','agricultural','education','mortgage');
CREATE TYPE loan_status AS ENUM('applied','under_review','approved','disbursed','rejected','closed','defaulted');
CREATE TABLE loans(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id), account_id UUID REFERENCES accounts(id),
  loan_type loan_type NOT NULL, status loan_status DEFAULT 'applied',
  principal_amount DECIMAL(18,4) NOT NULL, interest_rate DECIMAL(5,4) NOT NULL,
  duration_months INT NOT NULL, monthly_payment DECIMAL(18,4),
  total_repayable DECIMAL(18,4), outstanding_balance DECIMAL(18,4),
  purpose TEXT, collateral TEXT,
  doc_id_document TEXT, doc_income_proof TEXT,
  doc_business_plan TEXT, doc_collateral_doc TEXT,
  review_notes TEXT,
  ai_credit_score DECIMAL(5,2), ai_risk_level VARCHAR(20), ai_recommendation TEXT,
  approved_by UUID REFERENCES users(id), disbursed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── BILL PAYMENTS ────────────────────────────────────────────────
CREATE TABLE bill_payments(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(id),
  biller_name VARCHAR(100) NOT NULL, biller_code VARCHAR(50),
  customer_ref VARCHAR(100), amount DECIMAL(18,4),
  status VARCHAR(20) DEFAULT 'pending',
  transaction_id UUID REFERENCES transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── NOTIFICATIONS ────────────────────────────────────────────────
CREATE TYPE notif_type AS ENUM('transaction','login','fraud_alert','loan_update','account_update','otp','system','promotion','geo_alert');
CREATE TABLE notifications(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notif_type NOT NULL, title VARCHAR(200) NOT NULL, body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE, channel VARCHAR(20) DEFAULT 'app',
  metadata JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications(user_id, is_read);

-- ── OTP TOKENS ───────────────────────────────────────────────────
CREATE TABLE otp_tokens(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(10) NOT NULL, purpose VARCHAR(50) NOT NULL,
  is_used BOOLEAN DEFAULT FALSE, expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUDIT LOGS ───────────────────────────────────────────────────
CREATE TABLE audit_logs(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(150) NOT NULL, entity VARCHAR(80), entity_id UUID,
  old_value JSONB, new_value JSONB,
  ip_address VARCHAR(45), user_agent TEXT, session_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id);

-- ── CHAT ─────────────────────────────────────────────────────────
CREATE TABLE chat_sessions(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE chat_messages(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ML MODEL LOGS ────────────────────────────────────────────────
CREATE TABLE ml_model_logs(
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_name VARCHAR(100) NOT NULL, model_version VARCHAR(50),
  action VARCHAR(50) NOT NULL, accuracy DECIMAL(5,4),
  samples_trained INT, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRIGGERS ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at=NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_users_upd BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_accounts_upd BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_loans_upd BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_branches_upd BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── SEED DATA ────────────────────────────────────────────────────

-- ── UNIQUE ACCOUNT NUMBER GENERATOR ─────────────────────────────
CREATE OR REPLACE FUNCTION generate_account_number() RETURNS VARCHAR(20) AS $$
DECLARE
  new_num VARCHAR(20);
  exists BOOLEAN;
BEGIN
  LOOP
    -- Format: 100 + 10-digit timestamp-based unique number
    new_num := '100' || LPAD(FLOOR(RANDOM() * 9000000000 + 1000000000)::BIGINT::TEXT, 10, '0');
    SELECT EXISTS(SELECT 1 FROM accounts WHERE account_number = new_num) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN new_num;
END;
$$ LANGUAGE plpgsql;

INSERT INTO branches(name,code,location,address,province,district,phone,email) VALUES
('Head Office',        'HQ001', 'Kigali, Rwanda',     'KG 7 Ave, Kigali City Tower', 'Kigali',            'Gasabo',    '+250780000001',  'hq@smartbank.rw'),
('Kigali City Branch', 'KGL001','Kigali, Rwanda',     'KN 4 Ave, Kigali',            'Kigali',            'Nyarugenge','+250788111001',  'kigali@smartbank.rw'),
('Nyarugenge Branch',  'NYR001','Nyarugenge, Kigali', 'KG 2 St, Nyarugenge',         'Kigali',            'Nyarugenge','+250788111002',  'nyarugenge@smartbank.rw'),
('Musanze Branch',     'MSZ001','Musanze, Rwanda',    'Main Street, Musanze',         'Northern Province', 'Musanze',   '+250788111003',  'musanze@smartbank.rw'),
('Huye Branch',        'HYE001','Huye, Rwanda',       'NR3 Road, Huye',               'Southern Province', 'Huye',      '+250788111004',  'huye@smartbank.rw'),
('Rubavu Branch',      'RBV001','Rubavu, Rwanda',     'Lake Road, Gisenyi',           'Western Province',  'Rubavu',    '+250788111005',  'rubavu@smartbank.rw'),
('Rwamagana Branch',   'RWM001','Rwamagana, Rwanda',  'Main Road, Rwamagana',         'Eastern Province',  'Rwamagana', '+250788111006',  'rwamagana@smartbank.rw');

-- All test passwords = bcrypt("Staff@123456") for staff, bcrypt("Admin@123456") for admin
INSERT INTO users(first_name,last_name,email,phone,password_hash,role,status,kyc_verified,branch_id) VALUES
('Super','Admin','admin@smartbank.rw','+250780000000','$2a$12$g9NBrtcZAcH5/i5sKBRtIeG0ArJQyA2xf78NDnFHjNpZJoqPaNnXK','super_admin','active',TRUE,(SELECT id FROM branches WHERE code='HQ001')),
('Alice','Uwimana','manager@smartbank.rw','+250788200001','$2a$12$zkogvkBRcfYBfBDjvSgXl.aZCheziBxvILYh19RrMa/82pttbvPn2','branch_manager','active',TRUE,(SELECT id FROM branches WHERE code='KGL001')),
('Bob','Mugisha','analyst@smartbank.rw','+250788200002','$2a$12$zkogvkBRcfYBfBDjvSgXl.aZCheziBxvILYh19RrMa/82pttbvPn2','fraud_analyst','active',TRUE,(SELECT id FROM branches WHERE code='KGL001')),
('Carol','Ingabire','teller@smartbank.rw','+250788200003','$2a$12$zkogvkBRcfYBfBDjvSgXl.aZCheziBxvILYh19RrMa/82pttbvPn2','bank_staff','active',TRUE,(SELECT id FROM branches WHERE code='KGL001')),
('David','Nkurunziza','auditor@smartbank.rw','+250788200004','$2a$12$zkogvkBRcfYBfBDjvSgXl.aZCheziBxvILYh19RrMa/82pttbvPn2','auditor','active',TRUE,(SELECT id FROM branches WHERE code='HQ001')),
('Jean','Habimana','jean@example.com','+250788300001','$2a$12$zkogvkBRcfYBfBDjvSgXl.aZCheziBxvILYh19RrMa/82pttbvPn2','customer','active',TRUE,(SELECT id FROM branches WHERE code='KGL001')),
('Marie','Uwase','marie@example.com','+250788300002','$2a$12$zkogvkBRcfYBfBDjvSgXl.aZCheziBxvILYh19RrMa/82pttbvPn2','customer','active',TRUE,(SELECT id FROM branches WHERE code='NYR001')),
('Pierre','Niyonkuru','pierre@example.com','+250788300003','$2a$12$zkogvkBRcfYBfBDjvSgXl.aZCheziBxvILYh19RrMa/82pttbvPn2','customer','active',FALSE,(SELECT id FROM branches WHERE code='MSZ001'));

INSERT INTO accounts(user_id,account_number,account_type,currency,balance,branch_id) VALUES
((SELECT id FROM users WHERE email='jean@example.com'),'1000000001','savings','RWF',2500000,(SELECT id FROM branches WHERE code='KGL001')),
((SELECT id FROM users WHERE email='jean@example.com'),'1000000002','checking','RWF',750000,(SELECT id FROM branches WHERE code='KGL001')),
((SELECT id FROM users WHERE email='marie@example.com'),'1000000003','savings','RWF',5800000,(SELECT id FROM branches WHERE code='NYR001')),
((SELECT id FROM users WHERE email='pierre@example.com'),'1000000004','savings','RWF',320000,(SELECT id FROM branches WHERE code='MSZ001'));

INSERT INTO transactions(reference,sender_account_id,receiver_account_id,amount,type,status,channel,description,fraud_score,is_flagged,created_at,completed_at) VALUES
('TXN0000000001',(SELECT id FROM accounts WHERE account_number='1000000001'),(SELECT id FROM accounts WHERE account_number='1000000003'),50000,'transfer','completed','web','Monthly rent payment',0.05,FALSE,NOW()-INTERVAL '2 days',NOW()-INTERVAL '2 days'),
('TXN0000000002',NULL,(SELECT id FROM accounts WHERE account_number='1000000001'),200000,'deposit','completed','teller','Cash deposit',0.02,FALSE,NOW()-INTERVAL '5 days',NOW()-INTERVAL '5 days'),
('TXN0000000003',(SELECT id FROM accounts WHERE account_number='1000000003'),(SELECT id FROM accounts WHERE account_number='1000000004'),1500000,'transfer','flagged','mobile','Large transfer',0.82,TRUE,NOW()-INTERVAL '1 day',NULL);

INSERT INTO fraud_cases(transaction_id,account_id,user_id,status,severity,ai_score,ai_reason,ai_model_version) VALUES
((SELECT id FROM transactions WHERE reference='TXN0000000003'),(SELECT id FROM accounts WHERE account_number='1000000003'),(SELECT id FROM users WHERE email='marie@example.com'),'open','high',0.82,ARRAY['Large amount >5M RWF','Unusual hours','Rapid transaction velocity'],'RandomForest_v1.0');

INSERT INTO loans(user_id,loan_type,status,principal_amount,interest_rate,duration_months,monthly_payment,total_repayable,outstanding_balance,ai_credit_score,ai_risk_level,ai_recommendation) VALUES
((SELECT id FROM users WHERE email='jean@example.com'),'personal','applied',500000,0.18,12,45729.17,548750,500000,720,'low','Score 720: favorable terms at 18% p.a.');

INSERT INTO notifications(user_id,type,title,body) VALUES
((SELECT id FROM users WHERE email='jean@example.com'),'transaction','Transfer Successful','50,000 RWF sent to Marie Uwase'),
((SELECT id FROM users WHERE email='jean@example.com'),'loan_update','Loan Application Received','Personal loan of 500,000 RWF is under review. AI Score: 720'),
((SELECT id FROM users WHERE email='marie@example.com'),'fraud_alert','Suspicious Transaction Detected','A large transfer was flagged by our AI fraud detection system. Score: 82%. Our team will contact you within 24 hours.');

DO $$ BEGIN
  RAISE NOTICE '=== SmartBank AI Schema v3 Ready ===';
  RAISE NOTICE 'Admin:    admin@smartbank.rw  / Admin@123456';
  RAISE NOTICE 'Customer: jean@example.com   / Staff@123456';
END $$;
