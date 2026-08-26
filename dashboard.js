/* =========================================================
   dashboard.js — Stats, charts, activity feed for dashboard.html
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  initLayout();

  const students = dbGet(DB.STUDENTS, []);
  const batches = dbGet(DB.BATCHES, []);
  const fees = dbGet(DB.FEES, []);
  const attendance = dbGet(DB.ATTENDANCE, []);
  const exams = dbGet(DB.EXAMS, []);

  /* ---------- Stat calculations ---------- */
  const totalStudents = students.length;
  const activeBatches = batches.length;
  const feeCollected = fees.reduce((sum,f)=>sum+(f.paid||0),0);
  const feePending = fees.reduce((sum,f)=>sum+((f.totalFees||0)-(f.paid||0)),0);

  const today = todayISO();
  const todaysRecord = attendance.find(a => a.date === today);
  let presentPct = 0;
  if(todaysRecord && todaysRecord.entries && todaysRecord.entries.length){
    const present = todaysRecord.entries.filter(e=>e.status==='present' || e.status==='late').length;
    presentPct = Math.round((present / todaysRecord.entries.length) * 100);
  } else if(totalStudents){
    presentPct = 78; // sensible demo default when no attendance marked yet today
  }

  const ringCircumference = 2 * Math.PI * 31.5; // r=31.5 for 74px circle w/ stroke 7
  const ringOffset = ringCircumference - (presentPct/100)*ringCircumference;

  /* ---------- Render stat cards ---------- */
  const statCards = [
    { label:'Total Students', value:totalStudents, icon:'fa-user-graduate', color:'primary', trend:'up', trendVal:'+4 this month' },
    { label:'Active Batches', value:activeBatches, icon:'fa-layer-group', color:'accent', trend:'up', trendVal:'Steady' },
    { label:'Fees Collected', value:formatCurrency(feeCollected), icon:'fa-sack-dollar', color:'success', trend:'up', trendVal:'This session' },
    { label:'Fees Pending', value:formatCurrency(feePending), icon:'fa-hourglass-half', color:'warn', trend:'down', trendVal:'Needs follow-up' },
  ];
  document.getElementById('statCards').innerHTML = statCards.map(c => `
    <div class="card stat-card">
      <div class="stat-top">
        <div class="stat-ico" style="background:var(--${c.color==='accent'?'accent':c.color}-light); color:var(--${c.color==='accent'?'accent':c.color==='primary'?'primary':c.color});">
          <i class="fa-solid ${c.icon}"></i>
        </div>
        <span class="trend ${c.trend}"><i class="fa-solid fa-arrow-${c.trend}"></i> ${escapeHTML(c.trendVal)}</span>
      </div>
      <div class="stat-value">${c.value}</div>
      <div class="stat-label">${escapeHTML(c.label)}</div>
    </div>`).join('') + `
    <div class="card stat-card" style="flex-direction:row;align-items:center;justify-content:space-between;">
      <div>
        <div class="stat-label" style="margin-bottom:6px;">Today's Attendance</div>
        <div class="stat-value">${presentPct}%</div>
        <span class="trend up"><i class="fa-solid fa-users"></i> ${todaysRecord ? todaysRecord.entries.length : totalStudents} marked</span>
      </div>
      <div class="ring-wrap" style="--ring-offset:${ringOffset}">
        <svg viewBox="0 0 74 74">
          <circle class="ring-track" cx="37" cy="37" r="31.5"></circle>
          <circle class="ring-value" cx="37" cy="37" r="31.5" style="stroke-dasharray:${ringCircumference};stroke-dashoffset:${ringCircumference}"></circle>
        </svg>
        <div class="ring-label">${presentPct}%</div>
      </div>
    </div>`;

  /* ---------- Fee collection trend chart (line) ---------- */
  const months = ['Mar','Apr','May','Jun','Jul','Aug'];
  const trendData = months.map((_,i)=> Math.round(feeCollected * (0.5 + i*0.1) / 1000) * 1000 || (i+1)*15000);
  new Chart(document.getElementById('feeChart'), {
    type:'line',
    data:{
      labels: months,
      datasets:[{
        label:'Fees Collected',
        data: trendData,
        borderColor:'#1848D6',
        backgroundColor:'rgba(24,72,214,.12)',
        fill:true, tension:.4, pointRadius:4, pointBackgroundColor:'#1848D6'
      }]
    },
    options:{
      plugins:{ legend:{ display:false } },
      scales:{ y:{ ticks:{ callback:v=>'₹'+(v/1000)+'k' }, grid:{ color:'rgba(150,160,190,.15)' } }, x:{ grid:{ display:false } } }
    }
  });

  /* ---------- Students by batch chart (doughnut) ---------- */
  const batchCounts = batches.map(b => students.filter(s=>s.batchId===b.id).length);
  new Chart(document.getElementById('batchChart'), {
    type:'doughnut',
    data:{
      labels: batches.map(b=>b.name),
      datasets:[{ data: batchCounts, backgroundColor:['#1848D6','#00C2A8','#F5A524','#E5484D','#8592AC'], borderWidth:0 }]
    },
    options:{ plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, font:{ size:11 } } } }, cutout:'65%' }
  });

  /* ---------- Recent activities ---------- */
  const activities = [
    { icon:'fa-user-plus', color:'primary', text:'New student admitted', sub: students.length ? students[students.length-1].name : '—', time:'2h ago' },
    { icon:'fa-money-bill', color:'success', text:'Fee payment received', sub: formatCurrency(feeCollected>0 ? Math.min(5000, feeCollected) : 5000), time:'4h ago' },
    { icon:'fa-calendar-check', color:'accent', text:'Attendance marked', sub: batches[0]?.name || 'Batch', time:'6h ago' },
    { icon:'fa-file-pen', color:'warn', text:'Exam results published', sub: 'Unit Test 2', time:'1d ago' },
  ];
  document.getElementById('activityList').innerHTML = activities.map(a => `
    <li class="flex items-center gap-12" style="padding:11px 0;border-bottom:1px solid var(--border-soft);">
      <div class="notif-ico" style="background:var(--${a.color==='accent'?'accent':a.color}-light);color:var(--${a.color==='accent'?'accent':a.color==='primary'?'primary':a.color});"><i class="fa-solid ${a.icon}"></i></div>
      <div style="flex:1;"><div class="fw-700 text-sm">${escapeHTML(a.text)}</div><div class="muted text-sm">${escapeHTML(a.sub)}</div></div>
      <span class="muted text-sm">${a.time}</span>
    </li>`).join('');

  /* ---------- Upcoming exams ---------- */
  const upcoming = exams.filter(e => new Date(e.date) >= new Date(today)).slice(0,4);
  document.getElementById('examList').innerHTML = upcoming.length ? upcoming.map(e => `
    <li class="flex items-center gap-12" style="padding:11px 0;border-bottom:1px solid var(--border-soft);">
      <div class="notif-ico" style="background:var(--primary-light);color:var(--primary);"><i class="fa-solid fa-file-pen"></i></div>
      <div style="flex:1;"><div class="fw-700 text-sm">${escapeHTML(e.name)}</div><div class="muted text-sm">${escapeHTML(e.course||'')}</div></div>
      <span class="badge badge-primary">${formatDate(e.date)}</span>
    </li>`).join('') : `
    <li class="empty-state" style="padding:24px 0;"><i class="fa-regular fa-calendar"></i><h4>No exams scheduled</h4><p class="text-sm">Create one from the Exams page.</p></li>`;
});
