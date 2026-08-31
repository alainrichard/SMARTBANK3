const generateRef = (prefix='TXN') => `${prefix}${Date.now()}${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const generateOTP = (n=6) => Array.from({length:n}, ()=>Math.floor(Math.random()*10)).join('');
const paginate = (page,limit) => ({ limit:parseInt(limit)||20, offset:((parseInt(page)||1)-1)*(parseInt(limit)||20) });
module.exports = { generateRef, generateOTP, paginate };
