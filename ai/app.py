"""
SmartBank AI Service
Fraud Detection   - scikit-learn RandomForest + rule ensemble
Credit Scoring    - GradientBoosting regressor
Behavioral Auth   - IsolationForest anomaly detection
Spending Analysis - keyword classifier
Loan Advisor      - recommendation engine

pip install flask flask-cors psycopg2-binary python-dotenv requests scikit-learn joblib numpy pandas
pip install tensorflow  (optional)
"""
import os, math, random, json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
CORS(app)

# Cross-platform model storage
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

try:
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor, IsolationForest
    from sklearn.preprocessing import StandardScaler
    import joblib
    ML = True
    print("[AI] scikit-learn loaded OK")
except ImportError as e:
    ML = False
    np = None
    joblib = None
    print(f"[AI] scikit-learn unavailable ({e}) - using rule-based fallback")
    # Provide a lightweight pure-Python fallback model when sklearn/joblib missing
    class _FallbackModel:
        def __init__(self, kind='generic'):
            self.kind = kind
        def predict_proba(self, X):
            # X is array-like; derive a simple probability from first numeric feature
            out = []
            for row in X:
                try:
                    v = float(row[0]) if len(row)>0 else 0.0
                    p = 1/(1+math.exp(-max(-10,min(10,(v/100000.0))))) if v!=0 else 0.01
                except Exception:
                    p = 0.01
                out.append([1.0-p, p])
            return out
        def predict(self, X):
            return [1 if prob[1] >= 0.5 else 0 for prob in self.predict_proba(X)]
        def decision_function(self, X):
            return [float(self.predict_proba(X)[i][1]) - 0.5 for i in range(len(X))]
    # Mark that we have a safe fallback available
    _FALLBACK_AVAILABLE = True

try:
    import tensorflow as tf
    TF = True
    print(f"[AI] TensorFlow {tf.__version__} loaded")
except ImportError:
    TF = False
    tf = None
    print("[AI] TensorFlow not installed (optional)")

_fm = _fs = _cm = _cs = _am = None   # fraud/credit/anomaly model + scaler

def safe_load(path):
    """Attempt to load a joblib model; on failure log and return None."""
    global joblib
    if not joblib:
        return None
    try:
        return joblib.load(path)
    except Exception as e:
        print(f"[AI] Failed to load model {path}: {e}")
        try:
            # remove corrupted file so retrain can proceed
            os.remove(path)
            print(f"[AI] Removed corrupted model file: {path}")
        except Exception:
            pass
        return None

def get_db():
    import psycopg2
    return psycopg2.connect(
        host=os.getenv('DB_HOST','localhost'), dbname=os.getenv('DB_NAME','smartbank_db'),
        user=os.getenv('DB_USER','postgres'), password=os.getenv('DB_PASSWORD',''), connect_timeout=5)

def dbq(sql, params=()):
    try:
        c = get_db(); cur = c.cursor(); cur.execute(sql, params)
        r = cur.fetchall(); c.close(); return r
    except Exception as e:
        print(f"[DB] {e}"); return []

# ────────────────────────────────────────────────────────────────
# FRAUD DETECTION
# ────────────────────────────────────────────────────────────────
RULES = [
    (lambda d: float(d.get('amount',0))>5000000,              0.30, 'Large amount >5M RWF'),
    (lambda d: int(d.get('hour',12))<5,                       0.15, 'Unusual early hours (midnight-5am)'),
    (lambda d: int(d.get('hour',12))>22,                      0.10, 'Unusual late hours (after 10pm)'),
    (lambda d: bool(d.get('is_new_device',0)),                0.20, 'Unrecognized device'),
    (lambda d: bool(d.get('is_foreign_location',0)),          0.25, 'Foreign/unusual location'),
    (lambda d: int(d.get('transactions_last_hour',0))>5,      0.25, 'Rapid transaction velocity'),
    (lambda d: _dev(d)>5,                                     0.20, 'Amount 5x above 7-day average'),
    (lambda d: bool(d.get('is_new_recipient',0)) and float(d.get('amount',0))>500000, 0.18, 'Large transfer to new recipient'),
    (lambda d: int(d.get('failed_attempts_today',0))>2,       0.12, 'Multiple failed attempts today'),
]

def _dev(d):
    avg = float(d.get('avg_amount_7d',0))
    return float(d.get('amount',0))/avg if avg>0 else 0

def rule_fraud(d):
    score, reasons = 0.0, []
    for rule, w, reason in RULES:
        try:
            if rule(d): score += w; reasons.append(reason)
        except Exception: pass
    return round(min(1.0, max(0.0, score)), 4), reasons

def train_fraud():
    global _fm, _fs
    if not ML:
        # use lightweight fallback model
        try:
            _fm = _FallbackModel('fraud')
            _fs = None
            print('[AI] Fraud fallback model initialized')
            return
        except Exception:
            return
    mp, sp = os.path.join(MODEL_DIR, 'fm.pkl'), os.path.join(MODEL_DIR, 'fs.pkl')
    if os.path.exists(mp):
        _fm = safe_load(mp); _fs = safe_load(sp)
        if _fm is not None and _fs is not None:
            print("[AI] Fraud model loaded"); return
    rng = random.Random(42); X, y = [], []
    for _ in range(3000):
        fraud = rng.random() < 0.15
        if fraud:
            x = [rng.uniform(500000,10000000), rng.choice([1,2,3,23,0]), rng.choice([0,0,1]),
                 rng.choice([0,1]), rng.randint(3,20), rng.uniform(5,20), rng.randint(0,5), rng.choice([0,1])]
        else:
            x = [rng.uniform(100,300000), rng.randint(8,21), 0, 0,
                 rng.randint(0,3), rng.uniform(0,2), 0, rng.choice([0,0,1])]
        X.append(x); y.append(1 if fraud else 0)
    sc = StandardScaler(); Xs = sc.fit_transform(np.array(X))
    m = RandomForestClassifier(n_estimators=100, random_state=42, class_weight='balanced')
    m.fit(Xs, y); joblib.dump(m, mp); joblib.dump(sc, sp)
    _fm = m; _fs = sc; print("[AI] Fraud model trained (RandomForest, 3000 samples)")

def ml_fraud(d):
    if _fm is None: return None
    try:
        x = np.array([[float(d.get('amount',0)), float(d.get('hour',12)),
                       float(d.get('is_new_device',0)), float(d.get('is_foreign_location',0)),
                       float(d.get('transactions_last_hour',0)), float(_dev(d)),
                       float(d.get('failed_attempts_today',0)), float(d.get('is_new_recipient',0))]])
        if hasattr(_fm, 'predict_proba') and _fs is None:
            return round(float(_fm.predict_proba(x)[0][1]), 4)
        return round(float(_fm.predict_proba(_fs.transform(x))[0][1]), 4)
    except Exception as e:
        print(f"[AI fraud] {e}"); return None

@app.route('/api/fraud/check', methods=['POST'])
def fraud_check():
    d = request.get_json(silent=True) or {}
    d.setdefault('hour', datetime.now().hour)
    rs, reasons = rule_fraud(d)
    ms = ml_fraud(d)
    final = round(0.6*ms + 0.4*rs, 4) if ms is not None else rs
    risk = 'critical' if final>=0.85 else 'high' if final>=0.65 else 'medium' if final>=0.4 else 'low'
    return jsonify({
        'fraud_score': final, 'rule_score': rs, 'ml_score': ms,
        'is_flagged': final >= 0.65, 'risk_level': risk, 'reasons': reasons,
        'model': 'ensemble_rf_rules' if ms is not None else 'rule_based'
    })

# ────────────────────────────────────────────────────────────────
# CREDIT SCORING
# ────────────────────────────────────────────────────────────────
def train_credit():
    global _cm, _cs
    if not ML:
        try:
            _cm = _FallbackModel('credit')
            _cs = None
            print('[AI] Credit fallback model initialized')
            return
        except Exception:
            return
    mp, sp = os.path.join(MODEL_DIR, 'cm.pkl'), os.path.join(MODEL_DIR, 'cs.pkl')
    if os.path.exists(mp):
        _cm = safe_load(mp); _cs = safe_load(sp)
        if _cm is not None and _cs is not None:
            print("[AI] Credit model loaded"); return
    rng = random.Random(123); X, y = [], []
    for _ in range(2000):
        n = rng.randint(0,200); b = rng.uniform(0,10000000); dep = rng.uniform(0,5000000)
        fc = rng.choice([0,0,0,0,1,2]); al = rng.randint(0,4); age = rng.randint(1,60)
        score = min(850, max(300, 350 + min(n,100)*0.6 + math.log1p(b)*8 + math.log1p(dep)*6 + age*2 - fc*80 - al*30 + rng.gauss(0,15)))
        X.append([n, b, dep, fc, al, age, dep/max(age,1)]); y.append(round(score))
    sc = StandardScaler(); Xs = sc.fit_transform(np.array(X))
    m = GradientBoostingRegressor(n_estimators=100, random_state=42)
    m.fit(Xs, y); joblib.dump(m, mp); joblib.dump(sc, sp)
    _cm = m; _cs = sc; print("[AI] Credit model trained (GradientBoosting, 2000 samples)")

def get_features(uid):
    try:
        r = dbq("""SELECT COUNT(t.id), COALESCE(SUM(CASE WHEN t.type='deposit' THEN t.amount ELSE 0 END),0),
                          COUNT(CASE WHEN t.is_flagged THEN 1 END)
                   FROM transactions t JOIN accounts a ON t.sender_account_id=a.id OR t.receiver_account_id=a.id
                   WHERE a.user_id=%s AND t.created_at>NOW()-INTERVAL '12 months'""", (uid,))
        n, dep, fc = (int(r[0][0] or 0), float(r[0][1] or 0), int(r[0][2] or 0)) if r else (0,0,0)
        b = float((dbq("SELECT COALESCE(SUM(balance),0) FROM accounts WHERE user_id=%s AND status='active'",(uid,)) or [[0]])[0][0])
        al = int((dbq("SELECT COUNT(*) FROM loans WHERE user_id=%s AND status IN ('disbursed','applied','under_review')",(uid,)) or [[0]])[0][0])
        age = max(1, int((dbq("SELECT COALESCE(EXTRACT(MONTH FROM NOW()-MIN(created_at)),1) FROM accounts WHERE user_id=%s",(uid,)) or [[1]])[0][0]))
        return {'n':n,'b':b,'dep':dep,'fc':fc,'al':al,'age':age,'adep':dep/age}
    except Exception as e:
        print(f"[AI features] {e}")
        return {'n':10,'b':100000,'dep':50000,'fc':0,'al':0,'age':6,'adep':8333}

def calc_credit(uid):
    f = get_features(uid)
    if ML and _cm is not None:
        try:
            x = np.array([[f['n'],f['b'],f['dep'],f['fc'],f['al'],f['age'],f['adep']]])
            sc = int(min(850, max(300, round(_cm.predict(_cs.transform(x))[0]))))
        except Exception:
            sc = int(min(850, max(300, 350 + min(f['n'],100)*0.6 + math.log1p(f['b'])*8 + f['age']*2 - f['fc']*80)))
    else:
        sc = int(min(850, max(300, 350 + min(f['n'],100)*0.6 + math.log1p(f['b'])*8 + f['age']*2 - f['fc']*80)))
    risk = 'low' if sc>=700 else 'medium' if sc>=550 else 'high'
    return sc, risk, f

@app.route('/api/credit-score', methods=['POST'])
def credit_endpoint():
    uid = (request.get_json(silent=True) or {}).get('user_id','')
    sc, risk, f = calc_credit(uid)
    rate = 0.12 if risk=='low' else 0.18 if risk=='medium' else 0.24
    ml = f['b'] * (3 if risk=='low' else 1.5 if risk=='medium' else 0.5)
    return jsonify({
        'credit_score': sc, 'risk_level': risk, 'max_loan_amount': round(ml,2),
        'recommended_interest_rate': rate,
        'recommendation': f"Score {sc}: {'favorable' if risk=='low' else 'standard' if risk=='medium' else 'limited'} terms at {int(rate*100)}% p.a.",
        'factors': {'transactions':f['n'],'balance':round(f['b'],2),'deposits':round(f['dep'],2),'fraud_incidents':f['fc'],'active_loans':f['al'],'account_age_months':f['age']},
        'model': 'gradient_boosting' if (ML and _cm) else 'rule_based'
    })

# ────────────────────────────────────────────────────────────────
# BEHAVIORAL ANOMALY DETECTION
# ────────────────────────────────────────────────────────────────
def train_anomaly():
    global _am
    if not ML:
        try:
            _am = _FallbackModel('anomaly')
            print('[AI] Anomaly fallback model initialized')
            return
        except Exception:
            return
    rng = random.Random(99); X = []
    for _ in range(1000):
        X.append([rng.randint(8,20), rng.uniform(0,500000), rng.uniform(0.1,0.9), rng.randint(1,5), rng.uniform(0.2,0.8)])
    _am = IsolationForest(contamination=0.1, random_state=42)
    _am.fit(np.array(X)); print("[AI] Behavioral anomaly model trained (IsolationForest)")

@app.route('/api/behavioral/check', methods=['POST'])
def behavioral():
    d = request.get_json(silent=True) or {}
    if _am is None:
        return jsonify({'is_anomalous': False, 'score': 0.5, 'model': 'unavailable'})
    try:
        x = np.array([[float(d.get('login_hour',10)), float(d.get('avg_txn_amount',50000)),
                       float(d.get('session_duration_norm',0.5)), float(d.get('txns_per_session',2)),
                       float(d.get('typing_speed_norm',0.5))]])
        anom = bool(_am.predict(x)[0] == -1)
        return jsonify({'is_anomalous': anom, 'anomaly_score': round(float(_am.decision_function(x)[0]),4),
                        'risk': 'high' if anom else 'normal', 'model': 'isolation_forest'})
    except Exception as e:
        return jsonify({'is_anomalous': False, 'error': str(e)})

# ────────────────────────────────────────────────────────────────
# SPENDING ANALYSIS
# ────────────────────────────────────────────────────────────────
SPEND_CATS = {
    'Food & Dining':  ['restaurant','food','cafe','kfc','pizza','eat','lunch','dinner','hotel'],
    'Transport':      ['fuel','taxi','bus','moto','uber','bolt','petrol','vehicle'],
    'Utilities':      ['electricity','water','internet','reco','wasac','mtn','airtel','wifi'],
    'Healthcare':     ['hospital','clinic','pharmacy','doctor','medical','health','rssb'],
    'Education':      ['school','university','tuition','book','college','fees','course'],
    'Entertainment':  ['cinema','game','sport','dstv','music','event','netflix'],
    'Shopping':       ['shop','market','store','supermarket','mall'],
    'Savings':        ['savings','invest','fixed','deposit','pension'],
    'Bills & Tax':    ['bill','tax','rra','revenue','subscription'],
}

def categorize(desc):
    d = (desc or '').lower()
    for cat, kws in SPEND_CATS.items():
        if any(k in d for k in kws): return cat
    return 'Other'

@app.route('/api/spending/<uid>', methods=['GET'])
def spending(uid):
    try:
        rows = dbq("""SELECT t.amount, t.description FROM transactions t
                      JOIN accounts a ON t.sender_account_id=a.id
                      WHERE a.user_id=%s AND t.status='completed'
                        AND t.type NOT IN ('deposit','loan_disbursement')
                        AND t.created_at>NOW()-INTERVAL '30 days'""", (uid,))
        if not rows:
            return jsonify({'categories':[],'insights':[],'total_spent':0})
        tots = {}
        for amt, desc in rows:
            c = categorize(desc); tots[c] = tots.get(c,0) + float(amt)
        total = sum(tots.values()) or 1
        cats = sorted([{'category':c,'amount':round(a,2),'percentage':round(a/total*100,1)} for c,a in tots.items()], key=lambda x:-x['amount'])
        insights = []
        for item in cats[:4]:
            p = item['percentage']
            if p > 40: insights.append(f"High {item['category']} spending ({p}%). Consider reviewing.")
            elif item['category'] == 'Savings' and p > 5: insights.append(f"Excellent! {p}% to savings. Consider fixed deposit at 9% p.a.")
        if not insights: insights.append("Balanced spending. Keep maintaining your budget!")
        return jsonify({'categories':cats, 'total_spent':round(total,2), 'insights':insights, 'transaction_count':len(rows)})
    except Exception as e:
        return jsonify({'error':str(e), 'categories':[], 'insights':[], 'total_spent':0})

# ────────────────────────────────────────────────────────────────
# LOAN RECOMMENDATION
# ────────────────────────────────────────────────────────────────
@app.route('/api/loan/recommend', methods=['POST'])
def loan_recommend():
    d = request.get_json(silent=True) or {}
    uid = d.get('user_id',''); amt = float(d.get('amount',0))
    months = int(d.get('months',12)); ltype = d.get('loan_type','personal')
    sc, risk, f = calc_credit(uid)
    base = {'personal':0.12,'business':0.18,'agricultural':0.15,'education':0.11,'mortgage':0.10}.get(ltype,0.18)
    adj = {'low':0,'medium':0.03,'high':0.06}[risk]
    rate = base + adj; max_el = f['b'] * (3 if risk=='low' else 1.5 if risk=='medium' else 0.5)
    r = rate/12; n = months
    pay = round((amt*r*(1+r)**n)/((1+r)**n-1), 2) if r>0 and amt>0 else (amt/n if n>0 else 0)
    eligible = amt <= max_el and risk != 'high'
    return jsonify({
        'eligible': eligible, 'credit_score': sc, 'risk_level': risk,
        'interest_rate': round(rate,4), 'monthly_payment': pay,
        'total_repayable': round(pay*n,2), 'max_eligible': round(max_el,2),
        'recommendation': f"{'Approved' if eligible else 'Not eligible'}. Score {sc} ({risk} risk). Rate: {int(rate*100)}% p.a."
    })

# ────────────────────────────────────────────────────────────────
# FINANCIAL ADVISOR
# ────────────────────────────────────────────────────────────────
@app.route('/api/advisor/<uid>', methods=['GET'])
def advisor(uid):
    sc, risk, f = calc_credit(uid)
    advice = []
    if f['b'] < 50000: advice.append({'type':'savings','priority':'high','message':'Build an emergency fund of at least 3 months of expenses.'})
    elif f['b'] > 1000000: advice.append({'type':'investment','priority':'medium','message':'Consider a fixed deposit at 9% p.a. for higher returns.'})
    if f['fc'] > 0: advice.append({'type':'security','priority':'high','message':f"{f['fc']} flagged transaction(s). Enable 2FA and review security settings."})
    if f['al'] > 1: advice.append({'type':'debt','priority':'medium','message':f"{f['al']} active loans. Focus on repayment to improve credit score."})
    if sc < 550: advice.append({'type':'credit','priority':'high','message':'Improve your credit score with regular deposits and timely repayments.'})
    elif sc >= 750: advice.append({'type':'credit','priority':'low','message':f"Excellent score {sc}! You qualify for premium loan rates from 12% p.a."})
    if not advice: advice.append({'type':'general','priority':'low','message':'Your finances are healthy. Maintain regular deposits and monitor spending.'})
    return jsonify({'credit_score':sc, 'risk_level':risk, 'advice':advice, 'generated_at':datetime.now().isoformat()})

# ────────────────────────────────────────────────────────────────
# MODEL MANAGEMENT
# ────────────────────────────────────────────────────────────────
@app.route('/api/models/status')
def model_status():
    ml_avail = ML or (_fm is not None or _cm is not None or _am is not None)
    skl_ver = None
    try:
        skl_ver = __import__('sklearn').__version__ if ML else None
    except Exception:
        skl_ver = None
    return jsonify({
        'ml_available': ml_avail, 'tensorflow_available': TF,
        'fraud_model': _fm is not None, 'credit_model': _cm is not None, 'anomaly_model': _am is not None,
        'sklearn_version': skl_ver,
        'tensorflow_version': tf.__version__ if TF else None,
    })

@app.route('/api/models/retrain', methods=['POST'])
def retrain():
    for p in [os.path.join(MODEL_DIR, f) for f in ['fm.pkl','fs.pkl','cm.pkl','cs.pkl']]:
        if os.path.exists(p): os.remove(p)
    # Attempt to (re)train models; fallback implementations will be initialized if sklearn is unavailable
    train_fraud(); train_credit(); train_anomaly()
    return jsonify({'status': 'retrained', 'models': ['fraud_detection','credit_scoring','behavioral_anomaly']})

@app.route('/health')
def health():
    return jsonify({'status':'ok', 'service':'SmartBank AI', 'ml':ML, 'tf':TF})

if __name__ == '__main__':
    print("\n[SmartBank AI] Starting service...")
    print(f"[SmartBank AI] scikit-learn: {'OK' if ML else 'not installed'}")
    print(f"[SmartBank AI] TensorFlow:   {'OK' if TF else 'not installed'}")
    if ML:
        try:
            train_fraud()
        except Exception as e:
            print(f"[AI] train_fraud failed: {e}")
        try:
            train_credit()
        except Exception as e:
            print(f"[AI] train_credit failed: {e}")
        try:
            train_anomaly()
        except Exception as e:
            print(f"[AI] train_anomaly failed: {e}")
    port = int(os.getenv('AI_PORT', 8000))
    print(f"[SmartBank AI] Running on http://localhost:{port}\n")
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')

# ═══════════════════════════════════════════════════════════════
# ADVANCED CREDIT SCORING — Multi-source algorithm
# ═══════════════════════════════════════════════════════════════

@app.route('/api/credit/advanced/<uid>', methods=['GET'])
def advanced_credit(uid):
    """Advanced credit scoring using diverse data sources"""
    f = get_features(uid)
    sc, risk, _ = calc_credit(uid)

    # Multi-factor scoring breakdown
    factor_scores = {
        'payment_history':     min(100, 40 + min(f['n'], 50) * 0.8 - f['fc'] * 15),
        'credit_utilization':  min(100, 60 + math.log1p(f['b']) * 3),
        'account_age':         min(100, 20 + min(f['age'], 60) * 1.2),
        'transaction_velocity': min(100, 30 + min(f['n'], 80) * 0.7),
        'deposit_regularity':  min(100, 40 + (f['adep'] / max(f['b'], 1)) * 200),
        'loan_performance':    max(0, 100 - f['al'] * 20),
    }

    # Behavioral patterns
    try:
        txn_data = dbq("""
            SELECT
                AVG(t.amount) AS avg_amount,
                STDDEV(t.amount) AS stddev_amount,
                COUNT(DISTINCT DATE_TRUNC('week', t.created_at)) AS active_weeks,
                MAX(t.amount) AS max_txn,
                COUNT(CASE WHEN EXTRACT(HOUR FROM t.created_at) BETWEEN 22 AND 6 THEN 1 END) AS night_txns
            FROM transactions t
            JOIN accounts a ON t.sender_account_id=a.id OR t.receiver_account_id=a.id
            WHERE a.user_id=%s AND t.created_at > NOW()-INTERVAL '6 months'
        """, (uid,))
        beh = txn_data[0] if txn_data else {}
        behavioral_score = min(100, 50 + (int(beh.get('active_weeks') or 0)) * 2)
        avg_txn = float(beh.get('avg_amount') or 0)
        night_ratio = int(beh.get('night_txns') or 0) / max(f['n'], 1)
    except Exception:
        behavioral_score = 60
        avg_txn = 0
        night_ratio = 0

    # AML risk score (0-1, lower is better)
    aml_risk = min(0.95, max(0.01,
        0.05 + f['fc'] * 0.15 + night_ratio * 0.3 +
        (1 if avg_txn > 5_000_000 else 0) * 0.2
    ))

    # Behavioral anomaly risk
    behavioral_risk = max(0.01, min(0.9, night_ratio * 0.5 + f['fc'] * 0.1))

    # Liquidity forecast (30-day)
    monthly_income_est = f['adep'] * 30
    liquidity_30d = f['b'] + monthly_income_est * 0.7

    # Investment capacity
    invest_capacity = max(0, f['b'] * 0.3) if risk == 'low' else max(0, f['b'] * 0.1)

    return jsonify({
        'credit_score': sc,
        'risk_level': risk,
        'max_loan_amount': round(f['b'] * (3 if risk=='low' else 1.5 if risk=='medium' else 0.5), 2),
        'recommended_rate': 0.12 if risk=='low' else 0.18 if risk=='medium' else 0.24,
        'factor_scores': {k: round(v, 1) for k, v in factor_scores.items()},
        'behavioral_score': round(behavioral_score, 1),
        'aml_risk': round(aml_risk, 4),
        'behavioral_risk': round(behavioral_risk, 4),
        'fraud_risk': round(min(0.9, f['fc'] * 0.2 + 0.05), 4),
        'liquidity_forecast_30d': round(liquidity_30d, 2),
        'investment_capacity': round(invest_capacity, 2),
        'model': 'gradient_boosting_advanced' if (ML and _cm) else 'rule_based_advanced',
        'data_sources': ['transaction_history', 'balance_history', 'behavioral_patterns', 'loan_history'],
        'generated_at': datetime.now().isoformat(),
    })


# ═══════════════════════════════════════════════════════════════
# CUSTOMER BEHAVIOR ANALYTICS — Personalization engine
# ═══════════════════════════════════════════════════════════════

@app.route('/api/behavior/<uid>', methods=['GET'])
def customer_behavior(uid):
    """Customer behavior analytics for personalized product recommendations"""
    f = get_features(uid)
    sc, risk, _ = calc_credit(uid)

    try:
        # Spending pattern analysis
        txns = dbq("""
            SELECT t.type, t.amount, t.description, t.created_at,
                   EXTRACT(HOUR FROM t.created_at) AS hour,
                   EXTRACT(DOW FROM t.created_at) AS dow
            FROM transactions t
            JOIN accounts a ON t.sender_account_id=a.id OR t.receiver_account_id=a.id
            WHERE a.user_id=%s AND t.created_at > NOW()-INTERVAL '3 months'
            ORDER BY t.created_at DESC LIMIT 200
        """, (uid,))

        if txns:
            hours = [int(r[4] or 0) for r in txns]
            peak_hour = max(set(hours), key=hours.count) if hours else 12
            amounts = [float(r[1] or 0) for r in txns]
            avg_txn = sum(amounts) / len(amounts) if amounts else 0
            total_txns = len(txns)
            bill_count = sum(1 for r in txns if r[0] == 'bill_payment')
            transfer_count = sum(1 for r in txns if r[0] == 'transfer')
        else:
            peak_hour, avg_txn, total_txns, bill_count, transfer_count = 12, 0, 0, 0, 0
    except Exception:
        peak_hour, avg_txn, total_txns, bill_count, transfer_count = 12, 0, 0, 0, 0

    # Segment classification
    if sc >= 750 and f['b'] > 500_000:
        segment = 'premium'
        segment_label = 'Premium Customer'
    elif sc >= 650 and f['b'] > 100_000:
        segment = 'standard'
        segment_label = 'Standard Customer'
    elif f['age'] <= 3:
        segment = 'new'
        segment_label = 'New Customer'
    else:
        segment = 'developing'
        segment_label = 'Developing Customer'

    # Product recommendations based on behavior
    recommendations = []
    if f['b'] > 1_000_000 and risk == 'low':
        recommendations.append({'product': 'Fixed Deposit', 'reason': 'High balance qualifies for 9% p.a. returns', 'priority': 'high'})
    if bill_count > 5:
        recommendations.append({'product': 'Bill Autopay', 'reason': 'Frequent bill payments — autopay saves time', 'priority': 'medium'})
    if transfer_count > 10:
        recommendations.append({'product': 'Business Account', 'reason': 'High transfer frequency suggests business activity', 'priority': 'medium'})
    if sc >= 700 and f['al'] == 0:
        recommendations.append({'product': 'Personal Loan', 'reason': f'Excellent credit score {sc} qualifies for premium 12% rate', 'priority': 'low'})
    if segment == 'new':
        recommendations.append({'product': 'Starter Savings Plan', 'reason': 'Build savings habit with monthly auto-deposit', 'priority': 'high'})

    # Financial health score (0-100)
    health_score = min(100, round(
        (sc - 300) / 550 * 40 +
        min(math.log1p(f['b']) / math.log1p(10_000_000) * 30, 30) +
        min(f['n'] / 50 * 20, 20) +
        (10 if f['fc'] == 0 else 0)
    ))

    return jsonify({
        'user_id': uid,
        'segment': segment,
        'segment_label': segment_label,
        'credit_score': sc,
        'health_score': health_score,
        'behavioral_insights': {
            'peak_activity_hour': peak_hour,
            'avg_transaction_amount': round(avg_txn, 2),
            'total_transactions_90d': total_txns,
            'bill_payments_90d': bill_count,
            'transfers_90d': transfer_count,
            'preferred_product': 'transfers' if transfer_count > bill_count else 'bill_payments',
        },
        'product_recommendations': recommendations,
        'financial_planning': {
            'emergency_fund_status': 'adequate' if f['b'] > f['adep'] * 3 else 'insufficient',
            'recommended_monthly_savings': round(f['adep'] * 0.2, 2),
            'investment_readiness': 'ready' if sc >= 700 and f['b'] > 200_000 else 'developing',
        },
        'generated_at': datetime.now().isoformat(),
    })


# ═══════════════════════════════════════════════════════════════
# FINANCIAL PLANNING TOOLS
# ═══════════════════════════════════════════════════════════════

@app.route('/api/planning/<uid>', methods=['GET'])
def financial_planning(uid):
    """Budget management, investment planning, and financial goals"""
    f = get_features(uid)
    sc, risk, _ = calc_credit(uid)

    monthly_income_est = round(f['adep'] / max(f['age'], 1), 2)
    monthly_expenses_est = round(monthly_income_est * 0.7, 2)
    savings_rate = round((monthly_income_est - monthly_expenses_est) / max(monthly_income_est, 1) * 100, 1)

    # Budget recommendations (50/30/20 rule adjusted for Rwanda)
    budget_plan = {
        'needs':   round(monthly_income_est * 0.50, 2),
        'wants':   round(monthly_income_est * 0.30, 2),
        'savings': round(monthly_income_est * 0.20, 2),
    }

    # Savings goals
    goals = []
    if f['b'] < monthly_income_est * 3:
        goals.append({'goal': 'Emergency Fund', 'target': round(monthly_income_est * 3, 2), 'current': f['b'], 'months_to_reach': max(1, int((monthly_income_est * 3 - f['b']) / max(budget_plan['savings'], 1)))})
    if sc >= 650:
        goals.append({'goal': 'Home Deposit (10%)', 'target': 5_000_000, 'current': min(f['b'], 5_000_000), 'months_to_reach': max(1, int((5_000_000 - min(f['b'], 5_000_000)) / max(budget_plan['savings'], 1)))})
    goals.append({'goal': 'Retirement Fund', 'target': 50_000_000, 'current': f['b'], 'months_to_reach': max(1, int((50_000_000 - f['b']) / max(budget_plan['savings'], 1)))})

    # Stress test scenarios
    stress_tests = [
        {'scenario': 'Income drop 30%', 'impact': 'medium' if f['b'] > monthly_income_est * 2 else 'high', 'buffer_months': round(f['b'] / max(monthly_expenses_est, 1), 1)},
        {'scenario': 'Unexpected expense 500K RWF', 'impact': 'low' if f['b'] > 1_500_000 else 'high', 'recoverable': f['b'] > 500_000},
        {'scenario': 'Interest rate +5%', 'impact': 'low' if f['al'] == 0 else 'medium', 'active_loans': f['al']},
    ]

    # Investment options ranked by suitability
    investments = [
        {'name': 'Savings Account', 'rate': '6% p.a.', 'risk': 'very_low', 'min': 10_000, 'suitable': True, 'reason': 'Safe and liquid'},
        {'name': 'Fixed Deposit (12mo)', 'rate': '9% p.a.', 'risk': 'low', 'min': 100_000, 'suitable': f['b'] > 100_000, 'reason': 'Guaranteed returns'},
        {'name': 'Treasury Bills', 'rate': '12% p.a.', 'risk': 'low', 'min': 500_000, 'suitable': f['b'] > 500_000 and sc >= 650, 'reason': 'Government-backed security'},
        {'name': 'Business Loan Investment', 'rate': 'Variable 15-25%', 'risk': 'high', 'min': 1_000_000, 'suitable': sc >= 750 and risk == 'low', 'reason': 'High growth potential'},
    ]

    return jsonify({
        'user_id': uid,
        'monthly_estimates': {'income': monthly_income_est, 'expenses': monthly_expenses_est, 'savings_rate': savings_rate},
        'budget_plan_50_30_20': budget_plan,
        'savings_goals': goals,
        'stress_tests': stress_tests,
        'investment_options': [inv for inv in investments if inv['suitable']],
        'all_investment_options': investments,
        'net_worth_estimate': round(f['b'], 2),
        'financial_score': round(min(100, (sc - 300) / 550 * 60 + min(savings_rate * 2, 40)), 1),
        'generated_at': datetime.now().isoformat(),
    })


# ═══════════════════════════════════════════════════════════════
# PREDICTIVE LIQUIDITY & STRESS TESTING
# ═══════════════════════════════════════════════════════════════

@app.route('/api/liquidity', methods=['POST'])
def liquidity_forecast():
    """Bank-wide liquidity forecasting (admin only)"""
    try:
        total_deposits = float((dbq("SELECT COALESCE(SUM(balance),0) FROM accounts WHERE status='active'") or [[0]])[0][0])
        total_loans = float((dbq("SELECT COALESCE(SUM(outstanding_balance),0) FROM loans WHERE status IN ('disbursed')") or [[0]])[0][0])
        total_users = int((dbq("SELECT COUNT(*) FROM users WHERE status='active'") or [[0]])[0][0])
        monthly_inflows = float((dbq("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='deposit' AND created_at>NOW()-INTERVAL '30 days'") or [[0]])[0][0])
        monthly_outflows = float((dbq("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type IN ('transfer','withdrawal','bill_payment') AND created_at>NOW()-INTERVAL '30 days'") or [[0]])[0][0])
    except Exception:
        total_deposits, total_loans, total_users = 10_000_000, 5_000_000, 100
        monthly_inflows, monthly_outflows = 2_000_000, 1_500_000

    liquidity_ratio = total_deposits / max(total_loans, 1)
    net_flow = monthly_inflows - monthly_outflows
    forecast_30d = total_deposits + net_flow
    forecast_90d = total_deposits + net_flow * 3

    stress_scenarios = [
        {'name': '10% withdrawal shock', 'liquidity_after': round(total_deposits * 0.9 - total_loans, 2), 'status': 'adequate' if total_deposits * 0.9 > total_loans else 'critical'},
        {'name': '30% NPL (Non-Performing Loans)', 'liquidity_after': round(total_deposits - total_loans * 0.3, 2), 'status': 'adequate' if total_deposits > total_loans * 0.3 else 'warning'},
        {'name': 'Sudden liquidity crisis', 'liquidity_after': round(total_deposits * 0.6 - total_loans, 2), 'status': 'critical' if total_deposits * 0.6 < total_loans else 'warning'},
    ]

    return jsonify({
        'total_deposits': round(total_deposits, 2),
        'total_loans_outstanding': round(total_loans, 2),
        'liquidity_ratio': round(liquidity_ratio, 4),
        'net_monthly_flow': round(net_flow, 2),
        'forecast': {'30d': round(forecast_30d, 2), '90d': round(forecast_90d, 2)},
        'stress_scenarios': stress_scenarios,
        'health_status': 'healthy' if liquidity_ratio > 2 else 'adequate' if liquidity_ratio > 1.2 else 'warning',
        'active_customers': total_users,
        'generated_at': datetime.now().isoformat(),
    })


# ═══════════════════════════════════════════════════════════════
# REGULATORY COMPLIANCE — AML monitoring
# ═══════════════════════════════════════════════════════════════

@app.route('/api/compliance/check', methods=['POST'])
def compliance_check():
    """AML and regulatory compliance check for a transaction"""
    d = request.get_json(silent=True) or {}
    amount = float(d.get('amount', 0))
    uid = d.get('user_id', '')
    txn_type = d.get('type', 'transfer')
    hour = datetime.now().hour

    flags = []
    risk_score = 0.0

    # CTR (Currency Transaction Report) threshold — 10M RWF
    if amount >= 10_000_000:
        flags.append({'rule': 'CTR_THRESHOLD', 'severity': 'high', 'detail': f'Amount {amount:,.0f} RWF exceeds CTR threshold of 10,000,000 RWF'})
        risk_score += 0.4

    # Structuring detection (just below CTR threshold)
    if 8_000_000 <= amount < 10_000_000:
        flags.append({'rule': 'STRUCTURING_RISK', 'severity': 'medium', 'detail': 'Amount just below CTR threshold — potential structuring'})
        risk_score += 0.25

    # Unusual hours (22:00 - 05:00)
    if hour >= 22 or hour <= 5:
        flags.append({'rule': 'UNUSUAL_HOURS', 'severity': 'low', 'detail': f'Transaction at {hour:02d}:00 — outside normal banking hours'})
        risk_score += 0.1

    # Round number suspicion for large amounts
    if amount > 500_000 and amount % 100_000 == 0:
        flags.append({'rule': 'ROUND_NUMBER', 'severity': 'low', 'detail': 'Large round-number transaction — common in structuring schemes'})
        risk_score += 0.05

    # Check user history
    if uid:
        try:
            prev_flags = int((dbq("SELECT COUNT(*) FROM transactions t JOIN accounts a ON t.sender_account_id=a.id WHERE a.user_id=%s AND t.is_flagged=TRUE AND t.created_at>NOW()-INTERVAL '30 days'", (uid,)) or [[0]])[0][0])
            if prev_flags > 0:
                flags.append({'rule': 'HISTORY_FLAGS', 'severity': 'medium', 'detail': f'{prev_flags} flagged transaction(s) in past 30 days'})
                risk_score += prev_flags * 0.1
        except Exception:
            pass

    overall_risk = min(0.99, round(risk_score, 4))
    sar_required = overall_risk >= 0.6

    return jsonify({
        'compliant': len(flags) == 0,
        'risk_score': overall_risk,
        'risk_level': 'critical' if overall_risk >= 0.7 else 'high' if overall_risk >= 0.5 else 'medium' if overall_risk >= 0.2 else 'low',
        'flags': flags,
        'sar_required': sar_required,
        'ctr_required': amount >= 10_000_000,
        'recommendation': 'Block and report' if sar_required else 'Allow with monitoring' if flags else 'Clear',
        'generated_at': datetime.now().isoformat(),
    })
