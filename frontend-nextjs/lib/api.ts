import axios from 'axios';

// Use /api which is proxied by next.config.js rewrites to http://localhost:5000/api
const BASE = '/api';

const client = axios.create({ baseURL: BASE, timeout: 15000 });

client.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined'
    ? (document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/) || [])[1] || localStorage.getItem('access_token')
    : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const url: string = err.config?.url || '';
    // Never try to refresh token on auth endpoints - just pass error through
    if (url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh')) {
      return Promise.reject(err);
    }
    if (err.response?.status === 401) {
      const cookies = document.cookie.split(';').reduce((acc: any, c) => {
        const [k, v] = c.trim().split('=');
        acc[k] = v;
        return acc;
      }, {});
      const refresh = cookies['refresh_token'];
      if (refresh) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken: refresh });
          const newToken = data.data.accessToken;
          document.cookie = `access_token=${newToken}; path=/; max-age=86400`;
          localStorage.setItem('access_token', newToken);
          err.config.headers.Authorization = `Bearer ${newToken}`;
          return client(err.config);
        } catch { clearAuth(); }
      }
      clearAuth();
    }
    return Promise.reject(err);
  }
);

export function setAuth(accessToken: string, refreshToken: string) {
  document.cookie = `access_token=${accessToken}; path=/; max-age=86400`;
  document.cookie = `refresh_token=${refreshToken}; path=/; max-age=604800`;
  localStorage.setItem('access_token', accessToken);
}

export function clearAuth() {
  document.cookie = 'access_token=; path=/; max-age=0';
  document.cookie = 'refresh_token=; path=/; max-age=0';
  localStorage.removeItem('access_token');
  localStorage.removeItem('sb_user');
  if (typeof window !== 'undefined') window.location.href = '/auth/login';
}

// Auth
export const login = (data: any) => client.post('/auth/login', data);
export const register = (data: any) => client.post('/auth/register', data);
export const logout = () => client.post('/auth/logout').catch(() => {});
export const forgotPassword = (email: string) => client.post('/auth/forgot-password', { email });
export const resetPassword = (data: any) => client.post('/auth/reset-password', data);
export const changePassword = (data: any) => client.post('/auth/change-password', data);
export const getProfile = () => client.get('/profile');
export const updateProfile = (data: any) => client.put('/profile', data);
export const setup2FA = () => client.post('/auth/setup-2fa');
export const enable2FA = (token: string) => client.post('/auth/enable-2fa', { token });
export const disable2FA = (token: string) => client.post('/auth/disable-2fa', { token });

// Accounts
export const getAccounts = () => client.get('/accounts');
export const verifyAccount = (account_number: string) => client.get(`/accounts/verify?account_number=${encodeURIComponent(account_number)}`);
export const getStatement = (id: string) => client.get(`/accounts/${id}/statement`);

// Transactions
export const getMyTransactions = (params?: any) => client.get('/transactions', { params });
export const getAllTransactions = (params?: any) => client.get('/transactions/all', { params });
export const transfer = (data: any) => client.post('/transactions/transfer', data);
export const deposit = (data: any) => client.post('/transactions/deposit', data);

// Bills
export const getBillers = () => client.get('/bills/billers');
export const payBill = (data: any) => client.post('/bills/pay', data);
export const getBillHistory = () => client.get('/bills/history');

// Loans
export const getMyLoans = () => client.get('/loans');
export const getAllLoans = (params?: any) => client.get('/loans/all', { params });
export const reviewLoan = (id: string, data: any) => client.put(`/loans/${id}/review`, data);

// Fraud
export const getFraudCases = (params?: any) => client.get('/fraud/cases', { params });
export const updateFraudCase = (id: string, data: any) => client.put(`/fraud/cases/${id}`, data);
export const freezeAccount = (data: any) => client.post('/fraud/freeze', data);
export const unfreezeAccount = (data: any) => client.post('/fraud/unfreeze', data);
export const getFraudStats = () => client.get('/fraud/stats');

// Chatbot
export const sendChatMessage = (message: string, session_id?: string) =>
  client.post('/chatbot/message', { message, session_id });
export const getChatSessions = () => client.get('/chatbot/sessions');
export const getChatHistory = (id: string) => client.get(`/chatbot/sessions/${id}`);
export const deleteChatSession = (id: string) => client.delete(`/chatbot/sessions/${id}`);

// Notifications
export const getNotifications = () => client.get('/notifications');
export const markRead = (id: string) => client.put(`/notifications/${id}/read`);
export const markAllRead = () => client.put('/notifications/read-all');

// Admin
export const getUsers = (params?: any) => client.get('/admin/users', { params });
export const createStaff = (data: any) => client.post('/admin/staff', data);
export const updateUserStatus = (id: string, status: string) => client.put(`/admin/users/${id}/status`, { status });
export const verifyKYC = (id: string, verified: boolean) => client.put(`/admin/users/${id}/kyc`, { verified });
export const getDashboardStats = () => client.get('/admin/dashboard');

// Branches
export const getBranches = () => client.get('/branches');
export const createBranch = (data: any) => client.post('/branches', data);

// Audit
export const getAuditLogs = (params?: any) => client.get('/audit-logs', { params });

// Analytics
export const getSpendingAnalysis = () => client.get('/analytics/spending');
export const getCreditScore = () => client.get('/analytics/credit-score');
export const getFinancialAdvice = () => client.get('/analytics/advice');

export const getAdvancedCredit = () => client.get('/analytics/credit/advanced');
export const getCustomerBehavior = () => client.get('/analytics/behavior');
export const getFinancialPlanning = () => client.get('/analytics/planning');
export const getLiquidity = () => client.get('/analytics/liquidity');
export const complianceCheck = (data: any) => client.post('/analytics/compliance/check', data);

export const getAIStatus = () => client.get('/analytics/ai-status');
export const retrainModels = () => client.post('/analytics/retrain');

export default client;
