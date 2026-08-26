/* =========================================================
   exams.js — Create exams, enter marks, results, rank list, pass/fail
   Exam record: { id, name, batchId, date, maxMarks, passMarks, marks:{studentId:score} }
   ========================================================= */
(function(){
  let exams = [], batches = [], students = [];
  let activeExamId = null;

  document.addEventListener('DOMContentLoaded', () => {
    initLayout();
    exams = dbGet(DB.EXAMS, []);
    batches = dbGet(DB.BATCHES, []);
    students = dbGet(DB.STUDENTS, []);

    document.getElementById('examBatchSelect').innerHTML = batches.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');
    renderGrid();
    wireEvents();
  });

  function batchName(id){ const b = batches.find(x=>x.id===id); return b?b.name:'—'; }

  function renderGrid(){
    const grid = document.getElementById('examGrid');
    if(!exams.length){
      grid.innerHTML = `<div class="card empty-state" style="grid-column:1/-1;"><i class="fa-solid fa-file-pen"></i><h4>No exams created yet</h4><p class="text-sm">Create your first exam to get started.</p></div>`;
      return;
    }
    grid.innerHTML = exams.slice().reverse().map(ex=>{
      const roster = students.filter(s=>s.batchId===ex.batchId);
      const entered = Object.keys(ex.marks||{}).length;
      const isUpcoming = new Date(ex.date) >= new Date(todayISO());
      return `
      <div class="card">
        <div class="card-head">
          <div><h3>${escapeHTML(ex.name)}</h3><span class="badge badge-primary" style="margin-top:6px;">${escapeHTML(batchName(ex.batchId))}</span></div>
          <span class="badge ${isUpcoming?'badge-warn':'badge-success'}">${isUpcoming?'Upcoming':'Completed'}</span>
        </div>
        <div class="text-sm muted mb-8"><i class="fa-regular fa-calendar"></i> ${formatDate(ex.date)}</div>
        <div class="text-sm muted mb-16"><i class="fa-solid fa-star"></i> Max Marks: ${ex.maxMarks} · Pass: ${ex.passMarks}</div>
        <div class="flex justify-between text-sm mb-8"><span class="fw-700">Marks Entered</span><span class="muted">${entered} / ${roster.length}</span></div>
        <div class="progress-bar mb-16"><span style="width:${roster.length?Math.round(entered/roster.length*100):0}%;"></span></div>
        <button class="btn btn-outline btn-block btn-sm" onclick="ExamsModule.openMarks('${ex.id}')"><i class="fa-solid fa-pen-to-square"></i> Enter Marks / View Results</button>
      </div>`;
    }).join('');
  }

  function wireEvents(){
    document.getElementById('addExamBtn').addEventListener('click', ()=>{
      document.getElementById('examForm').reset();
      document.getElementById('examForm').querySelectorAll('.form-field').forEach(clearInvalid);
      openModal('examModal');
    });
    document.getElementById('saveExamBtn').addEventListener('click', saveExam);
    document.getElementById('saveMarksBtn').addEventListener('click', saveMarks);
    document.getElementById('exportResultsBtn').addEventListener('click', exportResults);

    document.querySelectorAll('#marksModal .tab-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#marksModal .tab-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.mtab;
        document.getElementById('mtab-entry').style.display = tab==='entry' ? 'block':'none';
        document.getElementById('mtab-results').style.display = tab==='results' ? 'block':'none';
        if(tab==='results') renderResults();
      });
    });
  }

  function saveExam(){
    const form = document.getElementById('examForm');
    if(!validateRequired(form)){ toast('Missing information', 'Please fill all required fields.', 'error'); return; }
    const passMarks = Number(form.passMarks.value), maxMarks = Number(form.maxMarks.value);
    if(passMarks > maxMarks){
      markInvalid(form.passMarks.closest('.form-field'), 'Passing marks cannot exceed max marks');
      return;
    }
    const exam = {
      id: uid('EXM'), name: form.name.value.trim(), batchId: form.batchId.value,
      date: form.date.value, maxMarks, passMarks, marks:{}
    };
    exams.push(exam);
    dbSet(DB.EXAMS, exams);
    closeModal('examModal');
    renderGrid();
    toast('Exam created', `${exam.name} has been scheduled.`, 'success');
  }

  function openMarks(examId){
    activeExamId = examId;
    const exam = exams.find(e=>e.id===examId);
    document.getElementById('marksModalTitle').textContent = `${exam.name} — ${batchName(exam.batchId)}`;
    // reset to entry tab
    document.querySelectorAll('#marksModal .tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelector('#marksModal .tab-btn[data-mtab="entry"]').classList.add('active');
    document.getElementById('mtab-entry').style.display='block';
    document.getElementById('mtab-results').style.display='none';

    const roster = students.filter(s=>s.batchId===exam.batchId);
    const tbody = document.getElementById('marksEntryBody');
    tbody.innerHTML = roster.length ? roster.map(s=>{
      const score = exam.marks && exam.marks[s.id] !== undefined ? exam.marks[s.id] : '';
      return `
      <tr data-student="${s.id}">
        <td><div class="cell-main"><div class="cell-avatar">${initials(s.name)}</div><div class="cell-title">${escapeHTML(s.name)}</div></div></td>
        <td>${escapeHTML(s.rollNo)}</td>
        <td><input type="number" min="0" max="${exam.maxMarks}" class="marks-input" value="${score}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);"></td>
      </tr>`;
    }).join('') : `<tr><td colspan="3"><div class="empty-state"><i class="fa-solid fa-user-graduate"></i><h4>No students in this batch</h4></div></td></tr>`;

    openModal('marksModal');
  }

  function saveMarks(){
    const exam = exams.find(e=>e.id===activeExamId);
    if(!exam) return;
    exam.marks = exam.marks || {};
    document.querySelectorAll('#marksEntryBody tr[data-student]').forEach(row=>{
      const studentId = row.dataset.student;
      const val = row.querySelector('.marks-input').value;
      if(val !== ''){
        let score = Math.min(Number(val), exam.maxMarks);
        score = Math.max(0, score);
        exam.marks[studentId] = score;
      }
    });
    dbSet(DB.EXAMS, exams);
    renderGrid();
    toast('Marks saved', `Results updated for ${exam.name}.`, 'success');
    renderResults();
    document.querySelector('#marksModal .tab-btn[data-mtab="results"]').click();
  }

  function renderResults(){
    const exam = exams.find(e=>e.id===activeExamId);
    if(!exam) return;
    const roster = students.filter(s=>s.batchId===exam.batchId);
    const rows = roster
      .filter(s => exam.marks && exam.marks[s.id] !== undefined)
      .map(s => {
        const score = exam.marks[s.id];
        const pct = Math.round((score/exam.maxMarks)*100);
        return { name:s.name, rollNo:s.rollNo, score, pct, pass: score >= exam.passMarks };
      })
      .sort((a,b)=>b.score-a.score);

    const passed = rows.filter(r=>r.pass).length;
    const avg = rows.length ? Math.round(rows.reduce((s,r)=>s+r.pct,0)/rows.length) : 0;
    document.getElementById('resultStats').innerHTML = `
      <div class="card stat-card" style="box-shadow:none;border:1px solid var(--border);"><div class="stat-ico" style="background:var(--success-light);color:var(--success);"><i class="fa-solid fa-check"></i></div><div class="stat-value">${passed}</div><div class="stat-label">Passed</div></div>
      <div class="card stat-card" style="box-shadow:none;border:1px solid var(--border);"><div class="stat-ico" style="background:var(--danger-light);color:var(--danger);"><i class="fa-solid fa-xmark"></i></div><div class="stat-value">${rows.length-passed}</div><div class="stat-label">Failed</div></div>
      <div class="card stat-card" style="box-shadow:none;border:1px solid var(--border);"><div class="stat-ico" style="background:var(--primary-light);color:var(--primary);"><i class="fa-solid fa-chart-simple"></i></div><div class="stat-value">${avg}%</div><div class="stat-label">Average %</div></div>`;

    document.getElementById('rankListBody').innerHTML = rows.length ? rows.map((r,i) => `
      <tr>
        <td class="fw-700">#${i+1}</td>
        <td>${escapeHTML(r.name)}</td>
        <td>${r.score} / ${exam.maxMarks}</td>
        <td>${r.pct}%</td>
        <td>${r.pass ? '<span class="badge badge-success">Pass</span>' : '<span class="badge badge-danger">Fail</span>'}</td>
      </tr>`).join('') : `<tr><td colspan="5"><div class="empty-state"><i class="fa-solid fa-file-pen"></i><h4>No marks entered yet</h4></div></td></tr>`;
  }

  function exportResults(){
    const exam = exams.find(e=>e.id===activeExamId);
    if(!exam) return;
    const roster = students.filter(s=>s.batchId===exam.batchId);
    const rows = roster.filter(s=>exam.marks && exam.marks[s.id]!==undefined).map(s=>{
      const score = exam.marks[s.id];
      return { Student:s.name, RollNo:s.rollNo, Marks:score, MaxMarks:exam.maxMarks, Percentage:Math.round((score/exam.maxMarks)*100)+'%', Result: score>=exam.passMarks?'Pass':'Fail' };
    });
    exportToCSV(`${exam.name.replace(/\s+/g,'_')}_results.csv`, rows);
  }

  window.ExamsModule = { openMarks };
})();
