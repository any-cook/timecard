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
  ({staff:loadStaffTab,attendance:loadAttendanceTab,special:loadSpecialTab,payroll:loadPayrollTab,tax:loadTaxTab,leave:loadLeaveTab})[tab]();
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
  staff.forEach(function(s){
    var age=calcAge(s.birthdate),ageStr=age!==null?age+'歳':'-';
    var nursing=s.birthdate?(isNursingCare(s.birthdate)?'<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #d97706;">介護2号</span>':'<span class="badge badge-inactive">非該当</span>'):'-';
    var emp=s.employment_insurance?'<span class="badge badge-active">加入</span>':'<span class="badge badge-inactive">未加入</span>';
    var tr=document.createElement('tr');if(!s.is_active)tr.classList.add('inactive-row');
    tr.innerHTML='<td style="font-size:1rem;font-weight:700;color:var(--accent);">'+(s.staff_number||'-')+'</td>'+
      '<td>'+s.name+'</td><td><span class="badge badge-type">'+staffTypeLabel(s.type)+'</span></td>'+
      '<td>'+(s.type==='hourly'?formatCurrency(s.wage)+'/時':formatCurrency(s.monthly_salary)+'/月')+'</td>'+
      '<td>'+ageStr+'</td><td>'+nursing+'</td><td>'+emp+'</td>'+
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
      document.getElementById('staffName').value=editingStaff.name;
      document.getElementById('staffBirthdate').value=editingStaff.birthdate||'';
      document.getElementById('staffType').value=editingStaff.type;
      document.getElementById('staffWage').value=editingStaff.wage||'';
      document.getElementById('staffSalary').value=editingStaff.monthly_salary||'';
      document.getElementById('staffActive').checked=editingStaff.is_active;
      document.getElementById('staffTaxType').value=editingStaff.tax_type||'kou';
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
    staff_number:staffNumber,name:name,birthdate:birthdate,
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
  var records=await DB.getAttendance(attendanceFilters),staff=await DB.getStaff();
  var staffMap={};staff.forEach(function(s){staffMap[s.id]=s;});
  var tbody=document.getElementById('attendanceTableBody');tbody.innerHTML='';
  var totalWage=0,totalMins=0,staffSummary={};
  records.forEach(function(r){
    var s=staffMap[r.staff_id]||{};
    var workMins=calcWorkMinutes(r.clock_in_calc,r.clock_out_calc);
    var dailyWage=r.clock_out_calc?calcDailyWage(r.clock_in_calc,r.clock_out_calc,r.wage_at_date||0,r.is_special_day):0;
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
  else keys.forEach(function(k){var s=staffSummary[k],tr=document.createElement('tr');tr.innerHTML='<td>'+s.name+'</td><td>'+s.days+'日</td><td>'+formatWorkTime(s.mins)+'</td><td>'+formatCurrency(s.wage)+'</td><td>'+formatCurrency(s.commute)+'</td>';sb.appendChild(tr);});
}
async function openAttendanceAddModal(){
  document.getElementById('attendanceModalTitle').textContent='打刻の手動追加';document.getElementById('attendanceId').value='';
  var staff=await DB.getStaff(),sel=document.getElementById('attendanceStaff');sel.innerHTML='';
  staff.filter(function(s){return s.is_active;}).forEach(function(s){var o=document.createElement('option');o.value=s.id;o.textContent=s.name;sel.appendChild(o);});
  document.getElementById('attendanceDate').value=todayStr();
  ['attendanceClockIn','attendanceClockOut','attendanceWage','attendanceNotes'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('attendanceSpecial').checked=false;openModal('attendanceModal');
}
async function openAttendanceEditModal(id){
  var records=await DB.getAttendance({}),r=records.find(function(x){return x.id===id;});if(!r)return;
  document.getElementById('attendanceModalTitle').textContent='打刻の修正';document.getElementById('attendanceId').value=r.id;
  var staff=await DB.getStaff(),sel=document.getElementById('attendanceStaff');sel.innerHTML='';
  staff.forEach(function(s){var o=document.createElement('option');o.value=s.id;o.textContent=s.name;if(s.id===r.staff_id)o.selected=true;sel.appendChild(o);});
  document.getElementById('attendanceDate').value=r.date;
  document.getElementById('attendanceClockIn').value=r.clock_in_actual||'';
  document.getElementById('attendanceClockOut').value=r.clock_out_actual||'';
  document.getElementById('attendanceWage').value=r.wage_at_date||'';
  document.getElementById('attendanceSpecial').checked=r.is_special_day||false;
  document.getElementById('attendanceNotes').value=r.notes||'';openModal('attendanceModal');
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
  allStaff.filter(function(s){return s.is_active;}).forEach(function(staff){
    var staffRecords=records.filter(function(r){return r.staff_id===staff.id;});
    var grossPay=0,totalMins=0,workDays=0;
    if(staff.type==='hourly'){staffRecords.forEach(function(r){var mins=calcWorkMinutes(r.clock_in_calc,r.clock_out_calc);totalMins+=mins;if(r.clock_in_actual)workDays++;grossPay+=calcDailyWage(r.clock_in_calc,r.clock_out_calc,r.wage_at_date||staff.wage,r.is_special_day);});}
    else{grossPay=staff.monthly_salary||0;workDays=staffRecords.filter(function(r){return r.clock_in_actual;}).length;}
    var commuteData=calcCommuteAllowance(staff.commute_daily_amount||0,workDays,staff.commute_distance||0);
    var taxableIncome=grossPay+commuteData.taxable;
    var taxRows=staff.tax_type==='otsu'?taxOtsu:taxKou;
    var tax=calcTax(taxableIncome,taxRows,staff.tax_type||'kou',staff.dependents||0);
    var useHealthTable=(staff.health_table_type==='health_nursing')?healthNursingTable:healthTable;
    var pension=getInsuranceAmountByGrade(staff.pension_grade_id,pensionTable);
    var health=getInsuranceAmountByGrade(staff.health_grade_id,useHealthTable);
    var childSupport=getInsuranceAmountByGrade(staff.child_support_grade_id,childSupportTable);
    var empIns=calcEmploymentInsurance(grossPay,staff.employment_insurance);
    var socialDeduction=pension+health+childSupport+empIns;
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
  });
  document.getElementById('payrollGrandTotal').textContent='支給合計: '+formatCurrency(grandTotal);
}
async function showPayslip(staffId,year,month){
  var res=await Promise.all([DB.getStaff(),DB.getAttendance({year:year,month:month,staff_id:staffId}),DB.getTaxTable('kou'),DB.getTaxTable('otsu'),DB.getInsuranceTable('pension'),DB.getInsuranceTable('health'),DB.getInsuranceTable('health_nursing'),DB.getInsuranceTable('child_support')]);
  var allStaff=res[0],records=res[1],taxKou=res[2],taxOtsu=res[3],pensionTable=res[4],healthTable=res[5],healthNursingTable=res[6],childSupportTable=res[7];
  var staff=allStaff.find(function(s){return s.id===staffId;});if(!staff)return;
  var useHealthTable=(staff.health_table_type==='health_nursing')?healthNursingTable:healthTable;
  var grossPay=0,totalMins=0,workDays=0,detailRows='';
  if(staff.type==='hourly'){records.forEach(function(r){var mins=calcWorkMinutes(r.clock_in_calc,r.clock_out_calc);totalMins+=mins;if(r.clock_in_actual)workDays++;var daily=calcDailyWage(r.clock_in_calc,r.clock_out_calc,r.wage_at_date||staff.wage,r.is_special_day);grossPay+=daily;detailRows+='<tr><td>'+formatDateJP(r.date)+'</td><td>'+(r.clock_in_actual||'-')+'</td><td>'+(r.clock_out_actual||'-')+'</td><td>'+(r.clock_in_calc||'-')+'</td><td>'+(r.clock_out_calc||'-')+'</td><td>'+formatWorkTime(mins)+'</td><td>'+(r.is_special_day?'⭐':'')+' '+formatCurrency(r.wage_at_date||staff.wage)+'</td><td>'+formatCurrency(daily)+'</td></tr>';});}
  else{grossPay=staff.monthly_salary||0;workDays=records.filter(function(r){return r.clock_in_actual;}).length;detailRows='<tr><td colspan="8" style="text-align:center;">月額固定給: '+formatCurrency(grossPay)+'</td></tr>';}
  var commuteData=calcCommuteAllowance(staff.commute_daily_amount||0,workDays,staff.commute_distance||0);
  var taxableIncome=grossPay+commuteData.taxable;
  var taxRows=staff.tax_type==='otsu'?taxOtsu:taxKou;
  var tax=calcTax(taxableIncome,taxRows,staff.tax_type||'kou',staff.dependents||0);
  var pension=getInsuranceAmountByGrade(staff.pension_grade_id,pensionTable);
  var health=getInsuranceAmountByGrade(staff.health_grade_id,useHealthTable);
  var childSupport=getInsuranceAmountByGrade(staff.child_support_grade_id,childSupportTable);
  var empIns=calcEmploymentInsurance(grossPay,staff.employment_insurance);
  var netPay=grossPay+commuteData.taxFree-tax-pension-health-childSupport-empIns;
  var age=calcAge(staff.birthdate);
  document.getElementById('payslipContent').innerHTML=
    '<div class="payslip"><div class="payslip-header"><h2>給与明細書</h2><p>'+year+'年'+month+'月分</p></div>'+
    '<div class="payslip-info">'+
    '<div><strong>氏名:</strong> '+staff.name+'</div>'+
    (staff.staff_number?'<div><strong>登録番号:</strong> '+staff.staff_number+'</div>':'')+
    (age!==null?'<div><strong>年齢:</strong> '+age+'歳</div>':'')+
    (staff.address?'<div><strong>住所:</strong> '+staff.address+'</div>':'')+
    '<div><strong>扶養親族:</strong> '+(staff.dependents||0)+'人</div>'+
    '<div><strong>出勤日数:</strong> '+workDays+'日</div>'+
    '</div>'+
    '<div class="table-scroll"><table class="data-table"><thead><tr><th>日付</th><th>出勤(実)</th><th>退勤(実)</th><th>出勤(計)</th><th>退勤(計)</th><th>労働時間</th><th>時給</th><th>日給</th></tr></thead><tbody>'+detailRows+'</tbody></table></div>'+
    '<div class="payslip-summary">'+
    '<div class="summary-row"><span>基本給（税引前）</span><strong>'+formatCurrency(grossPay)+'</strong></div>'+
    (commuteData.total>0?'<div class="summary-row"><span>通勤費（'+workDays+'日×'+formatCurrency(staff.commute_daily_amount||0)+'）</span><span>'+formatCurrency(commuteData.total)+'</span></div>':'')+
    (commuteData.taxable>0?'<div class="summary-row" style="font-size:.8rem;color:#dc2626;"><span>　うち課税分</span><span>'+formatCurrency(commuteData.taxable)+'</span></div>':'')+
    '<div class="summary-row deduction"><span>源泉徴収税</span><span>- '+formatCurrency(tax)+'</span></div>'+
    (pension>0?'<div class="summary-row deduction"><span>厚生年金保険料</span><span>- '+formatCurrency(pension)+'</span></div>':'')+
    (health>0?'<div class="summary-row deduction"><span>健康保険料'+(staff.health_table_type==='health_nursing'?'（介護込み）':'')+'</span><span>- '+formatCurrency(health)+'</span></div>':'')+
    (childSupport>0?'<div class="summary-row deduction"><span>子ども・子育て支援金</span><span>- '+formatCurrency(childSupport)+'</span></div>':'')+
    (empIns>0?'<div class="summary-row deduction"><span>雇用保険料</span><span>- '+formatCurrency(empIns)+'</span></div>':'')+
    '<div class="summary-row total"><span>差引支給額</span><strong class="net-pay">'+formatCurrency(netPay)+'</strong></div>'+
    '</div></div>';
  openModal('payslipModal');
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

function _uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
