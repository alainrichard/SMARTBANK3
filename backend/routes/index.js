const router  = require('express').Router();
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { authenticate, authorize } = require('../middleware/auth');
const auth = require('../controllers/authController');
const txn  = require('../controllers/transactionController');
const ctrl = require('../controllers/allControllers');

const ADMIN = ['super_admin','branch_manager'];
const STAFF = ['super_admin','branch_manager','bank_staff'];
const FRAUD = ['super_admin','branch_manager','fraud_analyst'];
const ALL_A = ['super_admin','branch_manager','fraud_analyst','auditor'];

// ── Multer setup (ALL at top before any routes) ───────────────

// Profile photos
const profileDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, profileDir),
    filename:    (req, file, cb) => cb(null, `${req.user.id}_${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5_000_000 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images only')),
});

// Loan documents
const loanDir = path.join(__dirname, '../uploads/loans');
if (!fs.existsSync(loanDir)) fs.mkdirSync(loanDir, { recursive: true });
const loanUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, loanDir),
    filename:    (req, file, cb) => cb(null, `${req.user.id}_${Date.now()}_${file.fieldname}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10_000_000 },
});

// KYC documents (register + admin staff creation)
const kycDir = path.join(__dirname, '../uploads/kyc');
if (!fs.existsSync(kycDir)) fs.mkdirSync(kycDir, { recursive: true });
const kycUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, kycDir),
    filename:    (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-z0-9.]/gi, '_');
      cb(null, `kyc_${Date.now()}_${Math.random().toString(36).slice(2)}_${safe}`);
    },
  }),
  limits: { fileSize: 15_000_000 },
  fileFilter: (req, file, cb) =>
    (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf')
      ? cb(null, true) : cb(new Error('Images and PDFs only')),
});

// ── AUTH ──────────────────────────────────────────────────────
router.post('/auth/login',            auth.login);
router.post('/auth/verify-login-otp',  auth.verifyLoginOTP);
router.post('/auth/resend-login-otp',  auth.resendLoginOTP);
router.post('/auth/register',
  kycUpload.fields([{ name: 'passport_photo', maxCount: 1 }, { name: 'id_document', maxCount: 1 }]),
  auth.register
);
router.post('/auth/google',          auth.googleCallback);
router.post('/auth/refresh',         auth.refreshToken);
router.post('/auth/logout',          authenticate, auth.logout);
router.post('/auth/forgot-password', auth.forgotPassword);
router.post('/auth/reset-password',  auth.resetPassword);
router.post('/auth/setup-2fa',       authenticate, auth.setup2FA);
router.post('/auth/enable-2fa',      authenticate, auth.enable2FA);
router.post('/auth/disable-2fa',     authenticate, auth.disable2FA);
router.post('/auth/change-password', authenticate, auth.changePassword);

// ── PROFILE ───────────────────────────────────────────────────
router.get('/profile',  authenticate, auth.getProfile);
router.put('/profile',  authenticate, auth.updateProfile);
router.post('/profile/photo', authenticate, photoUpload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const url = `/uploads/profiles/${req.file.filename}`;
  await require('../config/database').query('UPDATE users SET profile_photo=$1 WHERE id=$2', [url, req.user.id]);
  res.json({ success: true, data: { photo_url: url } });
});

// ── ACCOUNTS & TRANSACTIONS ───────────────────────────────────
router.get('/accounts',                   authenticate, txn.getAccounts);
router.get('/accounts/verify',            authenticate, txn.verifyAccount);
router.get('/accounts/:id/statement',     authenticate, txn.getStatement);
router.post('/transactions/transfer',     authenticate, txn.transfer);
router.post('/transactions/deposit',      authenticate, authorize(...STAFF), txn.deposit);
router.get('/transactions',               authenticate, txn.getMyTransactions);
router.get('/transactions/all',           authenticate, authorize(...ALL_A), txn.getAllTransactions);

// ── BILLS ─────────────────────────────────────────────────────
router.get('/bills/billers', authenticate, (req, res) => res.json({ success: true, data: { billers: [
  { code: 'RECO',   name: 'Rwanda Energy (RECO)',     category: 'Electricity' },
  { code: 'WASAC',  name: 'WASAC Water',              category: 'Water'       },
  { code: 'MTN',    name: 'MTN Data Bundle',          category: 'Internet'    },
  { code: 'AIRTEL', name: 'Airtel Rwanda',            category: 'Mobile'      },
  { code: 'DSTV',   name: 'DStv Subscription',        category: 'TV'          },
  { code: 'RRA',    name: 'Rwanda Revenue Authority', category: 'Tax'         },
  { code: 'RSSB',   name: 'RSSB Pension & Health',    category: 'Insurance'   },
  { code: 'SCHOOL', name: 'School / University Fees', category: 'Education'   },
]}}));
router.post('/bills/pay',    authenticate, txn.payBill);
router.get('/bills/history', authenticate, txn.getBillHistory);

// ── LOANS ─────────────────────────────────────────────────────
router.post('/loans/apply',
  authenticate,
  loanUpload.fields([
    { name: 'id_document',   maxCount: 1 },
    { name: 'income_proof',  maxCount: 1 },
    { name: 'business_plan', maxCount: 1 },
    { name: 'collateral_doc',maxCount: 1 },
  ]),
  ctrl.applyLoan
);
router.get('/loans',             authenticate, ctrl.getMyLoans);
router.get('/loans/all',         authenticate, authorize(...ADMIN), ctrl.getAllLoans);
router.put('/loans/:id/review',  authenticate, authorize(...ADMIN), ctrl.reviewLoan);

// ── FRAUD ─────────────────────────────────────────────────────
router.get('/fraud/cases',       authenticate, authorize(...FRAUD), ctrl.getFraudCases);
router.put('/fraud/cases/:id',   authenticate, authorize(...FRAUD), ctrl.updateFraudCase);
router.post('/fraud/freeze',     authenticate, authorize(...FRAUD), ctrl.freezeAccount);
router.post('/fraud/unfreeze',   authenticate, authorize(...FRAUD), ctrl.unfreezeAccount);
router.get('/fraud/stats',       authenticate, authorize(...FRAUD), ctrl.getFraudStats);

// ── CHATBOT ───────────────────────────────────────────────────
router.post('/chatbot/message',        authenticate, ctrl.chatMessage);
router.get('/chatbot/sessions',        authenticate, ctrl.getChatSessions);
router.get('/chatbot/sessions/:id',    authenticate, ctrl.getChatHistory);
router.delete('/chatbot/sessions/:id', authenticate, ctrl.deleteChatSession);

// ── NOTIFICATIONS ─────────────────────────────────────────────
router.get('/notifications',          authenticate, ctrl.getNotifications);
router.put('/notifications/read-all', authenticate, ctrl.markAllRead);
router.put('/notifications/:id/read', authenticate, ctrl.markRead);

// ── ADMIN: USERS ──────────────────────────────────────────────
router.get('/admin/users',     authenticate, authorize(...ADMIN), ctrl.getUsers);
router.get('/admin/users/:id', authenticate, authorize(...ADMIN), ctrl.getUserById);
router.post('/admin/staff',
  authenticate, authorize(...ADMIN),
  kycUpload.fields([{ name: 'passport_photo', maxCount: 1 }, { name: 'id_document', maxCount: 1 }]),
  ctrl.createStaff
);
router.put('/admin/users/:id/status', authenticate, authorize(...ADMIN), ctrl.updateUserStatus);
router.put('/admin/users/:id/kyc',    authenticate, authorize(...STAFF), ctrl.verifyKYC);
router.get('/admin/dashboard',        authenticate, authorize(...ADMIN), ctrl.getDashboardStats);

// ── ADMIN: KYC ────────────────────────────────────────────────
router.get('/admin/kyc/pending',  authenticate, authorize(...ADMIN), auth.getPendingKYC);
router.post('/admin/kyc/approve', authenticate, authorize(...ADMIN), auth.approveKYC);
router.post('/admin/kyc/reject',  authenticate, authorize(...ADMIN), auth.approveKYC);

// ── BRANCHES ─────────────────────────────────────────────────
router.get('/branches',                   authenticate, ctrl.getBranches);
router.post('/branches',                  authenticate, authorize('super_admin'), ctrl.createBranch);
router.put('/branches/:id',               authenticate, authorize('super_admin'), ctrl.updateBranch);
router.post('/branches/assign-manager',   authenticate, authorize('super_admin'), ctrl.assignBranchManager);
router.get('/branches/:branch_id/report', authenticate, authorize(...ADMIN), ctrl.getBranchReport);

// ── AUDIT LOGS ────────────────────────────────────────────────
router.get('/audit-logs', authenticate, authorize('super_admin','auditor'), ctrl.getAuditLogs);

// ── ANALYTICS & AI ────────────────────────────────────────────
router.get('/analytics/spending',          authenticate, ctrl.getSpendingAnalysis);
router.get('/analytics/credit-score',      authenticate, ctrl.getCreditScore);
router.get('/analytics/advice',            authenticate, ctrl.getFinancialAdvice);
router.get('/analytics/credit/advanced',   authenticate, ctrl.getAdvancedCredit);
router.get('/analytics/behavior',          authenticate, ctrl.getCustomerBehavior);
router.get('/analytics/planning',          authenticate, ctrl.getFinancialPlanning);
router.get('/analytics/liquidity',         authenticate, authorize(...ADMIN), ctrl.getLiquidity);
router.post('/analytics/compliance/check', authenticate, ctrl.complianceCheck);
router.get('/analytics/ai-status',         authenticate, authorize('super_admin'), ctrl.getModelStatus);
router.post('/analytics/retrain',          authenticate, authorize('super_admin'), ctrl.retrainModels);

// ── KYC UPLOADS (serve files) ─────────────────────────────────
router.use('/uploads/kyc', authenticate, authorize(...ADMIN), express.static(kycDir));

module.exports = router;
