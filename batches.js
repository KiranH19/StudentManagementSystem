/* =========================================================
   batches.js — Batch CRUD, teacher assignment, student assignment
   ========================================================= */
(function(){
  let batches = [], teachers = [], students = [];
  let typeFilter = '';
  let assigningBatchId = null;

  document.addEventListener('DOMContentLoaded', () => {
    initLayout();
    loadData();
    populateTeacherSelect();
    renderGrid();
    wireEvents();
  });

  function loadData(){
    batches = dbGet(DB.BATCHES, []);
    teachers = dbGet(DB.TEACHERS, []);
    students = dbGet(DB.STUDENTS, []);
  }
  function teacherName(id){ const t = teachers.find(x=>x.id===id); return t?t.name:'Unassigned'; }
  function studentCount(batchId){ return students.filter(s=>s.batchId===batchId).length; }

  function populateTeacherSelect(){
    document.getElementById('teacherSelect').innerHTML = teachers.map(t=>`<option value="${t.id}">${escapeHTML(t.name)} (${escapeHTML(t.subject)})</option>`).join('');
  }

  function renderGrid(){
    const filtered = typeFilter ? batches.filter(b=>b.type===typeFilter) : batches;
    const grid = document.getElementById('batchGrid');
    if(!filtered.length){
      grid.innerHTML = `<div class="card empty-state" style="grid-column:1/-1;"><i class="fa-solid fa-layer-group"></i><h4>No batches found</h4><p class="text-sm">Create a new batch to get started.</p></div>`;
      return;
    }
    grid.innerHTML = filtered.map(b=>{
      const count = studentCount(b.id);
      const pct = Math.min(100, Math.round((count/b.capacity)*100));
      return `
      <div class="card">
        <div class="card-head">
          <div>
            <h3>${escapeHTML(b.name)}</h3>
            <span class="badge badge-primary" style="margin-top:6px;">${escapeHTML(b.course)}</span>
            <span class="badge badge-gray" style="margin-top:6px;">${escapeHTML(b.type)}</span>
          </div>
          <div class="row-actions">
            <button class="btn btn-outline btn-icon" onclick="BatchesModule.editBatch('${b.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-outline btn-icon" onclick="BatchesModule.deleteBatch('${b.id}')" style="color:var(--danger);"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="text-sm muted mb-8"><i class="fa-solid fa-chalkboard-user"></i> ${escapeHTML(teacherName(b.teacherId))}</div>
        <div class="text-sm muted mb-16"><i class="fa-regular fa-clock"></i> ${escapeHTML(b.timing)}</div>
        <div class="flex justify-between text-sm mb-8"><span class="fw-700">Strength</span><span class="muted">${count} / ${b.capacity}</span></div>
        <div class="progress-bar mb-16"><span style="width:${pct}%;"></span></div>
        <button class="btn btn-outline btn-block btn-sm" onclick="BatchesModule.openAssign('${b.id}')"><i class="fa-solid fa-user-plus"></i> Assign Students</button>
      </div>`;
    }).join('');
  }

  function wireEvents(){
    document.querySelectorAll('#batchTypeFilter .chip').forEach(chip=>{
      chip.addEventListener('click', ()=>{
        document.querySelectorAll('#batchTypeFilter .chip').forEach(c=>c.classList.remove('active'));
        chip.classList.add('active');
        typeFilter = chip.dataset.type;
        renderGrid();
      });
    });
    document.getElementById('addBatchBtn').addEventListener('click', ()=>openBatchForm());
    document.getElementById('saveBatchBtn').addEventListener('click', saveBatch);
  }

  function openBatchForm(batch){
    const form = document.getElementById('batchForm');
    form.reset();
    form.querySelectorAll('.form-field').forEach(clearInvalid);
    if(batch){
      document.getElementById('batchModalTitle').textContent = 'Edit Batch';
      form.id.value = batch.id;
      form.name.value = batch.name;
      form.type.value = batch.type;
      form.course.value = batch.course;
      form.teacherId.value = batch.teacherId;
      form.capacity.value = batch.capacity;
      form.timing.value = batch.timing;
    } else {
      document.getElementById('batchModalTitle').textContent = 'Create Batch';
      form.id.value = '';
    }
    openModal('batchModal');
  }

  function saveBatch(){
    const form = document.getElementById('batchForm');
    if(!validateRequired(form)){ toast('Missing information', 'Please fill all required fields.', 'error'); return; }
    const id = form.id.value;
    const data = {
      id: id || uid('BAT'),
      name: form.name.value.trim(), type: form.type.value, course: form.course.value,
      teacherId: form.teacherId.value, capacity: Number(form.capacity.value)||1, timing: form.timing.value.trim()
    };
    if(id){ batches = batches.map(b=>b.id===id?data:b); }
    else { batches.push(data); }
    dbSet(DB.BATCHES, batches);
    closeModal('batchModal');
    renderGrid();
    toast(id?'Batch updated':'Batch created', `${data.name} has been saved.`, 'success');
  }

  function editBatch(id){
    const batch = batches.find(b=>b.id===id);
    if(batch) openBatchForm(batch);
  }

  async function deleteBatch(id){
    const batch = batches.find(b=>b.id===id);
    const count = studentCount(id);
    if(count>0){
      toast('Cannot delete batch', `${count} students are still assigned to this batch. Reassign them first.`, 'error');
      return;
    }
    const ok = await confirmDialog({ title:'Delete batch?', message:`This will permanently remove "${batch?batch.name:''}".`, confirmText:'Delete' });
    if(!ok) return;
    batches = batches.filter(b=>b.id!==id);
    dbSet(DB.BATCHES, batches);
    renderGrid();
    toast('Batch deleted', 'The batch has been removed.', 'success');
  }

  function openAssign(batchId){
    assigningBatchId = batchId;
    const batch = batches.find(b=>b.id===batchId);
    const unassigned = students.filter(s=>s.batchId!==batchId);
    const list = document.getElementById('assignList');
    list.innerHTML = unassigned.length ? unassigned.map(s=>`
      <div class="flex items-center justify-between" style="padding:10px 4px;border-bottom:1px solid var(--border-soft);">
        <div class="cell-main"><div class="cell-avatar">${initials(s.name)}</div><div><div class="cell-title">${escapeHTML(s.name)}</div><div class="cell-sub">${escapeHTML(s.admissionNo)} · currently: ${escapeHTML(batches.find(b=>b.id===s.batchId)?.name||'—')}</div></div></div>
        <button class="btn btn-outline btn-sm" onclick="BatchesModule.assignStudent('${s.id}')"><i class="fa-solid fa-arrow-right-to-bracket"></i> Assign</button>
      </div>`).join('') : `<div class="empty-state"><i class="fa-solid fa-users"></i><h4>All students are already in this batch</h4></div>`;
    openModal('assignModal');
  }

  function assignStudent(studentId){
    students = students.map(s=> s.id===studentId ? {...s, batchId:assigningBatchId} : s);
    dbSet(DB.STUDENTS, students);
    toast('Student assigned', 'The student has been moved to this batch.', 'success');
    openAssign(assigningBatchId); // refresh
    renderGrid();
  }

  window.BatchesModule = { editBatch, deleteBatch, openAssign, assignStudent };
})();
