const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
  return _transporter;
}

const YEAR = new Date().getFullYear();

function base(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#eef1f8;font-family:Helvetica,Arial,sans-serif}@media(max-width:600px){.wrap{padding:0!important}.card{border-radius:0!important}}</style></head><body><div class="wrap" style="max-width:580px;margin:0 auto"><div class="card" style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(10,15,30,.09);overflow:hidden"><div style="background:#0a0f1e;padding:24px 32px"><table width="100%" cellpadding="0" cellspacing="0"><tr><td><div style="display:inline-flex;align-items:center;gap:10px"><div style="width:36px;height:36px;background:linear-gradient(135deg,#c9a84c,#f0c96e);border-radius:9px;text-align:center;line-height:36px;font-weight:800;font-size:15px;color:#0a0f1e;display:inline-block">S</div>&nbsp;<span style="font-size:16px;font-weight:700;color:#fff">SmartBank AI</span></div></td></tr><tr><td style="padding-top:16px"><p style="font-size:22px;font-weight:700;color:#fff;margin:0">${title}</p></td></tr></table></div><div style="padding:28px 32px">${body}</div><div style="background:#f4f6fb;padding:18px 32px;border-top:1px solid #dde2ef"><p style="font-size:12px;color:#7b88a8;margin:0">Automated message from SmartBank AI. Questions? <a href="mailto:support@smartbank.rw" style="color:#3b5bdb">support@smartbank.rw</a> | +250 780 000 001</p><p style="font-size:11px;color:#b0bbd0;margin:8px 0 0">&copy; ${YEAR} SmartBank AI &mdash; Kigali, Rwanda</p></div></div></div></body></html>`;
}

function row(label, value) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #f0f0f0"><tr><td style="padding:9px 0;font-size:13px;color:#7b88a8;width:40%">${label}</td><td style="padding:9px 0;font-size:13px;font-weight:600;color:#0a0f1e;text-align:right">${value}</td></tr></table>`;
}

function box(bg, border, content) {
  return `<div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:16px;margin:14px 0">${content}</div>`;
}

function p(text) {
  return `<p style="font-size:14px;color:#3d4a6b;line-height:1.7;margin:0 0 14px">${text}</p>`;
}

const templates = {
  welcome: (user, acct) => ({
    subject: `Welcome to SmartBank AI, ${user.first_name}!`,
    html: base('Welcome to SmartBank AI!',
      p(`Hello <strong>${user.first_name}</strong>,`) +
      p('Your account is ready. You now have access to AI-powered banking, fraud detection, credit scoring and real-time financial insights.') +
      box('#f4f6fb','#dde2ef',
        `<p style="font-size:11px;font-weight:700;color:#7b88a8;text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px">Account Details</p>` +
        row('Full Name', `${user.first_name} ${user.last_name}`) +
        row('Email', user.email) +
        row('Account Number', `<code style="font-family:monospace;background:#e2e8f0;padding:2px 7px;border-radius:4px">${acct}</code>`) +
        row('Account Type', 'Savings (RWF)')
      ) +
      p('Log in at <a href="http://localhost:3000" style="color:#3b5bdb;font-weight:600">SmartBank AI</a> to explore your dashboard.')
    )
  }),

  login: (user, ip, time) => ({
    subject: 'New sign-in to your SmartBank account',
    html: base('New Login Detected',
      p(`Hello <strong>${user.first_name}</strong>,`) +
      p('A new sign-in was recorded on your SmartBank AI account.') +
      box('#f4f6fb','#dde2ef',
        `<p style="font-size:11px;font-weight:700;color:#7b88a8;text-transform:uppercase;margin:0 0 10px">Login Details</p>` +
        row('Time', time) +
        row('IP Address', `<code style="font-family:monospace;background:#e2e8f0;padding:2px 6px;border-radius:4px">${ip}</code>`)
      ) +
      box('#fff5f5','#fecaca',`<p style="color:#991b1b;font-size:13px;margin:0"><strong>Not you?</strong> Change your password immediately and enable 2FA in Settings.</p>`)
    )
  }),

  otp: (user, otp, purpose) => ({
    subject: `Your SmartBank OTP: ${otp}`,
    html: base('Verification Code',
      p(`Hello <strong>${user.first_name}</strong>,`) +
      p(`Your verification code for <strong>${purpose || 'SmartBank AI'}</strong>:`) +
      `<div style="text-align:center;margin:24px 0"><div style="display:inline-block;background:#0a0f1e;color:#f0c96e;font-size:40px;font-weight:800;letter-spacing:16px;padding:20px 32px;border-radius:14px;font-family:'Courier New',monospace">${otp}</div></div>` +
      box('#fffbeb','#fde68a',`<p style="color:#92400e;font-size:13px;margin:0">Expires in <strong>10 minutes</strong>. Never share this code with anyone including SmartBank staff.</p>`)
    )
  }),

  transaction: (user, txn) => ({
    subject: `${txn.type === 'deposit' ? 'Deposit Received' : 'Transfer Sent'}: ${Number(txn.amount).toLocaleString()} RWF`,
    html: base(txn.type === 'deposit' ? 'Deposit Received' : 'Transfer Sent',
      p(`Hello <strong>${user.first_name}</strong>, your transaction has been processed.`) +
      box('#f4f6fb','#dde2ef',
        `<p style="font-size:11px;font-weight:700;color:#7b88a8;text-transform:uppercase;margin:0 0 10px">Transaction Details</p>` +
        row('Reference', `<code style="font-family:monospace;background:#e2e8f0;padding:2px 6px;border-radius:4px;font-size:12px">${txn.reference}</code>`) +
        row('Amount', `<span style="color:#0d9488;font-weight:700">${Number(txn.amount).toLocaleString()} RWF</span>`) +
        row('Type', (txn.type || '').replace(/_/g,' ')) +
        row('Status', txn.status) +
        (txn.description ? row('Note', txn.description) : '')
      ) +
      (txn.is_flagged ? box('#fff5f5','#fecaca',`<p style="color:#991b1b;font-size:13px;margin:0">This transaction was flagged by our AI fraud detection and is under review by our security team.</p>`) : '')
    )
  }),

  fraudAlert: (user, txn, score) => ({
    subject: 'ALERT: Suspicious Transaction Detected',
    html: base('Fraud Alert',
      p(`Hello <strong>${user.first_name}</strong>,`) +
      box('#fff5f5','#dc2626',
        `<p style="font-size:16px;font-weight:700;color:#dc2626;margin:0 0 8px">Suspicious activity detected</p>` +
        `<p style="color:#991b1b;font-size:13px;margin:0">AI risk score: <strong>${(score*100).toFixed(0)}%</strong>. Transaction held for review.</p>`
      ) +
      box('#f4f6fb','#dde2ef',
        row('Amount', `${Number(txn.amount||0).toLocaleString()} RWF`) +
        row('Reference', `<code style="font-family:monospace">${txn.reference||'—'}</code>`) +
        row('AI Risk Score', `<strong style="color:#dc2626">${(score*100).toFixed(0)}%</strong>`)
      ) +
      p('If you authorised this, no action needed. If not, call <strong>+250 780 000 001</strong> immediately.')
    )
  }),

  loanUpdate: (user, loan) => ({
    subject: `Loan ${loan.status.charAt(0).toUpperCase()+loan.status.slice(1)}: ${Number(loan.principal_amount).toLocaleString()} RWF`,
    html: base('Loan Application Update',
      p(`Hello <strong>${user.first_name}</strong>, your loan application has been updated.`) +
      box(
        loan.status==='approved'?'#f0fdf4':loan.status==='rejected'?'#fff5f5':'#eff6ff',
        loan.status==='approved'?'#bbf7d0':loan.status==='rejected'?'#fecaca':'#bfdbfe',
        `<p style="font-size:18px;font-weight:700;color:${loan.status==='approved'?'#166534':loan.status==='rejected'?'#991b1b':'#1e40af'};margin:0 0 10px">` +
        (loan.status==='approved'?'Approved':loan.status==='rejected'?'Rejected':'Under Review') + `</p>` +
        row('Amount', `${Number(loan.principal_amount).toLocaleString()} RWF`) +
        row('Type', loan.loan_type) +
        row('Duration', `${loan.duration_months} months`) +
        row('AI Score', loan.ai_credit_score||'—') +
        row('Risk Level', loan.ai_risk_level||'—') +
        (loan.ai_recommendation?`<p style="font-size:13px;color:#3d4a6b;margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0">${loan.ai_recommendation}</p>`:'')
      )
    )
  }),


  kycSubmitted: (user) => ({
    subject: 'SmartBank AI — Account Application Received',
    html: base('Application Received',
      p(`Hello <strong>${user.first_name} ${user.last_name}</strong>,`) +
      p('Your account application has been received and is now under review by our KYC team.') +
      box('#f4f6fb','#dde2ef',
        `<p style="font-size:11px;font-weight:700;color:#7b88a8;text-transform:uppercase;margin:0 0 10px">Application Details</p>` +
        row('Name', `${user.first_name} ${user.last_name}`) +
        row('Email', user.email) +
        row('Status', '<span style="color:#d97706;font-weight:700">Pending Review</span>')
      ) +
      p('Our team will review your documents within <strong>1-2 business days</strong>. Once approved, you will receive your account number and one-time login credentials by email.') +
      box('#fffbeb','#fde68a', `<p style="color:#92400e;font-size:13px;margin:0"><strong>What happens next:</strong><br>1. KYC team reviews your documents<br>2. Branch manager verifies identity<br>3. Account approved — credentials sent to this email</p>`)
    )
  }),

  kycApproved: (user, accountNumber, tempPassword) => ({
    subject: 'SmartBank AI — Account Approved! Your Login Credentials',
    html: base('Account Approved!',
      p(`Congratulations <strong>${user.first_name} ${user.last_name}</strong>!`) +
      p('Your SmartBank AI account has been <strong>approved</strong> and is ready to use.') +
      `<div style="background:#0a0f1e;border-radius:14px;padding:24px 28px;margin:18px 0;text-align:center">
        <p style="font-size:12px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px">Your Account Number</p>
        <p style="font-size:36px;font-weight:800;color:#f0c96e;letter-spacing:4px;font-family:'Courier New',monospace;margin:0">${accountNumber}</p>
      </div>` +
      box('#fff5f5','#fecaca',
        `<p style="color:#dc2626;font-size:14px;font-weight:700;margin:0 0 10px">One-Time Login Credentials</p>` +
        `<p style="color:#991b1b;font-size:13px;margin:0 0 8px">Use these credentials to log in for the <strong>first time only</strong>. You will be required to change your password immediately after logging in.</p>` +
        row('Email', user.email) +
        row('Temporary Password', `<code style="font-family:monospace;background:#fecaca;padding:4px 10px;border-radius:6px;font-size:16px;font-weight:700;letter-spacing:2px">${tempPassword}</code>`)
      ) +
      box('#fffbeb','#fde68a',`<p style="color:#92400e;font-size:13px;margin:0">This password is for <strong>one-time use only</strong>. After logging in, you will be prompted to set a new secure password. Do not share this with anyone.</p>`) +
      p('Log in at <a href="http://localhost:3001" style="color:#3b5bdb;font-weight:600">SmartBank AI</a> to get started.')
    )
  }),

  kycRejected: (user, reason) => ({
    subject: 'SmartBank AI — Account Application Update',
    html: base('Application Status Update',
      p(`Hello <strong>${user.first_name} ${user.last_name}</strong>,`) +
      p('We have reviewed your account application and unfortunately cannot proceed at this time.') +
      box('#fff5f5','#fecaca',
        `<p style="font-size:15px;font-weight:700;color:#dc2626;margin:0 0 8px">Application Not Approved</p>` +
        `<p style="color:#991b1b;font-size:13px;margin:0"><strong>Reason:</strong> ${reason || 'Documents could not be verified. Please ensure your ID and photo are clear and valid.'}</p>`
      ) +
      p('You may <strong>reapply</strong> with updated documents. Please ensure:<br>• Your passport photo is clear and taken in good lighting<br>• Your ID document is valid and all text is legible<br>• All personal information matches your ID exactly') +
      p('Contact us at <a href="mailto:support@smartbank.rw" style="color:#3b5bdb">support@smartbank.rw</a> if you have questions.')
    )
  }),
  passwordChanged: (user) => ({
    subject: 'Your SmartBank password was changed',
    html: base('Password Changed',
      p(`Hello <strong>${user.first_name}</strong>, your password was changed on <strong>${new Date().toLocaleString()}</strong>.`) +
      box('#fff5f5','#fecaca',`<p style="color:#991b1b;font-size:13px;margin:0">Not you? Contact support at support@smartbank.rw or +250 780 000 001 immediately.</p>`)
    )
  }),
};

async function sendEmail(to, subject, html) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.log(`[Email stub] To: ${to} | Subject: ${subject}`);
    return true;
  }
  try {
    const info = await getTransporter().sendMail({
      from: process.env.SMTP_FROM || `SmartBank AI <${user}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email sent] ${subject} -> ${to} (${info.messageId})`);
    return true;
  } catch (err) {
    console.error('[Email error]', err.message);
    // Reset transporter on error so it retries next time
    _transporter = null;
    return false;
  }
}

module.exports = { sendEmail, templates };
