const { query, getClient } = require('../config/database');
const axios = require('axios');
const { sendEmail, templates } = require('../services/notificationService');

const ai = async (path, data={}, method='POST') => {
  try {
    const url = `${process.env.AI_SERVICE_URL||'http://localhost:8000'}${path}`;
    const r = method==='GET' ? await axios.get(url,{timeout:4000}) : await axios.post(url,data,{timeout:4000});
    return r.data;
  } catch { return null; }
};

// ── FRAUD ──────────────────────────────────────────────────────
exports.getFraudCases = async (req, res) => {
  const { status, severity, page=1, limit=20 } = req.query;
  let where='WHERE 1=1'; const params=[]; let i=1;
  if (status)   { where+=` AND fc.status=$${i++}`;   params.push(status); }
  if (severity) { where+=` AND fc.severity=$${i++}`; params.push(severity); }
  const { rows } = await query(
    `SELECT fc.*, u.first_name||' '||u.last_name AS customer_name, u.email AS customer_email,
            a.account_number, t.amount, t.reference, t.type AS txn_type,
            an.first_name||' '||an.last_name AS analyst_name
     FROM fraud_cases fc
     LEFT JOIN users u ON fc.user_id=u.id
     LEFT JOIN accounts a ON fc.account_id=a.id
     LEFT JOIN transactions t ON fc.transaction_id=t.id
     LEFT JOIN users an ON fc.assigned_analyst=an.id
     ${where} ORDER BY fc.created_at DESC LIMIT $${i++} OFFSET $${i}`,
    [...params, parseInt(limit), (parseInt(page)-1)*parseInt(limit)]
  );
  res.json({ success:true, data:{ cases:rows } });
};

exports.updateFraudCase = async (req, res) => {
  const { status, resolution_notes, severity } = req.body;
  const { rows } = await query(
    `UPDATE fraud_cases SET status=$1, resolution_notes=$2, severity=COALESCE($3,severity),
     assigned_analyst=$4, resolved_at=CASE WHEN $1 IN ('resolved_fraud','resolved_false_positive') THEN NOW() ELSE NULL END
     WHERE id=$5 RETURNING *`,
    [status, resolution_notes, severity, req.user.id, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success:false, message:'Case not found' });
  await query(`INSERT INTO audit_logs(user_id,action,entity,entity_id,ip_address) VALUES($1,$2,'fraud_cases',$3,$4)`,
    [req.user.id, `fraud_${status}`, req.params.id, req.ip]);
  res.json({ success:true, data:{ case:rows[0] } });
};

exports.freezeAccount = async (req, res) => {
  const { account_id, reason } = req.body;
  const { rows } = await query("UPDATE accounts SET status='frozen' WHERE id=$1 RETURNING *", [account_id]);
  if (!rows.length) return res.status(404).json({ success:false, message:'Account not found' });
  await query(`INSERT INTO notifications(user_id,type,title,body) VALUES($1,'account_update','Account Frozen',$2)`,
    [rows[0].user_id, `Your account ${rows[0].account_number} has been temporarily frozen. Contact support.`]);
  await query(`INSERT INTO audit_logs(user_id,action,entity,entity_id,new_value) VALUES($1,'account_frozen','accounts',$2,$3)`,
    [req.user.id, account_id, JSON.stringify({reason})]);
  res.json({ success:true, data:{ account:rows[0] } });
};

exports.unfreezeAccount = async (req, res) => {
  const { account_id } = req.body;
  const { rows } = await query("UPDATE accounts SET status='active' WHERE id=$1 RETURNING *", [account_id]);
  if (!rows.length) return res.status(404).json({ success:false, message:'Account not found' });
  await query(`INSERT INTO notifications(user_id,type,title,body) VALUES($1,'account_update','Account Reactivated','Your account has been reactivated.')`, [rows[0].user_id]);
  res.json({ success:true, data:{ account:rows[0] } });
};

exports.getFraudStats = async (req, res) => {
  const [byStatus, bySeverity, trends, topBranches] = await Promise.all([
    query("SELECT status, COUNT(*) AS count FROM fraud_cases GROUP BY status"),
    query("SELECT severity, COUNT(*) AS count, AVG(ai_score) AS avg_score FROM fraud_cases GROUP BY severity"),
    query("SELECT DATE_TRUNC('day',created_at) AS day, COUNT(*) AS count, AVG(ai_score) AS avg_score FROM fraud_cases WHERE created_at>NOW()-INTERVAL '30 days' GROUP BY day ORDER BY day"),
    query(`SELECT b.name AS branch, COUNT(fc.id) AS fraud_count FROM fraud_cases fc JOIN accounts a ON fc.account_id=a.id JOIN branches b ON a.branch_id=b.id GROUP BY b.name ORDER BY fraud_count DESC LIMIT 5`),
  ]);
  res.json({ success:true, data:{ by_status:byStatus.rows, by_severity:bySeverity.rows, trends:trends.rows, top_branches:topBranches.rows } });
};

// ── LOANS ──────────────────────────────────────────────────────
exports.applyLoan = async (req, res) => {
  const { loan_type, principal_amount, duration_months, purpose } = req.body;
  if (!loan_type||!principal_amount||!duration_months||parseFloat(principal_amount)<50000)
    return res.status(400).json({ success:false, message:'Required: loan_type, principal_amount (min 50,000), duration_months' });
  let aiScore=500, aiRisk='medium', aiRec='Standard terms apply.', aiRate=0.18;
  const aiData = await ai('/api/credit-score', { user_id:req.user.id });
  if (aiData) { aiScore=aiData.credit_score; aiRisk=aiData.risk_level; aiRec=aiData.recommendation; aiRate=aiData.recommended_interest_rate||0.18; }
  const recData = await ai('/api/loan/recommend', { user_id:req.user.id, amount:parseFloat(principal_amount), months:parseInt(duration_months), loan_type });
  const rate = recData?.interest_rate || aiRate;
  const r=rate/12, n=parseInt(duration_months);
  const monthly = r>0 ? (parseFloat(principal_amount)*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1) : parseFloat(principal_amount)/n;
  const total = monthly * n;
  // Save uploaded document URLs
  const files = req.files || {};
  const docId       = files.id_document?.[0]    ? '/uploads/loans/' + files.id_document[0].filename    : null;
  const docIncome   = files.income_proof?.[0]   ? '/uploads/loans/' + files.income_proof[0].filename   : null;
  const docBiz      = files.business_plan?.[0]  ? '/uploads/loans/' + files.business_plan[0].filename  : null;
  const docCollat   = files.collateral_doc?.[0] ? '/uploads/loans/' + files.collateral_doc[0].filename : null;
  const loanPurpose = req.body.purpose || null;
  const loanCollat  = req.body.collateral || null;

  const { rows } = await query(
    `INSERT INTO loans(user_id,loan_type,status,principal_amount,interest_rate,duration_months,monthly_payment,total_repayable,outstanding_balance,purpose,collateral,doc_id_document,doc_income_proof,doc_business_plan,doc_collateral_doc,ai_credit_score,ai_risk_level,ai_recommendation)
     VALUES($1,$2,'applied',$3,$4,$5,$6,$7,$3,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [req.user.id,loan_type,parseFloat(principal_amount),rate,duration_months,monthly.toFixed(2),total.toFixed(2),loanPurpose,loanCollat,docId,docIncome,docBiz,docCollat,aiScore,aiRisk,aiRec]
  );
  await query(`INSERT INTO notifications(user_id,type,title,body) VALUES($1,'loan_update','Loan Application Received',$2)`,
    [req.user.id, `Your ${loan_type} loan of ${parseFloat(principal_amount).toLocaleString()} RWF is under review. AI Credit Score: ${aiScore}`]);
  await query(`INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,'loan_apply','loans',$2)`, [req.user.id, rows[0].id]);
  // Send loan email
  const { rows: uRows } = await query('SELECT first_name, email FROM users WHERE id=$1', [req.user.id]);
  if (uRows.length) { const em = templates.loanUpdate(uRows[0], rows[0]); sendEmail(uRows[0].email, em.subject, em.html); }
  res.status(201).json({ success:true, data:{ loan:rows[0], ai_score:aiScore, risk:aiRisk, recommendation:aiRec } });
};

exports.getMyLoans = async (req, res) => {
  const { rows } = await query('SELECT * FROM loans WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json({ success:true, data:{ loans:rows } });
};

exports.getAllLoans = async (req, res) => {
  const { status, page=1, limit=20 } = req.query;
  let where='WHERE 1=1'; const params=[]; let i=1;
  if (status) { where+=` AND l.status=$${i++}`; params.push(status); }
  const { rows } = await query(
    `SELECT l.*, u.first_name||' '||u.last_name AS customer_name, u.email
     FROM loans l JOIN users u ON l.user_id=u.id
     ${where} ORDER BY l.created_at DESC LIMIT $${i++} OFFSET $${i}`,
    [...params, parseInt(limit), (parseInt(page)-1)*parseInt(limit)]
  );
  res.json({ success:true, data:{ loans:rows } });
};

exports.reviewLoan = async (req, res) => {
  const { status, notes } = req.body;
  if (!['approved','rejected'].includes(status))
    return res.status(400).json({ success:false, message:'Status must be approved or rejected' });
  const { rows } = await query(
    `UPDATE loans SET status=$1, approved_by=$2, updated_at=NOW(),
     disbursed_at=CASE WHEN $1='approved' THEN NOW() ELSE NULL END
     WHERE id=$3 RETURNING *`,
    [status, req.user.id, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success:false, message:'Loan not found' });
  await query(`INSERT INTO notifications(user_id,type,title,body) VALUES($1,'loan_update',$2,$3)`,
    [rows[0].user_id,
     status==='approved' ? 'Loan Approved!' : 'Loan Application Update',
     status==='approved' ? `Your ${rows[0].loan_type} loan of ${parseFloat(rows[0].principal_amount).toLocaleString()} RWF has been approved and will be disbursed shortly.`
                         : `Your loan application has been reviewed. ${notes||'Please contact your branch for details.'}`]);
  await query(`INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,$2,'loans',$3)`, [req.user.id, `loan_${status}`, req.params.id]);
  // Send loan update email to customer
  const { rows: uRows } = await query('SELECT first_name, email FROM users WHERE id=$1', [rows[0].user_id]);
  if (uRows.length) { const em = templates.loanUpdate(uRows[0], rows[0]); sendEmail(uRows[0].email, em.subject, em.html); }
  res.json({ success:true, data:{ loan:rows[0] } });
};

// ── CHATBOT ────────────────────────────────────────────────────

// ── SmartBot rule-based engine ─────────────────────────────────
function smartBotFallback(message, userName, balance) {
  const m = message.toLowerCase().trim();
  const name = userName || 'there';

  const isFr = /bonjour|comment|puis-je|prêt|solde|virement|facture|aide|merci|pourquoi|quand|combien/.test(m);
  const isRw = /muraho|nigute|nguka|amafaranga|konti|nshobora|inguzanyo|ohereza|kwishyura/.test(m);

  // Balance
  if (/balance|solde|amafaranga yanjye|how much|my account|ingano/.test(m)) {
    if (isFr) return 'Votre solde total est **' + balance + ' RWF**. Consultez la section Accounts pour les détails par compte.';
    if (isRw) return 'Amafaranga yawe yose ni **' + balance + ' RWF**. Genda ku gice cy\'Accounts kuri dashboard.';
    return 'Your current total balance is **' + balance + ' RWF**. Visit the **Accounts** section on your dashboard to see individual account balances and full statement.';
  }

  // Loan apply
  if (/loan|prêt|inguzanyo|borrow|apply|kredit/.test(m)) {
    if (isFr) return 'Pour demander un prêt:\n\n1. Allez dans **Loans** dans le menu gauche\n2. Cliquez **Demander un prêt**\n3. Remplissez: type, montant (min 50 000 RWF), durée\n4. Téléchargez 3 documents séparés: pièce d\'identité, justificatif de revenus, plan d\'affaires\n5. Soumettez — notre IA évalue votre score immédiatement\n\nTaux: Personnel 12% | Business 18% | Agricole 15% | Éducation 11% | Immobilier 10%';
    if (isRw) return 'Gusaba inguzanyo:\n\n1. Genda **Loans** ku rubaho rwawe\n2. Kanda **Apply for Loan**\n3. Uzuza: ubwoko, amafaranga (ntarengwa 50,000 RWF), igihe\n4. Kuraza inyandiko 3: indangamuntu, icyemezo cy\'umushahara, gahunda\n5. Ohereza — AI yacu isuzuma ako kanya\n\nInyungu: Bwite 12% | Ubucuruzi 18% | Ubuhinzi 15%';
    return 'To apply for a loan:\n\n1. Click **Loans** in the left sidebar\n2. Click **Apply for Loan**\n3. Fill in: loan type, amount (minimum **50,000 RWF**), duration (3–60 months)\n4. Upload **3 separate documents**: National ID, income proof/payslip, business plan\n5. Submit — our AI instantly scores your credit\n\nRates per year: Personal 12% | Business 18% | Agricultural 15% | Education 11% | Mortgage 10%\n\nAmounts above **5,000,000 RWF** require collateral. You receive an email after review.';
  }

  // Credit score
  if (/credit.*score|score|eligible|qualify|amanota/.test(m)) {
    return 'Your **AI Credit Score** (out of 850) is based on: transaction history, average balance, fraud incidents, active loans, and account age.\n\n- **700–850**: Excellent — best rates\n- **550–699**: Good — standard terms\n- **300–549**: Fair — improve by making regular deposits\n\nCheck your live score in **Analytics** in the sidebar. It updates after every transaction.';
  }

  // Transfer
  if (/transfer|send money|send funds|virement|ohereza|envoyer|pay someone/.test(m)) {
    if (isFr) return 'Pour effectuer un virement:\n\n1. Cliquez **Send Money** dans le menu\n2. Entrez le numéro de compte du bénéficiaire et cliquez **Vérifier**\n3. Entrez le montant (min 100 RWF)\n4. Confirmez — traitement instantané\n\nChaque virement est vérifié par notre IA anti-fraude. Email de confirmation envoyé immédiatement.';
    if (isRw) return 'Gukora virement:\n\n1. Kanda **Send Money** ku rubaho\n2. Shyiramo nimero ya konti\n3. Shyiramo amafaranga (ntarengwa 100 RWF)\n4. Emeza — bitunganywa ako kanya\n\nAI yacu isuzuma kugira ngo irinde uburiganya.';
    return 'To send money:\n\n1. Click **Send Money** in the left menu\n2. Enter the recipient\'s account number, click **Verify** to confirm their name\n3. Enter the amount (minimum **100 RWF**)\n4. Confirm — processed instantly\n\nEvery transfer is screened by our AI fraud detection. Both you and the recipient get email confirmations.';
  }

  // Bills
  if (/bill|facture|reco|wasac|mtn|airtel|electricity|water|kwishyura|utility|dstv/.test(m)) {
    if (isFr) return 'Pour payer vos factures:\n\nAllez dans **Pay Bills** pour payer:\n- Électricité (RECO)\n- Eau (WASAC)\n- Mobile/Internet (MTN, Airtel)\n- TV (DStv)\n- Taxes (RRA)\n- RSSB, frais scolaires\n\nSélectionnez le service, entrez votre référence, montant, confirmez. Reçu par email.';
    return 'To pay bills through SmartBank:\n\nGo to **Pay Bills** in the sidebar to pay:\n- Electricity (RECO / REG)\n- Water (WASAC)\n- Mobile & Internet (MTN, Airtel)\n- TV subscription (DStv)\n- Taxes (RRA)\n- RSSB Pension & Health\n- School / University Fees\n\nSelect the service, enter your customer reference number, amount, and confirm. Receipt sent immediately by email.';
  }

  // Fraud / security
  if (/fraud|suspicious|scam|stolen|hack|security|uburiganya|compromised|unauthorized/.test(m)) {
    return 'If you suspect fraud or unauthorized activity:\n\n**Immediate steps:**\n1. Call 24/7 hotline: **+250 780 000 001**\n2. Go to **Settings → Security** to change your password\n3. Enable **2FA** in Settings\n4. Review your transactions in the **Transactions** page\n\n**SmartBank AI protection:**\n- Every transaction scored by ML model (RandomForest)\n- High-risk transactions automatically held for review\n- Instant email alerts on flagged activity\n- Fraud analyst team reviews within 24 hours\n\nNever share your password or OTP with anyone — not even bank staff.';
  }

  // Account frozen
  if (/frozen|blocked|locked|suspended|cannot.*access|freeze/.test(m)) {
    return 'If your account is locked or frozen:\n\n- **Auto-lock after failed logins**: Wait 15 minutes, then try again\n- **Forgotten password**: Click "Forgot password?" on the login page\n- **Fraud investigation freeze**: Contact your branch manager directly\n- **Support**: Call **+250 780 000 001**\n\nYour account may also be frozen if suspicious activity was detected. Our fraud team will contact you within 24 hours.';
  }

  // 2FA / OTP
  if (/2fa|two.factor|authenticator|otp|verification code|6.digit/.test(m)) {
    return '**Two-Factor Authentication (2FA):**\n\nSmartBank uses 2-step login:\n1. Enter email and password\n2. A 6-digit OTP is sent to your email\n3. Enter the code to complete login\n\nOTPs expire after **10 minutes**. Check your spam folder if not received.\n\nTo set up authenticator app 2FA:\n- Go to **Settings → Security → Enable 2FA**\n- Scan QR code with Google Authenticator or Authy\n\nNever share your OTP with anyone.';
  }

  // Password
  if (/password|forgot.*password|reset.*password|change.*password|mot de passe/.test(m)) {
    if (isFr) return 'Pour réinitialiser votre mot de passe:\n\n1. Sur la page de connexion, cliquez **Mot de passe oublié?**\n2. Entrez votre email — un OTP à 6 chiffres vous est envoyé\n3. Entrez l\'OTP et votre nouveau mot de passe\n\nPour changer depuis votre compte: **Paramètres → Sécurité → Changer le mot de passe**';
    return 'To reset your password:\n\n1. Click **Forgot password?** on the login page\n2. Enter your email — a 6-digit OTP is sent to you\n3. Enter the OTP and set your new password\n\nTo change password while logged in: **Settings → Security → Change Password**\n\nMinimum 8 characters required. A confirmation email is sent after every change.';
  }

  // Account opening
  if (/open.*account|create.*account|register|new account|how to join/.test(m)) {
    return 'To open a SmartBank account:\n\n1. Click **Create Account** on the login page\n2. Enter your personal information\n3. Take a **live passport photo** using your device camera\n4. Upload your **National ID** document\n5. Submit — goes to KYC review\n\nAfter 1–2 business days:\n- Branch manager verifies your documents\n- If approved: unique account number + one-time password sent to your email\n\nFully digital — no branch visit needed.';
  }

  // Interest rates
  if (/interest|rate|percent|fees|charges/.test(m)) {
    return '**SmartBank Interest Rates:**\n\nLoans (per annum):\n- Personal: 12%\n- Mortgage: 10%\n- Education: 11%\n- Agricultural: 15%\n- Business: 18%\n\nSavings: up to 6% p.a.\nFixed Deposit: 9% p.a.\n\nYour actual rate depends on your **AI credit score**. Customers with scores above 700 receive the lowest available rates.';
  }

  // Analytics / spending
  if (/spending|analytics|expense|budget|financial.*tip|advice|save money/.test(m)) {
    return 'In the **Analytics** section you can see:\n\n- **Spending categories**: Food, Transport, Utilities, Healthcare, Education, Entertainment\n- **AI Credit Score**: updated after every transaction\n- **AI Financial Advisor**: personalized savings tips\n- **Max loan eligibility**: based on your score and balance\n\n**Quick tip**: Keep at least 10% of monthly income in savings to improve your credit score and loan eligibility.';
  }

  // Contact / support
  if (/contact|support|help me|phone|call|branch|headquarters|speak.*human/.test(m)) {
    return 'SmartBank AI Support:\n\n- **24/7 Hotline**: +250 780 000 001\n- **Email**: support@smartbank.rw\n- **Head Office**: Kigali City Tower, KG 7 Ave, Kigali\n- **Branch hours**: Mon–Fri 8:00 AM – 5:00 PM\n\nBranches:\n- Head Office (Kigali City)\n- Kigali City Branch\n- Nyarugenge Branch\n- Musanze Branch\n\nYou can also speak with a human agent by visiting any branch during business hours.';
  }

  // KYC
  if (/kyc|verify|verification|pending.*approval|id.*check/.test(m)) {
    return '**KYC Verification:**\n\nAfter submitting your registration:\n1. Your passport photo and ID are reviewed by a branch manager\n2. Review takes **1–2 business days**\n3. You receive an email with the decision\n\nIf approved: unique account number + one-time password sent to your email\nIf rejected: reason provided — you can reapply with clearer documents';
  }

  // Greetings
  if (/^(hi|hello|hey|muraho|bonjour|salut|good morning|good afternoon|good evening)[\s!?.,]*$/.test(m)) {
    if (isRw) return 'Muraho ' + name + '! Ndi SmartBot, umufasha wawe wa banki. Nshobora gufasha na: konti, inguzanyo, virement, fagitire, cyangwa inama z\'imari. Baza ikibazo cyawe!';
    if (isFr) return 'Bonjour ' + name + '! Je suis SmartBot, votre assistant bancaire IA. Comment puis-je vous aider? Je peux vous aider avec vos comptes, prêts, virements ou conseils financiers.';
    return 'Hello ' + name + '! How can I help you today?\n\nI can assist with:\n- Account balance and transactions\n- Loan applications (min 50,000 RWF)\n- Money transfers and bill payments\n- Fraud alerts and security\n- Financial advice and credit score';
  }

  // Thanks
  if (/thank|merci|murakoze|thanks|appreciate/.test(m)) {
    if (isRw) return 'Ntacyo, ' + name + '! Nishimye gufasha. Hari ikindi mushaka?';
    if (isFr) return 'De rien, ' + name + '! N\'hésitez pas si vous avez d\'autres questions.';
    return 'You\'re welcome, ' + name + '! Don\'t hesitate to ask if you need anything else. I\'m here 24/7 to help.';
  }

  // Default
  if (isFr) return 'Je suis SmartBot pour SmartBank AI. Je peux vous aider avec: solde du compte, demande de prêt, virement, paiement de factures, sécurité, score de crédit.\n\nPouvez-vous préciser votre question?';
  if (isRw) return 'Ndi SmartBot wa SmartBank AI. Nshobora gufasha na: konti, inguzanyo, virement, fagitire, kurinda uburiganya, amanota y\'inguzanyo.\n\nNyamuneka sobanura ikibazo cyawe.';
  return 'I\'m SmartBot, your SmartBank AI assistant. I can help with:\n\n- Account balance and statements\n- Loan applications and eligibility\n- Money transfers (min 100 RWF)\n- Bill payments (RECO, WASAC, MTN, RRA...)\n- Fraud detection and security\n- Credit score and financial advice\n\nWhat would you like help with today?';
}

exports.chatMessage = async (req, res) => {
  const { message, session_id } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message required' });

  let sessionId = session_id;
  if (!sessionId) {
    const { rows } = await query('INSERT INTO chat_sessions(user_id,title) VALUES($1,$2) RETURNING id',
      [req.user.id, message.substring(0, 60)]);
    sessionId = rows[0].id;
  }

  const { rows: history } = await query(
    'SELECT role,content FROM chat_messages WHERE session_id=$1 ORDER BY created_at ASC LIMIT 20',
    [sessionId]
  );
  await query('INSERT INTO chat_messages(session_id,role,content) VALUES($1,$2,$3)', [sessionId, 'user', message]);

  const { rows: userInfo } = await query(
    'SELECT u.first_name, COALESCE(SUM(a.balance),0) AS total_balance FROM users u LEFT JOIN accounts a ON a.user_id=u.id AND a.status=$1 WHERE u.id=$2 GROUP BY u.first_name',
    ['active', req.user.id]
  );
  const u = userInfo[0] || {};
  const balanceStr = Number(u.total_balance || 0).toLocaleString('en-RW');

  // Try Anthropic API if key is configured
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && apiKey.trim().startsWith('sk-ant')) {
    try {
      const systemPrompt = 'You are SmartBot, an expert AI banking assistant for SmartBank AI in Rwanda. Customer: ' + (u.first_name || 'Customer') + ', Balance: ' + balanceStr + ' RWF. Help with accounts, loans (min 50000 RWF, rates 10-18%), transfers (min 100 RWF), bills (RECO, WASAC, MTN, Airtel, DStv, RRA, RSSB), fraud detection, credit scoring. Be concise (max 200 words), professional. Support English, French, Kinyarwanda. Never reveal passwords or full account numbers. Emergency: +250 780 000 001.';
      const resp = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: history.map(function(m) { return { role: m.role, content: m.content }; }).concat([{ role: 'user', content: message }])
      }, {
        headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': apiKey },
        timeout: 20000
      });
      const reply = resp.data.content[0].text;
      await query('INSERT INTO chat_messages(session_id,role,content) VALUES($1,$2,$3)', [sessionId, 'assistant', reply]);
      await query('UPDATE chat_sessions SET updated_at=NOW() WHERE id=$1', [sessionId]);
      return res.json({ success: true, data: { message: reply, session_id: sessionId, engine: 'claude' } });
    } catch (err) {
      console.error('[SmartBot] Claude API error:', err.response ? err.response.status + ' ' + JSON.stringify(err.response.data) : err.message);
    }
  }

  // Smart rule-based fallback — always works without API key
  const reply = smartBotFallback(message, u.first_name, balanceStr);
  await query('INSERT INTO chat_messages(session_id,role,content) VALUES($1,$2,$3)', [sessionId, 'assistant', reply]);
  await query('UPDATE chat_sessions SET updated_at=NOW() WHERE id=$1', [sessionId]);
  res.json({ success: true, data: { message: reply, session_id: sessionId, engine: 'smartbot' } });
};


exports.getChatSessions = async (req, res) => {
  const { rows } = await query(
    `SELECT cs.*, (SELECT content FROM chat_messages WHERE session_id=cs.id ORDER BY created_at DESC LIMIT 1) AS last_message
     FROM chat_sessions cs WHERE cs.user_id=$1 ORDER BY cs.updated_at DESC LIMIT 20`, [req.user.id]
  );
  res.json({ success:true, data:{ sessions:rows } });
};

exports.getChatHistory = async (req, res) => {
  const { rows } = await query('SELECT * FROM chat_messages WHERE session_id=$1 ORDER BY created_at ASC', [req.params.id]);
  res.json({ success:true, data:{ messages:rows } });
};

exports.deleteChatSession = async (req, res) => {
  await query('DELETE FROM chat_sessions WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success:true, message:'Session deleted' });
};

// ── ADMIN / USERS ──────────────────────────────────────────────
exports.getUsers = async (req, res) => {
  const { role, branch_id, status, page=1, limit=50 } = req.query;
  let where='WHERE 1=1'; const params=[]; let i=1;
  if (role)      { where+=` AND u.role=$${i++}`;      params.push(role); }
  // Branch managers are ALWAYS scoped to their own branch — cannot see other branches
  if (req.user.role === 'branch_manager') {
    if (!req.user.branch_id)
      return res.status(403).json({ success:false, message:'Branch manager not assigned to a branch yet.' });
    where+=` AND u.branch_id=$${i++}`;
    params.push(req.user.branch_id);
  } else if (branch_id) {
    where+=` AND u.branch_id=$${i++}`; params.push(branch_id);
  }
  if (status)    { where+=` AND u.status=$${i++}`;    params.push(status); }
  const { rows } = await query(
    `SELECT u.id,u.first_name,u.last_name,u.email,u.phone,u.role,u.status,
            u.kyc_verified,u.kyc_status,u.kyc_passport_photo,u.kyc_id_document,
            u.two_fa_enabled,u.last_login_at,u.last_login_ip,u.created_at,
            u.national_id,u.date_of_birth,u.address,u.province,u.district,u.sector,u.village,
            u.profile_photo,
            b.name AS branch_name, COUNT(DISTINCT a.id) AS account_count
     FROM users u
     LEFT JOIN branches b ON u.branch_id=b.id
     LEFT JOIN accounts a ON a.user_id=u.id
     ${where} GROUP BY u.id,b.name ORDER BY u.created_at DESC LIMIT $${i++} OFFSET $${i}`,
    [...params, parseInt(limit), (parseInt(page)-1)*parseInt(limit)]
  );
  const count = await query(`SELECT COUNT(*) FROM users u ${where}`, params);
  res.json({ success:true, data:{ users:rows, total:parseInt(count.rows[0].count) } });
};

exports.getUserById = async (req, res) => {
  // Branch managers can only view users in their own branch
  let branchFilter = '';
  const params = [req.params.id];
  if (req.user.role === 'branch_manager') {
    if (!req.user.branch_id)
      return res.status(403).json({ success:false, message:'Branch manager not assigned to a branch.' });
    branchFilter = ` AND u.branch_id=$2`;
    params.push(req.user.branch_id);
  }
  const { rows } = await query(
    `SELECT u.*, b.name AS branch_name,
            (SELECT json_agg(a) FROM accounts a WHERE a.user_id=u.id) AS accounts,
            (SELECT COUNT(*) FROM loans WHERE user_id=u.id) AS loan_count,
            (SELECT COUNT(*) FROM transactions t JOIN accounts ac ON t.sender_account_id=ac.id OR t.receiver_account_id=ac.id WHERE ac.user_id=u.id) AS txn_count
     FROM users u LEFT JOIN branches b ON u.branch_id=b.id WHERE u.id=$1${branchFilter}`, params
  );
  if (!rows.length) return res.status(404).json({ success:false, message:'User not found' });
  const { password_hash, two_fa_secret, refresh_token, ...safe } = rows[0];
  res.json({ success:true, data:{ user:safe } });
};

exports.updateUserStatus = async (req, res) => {
  const { status } = req.body;
  if (!['active','suspended','inactive'].includes(status))
    return res.status(400).json({ success:false, message:'Invalid status' });
  // Branch managers can only update users in their own branch
  if (req.user.role === 'branch_manager') {
    const { rows: check } = await query('SELECT id FROM users WHERE id=$1 AND branch_id=$2', [req.params.id, req.user.branch_id]);
    if (!check.length) return res.status(403).json({ success:false, message:'You can only manage users in your branch.' });
  }
  const { rows } = await query('UPDATE users SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,email,status,first_name,last_name', [status, req.params.id]);
  if (!rows.length) return res.status(404).json({ success:false, message:'User not found' });
  await query(`INSERT INTO audit_logs(user_id,action,entity,entity_id,new_value,ip_address) VALUES($1,$2,'users',$3,$4,$5)`,
    [req.user.id, `user_${status}`, req.params.id, JSON.stringify({status}), req.ip]);
  res.json({ success:true, data:{ user:rows[0] } });
};

exports.verifyKYC = async (req, res) => {
  const { verified, notes } = req.body;
  // Branch managers can only verify users in their own branch
  if (req.user.role === 'branch_manager') {
    const { rows: check } = await query('SELECT id FROM users WHERE id=$1 AND branch_id=$2', [req.params.id, req.user.branch_id]);
    if (!check.length) return res.status(403).json({ success:false, message:'You can only verify users in your branch.' });
  }
  const { rows } = await query(
    "UPDATE users SET kyc_verified=$1, status=CASE WHEN $1=TRUE THEN 'active' ELSE status END, updated_at=NOW() WHERE id=$2 RETURNING id,first_name,email,kyc_verified,status",
    [verified, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success:false, message:'User not found' });
  await query(`INSERT INTO notifications(user_id,type,title,body) VALUES($1,'account_update',$2,$3)`,
    [req.params.id,
     verified ? 'KYC Verified' : 'KYC Not Approved',
     verified ? 'Your identity has been verified. Your account is now fully active.' : `KYC verification was not successful. ${notes||'Please resubmit with valid documents.'}`]);
  res.json({ success:true, data:{ user:rows[0] } });
};

exports.createStaff = async (req, res) => {
  const { first_name, last_name, email, phone, role, branch_id, national_id, date_of_birth, password } = req.body;
  const bcrypt = require('bcryptjs');
  const path = require('path');

  if (!first_name || !last_name || !email || !role)
    return res.status(400).json({ success: false, message: 'Required: first_name, last_name, email, role' });

  const isCustomer = role === 'customer';

  // For customers, require ID and passport photo
  if (isCustomer) {
    if (!national_id)
      return res.status(400).json({ success: false, message: 'National ID is required for customer accounts' });
    if (!req.files?.passport_photo?.[0])
      return res.status(400).json({ success: false, message: 'Passport photo is required for customer accounts' });
    if (!req.files?.id_document?.[0])
      return res.status(400).json({ success: false, message: 'ID document is required for customer accounts' });
  }

  const exists = await query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
  if (exists.rows.length) return res.status(409).json({ success: false, message: 'Email already registered' });

  if (isCustomer && national_id) {
    const nidCheck = await query('SELECT id FROM users WHERE national_id=$1', [national_id]);
    if (nidCheck.rows.length) return res.status(409).json({ success: false, message: 'National ID already registered' });
  }

  // Password: use provided or generate temp
  const rawPass = password || ('Staff@' + Math.random().toString(36).slice(-6).toUpperCase());
  const hash = await bcrypt.hash(rawPass, 12);

  // Document URLs
  const passportUrl = req.files?.passport_photo?.[0]
    ? `/uploads/kyc/${req.files.passport_photo[0].filename}` : null;
  const idDocUrl = req.files?.id_document?.[0]
    ? `/uploads/kyc/${req.files.id_document[0].filename}` : null;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO users(
        first_name, last_name, email, phone, password_hash, role, status,
        kyc_verified, branch_id, national_id, date_of_birth,
        kyc_passport_photo, kyc_id_document, kyc_status, temp_password
      ) VALUES($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id, first_name, last_name, email, role`,
      [
        first_name, last_name, email.toLowerCase(), phone || null,
        hash, role, isCustomer ? true : true,
        branch_id || req.user.branch_id || null,
        national_id || null, date_of_birth || null,
        passportUrl, idDocUrl,
        isCustomer ? 'approved' : 'none',
        rawPass,
      ]
    );
    const newUser = rows[0];

    // For customers: create savings account with unique number
    let accNum = null;
    if (isCustomer) {
      const accRes = await client.query('SELECT generate_account_number() AS num');
      accNum = accRes.rows[0].num;
      await client.query(
        `INSERT INTO accounts(user_id, account_number, account_type, currency, balance, status, branch_id)
         VALUES($1, $2, 'savings', 'RWF', 0, 'active', $3)`,
        [newUser.id, accNum, branch_id || req.user.branch_id || null]
      );
    }

    await client.query(
      `INSERT INTO notifications(user_id, type, title, body) VALUES($1,'account_update',$2,$3)`,
      [newUser.id,
       isCustomer ? 'Account Created by Branch' : 'Staff Account Created',
       isCustomer
         ? `Your SmartBank account has been created by your branch. Account: ${accNum}. Use the temporary password to log in.`
         : `Your staff account has been created. Role: ${role}. Use the temporary password to log in.`
      ]
    );

    await client.query(
      `INSERT INTO audit_logs(user_id, action, entity, entity_id) VALUES($1,$2,'users',$3)`,
      [req.user.id, isCustomer ? 'create_customer' : 'create_staff', newUser.id]
    );

    await client.query('COMMIT');

    // Send welcome email with credentials
    const { sendEmail, templates } = require('../services/notificationService');
    if (isCustomer && accNum) {
      const em = templates.kycApproved(newUser, accNum, rawPass);
      sendEmail(newUser.email, em.subject, em.html);
    } else {
      const em = templates.welcome(newUser, '—');
      sendEmail(newUser.email, em.subject, em.html);
    }

    res.status(201).json({
      success: true,
      data: {
        user: newUser,
        account_number: accNum,
        temp_password: rawPass,
        message: isCustomer
          ? `Customer account created. Account ${accNum} and credentials sent to ${email}.`
          : `Staff account created. Temporary password sent to ${email}.`,
      },
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// ── NOTIFICATIONS ─────────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  const { rows } = await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  const unread = rows.filter(n=>!n.is_read).length;
  res.json({ success:true, data:{ notifications:rows, unread } });
};

exports.markRead = async (req, res) => {
  await query('UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success:true });
};

exports.markAllRead = async (req, res) => {
  await query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1', [req.user.id]);
  res.json({ success:true, message:'All notifications marked as read' });
};

// ── ADMIN DASHBOARD ───────────────────────────────────────────

exports.assignBranchManager = async (req, res) => {
  const { branch_id, manager_id } = req.body;
  if (!branch_id || !manager_id) return res.status(400).json({ success: false, message: 'branch_id and manager_id required' });
  // Verify manager role
  const { rows: mgr } = await query('SELECT id, first_name, last_name FROM users WHERE id=$1 AND role=$2', [manager_id, 'branch_manager']);
  if (!mgr.length) return res.status(400).json({ success: false, message: 'User is not a branch manager' });
  await query('UPDATE branches SET manager_id=$1 WHERE id=$2', [manager_id, branch_id]);
  await query('UPDATE users SET branch_id=$1 WHERE id=$2', [branch_id, manager_id]);
  await query("INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,'assign_manager','branches',$2)", [req.user.id, branch_id]);
  res.json({ success: true, message: `${mgr[0].first_name} ${mgr[0].last_name} assigned as branch manager` });
};

exports.getDashboardStats = async (req, res) => {
  const [c, t, f, l, b] = await Promise.all([
    query(`SELECT COUNT(*) AS total, COUNT(*) FILTER(WHERE created_at>NOW()-INTERVAL '30 days') AS new_month, COUNT(*) FILTER(WHERE kyc_verified=TRUE) AS kyc_verified FROM users WHERE role='customer'`),
    query(`SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume, COUNT(*) FILTER(WHERE status='flagged') AS flagged, COUNT(*) FILTER(WHERE created_at>NOW()-INTERVAL '30 days') AS last_30d FROM transactions`),
    query(`SELECT COUNT(*) AS total, COUNT(*) FILTER(WHERE status='open') AS open, COUNT(*) FILTER(WHERE created_at>NOW()-INTERVAL '7 days') AS last_7d FROM fraud_cases`),
    query(`SELECT COUNT(*) AS total, COUNT(*) FILTER(WHERE status='applied') AS pending, COUNT(*) FILTER(WHERE status='approved') AS approved, COALESCE(SUM(CASE WHEN status='disbursed' THEN principal_amount ELSE 0 END),0) AS disbursed_total FROM loans`),
    query(`SELECT COUNT(*) AS total, COUNT(*) FILTER(WHERE is_active=TRUE) AS active FROM branches`),
  ]);
  res.json({ success:true, data:{ customers:c.rows[0], transactions:t.rows[0], fraud:f.rows[0], loans:l.rows[0], branches:b.rows[0] } });
};

// ── BRANCHES ─────────────────────────────────────────────────
exports.getBranches = async (req, res) => {
  const { rows } = await query(
    `SELECT b.*, COUNT(DISTINCT u.id) FILTER(WHERE u.role!='customer') AS staff_count,
            COUNT(DISTINCT a.id) AS account_count
     FROM branches b LEFT JOIN users u ON u.branch_id=b.id LEFT JOIN accounts a ON a.branch_id=b.id
     GROUP BY b.id ORDER BY b.name`
  );
  res.json({ success:true, data:{ branches:rows } });
};

exports.createBranch = async (req, res) => {
  const { name, code, location, address, phone, email } = req.body;
  if (!name||!code) return res.status(400).json({ success:false, message:'Name and code required' });
  const exists = await query('SELECT id FROM branches WHERE code=$1', [code.toUpperCase()]);
  if (exists.rows.length) return res.status(409).json({ success:false, message:'Branch code already exists' });
  const { rows } = await query(
    'INSERT INTO branches(name,code,location,address,phone,email) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
    [name, code.toUpperCase(), location, address, phone, email]
  );
  await query(`INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1,'create_branch','branches',$2)`, [req.user.id, rows[0].id]);
  res.status(201).json({ success:true, data:{ branch:rows[0] } });
};

exports.updateBranch = async (req, res) => {
  const { name, location, address, phone, email, is_active } = req.body;
  const { rows } = await query(
    `UPDATE branches SET name=COALESCE($1,name),location=COALESCE($2,location),address=COALESCE($3,address),
     phone=COALESCE($4,phone),email=COALESCE($5,email),is_active=COALESCE($6,is_active),updated_at=NOW()
     WHERE id=$7 RETURNING *`,
    [name,location,address,phone,email,is_active,req.params.id]
  );
  if (!rows.length) return res.status(404).json({ success:false, message:'Branch not found' });
  res.json({ success:true, data:{ branch:rows[0] } });
};

// ── AUDIT LOGS ────────────────────────────────────────────────
exports.getAuditLogs = async (req, res) => {
  const { page=1, limit=30, user_id, action } = req.query;
  let where='WHERE 1=1'; const params=[]; let i=1;
  if (user_id) { where+=` AND al.user_id=$${i++}`; params.push(user_id); }
  if (action)  { where+=` AND al.action=$${i++}`; params.push(action); }
  const { rows } = await query(
    `SELECT al.*, u.first_name||' '||u.last_name AS user_name, u.email AS user_email, u.role AS user_role
     FROM audit_logs al LEFT JOIN users u ON al.user_id=u.id
     ${where} ORDER BY al.created_at DESC LIMIT $${i++} OFFSET $${i}`,
    [...params, parseInt(limit), (parseInt(page)-1)*parseInt(limit)]
  );
  res.json({ success:true, data:{ logs:rows } });
};

// ── ANALYTICS ─────────────────────────────────────────────────
exports.getSpendingAnalysis = async (req, res) => {
  const data = await ai(`/api/spending/${req.user.id}`, {}, 'GET');
  res.json({ success:true, data: data || { categories:[], insights:[], total_spent:0 } });
};

exports.getCreditScore = async (req, res) => {
  const data = await ai('/api/credit-score', { user_id:req.user.id });
  res.json({ success:true, data: data || { credit_score:null, risk_level:'unknown', recommendation:'AI service unavailable' } });
};

exports.getFinancialAdvice = async (req, res) => {
  const data = await ai(`/api/advisor/${req.user.id}`, {}, 'GET');
  res.json({ success:true, data: data || { advice:[], credit_score:null } });
};

exports.getModelStatus = async (req, res) => {
  const data = await ai('/api/models/status', {}, 'GET');
  res.json({ success:true, data: data || { ml_available:false, message:'AI service offline' } });
};

exports.retrainModels = async (req, res) => {
  const data = await ai('/api/models/retrain', {});
  res.json({ success:true, data: data || { status:'error', message:'AI service offline' } });
};

exports.getBranchReport = async (req, res) => {
  const { branch_id } = req.params;
  const { start_date, end_date } = req.query;
  const from = start_date || new Date(Date.now()-30*24*60*60*1000).toISOString();
  const to   = end_date   || new Date().toISOString();
  const [branch, txns, fraud, loans, staff] = await Promise.all([
    query('SELECT * FROM branches WHERE id=$1', [branch_id]),
    query(`SELECT COUNT(*) AS total_txns, COALESCE(SUM(amount),0) AS total_volume, COUNT(*) FILTER(WHERE is_flagged) AS flagged
           FROM transactions t JOIN accounts a ON t.sender_account_id=a.id OR t.receiver_account_id=a.id
           WHERE a.branch_id=$1 AND t.created_at BETWEEN $2 AND $3`, [branch_id, from, to]),
    query("SELECT COUNT(*) AS fraud_cases, COUNT(*) FILTER(WHERE status='open') AS open_cases FROM fraud_cases fc JOIN accounts a ON fc.account_id=a.id WHERE a.branch_id=$1", [branch_id]),
    query("SELECT COUNT(*) AS total_loans, COALESCE(SUM(principal_amount) FILTER(WHERE status='disbursed'),0) AS total_disbursed FROM loans l JOIN users u ON l.user_id=u.id WHERE u.branch_id=$1", [branch_id]),
    query("SELECT COUNT(*) AS staff_count FROM users WHERE branch_id=$1 AND role!='customer'", [branch_id]),
  ]);
  if (!branch.rows.length) return res.status(404).json({ success:false, message:'Branch not found' });
  res.json({ success:true, data:{ branch:branch.rows[0], transactions:txns.rows[0], fraud:fraud.rows[0], loans:loans.rows[0], staff:staff.rows[0], period:{ from, to } } });
};

exports.getAdvancedCredit = async (req, res) => {
  const data = await ai(`/api/credit/advanced/${req.user.id}`, {}, 'GET');
  res.json({ success: true, data: data || {} });
};
exports.getCustomerBehavior = async (req, res) => {
  const data = await ai(`/api/behavior/${req.user.id}`, {}, 'GET');
  res.json({ success: true, data: data || {} });
};
exports.getFinancialPlanning = async (req, res) => {
  const data = await ai(`/api/planning/${req.user.id}`, {}, 'GET');
  res.json({ success: true, data: data || {} });
};
exports.getLiquidity = async (req, res) => {
  const data = await ai('/api/liquidity', {});
  res.json({ success: true, data: data || {} });
};
exports.complianceCheck = async (req, res) => {
  const data = await ai('/api/compliance/check', req.body);
  res.json({ success: true, data: data || {} });
};
