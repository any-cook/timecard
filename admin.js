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

// スタッフ種別ラベル
function staffTypeLabel(type) {
  if (type === 'officer')  return '役員';
  if (type === 'employee') return '社員';
  if (type === 'contract') return '委託';
  if (type === 'senzoku')  return '専従者';
  return 'パート・時給';
}

// 社員の有給時間を一括更新
async function updateEmployeePaidLeaveHours(){
  if(!confirmAction('社員全員の有給1日の時間数を6時間に変更しますか？')) return;
  var staff = await DB.getStaff();
  var employees = staff.filter(function(s){ return s.type==='employee' && s.is_active; });
  var updated = 0;
  for(var i=0;i<employees.length;i++){
    var s = employees[i];
    if(s.paid_leave_hours !== 6){
      await DB.saveStaff(Object.assign({}, s, { paid_leave_hours: 6 }));
      updated++;
    }
  }
  showToast('社員' + updated + '名の有給時間を6時間に更新しました');
  loadStaffTab();
}

async function loadStaffTab(){
  var res=await Promise.all([DB.getInsuranceTable('pension'),DB.getInsuranceTable('health'),DB.getInsuranceTable('health_nursing'),DB.getInsuranceTable('child_support')]);
  _pensionTable=res[0];_healthTable=res[1];_healthNursingTable=res[2];_childSupportTable=res[3];
  // 雇用保険料率キャッシュを初期化
  DB.getEmpInsRates().then(function(rows){ if(rows.length) window._empInsRatesCache=rows; }).catch(function(){});
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
      '<td><span class="badge '+(s.is_active===true||s.is_active===1?'badge-active':'badge-inactive')+'" style="white-space:nowrap;min-width:48px;display:inline-block;text-align:center;">'+(s.is_active===true||s.is_active===1?'在籍':'退職')+'</span></td>'+
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
      document.getElementById('staffCommuteFixed').value=editingStaff.commute_fixed||0;
      toggleOfficerCommute();
      // 家族構成
      document.getElementById('familySpouse').value      = editingStaff.family_spouse||'none';
      document.getElementById('familyOver16').value      = editingStaff.family_over16||0;
      document.getElementById('familyUnder16').value     = editingStaff.family_under16||0;
      document.getElementById('familyDisabled').value    = editingStaff.family_disabled||0;
      document.getElementById('familyCohabDisabled').value = editingStaff.family_cohab_disabled||0;
      document.getElementById('selfDisabled').checked      = editingStaff.self_disabled||false;
      document.getElementById('selfWidow').checked         = editingStaff.self_widow||false;
      document.getElementById('selfSingleParent').checked  = editingStaff.self_single_parent||false;
      document.getElementById('selfStudent').checked       = editingStaff.self_student||false;
      calcDependents();
      document.getElementById('staffPayslipNote').value=editingStaff.payslip_note||'';
      var defaultLeaveHours = editingStaff.type==='employee' ? 6 : 7.5;
      document.getElementById('staffPaidLeaveHours').value=editingStaff.paid_leave_hours||defaultLeaveHours;
      document.getElementById('staffContributionBonus').checked=editingStaff.contribution_bonus||false;
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
function updateStaffTypeFields(){
  toggleOfficerCommute();var type=document.getElementById('staffType').value;document.getElementById('staffWageSection').style.display=type==='hourly'?'block':'none';document.getElementById('staffSalarySection').style.display=type!=='hourly'?'block':'none';}
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
    commute_fixed:parseInt(document.getElementById('staffCommuteFixed').value)||0,
    family_spouse:      document.getElementById('familySpouse').value||'none',
    family_over16:      parseInt(document.getElementById('familyOver16').value)||0,
    family_under16:     parseInt(document.getElementById('familyUnder16').value)||0,
    family_disabled:    parseInt(document.getElementById('familyDisabled').value)||0,
    family_cohab_disabled: parseInt(document.getElementById('familyCohabDisabled').value)||0,
    self_disabled:      document.getElementById('selfDisabled').checked,
    self_widow:         document.getElementById('selfWidow').checked,
    self_single_parent: document.getElementById('selfSingleParent').checked,
    self_student:       document.getElementById('selfStudent').checked,
    payslip_note:document.getElementById('staffPayslipNote').value.trim(),
    paid_leave_hours:parseFloat(document.getElementById('staffPaidLeaveHours').value)||7.5,
    contribution_bonus:document.getElementById('staffContributionBonus').checked,
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
  var allRecords=await DB.getAttendance({year:attendanceFilters.year,month:attendanceFilters.month}),staff=await DB.getStaff(),allLeaveAtt=await DB.getLeaveAll();
  var records=attendanceFilters.staff_id?allRecords.filter(function(r){return r.staff_id===attendanceFilters.staff_id;}):allRecords;
  var ymStr2b=attendanceFilters.year+'-'+String(attendanceFilters.month).padStart(2,'0');
  var leaveByDate={};
  allLeaveAtt.filter(function(r){return r.type==='use'&&r.date&&r.date.startsWith(ymStr2b);}).forEach(function(r){if(!leaveByDate[r.date])leaveByDate[r.date]={};leaveByDate[r.date][r.staff_id]=(leaveByDate[r.date][r.staff_id]||0)+(parseFloat(r.days)||1);});
  var staffMap={};staff.forEach(function(s){staffMap[s.id]=s;});
  var tbody=document.getElementById('attendanceTableBody');tbody.innerHTML='';
  var totalWage=0,totalMins=0,staffSummary={};
  // 有休のみ行（打刻なし・有休あり）を追加
  var leaveOnlyRows=[];
  allLeaveAtt.filter(function(r){
    return r.type==='use'&&r.date&&r.date.startsWith(ymStr2b)&&
    (!attendanceFilters.staff_id||r.staff_id===attendanceFilters.staff_id)&&
    !records.some(function(a){return a.staff_id===r.staff_id&&a.date===r.date;});
  }).forEach(function(r){
    var s=staffMap[r.staff_id];
    if(!s)return;
    var tr=document.createElement('tr');
    tr.style.background='#f0fdf4';
    tr.innerHTML=
      '<td>'+formatDateJP(r.date)+'</td>'+
      '<td><strong>'+s.name+'</strong></td>'+
      '<td colspan="8" style="text-align:center;color:#16a34a;font-weight:700;">🌿 有休取得　'+r.days+'日'+(r.hours>0?' ('+r.hours+'時間)':'')+'</td>'+
      '<td>-</td>';
    // 日付順で挿入
    leaveOnlyRows.push({date:r.date,tr:tr});
  });
  records.forEach(function(r){
    var s=staffMap[r.staff_id]||{};
    var lunchBreak=s.lunch_break||false;
    var _outTime=r.clock_out_actual||r.clock_out_calc; // 実打刻優先
    // 昼休み：レコードに設定があればそちらを優先、なければスタッフ設定
    var _lb=r.lunch_break!==undefined?r.lunch_break:(s&&s.lunch_break);
    var _ls=r.lunch_start||(s&&s.lunch_start);
    var _le=r.lunch_end||(s&&s.lunch_end);
    var workMins=_outTime?calcWorkMinutes(r.clock_in_calc,_outTime,_lb,_ls,_le):0;
    var dailyWage=_outTime?calcDailyWage(r.clock_in_calc,_outTime,r.wage_at_date||0,r.is_special_day,_lb,_ls,_le):0;
    var commuteAmt=r.clock_in_actual&&s.commute_daily_amount?s.commute_daily_amount:0;
    totalWage+=dailyWage;totalMins+=workMins;
    if(!staffSummary[r.staff_id])staffSummary[r.staff_id]={name:s.name||'不明',mins:0,wage:0,days:0,commute:0};
    staffSummary[r.staff_id].mins+=workMins;staffSummary[r.staff_id].wage+=dailyWage;
    if(r.clock_in_actual){staffSummary[r.staff_id].days++;staffSummary[r.staff_id].commute+=commuteAmt;}
    var isMissingOut=r.clock_in_actual&&!r.clock_out_actual;
    var hasLeave=leaveByDate[r.date]&&leaveByDate[r.date][r.staff_id];
    var leaveBadge=hasLeave?'<span class="monthly-leave-badge">有休'+leaveByDate[r.date][r.staff_id]+'日</span> ':'';
    var tr=document.createElement('tr');if(isMissingOut)tr.classList.add('missing-clockout');if(r.is_special_day)tr.classList.add('special-day-row');
    tr.innerHTML='<td>'+formatDateJP(r.date)+'</td><td>'+(s.name||'不明')+' '+leaveBadge+'</td>'+
      '<td>'+(r.clock_in_actual||'-')+'</td>'+'<td>'+(r.clock_out_actual?r.clock_out_actual:(function(){if(!isMissingOut)return '-';var today=todayStr();if(r.date!==today)return '<span style="color:#dc2626;font-weight:700;">⚠️ 退勤忘れ</span>';var nowM=new Date().getHours()*60+new Date().getMinutes();var inM=timeToMinutes(r.clock_in_actual||'00:00');return (nowM-inM)>600?'<span style="color:#dc2626;font-weight:700;">⚠️ 退勤忘れ</span>':'<span style="color:#16a34a;font-weight:700;">🟢 勤務中</span>';})())+'</td>'+
      '<td>'+(r.clock_in_calc||'-')+'</td><td>'+((r.clock_out_actual||r.clock_out_calc)||'-')+'</td>'+
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
      var _out2 = r.clock_out_actual||r.clock_out_calc;
      var workMins = _out2 ? calcWorkMinutes(r.clock_in_calc, _out2, s.lunch_break, s.lunch_start, s.lunch_end) : 0;
      var lunchMins = 0;
      if (s.lunch_break && s.lunch_start && s.lunch_end && _out2) {
        var rawMins = calcWorkMinutes(r.clock_in_calc, _out2, false, null, null);
        lunchMins = rawMins - workMins;
      }
      var dailyWage = _out2 ? calcDailyWage(r.clock_in_calc, _out2, r.wage_at_date||s.wage, r.is_special_day, s.lunch_break, s.lunch_start, s.lunch_end) : 0;
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
        '<td>' + (r.clock_out_actual||r.clock_out_calc||'-') + '</td>' +
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

async function openAttendanceAddModal(preDate, preStaffId){
  document.getElementById('attendanceModalTitle').textContent='打刻の手動追加';document.getElementById('attendanceId').value='';
  var staff=await DB.getStaff(),sel=document.getElementById('attendanceStaff');sel.innerHTML='';
  staff.filter(function(s){return s.is_active;}).forEach(function(s){var o=document.createElement('option');o.value=s.id;o.textContent=s.name;sel.appendChild(o);});
  document.getElementById('attendanceDate').value=preDate||todayStr();
  if(preStaffId){document.getElementById('attendanceStaff').value=preStaffId;}
  ['attendanceClockIn','attendanceClockOut','attendanceWage','attendanceNotes'].forEach(function(id){document.getElementById(id).value='';});
  // スタッフが選択されていれば時給・昼休み設定を自動セット
  var preStaff = preStaffId ? staff.find(function(x){return x.id===preStaffId;}) : null;
  if(preStaff){
    if(preStaff.wage) document.getElementById('attendanceWage').value=preStaff.wage;
    // スタッフの昼休み設定を引き継ぐ
    var hasLunch = preStaff.lunch_break||false;
    document.getElementById('attendanceLunchBreak').checked = hasLunch;
    document.getElementById('attendanceLunchStart').value = preStaff.lunch_start||'12:00';
    document.getElementById('attendanceLunchEnd').value   = preStaff.lunch_end||'13:00';
    document.getElementById('attendanceLunchFields').style.display = hasLunch?'block':'none';
  } else {
    document.getElementById('attendanceLunchBreak').checked = false;
    document.getElementById('attendanceLunchFields').style.display = 'none';
    document.getElementById('attendanceLunchStart').value = '12:00';
    document.getElementById('attendanceLunchEnd').value   = '13:00';
  }
  document.getElementById('attendanceSpecial').checked=false;
  document.getElementById('btnDeleteAttendance').style.display='none';
  openModal('attendanceModal');
}
async function openAttendanceEditModal(id, yearHint, monthHint){
  // IDで直接取得（最も確実な方法）
  var r = await DB.getAttendanceById(id);
  // 直接取得できない場合は年月でフィルターして検索
  if(!r){
    var year  = yearHint  || parseInt((document.getElementById('filterYear')||document.getElementById('monthlyYear')).value);
    var month = monthHint || parseInt((document.getElementById('filterMonth')||document.getElementById('monthlyMonth')).value);
    var records = await DB.getAttendance({year:year, month:month});
    r = records.find(function(x){ return x.id===id; });
  }
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
  // 保存済みの昼休み設定を読み込む
  var hasLunchEdit = r.lunch_break||false;
  document.getElementById('attendanceLunchBreak').checked = hasLunchEdit;
  document.getElementById('attendanceLunchStart').value = r.lunch_start||'12:00';
  document.getElementById('attendanceLunchEnd').value   = r.lunch_end||'13:00';
  document.getElementById('attendanceLunchFields').style.display = hasLunchEdit?'block':'none';
  openModal('attendanceModal');
}
async function saveAttendance(){
  var id=document.getElementById('attendanceId').value,staff_id=document.getElementById('attendanceStaff').value;
  var date=document.getElementById('attendanceDate').value,clockIn=document.getElementById('attendanceClockIn').value;
  var clockOut=document.getElementById('attendanceClockOut').value;
  if(!date||!staff_id){showToast('日付とスタッフを入力してください','error');return;}
  if(!clockIn){showToast('出勤時刻を入力してください','error');return;}
  var lunchBreakEdit = document.getElementById('attendanceLunchBreak').checked;
  var record={
    staff_id:staff_id, date:date,
    clock_in_actual:clockIn, clock_out_actual:clockOut||null,
    clock_in_calc:roundUpClockIn(clockIn), clock_out_calc:clockOut||null,
    wage_at_date:parseInt(document.getElementById('attendanceWage').value)||0,
    is_special_day:document.getElementById('attendanceSpecial').checked,
    notes:document.getElementById('attendanceNotes').value,
    lunch_break: lunchBreakEdit,
    lunch_start: lunchBreakEdit ? document.getElementById('attendanceLunchStart').value : null,
    lunch_end:   lunchBreakEdit ? document.getElementById('attendanceLunchEnd').value   : null,
  };
  if(id)record.id=id;
  await DB.saveAttendance(record);closeModal('attendanceModal');showToast('保存しました');
  loadAttendanceRecords();
  // 月別出勤表が開いていれば更新
  if(document.getElementById('tab-monthly').style.display!=='none') loadMonthlyTab();
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
  for(var i=0;i<dl.length;i++){var cols=dl[i].split(',').map(function(c){return c.trim().replace(/"/g,'');});if(cols.length<3)continue;var sn=cols[0],date=cols[1],ci=cols[2],co=cols[3];var ms=staff.find(function(s){return s.name===sn;});var ok=ms&&date&&ci;var tr=document.createElement('tr');tr.style.color=ok?'':'#dc2626';tr.innerHTML='<td>'+sn+' '+(ms?'✅':'❌未登録')+'</td><td>'+date+'</td><td>'+ci+'</td><td>'+(co||'-')+'</td>';tbody.appendChild(tr);if(ok)csvParsedData.push({staff_id:ms.id,date:date,clock_in_actual:ci,clock_out_actual:co||null,clock_in_calc:roundUpClockIn(ci),clock_out_calc:co||null,wage_at_date:ms.wage||0,is_special_day:false,notes:'CSVインポート'});}
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
  var allLeaveData=await DB.getLeaveAll();
  var ymStr2=year+'-'+String(month).padStart(2,'0');
  var activeStaff=allStaff.filter(function(s){return s.is_active && s.type!=='contract';});
  // 登録番号順にソート
  activeStaff.sort(function(a,b){
    var na=parseInt(a.staff_number||9999), nb=parseInt(b.staff_number||9999);
    return na-nb;
  });
  for(var si=0;si<activeStaff.length;si++){
    var staff=activeStaff[si];
    var staffRecords=records.filter(function(r){return r.staff_id===staff.id;});
    var grossPay=0,totalMins=0,workDays=0;
    // 打刻データから勤務時間と出勤日数を集計
    if(staff.type==='hourly'){
      staffRecords.forEach(function(r){
        var _o=r.clock_out_actual||r.clock_out_calc;
        var _lb2=r.lunch_break!==undefined?r.lunch_break:staff.lunch_break;
        var _ls2=r.lunch_start||staff.lunch_start;
        var _le2=r.lunch_end||staff.lunch_end;
        var mins=_o?calcWorkMinutes(r.clock_in_calc,_o,_lb2,_ls2,_le2):0;
        totalMins+=mins;
        if(r.clock_in_actual)workDays++;
      });
    } else {
      grossPay=staff.monthly_salary||0;
      workDays=staffRecords.filter(function(r){return r.clock_in_actual;}).length;
    }
    // 月次入力から取得
    var monthlyData=await getMonthlyInput(year,month,staff.id);
    if(monthlyData.work_days!==null) workDays=monthlyData.work_days;
    // 時給スタッフ：月次入力の時間数があれば上書き
    if(staff.type==='hourly' && monthlyData.work_hours!=null){
      totalMins = Math.round(monthlyData.work_hours * 60);
    }
    // 有休時間（月次入力 + 有休管理から paid_leave_hours で補完）
    var _paidLHPD = staff.paid_leave_hours || 7.5;
    var _lht2 = monthlyData.leave_hours||0;
    if(allLeaveData){ allLeaveData.filter(function(r){return r.staff_id===staff.id&&r.type==='use'&&r.date&&r.date.startsWith(ymStr2||'');}).forEach(function(r){
      if((r.hours||0)>0){ _lht2+=r.hours; } // 手入力時間を使用
      else if(staff.type!=='hourly'){ _lht2+=(parseFloat(r.days)||1)*_paidLHPD; } // 社員・役員のみpaid_leave_hoursで補完
    }); }
    if(_lht2>0){ totalMins += Math.round(_lht2*60); }
    // 時給スタッフ：合計時間から基本給を計算（給与明細と同じ）
    if(staff.type==='hourly'){
      grossPay = Math.floor(totalMins / 60 * (staff.wage||0));
    }
    // 役員は通勤費固定支給
    // 役員：距離の非課税限度額を固定支給（全額非課税）、それ以外：出勤日数×日額
    var isOfficer=(staff.payslip_type==='officer'||staff.type==='officer');
    var commuteData=isOfficer
      ? calcOfficerCommuteFixed(staff)
      : (staff.commute_daily_amount ? calcCommuteAllowance(staff.commute_daily_amount,workDays,staff.commute_distance||0) : {total:0,taxFree:0,taxable:0});
    // 所得税：課税支給額（基本給＋課税通勤費）で計算
    var useHealthTable=(staff.health_table_type==='health_nursing')?healthNursingTable:healthTable;
    var pension=getInsuranceAmountByGrade(staff.pension_grade_id,pensionTable);
    var healthTotal=getInsuranceAmountByGrade(staff.health_grade_id,useHealthTable);
    var healthBase=0,nursingCare=0;
    if(staff.health_table_type==='health_nursing'){
      var _nRow=healthNursingTable.find(function(r){return r.id===staff.health_grade_id;});
      var _gNo=_nRow?_nRow.grade:null;
      var _bRow=_gNo?healthTable.find(function(r){return r.grade===_gNo;}):null;
      healthBase=_bRow?_bRow.employee:0;
      nursingCare=Math.max(0,healthTotal-healthBase);
    }
    else{healthBase=healthTotal;nursingCare=0;}
    var childSupport=getInsuranceAmountByGrade(staff.child_support_grade_id,childSupportTable);
    var empIns=calcEmploymentInsurance(grossPay,staff.employment_insurance);
    // 介護保険料を分離（給与明細と同じ計算）
    var healthBase2=0,nursingCare2=0;
    if(staff.health_table_type==='health_nursing'){
      var _nRow2=healthNursingTable.find(function(r){return r.id===staff.health_grade_id;});
      var _gNo2=_nRow2?_nRow2.grade:null;
      var _bRow2=_gNo2?healthTable.find(function(r){return r.grade===_gNo2;}):null;
      healthBase2=_bRow2?_bRow2.employee:0;
      nursingCare2=Math.max(0,healthTotal-healthBase2);
    } else {
      healthBase2=healthTotal; nursingCare2=0;
    }
    // 給与明細と同じ社会保険合計
    var socialDeduction=pension+healthBase2+nursingCare2+childSupport+empIns;
    // 正しい所得税計算：社会保険料等控除後の給与に税額表を適用
    // 明細設定から支給項目を取得して差引支給額に反映
    var _psType = staff.payslip_type||staff.type||'hourly';
    var _typeKey = _psType==='officer'?'pay_items_officer':_psType==='employee'?'pay_items_employee':'pay_items_hourly';
    var _payItemsBase = (window._payslipSettings && window._payslipSettings[_typeKey]) ? window._payslipSettings[_typeKey] : [];
    // 月次入力の変動項目で金額を上書き
    var _payItems = _payItemsBase.map(function(item){
      if(item.wage_fixed==='variable'){
        var mi = (monthlyData.variable_items||[]).find(function(x){return x.name===item.name;});
        if(mi) return Object.assign({},item,{amount:mi.amount});
      }
      return item;
    });
    // 課税所得計算（減算項目は引く・非課税項目は除外）
    var _extraTaxable = 0;
    var _extraTotal = 0;
    _payItems.forEach(function(item){
      var amt = item.amount||0;
      if(item.calc_add==='sub'){
        _extraTaxable -= amt;
        _extraTotal -= amt;
      } else {
        if(item.tax_type!=='nontaxable') _extraTaxable += amt;
        _extraTotal += amt;
      }
    });
    // 貢献手当
    var bonusAmt = staff.contribution_bonus ? 1000 : 0;
    // grossPay には有休賃金が含まれている（totalMinsベースで計算済み）
    var taxableIncome = grossPay + commuteData.taxable + _extraTaxable + bonusAmt - socialDeduction;
    var taxRows=staff.tax_type==='otsu'?taxOtsu:taxKou;
    var tax=calcTax(Math.max(0,taxableIncome),taxRows,staff.tax_type||'kou',staff.dependents||0);
    // 給与明細と同じ計算式で差引支給額・支給合計・控除合計を計算
    var payTotal = grossPay + commuteData.taxFree + commuteData.taxable + _extraTotal + bonusAmt;
    var dedTotal = tax + healthBase2 + nursingCare2 + pension + childSupport + empIns;
    var netPay   = payTotal - commuteData.taxable - dedTotal;
    grandTotal += netPay;
    var tr=document.createElement('tr');
    tr.innerHTML=
      '<td><strong>'+staff.name+'</strong></td>'+
      '<td><span class="badge badge-type">'+staffTypeLabel(staff.type)+'</span></td>'+
      '<td>'+workDays+'日</td>'+
      '<td>'+(staff.type==='hourly'?formatWorkTime(totalMins):'月額固定')+'</td>'+
      '<td>'+formatCurrency(payTotal)+'</td>'+
      '<td>'+formatCurrency(dedTotal)+'</td>'+
      '<td><strong style="color:var(--accent);">'+formatCurrency(netPay)+'</strong></td>'+
      '<td><button class="btn-sm btn-edit" onclick="showPayslip(\''+staff.id+'\','+year+','+month+')">📄 明細</button></td>';
    tbody.appendChild(tr);
  }
  document.getElementById('payrollGrandTotal').textContent='差引支給額合計: '+formatCurrency(grandTotal);
}
async function showPayslip(staffId,year,month){
  try {
  // 毎回最新の設定を取得
  _payslipSettings = null;
  var settings = await getPayslipSettings();
  var res=await Promise.all([DB.getStaff(),DB.getAttendance({year:year,month:month}),DB.getTaxTable('kou'),DB.getTaxTable('otsu'),DB.getInsuranceTable('pension'),DB.getInsuranceTable('health'),DB.getInsuranceTable('health_nursing'),DB.getInsuranceTable('child_support'),DB.getLeaveAll()]);
  var allStaff=res[0],records=res[1].filter(function(r){return r.staff_id===staffId;}),taxKou=res[2],taxOtsu=res[3],pensionTable=res[4],healthTable=res[5],healthNursingTable=res[6],childSupportTable=res[7],allLeave=res[8];
  var staff=allStaff.find(function(s){return s.id===staffId;});if(!staff)return;
  var useHealthTable=(staff.health_table_type==='health_nursing')?healthNursingTable:healthTable;
  var healthTotal=getInsuranceAmountByGrade(staff.health_grade_id,useHealthTable);
  var healthBase=0,nursingCare=0;
  if(staff.health_table_type==='health_nursing'){
    // 介護込みテーブルのIDから等級番号を取得し、介護なしテーブルの同等級を参照
    var nursingRow=healthNursingTable.find(function(r){return r.id===staff.health_grade_id;});
    var gradeNo=nursingRow?nursingRow.grade:null;
    var baseRow=gradeNo?healthTable.find(function(r){return r.grade===gradeNo;}):null;
    healthBase=baseRow?baseRow.employee:0;
    nursingCare=Math.max(0,healthTotal-healthBase);
  } else {
    healthBase=healthTotal; nursingCare=0;
  }
  var grossPay=0,totalMins=0,workDays=0,detailRows='';
  var lunchBreakSlip=staff.lunch_break||false;
  if(staff.type==='hourly'){records.forEach(function(r){var _o=r.clock_out_actual||r.clock_out_calc;var mins=_o?calcWorkMinutes(r.clock_in_calc,_o,staff.lunch_break,staff.lunch_start,staff.lunch_end):0;totalMins+=mins;if(r.clock_in_actual)workDays++;var daily=_o?calcDailyWage(r.clock_in_calc,_o,r.wage_at_date||staff.wage,r.is_special_day,staff.lunch_break,staff.lunch_start,staff.lunch_end):0;grossPay+=daily;detailRows+='<tr><td>'+formatDateJP(r.date)+'</td><td>'+(r.clock_in_actual||'-')+'</td><td>'+(r.clock_out_actual||'-')+'</td><td>'+(r.clock_in_calc||'-')+'</td><td>'+(r.clock_out_calc||'-')+'</td><td>'+formatWorkTime(mins)+'</td><td>'+(r.is_special_day?'⭐':'')+' '+formatCurrency(r.wage_at_date||staff.wage)+'</td><td>'+formatCurrency(daily)+'</td></tr>';});}
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
  // 有休時間を勤務時間合計・賃金に加算
  // staffLeave を先に定義（有休計算で使用）
  var staffLeave = allLeave.filter(function(r){ return r.staff_id === staffId; });
  // 有休時間（月次入力 + 有休管理から paid_leave_hours で補完）
  var _paidLHPD2 = staff.paid_leave_hours || 7.5;
  var _lht3 = monthlyData.leave_hours||0;
  staffLeave.filter(function(r){return r.type==='use';}).forEach(function(r){
    if((r.hours||0)>0){
      _lht3 += r.hours;
    } else if(staff.type!=='hourly'){
      _lht3 += (parseFloat(r.days)||1)*_paidLHPD2;
    }
  });
  if(_lht3>0){
    totalMins += Math.round(_lht3*60);
    if(staff.type==='hourly') grossPay += Math.floor(_lht3*(staff.wage||0));
  }

  // 有給残日数・当月使用日数を計算（staffLeaveは上で定義済み）
  // 累計付与日数
  var totalGranted = staffLeave.filter(function(r){ return r.type==='grant'; })
    .reduce(function(s,r){ return s + (parseFloat(r.days)||0); }, 0);
  // 当月以前の使用日数合計
  var ymStr = year + '-' + String(month).padStart(2,'0');
  var totalUsed = staffLeave.filter(function(r){ return r.type==='use'; })
    .reduce(function(s,r){ return s + (parseFloat(r.days)||0); }, 0);
  // 当月の使用日数
  var monthUsed = staffLeave.filter(function(r){
    return r.type==='use' && r.date && r.date.startsWith(ymStr);
  }).reduce(function(s,r){ return s + (parseFloat(r.days)||0); }, 0);
  // 残日数（当月末時点）
  var leaveBalance = Math.max(0, totalGranted - totalUsed);
  // 役員は通勤費固定支給（日額×月固定日数20日換算）、それ以外は出勤日数×日額
  // 役員：距離の非課税限度額を固定支給（全額非課税）、それ以外：出勤日数×日額
  var isOfficer=(staff.payslip_type==='officer'||staff.type==='officer');
  var commuteData=isOfficer
    ? calcOfficerCommuteFixed(staff)
    : (staff.commute_daily_amount ? calcCommuteAllowance(staff.commute_daily_amount,workDays,staff.commute_distance||0) : {total:0,taxFree:0,taxable:0});
  // 所得税：課税支給額（基本給＋課税通勤費）で計算
  var pension=getInsuranceAmountByGrade(staff.pension_grade_id,pensionTable);
  var health=healthBase; // 健康保険料（介護保険料除く）
  var childSupport=getInsuranceAmountByGrade(staff.child_support_grade_id,childSupportTable);
  var empIns=calcEmploymentInsurance(grossPay,staff.employment_insurance);
  // 正しい所得税計算：社会保険料等控除後の給与に税額表を適用
  var socialInsTotal=pension+health+nursingCare+childSupport+empIns;
  // 所得税計算はextraPayItems確定後に実施（下部で計算）
  var taxRows=staff.tax_type==='otsu'?taxOtsu:taxKou;
  var tax=0; // 後で再計算
  var netPay=0; // 後で再計算
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
  // 給与明細は翌月分（例：6月勤務→7月分）
  var payYear  = month === 12 ? year + 1 : year;
  var payMonth = month === 12 ? 1 : month + 1;
  html += '<div class="ps-title">' + payYear + '年' + payMonth + '月分　給与明細書</div>';
  html += '<div class="ps-meta">';
  html += '<div class="ps-meta-left">';
  html += '<span class="ps-emp">（' + (staff.staff_number||'-') + '）' + staff.name + '　様</span>';
  html += '</div>';
  html += '<div class="ps-meta-right">支給日：令和' + (payYear-2018) + '年' + payMonth + '月'+(settings.pay_day||10)+'日</div>';
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
  // 貢献手当（スタッフにチェックがある場合のみ）
  var contributionBonus = staff.contribution_bonus ? 1000 : 0;

  // 追加支給項目（スタッフの明細書種別から取得）
  var psType = staff.payslip_type || staff.type || 'hourly';
  var typeKey = psType === 'officer' ? 'pay_items_officer'
              : psType === 'employee' ? 'pay_items_employee'
              : 'pay_items_hourly';
  var extraPayItems = (settings[typeKey] || settings.pay_items || []).map(function(item){
    // 月次変動項目：月次入力があれば金額を上書き
    if(item.wage_fixed==='variable') {
      var mi = monthlyVarItems.find(function(x){return x.name===item.name;});
      if(mi) return Object.assign({},item,{amount:mi.amount});
    }
    return item;
  });
  // 加算項目は支給に加算、減算項目は支給合計から差し引く
  var extraTotalPay = extraPayItems.reduce(function(acc,i){
    return acc + (i.calc_add==='sub' ? -(i.amount||0) : (i.amount||0));
  }, 0);
  totalPay += extraTotalPay + contributionBonus;
  // totalDeductAll は tax確定後に更新

  // 所得税計算（extraPayItems確定後）
  var extraTaxableAmt = 0;
  extraPayItems.forEach(function(i){
    if (i.calc_add === 'sub') {
      extraTaxableAmt -= (i.amount||0);
    } else if (i.tax_type !== 'nontaxable') {
      extraTaxableAmt += (i.amount||0);
    }
  });
  var taxableIncome = grossPay + commuteData.taxable + extraTaxableAmt + contributionBonus - socialInsTotal;
  tax = calcTax(Math.max(0, taxableIncome), taxRows, staff.tax_type||'kou', staff.dependents||0);
  // tax確定後にtotalDeductionを再計算（所得税を含む）
  totalDeduction = tax + pension + health + nursingCare + childSupport + empIns;
  // 差引支給額 = 支給合計 - 控除合計
  // totalPay には extraTotalPay + contributionBonus が加算済み
  // totalPay = grossPay + commuteData.taxFree + commuteData.taxable + extraTotalPay + contributionBonus
  netPayFinal = totalPay - commuteData.taxable - totalDeduction;
  netPay = netPayFinal;
  totalDeductAll = totalDeduction;

  // 課税額・非課税額の内訳計算（extraPayItems確定後）
  var taxablePay = grossPay + commuteData.taxable;
  extraPayItems.forEach(function(i){
    if (i.calc_add === 'sub') {
      taxablePay -= (i.amount||0); // 減算項目は課税額から引く
    } else if (i.tax_type !== 'nontaxable') {
      taxablePay += (i.amount||0); // 加算・課税項目は加える
    }
  });
  if(contributionBonus > 0) taxablePay += contributionBonus;
  var nontaxablePay = commuteData.taxFree;
  extraPayItems.forEach(function(i){ if(i.tax_type==='nontaxable' && i.calc_add!=='sub') nontaxablePay += (i.amount||0); });
  var socialInsTotal2 = pension + health + nursingCare + childSupport + empIns;
  var totalDeductAll = tax + socialInsTotal2; // 所得税+社会保険計

  // カテゴリ別に追加項目を仕分け
  var extraAttendance=[], extraPay=[], extraDeduction=[], extraOther=[];
  var extraTotalDeductExtra = 0;
  extraPayItems.forEach(function(item){
    var cat=item.category||'pay';
    var isSubtract = item.calc_add === 'sub';
    // 減算項目：支給欄に表示して差引支給額から控除
    if(isSubtract){ extraTotalDeductExtra += (item.amount||0); }
    if(cat==='attendance') extraAttendance.push(item);
    else if(cat==='deduction') extraDeduction.push(item);
    else if(cat==='other') extraOther.push(item);
    else extraPay.push(item); // 減算でも支給欄に表示
  });
  // ※減算分は extraTotalPay の計算で既に netPayFinal に反映済み

  // 勤怠列
  // 勤務時間合計を小数表示（例：78.18時間）
  var totalHoursDecimal = Math.round(totalMins / 60 * 100) / 100;
  var totalTimeStr2 = totalHoursDecimal + '時間';
  // 勤怠列：労働日数 → 勤務時間合計 → 有休使用（使用時のみ） → 有休残
  var attRows = [workDays+'日', totalTimeStr2];
  extraAttendance.forEach(function(i){ attRows.push(i.name+'：'+numFmt(i.amount)); });
  if (monthUsed > 0) attRows.push(monthUsed + '日');
  attRows.push(leaveBalance + '日');
  // 支給列
  var basicPayLabel = psType === 'officer' ? '役員報酬' : (psType === 'employee' ? '基本給' : '基本給');
  var payRows = [
    [basicPayLabel, numFmt(grossPay)],
    ['非課税通勤費', numFmt(commuteData.taxFree)],
  ];
  // 貢献手当（チェックありの場合のみ追加）
  if (contributionBonus > 0) {
    payRows.push(['貢献手当', numFmt(contributionBonus)]);
  }
  if(commuteData.taxable>0) payRows.push(['課税通勤費', numFmt(commuteData.taxable)]);
  extraPay.forEach(function(i){
    var isSubtract = i.calc_add === 'sub';
    payRows.push([
      i.name,
      (isSubtract ? '▲ ' + numFmt(i.amount) : numFmt(i.amount))
    ]);
  });
  // 控除列
  var dedRows = [
    ['健康保険料', numFmt(health)],
    ['介護保険料', nursingCare>0 ? numFmt(nursingCare) : '―'],
    ['厚生年金保険', numFmt(pension)],
    ['子育て支援金', numFmt(childSupport)],
    ['所得税', numFmt(tax)],
  ];
  if(empIns>0) dedRows.push(['雇用保険料', numFmt(empIns)]);
  extraDeduction.forEach(function(i){
    // 所得税・健康保険・厚生年金等は dedRows に既に追加済みのため重複を除外
    var skipNames = ['所得税','健康保険料','介護保険料','厚生年金保険','子育て支援金','雇用保険料','雇用保険'];
    if(skipNames.indexOf(i.name) === -1) dedRows.push([i.name, numFmt(i.amount)]);
  });
  // その他列
  var otherRows = [['年末調整還付','0'],['年末調整徴収','0']];
  extraOther.forEach(function(i){otherRows.push([i.name, numFmt(i.amount)]);});

  // 最大行数
  var maxRows = Math.max(attRows.length, payRows.length, dedRows.length, otherRows.length);
  var rows2 = [];
  // 勤怠列のラベルと値を定義
  var attLabels = ['労働日数', '勤務時間合計'];
  extraAttendance.forEach(function(i){ attLabels.push(i.name); });
  if (monthUsed > 0) attLabels.push('有休休暇');
  attLabels.push('有休残');

  for(var ri=0; ri<maxRows; ri++){
    var att  = ri < attLabels.length ? attLabels[ri] : '';
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

  // 合計行（詳細）
  // 支給：課税額・非課税額・合計　控除：社会保険・控除合計
  html += '<tr class="ps-subtotal-row" style="background:#fafafa;">';
  html += '<td class="ps-label" style="font-size:.7rem;">扶養人数</td><td class="ps-val" style="font-size:.7rem;">' + (staff.dependents||0) + '人</td>';
  html += '<td class="ps-label" style="font-size:.7rem;color:#555;">課税額</td><td class="ps-val" style="font-size:.7rem;">' + numFmt(taxablePay) + '</td>';
  html += '<td class="ps-label" style="font-size:.7rem;color:#555;">社会保険計</td><td class="ps-val" style="font-size:.7rem;">' + numFmt(socialInsTotal2) + '</td>';
  html += '<td class="ps-label" style="font-size:.7rem;">税額表</td><td class="ps-val" style="font-size:.7rem;">' + (staff.tax_type==='otsu'?'乙欄':'甲欄') + '</td>';
  html += '</tr>';
  html += '<tr class="ps-subtotal-row" style="background:#fafafa;">';
  html += '<td class="ps-label" style="font-size:.7rem;"></td><td class="ps-val" style="font-size:.7rem;"></td>';
  html += '<td class="ps-label" style="font-size:.7rem;color:#555;">非課税額</td><td class="ps-val" style="font-size:.7rem;">' + numFmt(nontaxablePay) + '</td>';
  html += '<td class="ps-label" style="font-size:.7rem;color:#555;">所得税</td><td class="ps-val" style="font-size:.7rem;">' + numFmt(tax) + '</td>';
  html += '<td class="ps-label" style="font-size:.7rem;"></td><td class="ps-val" style="font-size:.7rem;"></td>';
  html += '</tr>';
  html += '<tr class="ps-total-row">';
  html += '<td class="ps-label">合計</td><td class="ps-val"></td>';
  html += '<td class="ps-label ps-total-label">支給合計</td><td class="ps-val ps-total-val">' + numFmt(totalPay) + '</td>';
  html += '<td class="ps-label ps-total-label">控除合計</td><td class="ps-val ps-total-val">' + numFmt(totalDeductAll) + '</td>';
  html += '<td class="ps-label"></td><td class="ps-val"></td>';
  html += '</tr>';

  html += '</table>';

  // 差引支給額ブロック
  var netPayDisplay = netPayFinal; // 差引支給額 = 支給合計 - 控除合計
  html += '<div class="ps-bottom">';
  // 支給額合計
  html += '<div class="ps-bottom-block">';
  html += '<div class="ps-bottom-label">支給額合計</div>';
  html += '<div class="ps-bottom-val">' + numFmt(totalPay) + '</div>';
  html += '</div>';
  // 控除合計額
  html += '<div class="ps-bottom-block">';
  html += '<div class="ps-bottom-label">控除合計額</div>';
  html += '<div class="ps-bottom-val">' + numFmt(totalDeductAll) + '</div>';
  html += '</div>';
  // 差引支給額
  html += '<div class="ps-bottom-block ps-net">';
  html += '<div class="ps-bottom-label">差引支給額</div>';
  html += '<div class="ps-bottom-val ps-net-val">' + numFmt(netPayDisplay) + '</div>';
  html += '</div>';
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

  // 役員：出勤日数入力欄を表示
  var wdBar = document.getElementById('payslipWorkDaysBar');
  var psTypeCheck = staff.payslip_type||staff.type;
  if (psTypeCheck === 'officer') {
    wdBar.style.display = 'flex';
    document.getElementById('payslipWorkDaysInput').value = workDays || '';
    document.getElementById('payslipWorkDaysInput').dataset.staffId = staffId;
    document.getElementById('payslipWorkDaysInput').dataset.year   = year;
    document.getElementById('payslipWorkDaysInput').dataset.month  = month;
    document.getElementById('payslipWorkDaysHint').textContent = '（現在：' + workDays + '日）';
  } else {
    wdBar.style.display = 'none';
  }

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
  oldHtml += '<div class="summary-row deduction"><span>介護保険料</span><span>'+(nursingCare>0?'- '+formatCurrency(nursingCare):'―')+'</span></div>';
  oldHtml += (childSupport>0?'<div class="summary-row deduction"><span>子ども・子育て支援金</span><span>- '+formatCurrency(childSupport)+'</span></div>':'');
  oldHtml += (empIns>0?'<div class="summary-row deduction"><span>雇用保険料</span><span>- '+formatCurrency(empIns)+'</span></div>':'');
  oldHtml += '<div class="summary-row total"><span>差引支給額</span><strong class="net-pay">'+formatCurrency(netPayFinal)+'</strong></div>';
  oldHtml += '</div></div>';
  document.getElementById('payslipOld').innerHTML = oldHtml;

  // デフォルトは新フォーマット
  switchPayslip('new');
  openModal('payslipModal');
  } catch(e) { console.error('showPayslip error:', e); showToast('給与明細の表示でエラーが発生しました: '+e.message,'error'); }
}
function numFmt(n){ return Number(n||0).toLocaleString(); }

// 給与明細の出勤日数を適用して再表示
async function applyPayslipWorkDays() {
  var input   = document.getElementById('payslipWorkDaysInput');
  var days    = parseInt(input.value);
  var staffId = input.dataset.staffId;
  var year    = parseInt(input.dataset.year);
  var month   = parseInt(input.dataset.month);
  if (isNaN(days) || days < 0 || days > 31) { showToast('正しい日数を入力してください','error'); return; }
  // 月次入力に保存
  var existing = await getMonthlyInput(year, month, staffId);
  await saveMonthlyInputData(year, month, staffId, Object.assign({}, existing, { work_days: days }));
  showToast('出勤日数を保存しました');
  document.getElementById('payslipWorkDaysHint').textContent = '（現在：' + days + '日）';
  // 給与明細を再表示
  await showPayslip(staffId, year, month);
}
function switchPayslip(mode) {
  var isNew = mode === 'new';
  document.getElementById('payslipNew').style.display = isNew ? 'block' : 'none';
  document.getElementById('payslipOld').style.display = isNew ? 'none' : 'block';
  document.getElementById('btnPayslipNew').style.background = isNew ? 'var(--accent)' : 'var(--surface2)';
  document.getElementById('btnPayslipNew').style.color = isNew ? '#fff' : 'var(--text)';
  document.getElementById('btnPayslipOld').style.background = isNew ? 'var(--surface2)' : 'var(--accent)';
  document.getElementById('btnPayslipOld').style.color = isNew ? 'var(--text)' : '#fff';
}
function printPayslip(){
  // 給与明細の内容を取得
  var newContent = document.getElementById('payslipNew').style.display !== 'none'
    ? document.getElementById('payslipNew').innerHTML
    : document.getElementById('payslipOld').innerHTML;

  var printWin = window.open('', '_blank', 'width=800,height=600');
  printWin.document.write(
    '<!DOCTYPE html><html><head>' +
    '<meta charset="UTF-8">' +
    '<title>給与明細書</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap" rel="stylesheet">' +
    '<style>' +
    'body{font-family:"Noto Sans JP",sans-serif;font-size:0.82rem;color:#222;margin:16px;padding:0;background:#fff;}' +
    '.ps-wrap{max-width:760px;margin:0 auto;}' +
    '.ps-company{font-size:.9rem;font-weight:700;text-align:right;margin-bottom:4px;}' +
    '.ps-title{font-size:1.1rem;font-weight:900;text-align:center;margin-bottom:10px;letter-spacing:.05em;}' +
    '.ps-meta{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #222;}' +
    '.ps-emp{font-size:1rem;font-weight:700;}' +
    '.ps-meta-right{font-size:.82rem;color:#555;}' +
    '.ps-table{width:100%;border-collapse:collapse;margin-bottom:0;}' +
    '.ps-table th,.ps-table td{border:1px solid #999;padding:5px 6px;font-size:.78rem;}' +
    '.ps-section-header th{background:#e8e8e8;font-weight:700;text-align:center;font-size:.8rem;padding:6px;}' +
    '.ps-label{background:#f5f5f5;color:#444;width:10%;white-space:nowrap;}' +
    '.ps-val{text-align:right;font-weight:600;width:12%;padding-right:8px;}' +
    '.ps-total-label{background:#dde4f0;font-weight:700;color:#1a3a6b;}' +
    '.ps-total-val{background:#eef2fa;font-weight:700;color:#1a3a6b;font-size:.88rem;}' +
    '.ps-total-row td{border-top:2px solid #666;}' +
    '.ps-bottom{display:flex;border:1px solid #999;border-top:none;}' +
    '.ps-bottom-block{flex:1;border-right:1px solid #999;padding:0;}' +
    '.ps-bottom-block:last-child{border-right:none;}' +
    '.ps-bottom-label{background:#e8e8e8;font-weight:900;text-align:center;font-size:.82rem;padding:5px;border-bottom:1px solid #999;}' +
    '.ps-bottom-val{text-align:right;font-weight:600;padding:6px 10px;font-size:.88rem;}' +
    '.ps-net{background:#fef9e7;}' +
    '.ps-net-val{font-size:1.1rem;font-weight:900;color:#c0392b;}' +
    '.ps-footer{display:flex;border:1px solid #999;border-top:none;}' +
    '.ps-footer-item{flex:1;border-right:1px solid #999;padding:5px 8px;font-size:.75rem;color:#666;}' +
    '.ps-footer-item:last-child{border-right:none;}' +
    '.ps-note{font-size:.75rem;color:#555;margin-top:8px;padding:6px 10px;background:#fffbe6;border:1px solid #f0d060;border-radius:4px;}' +
    '.ps-detail-toggle{display:none;}' +
    '.ps-work-total{margin-top:10px;padding:8px 12px;background:#f0f8ff;border:1.5px solid #bfdbfe;border-radius:8px;}' +
    '.summary-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;}' +
    '.summary-row.deduction span:last-child{color:#dc2626;}' +
    '.summary-row.total{font-weight:900;font-size:1.1rem;border-top:2px solid #222;margin-top:8px;}' +
    '.payslip{max-width:760px;margin:0 auto;}' +
    '.payslip-header{text-align:center;margin-bottom:16px;}' +
    '.payslip-info{display:flex;flex-wrap:wrap;gap:8px 20px;margin-bottom:16px;font-size:.82rem;}' +
    '.payslip-summary{margin-top:16px;border:1px solid #ddd;border-radius:8px;padding:16px;}' +
    '</style>' +
    '</head><body>' +
    newContent +
    '</body></html>'
  );
  printWin.document.close();
  printWin.focus();
  setTimeout(function(){ printWin.print(); printWin.close(); }, 500);
}

var currentTaxType='kou',currentInsuranceType='pension';
var insuranceLabels={pension:'厚生年金',health:'健康保険（介護なし）',health_nursing:'健康保険（介護込み）',child_support:'子ども・子育て支援金'};
async function loadTaxTab(){loadTaxTable('kou');loadInsuranceTable('pension');loadEmpInsRateTable();}
async function loadTaxTable(type){
  currentTaxType=type;
  document.querySelectorAll('.tax-type-btn').forEach(function(b){b.classList.toggle('active',b.dataset.type===type);});
  var rows=await DB.getTaxTable(type),tbody=document.getElementById('taxTableBody');tbody.innerHTML='';
  var sorted=rows.slice().sort(function(a,b){return a.income_from-b.income_from;});
  // 新形式（甲欄・扶養人数別）かどうか判定
  var isNewKou = type==='kou' && sorted.length>0 && sorted[0].dep0!==undefined;
  // ヘッダーを切り替え
  var header=document.getElementById('taxTableHeader');
  if(header){
    if(isNewKou){
      header.innerHTML='<th>以上</th><th>未満</th><th>0人</th><th>1人</th><th>2人</th><th>3人</th><th>4人</th><th>5人</th><th>6人</th><th>7人</th>';
    } else {
      header.innerHTML='<th>月収（以上）</th><th>税額</th><th>操作</th>';
    }
  }
  sorted.forEach(function(r){
    var tr=document.createElement('tr');
    if(isNewKou){
      tr.innerHTML=
        '<td>'+formatCurrency(r.income_from)+'</td>'+
        '<td>'+(r.income_to?formatCurrency(r.income_to):'-')+'</td>'+
        '<td>'+numFmt(r.dep0||0)+'</td>'+
        '<td>'+numFmt(r.dep1||0)+'</td>'+
        '<td>'+numFmt(r.dep2||0)+'</td>'+
        '<td>'+numFmt(r.dep3||0)+'</td>'+
        '<td>'+numFmt(r.dep4||0)+'</td>'+
        '<td>'+numFmt(r.dep5||0)+'</td>'+
        '<td>'+numFmt(r.dep6||0)+'</td>'+
        '<td>'+numFmt(r.dep7||0)+'</td>';
    } else {
      tr.innerHTML=
        '<td>'+formatCurrency(r.income_from)+' ～</td>'+
        '<td>'+formatCurrency(r.tax_amount||0)+'</td>'+
        '<td><button class="btn-sm btn-edit" onclick="openTaxEditModal(\'' + r.id + '\')">✏️</button> ' +
        '<button class="btn-sm btn-delete" onclick="deleteTaxRow(\'' + r.id + '\')">🗑️</button></td>';
    }
    tbody.appendChild(tr);
  });
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
async function previewTaxCsv(){
  var file=document.getElementById('taxCsvFile').files[0];
  if(!file){showToast('ファイルを選択してください','error');return;}
  var text=await file.text(),lines=text.split('\n').filter(function(l){return l.trim();});
  taxCsvParsed=[];
  var tbody=document.getElementById('taxCsvPreviewBody');tbody.innerHTML='';
  var type=document.getElementById('taxCsvType').value;
  var firstCol=lines[0].split(',')[0].trim().replace(/"/g,'');
  var dl=isNaN(parseInt(firstCol))?lines.slice(1):lines;
  if(type==='kou'){
    document.getElementById('taxCsvPreviewHeader').innerHTML=
      '<th>以上</th><th>未満</th><th>0人</th><th>1人</th><th>2人</th><th>3人</th><th>4人</th><th>5人</th><th>6人</th><th>7人</th>';
    for(var i=0;i<dl.length;i++){
      var cols=dl[i].split(',').map(function(c){return c.trim().replace(/[,"¥\u00a5]/g,'');});
      if(cols.length<3)continue;
      var from=parseInt(cols[0]);if(isNaN(from))continue;
      var to=cols[1]?parseInt(cols[1]):null;
      var deps={};
      for(var d=0;d<8;d++) deps['dep'+d]=parseInt(cols[d+2])||0;
      taxCsvParsed.push(Object.assign({income_from:from,income_to:to},deps));
      var tr=document.createElement('tr');
      tr.innerHTML='<td>'+formatCurrency(from)+'</td><td>'+(to?formatCurrency(to):'-')+'</td>'+
        '<td>'+deps.dep0+'</td><td>'+deps.dep1+'</td><td>'+deps.dep2+'</td><td>'+deps.dep3+'</td>'+
        '<td>'+deps.dep4+'</td><td>'+deps.dep5+'</td><td>'+deps.dep6+'</td><td>'+deps.dep7+'</td>';
      tbody.appendChild(tr);
    }
  } else {
    document.getElementById('taxCsvPreviewHeader').innerHTML='<th>月収（以上）</th><th>税額</th>';
    for(var i=0;i<dl.length;i++){
      var cols=dl[i].split(',').map(function(c){return c.trim().replace(/[,"¥\u00a5]/g,'');});
      if(cols.length<2)continue;
      var inf=parseInt(cols[0]),ta=parseInt(cols[1]);if(isNaN(inf)||isNaN(ta))continue;
      taxCsvParsed.push({income_from:inf,tax_amount:ta});
      var tr=document.createElement('tr');tr.innerHTML='<td>'+formatCurrency(inf)+' ～</td><td>'+formatCurrency(ta)+'</td>';
      tbody.appendChild(tr);
    }
  }
  document.getElementById('taxCsvPreview').style.display='block';
  document.getElementById('taxCsvCount').textContent=taxCsvParsed.length+'行読み込み済み';
}
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
  leaves.slice().sort(function(a,b){return a.date>b.date?-1:1;}).forEach(function(l){var tr=document.createElement('tr');tr.innerHTML='<td>'+formatDateJP(l.date)+'</td><td><span class="badge '+(l.type==='grant'?'badge-active':'badge-special')+'">'+(l.type==='grant'?'付与':'使用')+'</span></td><td>'+l.days+'日</td><td>'+(l.reason||'-')+'</td><td style="white-space:nowrap;"><button class="btn-sm btn-edit" onclick="openLeaveEditModal(\''+l.id+'\')" style="margin-right:4px;">✏️ 編集</button><button class="btn-sm btn-delete" onclick="deleteLeave(\''+l.id+'\')">🗑️ 削除</button></td>';tbody.appendChild(tr);});
  if(!leaves.length)tbody.innerHTML='<tr><td colspan="5" class="empty-cell">有休記録がありません</td></tr>';
}
function selectLeaveStaff(staffId){document.getElementById('leaveStaffSelect').value=staffId;loadLeaveList();}
async function openLeaveModal(){
  var staffId=document.getElementById('leaveStaffSelect').value,staff=await DB.getStaff(),sel=document.getElementById('leaveModalStaff');
  sel.innerHTML='';
  staff.filter(function(s){return s.is_active;}).forEach(function(s){var o=document.createElement('option');o.value=s.id;o.textContent=s.name;if(s.id===staffId)o.selected=true;sel.appendChild(o);});
  document.getElementById('leaveModalTitle').textContent='➕ 有休を追加';
  document.getElementById('leaveEditId').value='';
  document.getElementById('leaveDate').value=todayStr();
  document.getElementById('leaveType').value='use';
  document.getElementById('leaveDays').value='1';
  document.getElementById('leaveHours').value='';
  document.getElementById('leaveReason').value='';
  toggleLeaveHoursField(staff, staffId);
  openModal('leaveModal');
}

async function onLeaveStaffChange(){
  var staffId = document.getElementById('leaveModalStaff').value;
  var staff = await DB.getStaff();
  toggleLeaveHoursField(staff, staffId);
}

function toggleLeaveHoursField(staff, staffId){
  var s = staff ? staff.find(function(x){return x.id===staffId;}) : null;
  var isHourly = s && s.type==='hourly';
  var row = document.getElementById('leaveHoursRow');
  var label = document.getElementById('leaveHoursLabel');
  var input = document.getElementById('leaveHours');
  if(row) row.style.display = (isHourly || !s) ? 'block' : 'block'; // 全員表示
  if(label){
    if(isHourly){
      label.textContent = '時間数 *（必須）';
      label.style.color = '#dc2626';
    } else {
      label.textContent = '時間数（任意）';
      label.style.color = '';
    }
  }
  if(input){
    input.required = isHourly;
    input.placeholder = isHourly ? '例: 6.5（必須）' : '例: 6';
  }
}
async function openLeaveEditModal(id){
  var leaveData=await DB.getLeaveAll();
  var l=leaveData.find(function(x){return x.id===id;});
  if(!l){showToast('レコードが見つかりません','error');return;}
  var staff=await DB.getStaff(),sel=document.getElementById('leaveModalStaff');
  sel.innerHTML='';
  staff.filter(function(s){return s.is_active;}).forEach(function(s){var o=document.createElement('option');o.value=s.id;o.textContent=s.name;if(s.id===l.staff_id)o.selected=true;sel.appendChild(o);});
  document.getElementById('leaveModalTitle').textContent='✏️ 有休を編集';
  document.getElementById('leaveEditId').value=id;
  document.getElementById('leaveDate').value=l.date||'';
  document.getElementById('leaveType').value=l.type||'grant';
  document.getElementById('leaveDays').value=l.days||'1';
  document.getElementById('leaveHours').value=l.hours||'';
  document.getElementById('leaveReason').value=l.reason||'';
  toggleLeaveHoursField(staff, l.staff_id);
  openModal('leaveModal');
}
async function saveLeave(){
  var id=document.getElementById('leaveEditId').value;
  var staff_id=document.getElementById('leaveModalStaff').value;
  var date=document.getElementById('leaveDate').value;
  var type=document.getElementById('leaveType').value;
  var days=parseFloat(document.getElementById('leaveDays').value)||0;
  var reason=document.getElementById('leaveReason').value.trim();
  if(!staff_id||!date||days<=0){showToast('スタッフ・日付・日数を正しく入力してください','error');return;}
  var hours = parseFloat(document.getElementById('leaveHours').value)||0;
  // パート・時給は使用時に時間数必須（leaveHoursLabelで判定）
  var hoursLabel = document.getElementById('leaveHoursLabel');
  var isHourlyRequired = hoursLabel && hoursLabel.style.color === 'rgb(220, 38, 38)';
  if(type==='use' && isHourlyRequired && hours<=0){
    showToast('パート・時給スタッフの有休使用には時間数の入力が必要です','error');
    return;
  }
  var record={staff_id:staff_id,date:date,type:type,days:days,reason:reason};
  if(hours>0 && type==='use') record.hours=hours;
  if(id) record.id=id;
  await DB.saveLeave(record);
  closeModal('leaveModal');
  showToast(id?'更新しました':'保存しました');
  loadLeaveList();
}
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
      // 昼休み控除（設定時刻で正確に計算）
      var lunchDeduct = 0;
      if (item.staff.lunch_break && item.staff.lunch_start && item.staff.lunch_end) {
        var lsM = timeToMinutes(item.staff.lunch_start);
        var leM = timeToMinutes(item.staff.lunch_end);
        var overlapStart = Math.max(inMins, lsM);
        var overlapEnd   = Math.min(nowMins, leM);
        lunchDeduct = Math.max(0, overlapEnd - overlapStart);
      }
      var workMins = Math.max(0, nowMins - inMins - lunchDeduct);
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
      var _todayOut = r.clock_out_actual||r.clock_out_calc;
      var _todayIn  = r.clock_in_calc||r.clock_in_actual;
      var workMins = calcWorkMinutes(_todayIn, _todayOut, item.staff.lunch_break, item.staff.lunch_start, item.staff.lunch_end);
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

  // Firestoreから最新のスタッフデータを取得（paid_leave_hoursを確実に反映）
  var staff   = await DB.getStaff();
  var active  = staff.filter(function(s){ return s.is_active && s.type !== 'officer' && s.type !== 'contract'; });
  var records = await DB.getAttendance({ year: year, month: month });
  var allLeave = await DB.getLeaveAll();
  // 当月の有給使用データ
  var ymStr = year + '-' + String(month).padStart(2,'0');


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
    // paid_leave_hoursが未設定の場合：社員は6時間、それ以外は7.5時間
    var defaultLeaveH = (s.type==='employee') ? 6 : 7.5;
    var paidLeaveHours = s.paid_leave_hours || defaultLeaveH;

    // 当月の有給使用日データ
    var staffLeave = allLeave.filter(function(r){ return r.staff_id === s.id && r.type === 'use' && r.date && r.date.startsWith(ymStr); });
    var leaveDates = {};
    staffLeave.forEach(function(r){ leaveDates[r.date] = (leaveDates[r.date]||0) + (parseFloat(r.days)||1); });

    html += '<tr><td class="monthly-name-cell">' + s.name + '</td>';

    days.forEach(function(d) {
      var dateStr = year + '-' + String(month).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      var date    = new Date(year, month-1, d);
      var dow     = date.getDay();
      var r = staffRecords.find(function(x){ return x.date === dateStr; });
      var cls = dow===0?'monthly-sun':dow===6?'monthly-sat':'';
      var isLeaveDay = leaveDates[dateStr] !== undefined;

      if (r && r.clock_in_actual) {
        var _oc = r.clock_out_actual||r.clock_out_calc;
        var _rlb=r.lunch_break!==undefined?r.lunch_break:s.lunch_break;
        var _rls=r.lunch_start||s.lunch_start;
        var _rle=r.lunch_end||s.lunch_end;
        var mins = _oc ? calcWorkMinutes(r.clock_in_calc, _oc, _rlb, _rls, _rle) : 0;
        totalDays++;
        totalMins += mins;
        var inTime  = r.clock_in_actual  || '-';
        var outTime = r.clock_out_actual || '未退勤';
        var outCls  = r.clock_out_actual ? '' : 'monthly-missing';
        html += '<td class="monthly-cell '+cls+'" style="position:relative;">' +
          '<span class="monthly-in">'  + inTime  + '</span><br>' +
          '<span class="monthly-out '+outCls+'">' + outTime + '</span><br>' +
          (isLeaveDay ? '<span class="monthly-leave-badge">有休' + leaveDates[dateStr] + '日</span><br>' : '') +
          '<button class="monthly-edit-btn" onclick="openAttendanceEditModal(\'' + r.id + '\',' + year + ',' + month + ')">✏️</button>' +
          '</td>';
      } else if (isLeaveDay) {
        // 有休取得日（出勤なし）
        var leaveDays = leaveDates[dateStr];
        // 有休管理の時間数を取得
        var leaveRecsDay = allLeave.filter(function(r){return r.staff_id===s.id&&r.type==='use'&&r.date===dateStr;});
        var leaveHoursDay = leaveRecsDay.reduce(function(a,r){return a+(r.hours||0);},0);
        var isHourlyS = s.type==='hourly';
        // パート・時給：手入力時間のみ、社員：paid_leave_hoursで計算
        var leaveMins = isHourlyS ? Math.round(leaveHoursDay*60) : Math.round(leaveDays*paidLeaveHours*60);
        totalMins += leaveMins;
        var leaveLabel = isHourlyS
          ? (leaveHoursDay>0 ? leaveDays+'日（'+leaveHoursDay+'h）' : leaveDays+'日（時間未入力）')
          : leaveDays+'日（'+paidLeaveHours+'h）';
        html += '<td class="monthly-cell monthly-leave '+cls+'" style="position:relative;">' +
          '<span class="monthly-leave-day">🌿 有休</span><br>' +
          '<span class="monthly-leave-time">' + leaveLabel + '</span><br>' +
          '<button class="monthly-add-btn" onclick="openAttendanceAddModal(\'' + dateStr + '\',\'' + s.id + '\')">➕</button>' +
          '</td>';
      } else {
        html += '<td class="monthly-cell monthly-empty '+cls+'" style="position:relative;">' +
          '<button class="monthly-add-btn" onclick="openAttendanceAddModal(\'' + dateStr + '\',\'' + s.id + '\')">➕</button>' +
          '</td>';
      }
    });

    // 合計（有休時間含む）
    var totalH = Math.floor(totalMins/60), totalM = totalMins%60;
    var totalStr = totalH + ':' + String(totalM).padStart(2,'0');
    var totalLeave = Object.values(leaveDates).reduce(function(a,b){return a+b;},0);
    html += '<td class="monthly-total-cell">' + totalDays + '日' + (totalLeave>0?'<br><span style="font-size:.7rem;color:#16a34a;">有休'+totalLeave+'日</span>':'') + '</td>';
    html += '<td class="monthly-total-cell">' + totalStr  + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';

  wrap.innerHTML = html;

  // 現在の月のデフォルト選択
  document.getElementById('monthlyMonth').value = month;
  document.getElementById('monthlyYear').value  = year;
}

async function saveOfficerWorkDays(staffId, days, year, month) {
  var d = days !== '' ? parseInt(days) : null;
  var existing = await getMonthlyInput(year, month, staffId);
  await saveMonthlyInputData(year, month, staffId, Object.assign({}, existing, { work_days: d }));
  showToast('出勤日数を保存しました');
  // 合計欄を更新
  var totalCell = document.querySelector('.officer-workdays-input[data-staff="' + staffId + '"]');
  if(totalCell) totalCell.value = days;
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
    (s['pay_items_'+t]||[]).forEach(function(item){addPayItem(t,item.name,item.amount,false,item.category||'pay',item.calc_add||'add',item.tax_type||'taxable',item.wage_type||'wage',item.salary_type||'included',item.wage_fixed||'fixed');});
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
      var sal_type  = row.querySelector('.pay-item-salary-type')  ? row.querySelector('.pay-item-salary-type').value  : 'included';
      var wage_fixed = row.querySelector('.pay-item-salary-fixed') ? row.querySelector('.pay-item-salary-fixed').value : 'fixed';
      if(name) s['pay_items_'+t].push({name:name, amount:amt, category:cat, calc_add:calc_add, tax_type:tax_type, wage_type:wage_type, salary_type:sal_type, wage_fixed:wage_fixed});
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

function addPayItem(type, name, amount, isAuto, category, calc_add, tax_type, wage_type, salary_type, wage_fixed) {
  var wrap = document.getElementById('payItemsWrap_'+type);
  if (!wrap) return;
  var rows = wrap.querySelectorAll('.pay-item-row');
  if (rows.length >= 8) { showToast('支給項目は最大8項目です', 'error'); return; }
  var cat   = category   || 'pay';
  var cadd  = (calc_add  === undefined || calc_add  === null) ? 'add' : calc_add;
  var ttax  = tax_type   || 'taxable';
  var twage = wage_type  || 'wage';
  var tsal  = salary_type|| 'included';
  var tfixed= wage_fixed || 'fixed';
  var div = document.createElement('div');
  div.className = 'pay-item-row';
  div.draggable = true;
  div.style.cssText = 'margin-bottom:12px;background:#f8fafc;padding:14px;border-radius:12px;border:1px solid var(--border);cursor:grab;';

  // ドラッグ&ドロップで並べ替え
  div.addEventListener('dragstart', function(e){ e.dataTransfer.effectAllowed='move'; window._dragRow=div; div.style.opacity='0.5'; });
  div.addEventListener('dragend',   function(){ div.style.opacity='1'; window._dragRow=null; });
  div.addEventListener('dragover',  function(e){ e.preventDefault(); e.dataTransfer.dropEffect='move'; div.style.borderColor='var(--accent)'; });
  div.addEventListener('dragleave', function(){ div.style.borderColor='var(--border)'; });
  div.addEventListener('drop',      function(e){
    e.preventDefault(); div.style.borderColor='var(--border)';
    if (window._dragRow && window._dragRow !== div) {
      var parent = div.parentNode;
      var allRows = Array.from(parent.querySelectorAll('.pay-item-row'));
      var fromIdx = allRows.indexOf(window._dragRow);
      var toIdx   = allRows.indexOf(div);
      if (fromIdx < toIdx) parent.insertBefore(window._dragRow, div.nextSibling);
      else parent.insertBefore(window._dragRow, div);
    }
  });

  // 行の内容を構築
  var row1 = document.createElement('div');
  row1.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:10px;';

  // ドラッグハンドル＋項目名
  var nameDiv = document.createElement('div');
  nameDiv.innerHTML = '<label class="pi-label">☰ 項目名</label><input type="text" class="form-input pay-item-name" placeholder="例: 食事手当" value="'+(name||'')+'" style="margin:0;">';
  row1.appendChild(nameDiv);

  // 金額
  var amtDiv = document.createElement('div');
  amtDiv.innerHTML = '<label class="pi-label">金額（円）</label><input type="number" class="form-input pay-item-amount" placeholder="0" value="'+(amount||0)+'" min="0" style="margin:0;">';
  row1.appendChild(amtDiv);

  // 表示区分
  var catDiv = document.createElement('div');
  catDiv.innerHTML = '<label class="pi-label">表示区分</label><select class="form-input pay-item-category" style="margin:0;">' +
    '<option value="attendance"'+(cat==='attendance'?' selected':'')+'>勤怠</option>' +
    '<option value="pay"'+(cat==='pay'?' selected':'')+'>支給</option>' +
    '<option value="deduction"'+(cat==='deduction'?' selected':'')+'>控除</option>' +
    '<option value="other"'+(cat==='other'?' selected':'')+'>その他</option>' +
    '</select>';
  row1.appendChild(catDiv);

  // 集計方法
  var calcDiv = document.createElement('div');
  calcDiv.innerHTML = '<label class="pi-label">集計方法</label><select class="form-input pay-item-calc-add" style="margin:0;">' +
    '<option value="add"'+(cadd==='add'?' selected':'')+'>➕ 加算</option>' +
    '<option value="sub"'+(cadd==='sub'?' selected':'')+'>➖ 減算</option>' +
    '</select>';
  row1.appendChild(calcDiv);

  // 削除ボタン（addEventListener で確実に動作）
  var delBtn = document.createElement('button');
  delBtn.className = 'btn btn-secondary';
  delBtn.style.cssText = 'padding:8px 10px;white-space:nowrap;margin-top:16px;';
  delBtn.textContent = '🗑️';
  delBtn.type = 'button';
  delBtn.addEventListener('click', function(){ div.remove(); });
  row1.appendChild(delBtn);

  div.appendChild(row1);

  // 2行目：課税・賃金・報酬・月次変動
  var row2 = document.createElement('div');
  row2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;';
  row2.innerHTML =
    '<div><label class="pi-label">課税（所得税）</label><select class="form-input pay-item-tax-type" style="margin:0;font-size:.75rem;">' +
      '<option value="taxable"'+(ttax==='taxable'?' selected':'')+'>課税</option>' +
      '<option value="nontaxable"'+(ttax==='nontaxable'?' selected':'')+'>非課税</option>' +
    '</select></div>' +
    '<div><label class="pi-label">賃金（労働保険）</label><select class="form-input pay-item-wage-type" style="margin:0;font-size:.75rem;">' +
      '<option value="wage"'+(twage==='wage'?' selected':'')+'>賃金に含める</option>' +
      '<option value="nonwage"'+(twage==='nonwage'?' selected':'')+'>賃金に含めない</option>' +
    '</select></div>' +
    '<div><label class="pi-label">報酬（社会保険）</label><select class="form-input pay-item-salary-type" style="margin:0;font-size:.75rem;">' +
      '<option value="included"'+(tsal==='included'?' selected':'')+'>報酬に含める</option>' +
      '<option value="excluded"'+(tsal==='excluded'?' selected':'')+'>報酬に含めない</option>' +
    '</select></div>' +
    '<div><label class="pi-label">月次変動</label><select class="form-input pay-item-salary-fixed" style="margin:0;font-size:.75rem;">' +
      '<option value="fixed"'+(tfixed==='fixed'?' selected':'')+'>固定（変更なし）</option>' +
      '<option value="variable"'+(tfixed==='variable'?' selected':'')+'>月次変動（毎月入力）</option>' +
    '</select></div>';
  div.appendChild(row2);
  wrap.appendChild(div);
}

// ============================================================
// 雇用保険料率管理
// ============================================================
async function loadEmpInsRateTable() {
  var rows = await DB.getEmpInsRates();
  var tbody = document.getElementById('empInsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">データがありません</td></tr>';
    return;
  }
  rows.forEach(function(r) {
    var empRate  = (r.employee_numerator / r.employee_denominator * 100).toFixed(3) + '%';
    var erRate   = (r.employer_numerator  / r.employer_denominator  * 100).toFixed(3) + '%';
    var totalNum = (parseFloat(r.employee_numerator)||0) + (parseFloat(r.employer_numerator)||0);
    var totalRate = (totalNum / (r.employee_denominator||1000) * 100).toFixed(3) + '%';
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><strong>' + r.category + '</strong></td>' +
      '<td style="font-size:.8rem;">' + (r.fiscal_year||'-') + '</td>' +
      '<td>' + r.employee_numerator + '/' + r.employee_denominator + '（' + empRate + '）</td>' +
      '<td>' + r.employer_numerator + '/' + r.employer_denominator + '（' + erRate + '）</td>' +
      '<td><strong>' + totalNum + '/' + (r.employee_denominator||1000) + '（' + totalRate + '）</strong></td>' +
      '<td>' +
        '<button class="btn-sm btn-edit" onclick="openEmpInsEditModal(\'' + r.id + '\')">✏️</button> ' +
        '<button class="btn-sm btn-delete" onclick="deleteEmpInsRate(\'' + r.id + '\')">🗑️</button>' +
      '</td>';
    tbody.appendChild(tr);
  });
  document.getElementById('empInsTitle').textContent = '📄 雇用保険料率一覧（' + rows.length + '件）';
  openCollapsible('empInsSection');
}

function openEmpInsCsvModal() {
  document.getElementById('empInsCsvFile').value = '';
  document.getElementById('empInsCsvPreview').style.display = 'none';
  document.getElementById('empInsCsvPreviewBody').innerHTML = '';
  openModal('empInsCsvModal');
}

function openEmpInsAddModal() {
  document.getElementById('empInsEditId').value = '';
  document.getElementById('empInsCategory').value = '一般の事業';
  document.getElementById('empInsYear').value = '令和8年度（2026.4〜2027.3）';
  document.getElementById('empInsEmployee').value = '';
  document.getElementById('empInsEmployeeDenom').value = '1000';
  document.getElementById('empInsEmployer').value = '';
  document.getElementById('empInsEmployerDenom').value = '1000';
  openModal('empInsAddModal');
}

async function openEmpInsEditModal(id) {
  var rows = await DB.getEmpInsRates();
  var r = rows.find(function(x){ return x.id === id; });
  if (!r) return;
  document.getElementById('empInsEditId').value = r.id;
  document.getElementById('empInsCategory').value = r.category;
  document.getElementById('empInsYear').value = r.fiscal_year || '';
  document.getElementById('empInsEmployee').value = r.employee_numerator;
  document.getElementById('empInsEmployeeDenom').value = r.employee_denominator || 1000;
  document.getElementById('empInsEmployer').value = r.employer_numerator;
  document.getElementById('empInsEmployerDenom').value = r.employer_denominator || 1000;
  openModal('empInsAddModal');
}

async function saveEmpInsRate() {
  var id  = document.getElementById('empInsEditId').value;
  var row = {
    category:             document.getElementById('empInsCategory').value,
    fiscal_year:          document.getElementById('empInsYear').value.trim(),
    employee_numerator:   parseFloat(document.getElementById('empInsEmployee').value) || 0,
    employee_denominator: parseInt(document.getElementById('empInsEmployeeDenom').value) || 1000,
    employer_numerator:   parseFloat(document.getElementById('empInsEmployer').value) || 0,
    employer_denominator: parseInt(document.getElementById('empInsEmployerDenom').value) || 1000,
  };
  if (id) row.id = id;
  await DB.saveEmpInsRate(row);
  closeModal('empInsAddModal');
  showToast('雇用保険料率を保存しました');
  loadEmpInsRateTable();
}

async function deleteEmpInsRate(id) {
  if (!confirmAction('この料率データを削除しますか？')) return;
  await DB.deleteEmpInsRate(id);
  showToast('削除しました');
  loadEmpInsRateTable();
}

var empInsCsvParsed = [];
function previewEmpInsCsv() {
  var file = document.getElementById('empInsCsvFile').files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var lines = e.target.result.split('\n').filter(function(l){ return l.trim(); });
    empInsCsvParsed = [];
    var tbody = document.getElementById('empInsCsvPreviewBody');
    tbody.innerHTML = '';
    // ヘッダー行スキップ
    var firstCol = lines[0].split(',')[0].trim().replace(/"/g,'');
    var dl = isNaN(parseInt(firstCol)) ? lines.slice(1) : lines;
    dl.forEach(function(line) {
      var cols = line.split(',').map(function(c){ return c.trim().replace(/"/g,''); });
      if (cols.length < 4) return;
      var category = cols[0];
      var fiscal_year = cols[1] || '';
      var emp_num  = parseFloat(cols[2]) || 0;
      var emp_den  = parseInt(cols[3]) || 1000;
      var er_num   = parseFloat(cols[4]) || 0;
      var er_den   = parseInt(cols[5]) || 1000;
      if (!category) return;
      empInsCsvParsed.push({ category: category, fiscal_year: fiscal_year, employee_numerator: emp_num, employee_denominator: emp_den, employer_numerator: er_num, employer_denominator: er_den });
      var empRate = (emp_num/emp_den*100).toFixed(3)+'%';
      var erRate  = (er_num/er_den*100).toFixed(3)+'%';
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>'+category+'</td><td style="font-size:.78rem;">'+fiscal_year+'</td><td>'+emp_num+'/'+emp_den+'（'+empRate+'）</td><td>'+er_num+'/'+er_den+'（'+erRate+'）</td><td>'+((emp_num+er_num)/emp_den*100).toFixed(3)+'%</td>';
      tbody.appendChild(tr);
    });
    document.getElementById('empInsCsvPreview').style.display = 'block';
    document.getElementById('empInsCsvCount').textContent = empInsCsvParsed.length + '件読み込み済み';
  };
  reader.readAsText(file, 'UTF-8');
}

async function importEmpInsCsv() {
  if (!empInsCsvParsed.length) { showToast('データがありません', 'error'); return; }
  if (!confirmAction(empInsCsvParsed.length + '件で雇用保険料率を上書きしますか？')) return;
  await DB.replaceEmpInsRates(empInsCsvParsed);
  closeModal('empInsCsvModal');
  showToast('雇用保険料率をインポートしました');
  loadEmpInsRateTable();
  // config.js の EMP_INS_RATE_EMPLOYEE も自動更新
  var general = empInsCsvParsed.find(function(r){ return r.category === '一般の事業'; });
  if (general) {
    EMP_INS_RATE_EMPLOYEE = general.employee_numerator / general.employee_denominator;
    showToast('雇用保険料率を自動更新: 労働者 ' + general.employee_numerator + '/' + general.employee_denominator, 'success');
  }
}

function downloadEmpInsCsvTemplate() {
  var csv = '事業区分,適用年度,労働者負担（分子）,労働者負担（分母）,事業主負担（分子）,事業主負担（分母）\n';
  csv += '一般の事業,令和8年度（2026.4〜2027.3）,5,1000,8.5,1000\n';
  csv += '農林水産・清酒製造の事業,令和8年度（2026.4〜2027.3）,6,1000,9.5,1000\n';
  csv += '建設の事業,令和8年度（2026.4〜2027.3）,6,1000,10.5,1000\n';
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '雇用保険料率テンプレート.csv';
  a.click();
}

// 打刻モーダルの昼休憩トグル
function toggleAttendanceLunch(){
  var chk = document.getElementById('attendanceLunchBreak').checked;
  document.getElementById('attendanceLunchFields').style.display = chk ? 'block' : 'none';
  updateAttendanceLunchPreview();
}

function updateAttendanceLunchPreview(){
  var start = document.getElementById('attendanceLunchStart').value;
  var end   = document.getElementById('attendanceLunchEnd').value;
  var prev  = document.getElementById('attendanceLunchPreview');
  if(start && end){
    var mins = timeToMinutes(end) - timeToMinutes(start);
    prev.textContent = '控除時間：' + (mins > 0 ? Math.floor(mins/60)+'時間'+mins%60+'分' : '-');
  }
}

// 家族構成から扶養人数を自動計算（国税庁・源泉徴収税額表ルール）
function calcDependents(){
  var spouse       = document.getElementById('familySpouse').value;
  var over16       = parseInt(document.getElementById('familyOver16').value)||0;
  var under16      = parseInt(document.getElementById('familyUnder16').value)||0;
  var disabled     = parseInt(document.getElementById('familyDisabled').value)||0;
  var cohabDis     = parseInt(document.getElementById('familyCohabDisabled').value)||0;
  var selfDisabled = document.getElementById('selfDisabled').checked;
  var selfWidow    = document.getElementById('selfWidow').checked;
  var selfSingle   = document.getElementById('selfSingleParent').checked;
  var selfStudent  = document.getElementById('selfStudent').checked;

  // 扶養人数の計算（国税庁ルール）
  var count = 0;
  // 配偶者（源泉控除対象のみ）
  if(spouse === 'dependent') count++;
  // 16歳以上の扶養親族
  count += over16;
  // 扶養親族のうち障害者（1人につき+1）
  count += disabled;
  // 同居特別障害者（1人につき+2）
  count += cohabDis * 2;
  // 本人区分（各1人加算）
  if(selfDisabled) count++;
  if(selfWidow)    count++;
  if(selfSingle)   count++;
  if(selfStudent)  count++;

  document.getElementById('staffDependents').value = count;

  // プレビュー
  var desc = [];
  if(spouse==='dependent')    desc.push('配偶者（控除対象）+1');
  if(spouse==='non_dependent')desc.push('配偶者（控除対象外）');
  if(over16>0)    desc.push('扶養親族 '+over16+'人 +'+over16);
  if(under16>0)   desc.push('16歳未満の子 '+under16+'人（加算なし）');
  if(disabled>0)  desc.push('扶養親族の障害者 '+disabled+'人 +'+disabled);
  if(cohabDis>0)  desc.push('同居特別障害者 '+cohabDis+'人 +'+(cohabDis*2));
  if(selfDisabled)desc.push('本人：障害者 +1');
  if(selfWidow)   desc.push('本人：寡婦 +1');
  if(selfSingle)  desc.push('本人：ひとり親 +1');
  if(selfStudent) desc.push('本人：勤労学生 +1');

  var preview = document.getElementById('dependentsPreview');
  if(preview){
    preview.innerHTML = '<strong>扶養親族等の人数：' + count + '人</strong><br>' +
      '<span style="font-size:.75rem;font-weight:400;">' + (desc.length ? desc.join('　') : '基本0人') + '</span>';
  }
}

function toggleOfficerCommute(){
  var type = document.getElementById('staffType').value;
  var psType = document.getElementById('staffPayslipType') ? document.getElementById('staffPayslipType').value : '';
  var isOfficer = (type === 'officer' || psType === 'officer');
  var row = document.getElementById('officerCommuteFixedRow');
  if(row) row.style.display = isOfficer ? 'block' : 'none';
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
  // 常に最新の設定を取得（キャッシュをクリア）
  _payslipSettings = null;
  localStorage.removeItem('payslip_settings');
  var settings = await getPayslipSettings();

  // 変動賃金項目を種別ごとに収集（wage_fixed==='variable' のもの）
  function getVarItems(psType) {
    var key = psType==='officer'?'pay_items_officer':psType==='employee'?'pay_items_employee':'pay_items_hourly';
    return (settings[key]||[]).filter(function(item){ return item.wage_fixed==='variable'; });
  }
  // 時給スタッフの全支給項目（固定・変動問わず金額入力可能）
  function getAllPayItems(psType) {
    var key = psType==='officer'?'pay_items_officer':psType==='employee'?'pay_items_employee':'pay_items_hourly';
    return (settings[key]||[]);
  }

  var html = '<div style="overflow-y:auto;max-height:62vh;"><table class="data-table" style="font-size:.78rem;">';
  html += '<thead><tr style="background:var(--surface2);">';
  html += '<th style="min-width:80px;">氏名</th><th>種別</th>';
  html += '<th>出勤日数</th>';
  html += '<th>時間数<br><span style="font-size:.68rem;font-weight:400;">（時給のみ・空白=自動）</span></th>';
  html += '<th>変動手当（円）</th>';
  html += '<th>有休時間<br><span style="font-size:.68rem;font-weight:400;">（追加時間）</span></th>';
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

    // 変動手当：時給スタッフは全支給項目を表示、それ以外は変動賃金項目のみ
    var dispItems = (s.type==='hourly') ? getAllPayItems(psType) : varItems;
    if (dispItems.length > 0) {
      var varHtml = '';
      dispItems.forEach(function(item) {
        var found = (monthly.variable_items||[]).find(function(x){return x.name===item.name;});
        // 固定項目は金額を薄く表示、変動項目は通常表示
        var isFixed = item.wage_fixed !== 'variable';
        varHtml += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">'+
          '<span style="font-size:.72rem;color:var(--text-muted);white-space:nowrap;">'+item.name+
          (isFixed?'<span style="font-size:.65rem;color:#aaa;">固定</span>':'')+'</span>'+
          '<input type="number" class="form-input mi-varitem" '+
          'data-staff="'+s.id+'" data-item="'+item.name+'" '+
          'placeholder="'+(isFixed?(item.amount||0):'0')+'" min="0" '+
          'value="'+(found?found.amount:(isFixed?'':''  ))+'" '+
          'style="margin:0;width:90px;text-align:right;'+(isFixed?'background:#f8f8f8;':'')+'"'+
          '></div>';
      });
      html += '<td>'+varHtml+'</td>';
    } else {
      html += '<td style="text-align:center;color:var(--text-muted);font-size:.75rem;">設定なし</td>';
    }

    // 有休時間
    var leaveHoursVal = monthly.leave_hours!==null&&monthly.leave_hours!==undefined ? monthly.leave_hours : '';
    html += '<td><input type="number" class="form-input mi-leavehours" data-staff="'+s.id+'" '+
      'placeholder="0" min="0" step="0.5" value="'+leaveHoursVal+'" '+
      'style="margin:0;width:80px;text-align:center;"></td>';

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
    var leaveHoursEl = modal.querySelector('.mi-leavehours[data-staff="'+staffId+'"]');
    var leaveHours = leaveHoursEl ? (leaveHoursEl.value !== '' ? parseFloat(leaveHoursEl.value) : null) : null;

    var varItems = [];
    modal.querySelectorAll('.mi-varitem[data-staff="'+staffId+'"]').forEach(function(el){
      // 空欄は保存しない（固定項目はデフォルト値を使用）
      if (el.value !== '') varItems.push({ name: el.dataset.item, amount: parseInt(el.value)||0 });
    });

    var noteEl = modal.querySelector('.mi-note[data-staff="'+staffId+'"]');
    var note = noteEl ? noteEl.value.trim() : '';

    await saveMonthlyInputData(year, month, staffId, {
      work_days: workDays,
      work_hours: workHours,
      leave_hours: leaveHours,
      variable_items: varItems,
      note: note
    });
  }

  closeModal('monthlyInputModal');
  showToast('月次入力を保存しました');
  await loadPayrollSummary();
}

function _uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
