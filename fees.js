/* =========================================================
   fees.js — Fee tracking, installments, payment history, receipts
   ========================================================= */
(function(){
  let students = [], fees = [], batches = [];
  let filters = { search:'', status:'' };
  let activeFeeId = null;

  document.addEventListener('DOMContentLoaded', () => {
    initLayout();
    loadData();
    renderStats();
    renderTable();
    wireEvents();
  });

  function loadData(){
    students = dbGet(DB.STUDENTS, []);
    fees = dbGet(DB.FEES, []);
    batches = dbGet(DB.BATCHES, []);
  }
  function studentOf(fee){ return students.find(s=>s.id===fee.studentId); }
  function batchName(id){ const b = batches.find(x=>x.id===id); return b?b.name:'—'; }
  function statusOf(fee){
    if(fee.paid<=0) return 'unpaid';
    if(fee.paid>=fee.totalFees) return 'paid';
    return 'partial';
  }

  function renderStats(){
    const totalFees = fees.reduce((s,f)=>s+f.totalFees,0);
    const paid = fees.reduce((s,f)=>s+f.paid,0);
    const pending = totalFees - paid;
    document.getElementById('feeStats').innerHTML = `
      <div class="card stat-card"><div class="stat-ico" style="background:var(--primary-light);color:var(--primary);"><i class="fa-solid fa-sack-dollar"></i></div><div class="stat-value">${formatCurrency(totalFees)}</div><div class="stat-label">Total Fees</div></div>
      <div class="card stat-card"><div class="stat-ico" style="background:var(--success-light);color:var(--success);"><i class="fa-solid fa-check-double"></i></div><div class="stat-value">${formatCurrency(paid)}</div><div class="stat-label">Fees Collected</div></div>
      <div class="card stat-card"><div class="stat-ico" style="background:var(--danger-light);color:var(--danger);"><i class="fa-solid fa-hourglass-half"></i></div><div class="stat-value">${formatCurrency(pending)}</div><div class="stat-label">Fees Pending</div></div>`;
  }

  function getFiltered(){
    return fees.filter(f=>{
      const s = studentOf(f);
      if(!s) return false;
      const q = filters.search.toLowerCase();
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q);
      const matchesStatus = !filters.status || statusOf(f)===filters.status;
      return matchesSearch && matchesStatus;
    });
  }

  function renderTable(){
    const rows = getFiltered();
    const tbody = document.getElementById('feesTableBody');
    if(!rows.length){
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-money-bill-wave"></i><h4>No fee records found</h4></div></td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(f => {
      const s = studentOf(f);
      const pending = f.totalFees - f.paid;
      const status = statusOf(f);
      const badge = status==='paid' ? '<span class="badge badge-success">Fully Paid</span>'
        : status==='partial' ? '<span class="badge badge-warn">Partial</span>'
        : '<span class="badge badge-danger">Unpaid</span>';
      return `
      <tr>
        <td><div class="cell-main"><div class="cell-avatar">${s.photo?`<img src="${s.photo}">`:initials(s.name)}</div><div><div class="cell-title">${escapeHTML(s.name)}</div><div class="cell-sub">${escapeHTML(s.admissionNo)}</div></div></div></td>
        <td>${formatCurrency(f.totalFees)}</td>
        <td style="color:var(--success);">${formatCurrency(f.paid)}</td>
        <td style="color:${pending>0?'var(--danger)':'var(--ink)'};">${formatCurrency(pending)}</td>
        <td>${badge}</td>
        <td><div class="row-actions" style="justify-content:flex-end;"><button class="btn btn-outline btn-sm" onclick="FeesModule.openFee('${f.id}')"><i class="fa-solid fa-eye"></i> View</button></div></td>
      </tr>`;
    }).join('');
  }

  function wireEvents(){
    document.getElementById('feeSearch').addEventListener('input', debounce(e=>{ filters.search=e.target.value; renderTable(); }, 250));
    document.getElementById('feeStatusFilter').addEventListener('change', e=>{ filters.status=e.target.value; renderTable(); });
    document.getElementById('feeExportBtn').addEventListener('click', ()=>{
      const rows = getFiltered().map(f=>{
        const s = studentOf(f);
        return { Student:s.name, AdmissionNo:s.admissionNo, TotalFees:f.totalFees, Paid:f.paid, Pending:f.totalFees-f.paid, Status:statusOf(f) };
      });
      exportToCSV('fees_report.csv', rows);
    });
    document.getElementById('feePrintBtn').addEventListener('click', printSection);
    document.getElementById('paymentForm').addEventListener('submit', collectPayment);
    document.getElementById('sendReminderBtn').addEventListener('click', sendReminder);
  }

  function openFee(feeId){
    activeFeeId = feeId;
    const fee = fees.find(f=>f.id===feeId);
    const s = studentOf(fee);
    if(!fee || !s) return;

    document.getElementById('feeStudentAvatar').innerHTML = s.photo?`<img src="${s.photo}">`:initials(s.name);
    document.getElementById('feeStudentName').textContent = s.name;
    document.getElementById('feeStudentMeta').textContent = `${s.admissionNo} · ${s.course} · ${batchName(s.batchId)}`;
    document.getElementById('feeTotalVal').textContent = formatCurrency(fee.totalFees);
    document.getElementById('feePaidVal').textContent = formatCurrency(fee.paid);
    document.getElementById('feePendingVal').textContent = formatCurrency(fee.totalFees-fee.paid);
    const pct = fee.totalFees ? Math.round((fee.paid/fee.totalFees)*100) : 0;
    document.getElementById('feeProgressBar').style.width = pct+'%';

    document.getElementById('paymentForm').reset();
    document.getElementById('paymentForm').querySelectorAll('.form-field').forEach(clearInvalid);

    renderPaymentHistory(fee);
    openModal('feeModal');
  }

  function renderPaymentHistory(fee){
    const tbody = document.getElementById('paymentHistoryBody');
    tbody.innerHTML = fee.payments.length ? fee.payments.slice().reverse().map(p => `
      <tr>
        <td class="fw-700">${escapeHTML(p.receiptNo)}</td>
        <td>${formatDate(p.date)}</td>
        <td>${formatCurrency(p.amount)}</td>
        <td><span class="badge badge-primary">${escapeHTML(p.mode)}</span></td>
        <td style="text-align:right;"><button class="btn btn-outline btn-sm" onclick="FeesModule.viewReceipt('${fee.id}','${p.id}')"><i class="fa-solid fa-receipt"></i></button></td>
      </tr>`).join('') : `<tr><td colspan="5"><div class="empty-state" style="padding:24px;"><i class="fa-regular fa-file-lines"></i><h4>No payments yet</h4></div></td></tr>`;
  }

  function collectPayment(e){
    e.preventDefault();
    const form = e.target;
    if(!validateRequired(form)) return;
    const fee = fees.find(f=>f.id===activeFeeId);
    if(!fee) return;

    const amount = Number(form.amount.value);
    const remaining = fee.totalFees - fee.paid;
    if(amount > remaining){
      markInvalid(form.amount.closest('.form-field'), `Amount exceeds pending balance of ${formatCurrency(remaining)}`);
      toast('Amount too high', `The pending balance is only ${formatCurrency(remaining)}.`, 'error');
      return;
    }

    const btn = document.getElementById('collectPayBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Processing...';

    setTimeout(()=>{
      const payment = { id: uid('PAY'), amount, date: todayISO(), mode: form.mode.value, receiptNo: 'RCPT' + Math.floor(1000+Math.random()*9000) };
      fee.payments.push(payment);
      fee.paid += amount;
      dbSet(DB.FEES, fees);

      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> Collect Payment';
      renderStats(); renderTable();
      openFee(fee.id); // refresh modal view
      toast('Payment collected', `${formatCurrency(amount)} recorded successfully.`, 'success');
      viewReceipt(fee.id, payment.id);
    }, 500);
  }

  function viewReceipt(feeId, paymentId){
    const fee = fees.find(f=>f.id===feeId);
    const s = studentOf(fee);
    const payment = fee.payments.find(p=>p.id===paymentId);
    const settings = dbGet(DB.SETTINGS, {});
    document.getElementById('receiptBody').innerHTML = `
      <div style="text-align:center;margin-bottom:16px;">
        <h3 style="font-size:17px;">${escapeHTML(settings.instituteName||'Coaching Institute')}</h3>
        <p class="muted text-sm">${escapeHTML(settings.address||'')}</p>
        <p class="muted text-sm">${escapeHTML(settings.phone||'')} · ${escapeHTML(settings.email||'')}</p>
      </div>
      <hr style="border:none;border-top:1px dashed var(--border);margin:12px 0;">
      <div class="flex justify-between text-sm mb-8"><span class="muted">Receipt No.</span><span class="fw-700">${escapeHTML(payment.receiptNo)}</span></div>
      <div class="flex justify-between text-sm mb-8"><span class="muted">Date</span><span class="fw-700">${formatDate(payment.date)}</span></div>
      <div class="flex justify-between text-sm mb-8"><span class="muted">Student</span><span class="fw-700">${escapeHTML(s.name)}</span></div>
      <div class="flex justify-between text-sm mb-8"><span class="muted">Admission No.</span><span class="fw-700">${escapeHTML(s.admissionNo)}</span></div>
      <div class="flex justify-between text-sm mb-8"><span class="muted">Payment Mode</span><span class="fw-700">${escapeHTML(payment.mode)}</span></div>
      <hr style="border:none;border-top:1px dashed var(--border);margin:12px 0;">
      <div class="flex justify-between" style="font-size:16px;"><span class="fw-700">Amount Paid</span><span class="fw-700" style="color:var(--success);">${formatCurrency(payment.amount)}</span></div>
      <p class="text-sm muted" style="text-align:center;margin-top:18px;">Thank you for your payment!</p>`;
    openModal('receiptModal');
  }

  function sendReminder(){
    const fee = fees.find(f=>f.id===activeFeeId);
    const s = studentOf(fee);
    const pending = fee.totalFees - fee.paid;
    if(pending<=0){ toast('No dues', `${s.name} has no pending fees.`, 'info'); return; }
    toast('Reminder sent', `A fee reminder for ${formatCurrency(pending)} was sent to ${s.parentName}.`, 'success');
  }

  window.FeesModule = { openFee, viewReceipt };
})();
