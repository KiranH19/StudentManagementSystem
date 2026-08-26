/* =========================================================
   teachers.js — Teacher CRUD, subject/contact/salary, batch assignment view
   ========================================================= */
(function(){
  let teachers = [], batches = [];
  let searchQ = '';

  document.addEventListener('DOMContentLoaded', () => {
    initLayout();
    teachers = dbGet(DB.TEACHERS, []);
    batches = dbGet(DB.BATCHES, []);
    renderTable();
    wireEvents();
  });

  function assignedBatches(teacherId){
    return batches.filter(b=>b.teacherId===teacherId).map(b=>b.name);
  }

  function renderTable(){
    const q = searchQ.toLowerCase();
    const rows = teachers.filter(t => !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q));
    const tbody = document.getElementById('teachersTableBody');
    if(!rows.length){
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-chalkboard-user"></i><h4>No teachers found</h4></div></td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(t=>{
      const batchNames = assignedBatches(t.id);
      return `
      <tr>
        <td><div class="cell-main"><div class="cell-avatar">${initials(t.name)}</div><div class="cell-title">${escapeHTML(t.name)}</div></div></td>
        <td><span class="badge badge-primary">${escapeHTML(t.subject)}</span></td>
        <td><div class="cell-sub">${escapeHTML(t.phone)}</div><div class="cell-sub">${escapeHTML(t.email)}</div></td>
        <td>${batchNames.length ? batchNames.map(n=>`<span class="badge badge-gray" style="margin:2px;">${escapeHTML(n)}</span>`).join('') : '<span class="muted text-sm">None</span>'}</td>
        <td>${formatCurrency(t.salary)}</td>
        <td><div class="row-actions" style="justify-content:flex-end;">
          <button class="btn btn-outline btn-icon" onclick="TeachersModule.editTeacher('${t.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-outline btn-icon" onclick="TeachersModule.deleteTeacher('${t.id}')" style="color:var(--danger);"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`;
    }).join('');
  }

  function wireEvents(){
    document.getElementById('teacherSearch').addEventListener('input', debounce(e=>{ searchQ=e.target.value; renderTable(); }, 250));
    document.getElementById('addTeacherBtn').addEventListener('click', ()=>openForm());
    document.getElementById('saveTeacherBtn').addEventListener('click', saveTeacher);
  }

  function openForm(teacher){
    const form = document.getElementById('teacherForm');
    form.reset();
    form.querySelectorAll('.form-field').forEach(clearInvalid);
    if(teacher){
      document.getElementById('teacherModalTitle').textContent = 'Edit Teacher';
      form.id.value = teacher.id; form.name.value = teacher.name; form.phone.value = teacher.phone;
      form.email.value = teacher.email; form.subject.value = teacher.subject; form.salary.value = teacher.salary;
    } else {
      document.getElementById('teacherModalTitle').textContent = 'Add Teacher';
      form.id.value = '';
    }
    openModal('teacherModal');
  }

  function saveTeacher(){
    const form = document.getElementById('teacherForm');
    if(!validateRequired(form)){ toast('Missing information', 'Please fill all required fields.', 'error'); return; }
    const id = form.id.value;
    const data = {
      id: id || uid('TCH'), name: form.name.value.trim(), phone: form.phone.value.trim(),
      email: form.email.value.trim(), subject: form.subject.value.trim(), salary: Number(form.salary.value)||0, batches:[]
    };
    if(id){ teachers = teachers.map(t=>t.id===id?{...data}:t); }
    else { teachers.push(data); }
    dbSet(DB.TEACHERS, teachers);
    closeModal('teacherModal');
    renderTable();
    toast(id?'Teacher updated':'Teacher added', `${data.name} has been saved.`, 'success');
  }

  function editTeacher(id){
    const t = teachers.find(x=>x.id===id);
    if(t) openForm(t);
  }

  async function deleteTeacher(id){
    const assigned = batches.filter(b=>b.teacherId===id);
    if(assigned.length){
      toast('Cannot delete teacher', `This teacher is assigned to ${assigned.length} batch(es). Reassign first.`, 'error');
      return;
    }
    const teacher = teachers.find(t=>t.id===id);
    const ok = await confirmDialog({ title:'Delete teacher?', message:`Remove ${teacher?teacher.name:'this teacher'} from your faculty list?`, confirmText:'Delete' });
    if(!ok) return;
    teachers = teachers.filter(t=>t.id!==id);
    dbSet(DB.TEACHERS, teachers);
    renderTable();
    toast('Teacher deleted', 'The teacher record has been removed.', 'success');
  }

  window.TeachersModule = { editTeacher, deleteTeacher };
})();
