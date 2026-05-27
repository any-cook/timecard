var pinInput='';
function initPin(){document.getElementById('pinScreen').style.display='flex';document.getElementById('adminContent').style.display='none';updatePinDisplay();}
function pinPress(v){if(pinInput.length>=4)return;pinInput+=v;updatePinDisplay();if(pinInput.length===4)setTimeout(checkPin,200);}
function pinDelete(){pinInput=pinInput.slice(0,-1);updatePinDisplay();}
function updatePinDisplay(){document.querySelectorAll('.pin-dot').forEach(function(d,i){d.classList.toggle('filled',i<pinInput.length);});}
function checkPin(){
  if(pinInput===ADMIN_PIN){document.getElementById('pinScreen').style.display='none';document.getElementById('adminContent').style.display='block';initAdminTabs();}
  else{document.getElementById('pinError').style.display='block';pinInput='';updatePinDisplay();setTimeout(function(){document.getElementById('pinError').style.display='none';},2000);}
}
function initAdminTabs(){switchTab('staff');}
function switchTab(tab){
  document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.toggle('active',b.dataset.tab===tab);});
  document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.toggle('active',p.id==='tab-'+tab);});
  ({staff:loadStaffTab,attendance:loadAttendanceTab,special:loadSpecialTab,payroll:loadPayrollTab,tax:loadTaxTab,leave:loadLeaveTab,today:loadTodayTab,monthly:loadMonthlyTab,payslip_setting:loadPayslipSettingTab})[tab]();
}
function toggleCollapsible(id){var b=document.getElementById(id),a=document.getElementById(id+'Arrow');if(!b)return;var o=b.classList.contains('open');b.classList.toggle('open',!o);if(a)a.classList.toggle('open',!o);}
function openCollapsible(id){var b=document.getElementById(id),a=document.getElementById(id+'Arrow');if(b)b.classList.add('open');if(a)a.classList.add('open');}

function calcAge(bd){if(!bd)return null;var t=new Date(),b=new Date(bd),a=t.getFullYear()-b.getFullYear(),m=t.getMonth()-b.getMonth();if(m<0||(m===0&&t.getDate()<b.getDate()))a--;return a;}
function isNursingCare(bd){var a=calcAge(bd);return a!==null&&a>=40&&a<=64;}
function getHealthTableType(s){return s.social_insurance&&isNursingCare(s.birthdate)?'health_nursing':'health';}

var editingStaff=null,_pensionTable=[],_healthTable=[],_healthNursingTable=[],_childSupportTable=[];

async function loadStaffTab(){
  var res=await Promise.all([DB.getInsuranceTable('pension'),DB.getInsuranceTable('health'),DB.getInsuranceTable('health_nursing'),DB.getInsuranceTable('child_support')]);
  _pensionTable=res[0];_healthTable=res[1];_healthNursingTable=res[2];_childSupportTable=res[3];
  var staff=await DB.getStaff(),tbody=document.getElementById('staffTableBody');tbody.innerHTML='';
  if(!staff.length){tbody.innerHTML='<tr><td colspan="9" class="empty-cell">スタッフが登録されていません</td></tr>';return;}
  // 登録番号順にソート（数値として比較、未設定は末尾）
  staff.sort(function(a,b){
    var na=parseInt(a.staff_number||9999),nb=parseInt(b.staff_number||9999);
    if(na!==nb)return na-nb;
    return (a.staff_number||'').localeCompare(b.staff_number||'');
  });
  staff.forEach(function(s){
    var age=calcAge(s.birthdate),ageStr=age!==null?age+'歳':'-';
    var nursing=s.birthdate?(isNursingCare(s.birthdate)?'<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #d97706;">介護2号</span>':'<span class="badge badge-inactive">非該当</span>'):'-';
    var emp=s.employment_insurance?'<span class="badge badge-active">加入</span>':'<span class="badge badge-inactive">未加入</span>';
    var tr=document.createElement('tr');if(!s.is_active)tr.classList.add('inactive-row');
    var hireDateStr=s.hire_date?formatDateJP(s.hire_date):'-';
    var lunchMark = s.lunch_break ? ' 🍱' : '';
    tr.innerHTML='<td style="font-size:1rem;font-weight:700;color:var(--accent);">'+(s.staff_number||'-')+'</td>'+
      '<td>'+s.name+lunchMark+'</td><td><span class="badge badge-type">'+staffTypeLabel(s.type)+'</span></td>'+
      '<td>'+(s.type==='hourly'?formatCurrency(s.wage)+'/時':formatCurrency(s.monthly_salary)+'/月')+'</td>'+
      '<td>'+hireDateStr+'</td><td>'+ageStr+'</td><td>'+nursing+'</td><td>'+emp+'</td>'+
      '<td><span class="badge '+(s.is_active?'badge-active':'badge-inactive')+'">'+(s.is_active?'在籍':'退職')+'</span></td>'+
      '<td><button class="btn-sm btn-edit" onclick="openStaffModal(\''+s.id+'\')">✏️ 編集</button> '+
      '<button class="btn-sm btn-toggle" onclick="toggleStaffActive(\''+s.id+'\','+(!s.is_active)+')">'+(s.is_active?'退職処理':'在籍に戻す')+'</button></td>';
    tbody.appendChild(tr);
  });
}

async function toggleStaffActive(id,newState){
  var staff=await DB.getStaff(),s=staff.find(function(x){return x.id===id;});
  if(!s||!confirmAction(s.name+' さんを'+(newState?'在籍に戻します':'退職処理します')+'。よろしいですか？'))return;
  s.is_active=newState;await DB.saveStaff(s);showToast('更新しました');loadStaffTab();
}

async function openStaffModal(id){
  editingStaff=null;
  document.getElementById('staffModalTitle').textContent=id?'スタッフ編集':'スタッフ追加';
  document.getElementById('staffForm').reset();
  document.getElementById('staffWageSection').style.display='block';
  document.getElementById('staffSalarySection').style.display='none';
  document.getElementById('socialInsuranceFields').style.display='none';
  document.getElementById('employmentInsuranceFields').style.display='none';
  document.getElementById('nursingCareStatus').textContent='生年月日を入力すると自動判定';
  document.getElementById('nursingCareStatus').style.background='#f1f5f9';
  document.getElementById('commuteTaxFreeInfo').style.display='none';
  await buildGradeSelects('health');
  if(id){
    var staff=await DB.getStaff();editingStaff=staff.find(function(s){return s.id===id;});
    if(editingStaff){
      document.getElementById('staffNumber').value=editingStaff.staff_number||'';
      document.getElementById('staffPayslipType').value=editingStaff.payslip_type||editingStaff.type||'hourly';
      document.getElementById('staffPayslipNote').value=editingStaff.payslip_note||'';
      document.getElementById('staffName').value=editingStaff.name;
      document.getElementById('staffBirthdate').value=editingStaff.birthdate||'';
      document.getElementById('staffLunchBreak').checked=editingStaff.lunch_break||false;
      document.getElementById('staffLunchStart').value=editingStaff.lunch_start||'12:00';
      document.getElementById('staffLunchEnd').value=editingStaff.lunch_end||'13:00';
      if(editingStaff.lunch_break)document.getElementById('lunchBreakFields').style.display='block';
      document.getElementById('staffHireDate').value=editingStaff.hire_date||'';
      document.getElementById('staffType').value=editingStaff.type;
      document.getElementById('staffWage').value=editingStaff.wage||'';
      document.getElementById('staffSalary').value=editingStaff.monthly_salary||'';
      document.getElementById('staffActive').checked=editingStaff.is_active;
      document.getElementById('staffTaxType').value=editingStaff.tax_type||'kou';
      document.getElementById('staffLunchBreak').checked=editingStaff.lunch_break||false;
      document.getElementById('staffDependents').value=editingStaff.dependents||0;
      document.getElementById('staffAddress').value=editingStaff.address||'';
      document.getElementById('staffPhone').value=editingStaff.phone||'';
      document.getElementById('staffEmergencyPhone').value=editingStaff.emergency_phone||'';
      document.getElementById('staffEmergencyName').value=editingStaff.emergency_name||'';
      document.getElementById('staffEmail').value=editingStaff.email||'';
      document.getElementById('staffCommuteDistance').value=editingStaff.commute_distance||'';
      document.getElementById('staffCommuteDailyAmount').value=editingStaff.commute_daily_amount||'';
      document.getElementById('staffSocialInsurance').checked=editingStaff.social_insurance||false;
      document.getElementById('staffEmploymentInsurance').checked=editingStaff.employment_insurance||false;
      document.getElementById('staffEmploymentInsuranceDate').value=editingStaff.employment_insurance_date||'';
      document.getElementById('staffWorkersComp').checked=editingStaff.workers_comp||false;
      if(editingStaff.birthdate)updateNursingCareStatus();
      if(editingStaff.commute_distance)updateCommuteTaxFree();
      if(editingStaff.social_insurance){
        document.getElementById('socialInsuranceFields').style.display='block';
        await buildGradeSelects(getHealthTableType(editingStaff));
        document.getElementById('staffPensionGrade').value=editingStaff.pension_grade_id||'';
        document.getElementById('staffHealthGrade').value=editingStaff.health_grade_id||'';
        document.getElementById('staffChildSupportGrade').value=editingStaff.child_support_grade_id||'';
        updateInsurancePreview();
      }
      if(editingStaff.employment_insurance)document.getElementById('employmentInsuranceFields').style.display='block';
      updateStaffTypeFields();
    }
  }
  openModal('staffModal');
}

async function buildGradeSelects(tableType){
  if(!_pensionTable.length)_pensionTable=await DB.getInsuranceTable('pension');
  if(!_healthTable.length)_healthTable=await DB.getInsuranceTable('health');
  if(!_healthNursingTable.length)_healthNursingTable=await DB.getInsuranceTable('health_nursing');
  if(!_childSupportTable.length)_childSupportTable=await DB.getInsuranceTable('child_support');
  var useTable=tableType==='health_nursing'?_healthNursingTable:_healthTable;
  var pSel=document.getElementById('staffPensionGrade'),hSel=document.getElementById('staffHealthGrade'),cSel=document.getElementById('staffChildSupportGrade');
  pSel.innerHTML='<option value="">選択してください</option>';
  hSel.innerHTML='<option value="">選択してください</option>';
  cSel.innerHTML='<option value="">選択してください</option>';
  _pensionTable.slice().sort(function(a,b){return a.grade-b.grade;}).forEach(function(r){pSel.innerHTML+='<option value="'+r.id+'">'+r.label+'（標準報酬 '+formatCurrency(r.standard)+'・本人 '+formatCurrency(r.employee)+'）</option>';});
  useTable.slice().sort(function(a,b){return a.grade-b.grade;}).forEach(function(r){hSel.innerHTML+='<option value="'+r.id+'">'+r.label+'（標準報酬 '+formatCurrency(r.standard)+'・本人 '+formatCurrency(r.employee)+'）</option>';});
  _childSupportTable.slice().sort(function(a,b){return a.grade-b.grade;}).forEach(function(r){cSel.innerHTML+='<option value="'+r.id+'">'+r.label+'（標準報酬 '+formatCurrency(r.standard)+'・本人 '+formatCurrency(r.employee)+'）</option>';});
  var lbl=document.getElementById('nursingCareLabel'),hlbl=document.getElementById('healthLabel');
  if(tableType==='health_nursing'){lbl.textContent='介護保険込み（40〜64歳）';lbl.style.background='#fef3c7';lbl.style.color='#92400e';hlbl.textContent='健康保険（介護保険込み・本人負担）';}
  else{lbl.textContent='介護保険なし';lbl.style.background='#dbeafe';lbl.style.color='#1d4ed8';hlbl.textContent='健康保険（本人負担）';}
  window._currentHealthTableType=tableType;
}

function updateNursingCareStatus(){
  var bd=document.getElementById('staffBirthdate').value,el=document.getElementById('nursingCareStatus');
  if(!bd){el.textContent='生年月日を入力すると自動判定';el.style.background='#f1f5f9';el.style.color='var(--text-muted)';return;}
  var age=calcAge(bd),nursing=isNursingCare(bd);
  if(nursing){el.textContent=age+'歳 ／ 介護保険第2号（40〜64歳）';el.style.background='#fef3c7';el.style.color='#92400e';}
  else{el.textContent=age+'歳 ／ 介護保険非該当';el.style.background='#f0fdf4';el.style.color='#166534';}
  if(document.getElementById('staffSocialInsurance').checked)buildGradeSelects(nursing?'health_nursing':'health');
}
function updateStaffTypeFields(){var type=document.getElementById('staffType').value;document.getElementById('staffWageSection').style.display=type==='hourly'?'block':'none';document.getElementById('staffSalarySection').style.display=type!=='hourly'?'block':'none';}
function toggleSocialInsurance(){var checked=document.getElementById('staffSocialInsurance').checked;document.getElementById('socialInsuranceFields').style.display=checked?'block':'none';if(checked){var bd=document.getElementById('staffBirthdate').value;buildGradeSelects((bd&&isNursingCare(bd))?'health_nursing':'health');updateInsurancePreview();}}
function toggleEmploymentInsurance(){document.getElementById('employmentInsuranceFields').style.display=document.getElementById('staffEmploymentInsurance').checked?'block':'none';}
function updateInsurancePreview(){
  var pId=document.getElementById('staffPensionGrade').value,hId=document.getElementById('staffHealthGrade').value,cId=document.getElementById('staffChildSupportGrade').value;
  var useTable=(window._currentHealthTableType==='health_nursing')?_healthNursingTable:_healthTable;
  var p=getInsuranceAmountByGrade(pId,_pensionTable),h=getInsuranceAmountByGrade(hId,useTable),c=getInsuranceAmountByGrade(cId,_childSupportTable);
  document.getElementById('insurancePreviewPension').textContent=formatCurrency(p);
  document.getElementById('insurancePreviewHealth').textContent=formatCurrency(h);
  document.getElementById('insurancePreviewChildSupport').textContent=formatCurrency(c);
  document.getElementById('insurancePreviewTotal').textContent=formatCurrency(p+h+c);
}
function autoSelectGradeByMonthly(){
  var monthly=parseInt(document.getElementById('staffSalary').value)||parseInt(document.getElementById('staffWage').value)*160||0;
  if(!monthly)return;
  var useTable=(window._currentHealthTableType==='health_nursing')?_healthNursingTable:_healthTable;
  var p=findInsuranceGradeByMonthly(monthly,_pensionTable),h=findInsuranceGradeByMonthly(monthly,useTable),c=findInsuranceGradeByMonthly(monthly,_childSupportTable);
  if(p)document.getElementById('staffPensionGrade').value=p.id;
  if(h)document.getElementById('staffHealthGrade').value=h.id;
  if(c)document.getElementById('staffChildSupportGrade').value=c.id;
  updateInsurancePreview();showToast('報酬月額から等級を自動選択しました');
}
function updateCommuteTaxFree(){
  var km=parseFloat(document.getElementById('staffCommuteDistance').value)||0,limit=getCommuteTaxFreeLimit(km),el=document.getElementById('commuteTaxFreeInfo');
  if(km===0){el.style.display='none';return;}
  el.style.display='block';
  el.innerHTML=km<2?'⚠️ 2km未満のため通勤費は全額課税対象です。':'✅ <strong>非課税限度額: '+formatCurrency(limit)+'/月</strong>（片道'+km+'km）';
  el.style.background=km<2?'#fef3c7':'#f0fdf4';
}

async function saveStaff(){
  var staffNumber=document.getElementById('staffNumber').value.trim();
  var name=document.getElementById('staffName').value.trim();
  if(!staffNumber){showToast('登録番号を入力してください','error');return;}
  if(!name){showToast('氏名を入力してください','error');return;}
  var allS=await DB.getStaff();
  var dup=allS.find(function(s){return s.staff_number===staffNumber&&(!editingStaff||s.id!==editingStaff.id);});
  if(dup){showToast('登録番号 '+staffNumber+' は既に '+dup.name+' さんが使用しています','error');return;}
  var birthdate=document.getElementById('staffBirthdate').value;
  var tableType=(birthdate&&isNursingCare(birthdate))?'health_nursing':'health';
  var useTable=tableType==='health_nursing'?_healthNursingTable:_healthTable;
  var pensionGradeId=document.getElementById('staffPensionGrade').value;
  var healthGradeId=document.getElementById('staffHealthGrade').value;
  var childSupportGradeId=document.getElementById('staffChildSupportGrade').value;
  var record=editingStaff?Object.assign({},editingStaff):{};
  Object.assign(record,{
    staff_number:String(staffNumber).trim(),name:name,birthdate:birthdate,
    hire_date:document.getElementById('staffHireDate').value,
    payslip_type:document.getElementById('staffPayslipType').value,
    payslip_note:document.getElementById('staffPayslipNote').value.trim(),
    lunch_break:document.getElementById('staffLunchBreak').checked,
    lunch_start:document.getElementById('staffLunchStart').value||'12:00',
    lunch_end:document.getElementById('staffLunchEnd').value||'13:00',
    lunch_break:document.getElementById('staffLunchBreak').checked,
    type:document.getElementById('staffType').value,
    wage:parseInt(document.getElementById('staffWage').value)||0,
    monthly_salary:parseInt(document.getElementById('staffSalary').value)||0,
    is_active:document.getElementById('staffActive').checked,
    tax_type:document.getElementById('staffTaxType').value,
    dependents:parseInt(document.getElementById('staffDependents').value)||0,
    address:document.getElementById('staffAddress').value.trim(),
    phone:document.getElementById('staffPhone').value.trim(),
    emergency_phone:document.getElementById('staffEmergencyPhone').value.trim(),
    emergency_name:document.getElementById('staffEmergencyName').value.trim(),
    email:document.getElementById('staffEmail').value.trim(),
    commute_distance:parseFloat(document.getElementById('staffCommuteDistance').value)||0,
    commute_daily_amount:parseInt(document.getElementById('staffCommuteDailyAmount').value)||0,
    social_insurance:document.getElementById('staffSocialInsurance').checked,
    pension_grade_id:pensionGradeId,health_grade_id:healthGradeId,
    child_support_grade_id:childSupportGradeId,health_table_type:tableType,
    employment_insurance:document.getElementById('staffEmploymentInsurance').checked,
    employment_insurance_date:document.getElementById('staffEmploymentInsuranceDate').value,
    workers_comp:document.getElementById('staffWorkersComp').checked,
    pension:getInsuranceAmountByGrade(pensionGradeId,_pensionTable),
    health_insurance:getInsuranceAmountByGrade(healthGradeId,useTable),
    child_support:getInsuranceAmountByGrade(childSupportGradeId,_childSupportTable)
  });
  await DB.saveStaff(record);closeModal('staffModal');showToast('スタッフ情報を保存しました');loadStaffTab();
}

var attendanceFilters={year:currentYear(),month:currentMonth(),staff_id:''};
async function loadAttendanceTab(){
  document.getElementById('filterYear').value=attendanceFilters.year;
  document.getElementById('filterMonth').value=attendanceFilters.month;
  var staff=await DB.getStaff(),sel=document.getElementById('filterStaff');
  sel.innerHTML='<option value="">全スタッフ</option>';
  staff.forEach(function(s){var o=document.createElement('option');o.value=s.id;o.textContent=s.name;if(s.id===attendanceFilters.staff_id)o.selected=true;sel.appendChild(o);});
  loadAttendanceRecords();
}
async function loadAttendanceRecords(){
  attendanceFilters.year=parseInt(document.getElementById('filterYear').value);
  attendanceFilters.month=parseInt(document.getElementById('filterMonth').value);
  attendanceFilters.staff_id=document.getElementById('filterStaff').value;
  var allRecords=await DB.getAttendance({year:attendanceFilters.year,month:attendanceFilters.month}),staff=await DB.getStaff();
  var records=attendanceFilters.staff_id?allRecords.filter(function(r){return r.staff_id===attendanceFilters.staff_id;}):allRecords;
  var staffMap={};staff.forEach(function(s){staffMap[s.id]=s;});
  var tbody=document.getElementById('attendanceTableBody');tbody.innerHTML='';
  var totalWage=0,totalMins=0,staffSummary={};
  records.forEach(function(r){
    var s=staffMap[r.staff_id]||{};
    var lunchBreak=s.lunch_break||false;
    var workMins=r.clock_out_calc?calcWorkMinutes(r.clock_in_calc,r.clock_out_calc,(s&&s.lunch_break),(s&&s.lunch_start),(s&&s.lunch_end)):0;
    var dailyWage=r.clock_out_calc?calcDailyWage(r.clock_in_calc,r.clock_out_calc,r.wage_at_date||0,r.is_special_day,(s&&s.lunch_break),(s&&s.lunch_start),(s&&s.lunch_end)):0;
    var commuteAmt=r.clock_in_actual&&s.commute_daily_amount?s.commute_daily_amount:0;
    totalWage+=dailyWage;totalMins+=workMins;
    if(!staffSummary[r.staff_id])staffSummary[r.staff_id]={name:s.name||'不明',mins:0,wage:0,days:0,commute:0};
    staffSummary[r.staff_id].mins+=workMins;staffSummary[r.staff_id].wage+=dailyWage;
    if(r.clock_in_actual){staffSummary[r.staff_id].days++;staffSummary[r.staff_id].commute+=commuteAmt;}
    var isMissingOut=r.clock_in_actual&&!r.clock_out_actual;
    var tr=document.createElement('tr');if(isMissingOut)tr.classList.add('missing-clockout');if(r.is_special_day)tr.classList.add('special-day-row');
    tr.innerHTML='<td>'+formatDateJP(r.date)+'</td><td>'+(s.name||'不明')+'</td>'+
      '<td>'+(r.clock_in_actual||'-')+'</td><td>'+(r.clock_out_actual||(isMissingOut?'<span class="alert-text">⚠️ 退勤忘れ</span>':'-'))+'</td>'+
      '<td>'+(r.clock_in_calc||'-')+'</td><td>'+(r.clock_out_calc||'-')+'</td>'+
      '<td>'+(workMins?formatWorkTime(workMins):'-')+'</td>'+
      '<td>'+(r.clock_out_calc?formatCurrency(dailyWage):'-')+'</td>'+
      '<td>'+(r.clock_in_actual&&commuteAmt?formatCurrency(commuteAmt):'-')+'</td>'+
      '<td>'+(r.is_special_day?'<span class="badge badge-special">⭐ 特別</span>':'-')+'</td>'+
      '<td><button class="btn-sm btn-edit" onclick="openAttendanceEditModal(\''+r.id+'\')">✏️</button> <button class="btn-sm btn-delete" onclick="deleteAttendance(\''+r.id+'\')">🗑️</button></td>';
    tbody.appendChild(tr);
  });
  document.getElementById('attendanceTotalTime').textContent=formatWorkTime(totalMins);
  document.getElementById('attendanceTotalWage').textContent=formatCurrency(totalWage);
  var sb=document.getElementById('staffSummaryBody');sb.innerHTML='';
  var keys=Object.keys(staffSummary);
  if(!keys.length){sb.innerHTML='<tr><td colspan="5" class="empty-cell">データがありません</td></tr>';}
  else keys.forEach(function(k){var s=staffSummary[k],tr=document.createElement('tr');tr.innerHTML='<td>'+s.name+'</td><td>'+s.days+'日</td><td>'+formatWorkTime(s.mins)+'</td><td>'+formatCurrency(s.wage)+'</td><td>'+formatCurrency(s.commute)+'</td>'+'<td><button class="btn-sm btn-edit" onclick="openStaffDetail(\''+k+'\')">'+'📋 詳細</button></td>';sb.appendChild(tr);});
}
// ============================================================
// 個人勤務詳細
// ============================================================
async function openStaffDetail(staffId) {
  var year  = attendanceFilters.year;
  var month = attendanceFilters.month;
  var staff = await DB.getStaff();
  var s = staff.find(function(x){ return x.id === staffId; });
  if (!s) return;

  var allRecords = await DB.getAttendance({ year: year, month: month });
  var records = allRecords.filter(function(r){ return r.staff_id === staffId; });
  var dayNames = ['日','月','火','水','木','金','土'];

  // パネル切り替え
  document.getElementById('staffListPanel').style.display = 'none';
  document.getElementById('staffDetailPanel').style.display = 'block';
  document.getElementById('staffDetailName').textContent = s.name + ' さん';
  document.getElementById('staffDetailPeriod').textContent = year + '年' + month + '月度';

  // 昼休み情報
  var lunchInfo = document.getElementById('detailLunchInfo');
  if (s.lunch_break && s.lunch_start && s.lunch_end) {
    lunchInfo.textContent = '🕐 昼休み設定あり：' + s.lunch_start + ' 〜 ' + s.lunch_end + '（出勤時間から自動控除）';
    lunchInfo.style.display = 'block';
  } else {
    lunchInfo.textContent = '昼休み設定なし';
    lunchInfo.style.display = 'block';
  }

  // 月の全日付を生成
  var daysInMonth = new Date(year, month, 0).getDate();
  var totalDays = 0, totalMins = 0, totalWage = 0, totalCommute = 0;
  var tbody = document.getElementById('staffDetailBody');
  tbody.innerHTML = '';

  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year + '-' + String(month).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var date    = new Date(year, month-1, d);
    var dow     = date.getDay();
    var dowName = dayNames[dow];
    var r = records.find(function(x){ return x.date === dateStr; });
    var isWeekend = dow === 0 || dow === 6;
    var rowStyle  = isWeekend ? (dow===0?'background:#fff5f5':'background:#f0f5ff') : '';
    var dowStyle  = dow===0?'color:#dc2626;font-weight:700':dow===6?'color:#1d4ed8;font-weight:700':'';

    var tr = document.createElement('tr');
    tr.style.cssText = rowStyle;

    if (r && r.clock_in_actual) {
      var workMins = r.clock_out_calc ? calcWorkMinutes(r.clock_in_calc, r.clock_out_calc, s.lunch_break, s.lunch_start, s.lunch_end) : 0;
      var lunchMins = 0;
      if (s.lunch_break && s.lunch_start && s.lunch_end && r.clock_out_calc) {
        var rawMins = calcWorkMinutes(r.clock_in_calc, r.clock_out_calc, false, null, null);
        lunchMins = rawMins - workMins;
      }
      var dailyWage = r.clock_out_calc ? calcDailyWage(r.clock_in_calc, r.clock_out_calc, r.wage_at_date||s.wage, r.is_special_day, s.lunch_break, s.lunch_start, s.lunch_end) : 0;
      var commuteAmt = s.commute_daily_amount || 0;
      var isMissingOut = !r.clock_out_actual;

      totalDays++;
      totalMins  += workMins;
      totalWage  += dailyWage;
      totalCommute += commuteAmt;

      tr.innerHTML =
        '<td style="font-weight:700;">' + d + '日</td>' +
        '<td style="' + dowStyle + '">' + dowName + '</td>' +
        '<td style="color:#16a34a;font-weight:700;">' + (r.clock_in_actual||'-') + '</td>' +
        '<td style="color:' + (isMissingOut?'#f59e0b':'#dc2626') + ';font-weight:700;">' + (r.clock_out_actual||(isMissingOut?'⚠️ 未退勤':'-')) + '</td>' +
        '<td>' + (r.clock_in_calc||'-')  + '</td>' +
        '<td>' + (r.clock_out_calc||'-') + '</td>' +
        '<td style="font-weight:700;">' + (workMins ? formatWorkTime(workMins) : '-') + '</td>' +
        '<td style="color:var(--text-muted);">' + (lunchMins > 0 ? formatWorkTime(lunchMins) : '-') + '</td>' +
        '<td>' + (r.clock_out_calc ? formatCurrency(dailyWage) : '-') + '</td>' +
        '<td>' + (r.is_special_day ? '<span class="badge badge-special">⭐</span>' : '') + '</td>' +
        '<td><button class="btn-sm btn-edit" onclick="openAttendanceEditModal(\'' + r.id + '\')">✏️</button></td>';
    } else {
      // 未出勤
      tr.innerHTML =
        '<td style="font-weight:700;">' + d + '日</td>' +
        '<td style="' + dowStyle + '">' + dowName + '</td>' +
        '<td colspan="9" style="color:var(--text-muted);font-size:.82rem;">' + (isWeekend ? '休日' : '－') + '</td>';
    }
    tbody.appendChild(tr);
  }

  // サマリー更新
  document.getElementById('detailTotalDays').textContent   = totalDays + '日';
  document.getElementById('detailTotalTime').textContent   = formatWorkTime(totalMins);
  document.getElementById('detailTotalWage').textContent   = formatCurrency(totalWage);
  document.getElementById('detailTotalCommute').textContent = formatCurrency(totalCommute);
}

function closeStaffDetail() {
  document.getElementById('staffDetailPanel').style.display = 'none';
  document.getElementById('staffListPanel').style.display   = 'block';
}

async function openAttendanceAddModal(){
  document.getElementById('attendanceModalTitle').textContent='打刻の手動追加';document.getElementById('attendanceId').value='';
  var staff=await DB.getStaff(),sel=document.getElementById('attendanceStaff');sel.innerHTML='';
  staff.filter(function(s){return s.is_active;}).forEach(function(s){var o=document.createElement('option');o.value=s.id;o.textContent=s.name;sel.appendChild(o);});
  document.getElementById('attendanceDate').value=todayStr();
  ['attendanceClockIn','attendanceClockOut','attendanceWage','attendanceNotes'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('attendanceSpecial').checked=false;
  document.getElementById('btnDeleteAttendance').style.display='none';
  openModal('attendanceModal');
}
async function openAttendanceEditModal(id){
  // 現在表示中の年月でフィルターして取得（Firestore対応）
  var year=parseInt(document.getElementById('filterYear').value);
  var month=parseInt(document.getElementById('filterMonth').value);
  var records=await DB.getAttendance({year:year,month:month});
  var r=records.find(function(x){return x.id===id;});
  if(!r){showToast('レコードが見つかりません','error');return;}
  document.getElementById('attendanceModalTitle').textContent='打刻の修正';document.getElementById('attendanceId').value=r.id;
  var staff=await DB.getStaff(),sel=document.getElementById('attendanceStaff');sel.innerHTML='';
  staff.forEach(function(s){var o=document.createElement('option');o.value=s.id;o.textContent=s.name;if(s.id===r.staff_id)o.selected=true;sel.appendChild(o);});
  document.getElementById('attendanceDate').value=r.date;
  document.getElementById('attendanceClockIn').value=r.clock_in_actual||'';
  document.getElementById('attendanceClockOut').value=r.clock_out_actual||'';
  document.getElementById('attendanceWage').value=r.wage_at_date||'';
  document.getElementById('attendanceSpecial').checked=r.is_special_day||false;
  document.getElementById('attendanceNotes').value=r.notes||'';
  // 編集時は削除ボタンを表示
  var delBtn=document.getElementById('btnDeleteAttendance');
  delBtn.style.display='block';
  delBtn.dataset.id=r.id;
  openModal('attendanceModal');
}
async function saveAttendance(){
  var id=document.getElementById('attendanceId').value,staff_id=document.getElementById('attendanceStaff').value;
  var date=document.getElementById('attendanceDate').value,clockIn=document.getElementById('attendanceClockIn').value;
  var clockOut=document.getElementById('attendanceClockOut').value;
  if(!date||!staff_id){showToast('日付とスタッフを入力してください','error');return;}
  if(!clockIn){showToast('出勤時刻を入力してください','error');return;}
  var record={staff_id:staff_id,date:date,clock_in_actual:clockIn,clock_out_actual:clockOut||null,clock_in_calc:roundUpClockIn(clockIn),clock_out_calc:clockOut?roundDownClockOut(clockOut):null,wage_at_date:parseInt(document.getElementById('attendanceWage').value)||0,is_special_day:document.getElementById('attendanceSpecial').checked,notes:document.getElementById('attendanceNotes').value};
  if(id)record.id=id;
  await DB.saveAttendance(record);closeModal('attendanceModal');showToast('保存しました');loadAttendanceRecords();
}
async function deleteAttendance(id){if(!confirmAction('この打刻記録を削除しますか？'))return;await DB.deleteAttendance(id);showToast('削除しました');loadAttendanceRecords();}
async function deleteAttendanceFromModal(){
  var id=document.getElementById('btnDeleteAttendance').dataset.id;
  if(!id||!confirmAction('この打刻記録を削除しますか？'))return;
  await DB.deleteAttendance(id);
  closeModal('attendanceModal');
  showToast('削除しました');
  loadAttendanceRecords();
}
function openCsvModal(){document.getElementById('csvPreviewArea').style.display='none';document.getElementById('csvFile').value='';document.getElementById('csvPreviewBody').innerHTML='';openModal('csvModal');}
var csvParsedData=[];
async function previewCsv(){
  var file=document.getElementById('csvFile').files[0];if(!file){showToast('ファイルを選択してください','error');return;}
  var text=await file.text(),lines=text.split('\n').filter(function(l){return l.trim();}),staff=await DB.getStaff();
  csvParsedData=[];var tbody=document.getElementById('csvPreviewBody');tbody.innerHTML='';
  var dl=(lines[0].indexOf('スタッフ')>=0||lines[0].indexOf('date')>=0||lines[0].indexOf('日付')>=0)?lines.slice(1):lines;
  for(var i=0;i<dl.length;i++){var cols=dl[i].split(',').map(function(c){return c.trim().replace(/"/g,'');});if(cols.length<3)continue;var sn=cols[0],date=cols[1],ci=cols[2],co=cols[3];var ms=staff.find(function(s){return s.name===sn;});var ok=ms&&date&&ci;var tr=document.createElement('tr');tr.style.color=ok?'':'#dc2626';tr.innerHTML='<td>'+sn+' '+(ms?'✅':'❌未登録')+'</td><td>'+date+'</td><td>'+ci+'</td><td>'+(co||'-')+'</td>';tbody.appendChild(tr);if(ok)csvParsedData.push({staff_id:ms.id,date:date,clock_in_actual:ci,clock_out_actual:co||null,clock_in_calc:roundUpClockIn(ci),clock_out_calc:co?roundDownClockOut(co):null,wage_at_date:ms.wage||0,is_special_day:false,notes:'CSVインポート'});}
  document.getElementById('csvPreviewArea').style.display='block';document.getElementById('csvImportCount').textContent=csvParsedData.length+'件インポート可能';
}
async function importCsv(){if(!csvParsedData.length){showToast('データがありません','error');return;}if(!confirmAction(csvParsedData.length+'件インポートしますか？'))return;for(var i=0;i<csvParsedData.length;i++)await DB.saveAttendance(csvParsedData[i]);closeModal('csvModal');showToast(csvParsedData.length+'件インポートしました');loadAttendanceRecords();}
function downloadCsvTemplate(){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['スタッフ名,日付,出勤時刻,退勤時刻\n田中 花子,2026-05-01,09:00,18:00'],{type:'text/csv;charset=utf-8;'}));a.download='timecard_template.csv';a.click();}

async function loadSpecialTab(){
  var days=await DB.getSpecialDays(),tbody=document.getElementById('specialTableBody');tbody.innerHTML='';
  if(!days.length){tbody.innerHTML='<tr><td colspan="3" class="empty-cell">手動追加の特別日はありません</td></tr>';}
  else days.slice().sort(function(a,b){return a.date>b.date?-1:1;}).forEach(function(d){var tr=document.createElement('tr');tr.innerHTML='<td>'+formatDateJP(d.date)+'</td><td>'+(d.reason||'-')+'</td><td><button class="btn-sm btn-edit" onclick="openSpecialEditModal(\''+d.id+'\',\''+d.date+'\',\''+((d.reason||'').replace(/'/g,"\\'"))+'\')">✏️ 編集</button> <button class="btn-sm btn-delete" onclick="deleteSpecialDay(\''+d.id+'\')">🗑️ 削除</button></td>';tbody.appendChild(tr);});
  document.getElementById('autoRulesList').innerHTML='<li>🗓️ 金曜日・土曜日・日曜日</li><li>🎌 日本の祝日</li><li>📅 祝日の前日</li>';
}
function openSpecialEditModal(id,date,reason){document.getElementById('specialEditId').value=id;document.getElementById('specialEditDate').value=date;document.getElementById('specialEditReason').value=reason;openModal('specialModal');}
async function addSpecialDay(){var date=document.getElementById('newSpecialDate').value,reason=document.getElementById('newSpecialReason').value.trim();if(!date){showToast('日付を入力してください','error');return;}var existing=await DB.getSpecialDays();if(existing.some(function(d){return d.date===date;})){showToast('この日付はすでに登録済みです','error');return;}await DB.saveSpecialDay({date:date,reason:reason});document.getElementById('newSpecialDate').value='';document.getElementById('newSpecialReason').value='';showToast('特別日を追加しました');loadSpecialTab();}
async function saveSpecialDay(){var id=document.getElementById('specialEditId').value,date=document.getElementById('specialEditDate').value,reason=document.getElementById('specialEditReason').value.trim();if(!date){showToast('日付を入力してください','error');return;}await DB.saveSpecialDay({id:id,date:date,reason:reason});closeModal('specialModal');showToast('更新しました');loadSpecialTab();}
async function deleteSpecialDay(id){if(!confirmAction('削除しますか？'))return;await DB.deleteSpecialDay(id);showToast('削除しました');loadSpecialTab();}

async function loadPayrollTab(){document.getElementById('payrollYear').value=currentYear();document.getElementById('payrollMonth').value=currentMonth();await loadPayrollSummary();}
async function loadPayrollSummary(){
  var year=parseInt(document.getElementById('payrollYear').value),month=parseInt(document.getElementById('payrollMonth').value);
  var res=await Promise.all([DB.getStaff(),DB.getAttendance({year:year,month:month}),DB.getTaxTable('kou'),DB.getTaxTable('otsu'),DB.getInsuranceTable('pension'),DB.getInsuranceTable('health'),DB.getInsuranceTable('health_nursing'),DB.getInsuranceTable('child_support')]);
  var allStaff=res[0],records=res[1],taxKou=res[2],taxOtsu=res[3],pensionTable=res[4],healthTable=res[5],healthNursingTable=res[6],childSupportTable=res[7];
  var tbody=document.getElementById('payrollTableBody');tbody.innerHTML='';var grandTotal=0;
  var activeStaff=allStaff.filter(function(s){return s.is_active;});
  for(var si=0;si<activeStaff.length;si++){
    var staff=activeStaff[si];
    var staffRecords=records.filter(function(r){return r.staff_id===staff.id;});
    var grossPay=0,totalMins=0,workDays=0;
    if(staff.type==='hourly'){staffRecords.forEach(function(r){var mins=calcWorkMinutes(r.clock_in_calc,r.clock_out_calc,staff.lunch_break,staff.lunch_start,staff.lunch_end);totalMins+=mins;if(r.clock_in_actual)workDays++;grossPay+=calcDailyWage(r.clock_in_calc,r.clock_out_calc,r.wage_at_date||staff.wage,r.is_special_day,staff.lunch_break,staff.lunch_start,staff.lunch_end);});}
    else{grossPay=staff.monthly_salary||0;workDays=staffRecords.filter(function(r){return r.clock_in_actual;}).length;}
    // 月次入力から出勤日数・時間数を取得
    var monthlyData=await getMonthlyInput(year,month,staff.id);
    if(monthlyData.work_days!==null) workDays=monthlyData.work_days;
    // 時給スタッフ：時間数が月次入力されていれば上書き
    if(staff.type==='hourly' && monthlyData.work_hours!==null && monthlyData.work_hours!==undefined) {
      totalMins = Math.round(monthlyData.work_hours * 60);
      grossPay  = Math.floor(monthlyData.work_hours * (staff.wage||0));
    }
    // 役員は通勤費固定支給
    var commuteWorkDays=(staff.payslip_type==='officer'||staff.type==='officer')?20:workDays;
    var commuteData=calcCommuteAllowance(staff.commute_daily_amount||0,commuteWorkDays,staff.commute_distance||0);
    var taxableIncome=grossPay+commuteData.taxable;
    var taxRows=staff.tax_type==='otsu'?taxOtsu:taxKou;
    var tax=calcTax(taxableIncome,taxRows,staff.tax_type||'kou',staff.dependents||0);
    var useHealthTable=(staff.health_table_type==='health_nursing')?healthNursingTable:healthTable;
    var pension=getInsuranceAmountByGrade(staff.pension_grade_id,pensionTable);
    var healthTotal=getInsuranceAmountByGrade(staff.health_grade_id,useHealthTable);
    var healthBase=0,nursingCare=0;
    if(staff.health_table_type==='health_nursing'){healthBase=getInsuranceAmountByGrade(staff.health_grade_id,healthTable);nursingCare=Math.max(0,healthTotal-healthBase);}
    else{healthBase=healthTotal;nursingCare=0;}
    var childSupport=getInsuranceAmountByGrade(staff.child_support_grade_id,childSupportTable);
    var empIns=calcEmploymentInsurance(grossPay,staff.employment_insurance);
    var socialDeduction=pension+healthTotal+childSupport+empIns;
    var netPay=grossPay+commuteData.taxFree-tax-socialDeduction;
    grandTotal+=grossPay;
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+staff.name+'</td><td><span class="badge badge-type">'+staffTypeLabel(staff.type)+'</span></td>'+
      '<td>'+(staff.type==='hourly'?formatWorkTime(totalMins):'月額固定')+'</td><td>'+workDays+'日</td>'+
      '<td>'+formatCurrency(grossPay)+'</td><td>'+formatCurrency(commuteData.total)+'</td>'+
      '<td>'+formatCurrency(tax)+'</td><td>'+formatCurrency(socialDeduction)+'</td>'+
      '<td><strong>'+formatCurrency(netPay)+'</strong></td>'+
      '<td><button class="btn-sm btn-edit" onclick="showPayslip(\''+staff.id+'\','+year+','+month+')">📄 明細</button></td>';
    tbody.appendChild(tr);
  }
  document.getElementById('payrollGrandTotal').textContent='支給合計: '+formatCurrency(grandTotal);
}
async function showPayslip(staffId,year,month){
  var settings = await getPayslipSettings();
  var res=await Promise.all([DB.getStaff(),DB.getAttendance({year:year,month:month}),DB.getTaxTable('kou'),DB.getTaxTable('otsu'),DB.getInsuranceTable('pension'),DB.getInsuranceTable('health'),DB.getInsuranceTable('health_nursing'),DB.getInsuranceTable('child_support')]);
  var allStaff=res[0],records=res[1].filter(function(r){return r.staff_id===staffId;}),taxKou=res[2],taxOtsu=res[3],pensionTable=res[4],healthTable=res[5],healthNursingTable=res[6],childSupportTable=res[7];
  var staff=allStaff.find(function(s){return s.id===staffId;});if(!staff)return;
  var useHealthTable=(staff.health_table_type==='health_nursing')?healthNursingTable:healthTable;
  var healthTotal=getInsuranceAmountByGrade(staff.health_grade_id,useHealthTable);
  var healthBase=0,nursingCare=0;
  if(staff.health_table_type==='health_nursing'){
    healthBase=getInsuranceAmountByGrade(staff.health_grade_id,healthTable);
    nursingCare=Math.max(0,healthTotal-healthBase);
  } else {
    healthBase=healthTotal; nursingCare=0;
  }
  var grossPay=0,totalMins=0,workDays=0,detailRows='';
  var lunchBreakSlip=staff.lunch_break||false;
  if(staff.type==='hourly'){records.forEach(function(r){var mins=calcWorkMinutes(r.clock_in_calc,r.clock_out_calc,staff.lunch_break,staff.lunch_start,staff.lunch_end);totalMins+=mins;if(r.clock_in_actual)workDays++;var daily=calcDailyWage(r.clock_in_calc,r.clock_out_calc,r.wage_at_date||staff.wage,r.is_special_day,staff.lunch_break,staff.lunch_start,staff.lunch_end);grossPay+=daily;detailRows+='<tr><td>'+formatDateJP(r.date)+'</td><td>'+(r.clock_in_actual||'-')+'</td><td>'+(r.clock_out_actual||'-')+'</td><td>'+(r.clock_in_calc||'-')+'</td><td>'+(r.clock_out_calc||'-')+'</td><td>'+formatWorkTime(mins)+'</td><td>'+(r.is_special_day?'⭐':'')+' '+formatCurrency(r.wage_at_date||staff.wage)+'</td><td>'+formatCurrency(daily)+'</td></tr>';});}
  else{grossPay=staff.monthly_salary||0;workDays=records.filter(function(r){return r.clock_in_actual;}).length;detailRows='<tr><td colspan="8" style="text-align:center;">月額固定給: '+formatCurrency(grossPay)+'</td></tr>';}
  // 月次入力から出勤日数・時間数・変動項目・備考を取得
  var monthlyData = await getMonthlyInput(year,month,staff.id);
  if(monthlyData.work_days!==null) workDays=monthlyData.work_days;
  // 時給スタッフ：時間数が月次入力されていれば上書き
  if(staff.type==='hourly' && monthlyData.work_hours!==null && monthlyData.work_hours!==undefined) {
    totalMins = Math.round(monthlyData.work_hours * 60);
    grossPay  = Math.floor(monthlyData.work_hours * (staff.wage||0));
    detailRows = '<tr><td colspan="8" style="text-align:center;color:var(--accent);">月次入力：'+monthlyData.work_hours+'時間（自動計算を上書き）</td></tr>';
  }
  var monthlyVarItems = monthlyData.variable_items||[];
  var monthlyNote = monthlyData.note||'';
  // 役員は通勤費固定支給（日額×月固定日数20日換算）、それ以外は出勤日数×日額
  var commuteWorkDays = (staff.payslip_type==='officer'||staff.type==='officer') ? 20 : workDays;
  var commuteData=calcCommuteAllowance(staff.commute_daily_amount||0,commuteWorkDays,staff.commute_distance||0);
  var taxableIncome=grossPay+commuteData.taxable;
  var taxRows=staff.tax_type==='otsu'?taxOtsu:taxKou;
  var tax=calcTax(taxableIncome,taxRows,staff.tax_type||'kou',staff.dependents||0);
  var pension=getInsuranceAmountByGrade(staff.pension_grade_id,pensionTable);
  var health=healthBase; // 健康保険料（介護保険料除く）
  var childSupport=getInsuranceAmountByGrade(staff.child_support_grade_id,childSupportTable);
  var empIns=calcEmploymentInsurance(grossPay,staff.employment_insurance);
  var netPay=grossPay+commuteData.taxFree-tax-pension-health-nursingCare-childSupport-empIns;
  var age=calcAge(staff.birthdate);
  // 合計支給額（非課税通勤費含む）
  var totalPay = grossPay + commuteData.taxFree + commuteData.taxable;
  var totalDeduction = tax + pension + health + nursingCare + childSupport + empIns;
  var netPayFinal = totalPay - totalDeduction;
  var monthStr = year + '年' + month + '月';

  // レイアウト設定適用
  var fsMap = {small:'0.72rem', medium:'0.82rem', large:'0.92rem'};
  var colorMap = {
    blue: {header:'#dde4f0', total:'#1a3a6b', totalBg:'#eef2fa'},
    green:{header:'#d4edda', total:'#155724', totalBg:'#e8f5e9'},
    gray: {header:'#e8e8e8', total:'#333',    totalBg:'#f5f5f5'},
    mono: {header:'#ccc',    total:'#000',    totalBg:'#eee'}
  };
  var clr = colorMap[settings.color||'blue'];
  var fs  = fsMap[settings.font_size||'medium'];

  var html = '';
  html += '<div class="ps-wrap" style="font-size:'+fs+'">';
  // ヘッダー
  html += '<div class="ps-company">'+(settings.company||'合同会社エニクック')+'</div>';
  html += '<div class="ps-title">' + year + '年' + month + '月分　給与明細書</div>';
  html += '<div class="ps-meta">';
  html += '<div class="ps-meta-left">';
  html += '<span class="ps-emp">（' + (staff.staff_number||'-') + '）' + staff.name + '　様</span>';
  html += '</div>';
  html += '<div class="ps-meta-right">支給日：令和' + (year-2018) + '年' + month + '月'+(settings.pay_day||10)+'日</div>';
  html += '</div>';

  // メインテーブル
  html += '<table class="ps-table">';

  // 勤怠行
  html += '<style>.ps-section-header th{background:'+clr.header+'!important;}.ps-total-label{color:'+clr.total+'!important;}.ps-total-val{color:'+clr.total+'!important;background:'+clr.totalBg+'!important;}.ps-total-row td{border-top:2px solid '+clr.total+'!important;}</style>';
  html += '<tr class="ps-section-header">';
  html += '<th colspan="2">勤　怠</th>';
  html += '<th colspan="2">支　給</th>';
  html += '<th colspan="2">控　除</th>';
  html += '<th colspan="2">その他</th>';
  html += '</tr>';

  // データ行
  // 追加支給項目（スタッフの明細書種別から取得）
  var psType = staff.payslip_type || staff.type || 'hourly';
  var typeKey = psType === 'officer' ? 'pay_items_officer'
              : psType === 'employee' ? 'pay_items_employee'
              : 'pay_items_hourly';
  var extraPayItems = (settings[typeKey] || settings.pay_items || []).map(function(item){
    // 月次入力がある場合は金額を上書き
    var mi = monthlyVarItems.find(function(x){return x.name===item.name;});
    if(mi) return Object.assign({},item,{amount:mi.amount});
    return item;
  });
  var extraTotalPay = extraPayItems.reduce(function(acc,i){return acc+(i.amount||0);},0);
  totalPay += extraTotalPay;
  netPayFinal += extraTotalPay;

  // カテゴリ別に追加項目を仕分け
  var extraAttendance=[], extraPay=[], extraDeduction=[], extraOther=[];
  var extraTotalDeductExtra = 0;
  extraPayItems.forEach(function(item){
    var cat=item.category||'pay';
    var isSubtract = item.calc_add === 'sub';
    if(isSubtract){ extraTotalDeductExtra += (item.amount||0); }
    if(cat==='attendance') extraAttendance.push(item);
    else if(cat==='deduction') extraDeduction.push(item);
    else if(cat==='other') extraOther.push(item);
    else extraPay.push(item);
  });
  netPayFinal -= extraTotalDeductExtra;

  // 勤怠列
  var attRows = [workDays+'日'].concat(extraAttendance.map(function(i){return i.name+'：'+numFmt(i.amount);}));
  // 支給列
  var basicPayLabel = psType === 'officer' ? '役員報酬' : (psType === 'employee' ? '基本給' : '基本給');
  var payRows = [
    [basicPayLabel, numFmt(grossPay)],
    ['非課税通勤費', numFmt(commuteData.taxFree)],
  ];
  if(commuteData.taxable>0) payRows.push(['課税通勤費', numFmt(commuteData.taxable)]);
  extraPay.forEach(function(i){payRows.push([i.name, numFmt(i.amount)]);});
  // 控除列
  var dedRows = [
    ['健康保険料', numFmt(health)],
    ['介護保険料', nursingCare>0 ? numFmt(nursingCare) : '0'],
    ['厚生年金保険', numFmt(pension)],
    ['子育て支援金', numFmt(childSupport)],
    ['所得税', numFmt(tax)],
  ];
  if(empIns>0) dedRows.push(['雇用保険料', numFmt(empIns)]);
  extraDeduction.forEach(function(i){dedRows.push([i.name, numFmt(i.amount)]);});
  // その他列
  var otherRows = [['年末調整還付','0'],['年末調整徴収','0']];
  extraOther.forEach(function(i){otherRows.push([i.name, numFmt(i.amount)]);});

  // 最大行数
  var maxRows = Math.max(attRows.length, payRows.length, dedRows.length, otherRows.length);
  var rows2 = [];
  for(var ri=0; ri<maxRows; ri++){
    var att  = ri===0 ? '労働日数' : (extraAttendance[ri-1]?extraAttendance[ri-1].name:'');
    var attV = ri<attRows.length ? attRows[ri] : '';
    var pay  = payRows[ri]  ? payRows[ri][0]  : '';
    var payV = payRows[ri]  ? payRows[ri][1]  : '';
    var ded  = dedRows[ri]  ? dedRows[ri][0]  : '';
    var dedV = dedRows[ri]  ? dedRows[ri][1]  : '';
    var oth  = otherRows[ri]? otherRows[ri][0]: '';
    var othV = otherRows[ri]? otherRows[ri][1]: '';
    rows2.push([att,attV,pay,payV,ded,dedV,oth,othV]);
  }

  rows2.forEach(function(r) {
    html += '<tr class="ps-row">';
    html += '<td class="ps-label">' + r[0] + '</td><td class="ps-val">' + r[1] + '</td>';
    html += '<td class="ps-label">' + r[2] + '</td><td class="ps-val">' + r[3] + '</td>';
    html += '<td class="ps-label">' + r[4] + '</td><td class="ps-val">' + r[5] + '</td>';
    html += '<td class="ps-label">' + r[6] + '</td><td class="ps-val">' + r[7] + '</td>';
    html += '</tr>';
  });

  // 合計行
  html += '<tr class="ps-total-row">';
  html += '<td class="ps-label">扶養人数</td><td class="ps-val">' + (staff.dependents||0) + '</td>';
  html += '<td class="ps-label ps-total-label">合　計</td><td class="ps-val ps-total-val">' + numFmt(totalPay) + '</td>';
  html += '<td class="ps-label ps-total-label">合　計</td><td class="ps-val ps-total-val">' + numFmt(totalDeduction) + '</td>';
  html += '<td class="ps-label">税額表</td><td class="ps-val">' + (staff.tax_type==='otsu'?'乙欄':'甲欄') + '</td>';
  html += '</tr>';

  html += '</table>';

  // 差引支給額ブロック
  html += '<div class="ps-bottom">';
  html += '<div class="ps-bottom-block">';
  html += '<div class="ps-bottom-label">現金支給額</div><div class="ps-bottom-val">0</div>';
  html += '</div>';
  html += '<div class="ps-bottom-block ps-net">';
  html += '<div class="ps-bottom-label">差引支給額</div><div class="ps-bottom-val ps-net-val">' + numFmt(netPayFinal) + '</div>';
  html += '</div>';
  html += '<div class="ps-bottom-block">';
  html += '<div class="ps-bottom-label">振込支給額</div><div class="ps-bottom-val">' + numFmt(netPayFinal) + '</div>';
  html += '</div>';
  html += '</div>';

  // 累計・備考
  html += '<div class="ps-footer">';
  html += '<div class="ps-footer-item"><span>課税支給累計</span></div>';
  html += '<div class="ps-footer-item"><span>社会保険累計</span></div>';
  html += '<div class="ps-footer-item"><span>所得税累計</span></div>';
  html += '</div>';

  // 備考
  // 共通備考＋個別備考
  var noteText = settings.note || 'いつも有難うございます。';
  var personalNote = monthlyNote || staff.payslip_note || '';
  if (noteText) html += '<div class="ps-note">※ ' + noteText + '</div>';
  if (personalNote) html += '<div class="ps-note" style="margin-top:6px;background:#fff4e6;border-color:#f0a040;">📝 ' + personalNote + '</div>';

  // 打刻明細（設定に応じて表示）
  var showDetail = settings.show_detail || 'collapse';
  if (showDetail !== 'hide' && detailRows) {
    if (showDetail === 'collapse') {
      html += '<details class="ps-detail-toggle"><summary>▼ 打刻明細を表示</summary>';
      html += '<div class="table-scroll" style="margin-top:12px;"><table class="data-table"><thead><tr><th>日付</th><th>出勤(実)</th><th>退勤(実)</th><th>出勤(計)</th><th>退勤(計)</th><th>出勤時間</th><th>時給</th><th>日給</th></tr></thead><tbody>'+detailRows+'</tbody></table></div>';
      html += '</details>';
    } else {
      html += '<div class="table-scroll" style="margin-top:16px;"><table class="data-table"><thead><tr><th>日付</th><th>出勤(実)</th><th>退勤(実)</th><th>出勤(計)</th><th>退勤(計)</th><th>出勤時間</th><th>時給</th><th>日給</th></tr></thead><tbody>'+detailRows+'</tbody></table></div>';
    }
  }

  html += '</div>'; // ps-wrap

  // 新フォーマット（PDF準拠）
  document.getElementById('payslipNew').innerHTML = html;

  // 旧フォーマット（詳細）
  var oldHtml = '';
  oldHtml += '<div class="payslip">';
  oldHtml += '<div class="payslip-header"><h2>給与明細書</h2><p>'+year+'年'+month+'月分</p></div>';
  oldHtml += '<div class="payslip-info">';
  oldHtml += '<div><strong>氏名:</strong> '+staff.name+'</div>';
  oldHtml += (staff.staff_number?'<div><strong>登録番号:</strong> '+staff.staff_number+'</div>':'');
  oldHtml += (age!==null?'<div><strong>年齢:</strong> '+age+'歳</div>':'');
  oldHtml += (staff.address?'<div><strong>住所:</strong> '+staff.address+'</div>':'');
  oldHtml += '<div><strong>扶養親族:</strong> '+(staff.dependents||0)+'人</div>';
  oldHtml += '<div><strong>出勤日数:</strong> '+workDays+'日</div>';
  oldHtml += (staff.lunch_break?'<div><strong>昼休み:</strong> '+(staff.lunch_start||'12:00')+'〜'+(staff.lunch_end||'13:00')+'（控除あり）</div>':'');
  oldHtml += '</div>';
  oldHtml += '<div class="table-scroll"><table class="data-table"><thead><tr><th>日付</th><th>出勤(実)</th><th>退勤(実)</th><th>出勤(計)</th><th>退勤(計)</th><th>出勤時間</th><th>時給</th><th>日給</th></tr></thead><tbody>'+detailRows+'</tbody></table></div>';
  oldHtml += '<div class="payslip-summary">';
  oldHtml += '<div class="summary-row"><span>基本給（税引前）</span><strong>'+formatCurrency(grossPay)+'</strong></div>';
  oldHtml += (commuteData.total>0?'<div class="summary-row"><span>通勤費（'+workDays+'日×'+formatCurrency(staff.commute_daily_amount||0)+'）</span><span>'+formatCurrency(commuteData.total)+'</span></div>':'');
  oldHtml += (commuteData.taxable>0?'<div class="summary-row" style="font-size:.8rem;color:#dc2626;"><span>　うち課税分</span><span>'+formatCurrency(commuteData.taxable)+'</span></div>':'');
  oldHtml += '<div class="summary-row deduction"><span>源泉徴収税（'+(staff.tax_type==='otsu'?'乙欄':'甲欄・扶養'+(staff.dependents||0)+'人')+'）</span><span>- '+formatCurrency(tax)+'</span></div>';
  oldHtml += (pension>0?'<div class="summary-row deduction"><span>厚生年金保険料</span><span>- '+formatCurrency(pension)+'</span></div>':'');
  oldHtml += (health>0?'<div class="summary-row deduction"><span>健康保険料</span><span>- '+formatCurrency(health)+'</span></div>':'');
  oldHtml += (nursingCare>0?'<div class="summary-row deduction"><span>介護保険料</span><span>- '+formatCurrency(nursingCare)+'</span></div>':'');
  oldHtml += (childSupport>0?'<div class="summary-row deduction"><span>子ども・子育て支援金</span><span>- '+formatCurrency(childSupport)+'</span></div>':'');
  oldHtml += (empIns>0?'<div class="summary-row deduction"><span>雇用保険料</span><span>- '+formatCurrency(empIns)+'</span></div>':'');
  oldHtml += '<div class="summary-row total"><span>差引支給額</span><strong class="net-pay">'+formatCurrency(netPayFinal)+'</strong></div>';
  oldHtml += '</div></div>';
  document.getElementById('payslipOld').innerHTML = oldHtml;

  // デフォルトは新フォーマット
  switchPayslip('new');
  openModal('payslipModal');
}
function numFmt(n){ return Number(n||0).toLocaleString(); }
function switchPayslip(mode) {
  var isNew = mode === 'new';
  document.getElementById('payslipNew').style.display = isNew ? 'block' : 'none';
  document.getElementById('payslipOld').style.display = isNew ? 'none' : 'block';
  document.getElementById('btnPayslipNew').style.background = isNew ? 'var(--accent)' : 'var(--surface2)';
  document.getElementById('btnPayslipNew').style.color = isNew ? '#fff' : 'var(--text)';
  document.getElementById('btnPayslipOld').style.background = isNew ? 'var(--surface2)' : 'var(--accent)';
  document.getElementById('btnPayslipOld').style.color = isNew ? 'var(--text)' : '#fff';
}
function printPayslip(){window.print();}

var currentTaxType='kou',currentInsuranceType='pension';
var insuranceLabels={pension:'厚生年金',health:'健康保険（介護なし）',health_nursing:'健康保険（介護込み）',child_support:'子ども・子育て支援金'};
async function loadTaxTab(){loadTaxTable('kou');loadInsuranceTable('pension');}
async function loadTaxTable(type){
  currentTaxType=type;
  document.querySelectorAll('.tax-type-btn').forEach(function(b){b.classList.toggle('active',b.dataset.type===type);});
  var rows=await DB.getTaxTable(type),tbody=document.getElementById('taxTableBody');tbody.innerHTML='';
  rows.slice().sort(function(a,b){return a.income_from-b.income_from;}).forEach(function(r){var tr=document.createElement('tr');tr.innerHTML='<td>'+formatCurrency(r.income_from)+' ～</td><td>'+formatCurrency(r.tax_amount)+'</td><td><button class="btn-sm btn-edit" onclick="openTaxEditModal(\''+r.id+'\')">✏️</button> <button class="btn-sm btn-delete" onclick="deleteTaxRow(\''+r.id+'\')">🗑️</button></td>';tbody.appendChild(tr);});
  document.getElementById('taxTableTitle').textContent='📄 '+(type==='kou'?'甲欄':'乙欄')+' 税額一覧（'+rows.length+'件）';
  openCollapsible('taxTableSection');
}
async function loadInsuranceTable(type){
  currentInsuranceType=type;
  document.querySelectorAll('.insurance-type-btn').forEach(function(b){b.classList.toggle('active',b.dataset.type===type);});
  var rows=await DB.getInsuranceTable(type),tbody=document.getElementById('insuranceTableBody');tbody.innerHTML='';
  rows.slice().sort(function(a,b){return a.grade-b.grade;}).forEach(function(r){var tr=document.createElement('tr');tr.innerHTML='<td>'+r.label+'</td><td>'+formatCurrency(r.standard)+'</td><td>'+formatCurrency(r.monthly_min)+' 〜 '+(r.monthly_max>=999999?'上限なし':formatCurrency(r.monthly_max))+'</td><td>'+formatCurrency(r.employee)+'</td><td>'+formatCurrency(r.employer)+'</td>';tbody.appendChild(tr);});
  document.getElementById('insuranceTableTitle').textContent='📄 '+(insuranceLabels[type]||type)+' 保険料一覧（'+rows.length+'件）';
  openCollapsible('insuranceTableSection');
}
function openTaxCsvModal(){document.getElementById('taxCsvType').value=currentTaxType;document.getElementById('taxCsvFile').value='';document.getElementById('taxCsvPreview').style.display='none';document.getElementById('taxCsvPreviewBody').innerHTML='';openModal('taxCsvModal');}
var taxCsvParsed=[];
async function previewTaxCsv(){var file=document.getElementById('taxCsvFile').files[0];if(!file){showToast('ファイルを選択してください','error');return;}var text=await file.text(),lines=text.split('\n').filter(function(l){return l.trim();});taxCsvParsed=[];var tbody=document.getElementById('taxCsvPreviewBody');tbody.innerHTML='';var first=lines[0].split(',')[0],dl=(isNaN(parseInt(first))||lines[0].indexOf('月収')>=0)?lines.slice(1):lines;for(var i=0;i<dl.length;i++){var cols=dl[i].split(',').map(function(c){return c.trim().replace(/["\u00a5]/g,'');});if(cols.length<2)continue;var inf=parseInt(cols[0]),ta=parseInt(cols[1]);if(isNaN(inf)||isNaN(ta))continue;taxCsvParsed.push({income_from:inf,tax_amount:ta});var tr=document.createElement('tr');tr.innerHTML='<td>'+formatCurrency(inf)+' ～</td><td>'+formatCurrency(ta)+'</td>';tbody.appendChild(tr);}document.getElementById('taxCsvPreview').style.display='block';document.getElementById('taxCsvCount').textContent=taxCsvParsed.length+'行読み込み済み';}
async function importTaxCsv(){if(!taxCsvParsed.length){showToast('データがありません','error');return;}var type=document.getElementById('taxCsvType').value;if(!confirmAction(taxCsvParsed.length+'行で税額表（'+(type==='kou'?'甲欄':'乙欄')+'）を上書きしますか？'))return;await DB.replaceTaxTable(type,taxCsvParsed.map(function(r){return Object.assign({},r,{id:_uid()});}));closeModal('taxCsvModal');showToast('税額表を更新しました');loadTaxTable(type);}
function downloadTaxCsvTemplate(){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['月収以上,税額\n88000,130\n89000,220'],{type:'text/csv;charset=utf-8;'}));a.download='tax_template.csv';a.click();}
function openInsuranceCsvModal(){document.getElementById('insuranceCsvType').value=currentInsuranceType;document.getElementById('insuranceCsvFile').value='';document.getElementById('insuranceCsvPreview').style.display='none';document.getElementById('insuranceCsvPreviewBody').innerHTML='';openModal('insuranceCsvModal');}
var insuranceCsvParsed=[];
async function previewInsuranceCsv(){var file=document.getElementById('insuranceCsvFile').files[0];if(!file){showToast('ファイルを選択してください','error');return;}var text=await file.text(),lines=text.split('\n').filter(function(l){return l.trim();});insuranceCsvParsed=[];var tbody=document.getElementById('insuranceCsvPreviewBody');tbody.innerHTML='';var first=lines[0].split(',')[0],dl=isNaN(parseInt(first))?lines.slice(1):lines,grade=1;for(var i=0;i<dl.length;i++){var cols=dl[i].split(',').map(function(c){return c.trim().replace(/["\u00a5円,]/g,'');});if(cols.length<4)continue;var standard=parseInt(cols[1])||parseInt(cols[0]),monthly_min=parseInt(cols[2])||0,monthly_max=parseInt(cols[3])||999999,employee=parseInt(cols[4])||parseInt(cols[2]),employer=parseInt(cols[5])||employee;if(isNaN(standard)||isNaN(employee))continue;var label=grade+'等級';insuranceCsvParsed.push({grade:grade,label:label,standard:standard,monthly_min:monthly_min,monthly_max:monthly_max,employee:employee,employer:employer});var tr=document.createElement('tr');tr.innerHTML='<td>'+label+'</td><td>'+formatCurrency(standard)+'</td><td>'+formatCurrency(employee)+'</td>';tbody.appendChild(tr);grade++;}document.getElementById('insuranceCsvPreview').style.display='block';document.getElementById('insuranceCsvCount').textContent=insuranceCsvParsed.length+'等級分読み込み済み';}
async function importInsuranceCsv(){if(!insuranceCsvParsed.length){showToast('データがありません','error');return;}var type=document.getElementById('insuranceCsvType').value,label=insuranceLabels[type]||type;if(!confirmAction(insuranceCsvParsed.length+'等級で'+label+'料額表を上書きしますか？'))return;await DB.replaceInsuranceTable(type,insuranceCsvParsed.map(function(r){return Object.assign({},r,{id:_uid()});}));closeModal('insuranceCsvModal');showToast(label+'料額表を更新しました');loadInsuranceTable(type);_pensionTable=[];_healthTable=[];_healthNursingTable=[];_childSupportTable=[];}
function downloadInsuranceCsvTemplate(){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['等級,標準報酬月額,月収下限,月収上限,被保険者負担,事業主負担\n1,88000,0,93000,8052,8052'],{type:'text/csv;charset=utf-8;'}));a.download='insurance_template.csv';a.click();}
async function openTaxModal(id){document.getElementById('taxId').value=id||'';document.getElementById('taxIncomeFrom').value='';document.getElementById('taxAmount').value='';if(id){var rows=await DB.getTaxTable(currentTaxType),row=rows.find(function(r){return r.id===id;});if(row){document.getElementById('taxIncomeFrom').value=row.income_from;document.getElementById('taxAmount').value=row.tax_amount;}}openModal('taxModal');}
function openTaxEditModal(id){openTaxModal(id);}
async function saveTaxRow(){var id=document.getElementById('taxId').value,inf=parseInt(document.getElementById('taxIncomeFrom').value),ta=parseInt(document.getElementById('taxAmount').value);if(isNaN(inf)||isNaN(ta)){showToast('金額を正しく入力してください','error');return;}var row={income_from:inf,tax_amount:ta};if(id)row.id=id;await DB.saveTaxRow(currentTaxType,row);closeModal('taxModal');showToast('保存しました');loadTaxTable(currentTaxType);}
async function deleteTaxRow(id){if(!confirmAction('この行を削除しますか？'))return;await DB.deleteTaxRow(currentTaxType,id);showToast('削除しました');loadTaxTable(currentTaxType);}

async function loadLeaveTab(){var staff=await DB.getStaff(),sel=document.getElementById('leaveStaffSelect'),cv=sel.value;sel.innerHTML='<option value="">全スタッフ</option>';staff.filter(function(s){return s.is_active;}).forEach(function(s){var o=document.createElement('option');o.value=s.id;o.textContent=s.name;if(s.id===cv)o.selected=true;sel.appendChild(o);});await loadLeaveList();}
async function loadLeaveList(){
  var staffId=document.getElementById('leaveStaffSelect').value,staff=await DB.getStaff(),tbody=document.getElementById('leaveTableBody'),leaveData=await DB.getLeaveAll();
  if(!staffId){
    document.getElementById('leaveDetailSection').style.display='none';
    tbody.closest('table').querySelector('thead tr').innerHTML='<th>スタッフ</th><th>付与日数</th><th>使用日数</th><th>残日数</th><th>詳細</th>';tbody.innerHTML='';
    staff.filter(function(s){return s.is_active;}).forEach(function(s){var leaves=leaveData.filter(function(l){return l.staff_id===s.id;});var granted=leaves.filter(function(l){return l.type==='grant';}).reduce(function(sum,l){return sum+(l.days||0);},0);var used=leaves.filter(function(l){return l.type==='use';}).reduce(function(sum,l){return sum+(l.days||0);},0),remaining=granted-used;var tr=document.createElement('tr');tr.innerHTML='<td>'+s.name+'</td><td>'+granted+'日</td><td>'+used+'日</td><td><strong style="color:'+(remaining<3?'#dc2626':'#16a34a')+'">'+remaining+'日</strong></td><td><button class="btn-sm btn-edit" onclick="selectLeaveStaff(\''+s.id+'\')">詳細</button></td>';tbody.appendChild(tr);});
    if(!staff.filter(function(s){return s.is_active;}).length)tbody.innerHTML='<tr><td colspan="5" class="empty-cell">スタッフが登録されていません</td></tr>';return;
  }
  var s=staff.find(function(x){return x.id===staffId;}),leaves=leaveData.filter(function(l){return l.staff_id===staffId;});
  var granted=leaves.filter(function(l){return l.type==='grant';}).reduce(function(sum,l){return sum+(l.days||0);},0);
  var used=leaves.filter(function(l){return l.type==='use';}).reduce(function(sum,l){return sum+(l.days||0);},0),remaining=granted-used;
  document.getElementById('leaveDetailSection').style.display='block';document.getElementById('leaveStaffName').textContent=s?s.name:'';document.getElementById('leaveGranted').textContent=granted+'日';document.getElementById('leaveUsed').textContent=used+'日';document.getElementById('leaveRemaining').textContent=remaining+'日';document.getElementById('leaveRemaining').style.color=remaining<3?'#dc2626':'#16a34a';
  tbody.closest('table').querySelector('thead tr').innerHTML='<th>日付</th><th>種別</th><th>日数</th><th>理由</th><th>操作</th>';tbody.innerHTML='';
  leaves.slice().sort(function(a,b){return a.date>b.date?-1:1;}).forEach(function(l){var tr=document.createElement('tr');tr.innerHTML='<td>'+formatDateJP(l.date)+'</td><td><span class="badge '+(l.type==='grant'?'badge-active':'badge-special')+'">'+(l.type==='grant'?'付与':'使用')+'</span></td><td>'+l.days+'日</td><td>'+(l.reason||'-')+'</td><td><button class="btn-sm btn-delete" onclick="deleteLeave(\''+l.id+'\')">🗑️ 削除</button></td>';tbody.appendChild(tr);});
  if(!leaves.length)tbody.innerHTML='<tr><td colspan="5" class="empty-cell">有休記録がありません</td></tr>';
}
function selectLeaveStaff(staffId){document.getElementById('leaveStaffSelect').value=staffId;loadLeaveList();}
async function openLeaveModal(){var staffId=document.getElementById('leaveStaffSelect').value,staff=await DB.getStaff(),sel=document.getElementById('leaveModalStaff');sel.innerHTML='';staff.filter(function(s){return s.is_active;}).forEach(function(s){var o=document.createElement('option');o.value=s.id;o.textContent=s.name;if(s.id===staffId)o.selected=true;sel.appendChild(o);});document.getElementById('leaveDate').value=todayStr();document.getElementById('leaveType').value='grant';document.getElementById('leaveDays').value='1';document.getElementById('leaveReason').value='';openModal('leaveModal');}
async function saveLeave(){var staff_id=document.getElementById('leaveModalStaff').value,date=document.getElementById('leaveDate').value,type=document.getElementById('leaveType').value,days=parseFloat(document.getElementById('leaveDays').value)||0,reason=document.getElementById('leaveReason').value.trim();if(!staff_id||!date||days<=0){showToast('スタッフ・日付・日数を正しく入力してください','error');return;}await DB.saveLeave({staff_id:staff_id,date:date,type:type,days:days,reason:reason});closeModal('leaveModal');showToast('保存しました');loadLeaveList();}
async function deleteLeave(id){if(!confirmAction('この有休記録を削除しますか？'))return;await DB.deleteLeave(id);showToast('削除しました');loadLeaveList();}

// ============================================================
// タブ: 本日の出勤状況
// ============================================================
async function loadTodayTab() {
  var today = todayStr();
  var now = new Date();
  var days = ['日','月','火','水','木','金','土'];
  document.getElementById('todayDate').textContent =
    now.getFullYear()+'年'+(now.getMonth()+1)+'月'+now.getDate()+'日（'+days[now.getDay()]+'） の出勤状況';

  var staff = await DB.getStaff();
  var activeStaff = staff.filter(function(s){ return s.is_active && s.type !== 'officer'; });
  var records = await DB.getAttendance({ year: now.getFullYear(), month: now.getMonth()+1 });
  var todayRecords = records.filter(function(r){ return r.date === today; });
  var staffMap = {};
  activeStaff.forEach(function(s){ staffMap[s.id] = s; });

  var inList = [], doneList = [], outList = [];

  activeStaff.forEach(function(s) {
    var r = todayRecords.find(function(x){ return x.staff_id === s.id; });
    if (!r || !r.clock_in_actual) {
      outList.push(s);
    } else if (r.clock_in_actual && !r.clock_out_actual) {
      inList.push({ staff: s, record: r });
    } else {
      doneList.push({ staff: s, record: r });
    }
  });

  // カウント表示
  document.getElementById('todayCountIn').textContent = inList.length + '人';
  document.getElementById('todayCountDone').textContent = doneList.length + '人';
  document.getElementById('todayCountOut').textContent = outList.length + '人';

  // 出勤中テーブル
  var inBody = document.getElementById('todayInBody');
  inBody.innerHTML = '';
  if (!inList.length) {
    inBody.innerHTML = '<tr><td colspan="4" class="empty-cell">出勤中のスタッフはいません</td></tr>';
  } else {
    // 出勤時刻が早い順
    inList.sort(function(a,b){ return a.record.clock_in_actual > b.record.clock_in_actual ? 1 : -1; });
    inList.forEach(function(item) {
      var nowMins = now.getHours()*60 + now.getMinutes();
      var inMins = timeToMinutes(item.record.clock_in_calc || item.record.clock_in_actual);
      var lunchB = item.staff.lunch_break || false;
    var workMins = Math.max(0, nowMins - inMins - (lunchB ? 60 : 0));
      var tr = document.createElement('tr');
      tr.style.background = '#f0fdf4';
      tr.innerHTML =
        '<td><strong>' + item.staff.name + '</strong></td>' +
        '<td><span style="font-size:1.05rem;font-weight:700;color:#16a34a;">' + item.record.clock_in_actual + '</span></td>' +
        '<td>' + formatWorkTime(workMins) + '（経過）</td>' +
        '<td><span class="badge badge-type">' + staffTypeLabel(item.staff.type) + '</span></td>';
      inBody.appendChild(tr);
    });
  }

  // 退勤済みテーブル
  var doneBody = document.getElementById('todayDoneBody');
  doneBody.innerHTML = '';
  if (!doneList.length) {
    doneBody.innerHTML = '<tr><td colspan="4" class="empty-cell">退勤済みのスタッフはいません</td></tr>';
  } else {
    doneList.sort(function(a,b){ return a.record.clock_out_actual > b.record.clock_out_actual ? -1 : 1; });
    doneList.forEach(function(item) {
      var r = item.record;
      var lunchBDone = item.staff.lunch_break || false;
      var workMins = timeToMinutes(r.clock_out_calc||r.clock_out_actual) - timeToMinutes(r.clock_in_calc||r.clock_in_actual) - (lunchBDone ? 60 : 0);
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + item.staff.name + '</td>' +
        '<td>' + r.clock_in_actual + '</td>' +
        '<td><strong>' + r.clock_out_actual + '</strong></td>' +
        '<td>' + formatWorkTime(Math.max(0,workMins)) + '</td>';
      doneBody.appendChild(tr);
    });
  }

  // 未出勤テーブル
  var outBody = document.getElementById('todayOutBody');
  outBody.innerHTML = '';
  if (!outList.length) {
    outBody.innerHTML = '<tr><td colspan="2" class="empty-cell">未出勤のスタッフはいません</td></tr>';
  } else {
    outList.forEach(function(s) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + s.name + '</td>' +
        '<td><span class="badge badge-type">' + staffTypeLabel(s.type) + '</span></td>';
      outBody.appendChild(tr);
    });
  }
}

// ============================================================
// タブ: 月別出勤表
// ============================================================
async function loadMonthlyTab() {
  // 初回は現在の年月をデフォルトにセット
  var yearEl  = document.getElementById('monthlyYear');
  var monthEl = document.getElementById('monthlyMonth');
  if (!yearEl.dataset.initialized) {
    yearEl.value  = currentYear();
    monthEl.value = currentMonth();
    yearEl.dataset.initialized = '1';
  }
  var year  = parseInt(yearEl.value);
  var month = parseInt(monthEl.value);
  var wrap  = document.getElementById('monthlyTableWrap');
  wrap.innerHTML = '<p style="padding:20px;color:var(--text-muted);">読み込み中...</p>';

  var staff   = await DB.getStaff();
  var active  = staff.filter(function(s){ return s.is_active && s.type !== 'officer'; });
  var records = await DB.getAttendance({ year: year, month: month });

  // 月の日数を取得
  var daysInMonth = new Date(year, month, 0).getDate();
  var days = [];
  for (var d = 1; d <= daysInMonth; d++) days.push(d);

  var dayNames = ['日','月','火','水','木','金','土'];

  // テーブル構築
  var html = '<table class="monthly-table">';

  // ヘッダー行1: 月名
  html += '<thead>';
  html += '<tr><th class="monthly-name-col" rowspan="2">氏名</th>';
  days.forEach(function(d) {
    var date = new Date(year, month-1, d);
    var dow  = date.getDay();
    var cls  = dow===0?'monthly-sun':dow===6?'monthly-sat':'';
    html += '<th class="monthly-day-col '+cls+'">' + d + '<br><span class="monthly-dow">'+dayNames[dow]+'</span></th>';
  });
  html += '<th class="monthly-total-col">出勤<br>日数</th><th class="monthly-total-col">出勤<br>時間</th></tr>';
  html += '</thead>';

  // スタッフ行
  html += '<tbody>';
  active.forEach(function(s) {
    var staffRecords = records.filter(function(r){ return r.staff_id === s.id; });
    var totalDays = 0, totalMins = 0;

    html += '<tr><td class="monthly-name-cell">' + s.name + '</td>';

    days.forEach(function(d) {
      var dateStr = year + '-' + String(month).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      var date    = new Date(year, month-1, d);
      var dow     = date.getDay();
      var r = staffRecords.find(function(x){ return x.date === dateStr; });
      var cls = dow===0?'monthly-sun':dow===6?'monthly-sat':'';

      if (r && r.clock_in_actual) {
        var mins = r.clock_out_calc ? calcWorkMinutes(r.clock_in_calc, r.clock_out_calc, s.lunch_break, s.lunch_start, s.lunch_end) : 0;
        totalDays++;
        totalMins += mins;
        var inTime  = r.clock_in_actual  || '-';
        var outTime = r.clock_out_actual || '未退勤';
        var outCls  = r.clock_out_actual ? '' : 'monthly-missing';
        html += '<td class="monthly-cell '+cls+'">' +
          '<span class="monthly-in">'  + inTime  + '</span><br>' +
          '<span class="monthly-out '+outCls+'">' + outTime + '</span>' +
          '</td>';
      } else {
        html += '<td class="monthly-cell monthly-empty '+cls+'">－</td>';
      }
    });

    // 合計
    var totalH = Math.floor(totalMins/60), totalM = totalMins%60;
    var totalStr = totalH + ':' + String(totalM).padStart(2,'0');
    html += '<td class="monthly-total-cell">' + totalDays + '日</td>';
    html += '<td class="monthly-total-cell">' + totalStr  + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';

  wrap.innerHTML = html;

  // 現在の月のデフォルト選択
  document.getElementById('monthlyMonth').value = month;
  document.getElementById('monthlyYear').value  = year;
}

function printMonthly() {
  window.print();
}

// ============================================================
// 給与明細設定
// ============================================================
var _payslipSettings = null;
var _currentPsTab = 'common';

async function getPayslipSettings() {
  if (_payslipSettings) return _payslipSettings;
  var stored = localStorage.getItem('payslip_settings');
  if (stored) { _payslipSettings = JSON.parse(stored); return _payslipSettings; }
  try {
    var db = getDB();
    if (db) {
      var snap = await db.collection('payslip_settings').doc('main').get();
      if (snap.exists) {
        _payslipSettings = snap.data();
        localStorage.setItem('payslip_settings', JSON.stringify(_payslipSettings));
        return _payslipSettings;
      }
    }
  } catch(e) {}
  _payslipSettings = {
    company:'合同会社エニクック', pay_day:10,
    font_size:'medium', orientation:'portrait', color:'blue', show_detail:'collapse',
    note:'いつも有難うございます。',
    pay_items_hourly:[], pay_items_employee:[], pay_items_officer:[]
  };
  return _payslipSettings;
}

function switchPsTab(type) {
  _currentPsTab = type;
  document.querySelectorAll('.ps-set-tab').forEach(function(b){b.classList.toggle('active', b.dataset.ptype===type);});
  document.querySelectorAll('.ps-set-panel').forEach(function(p){p.style.display='none';});
  document.getElementById('ps-panel-'+type).style.display='block';
}

async function loadPayslipSettingTab() {
  var s = await getPayslipSettings();
  document.getElementById('ps_company').value    = s.company || '合同会社エニクック';
  document.getElementById('ps_pay_day').value    = s.pay_day || 10;
  document.getElementById('ps_font_size').value  = s.font_size || 'medium';
  document.getElementById('ps_orientation').value= s.orientation || 'portrait';
  document.getElementById('ps_color').value      = s.color || 'blue';
  document.getElementById('ps_show_detail').value= s.show_detail || 'collapse';
  document.getElementById('ps_note').value       = s.note || '';
  ['hourly','employee','officer'].forEach(function(t){
    var wrap = document.getElementById('payItemsWrap_'+t);
    wrap.innerHTML = '';
    (s['pay_items_'+t]||[]).forEach(function(item){addPayItem(t,item.name,item.amount,false,item.category||'pay',item.calc_add||'add',item.tax_type||'taxable',item.wage_type||'wage',item.salary_type||'fixed');});
  });
  switchPsTab('common');
}

async function savePayslipSettings() {
  var s = {
    company:     document.getElementById('ps_company').value.trim(),
    pay_day:     parseInt(document.getElementById('ps_pay_day').value)||10,
    font_size:   document.getElementById('ps_font_size').value,
    orientation: document.getElementById('ps_orientation').value,
    color:       document.getElementById('ps_color').value,
    show_detail: document.getElementById('ps_show_detail').value,
    note:        document.getElementById('ps_note').value.trim(),
    pay_items_hourly:[], pay_items_employee:[], pay_items_officer:[]
  };
  ['hourly','employee','officer'].forEach(function(t){
    document.querySelectorAll('#payItemsWrap_'+t+' .pay-item-row').forEach(function(row){
      var name     = row.querySelector('.pay-item-name').value.trim();
      var amt      = parseInt(row.querySelector('.pay-item-amount').value)||0;
      var cat      = row.querySelector('.pay-item-category')    ? row.querySelector('.pay-item-category').value    : 'pay';
      var calc_add = row.querySelector('.pay-item-calc-add')    ? row.querySelector('.pay-item-calc-add').value    : 'add';
      var tax_type = row.querySelector('.pay-item-tax-type')    ? row.querySelector('.pay-item-tax-type').value    : 'taxable';
      var wage_type= row.querySelector('.pay-item-wage-type')   ? row.querySelector('.pay-item-wage-type').value   : 'wage';
      var sal_type = row.querySelector('.pay-item-salary-type') ? row.querySelector('.pay-item-salary-type').value : 'included';
      if(name) s['pay_items_'+t].push({name:name, amount:amt, category:cat, calc_add:calc_add, tax_type:tax_type, wage_type:wage_type, salary_type:sal_type});
    });
  });
  _payslipSettings = s;
  localStorage.setItem('payslip_settings', JSON.stringify(s));
  try {
    var db = getDB();
    if (db) await db.collection('payslip_settings').doc('main').set(s);
  } catch(e) { console.warn('Firestore save failed:', e); }
  showToast('給与明細設定を保存しました');
}

function addPayItem(type, name, amount, isAuto, category, calc_add, tax_type, wage_type, salary_type) {
  var wrap = document.getElementById('payItemsWrap_'+type);
  if (!wrap) return;
  var rows = wrap.querySelectorAll('.pay-item-row');
  if (rows.length >= 8) { showToast('支給項目は最大8項目です', 'error'); return; }
  var cat   = category   || 'pay';
  var cadd  = (calc_add  === undefined || calc_add  === null) ? 'add' : calc_add;
  var ttax  = tax_type   || 'taxable';
  var twage = wage_type  || 'wage';
  var tsal  = salary_type|| 'fixed';
  var div = document.createElement('div');
  div.className = 'pay-item-row';
  div.style.cssText = 'margin-bottom:12px;background:#f8fafc;padding:14px;border-radius:12px;border:1px solid var(--border);';
  div.innerHTML =
    // 1行目：項目名・金額・表示区分・集計方法
    '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:10px;">'+
      '<div><label class="pi-label">項目名</label>'+
      '<input type="text" class="form-input pay-item-name" placeholder="例: 食事手当" value="'+(name||'')+'" style="margin:0;"></div>'+
      '<div><label class="pi-label">金額（円）</label>'+
      '<input type="number" class="form-input pay-item-amount" placeholder="0" value="'+(amount||0)+'" min="0" style="margin:0;"></div>'+
      '<div><label class="pi-label">表示区分</label>'+
      '<select class="form-input pay-item-category" style="margin:0;">'+
        '<option value="attendance"'+(cat==='attendance'?' selected':'')+'>勤怠</option>'+
        '<option value="pay"'+(cat==='pay'?' selected':'')+'>支給</option>'+
        '<option value="deduction"'+(cat==='deduction'?' selected':'')+'>控除</option>'+
        '<option value="other"'+(cat==='other'?' selected':'')+'>その他</option>'+
      '</select></div>'+
      '<div><label class="pi-label">集計方法</label>'+
      '<select class="form-input pay-item-calc-add" style="margin:0;">'+
        '<option value="add"'+(cadd==='add'?' selected':'')+'>➕ 加算</option>'+
        '<option value="sub"'+(cadd==='sub'?' selected':'')+'>➖ 減算</option>'+
      '</select></div>'+
      '<button class="btn btn-secondary" onclick="this.closest(\".pay-item-row\").remove()" style="padding:8px 10px;white-space:nowrap;">🗑️</button>'+
    '</div>'+
    // 2行目：課税・賃金・報酬・固定賃金
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;">'+
      '<div><label class="pi-label">課税（所得税）</label>'+
      '<select class="form-input pay-item-tax-type" style="margin:0;font-size:.75rem;">'+
        '<option value="taxable"'+(ttax==='taxable'?' selected':'')+'>課税</option>'+
        '<option value="nontaxable"'+(ttax==='nontaxable'?' selected':'')+'>非課税</option>'+
      '</select></div>'+
      '<div><label class="pi-label">賃金（労働保険）</label>'+
      '<select class="form-input pay-item-wage-type" style="margin:0;font-size:.75rem;">'+
        '<option value="wage"'+(twage==='wage'?' selected':'')+'>賃金に含める</option>'+
        '<option value="nonwage"'+(twage==='nonwage'?' selected':'')+'>賃金に含めない</option>'+
      '</select></div>'+
      '<div><label class="pi-label">報酬（社会保険）</label>'+
      '<select class="form-input pay-item-salary-type" style="margin:0;font-size:.75rem;">'+
        '<option value="included"'+(tsal==='included'?' selected':'')+'>報酬に含める</option>'+
        '<option value="excluded"'+(tsal==='excluded'?' selected':'')+'>報酬に含めない</option>'+
      '</select></div>'+
      '<div><label class="pi-label">固定賃金（月額変動）</label>'+
      '<select class="form-input pay-item-salary-fixed" style="margin:0;font-size:.75rem;">'+
        '<option value="fixed"'+(tsal==='fixed'?' selected':'')+'>固定賃金</option>'+
        '<option value="variable"'+(tsal==='variable'?' selected':'')+'>変動賃金</option>'+
      '</select></div>'+
    '</div>';
  wrap.appendChild(div);
}

function toggleLunchBreak(){
  document.getElementById('lunchBreakFields').style.display=document.getElementById('staffLunchBreak').checked?'block':'none';
}

// ============================================================
// 月次変動入力
// ============================================================

// 月次データのキー生成
function monthlyKey(year, month, staffId) {
  return year + '-' + String(month).padStart(2,'0') + '-' + staffId;
}

// 月次データ取得
async function getMonthlyInput(year, month, staffId) {
  var key = 'monthly_' + monthlyKey(year, month, staffId);
  var stored = localStorage.getItem(key);
  if (stored) return JSON.parse(stored);
  try {
    var db = getDB();
    if (db) {
      var snap = await db.collection('monthly_inputs').doc(monthlyKey(year, month, staffId)).get();
      if (snap.exists) {
        var data = snap.data();
        localStorage.setItem(key, JSON.stringify(data));
        return data;
      }
    }
  } catch(e) {}
  return { work_days: null, variable_items: [] };
}

// 月次データ保存
async function saveMonthlyInputData(year, month, staffId, data) {
  var key = 'monthly_' + monthlyKey(year, month, staffId);
  localStorage.setItem(key, JSON.stringify(data));
  try {
    var db = getDB();
    if (db) await db.collection('monthly_inputs').doc(monthlyKey(year, month, staffId)).set(data);
  } catch(e) { console.warn('monthly input save error:', e); }
}

// 月次入力モーダルを開く
async function openMonthlyInputModal() {
  var year  = parseInt(document.getElementById('payrollYear').value);
  var month = parseInt(document.getElementById('payrollMonth').value);
  var staff = await DB.getStaff();
  var settings = await getPayslipSettings();

  // 変動賃金項目を種別ごとに収集
  function getVarItems(psType) {
    var key = psType==='officer'?'pay_items_officer':psType==='employee'?'pay_items_employee':'pay_items_hourly';
    return (settings[key]||[]).filter(function(item){ return item.salary_type==='variable'; });
  }

  var html = '<div style="overflow-y:auto;max-height:62vh;"><table class="data-table" style="font-size:.78rem;">';
  html += '<thead><tr style="background:var(--surface2);">';
  html += '<th style="min-width:80px;">氏名</th><th>種別</th>';
  html += '<th>出勤日数</th>';
  html += '<th>時間数<br><span style="font-size:.68rem;font-weight:400;">（時給のみ・空白=自動）</span></th>';
  html += '<th>変動手当（円）</th>';
  html += '<th>備考</th></tr></thead><tbody>';

  for (var i=0; i<staff.length; i++) {
    var s = staff[i];
    if (!s.is_active) continue;
    var psType = s.payslip_type || s.type;
    var monthly = await getMonthlyInput(year, month, s.id);
    var varItems = getVarItems(psType);
    var rowBg = psType==='officer'?'#fffbe6':psType==='employee'?'#f0f8ff':'#fff';

    html += '<tr style="background:'+rowBg+';">';
    html += '<td><strong>'+s.name+'</strong></td>';
    html += '<td><span class="badge badge-type">'+staffTypeLabel(s.type)+'</span></td>';

    // 出勤日数：役員のみ入力可、それ以外は自動
    if (psType==='officer') {
      html += '<td><input type="number" class="form-input mi-workdays" data-staff="'+s.id+'" '+
        'placeholder="例:20" min="0" max="31" value="'+(monthly.work_days!==null?monthly.work_days:'')+'" '+
        'style="margin:0;width:72px;text-align:center;"></td>';
    } else {
      html += '<td style="text-align:center;color:var(--text-muted);font-size:.75rem;">自動</td>';
    }

    // 時間数：時給スタッフのみ入力可
    if (s.type==='hourly') {
      var hVal = monthly.work_hours!==null&&monthly.work_hours!==undefined ? monthly.work_hours : '';
      html += '<td><input type="number" class="form-input mi-workhours" data-staff="'+s.id+'" '+
        'placeholder="空白=自動" min="0" step="0.5" value="'+hVal+'" '+
        'style="margin:0;width:88px;text-align:center;"></td>';
    } else {
      html += '<td style="text-align:center;color:var(--text-muted);font-size:.75rem;">-</td>';
    }

    // 変動賃金項目
    if (varItems.length > 0) {
      var varHtml = '';
      varItems.forEach(function(item) {
        var found = (monthly.variable_items||[]).find(function(x){return x.name===item.name;});
        varHtml += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">'+
          '<span style="font-size:.72rem;color:var(--text-muted);white-space:nowrap;">'+item.name+'</span>'+
          '<input type="number" class="form-input mi-varitem" '+
          'data-staff="'+s.id+'" data-item="'+item.name+'" '+
          'placeholder="0" min="0" value="'+(found?found.amount:'')+'" '+
          'style="margin:0;width:90px;text-align:right;"></div>';
      });
      html += '<td>'+varHtml+'</td>';
    } else {
      html += '<td style="text-align:center;color:var(--text-muted);font-size:.75rem;">設定なし</td>';
    }

    // 備考
    html += '<td><input type="text" class="form-input mi-note" data-staff="'+s.id+'" '+
      'placeholder="備考" value="'+(monthly.note||'')+'" style="margin:0;min-width:100px;"></td>';
    html += '</tr>';
  }

  html += '</tbody></table></div>';
  html += '<div style="margin-top:10px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:.75rem;line-height:1.7;">';
  html += '💡 <strong>出勤日数</strong>：役員のみ手動入力（他は打刻データから自動）<br>';
  html += '💡 <strong>時間数</strong>：時給スタッフのみ。入力すると打刻の代わりにこの時間で計算<br>';
  html += '💡 <strong>変動手当</strong>：⚙️明細設定で「固定賃金」を「変動賃金」にした項目が表示';
  html += '</div>';

  document.getElementById('monthlyInputContent').innerHTML = html;
  document.getElementById('monthlyInputModal').dataset.year  = year;
  document.getElementById('monthlyInputModal').dataset.month = month;
  openModal('monthlyInputModal');
}

// 月次入力を保存
async function saveMonthlyInput() {
  var year  = parseInt(document.getElementById('monthlyInputModal').dataset.year);
  var month = parseInt(document.getElementById('monthlyInputModal').dataset.month);
  var modal = document.getElementById('monthlyInputModal');

  // スタッフIDを収集
  var staffIds = new Set();
  modal.querySelectorAll('[data-staff]').forEach(function(el){ staffIds.add(el.dataset.staff); });

  for (var staffId of staffIds) {
    var workDaysEl = modal.querySelector('.mi-workdays[data-staff="'+staffId+'"]');
    var workDays = workDaysEl ? (workDaysEl.value !== '' ? parseInt(workDaysEl.value) : null) : null;
    var workHoursEl = modal.querySelector('.mi-workhours[data-staff="'+staffId+'"]');
    var workHours = workHoursEl ? (workHoursEl.value !== '' ? parseFloat(workHoursEl.value) : null) : null;

    var varItems = [];
    modal.querySelectorAll('.mi-varitem[data-staff="'+staffId+'"]').forEach(function(el){
      if (el.value !== '') varItems.push({ name: el.dataset.item, amount: parseInt(el.value)||0 });
    });

    var noteEl = modal.querySelector('.mi-note[data-staff="'+staffId+'"]');
    var note = noteEl ? noteEl.value.trim() : '';

    await saveMonthlyInputData(year, month, staffId, {
      work_days: workDays,
      work_hours: workHours,
      variable_items: varItems,
      note: note
    });
  }

  closeModal('monthlyInputModal');
  showToast('月次入力を保存しました');
  await loadPayrollSummary();
}

function _uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
