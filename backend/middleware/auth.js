const jwt  = require('jsonwebtoken');
const { query } = require('../config/database');

const authenticate = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ success:false, message:'No token provided' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query(
      'SELECT id,email,role,status,branch_id,first_name,last_name,kyc_verified FROM users WHERE id=$1', [decoded.userId]
    );
    if (!rows.length) return res.status(401).json({ success:false, message:'User not found' });
    if (rows[0].status === 'suspended') return res.status(403).json({ success:false, message:'Account suspended. Contact support.' });
    req.user = rows[0];
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired. Please refresh.' : 'Invalid token.';
    return res.status(401).json({ success:false, message:msg });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success:false, message:`Access denied. Required roles: ${roles.join(', ')}` });
  next();
};

module.exports = { authenticate, authorize };
