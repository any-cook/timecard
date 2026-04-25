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
  storageBucket:     "timecard-web-aac6e.firebasestorage.app",
  messagingSenderId: "275551647409",
  appId:             "1:275551647409:web:a1348e6ab28ae060f15490"
};

const ADMIN_PIN = '8299';
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
    if (filters.staff_id) q = q.where('staff_id', '==', filters.staff_id);
    const snap = await q.orderBy('date', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
