const { query, getClient } = require('../config/database');
const axios = require('axios');
const { sendEmail, templates } = require('../services/notificationService');
const genRef = () => 'TXN' + Date.now() + Math.random().toString(36).slice(2,6).toUpperCase();

const callAI = async (endpoint, data, method='POST') => {
  try {
    const url = `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}${endpoint}`;
    const r = method === 'GET' ? await axios.get(url, { timeout:4000 }) : await axios.post(url, data, { timeout:4000 });
    return r.data;
  } catch { return null; }
};

exports.getAccounts = async (req, res) => {
  const { rows } = await query('SELECT * FROM accounts WHERE user_id=$1 ORDER BY created_at', [req.user.id]);
  res.json({ success:true, data:{ accounts:rows } });
};

exports.verifyAccount = async (req, res) => {
  const { account_number } = req.query;
  const { rows } = await query(
    `SELECT a.account_number, a.account_type, a.currency, a.status, u.first_name||' '||u.last_name AS account_name
     FROM accounts a JOIN users u ON a.user_id=u.id WHERE a.account_number=$1`, [account_number]
  );
  if (!rows.length) return res.status(404).json({ success:false, message:'Account not found' });
  if (rows[0].status !== 'active') return res.status(400).json({ success:false, message:'Account is not active' });
  res.json({ success:true, data:{ account:rows[0] } });
};

exports.transfer = async (req, res) => {
  const { receiver_account_number, amount, description } = req.body;
  if (!receiver_account_number || !amount || parseFloat(amount) < 100)
    return res.status(400).json({ success:false, message:'Receiver account and amount (min 100 RWF) required' });
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: sAccs } = await client.query(
      'SELECT * FROM accounts WHERE user_id=$1 AND status=$2 ORDER BY account_type LIMIT 1 FOR UPDATE',
      [req.user.id, 'active']
    );
    if (!sAccs.length) throw { status:404, message:'No active sender account found' };
    const sAcc = sAccs[0];
    if (parseFloat(sAcc.balance) < parseFloat(amount)) throw { status:400, message:'Insufficient balance' };

    const { rows: rAccs } = await client.query(
      'SELECT * FROM accounts WHERE account_number=$1 AND status=$2 FOR UPDATE', [receiver_account_number, 'active']
    );
    if (!rAccs.length) throw { status:404, message:'Receiver account not found or inactive' };
    const rAcc = rAccs[0];
    if (sAcc.id === rAcc.id) throw { status:400, message:'Cannot transfer to same account' };

    const fraud = await callAI('/api/fraud/check', {
      amount: parseFloat(amount), hour: new Date().getHours(),
      is_new_device: 0, is_foreign_location: 0,
      avg_amount_7d: parseFloat(sAcc.balance) / 10,
      transactions_last_hour: 0, is_new_recipient: 0
    }) || { fraud_score:0.05, is_flagged:false, reasons:[] };

    const fee = parseFloat(amount) > 100000 ? Math.min(parseFloat(amount) * 0.001, 500) : 0;
    const ref = genRef();
    const status = fraud.is_flagged ? 'flagged' : 'completed';

    const { rows: txn } = await client.query(
      `INSERT INTO transactions(reference,sender_account_id,receiver_account_id,amount,fee,type,status,channel,description,ip_address,fraud_score,is_flagged,flagged_reason,completed_at)
       VALUES($1,$2,$3,$4,$5,'transfer',$6,'web',$7,$8,$9,$10,$11,$12) RETURNING *`,
      [ref, sAcc.id, rAcc.id, amount, fee, status, description||'Transfer', req.ip,
       fraud.fraud_score, fraud.is_flagged, (fraud.reasons||[]).join(', '),
       fraud.is_flagged ? null : new Date()]
    );

    if (!fraud.is_flagged) {
      await client.query('UPDATE accounts SET balance=balance-$1 WHERE id=$2', [parseFloat(amount)+fee, sAcc.id]);
      await client.query('UPDATE accounts SET balance=balance+$1 WHERE id=$2', [parseFloat(amount), rAcc.id]);
    } else {
      await client.query(
        `INSERT INTO fraud_cases(transaction_id,account_id,user_id,status,severity,ai_score,ai_reason,ai_model_version)
         VALUES($1,$2,$3,'open',$4,$5,$6,'v3')`,
        [txn[0].id, sAcc.id, req.user.id,
         fraud.fraud_score > 0.8 ? 'high' : 'medium',
         fraud.fraud_score, fraud.reasons || []]
      );
    }

    await client.query(
      `INSERT INTO notifications(user_id,type,title,body) VALUES($1,'transaction',$2,$3)`,
      [req.user.id, fraud.is_flagged ? 'Transfer Flagged' : 'Transfer Successful',
       `${parseFloat(amount).toLocaleString()} RWF ${fraud.is_flagged ? 'flagged for review' : 'sent to ' + receiver_account_number}`]
    );
    await client.query(`INSERT INTO audit_logs(user_id,action,entity,entity_id,ip_address) VALUES($1,'transfer','transactions',$2,$3)`,
      [req.user.id, txn[0].id, req.ip]);
    await client.query('COMMIT');
    // Send transaction email
    const { rows: userRows } = await query('SELECT first_name, email FROM users WHERE id=$1', [req.user.id]);
    if (userRows.length) {
      const em = templates.transaction(userRows[0], txn[0]);
      sendEmail(userRows[0].email, em.subject, em.html);
      // Also send fraud alert if flagged
      if (fraud.is_flagged) {
        const fem = templates.fraudAlert(userRows[0], txn[0], fraud.fraud_score);
        sendEmail(userRows[0].email, fem.subject, fem.html);
      }
    }
    res.json({ success:true, data:{ transaction:txn[0], fraud_flagged:fraud.is_flagged, fraud_score:fraud.fraud_score, model:fraud.model } });
  } catch(e) {
    await client.query('ROLLBACK');
    if (e.status) return res.status(e.status).json({ success:false, message:e.message });
    throw e;
  } finally { client.release(); }
};

exports.deposit = async (req, res) => {
  const { account_number, amount, description } = req.body;
  if (!account_number || !amount || parseFloat(amount) < 100)
    return res.status(400).json({ success:false, message:'Account number and amount (min 100) required' });
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: accs } = await client.query(
      'SELECT * FROM accounts WHERE account_number=$1 AND status=$2 FOR UPDATE', [account_number, 'active']
    );
    if (!accs.length) throw { status:404, message:'Account not found or inactive' };
    const acc = accs[0];
    await client.query('UPDATE accounts SET balance=balance+$1 WHERE id=$2', [amount, acc.id]);
    const ref = 'DEP' + Date.now();
    const { rows: txn } = await client.query(
      `INSERT INTO transactions(reference,receiver_account_id,amount,type,status,channel,description,processed_by,completed_at)
       VALUES($1,$2,$3,'deposit','completed','teller',$4,$5,NOW()) RETURNING *`,
      [ref, acc.id, amount, description||'Cash deposit', req.user.id]
    );
    await client.query(
      `INSERT INTO notifications(user_id,type,title,body) VALUES($1,'transaction','Deposit Received',$2)`,
      [acc.user_id, `${parseFloat(amount).toLocaleString()} RWF deposited to your account`]
    );
    await client.query('COMMIT');
    // Send deposit email to account owner
    const { rows: ownerRows } = await query('SELECT first_name, email FROM users WHERE id=$1', [acc.user_id]);
    if (ownerRows.length) {
      const em = templates.transaction(ownerRows[0], { ...txn[0], type: 'deposit' });
      sendEmail(ownerRows[0].email, em.subject, em.html);
    }
    res.json({ success:true, data:{ transaction:txn[0] } });
  } catch(e) { await client.query('ROLLBACK'); if (e.status) return res.status(e.status).json({success:false,message:e.message}); throw e; }
  finally { client.release(); }
};

exports.getMyTransactions = async (req, res) => {
  const { page=1, limit=20, type, status } = req.query;
  const offset = (page-1)*limit;
  let where='WHERE (a_s.user_id=$1 OR a_r.user_id=$1)'; const params=[req.user.id]; let i=2;
  if (type)   { where+=` AND t.type=$${i++}`;   params.push(type); }
  if (status) { where+=` AND t.status=$${i++}`; params.push(status); }
  const { rows } = await query(
    `SELECT t.*, a_s.account_number AS sender_num, a_r.account_number AS receiver_num,
            us.first_name||' '||us.last_name AS sender_name, ur.first_name||' '||ur.last_name AS receiver_name
     FROM transactions t
     LEFT JOIN accounts a_s ON t.sender_account_id=a_s.id
     LEFT JOIN accounts a_r ON t.receiver_account_id=a_r.id
     LEFT JOIN users us ON a_s.user_id=us.id
     LEFT JOIN users ur ON a_r.user_id=ur.id
     ${where} ORDER BY t.created_at DESC LIMIT $${i++} OFFSET $${i}`,
    [...params, limit, offset]
  );
  const count = await query(`SELECT COUNT(*) FROM transactions t LEFT JOIN accounts a_s ON t.sender_account_id=a_s.id LEFT JOIN accounts a_r ON t.receiver_account_id=a_r.id ${where}`, [req.user.id]);
  res.json({ success:true, data:{ transactions:rows, total:parseInt(count.rows[0].count), page:parseInt(page) } });
};

exports.getAllTransactions = async (req, res) => {
  const { page=1, limit=50, is_flagged, type, status } = req.query;
  const offset=(page-1)*limit; let where='WHERE 1=1'; const params=[]; let i=1;
  if (is_flagged!==undefined) { where+=` AND t.is_flagged=$${i++}`; params.push(is_flagged==='true'); }
  if (type)   { where+=` AND t.type=$${i++}`;   params.push(type); }
  if (status) { where+=` AND t.status=$${i++}`; params.push(status); }
  const { rows } = await query(
    `SELECT t.*, a_s.account_number AS sender_num, a_r.account_number AS receiver_num,
            us.first_name||' '||us.last_name AS sender_name, ur.first_name||' '||ur.last_name AS receiver_name
     FROM transactions t
     LEFT JOIN accounts a_s ON t.sender_account_id=a_s.id
     LEFT JOIN accounts a_r ON t.receiver_account_id=a_r.id
     LEFT JOIN users us ON a_s.user_id=us.id
     LEFT JOIN users ur ON a_r.user_id=ur.id
     ${where} ORDER BY t.created_at DESC LIMIT $${i++} OFFSET $${i}`,
    [...params, limit, offset]
  );
  res.json({ success:true, data:{ transactions:rows } });
};

exports.getStatement = async (req, res) => {
  const { account_id } = req.params;
  const { start_date, end_date } = req.query;
  const { rows: accs } = await query('SELECT * FROM accounts WHERE id=$1 AND user_id=$2', [account_id, req.user.id]);
  if (!accs.length) return res.status(404).json({ success:false, message:'Account not found' });
  const from = start_date || new Date(Date.now()-30*24*60*60*1000).toISOString();
  const to   = end_date   || new Date().toISOString();
  const { rows } = await query(
    `SELECT t.*, CASE WHEN t.sender_account_id=$1 THEN 'debit' ELSE 'credit' END AS direction
     FROM transactions t WHERE (t.sender_account_id=$1 OR t.receiver_account_id=$1)
       AND t.status='completed' AND t.created_at BETWEEN $2 AND $3 ORDER BY t.created_at DESC`,
    [account_id, from, to]
  );
  const credits = rows.filter(t=>t.direction==='credit').reduce((s,t)=>s+parseFloat(t.amount),0);
  const debits  = rows.filter(t=>t.direction==='debit').reduce((s,t)=>s+parseFloat(t.amount),0);
  res.json({ success:true, data:{ account:accs[0], transactions:rows, summary:{ total_credits:credits, total_debits:debits, closing_balance:parseFloat(accs[0].balance), count:rows.length } } });
};

exports.payBill = async (req, res) => {
  const { account_id, biller_code, biller_name, customer_ref, amount } = req.body;
  if (!account_id||!biller_code||!customer_ref||!amount||parseFloat(amount)<100)
    return res.status(400).json({ success:false, message:'Missing required fields or amount too small' });
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: accs } = await client.query('SELECT * FROM accounts WHERE id=$1 AND user_id=$2 AND status=$3 FOR UPDATE', [account_id, req.user.id, 'active']);
    if (!accs.length) throw { status:404, message:'Account not found or inactive' };
    if (parseFloat(accs[0].balance) < parseFloat(amount)) throw { status:400, message:'Insufficient balance' };
    await client.query('UPDATE accounts SET balance=balance-$1 WHERE id=$2', [amount, account_id]);
    const ref = 'BILL' + Date.now();
    const { rows: txn } = await client.query(
      `INSERT INTO transactions(reference,sender_account_id,amount,type,status,channel,description,completed_at)
       VALUES($1,$2,$3,'bill_payment','completed','web',$4,NOW()) RETURNING *`,
      [ref, account_id, amount, `${biller_name} — Ref: ${customer_ref}`]
    );
    await client.query('INSERT INTO bill_payments(account_id,biller_name,biller_code,customer_ref,amount,status,transaction_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [account_id, biller_name, biller_code, customer_ref, amount, 'paid', txn[0].id]);
    await client.query(`INSERT INTO notifications(user_id,type,title,body) VALUES($1,'transaction','Bill Paid',$2)`,
      [req.user.id, `${biller_name} payment of ${parseFloat(amount).toLocaleString()} RWF. Ref: ${customer_ref}`]);
    await client.query('COMMIT');
    res.json({ success:true, data:{ transaction:txn[0], receipt:{ reference:ref, biller:biller_name, customer_ref, amount, paid_at:new Date() } } });
  } catch(e) { await client.query('ROLLBACK'); if (e.status) return res.status(e.status).json({success:false,message:e.message}); throw e; }
  finally { client.release(); }
};

exports.getBillHistory = async (req, res) => {
  const { rows } = await query(`SELECT bp.* FROM bill_payments bp JOIN accounts a ON bp.account_id=a.id WHERE a.user_id=$1 ORDER BY bp.created_at DESC LIMIT 50`, [req.user.id]);
  res.json({ success:true, data:{ bills:rows } });
};
