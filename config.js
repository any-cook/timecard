// ============================================================
// config.js — Firebase / Firestore 接続設定
// ============================================================
// 【設定方法】
// Firebaseコンソール (https://console.firebase.google.com) で
// プロジェクト設定 > 全般 > マイアプリ から取得した値を貼り付けてください。
//
// ⚠️ このファイルはGitHubの公開リポジトリにそのまま入ります。
//    Firestoreのセキュリティルール (firestore.rules) で
//    アクセス制限をかけているため問題ありませんが、
//    Firebase コンソールで「アプリの制限」を設定するとより安全です。
// ============================================================

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDcZlJdZJKeW3FILKMz7x_a5tXExFpcgao",
  authDomain:        "timecard-web-aac6e.firebaseapp.com",
  projectId:         "timecard-web-aac6e",
  storageBucket:     "timecard-web-aac6e.appspot.com",
  messagingSenderId: "275551647409",
  appId:             "1:275551647409:web:a1348e6ab28ae060f15490"
};

// 管理者PINコード（初期値: 1234 — 必ず変更してください）
const ADMIN_PIN = '1234';

// ============================================================
// デモモード: Firebase未設定の場合はローカルストレージで動作
// ============================================================
const DEMO_MODE = (FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY');

// Firebase 初期化
let _db = null;

function getDB() {
  if (_db) return _db;
  if (DEMO_MODE) return null;
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  _db = firebase.firestore();
  return _db;
}

// ============================================================
// データアクセス層 — Firestore / ローカルストレージ 共通API
// ============================================================
const DB = {

  // ---- スタッフ ----
  async getStaff() {
    if (DEMO_MODE) return JSON.parse(localStorage.getItem('staff') || '[]');
    const snap = await getDB().collection('staff').orderBy('name').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async saveStaff(staff) {
    if (DEMO_MODE) {
      let list = JSON.parse(localStorage.getItem('staff') || '[]');
      if (staff.id) {
        list = list.map(s => s.id === staff.id ? staff : s);
      } else {
        staff.id = _uid();
        staff.created_at = new Date().toISOString();
        list.push(staff);
      }
      localStorage.setItem('staff', JSON.stringify(list));
      return staff;
    }
    const db = getDB();
    const { id, ...data } = staff;
    data.created_at = data.created_at || firebase.firestore.FieldValue.serverTimestamp();
    if (id) {
      await db.collection('staff').doc(id).set(data, { merge: true });
      return { id, ...data };
    } else {
      const ref = await db.collection('staff').add(data);
      return { id: ref.id, ...data };
    }
  },

  async deleteStaff(id) {
    if (DEMO_MODE) {
      let list = JSON.parse(localStorage.getItem('staff') || '[]');
      localStorage.setItem('staff', JSON.stringify(list.filter(s => s.id !== id)));
      return;
    }
    await getDB().collection('staff').doc(id).delete();
  },

  // ---- 勤怠記録 ----
  async getAttendance(filters = {}) {
    if (DEMO_MODE) {
      let list = JSON.parse(localStorage.getItem('attendance') || '[]');
      if (filters.year && filters.month) {
        const prefix = `${filters.year}-${String(filters.month).padStart(2,'0')}`;
        list = list.filter(r => r.date && r.date.startsWith(prefix));
      }
      if (filters.staff_id) list = list.filter(r => r.staff_id === filters.staff_id);
      return list.sort((a, b) => (a.date+(a.clock_in_actual||'')) < (b.date+(b.clock_in_actual||'')) ? 1 : -1);
    }
    let q = getDB().collection('attendance');
    if (filters.year && filters.month) {
      const ym = `${filters.year}-${String(filters.month).padStart(2,'0')}`;
      q = q.where('date', '>=', `${ym}-01`).where('date', '<=', `${ym}-31`);
    }
    // staff_idフィルターはJS側で行う（Firestoreの複合インデックス不要）
    const snap = await q.orderBy('date', 'desc').get();
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (filters.staff_id) results = results.filter(r => r.staff_id === filters.staff_id);
    return results;
  },

  async getAttendanceById(id) {
    if (DEMO_MODE) {
      var list = JSON.parse(localStorage.getItem('attendance') || '[]');
      return list.find(function(r){ return r.id === id; }) || null;
    }
    try {
      var snap = await getDB().collection('attendance').doc(id).get();
      if (snap.exists) return { id: snap.id, ...snap.data() };
    } catch(e) {}
    return null;
  },

  async saveAttendance(record) {
    if (DEMO_MODE) {
      let list = JSON.parse(localStorage.getItem('attendance') || '[]');
      if (record.id) {
        list = list.map(r => r.id === record.id ? { ...r, ...record } : r);
      } else {
        record.id = _uid();
        record.created_at = new Date().toISOString();
        list.push(record);
      }
      localStorage.setItem('attendance', JSON.stringify(list));
      return record;
    }
    const db = getDB();
    const { id, ...data } = record;
    data.created_at = data.created_at || firebase.firestore.FieldValue.serverTimestamp();
    if (id) {
      await db.collection('attendance').doc(id).set(data, { merge: true });
      return { id, ...data };
    } else {
      const ref = await db.collection('attendance').add(data);
      return { id: ref.id, ...data };
    }
  },

  async deleteAttendance(id) {
    if (DEMO_MODE) {
      let list = JSON.parse(localStorage.getItem('attendance') || '[]');
      localStorage.setItem('attendance', JSON.stringify(list.filter(r => r.id !== id)));
      return;
    }
    await getDB().collection('attendance').doc(id).delete();
  },

  // ---- 特別日 ----
  async getSpecialDays() {
    if (DEMO_MODE) return JSON.parse(localStorage.getItem('special_days') || '[]');
    const snap = await getDB().collection('special_days').orderBy('date').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async saveSpecialDay(day) {
    if (DEMO_MODE) {
      let list = JSON.parse(localStorage.getItem('special_days') || '[]');
      if (day.id) {
        list = list.map(d => d.id === day.id ? day : d);
      } else {
        day.id = _uid();
        day.created_at = new Date().toISOString();
        list.push(day);
      }
      localStorage.setItem('special_days', JSON.stringify(list));
      return;
    }
    const db = getDB();
    const { id, ...data } = day;
    data.created_at = data.created_at || firebase.firestore.FieldValue.serverTimestamp();
    if (id) {
      await db.collection('special_days').doc(id).set(data, { merge: true });
    } else {
      await db.collection('special_days').add(data);
    }
  },

  async deleteSpecialDay(id) {
    if (DEMO_MODE) {
      let list = JSON.parse(localStorage.getItem('special_days') || '[]');
      localStorage.setItem('special_days', JSON.stringify(list.filter(d => d.id !== id)));
      return;
    }
    await getDB().collection('special_days').doc(id).delete();
  },

  // ---- 税額表 ----
  async getTaxTable(type) {
    const key = `tax_${type}`;
    if (DEMO_MODE) {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : (type === 'kou' ? DEFAULT_TAX_KOU : DEFAULT_TAX_OTSU);
    }
    const col = type === 'kou' ? 'tax_table_kou' : 'tax_table_otsu';
    const snap = await getDB().collection(col).orderBy('income_from').get();
    if (snap.empty) {
      // 初回: デフォルト値を Firestore に書き込む
      const defaults = type === 'kou' ? DEFAULT_TAX_KOU : DEFAULT_TAX_OTSU;
      const batch = getDB().batch();
      defaults.forEach(row => {
        const ref = getDB().collection(col).doc(row.id);
        const { id, ...data } = row;
        batch.set(ref, data);
      });
      await batch.commit();
      return defaults;
    }
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async saveTaxRow(type, row) {
    const key = `tax_${type}`;
    if (DEMO_MODE) {
      let list = JSON.parse(localStorage.getItem(key) || '[]');
      if (row.id) list = list.map(r => r.id === row.id ? row : r);
      else { row.id = _uid(); list.push(row); }
      localStorage.setItem(key, JSON.stringify(list));
      return;
    }
    const col = type === 'kou' ? 'tax_table_kou' : 'tax_table_otsu';
    const { id, ...data } = row;
    if (id) {
      await getDB().collection(col).doc(id).set(data, { merge: true });
    } else {
      await getDB().collection(col).add(data);
    }
  },

  async deleteTaxRow(type, id) {
    const key = `tax_${type}`;
    if (DEMO_MODE) {
      let list = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(list.filter(r => r.id !== id)));
      return;
    }
    const col = type === 'kou' ? 'tax_table_kou' : 'tax_table_otsu';
    await getDB().collection(col).doc(id).delete();
  }
  ,
  async replaceTaxTable(type, rows) {
    const key = 'tax_' + type;
    if (DEMO_MODE) { localStorage.setItem(key, JSON.stringify(rows)); return; }
    const col = type === 'kou' ? 'tax_table_kou' : 'tax_table_otsu';
    const db = getDB();
    // 既存データ削除（バッチ500件制限対応）
    const snap = await db.collection(col).get();
    const delChunks = [];
    for (let i = 0; i < snap.docs.length; i += 400) {
      delChunks.push(snap.docs.slice(i, i + 400));
    }
    for (const chunk of delChunks) {
      const batch = db.batch();
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    // 新データ書き込み（バッチ500件制限対応）
    for (let i = 0; i < rows.length; i += 400) {
      const batch = db.batch();
      rows.slice(i, i + 400).forEach(row => {
        const ref = db.collection(col).doc();
        const {id, ...data} = row;
        batch.set(ref, data);
      });
      await batch.commit();
    }
  },
  async getInsuranceTable(type) {
    const key = 'insurance_' + type;
    if (DEMO_MODE) {
      const stored = localStorage.getItem(key);
      const def = type==='pension' ? DEFAULT_PENSION_TABLE : type==='health_nursing' ? DEFAULT_HEALTH_NURSING_TABLE : type==='child_support' ? DEFAULT_CHILD_SUPPORT_TABLE : DEFAULT_HEALTH_TABLE;
      return stored ? JSON.parse(stored) : def;
    }
    const col = 'insurance_' + type;
    const snap = await getDB().collection(col).orderBy('grade').get();
    if (snap.empty) {
      const def = type==='pension' ? DEFAULT_PENSION_TABLE : type==='health_nursing' ? DEFAULT_HEALTH_NURSING_TABLE : type==='child_support' ? DEFAULT_CHILD_SUPPORT_TABLE : DEFAULT_HEALTH_TABLE;
      const batch = getDB().batch();
      def.forEach(row => { const {id,...data}=row; batch.set(getDB().collection(col).doc(id),data); });
      await batch.commit(); return def;
    }
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async replaceInsuranceTable(type, rows) {
    const key = 'insurance_' + type;
    if (DEMO_MODE) { localStorage.setItem(key, JSON.stringify(rows)); return; }
    const col = 'insurance_' + type;
    const db = getDB();
    const snap = await db.collection(col).get();
    const delChunks = [];
    for (let i = 0; i < snap.docs.length; i += 400) {
      delChunks.push(snap.docs.slice(i, i + 400));
    }
    for (const chunk of delChunks) {
      const batch = db.batch();
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    for (let i = 0; i < rows.length; i += 400) {
      const batch = db.batch();
      rows.slice(i, i + 400).forEach(row => {
        const ref = db.collection(col).doc();
        const {id, ...data} = row;
        batch.set(ref, data);
      });
      await batch.commit();
    }
  },
  // 雇用保険料率
  async getEmpInsRates() {
    const key = 'emp_ins_rates';
    if (DEMO_MODE) return JSON.parse(localStorage.getItem(key) || '[]');
    try {
      const snap = await getDB().collection('employment_insurance_rates').orderBy('category').get();
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      localStorage.setItem(key, JSON.stringify(rows));
      return rows;
    } catch(e) { return JSON.parse(localStorage.getItem(key) || '[]'); }
  },
  async saveEmpInsRate(row) {
    if (DEMO_MODE) {
      let list = JSON.parse(localStorage.getItem('emp_ins_rates') || '[]');
      if (row.id) list = list.map(r => r.id === row.id ? row : r);
      else { row.id = Date.now().toString(); list.push(row); }
      localStorage.setItem('emp_ins_rates', JSON.stringify(list)); return row;
    }
    const db = getDB();
    if (row.id) { await db.collection('employment_insurance_rates').doc(row.id).set(row); return row; }
    const ref = await db.collection('employment_insurance_rates').add(row);
    return { id: ref.id, ...row };
  },
  async deleteEmpInsRate(id) {
    if (DEMO_MODE) {
      let list = JSON.parse(localStorage.getItem('emp_ins_rates') || '[]');
      localStorage.setItem('emp_ins_rates', JSON.stringify(list.filter(r => r.id !== id))); return;
    }
    await getDB().collection('employment_insurance_rates').doc(id).delete();
  },
  async replaceEmpInsRates(rows) {
    if (DEMO_MODE) { localStorage.setItem('emp_ins_rates', JSON.stringify(rows)); return; }
    const db = getDB();
    const snap = await db.collection('employment_insurance_rates').get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i+400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    for (let i = 0; i < rows.length; i += 400) {
      const batch = db.batch();
      rows.slice(i, i+400).forEach(row => {
        const { id, ...data } = row;
        batch.set(db.collection('employment_insurance_rates').doc(), data);
      });
      await batch.commit();
    }
  },
  async getLeaveAll() {
    if (DEMO_MODE) return JSON.parse(localStorage.getItem('leave_records') || '[]');
    const snap = await getDB().collection('leave_records').orderBy('date','desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async saveLeave(record) {
    if (DEMO_MODE) {
      let list = JSON.parse(localStorage.getItem('leave_records') || '[]');
      if (record.id) list = list.map(r => r.id===record.id ? record : r);
      else { record.id=_uid(); record.created_at=new Date().toISOString(); list.push(record); }
      localStorage.setItem('leave_records', JSON.stringify(list)); return record;
    }
    const db=getDB(); const {id,...data}=record;
    data.created_at = data.created_at || firebase.firestore.FieldValue.serverTimestamp();
    if (id) { await db.collection('leave_records').doc(id).set(data,{merge:true}); return {id,...data}; }
    const ref=await db.collection('leave_records').add(data); return {id:ref.id,...data};
  },
  async deleteLeave(id) {
    if (DEMO_MODE) {
      let list = JSON.parse(localStorage.getItem('leave_records') || '[]');
      localStorage.setItem('leave_records', JSON.stringify(list.filter(r=>r.id!==id))); return;
    }
    await getDB().collection('leave_records').doc(id).delete();
  }
};

// ---- 内部ヘルパー ----
function _uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---- デフォルト税額表（令和6年版 簡易）----
const DEFAULT_TAX_KOU = [
  {id:'k1',income_from:0,tax_amount:0},{id:'k2',income_from:88000,tax_amount:130},
  {id:'k3',income_from:89000,tax_amount:220},{id:'k4',income_from:90000,tax_amount:310},
  {id:'k5',income_from:91000,tax_amount:400},{id:'k6',income_from:92000,tax_amount:490},
  {id:'k7',income_from:93000,tax_amount:580},{id:'k8',income_from:94000,tax_amount:670},
  {id:'k9',income_from:95000,tax_amount:760},{id:'k10',income_from:96000,tax_amount:850},
  {id:'k11',income_from:97000,tax_amount:940},{id:'k12',income_from:98000,tax_amount:1030},
  {id:'k13',income_from:99000,tax_amount:1120},{id:'k14',income_from:100000,tax_amount:1210},
  {id:'k15',income_from:105000,tax_amount:1680},{id:'k16',income_from:110000,tax_amount:2140},
  {id:'k17',income_from:115000,tax_amount:2610},{id:'k18',income_from:120000,tax_amount:3070},
  {id:'k19',income_from:125000,tax_amount:3530},{id:'k20',income_from:130000,tax_amount:4000},
  {id:'k21',income_from:135000,tax_amount:4460},{id:'k22',income_from:140000,tax_amount:4920},
  {id:'k23',income_from:150000,tax_amount:5840},{id:'k24',income_from:160000,tax_amount:6760},
  {id:'k25',income_from:170000,tax_amount:7680},{id:'k26',income_from:180000,tax_amount:8600},
  {id:'k27',income_from:190000,tax_amount:9520},{id:'k28',income_from:200000,tax_amount:10440},
  {id:'k29',income_from:220000,tax_amount:12740},{id:'k30',income_from:240000,tax_amount:15610},
];
const DEFAULT_TAX_OTSU = [
  {id:'o1',income_from:0,tax_amount:0},{id:'o2',income_from:88000,tax_amount:3200},
  {id:'o3',income_from:89000,tax_amount:3330},{id:'o4',income_from:90000,tax_amount:3500},
  {id:'o5',income_from:95000,tax_amount:4180},{id:'o6',income_from:100000,tax_amount:4920},
  {id:'o7',income_from:110000,tax_amount:6410},{id:'o8',income_from:120000,tax_amount:7900},
  {id:'o9',income_from:130000,tax_amount:9390},{id:'o10',income_from:140000,tax_amount:10880},
  {id:'o11',income_from:150000,tax_amount:12370},{id:'o12',income_from:160000,tax_amount:13860},
  {id:'o13',income_from:170000,tax_amount:15350},{id:'o14',income_from:180000,tax_amount:16840},
  {id:'o15',income_from:190000,tax_amount:18330},{id:'o16',income_from:200000,tax_amount:19820},
  {id:'o17',income_from:220000,tax_amount:22800},{id:'o18',income_from:240000,tax_amount:26200},
];

const DEFAULT_PENSION_TABLE = [
  {id:'p1',grade:1,label:'1等級',standard:88000,monthly_min:0,monthly_max:93000,employee:8052,employer:8052},
  {id:'p2',grade:2,label:'2等級',standard:98000,monthly_min:93000,monthly_max:101000,employee:8967,employer:8967},
  {id:'p3',grade:3,label:'3等級',standard:104000,monthly_min:101000,monthly_max:107000,employee:9516,employer:9516},
  {id:'p4',grade:4,label:'4等級',standard:110000,monthly_min:107000,monthly_max:114000,employee:10065,employer:10065},
  {id:'p5',grade:5,label:'5等級',standard:118000,monthly_min:114000,monthly_max:122000,employee:10797,employer:10797},
  {id:'p6',grade:6,label:'6等級',standard:126000,monthly_min:122000,monthly_max:130000,employee:11529,employer:11529},
  {id:'p7',grade:7,label:'7等級',standard:134000,monthly_min:130000,monthly_max:138000,employee:12261,employer:12261},
  {id:'p8',grade:8,label:'8等級',standard:142000,monthly_min:138000,monthly_max:146000,employee:12993,employer:12993},
  {id:'p9',grade:9,label:'9等級',standard:150000,monthly_min:146000,monthly_max:155000,employee:13725,employer:13725},
  {id:'p10',grade:10,label:'10等級',standard:160000,monthly_min:155000,monthly_max:165000,employee:14640,employer:14640},
  {id:'p11',grade:11,label:'11等級',standard:170000,monthly_min:165000,monthly_max:175000,employee:15555,employer:15555},
  {id:'p12',grade:12,label:'12等級',standard:180000,monthly_min:175000,monthly_max:185000,employee:16470,employer:16470},
  {id:'p13',grade:13,label:'13等級',standard:190000,monthly_min:185000,monthly_max:195000,employee:17385,employer:17385},
  {id:'p14',grade:14,label:'14等級',standard:200000,monthly_min:195000,monthly_max:210000,employee:18300,employer:18300},
  {id:'p15',grade:15,label:'15等級',standard:220000,monthly_min:210000,monthly_max:230000,employee:20130,employer:20130},
  {id:'p16',grade:16,label:'16等級',standard:240000,monthly_min:230000,monthly_max:250000,employee:21960,employer:21960},
  {id:'p17',grade:17,label:'17等級',standard:260000,monthly_min:250000,monthly_max:270000,employee:23790,employer:23790},
  {id:'p18',grade:18,label:'18等級',standard:280000,monthly_min:270000,monthly_max:290000,employee:25620,employer:25620},
  {id:'p19',grade:19,label:'19等級',standard:300000,monthly_min:290000,monthly_max:310000,employee:27450,employer:27450},
  {id:'p20',grade:20,label:'20等級',standard:320000,monthly_min:310000,monthly_max:330000,employee:29280,employer:29280},
  {id:'p21',grade:21,label:'21等級',standard:340000,monthly_min:330000,monthly_max:350000,employee:31110,employer:31110},
  {id:'p22',grade:22,label:'22等級',standard:360000,monthly_min:350000,monthly_max:370000,employee:32940,employer:32940},
  {id:'p23',grade:23,label:'23等級',standard:380000,monthly_min:370000,monthly_max:395000,employee:34770,employer:34770},
  {id:'p24',grade:24,label:'24等級',standard:410000,monthly_min:395000,monthly_max:425000,employee:37515,employer:37515},
  {id:'p25',grade:25,label:'25等級',standard:440000,monthly_min:425000,monthly_max:455000,employee:40260,employer:40260},
  {id:'p26',grade:26,label:'26等級',standard:470000,monthly_min:455000,monthly_max:485000,employee:43005,employer:43005},
  {id:'p27',grade:27,label:'27等級',standard:500000,monthly_min:485000,monthly_max:515000,employee:45750,employer:45750},
  {id:'p28',grade:28,label:'28等級',standard:530000,monthly_min:515000,monthly_max:545000,employee:48495,employer:48495},
  {id:'p29',grade:29,label:'29等級',standard:560000,monthly_min:545000,monthly_max:575000,employee:51240,employer:51240},
  {id:'p30',grade:30,label:'30等級',standard:590000,monthly_min:575000,monthly_max:605000,employee:53985,employer:53985},
  {id:'p31',grade:31,label:'31等級',standard:620000,monthly_min:605000,monthly_max:635000,employee:56730,employer:56730},
  {id:'p32',grade:32,label:'32等級',standard:650000,monthly_min:635000,monthly_max:999999,employee:59475,employer:59475},
];
const DEFAULT_HEALTH_TABLE = [
  {id:'h1',grade:1,label:'1等級',standard:58000,monthly_min:0,monthly_max:63000,employee:2932,employer:2932},
  {id:'h2',grade:2,label:'2等級',standard:68000,monthly_min:63000,monthly_max:73000,employee:3437,employer:3437},
  {id:'h3',grade:3,label:'3等級',standard:78000,monthly_min:73000,monthly_max:83000,employee:3943,employer:3943},
  {id:'h4',grade:4,label:'4等級',standard:88000,monthly_min:83000,monthly_max:93000,employee:4448,employer:4448},
  {id:'h5',grade:5,label:'5等級',standard:98000,monthly_min:93000,monthly_max:101000,employee:4954,employer:4954},
  {id:'h6',grade:6,label:'6等級',standard:104000,monthly_min:101000,monthly_max:107000,employee:5257,employer:5257},
  {id:'h7',grade:7,label:'7等級',standard:110000,monthly_min:107000,monthly_max:114000,employee:5561,employer:5561},
  {id:'h8',grade:8,label:'8等級',standard:118000,monthly_min:114000,monthly_max:122000,employee:5965,employer:5965},
  {id:'h9',grade:9,label:'9等級',standard:126000,monthly_min:122000,monthly_max:130000,employee:6369,employer:6369},
  {id:'h10',grade:10,label:'10等級',standard:134000,monthly_min:130000,monthly_max:138000,employee:6774,employer:6774},
  {id:'h11',grade:11,label:'11等級',standard:142000,monthly_min:138000,monthly_max:146000,employee:7178,employer:7178},
  {id:'h12',grade:12,label:'12等級',standard:150000,monthly_min:146000,monthly_max:155000,employee:7583,employer:7583},
  {id:'h13',grade:13,label:'13等級',standard:160000,monthly_min:155000,monthly_max:165000,employee:8088,employer:8088},
  {id:'h14',grade:14,label:'14等級',standard:170000,monthly_min:165000,monthly_max:175000,employee:8594,employer:8594},
  {id:'h15',grade:15,label:'15等級',standard:180000,monthly_min:175000,monthly_max:185000,employee:9099,employer:9099},
  {id:'h16',grade:16,label:'16等級',standard:190000,monthly_min:185000,monthly_max:195000,employee:9605,employer:9605},
  {id:'h17',grade:17,label:'17等級',standard:200000,monthly_min:195000,monthly_max:210000,employee:10110,employer:10110},
  {id:'h18',grade:18,label:'18等級',standard:220000,monthly_min:210000,monthly_max:230000,employee:11121,employer:11121},
  {id:'h19',grade:19,label:'19等級',standard:240000,monthly_min:230000,monthly_max:250000,employee:12132,employer:12132},
  {id:'h20',grade:20,label:'20等級',standard:260000,monthly_min:250000,monthly_max:270000,employee:13143,employer:13143},
  {id:'h21',grade:21,label:'21等級',standard:280000,monthly_min:270000,monthly_max:290000,employee:14154,employer:14154},
  {id:'h22',grade:22,label:'22等級',standard:300000,monthly_min:290000,monthly_max:310000,employee:15165,employer:15165},
  {id:'h23',grade:23,label:'23等級',standard:320000,monthly_min:310000,monthly_max:330000,employee:16176,employer:16176},
  {id:'h24',grade:24,label:'24等級',standard:340000,monthly_min:330000,monthly_max:350000,employee:17187,employer:17187},
  {id:'h25',grade:25,label:'25等級',standard:360000,monthly_min:350000,monthly_max:370000,employee:18198,employer:18198},
  {id:'h26',grade:26,label:'26等級',standard:380000,monthly_min:370000,monthly_max:395000,employee:19209,employer:19209},
  {id:'h27',grade:27,label:'27等級',standard:410000,monthly_min:395000,monthly_max:425000,employee:20726,employer:20726},
  {id:'h28',grade:28,label:'28等級',standard:440000,monthly_min:425000,monthly_max:455000,employee:22242,employer:22242},
  {id:'h29',grade:29,label:'29等級',standard:470000,monthly_min:455000,monthly_max:485000,employee:23759,employer:23759},
  {id:'h30',grade:30,label:'30等級',standard:500000,monthly_min:485000,monthly_max:515000,employee:25275,employer:25275},
  {id:'h31',grade:31,label:'31等級',standard:530000,monthly_min:515000,monthly_max:545000,employee:26792,employer:26792},
  {id:'h32',grade:32,label:'32等級',standard:560000,monthly_min:545000,monthly_max:575000,employee:28308,employer:28308},
  {id:'h33',grade:33,label:'33等級',standard:590000,monthly_min:575000,monthly_max:605000,employee:29825,employer:29825},
  {id:'h34',grade:34,label:'34等級',standard:620000,monthly_min:605000,monthly_max:635000,employee:31341,employer:31341},
  {id:'h35',grade:35,label:'35等級',standard:650000,monthly_min:635000,monthly_max:665000,employee:32858,employer:32858},
  {id:'h36',grade:36,label:'36等級',standard:680000,monthly_min:665000,monthly_max:695000,employee:34374,employer:34374},
  {id:'h37',grade:37,label:'37等級',standard:710000,monthly_min:695000,monthly_max:730000,employee:35891,employer:35891},
  {id:'h38',grade:38,label:'38等級',standard:750000,monthly_min:730000,monthly_max:770000,employee:37913,employer:37913},
  {id:'h39',grade:39,label:'39等級',standard:790000,monthly_min:770000,monthly_max:810000,employee:39935,employer:39935},
  {id:'h40',grade:40,label:'40等級',standard:830000,monthly_min:810000,monthly_max:855000,employee:41957,employer:41957},
  {id:'h41',grade:41,label:'41等級',standard:880000,monthly_min:855000,monthly_max:905000,employee:44484,employer:44484},
  {id:'h42',grade:42,label:'42等級',standard:930000,monthly_min:905000,monthly_max:955000,employee:47012,employer:47012},
  {id:'h43',grade:43,label:'43等級',standard:980000,monthly_min:955000,monthly_max:1005000,employee:49539,employer:49539},
  {id:'h44',grade:44,label:'44等級',standard:1030000,monthly_min:1005000,monthly_max:1055000,employee:52067,employer:52067},
  {id:'h45',grade:45,label:'45等級',standard:1090000,monthly_min:1055000,monthly_max:1115000,employee:55100,employer:55100},
  {id:'h46',grade:46,label:'46等級',standard:1150000,monthly_min:1115000,monthly_max:1175000,employee:58133,employer:58133},
  {id:'h47',grade:47,label:'47等級',standard:1210000,monthly_min:1175000,monthly_max:1235000,employee:61166,employer:61166},
  {id:'h48',grade:48,label:'48等級',standard:1270000,monthly_min:1235000,monthly_max:1295000,employee:64199,employer:64199},
  {id:'h49',grade:49,label:'49等級',standard:1330000,monthly_min:1295000,monthly_max:1355000,employee:67232,employer:67232},
  {id:'h50',grade:50,label:'50等級',standard:1390000,monthly_min:1355000,monthly_max:999999,employee:70265,employer:70265},
];
const DEFAULT_HEALTH_NURSING_TABLE = [
  {id:'hn1',grade:1,label:'1等級',standard:58000,monthly_min:0,monthly_max:63000,employee:3402,employer:3402},
  {id:'hn2',grade:2,label:'2等級',standard:68000,monthly_min:63000,monthly_max:73000,employee:3988,employer:3988},
  {id:'hn3',grade:3,label:'3等級',standard:78000,monthly_min:73000,monthly_max:83000,employee:4575,employer:4575},
  {id:'hn4',grade:4,label:'4等級',standard:88000,monthly_min:83000,monthly_max:93000,employee:5161,employer:5161},
  {id:'hn5',grade:5,label:'5等級',standard:98000,monthly_min:93000,monthly_max:101000,employee:5748,employer:5748},
  {id:'hn6',grade:6,label:'6等級',standard:104000,monthly_min:101000,monthly_max:107000,employee:6100,employer:6100},
  {id:'hn7',grade:7,label:'7等級',standard:110000,monthly_min:107000,monthly_max:114000,employee:6452,employer:6452},
  {id:'hn8',grade:8,label:'8等級',standard:118000,monthly_min:114000,monthly_max:122000,employee:6921,employer:6921},
  {id:'hn9',grade:9,label:'9等級',standard:126000,monthly_min:122000,monthly_max:130000,employee:7390,employer:7390},
  {id:'hn10',grade:10,label:'10等級',standard:134000,monthly_min:130000,monthly_max:138000,employee:7859,employer:7859},
  {id:'hn11',grade:11,label:'11等級',standard:142000,monthly_min:138000,monthly_max:146000,employee:8328,employer:8328},
  {id:'hn12',grade:12,label:'12等級',standard:150000,monthly_min:146000,monthly_max:155000,employee:8798,employer:8798},
  {id:'hn13',grade:13,label:'13等級',standard:160000,monthly_min:155000,monthly_max:165000,employee:9384,employer:9384},
  {id:'hn14',grade:14,label:'14等級',standard:170000,monthly_min:165000,monthly_max:175000,employee:9971,employer:9971},
  {id:'hn15',grade:15,label:'15等級',standard:180000,monthly_min:175000,monthly_max:185000,employee:10557,employer:10557},
  {id:'hn16',grade:16,label:'16等級',standard:190000,monthly_min:185000,monthly_max:195000,employee:11144,employer:11144},
  {id:'hn17',grade:17,label:'17等級',standard:200000,monthly_min:195000,monthly_max:210000,employee:11730,employer:11730},
  {id:'hn18',grade:18,label:'18等級',standard:220000,monthly_min:210000,monthly_max:230000,employee:12903,employer:12903},
  {id:'hn19',grade:19,label:'19等級',standard:240000,monthly_min:230000,monthly_max:250000,employee:14076,employer:14076},
  {id:'hn20',grade:20,label:'20等級',standard:260000,monthly_min:250000,monthly_max:270000,employee:15249,employer:15249},
  {id:'hn21',grade:21,label:'21等級',standard:280000,monthly_min:270000,monthly_max:290000,employee:16422,employer:16422},
  {id:'hn22',grade:22,label:'22等級',standard:300000,monthly_min:290000,monthly_max:310000,employee:17595,employer:17595},
  {id:'hn23',grade:23,label:'23等級',standard:320000,monthly_min:310000,monthly_max:330000,employee:18768,employer:18768},
  {id:'hn24',grade:24,label:'24等級',standard:340000,monthly_min:330000,monthly_max:350000,employee:19941,employer:19941},
  {id:'hn25',grade:25,label:'25等級',standard:360000,monthly_min:350000,monthly_max:370000,employee:21114,employer:21114},
  {id:'hn26',grade:26,label:'26等級',standard:380000,monthly_min:370000,monthly_max:395000,employee:22287,employer:22287},
  {id:'hn27',grade:27,label:'27等級',standard:410000,monthly_min:395000,monthly_max:425000,employee:24047,employer:24047},
  {id:'hn28',grade:28,label:'28等級',standard:440000,monthly_min:425000,monthly_max:455000,employee:25806,employer:25806},
  {id:'hn29',grade:29,label:'29等級',standard:470000,monthly_min:455000,monthly_max:485000,employee:27566,employer:27566},
  {id:'hn30',grade:30,label:'30等級',standard:500000,monthly_min:485000,monthly_max:515000,employee:29325,employer:29325},
  {id:'hn31',grade:31,label:'31等級',standard:530000,monthly_min:515000,monthly_max:545000,employee:31085,employer:31085},
  {id:'hn32',grade:32,label:'32等級',standard:560000,monthly_min:545000,monthly_max:575000,employee:32844,employer:32844},
  {id:'hn33',grade:33,label:'33等級',standard:590000,monthly_min:575000,monthly_max:605000,employee:34604,employer:34604},
  {id:'hn34',grade:34,label:'34等級',standard:620000,monthly_min:605000,monthly_max:635000,employee:36363,employer:36363},
  {id:'hn35',grade:35,label:'35等級',standard:650000,monthly_min:635000,monthly_max:665000,employee:38123,employer:38123},
  {id:'hn36',grade:36,label:'36等級',standard:680000,monthly_min:665000,monthly_max:695000,employee:39882,employer:39882},
  {id:'hn37',grade:37,label:'37等級',standard:710000,monthly_min:695000,monthly_max:730000,employee:41642,employer:41642},
  {id:'hn38',grade:38,label:'38等級',standard:750000,monthly_min:730000,monthly_max:770000,employee:43988,employer:43988},
  {id:'hn39',grade:39,label:'39等級',standard:790000,monthly_min:770000,monthly_max:810000,employee:46334,employer:46334},
  {id:'hn40',grade:40,label:'40等級',standard:830000,monthly_min:810000,monthly_max:855000,employee:48680,employer:48680},
  {id:'hn41',grade:41,label:'41等級',standard:880000,monthly_min:855000,monthly_max:905000,employee:51612,employer:51612},
  {id:'hn42',grade:42,label:'42等級',standard:930000,monthly_min:905000,monthly_max:955000,employee:54545,employer:54545},
  {id:'hn43',grade:43,label:'43等級',standard:980000,monthly_min:955000,monthly_max:1005000,employee:57477,employer:57477},
  {id:'hn44',grade:44,label:'44等級',standard:1030000,monthly_min:1005000,monthly_max:1055000,employee:60410,employer:60410},
  {id:'hn45',grade:45,label:'45等級',standard:1090000,monthly_min:1055000,monthly_max:1115000,employee:63929,employer:63929},
  {id:'hn46',grade:46,label:'46等級',standard:1150000,monthly_min:1115000,monthly_max:1175000,employee:67448,employer:67448},
  {id:'hn47',grade:47,label:'47等級',standard:1210000,monthly_min:1175000,monthly_max:1235000,employee:70967,employer:70967},
  {id:'hn48',grade:48,label:'48等級',standard:1270000,monthly_min:1235000,monthly_max:1295000,employee:74486,employer:74486},
  {id:'hn49',grade:49,label:'49等級',standard:1330000,monthly_min:1295000,monthly_max:1355000,employee:78005,employer:78005},
  {id:'hn50',grade:50,label:'50等級',standard:1390000,monthly_min:1355000,monthly_max:999999,employee:81524,employer:81524},
];
const DEFAULT_CHILD_SUPPORT_TABLE = [
  {id:'cs1',grade:1,label:'1等級',standard:58000,monthly_min:0,monthly_max:63000,employee:67,employer:67},
  {id:'cs2',grade:2,label:'2等級',standard:68000,monthly_min:63000,monthly_max:73000,employee:78,employer:78},
  {id:'cs3',grade:3,label:'3等級',standard:78000,monthly_min:73000,monthly_max:83000,employee:90,employer:90},
  {id:'cs4',grade:4,label:'4等級',standard:88000,monthly_min:83000,monthly_max:93000,employee:101,employer:101},
  {id:'cs5',grade:5,label:'5等級',standard:98000,monthly_min:93000,monthly_max:101000,employee:113,employer:113},
  {id:'cs6',grade:6,label:'6等級',standard:104000,monthly_min:101000,monthly_max:107000,employee:120,employer:120},
  {id:'cs7',grade:7,label:'7等級',standard:110000,monthly_min:107000,monthly_max:114000,employee:127,employer:127},
  {id:'cs8',grade:8,label:'8等級',standard:118000,monthly_min:114000,monthly_max:122000,employee:136,employer:136},
  {id:'cs9',grade:9,label:'9等級',standard:126000,monthly_min:122000,monthly_max:130000,employee:145,employer:145},
  {id:'cs10',grade:10,label:'10等級',standard:134000,monthly_min:130000,monthly_max:138000,employee:154,employer:154},
  {id:'cs11',grade:11,label:'11等級',standard:142000,monthly_min:138000,monthly_max:146000,employee:163,employer:163},
  {id:'cs12',grade:12,label:'12等級',standard:150000,monthly_min:146000,monthly_max:155000,employee:173,employer:173},
  {id:'cs13',grade:13,label:'13等級',standard:160000,monthly_min:155000,monthly_max:165000,employee:184,employer:184},
  {id:'cs14',grade:14,label:'14等級',standard:170000,monthly_min:165000,monthly_max:175000,employee:196,employer:196},
  {id:'cs15',grade:15,label:'15等級',standard:180000,monthly_min:175000,monthly_max:185000,employee:207,employer:207},
  {id:'cs16',grade:16,label:'16等級',standard:190000,monthly_min:185000,monthly_max:195000,employee:219,employer:219},
  {id:'cs17',grade:17,label:'17等級',standard:200000,monthly_min:195000,monthly_max:210000,employee:230,employer:230},
  {id:'cs18',grade:18,label:'18等級',standard:220000,monthly_min:210000,monthly_max:230000,employee:253,employer:253},
  {id:'cs19',grade:19,label:'19等級',standard:240000,monthly_min:230000,monthly_max:250000,employee:276,employer:276},
  {id:'cs20',grade:20,label:'20等級',standard:260000,monthly_min:250000,monthly_max:270000,employee:299,employer:299},
  {id:'cs21',grade:21,label:'21等級',standard:280000,monthly_min:270000,monthly_max:290000,employee:322,employer:322},
  {id:'cs22',grade:22,label:'22等級',standard:300000,monthly_min:290000,monthly_max:310000,employee:345,employer:345},
  {id:'cs23',grade:23,label:'23等級',standard:320000,monthly_min:310000,monthly_max:330000,employee:368,employer:368},
  {id:'cs24',grade:24,label:'24等級',standard:340000,monthly_min:330000,monthly_max:350000,employee:391,employer:391},
  {id:'cs25',grade:25,label:'25等級',standard:360000,monthly_min:350000,monthly_max:370000,employee:414,employer:414},
  {id:'cs26',grade:26,label:'26等級',standard:380000,monthly_min:370000,monthly_max:395000,employee:437,employer:437},
  {id:'cs27',grade:27,label:'27等級',standard:410000,monthly_min:395000,monthly_max:425000,employee:472,employer:472},
  {id:'cs28',grade:28,label:'28等級',standard:440000,monthly_min:425000,monthly_max:455000,employee:506,employer:506},
  {id:'cs29',grade:29,label:'29等級',standard:470000,monthly_min:455000,monthly_max:485000,employee:541,employer:541},
  {id:'cs30',grade:30,label:'30等級',standard:500000,monthly_min:485000,monthly_max:515000,employee:575,employer:575},
  {id:'cs31',grade:31,label:'31等級',standard:530000,monthly_min:515000,monthly_max:545000,employee:610,employer:610},
  {id:'cs32',grade:32,label:'32等級',standard:560000,monthly_min:545000,monthly_max:575000,employee:644,employer:644},
  {id:'cs33',grade:33,label:'33等級',standard:590000,monthly_min:575000,monthly_max:605000,employee:679,employer:679},
  {id:'cs34',grade:34,label:'34等級',standard:620000,monthly_min:605000,monthly_max:635000,employee:713,employer:713},
  {id:'cs35',grade:35,label:'35等級',standard:650000,monthly_min:635000,monthly_max:665000,employee:748,employer:748},
  {id:'cs36',grade:36,label:'36等級',standard:680000,monthly_min:665000,monthly_max:695000,employee:782,employer:782},
  {id:'cs37',grade:37,label:'37等級',standard:710000,monthly_min:695000,monthly_max:730000,employee:817,employer:817},
  {id:'cs38',grade:38,label:'38等級',standard:750000,monthly_min:730000,monthly_max:770000,employee:863,employer:863},
  {id:'cs39',grade:39,label:'39等級',standard:790000,monthly_min:770000,monthly_max:810000,employee:909,employer:909},
  {id:'cs40',grade:40,label:'40等級',standard:830000,monthly_min:810000,monthly_max:855000,employee:955,employer:955},
  {id:'cs41',grade:41,label:'41等級',standard:880000,monthly_min:855000,monthly_max:905000,employee:1012,employer:1012},
  {id:'cs42',grade:42,label:'42等級',standard:930000,monthly_min:905000,monthly_max:955000,employee:1070,employer:1070},
  {id:'cs43',grade:43,label:'43等級',standard:980000,monthly_min:955000,monthly_max:1005000,employee:1127,employer:1127},
  {id:'cs44',grade:44,label:'44等級',standard:1030000,monthly_min:1005000,monthly_max:1055000,employee:1185,employer:1185},
  {id:'cs45',grade:45,label:'45等級',standard:1090000,monthly_min:1055000,monthly_max:1115000,employee:1254,employer:1254},
  {id:'cs46',grade:46,label:'46等級',standard:1150000,monthly_min:1115000,monthly_max:1175000,employee:1323,employer:1323},
  {id:'cs47',grade:47,label:'47等級',standard:1210000,monthly_min:1175000,monthly_max:1235000,employee:1392,employer:1392},
  {id:'cs48',grade:48,label:'48等級',standard:1270000,monthly_min:1235000,monthly_max:1295000,employee:1461,employer:1461},
  {id:'cs49',grade:49,label:'49等級',standard:1330000,monthly_min:1295000,monthly_max:1355000,employee:1530,employer:1530},
  {id:'cs50',grade:50,label:'50等級',standard:1390000,monthly_min:1355000,monthly_max:999999,employee:1599,employer:1599},
];
function getInsuranceAmountByGrade(gradeId, table) {
  if (!gradeId||!table) return 0;
  const row = table.find(r => r.id === gradeId);
  return row ? row.employee : 0;
}
function findInsuranceGradeByMonthly(monthly, table) {
  if (!table||!table.length) return null;
  const sorted = [...table].sort((a,b) => a.grade-b.grade);
  for (const row of sorted) { if (monthly >= row.monthly_min && monthly < row.monthly_max) return row; }
  return sorted[sorted.length-1];
}
