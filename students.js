/* =========================================================
   students.js — Student CRUD, search, filter, pagination, profile
   ========================================================= */
(function(){
  let students = [];
  let batches = [];
  let currentPage = 1;
  const PAGE_SIZE = 8;
  let filters = { search:'', batch:'', status:'' };

  document.addEventListener('DOMContentLoaded', () => {
    initLayout();
    loadData();
    populateBatchFilters();
    renderTable();
    wireEvents();
  });

  function loadData(){
    students = dbGet(DB.STUDENTS, []);
    batches = dbGet(DB.BATCHES, []);
  }

  function batchName(id){
    const b = batches.find(x=>x.id===id);
    return b ? b.name : '—';
  }
  function studentFees(studentId){
    const fees = dbGet(DB.FEES, []);
    return fees.find(f=>f.studentId===studentId);
  }

  function populateBatchFilters(){
    const filterSel = document.getElementById('filterBatch');
    const formSel = document.getElementById('batchSelect');
    batches.forEach(b=>{
      filterSel.insertAdjacentHTML('beforeend', `<option value="${b.id}">${escapeHTML(b.name)}</option>`);
      formSel.insertAdjacentHTML('beforeend', `<option value="${b.id}">${escapeHTML(b.name)}</option>`);
    });
  }

  function getFiltered(){
    return students.filter(s=>{
      const q = filters.search.toLowerCase();
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q);
      const matchesBatch = !filters.batch || s.batchId === filters.batch;
      const matchesStatus = !filters.status || s.status === filters.status;
      return matchesSearch && matchesBatch && matchesStatus;
    });
  }

  function renderTable(){
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage-1)*PAGE_SIZE;
    const pageItems = filtered.slice(start, start+PAGE_SIZE);
    const tbody = document.getElementById('studentsTableBody');

    if(!pageItems.length){
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-user-graduate"></i><h4>No students found</h4><p class="text-sm">Try adjusting your search or filters.</p></div></td></tr>`;
    } else {
      tbody.innerHTML = pageItems.map(s => {
        const fee = studentFees(s.id);
        const pending = fee ? (fee.totalFees - fee.paid) : s.totalFees;
        return `
        <tr>
          <td>
            <div class="cell-main">
              <div class="cell-avatar">${s.photo ? `<img src="${s.photo}">` : initials(s.name)}</div>
              <div><div class="cell-title">${escapeHTML(s.name)}</div><div class="cell-sub">${escapeHTML(s.parentPhone||'')}</div></div>
            </div>
          </td>
          <td>${escapeHTML(s.admissionNo)}</td>
          <td>${escapeHTML(s.rollNo)}</td>
          <td><div class="cell-title" style="font-size:12.8px;">${escapeHTML(s.course)}</div><div class="cell-sub">${escapeHTML(batchName(s.batchId))}</div></td>
          <td>${pending>0 ? `<span class="badge badge-warn">${formatCurrency(pending)} due</span>` : `<span class="badge badge-success">Paid</span>`}</td>
          <td>${s.status==='active' ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <button class="btn btn-outline btn-icon" title="View" onclick="StudentsModule.viewProfile('${s.id}')"><i class="fa-solid fa-eye"></i></button>
              <button class="btn btn-outline btn-icon" title="Edit" onclick="StudentsModule.editStudent('${s.id}')"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-outline btn-icon" title="Delete" onclick="StudentsModule.deleteStudent('${s.id}')" style="color:var(--danger);"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    document.getElementById('paginationInfo').textContent = filtered.length
      ? `Showing ${start+1}-${Math.min(start+PAGE_SIZE, filtered.length)} of ${filtered.length} students`
      : 'No students to show';

    const btnWrap = document.getElementById('paginationBtns');
    let btnsHtml = '';
    for(let p=1; p<=totalPages; p++){
      btnsHtml += `<button class="${p===currentPage?'active':''}" onclick="StudentsModule.goToPage(${p})">${p}</button>`;
    }
    btnWrap.innerHTML = btnsHtml;
  }

  function wireEvents(){
    document.getElementById('studentSearch').addEventListener('input', debounce(e=>{
      filters.search = e.target.value; currentPage = 1; renderTable();
    }, 250));
    document.getElementById('filterBatch').addEventListener('change', e=>{ filters.batch = e.target.value; currentPage=1; renderTable(); });
    document.getElementById('filterStatus').addEventListener('change', e=>{ filters.status = e.target.value; currentPage=1; renderTable(); });

    document.getElementById('addStudentBtn').addEventListener('click', ()=> openStudentForm());
    document.getElementById('saveStudentBtn').addEventListener('click', saveStudent);

    document.getElementById('exportBtn').addEventListener('click', ()=>{
      const rows = getFiltered().map(s => ({
        Name:s.name, AdmissionNo:s.admissionNo, RollNo:s.rollNo, Course:s.course,
        Batch:batchName(s.batchId), ParentName:s.parentName, ParentPhone:s.parentPhone,
        AadharNo:s.aadharNo||'', SatsNo:s.satsNo||'',
        TotalFees:s.totalFees, JoinDate:s.joinDate, Status:s.status
      }));
      exportToCSV('students_report.csv', rows);
    });
    document.getElementById('printBtn').addEventListener('click', printSection);

    // Photo upload preview
    const photoBox = document.getElementById('photoUploadBox');
    const photoInput = document.getElementById('photoInput');
    photoBox.addEventListener('click', ()=>photoInput.click());
    photoInput.addEventListener('change', ()=>{
      const file = photoInput.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const preview = document.getElementById('photoPreview');
        preview.src = e.target.result; preview.style.display='block';
        document.getElementById('photoIcon').style.display='none';
      };
      reader.readAsDataURL(file);
    });
  }

  function openStudentForm(student){
    const form = document.getElementById('studentForm');
    form.reset();
    form.querySelectorAll('.form-field').forEach(clearInvalid);
    document.getElementById('photoPreview').style.display='none';
    document.getElementById('photoPreview').src='';
    document.getElementById('photoIcon').style.display='block';

    if(student){
      document.getElementById('studentModalTitle').textContent = 'Edit Student';
      form.id.value = student.id;
      form.name.value = student.name;
      form.admissionNo.value = student.admissionNo;
      form.rollNo.value = student.rollNo;
      form.dob.value = student.dob||'';
      form.course.value = student.course;
      form.batchId.value = student.batchId;
      form.parentName.value = student.parentName;
      form.parentPhone.value = student.parentPhone;
      form.aadharNo.value = student.aadharNo||'';
      form.satsNo.value = student.satsNo||'';
      form.address.value = student.address||'';
      form.totalFees.value = student.totalFees;
      form.joinDate.value = student.joinDate;
      form.status.value = student.status||'active';
      if(student.photo){
        document.getElementById('photoPreview').src = student.photo;
        document.getElementById('photoPreview').style.display='block';
        document.getElementById('photoIcon').style.display='none';
      }
    } else {
      document.getElementById('studentModalTitle').textContent = 'Add Student';
      form.id.value = '';
      form.joinDate.value = todayISO();
    }
    openModal('studentModal');
  }

  function saveStudent(){
    const form = document.getElementById('studentForm');
    if(!validateRequired(form)) { toast('Missing information', 'Please fill all required fields.', 'error'); return; }

    const id = form.id.value;
    const admissionNo = form.admissionNo.value.trim();

    // Prevent duplicate admission numbers
    const dupe = students.find(s => s.admissionNo.toLowerCase() === admissionNo.toLowerCase() && s.id !== id);
    if(dupe){
      markInvalid(form.admissionNo.closest('.form-field'), 'This admission number is already in use');
      toast('Duplicate admission number', `Admission number ${admissionNo} already belongs to ${dupe.name}.`, 'error');
      return;
    }

    // Aadhar/SATS are optional, but validate format and uniqueness if provided
    const aadharNo = form.aadharNo.value.replace(/\s/g,'').trim();
    if(aadharNo && !/^\d{12}$/.test(aadharNo)){
      markInvalid(form.aadharNo.closest('.form-field'), 'Aadhar number must be exactly 12 digits');
      toast('Invalid Aadhar number', 'Aadhar number must be exactly 12 digits.', 'error');
      return;
    }
    if(aadharNo){
      const dupeAadhar = students.find(s => s.aadharNo === aadharNo && s.id !== id);
      if(dupeAadhar){
        markInvalid(form.aadharNo.closest('.form-field'), 'This Aadhar number is already on record');
        toast('Duplicate Aadhar number', `This Aadhar number already belongs to ${dupeAadhar.name}.`, 'error');
        return;
      }
    }
    const satsNo = form.satsNo.value.trim();
    if(satsNo && !/^[A-Za-z0-9]{4,15}$/.test(satsNo)){
      markInvalid(form.satsNo.closest('.form-field'), 'Enter a valid SATS number');
      toast('Invalid SATS number', 'SATS number should be 4–15 letters/digits.', 'error');
      return;
    }
    if(satsNo){
      const dupeSats = students.find(s => s.satsNo && s.satsNo.toLowerCase() === satsNo.toLowerCase() && s.id !== id);
      if(dupeSats){
        markInvalid(form.satsNo.closest('.form-field'), 'This SATS number is already on record');
        toast('Duplicate SATS number', `This SATS number already belongs to ${dupeSats.name}.`, 'error');
        return;
      }
    }

    const btn = document.getElementById('saveStudentBtn');
    const btnText = document.getElementById('saveStudentText');
    btn.disabled = true; btnText.innerHTML = '<span class="spinner"></span> Saving...';

    setTimeout(()=>{
      const photo = document.getElementById('photoPreview').src && document.getElementById('photoPreview').style.display!=='none'
        ? document.getElementById('photoPreview').src : '';

      const data = {
        id: id || uid('STU'),
        admissionNo, rollNo: form.rollNo.value.trim(), name: form.name.value.trim(),
        photo, dob: form.dob.value, parentName: form.parentName.value.trim(),
        parentPhone: form.parentPhone.value.trim(), aadharNo, satsNo, address: form.address.value.trim(),
        course: form.course.value, batchId: form.batchId.value,
        totalFees: Number(form.totalFees.value)||0, joinDate: form.joinDate.value,
        status: form.status.value
      };

      const fees = dbGet(DB.FEES, []);
      if(id){
        students = students.map(s => s.id===id ? data : s);
        const feeIdx = fees.findIndex(f=>f.studentId===id);
        if(feeIdx>-1){ fees[feeIdx].totalFees = data.totalFees; }
      } else {
        students.push(data);
        fees.push({ id: uid('FEE'), studentId: data.id, totalFees: data.totalFees, paid:0, payments:[] });
      }
      dbSet(DB.STUDENTS, students);
      dbSet(DB.FEES, fees);

      btn.disabled = false; btnText.textContent = 'Save Student';
      closeModal('studentModal');
      renderTable();
      toast(id ? 'Student updated' : 'Student added', `${data.name} has been saved successfully.`, 'success');
    }, 500);
  }

  async function deleteStudent(id){
    const student = students.find(s=>s.id===id);
    const ok = await confirmDialog({
      title:'Delete student?',
      message:`This will permanently remove ${student ? student.name : 'this student'} and their fee records.`,
      confirmText:'Delete'
    });
    if(!ok) return;
    students = students.filter(s=>s.id!==id);
    dbSet(DB.STUDENTS, students);
    dbSet(DB.FEES, dbGet(DB.FEES, []).filter(f=>f.studentId!==id));
    renderTable();
    toast('Student deleted', 'The student record has been removed.', 'success');
  }

  function editStudent(id){
    const student = students.find(s=>s.id===id);
    if(student) openStudentForm(student);
  }

  function viewProfile(id){
    const s = students.find(x=>x.id===id);
    if(!s) return;
    const fee = studentFees(id);
    const paidPct = fee && fee.totalFees ? Math.round((fee.paid/fee.totalFees)*100) : 0;
    document.getElementById('profileBody').innerHTML = `
      <div class="flex items-center gap-12 mb-16">
        <div class="cell-avatar" style="width:64px;height:64px;font-size:20px;">${s.photo?`<img src="${s.photo}">`:initials(s.name)}</div>
        <div>
          <h3 style="font-size:19px;">${escapeHTML(s.name)}</h3>
          <p class="muted text-sm">${escapeHTML(s.course)} · ${escapeHTML(batchName(s.batchId))}</p>
          <span class="badge ${s.status==='active'?'badge-success':'badge-gray'}" style="margin-top:6px;">${s.status}</span>
        </div>
      </div>
      <div class="grid grid-2" style="gap:14px;">
        <div class="card" style="box-shadow:none;background:var(--surface-2);"><div class="muted text-sm">Admission No.</div><div class="fw-700">${escapeHTML(s.admissionNo)}</div></div>
        <div class="card" style="box-shadow:none;background:var(--surface-2);"><div class="muted text-sm">Roll No.</div><div class="fw-700">${escapeHTML(s.rollNo)}</div></div>
        <div class="card" style="box-shadow:none;background:var(--surface-2);"><div class="muted text-sm">Date of Birth</div><div class="fw-700">${formatDate(s.dob)}</div></div>
        <div class="card" style="box-shadow:none;background:var(--surface-2);"><div class="muted text-sm">Join Date</div><div class="fw-700">${formatDate(s.joinDate)}</div></div>
        <div class="card" style="box-shadow:none;background:var(--surface-2);"><div class="muted text-sm">Parent / Guardian</div><div class="fw-700">${escapeHTML(s.parentName)}</div></div>
        <div class="card" style="box-shadow:none;background:var(--surface-2);"><div class="muted text-sm">Parent Phone</div><div class="fw-700">${escapeHTML(s.parentPhone)}</div></div>
        <div class="card" style="box-shadow:none;background:var(--surface-2);"><div class="muted text-sm">Aadhar Number</div><div class="fw-700">${escapeHTML(s.aadharNo || '—')}</div></div>
        <div class="card" style="box-shadow:none;background:var(--surface-2);"><div class="muted text-sm">SATS Number</div><div class="fw-700">${escapeHTML(s.satsNo || '—')}</div></div>
        <div class="card full" style="grid-column:1/-1;box-shadow:none;background:var(--surface-2);"><div class="muted text-sm">Address</div><div class="fw-700">${escapeHTML(s.address||'—')}</div></div>
      </div>
      <div class="card mt-16" style="box-shadow:none;border:1px solid var(--border);">
        <div class="card-head"><h3 style="font-size:14px;">Fee Summary</h3><span class="muted text-sm">${paidPct}% paid</span></div>
        <div class="progress-bar mb-16"><span style="width:${paidPct}%"></span></div>
        <div class="grid grid-3">
          <div><div class="muted text-sm">Total</div><div class="fw-700">${formatCurrency(fee?fee.totalFees:s.totalFees)}</div></div>
          <div><div class="muted text-sm">Paid</div><div class="fw-700" style="color:var(--success);">${formatCurrency(fee?fee.paid:0)}</div></div>
          <div><div class="muted text-sm">Pending</div><div class="fw-700" style="color:var(--danger);">${formatCurrency(fee?(fee.totalFees-fee.paid):s.totalFees)}</div></div>
        </div>
      </div>`;
    openModal('profileModal');
  }

  function goToPage(p){ currentPage = p; renderTable(); }

  // Expose to global scope for inline onclick handlers
  window.StudentsModule = { editStudent, deleteStudent, viewProfile, goToPage };
})();
