/* =========================================================
   app.js — Core shared logic for the Student Management System
   Handles: storage helpers, auth, theme, layout (sidebar/topbar),
   notifications, toasts, modals, confirm dialogs, seed data.
   Loaded on every page BEFORE the page-specific script.
   ========================================================= */

/* ---------- Storage keys ---------- */
const DB = {
  STUDENTS: 'sms_students',
  TEACHERS: 'sms_teachers',
  BATCHES: 'sms_batches',
  ATTENDANCE: 'sms_attendance',
  FEES: 'sms_fees',
  EXAMS: 'sms_exams',
  SETTINGS: 'sms_settings',
  AUTH: 'sms_auth',
  THEME: 'sms_theme',
  NOTIFS: 'sms_notifications'
};

/* ---------- Generic storage helpers ---------- */
function dbGet(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : []);
  }catch(e){ console.error('dbGet error', key, e); return fallback !== undefined ? fallback : []; }
}
function dbSet(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}
function uid(prefix){
  return (prefix||'ID') + '-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random()*900+100);
}
function formatDate(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  if(isNaN(d)) return iso;
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function formatCurrency(n){
  n = Number(n)||0;
  return '₹' + n.toLocaleString('en-IN');
}
function todayISO(){ return new Date().toISOString().slice(0,10); }
function escapeHTML(str){
  if(str===undefined||str===null) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function initials(name){
  if(!name) return '?';
  return name.trim().split(/\s+/).slice(0,2).map(p=>p[0].toUpperCase()).join('');
}
function debounce(fn, delay){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), delay); };
}

/* =========================================================
   AUTH
   ========================================================= */
const Auth = {
  isLoggedIn(){
    return !!(localStorage.getItem(DB.AUTH) || sessionStorage.getItem(DB.AUTH));
  },
  currentUser(){
    const raw = localStorage.getItem(DB.AUTH) || sessionStorage.getItem(DB.AUTH);
    return raw ? JSON.parse(raw) : null;
  },
  login(username, remember){
    const payload = JSON.stringify({ username, loginAt: new Date().toISOString() });
    if(remember){ localStorage.setItem(DB.AUTH, payload); }
    else { sessionStorage.setItem(DB.AUTH, payload); }
  },
  logout(){
    localStorage.removeItem(DB.AUTH);
    sessionStorage.removeItem(DB.AUTH);
    window.location.href = 'login.html';
  },
  guard(){
    const page = window.location.pathname.split('/').pop();
    if(page !== 'login.html' && !this.isLoggedIn()){
      window.location.href = 'login.html';
    }
  }
};

/* =========================================================
   TOASTS
   ========================================================= */
function ensureToastStack(){
  let stack = document.querySelector('.toast-stack');
  if(!stack){
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}
const ICONS = { success:'fa-circle-check', error:'fa-circle-xmark', warn:'fa-triangle-exclamation', info:'fa-circle-info' };
function toast(title, msg, type){
  type = type || 'info';
  const stack = ensureToastStack();
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `
    <i class="fa-solid ${ICONS[type]||ICONS.info}"></i>
    <div>
      <div class="t-title">${escapeHTML(title)}</div>
      ${msg ? `<div class="t-msg">${escapeHTML(msg)}</div>` : ''}
    </div>
    <button class="t-close"><i class="fa-solid fa-xmark"></i></button>`;
  stack.appendChild(el);
  const remove = () => { el.classList.add('hide'); setTimeout(()=>el.remove(), 250); };
  el.querySelector('.t-close').addEventListener('click', remove);
  setTimeout(remove, 4200);
}

/* =========================================================
   MODALS
   ========================================================= */
function openModal(id){
  const overlay = document.getElementById(id);
  if(overlay){ overlay.classList.add('open'); document.body.style.overflow='hidden'; }
}
function closeModal(id){
  const overlay = document.getElementById(id);
  if(overlay){ overlay.classList.remove('open'); document.body.style.overflow=''; }
}
document.addEventListener('click', (e)=>{
  if(e.target.classList && e.target.classList.contains('modal-overlay')){
    e.target.classList.remove('open');
    document.body.style.overflow='';
  }
});
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){
    document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
    document.body.style.overflow='';
  }
});

/* Confirm dialog — returns a Promise<boolean> */
function confirmDialog({ title, message, confirmText, danger }){
  return new Promise((resolve)=>{
    let overlay = document.getElementById('global-confirm-modal');
    if(overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'global-confirm-modal';
    overlay.innerHTML = `
      <div class="modal modal-sm">
        <div class="modal-body" style="text-align:center; padding-top:28px;">
          <div class="confirm-icon" style="margin-left:auto;margin-right:auto;"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <h3 style="font-size:16px;margin-bottom:6px;">${escapeHTML(title||'Are you sure?')}</h3>
          <p class="text-sm muted">${escapeHTML(message||'This action cannot be undone.')}</p>
        </div>
        <div class="modal-foot" style="justify-content:center;">
          <button class="btn btn-outline" data-act="cancel">Cancel</button>
          <button class="btn ${danger===false?'btn-primary':'btn-danger'}" data-act="ok">${escapeHTML(confirmText||'Delete')}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(()=> overlay.classList.add('open'));
    overlay.addEventListener('click', (e)=>{
      if(e.target === overlay){ cleanup(false); }
    });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', ()=>cleanup(false));
    overlay.querySelector('[data-act="ok"]').addEventListener('click', ()=>cleanup(true));
    function cleanup(result){
      overlay.classList.remove('open');
      setTimeout(()=>overlay.remove(), 200);
      resolve(result);
    }
  });
}

/* =========================================================
   THEME (dark mode)
   ========================================================= */
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.querySelector('#themeToggle i');
  if(icon){ icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'; }
}
function initTheme(){
  const saved = localStorage.getItem(DB.THEME) || 'light';
  applyTheme(saved);
  const btn = document.getElementById('themeToggle');
  if(btn){
    btn.addEventListener('click', ()=>{
      const now = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(now);
      localStorage.setItem(DB.THEME, now);
    });
  }
}

/* =========================================================
   SEED DATA — creates demo data on first run
   ========================================================= */
function seedIfEmpty(){
  if(!localStorage.getItem(DB.SETTINGS)){
    dbSet(DB.SETTINGS, {
      instituteName: 'Brightpath Coaching Institute',
      logo: '',
      address: '12 MG Road, Hubli, Karnataka',
      phone: '+91 98450 12345',
      email: 'info@brightpath.edu',
      theme: 'light'
    });
  }
  if(!localStorage.getItem(DB.TEACHERS)){
    dbSet(DB.TEACHERS, [
      { id: uid('TCH'), name:'Anita Deshpande', phone:'9876543210', email:'anita@brightpath.edu', subject:'Mathematics', salary:38000, batches:[] },
      { id: uid('TCH'), name:'Rahul Kulkarni', phone:'9876501234', email:'rahul@brightpath.edu', subject:'Physics', salary:35000, batches:[] },
      { id: uid('TCH'), name:'Sneha Patil', phone:'9845098450', email:'sneha@brightpath.edu', subject:'Chemistry', salary:33000, batches:[] }
    ]);
  }
  if(!localStorage.getItem(DB.BATCHES)){
    const teachers = dbGet(DB.TEACHERS, []);
    dbSet(DB.BATCHES, [
      { id: uid('BAT'), name:'NEET Morning Batch', type:'Morning', course:'NEET', teacherId: teachers[0]?.id||'', capacity:40, timing:'6:30 AM - 8:30 AM' },
      { id: uid('BAT'), name:'JEE Evening Batch', type:'Evening', course:'JEE', teacherId: teachers[1]?.id||'', capacity:35, timing:'5:00 PM - 7:00 PM' },
      { id: uid('BAT'), name:'Foundation Weekend Batch', type:'Weekend', course:'Foundation', teacherId: teachers[2]?.id||'', capacity:30, timing:'10:00 AM - 1:00 PM' }
    ]);
  }
  if(!localStorage.getItem(DB.STUDENTS)){
    const batches = dbGet(DB.BATCHES, []);
    const names = ['Aarav Sharma','Diya Patel','Ishaan Rao','Ananya Nair','Vihaan Gupta','Myra Joshi','Kabir Singh','Saanvi Iyer','Reyansh Menon','Anaya Kulkarni','Vivaan Reddy','Aadhya Shetty'];
    dbSet(DB.STUDENTS, names.map((name,i)=>({
      id: uid('STU'),
      admissionNo: 'ADM' + (2024100 + i),
      rollNo: String(i+1).padStart(2,'0'),
      name, photo:'',
      dob: `200${6+(i%4)}-0${(i%9)+1}-1${i%9}`,
      parentName: 'Parent of ' + name.split(' ')[0],
      parentPhone: '9' + (800000000 + i*137).toString().slice(0,9),
      address: 'Hubli, Karnataka',
      course: batches[i%3].course,
      batchId: batches[i%3].id,
      totalFees: 45000,
      joinDate: `2024-0${(i%6)+1}-1${i%9}`,
      status:'active'
    })));
  }
  if(!localStorage.getItem(DB.FEES)){
    const students = dbGet(DB.STUDENTS, []);
    dbSet(DB.FEES, students.map((s,i)=>{
      const paid = i%3===0 ? s.totalFees : (i%3===1 ? Math.round(s.totalFees*0.5) : 0);
      return {
        id: uid('FEE'), studentId: s.id, totalFees: s.totalFees, paid,
        payments: paid>0 ? [{ id: uid('PAY'), amount: paid, date: todayISO(), mode:'UPI', receiptNo:'RCPT' + (1000+i) }] : []
      };
    }));
  }
  if(!localStorage.getItem(DB.ATTENDANCE)){ dbSet(DB.ATTENDANCE, []); }
  if(!localStorage.getItem(DB.EXAMS)){ dbSet(DB.EXAMS, []); }
  if(!localStorage.getItem(DB.NOTIFS)){
    dbSet(DB.NOTIFS, [
      { id: uid('NTF'), icon:'fa-money-bill-wave', color:'warn', title:'Fee reminder', body:'6 students have pending fees this month', time:'2h ago' },
      { id: uid('NTF'), icon:'fa-user-plus', color:'success', title:'New admission', body:'Aadhya Shetty was added to Foundation batch', time:'5h ago' },
      { id: uid('NTF'), icon:'fa-calendar-check', color:'primary', title:'Exam scheduled', body:'JEE Mock Test #4 scheduled for next week', time:'1d ago' }
    ]);
  }
}

/* =========================================================
   LAYOUT — wires up sidebar, topbar, notifications, avatars
   Call after DOMContentLoaded on every logged-in page.
   ========================================================= */
function initLayout(){
  seedIfEmpty();
  initTheme();

  // Populate institute branding
  const settings = dbGet(DB.SETTINGS, {});
  document.querySelectorAll('.js-institute-name').forEach(el => el.textContent = settings.instituteName || 'Coaching Institute');
  document.querySelectorAll('.js-brand-mark').forEach(el => { if(!settings.logo) el.textContent = initials(settings.instituteName||'CI'); });

  // Active nav link based on current filename
  const page = (window.location.pathname.split('/').pop() || 'dashboard.html');
  document.querySelectorAll('.nav-link').forEach(link=>{
    if(link.getAttribute('href') === page) link.classList.add('active');
  });

  // Current user chip
  const user = Auth.currentUser();
  document.querySelectorAll('.js-user-name').forEach(el => el.textContent = user ? user.username : 'Admin');
  document.querySelectorAll('.js-user-avatar').forEach(el => el.textContent = initials(user ? user.username : 'Admin'));

  // Sidebar mobile toggle
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  const menuToggle = document.getElementById('menuToggle');
  if(menuToggle && sidebar){
    menuToggle.addEventListener('click', ()=>{
      sidebar.classList.toggle('open');
      overlay && overlay.classList.toggle('open');
    });
  }
  if(overlay){
    overlay.addEventListener('click', ()=>{
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  // Logout
  document.querySelectorAll('.js-logout').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      Auth.logout();
    });
  });

  // Notification panel
  const notifBtn = document.getElementById('notifBtn');
  const notifPanel = document.getElementById('notifPanel');
  if(notifBtn && notifPanel){
    const notifs = dbGet(DB.NOTIFS, []);
    const list = notifPanel.querySelector('.notif-list');
    if(list){
      list.innerHTML = notifs.length ? notifs.map(n => `
        <div class="notif-item">
          <div class="notif-ico badge-${n.color==='primary'?'primary':n.color}" style="background:var(--${n.color}-light);color:var(--${n.color==='primary'?'primary':n.color});"><i class="fa-solid ${n.icon}"></i></div>
          <div class="notif-body"><p>${escapeHTML(n.title)}</p><span>${escapeHTML(n.body)} · ${escapeHTML(n.time)}</span></div>
        </div>`).join('') : `<div class="empty-state"><i class="fa-regular fa-bell-slash"></i><h4>No notifications</h4></div>`;
    }
    notifBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      notifPanel.classList.toggle('open');
    });
    document.addEventListener('click', (e)=>{
      if(!notifPanel.contains(e.target) && e.target !== notifBtn){ notifPanel.classList.remove('open'); }
    });
  }
}

/* =========================================================
   VALIDATION HELPERS (used across forms)
   ========================================================= */
function markInvalid(fieldEl, message){
  fieldEl.classList.add('invalid');
  const err = fieldEl.querySelector('.error-text');
  if(err) err.textContent = message;
}
function clearInvalid(fieldEl){
  fieldEl.classList.remove('invalid');
}
function validateRequired(form){
  let valid = true;
  form.querySelectorAll('[data-field]').forEach(field=>{
    const input = field.querySelector('input,select,textarea');
    if(!input) return;
    clearInvalid(field);
    if(input.hasAttribute('required') && !String(input.value).trim()){
      markInvalid(field, 'This field is required');
      valid = false;
    } else if(input.type==='email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)){
      markInvalid(field, 'Enter a valid email address');
      valid = false;
    } else if(input.type==='tel' && input.value && !/^[0-9]{7,15}$/.test(input.value.replace(/\D/g,''))){
      markInvalid(field, 'Enter a valid phone number');
      valid = false;
    }
  });
  return valid;
}

/* =========================================================
   Export helpers (CSV / print)
   ========================================================= */
function exportToCSV(filename, rows){
  if(!rows || !rows.length){ toast('Nothing to export', 'There is no data available.', 'warn'); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(',')].concat(
    rows.map(r => headers.map(h => `"${String(r[h]===undefined?'':r[h]).replace(/"/g,'""')}"`).join(','))
  ).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Export ready', 'CSV file downloaded (opens in Excel).', 'success');
}
function printSection(){ window.print(); }

/* Run auth guard immediately (before DOM ready) so protected pages don't flash */
Auth.guard();
