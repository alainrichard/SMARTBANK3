const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const speakeasy= require('speakeasy');
const qrcode   = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../config/database');
const { sendEmail, templates } = require('../services/notificationService');

const genTokens = (userId) => ({
  accessToken:  jwt.sign({ userId }, process.env.JWT_SECRET,         { expiresIn: process.env.JWT_EXPIRES_IN  || '2h' }),
  refreshToken: jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }),
});
const genOTP = (n=6) => Array.from({length:n}, ()=>Math.floor(Math.random()*10)).join('');

exports.register = async (req, res) => {
  const { first_name, last_name, email, phone, national_id, date_of_birth } = req.body;
  if (!first_name || !last_name || !email)
    return res.status(400).json({ success: false, message: 'Required: first_name, last_name, email' });
  if (!national_id)
    return res.status(400).json({ success: false, message: 'National ID is required for account opening' });

  // Check documents uploaded
  const passportPhoto = req.files?.passport_photo?.[0];
  const idDocument    = req.files?.id_document?.[0];
  if (!passportPhoto)
    return res.status(400).json({ success: false, message: 'Live passport photo is required' });
  if (!idDocument)
    return res.status(400).json({ success: false, message: 'ID document upload is required' });

  // Check duplicate
  const exists = await query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
  if (exists.rows.length) return res.status(409).json({ success: false, message: 'Email already registered' });
  const nidExists = await query('SELECT id FROM users WHERE national_id=$1', [national_id]);
  if (nidExists.rows.length) return res.status(409).json({ success: false, message: 'National ID already registered' });

  const path = require('path');
  const passportUrl = `/uploads/kyc/${passportPhoto.filename}`;
  const idDocUrl    = `/uploads/kyc/${idDocument.filename}`;

  // Create user in pending_approval state (NO password yet — given only after approval)
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO users(first_name,last_name,email,phone,national_id,date_of_birth,role,status,
        kyc_passport_photo,kyc_id_document,kyc_status,kyc_verified,password_hash)
       VALUES($1,$2,$3,$4,$5,$6,'customer','pending_approval',$7,$8,'pending',FALSE,'__PENDING__')
       RETURNING id,first_name,last_name,email,role,status,kyc_status`,
      [first_name, last_name, email.toLowerCase(), phone || null, national_id,
       date_of_birth || null, passportUrl, idDocUrl]
    );
    const user = rows[0];

    // Notify all admins and branch managers about new KYC pending
    const admins = await client.query(
      `SELECT id, email, first_name FROM users WHERE role IN ('super_admin','branch_manager') AND status='active'`
    );
    for (const admin of admins.rows) {
      await client.query(
        `INSERT INTO notifications(user_id,type,title,body,metadata) VALUES($1,'account_update','New KYC Application',$2,$3)`,
        [admin.id, `New account application from ${first_name} ${last_name} (${email}) is pending KYC review.`, JSON.stringify({type:'kyc_review',applicant_id:user.id,applicant_name:`${first_name} ${last_name}`,applicant_email:email})]
      );
    }

    await client.query(
      `INSERT INTO audit_logs(action,entity,new_value) VALUES('kyc_application','users',$1)`,
      [JSON.stringify({ email, national_id, name: `${first_name} ${last_name}` })]
    );
    await client.query('COMMIT');

    // Notify applicant that application received
    const appEmail = templates.kycSubmitted({ first_name, last_name, email });
    sendEmail(email, appEmail.subject, appEmail.html);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully. You will receive login credentials by email after KYC approval by our team.',
      data: { status: 'pending_approval', email }
    });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
};

exports.approveKYC = async (req, res) => {
  // Branch managers can only approve KYC for users in their own branch
  if (req.user.role === 'branch_manager' && req.user.branch_id) {
    const { rows: check } = await query(
      'SELECT id FROM users WHERE id=$1 AND (branch_id=$2 OR preferred_branch_id=$2)',
      [req.body.user_id, req.user.branch_id]
    );
    if (!check.length)
      return res.status(403).json({ success:false, message:'This applicant does not belong to your branch.' });
  }
  const { user_id, reject_reason } = req.body;
  const action = req.path.includes('reject') ? 'reject' : 'approve';

  const { rows: users } = await query(
    'SELECT * FROM users WHERE id=$1 AND status=$2', [user_id, 'pending_approval']
  );
  if (!users.length) return res.status(404).json({ success: false, message: 'Pending user not found' });
  const user = users[0];

  if (action === 'reject') {
    await query(
      `UPDATE users SET status='inactive', kyc_status='rejected', kyc_reject_reason=$1,
       kyc_reviewed_by=$2, kyc_reviewed_at=NOW() WHERE id=$3`,
      [reject_reason || 'Documents not acceptable', req.user.id, user_id]
    );
    const em = templates.kycRejected(user, reject_reason);
    sendEmail(user.email, em.subject, em.html);
    await query(`INSERT INTO audit_logs(user_id,action,entity,entity_id,new_value) VALUES($1,'kyc_reject','users',$2,$3)`,
      [req.user.id, user_id, JSON.stringify({ reason: reject_reason })]);
    return res.json({ success: true, message: 'KYC rejected. Applicant notified.' });
  }

  // APPROVE — generate unique account number, temp password, activate user
  const crypto = require('crypto');
  const bcrypt = require('bcryptjs');
  const tempPassword = crypto.randomBytes(5).toString('hex').toUpperCase() + '@' + Math.floor(Math.random() * 900 + 100);

  // Generate unique account number using DB function
  const accRes = await query('SELECT generate_account_number() as num');
  const accNum = accRes.rows[0].num;

  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Activate user with temp password
    await client.query(
      `UPDATE users SET status='active', kyc_verified=TRUE, kyc_status='approved',
       kyc_reviewed_by=$1, kyc_reviewed_at=NOW(), password_hash=$2, temp_password=$3
       WHERE id=$4`,
      [req.user.id, passwordHash, tempPassword, user_id]
    );

    // Create savings account with unique number
    await client.query(
      `INSERT INTO accounts(user_id,account_number,account_type,currency,balance,status)
       VALUES($1,$2,'savings','RWF',0,'active')`,
      [user_id, accNum]
    );

    // Notify the new customer
    await client.query(
      `INSERT INTO notifications(user_id,type,title,body) VALUES($1,'account_update','Account Approved!',$2)`,
      [user_id, `Your account has been approved. Account number: ${accNum}. Check your email for login credentials.`]
    );

    await client.query('COMMIT');

    // Send approval email with ONE-TIME credentials
    const em = templates.kycApproved(user, accNum, tempPassword);
    sendEmail(user.email, em.subject, em.html);

    await query(`INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,'kyc_approve','users',$2)`,
      [req.user.id, user_id]);

    res.json({
      success: true,
      message: `Account approved. Credentials sent to ${user.email}. Account: ${accNum}`,
      data: { account_number: accNum }
    });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
};

exports.getPendingKYC = async (req, res) => {
  const { rows } = await query(
    `SELECT id, first_name, last_name, email, phone, national_id, date_of_birth,
            kyc_passport_photo, kyc_id_document, kyc_status, created_at
     FROM users WHERE status='pending_approval' ORDER BY created_at DESC`
  );
  res.json({ success: true, data: { applications: rows } });
};


exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password required' });
  try {
    const { rows } = await query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    if (!rows.length)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const user = rows[0];

    // Check account lock
    if (user.locked_until && new Date(user.locked_until) > new Date())
      return res.status(423).json({ success: false, message: 'Account locked after too many failed attempts. Try again later.' });

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const cnt = (user.failed_login_count || 0) + 1;
      await query('UPDATE users SET failed_login_count=$1, locked_until=$2 WHERE id=$3',
        [cnt, cnt >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null, user.id]).catch(() => {});
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status === 'suspended')
      return res.status(403).json({ success: false, message: 'Account suspended. Contact your branch.' });

    // ── STEP 1: Credentials matched → send email OTP ──────────────
    // Invalidate any previous unused login OTPs for this user
    await query("UPDATE otp_tokens SET is_used=TRUE WHERE user_id=$1 AND purpose='login_otp' AND is_used=FALSE",
      [user.id]).catch(() => {});

    // Generate and store new OTP
    const otp = genOTP(6);
    await query(
      "INSERT INTO otp_tokens(user_id,token,purpose,expires_at) VALUES($1,$2,'login_otp',NOW()+INTERVAL '10 minutes')",
      [user.id, otp]
    );

    // Send OTP email
    try {
      const em = templates.otp(user, otp, 'Login Verification');
      await sendEmail(user.email, em.subject, em.html);
      console.log('[Login] OTP sent to', user.email);
    } catch (emailErr) {
      console.error('[Login] Failed to send OTP email:', emailErr.message);
    }

    // Return: credentials OK, OTP sent — frontend now shows OTP step
    return res.json({
      success: true,
      requires_otp: true,
      message: 'OTP sent to your email. Enter it to complete login.',
      email: user.email,
      // Dev-only: expose OTP in response for testing (remove in production)
      ...(process.env.NODE_ENV === 'development' ? { _dev_otp: otp } : {}),
    });

  } catch (err) {
    console.error('[Login] Error:', err.message);
    return res.status(500).json({ success: false, message: 'Login error: ' + err.message });
  }
};

// ── STEP 2: Verify email OTP and complete login ────────────────
exports.verifyLoginOTP = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ success: false, message: 'Email and OTP are required' });

  try {
    const { rows: users } = await query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    if (!users.length)
      return res.status(404).json({ success: false, message: 'User not found' });

    const user = users[0];

    // Check OTP is valid, unused, not expired
    const { rows: tokens } = await query(
      "SELECT id FROM otp_tokens WHERE user_id=$1 AND token=$2 AND purpose='login_otp' AND is_used=FALSE AND expires_at > NOW()",
      [user.id, otp.toString().trim()]
    );

    if (!tokens.length)
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP. Request a new one.' });

    // Mark OTP as used
    await query('UPDATE otp_tokens SET is_used=TRUE WHERE id=$1', [tokens[0].id]);

    // Update login record
    await query(
      'UPDATE users SET failed_login_count=0, locked_until=NULL, last_login_at=NOW(), last_login_ip=$1 WHERE id=$2',
      [req.ip, user.id]
    ).catch(() => {});

    // Audit log
    await query(
      "INSERT INTO audit_logs(user_id,action,entity,ip_address,user_agent) VALUES($1,'login','users',$2,$3)",
      [user.id, req.ip, req.headers['user-agent']]
    ).catch(() => {});

    // Generate session tokens
    const sessionTokens = genTokens(user.id);
    await query('UPDATE users SET refresh_token=$1 WHERE id=$2', [sessionTokens.refreshToken, user.id]).catch(() => {});

    const { password_hash, two_fa_secret, refresh_token, ...safe } = user;
    return res.json({
      success: true,
      message: 'Login successful',
      data: { user: safe, ...sessionTokens },
    });

  } catch (err) {
    console.error('[VerifyOTP] Error:', err.message);
    return res.status(500).json({ success: false, message: 'Verification error: ' + err.message });
  }
};

// ── Resend login OTP ───────────────────────────────────────────
exports.resendLoginOTP = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ success: false, message: 'Email required' });

  try {
    const { rows } = await query(
      "SELECT id, first_name, email FROM users WHERE email=$1 AND status='active'",
      [email.toLowerCase()]
    );
    if (!rows.length)
      return res.json({ success: true, message: 'If account exists, a new OTP has been sent.' });

    const user = rows[0];

    // Invalidate old OTPs
    await query("UPDATE otp_tokens SET is_used=TRUE WHERE user_id=$1 AND purpose='login_otp' AND is_used=FALSE", [user.id]);

    // Generate new OTP
    const otp = genOTP(6);
    await query(
      "INSERT INTO otp_tokens(user_id,token,purpose,expires_at) VALUES($1,$2,'login_otp',NOW()+INTERVAL '10 minutes')",
      [user.id, otp]
    );

    // Send email
    const em = templates.otp(user, otp, 'Login Verification');
    await sendEmail(user.email, em.subject, em.html);

    return res.json({
      success: true,
      message: 'New OTP sent to ' + user.email,
      ...(process.env.NODE_ENV === 'development' ? { _dev_otp: otp } : {}),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error: ' + err.message });
  }
};

exports.googleCallback = async (req, res) => {
  const { google_id, email, first_name, last_name } = req.body;
  if (!google_id || !email)
    return res.status(400).json({ success:false, message:'Google ID and email required' });
  let { rows } = await query('SELECT * FROM users WHERE oauth_id=$1 AND oauth_provider=$2', [google_id, 'google']);
  if (!rows.length) {
    const result = await query(
      `INSERT INTO users(first_name,last_name,email,password_hash,oauth_provider,oauth_id,role,status,kyc_verified)
       VALUES($1,$2,$3,'oauth_google',$4,$5,'customer','active',FALSE) RETURNING *`,
      [first_name||'User', last_name||'', email.toLowerCase(), 'google', google_id]
    );
    rows = result.rows;
  }
  const user = rows[0];
  const tokens = genTokens(user.id);
  await query('UPDATE users SET refresh_token=$1,last_login_at=NOW() WHERE id=$2', [tokens.refreshToken, user.id]);
  const { password_hash, two_fa_secret, refresh_token, ...safe } = user;
  res.json({ success:true, data:{ user:safe, ...tokens } });
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ success:false, message:'Refresh token required' });
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const { rows } = await query('SELECT id, refresh_token FROM users WHERE id=$1', [decoded.userId]);
  if (!rows.length || rows[0].refresh_token !== refreshToken)
    return res.status(401).json({ success:false, message:'Invalid refresh token' });
  const tokens = genTokens(decoded.userId);
  await query('UPDATE users SET refresh_token=$1 WHERE id=$2', [tokens.refreshToken, decoded.userId]);
  res.json({ success:true, data:tokens });
};

exports.logout = async (req, res) => {
  await query('UPDATE users SET refresh_token=NULL WHERE id=$1', [req.user.id]);
  await query(`INSERT INTO audit_logs(user_id,action,entity,ip_address) VALUES($1,'logout','users',$2)`,
    [req.user.id, req.ip]);
  res.json({ success:true, message:'Logged out successfully' });
};

exports.getProfile = async (req, res) => {
  const { rows } = await query(
    `SELECT u.id,u.first_name,u.last_name,u.email,u.phone,u.role,u.status,u.kyc_verified,
            u.two_fa_enabled,u.national_id,u.date_of_birth,u.address,u.last_login_at,u.last_login_ip,u.created_at,u.profile_photo,
            b.name AS branch_name, b.code AS branch_code, b.location AS branch_location
     FROM users u LEFT JOIN branches b ON u.branch_id=b.id WHERE u.id=$1`, [req.user.id]
  );
  res.json({ success:true, data:{ user:rows[0] } });
};

exports.updateProfile = async (req, res) => {
  const { first_name, last_name, phone, address } = req.body;
  const { rows } = await query(
    `UPDATE users SET first_name=COALESCE($1,first_name),last_name=COALESCE($2,last_name),
     phone=COALESCE($3,phone),address=COALESCE($4,address),updated_at=NOW()
     WHERE id=$5 RETURNING id,first_name,last_name,email,phone,address`,
    [first_name, last_name, phone, address, req.user.id]
  );
  await query(`INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,'profile_update','users',$1)`, [req.user.id]);
  res.json({ success:true, data:{ user:rows[0] } });
};

exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  const { rows } = await query('SELECT password_hash,first_name,email FROM users WHERE id=$1', [req.user.id]);
  const valid = await bcrypt.compare(current_password, rows[0].password_hash);
  if (!valid) return res.status(400).json({ success:false, message:'Current password is incorrect' });
  if (!new_password || new_password.length < 8)
    return res.status(400).json({ success:false, message:'New password must be at least 8 characters' });
  await query('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(new_password, 12), req.user.id]);
  await query(`INSERT INTO audit_logs(user_id,action,entity) VALUES($1,'password_change','users')`, [req.user.id]);
  // Send password changed email
  const em = templates.passwordChanged(rows[0]);
  sendEmail(rows[0].email, em.subject, em.html);
  res.json({ success:true, message:'Password updated successfully' });
};

exports.setup2FA = async (req, res) => {
  const secret = speakeasy.generateSecret({ name:`SmartBank:${req.user.email}`, length:20 });
  const qr = await qrcode.toDataURL(secret.otpauth_url);
  await query('UPDATE users SET two_fa_secret=$1 WHERE id=$2', [secret.base32, req.user.id]);
  res.json({ success:true, data:{ secret:secret.base32, qrCode:qr, otpauth:secret.otpauth_url } });
};

exports.enable2FA = async (req, res) => {
  const { token } = req.body;
  const { rows } = await query('SELECT two_fa_secret FROM users WHERE id=$1', [req.user.id]);
  const ok = speakeasy.totp.verify({ secret:rows[0].two_fa_secret, encoding:'base32', token, window:1 });
  if (!ok) return res.status(400).json({ success:false, message:'Invalid 2FA code. Try again.' });
  await query('UPDATE users SET two_fa_enabled=TRUE WHERE id=$1', [req.user.id]);
  res.json({ success:true, message:'Two-factor authentication enabled' });
};

exports.disable2FA = async (req, res) => {
  const { token } = req.body;
  const { rows } = await query('SELECT two_fa_secret FROM users WHERE id=$1', [req.user.id]);
  const ok = speakeasy.totp.verify({ secret:rows[0].two_fa_secret, encoding:'base32', token, window:1 });
  if (!ok) return res.status(400).json({ success:false, message:'Invalid 2FA code' });
  await query('UPDATE users SET two_fa_enabled=FALSE WHERE id=$1', [req.user.id]);
  res.json({ success:true, message:'2FA disabled' });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const { rows } = await query('SELECT id,first_name FROM users WHERE email=$1', [email?.toLowerCase()]);
  if (!rows.length) return res.json({ success:true, message:'If account exists, OTP has been sent.' });
  const otp = genOTP(6);
  await query(`INSERT INTO otp_tokens(user_id,token,purpose,expires_at) VALUES($1,$2,'reset_password',NOW()+INTERVAL '10 minutes')`,
    [rows[0].id, otp]);
  console.log(`[SmartBank] Password reset OTP for ${email}: ${otp}`);
  // Send OTP email
  const em = templates.otp(rows[0], otp, 'Password Reset');
  sendEmail(email, em.subject, em.html);
  res.json({ success:true, message:'OTP sent to email address', _dev_otp: process.env.NODE_ENV==='development' ? otp : undefined });
};

exports.resetPassword = async (req, res) => {
  const { email, otp, new_password } = req.body;
  const { rows: users } = await query('SELECT id FROM users WHERE email=$1', [email?.toLowerCase()]);
  if (!users.length) return res.status(404).json({ success:false, message:'User not found' });
  const { rows: tokens } = await query(
    `SELECT id FROM otp_tokens WHERE user_id=$1 AND token=$2 AND purpose='reset_password' AND is_used=FALSE AND expires_at>NOW()`,
    [users[0].id, otp]
  );
  if (!tokens.length) return res.status(400).json({ success:false, message:'Invalid or expired OTP' });
  if (!new_password || new_password.length < 8)
    return res.status(400).json({ success:false, message:'Password must be at least 8 characters' });
  await query('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(new_password, 12), users[0].id]);
  await query('UPDATE otp_tokens SET is_used=TRUE WHERE id=$1', [tokens[0].id]);
  res.json({ success:true, message:'Password reset successful. Please login.' });
};
