/* =========================================================
   attendance.js — Mark attendance, daily & monthly reports
   Attendance records stored as: { date, batchId, entries:[{studentId,status}] }
   status: 'present' | 'absent' | 'late'
   ========================================================= */
(function(){
  let students = [], batches = [], attendance = [];

  document.addEventListener('DOMContentLoaded', () => {
    initLayout();
    students = dbGet(DB.STUDENTS, []);
    batches = dbGet(DB.BATCHES, []);
    attendance = dbGet(DB.ATTENDANCE, []);

    setupTabs();
    setupMarkTab();
    setupDailyTab();
    setupMonthlyTab();
  });

  function setupTabs(){
    document.querySelectorAll('.tab-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        ['mark','daily','monthly'].forEach(t=>{
          document.getElementById('tab-'+t).style.display = (t===btn.dataset.tab) ? 'block' : 'none';
        });
      });
    });
  }

  /* ---------------- MARK ATTENDANCE ---------------- */
  function setupMarkTab(){
    const batchSel = document.getElementById('markBatchSelect');
    batchSel.innerHTML = batches.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');
    document.getElementById('markDate').value = todayISO();

    batchSel.addEventListener('change', renderMarkTable);
    document.getElementById('markDate').addEventListener('change', renderMarkTable);
    document.getElementById('markAllPresent').addEventListener('click', ()=>{
      document.querySelectorAll('#markAttendanceBody .chip[data-status="present"]').forEach(c=>selectChip(c));
    });
    document.getElementById('saveAttendanceBtn').addEventListener('click', saveAttendance);

    renderMarkTable();
  }

  function existingRecord(date, batchId){
    return attendance.find(a=>a.date===date && a.batchId===batchId);
  }

  function renderMarkTable(){
    const batchId = document.getElementById('markBatchSelect').value;
    const date = document.getElementById('markDate').value;
    const roster = students.filter(s=>s.batchId===batchId);
    const record = existingRecord(date, batchId);

    const tbody = document.getElementById('markAttendanceBody');
    if(!roster.length){
      tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><i class="fa-solid fa-user-graduate"></i><h4>No students in this batch</h4></div></td></tr>`;
      return;
    }
    tbody.innerHTML = roster.map(s=>{
      const entry = record ? record.entries.find(e=>e.studentId===s.id) : null;
      const status = entry ? entry.status : 'present';
      return `
      <tr data-student="${s.id}">
        <td><div class="cell-main"><div class="cell-avatar">${s.photo?`<img src="${s.photo}">`:initials(s.name)}</div><div class="cell-title">${escapeHTML(s.name)}</div></div></td>
        <td>${escapeHTML(s.rollNo)}</td>
        <td>
          <div class="chip-group" style="justify-content:center;">
            <span class="chip ${status==='present'?'active':''}" data-status="present" onclick="AttendanceModule.selectChip(this)" style="cursor:pointer;">Present</span>
            <span class="chip ${status==='late'?'active':''}" data-status="late" onclick="AttendanceModule.selectChip(this)" style="cursor:pointer;">Late</span>
            <span class="chip ${status==='absent'?'active':''}" data-status="absent" onclick="AttendanceModule.selectChip(this)" style="cursor:pointer;">Absent</span>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function selectChip(el){
    const group = el.closest('.chip-group');
    group.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
    el.classList.add('active');
  }

  function saveAttendance(){
    const batchId = document.getElementById('markBatchSelect').value;
    const date = document.getElementById('markDate').value;
    if(!batchId || !date){ toast('Missing information', 'Please choose a batch and date.', 'error'); return; }

    const entries = [];
    document.querySelectorAll('#markAttendanceBody tr[data-student]').forEach(row=>{
      const studentId = row.dataset.student;
      const active = row.querySelector('.chip.active');
      entries.push({ studentId, status: active ? active.dataset.status : 'present' });
    });

    const btn = document.getElementById('saveAttendanceBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving...';

    setTimeout(()=>{
      const idx = attendance.findIndex(a=>a.date===date && a.batchId===batchId);
      const record = { id: idx>-1 ? attendance[idx].id : uid('ATT'), date, batchId, entries };
      if(idx>-1) attendance[idx] = record; else attendance.push(record);
      dbSet(DB.ATTENDANCE, attendance);

      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Attendance';
      toast('Attendance saved', `Attendance for ${formatDate(date)} recorded for ${entries.length} students.`, 'success');
    }, 500);
  }

  /* ---------------- DAILY REPORT ---------------- */
  function setupDailyTab(){
    document.getElementById('dailyReportDate').value = todayISO();
    document.getElementById('dailyReportDate').addEventListener('change', renderDailyReport);
    document.getElementById('exportDaily').addEventListener('click', ()=>{
      const date = document.getElementById('dailyReportDate').value;
      const rows = buildDailyRows(date).map(r=>({ Student:r.name, Batch:r.batch, Status:r.status }));
      exportToCSV(`attendance_daily_${date}.csv`, rows);
    });
    document.getElementById('printDaily').addEventListener('click', printSection);
    renderDailyReport();
  }

  function buildDailyRows(date){
    const dayRecords = attendance.filter(a=>a.date===date);
    const rows = [];
    dayRecords.forEach(rec=>{
      const batch = batches.find(b=>b.id===rec.batchId);
      rec.entries.forEach(e=>{
        const student = students.find(s=>s.id===e.studentId);
        if(student) rows.push({ name: student.name, batch: batch?batch.name:'—', status: e.status });
      });
    });
    return rows;
  }

  function renderDailyReport(){
    const date = document.getElementById('dailyReportDate').value;
    const rows = buildDailyRows(date);
    const present = rows.filter(r=>r.status==='present').length;
    const late = rows.filter(r=>r.status==='late').length;
    const absent = rows.filter(r=>r.status==='absent').length;

    document.getElementById('dailyStats').innerHTML = `
      <div class="card stat-card" style="box-shadow:none;border:1px solid var(--border);"><div class="stat-ico" style="background:var(--success-light);color:var(--success);"><i class="fa-solid fa-check"></i></div><div class="stat-value">${present}</div><div class="stat-label">Present</div></div>
      <div class="card stat-card" style="box-shadow:none;border:1px solid var(--border);"><div class="stat-ico" style="background:var(--warn-light);color:var(--warn);"><i class="fa-solid fa-clock"></i></div><div class="stat-value">${late}</div><div class="stat-label">Late</div></div>
      <div class="card stat-card" style="box-shadow:none;border:1px solid var(--border);"><div class="stat-ico" style="background:var(--danger-light);color:var(--danger);"><i class="fa-solid fa-xmark"></i></div><div class="stat-value">${absent}</div><div class="stat-label">Absent</div></div>`;

    const tbody = document.getElementById('dailyReportBody');
    tbody.innerHTML = rows.length ? rows.map(r => `
      <tr><td class="fw-700">${escapeHTML(r.name)}</td><td>${escapeHTML(r.batch)}</td>
      <td>${badgeForStatus(r.status)}</td></tr>`).join('')
      : `<tr><td colspan="3"><div class="empty-state"><i class="fa-regular fa-calendar"></i><h4>No attendance marked for this date</h4></div></td></tr>`;
  }

  function badgeForStatus(status){
    if(status==='present') return '<span class="badge badge-success">Present</span>';
    if(status==='late') return '<span class="badge badge-warn">Late</span>';
    return '<span class="badge badge-danger">Absent</span>';
  }

  /* ---------------- MONTHLY REPORT ---------------- */
  function setupMonthlyTab(){
    const now = new Date();
    document.getElementById('monthlyReportMonth').value = now.toISOString().slice(0,7);
    document.getElementById('monthlyReportMonth').addEventListener('change', renderMonthlyReport);
    document.getElementById('exportMonthly').addEventListener('click', ()=>{
      const rows = buildMonthlyRows().map(r=>({ Student:r.name, Batch:r.batch, PresentDays:r.present, AbsentDays:r.absent, AttendancePct:r.pct+'%' }));
      exportToCSV('attendance_monthly.csv', rows);
    });
    document.getElementById('printMonthly').addEventListener('click', printSection);
    renderMonthlyReport();
  }

  function buildMonthlyRows(){
    const month = document.getElementById('monthlyReportMonth').value; // YYYY-MM
    return students.map(s=>{
      const batch = batches.find(b=>b.id===s.batchId);
      const records = attendance.filter(a=>a.date.startsWith(month) && a.batchId===s.batchId);
      let present=0, absent=0, total=0;
      records.forEach(rec=>{
        const entry = rec.entries.find(e=>e.studentId===s.id);
        if(entry){
          total++;
          if(entry.status==='present'||entry.status==='late') present++; else absent++;
        }
      });
      const pct = total ? Math.round((present/total)*100) : 0;
      return { name:s.name, batch: batch?batch.name:'—', present, absent, pct };
    });
  }

  function renderMonthlyReport(){
    const rows = buildMonthlyRows();
    document.getElementById('monthlyReportBody').innerHTML = rows.map(r => `
      <tr>
        <td class="fw-700">${escapeHTML(r.name)}</td>
        <td>${escapeHTML(r.batch)}</td>
        <td>${r.present}</td>
        <td>${r.absent}</td>
        <td>
          <div class="flex items-center gap-8">
            <div class="progress-bar" style="width:80px;"><span style="width:${r.pct}%;"></span></div>
            <span class="text-sm fw-700">${r.pct}%</span>
          </div>
        </td>
      </tr>`).join('');
  }

  window.AttendanceModule = { selectChip };
})();
