const state={month:new Date().toISOString().slice(0,7),user:null,transactions:[],budgets:[],charts:{},editingId:null};
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];

const selectIcons={
  'Food & Dining':'🍽️','Transport':'🚗','Shopping':'🛍️','Bills & Utilities':'💡','Entertainment':'🎬',
  'Health':'❤️','Education':'🎓','Travel':'✈️','Subscriptions':'🔁','Other':'◈',
  'All types':'◈','All categories':'⌘','Income':'↗','Expense':'↘','INR':'₹','USD':'$','EUR':'€','GBP':'£'
};
function initCustomSelects(){
  $$('select').forEach(select=>{
    if(select.closest('.select-shell')) return;
    const shell=document.createElement('div');
    shell.className='select-shell';
    shell.dataset.forSelect=select.id||'';
    select.parentNode.insertBefore(shell,select);
    shell.appendChild(select);
    select.classList.add('native-select');
    const trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='select-trigger';
    trigger.setAttribute('aria-haspopup','listbox');
    trigger.setAttribute('aria-expanded','false');
    const menu=document.createElement('div');
    menu.className='select-menu';
    menu.setAttribute('role','listbox');
    shell.append(trigger,menu);
    const rebuild=()=>{
      menu.innerHTML='';
      [...select.options].forEach((opt,index)=>{
        const item=document.createElement('button');
        item.type='button'; item.className='select-option'; item.dataset.value=opt.value;
        item.setAttribute('role','option'); item.setAttribute('aria-selected',String(opt.selected));
        const icon=document.createElement('span'); icon.className='select-option-icon'; icon.textContent=selectIcons[opt.text]||'•';
        const label=document.createElement('span'); label.className='select-option-label'; label.textContent=opt.text;
        const check=document.createElement('span'); check.className='select-option-check'; check.textContent='✓';
        item.append(icon,label,check); menu.appendChild(item);
        item.addEventListener('click',()=>{
          select.value=opt.value;
          select.dispatchEvent(new Event('change',{bubbles:true}));
          syncCustomSelect(select);
          closeCustomSelect(shell);
        });
      });
      syncCustomSelect(select);
    };
    trigger.addEventListener('click',e=>{e.stopPropagation(); const open=shell.classList.contains('open'); closeAllCustomSelects(); if(!open) openCustomSelect(shell);});
    select.addEventListener('change',()=>syncCustomSelect(select));
    shell._rebuild=rebuild; rebuild();
  });
}
function syncCustomSelect(select){
  const shell=select.closest('.select-shell'); if(!shell) return;
  const trigger=shell.querySelector('.select-trigger'); const menu=shell.querySelector('.select-menu');
  const opt=select.options[select.selectedIndex]; if(!opt||!trigger) return;
  trigger.innerHTML='';
  const icon=document.createElement('span'); icon.className='select-trigger-icon'; icon.textContent=selectIcons[opt.text]||'•';
  const label=document.createElement('span'); label.className='select-trigger-label'; label.textContent=opt.text;
  const chevron=document.createElement('span'); chevron.className='select-trigger-chevron'; chevron.textContent='⌄';
  trigger.append(icon,label,chevron);
  menu?.querySelectorAll('.select-option').forEach(item=>item.setAttribute('aria-selected',String(item.dataset.value===select.value)));
}
function openCustomSelect(shell){shell.classList.add('open');shell.querySelector('.select-trigger')?.setAttribute('aria-expanded','true');}
function closeCustomSelect(shell){shell.classList.remove('open');shell.querySelector('.select-trigger')?.setAttribute('aria-expanded','false');}
function closeAllCustomSelects(){$$('.select-shell.open').forEach(closeCustomSelect)}
document.addEventListener('click',closeAllCustomSelects);

const money=(n)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:state.user?.currency||'INR',maximumFractionDigits:0}).format(Number(n||0));
const dateFmt=(s)=>new Date(s+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
const monthFmt=(s)=>new Date(s+'-01T00:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'});
function toast(msg,err=false){const t=$('#toast');t.textContent=msg;t.className='toast show'+(err?' error':'');setTimeout(()=>t.className='toast',2600)}
async function api(url,options={}){options.headers={...(options.headers||{}),'Content-Type':'application/json','X-CSRF-Token':window.CASHFLOW};const r=await fetch(url,options);if(r.status===401){location.href='/';throw new Error('Session expired');}const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d}
function setView(view){$$('.view').forEach(v=>v.classList.remove('active'));$(`#view-${view}`)?.classList.add('active');$$('.nav-link[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));closeSidebar();if(view==='overview')loadDashboard();if(view==='transactions')loadTransactions();if(view==='budgets')loadBudgets();if(view==='insights')loadInsights();if(view==='settings')loadProfile();}
function goView(view){setView(view)}
$$('.nav-link[data-view]').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));$$('[data-view-target]').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.viewTarget)));
function initials(name){return (name||'U').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}
function closeSidebar(){$('#sidebar').classList.remove('open');$('#sidebarBackdrop').classList.remove('show')}
$('#menuBtn').addEventListener('click',()=>{$('#sidebar').classList.add('open');$('#sidebarBackdrop').classList.add('show')});$('#closeSidebar').addEventListener('click',closeSidebar);$('#sidebarBackdrop').addEventListener('click',closeSidebar);

function setMonth(delta){const [y,m]=state.month.split('-').map(Number);const d=new Date(y,m-1+delta,1);state.month=d.toISOString().slice(0,7);$('#monthLabel').textContent=monthFmt(state.month);loadDashboard();if($('#view-transactions').classList.contains('active'))loadTransactions();if($('#view-budgets').classList.contains('active'))loadBudgets();if($('#view-insights').classList.contains('active'))loadInsights()}
$('#prevMonth').addEventListener('click',()=>setMonth(-1));$('#nextMonth').addEventListener('click',()=>setMonth(1));
function updateHeader(){const now=new Date();$('#todayLabel').textContent=now.toLocaleDateString('en-IN',{month:'long',year:'numeric'}).toUpperCase();$('#monthLabel').textContent=monthFmt(state.month);}
function greet(name){const h=new Date().getHours();return `${h<12?'Good morning':h<18?'Good afternoon':'Good evening'}, ${name.split(' ')[0]}.`}
async function init(){try{const d=await api('/api/me',{headers:{}});state.user=d.user;window.CASHFLOW=d.csrf;$('#profileName').textContent=state.user.name;$('#sidebarName').textContent=state.user.name.split(' ')[0]+' workspace';$('#profileEmail').textContent=state.user.email;$('#avatar').textContent=initials(state.user.name);$('#avatarSmall').textContent=initials(state.user.name);$('#greeting').textContent=greet(state.user.name);updateHeader();await loadDashboard();}catch(e){toast(e.message,true)}}

async function loadDashboard(){const d=await api(`/api/summary?month=${state.month}`);$('#balanceMetric').textContent=money(d.balance);$('#incomeMetric').textContent=money(d.income);$('#expenseMetric').textContent=money(d.expenses);$('#rateMetric').textContent=`${d.savings_rate}%`;$('#incomeHint').textContent=`${d.month_net>=0?'Net +':'Net '}${money(Math.abs(d.month_net))} this month`;$('#expenseHint').textContent=d.expenses?`${d.transaction_count} tracked entries`:'No expenses yet';$('#rateHint').textContent=d.income?'Of this month\'s income':'Add income to see a rate';renderRecent(d.recent);renderCategories(d.categories);renderCashflow(d);renderHealth(d);}
function renderRecent(rows){const el=$('#recentList');if(!rows.length){el.innerHTML='<div class="empty-activity"><b>No recent activity.</b><p>Add an income or expense to start your private ledger.</p><button class="soft-btn" data-action="add">Add transaction</button></div>';el.querySelector('[data-action=add]')?.addEventListener('click',openModal);return}el.innerHTML=rows.map(x=>`<div class="activity-row"><div class="activity-icon">${x.kind==='income'?'↗':'↘'}</div><div class="activity-meta"><b>${escapeHtml(x.note||x.category)}</b><small>${escapeHtml(x.category)} · ${dateFmt(x.date)}</small></div><div class="activity-amt ${x.kind==='income'?'income-text':'expense-text'}">${x.kind==='income'?'+':'-'}${money(x.amount)}</div></div>`).join('')}
function colors(i){return ['#8b75ff','#63e6ff','#ff8a78','#ffbf69','#60dfb3','#b38cff','#f07cc4','#6d7cff','#f2e66c','#78a9ff'][i%10]}
let categoryChart=null,cashflowChart=null,insightChart=null;
function renderCategories(rows){const empty=$('#donutEmpty');if(!rows.length){empty.style.display='flex';$('#categoryList').innerHTML='';if(categoryChart)categoryChart.destroy();return}empty.style.display='none';if(categoryChart)categoryChart.destroy();categoryChart=new Chart($('#categoryChart'),{type:'doughnut',data:{labels:rows.map(x=>x.name),datasets:[{data:rows.map(x=>x.amount),backgroundColor:rows.map((_,i)=>colors(i)),borderWidth:0,spacing:3}]},options:{cutout:'72%',plugins:{legend:{display:false}}}});$('#categoryList').innerHTML=rows.slice(0,5).map((x,i)=>`<div class="category-row"><span><i class="swatch" style="background:${colors(i)}"></i>${escapeHtml(x.name)}</span><b>${money(x.amount)}</b></div>`).join('')}
async function renderCashflow(d){const report=await api(`/api/reports?month=${state.month}`);const has=report.days.some(x=>x.income||x.expense);$('#chartEmpty').style.display=has?'none':'flex';if(cashflowChart)cashflowChart.destroy();if(!has)return;cashflowChart=new Chart($('#cashflowChart'),{type:'line',data:{labels:report.days.map(x=>x.day),datasets:[{label:'Income',data:report.days.map(x=>x.income),borderColor:'#6fe7c2',backgroundColor:'rgba(111,231,194,.08)',fill:true,tension:.35,pointRadius:0},{label:'Expenses',data:report.days.map(x=>x.expense),borderColor:'#8d79ff',backgroundColor:'rgba(141,121,255,.08)',fill:true,tension:.35,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#778194',boxWidth:10,font:{size:10}}}},scales:{x:{grid:{color:'rgba(255,255,255,.03)'},ticks:{color:'#5f6b7d',maxTicksLimit:10}},y:{grid:{color:'rgba(255,255,255,.03)'},ticks:{color:'#5f6b7d',callback:v=>money(v).replace(/\.00$/, '')}}}}});}
function renderHealth(d){let score=0;if(d.income){score+=Math.min(55,d.savings_rate>0?Math.round(d.savings_rate*.55):0)}if(d.transaction_count>=5)score+=15; if(d.expenses===0&&d.income>0)score+=10; let budgetScore=0;const rate=Math.max(0,Math.min(100,d.savings_rate));$('#scoreValue').textContent=d.transaction_count?Math.round(score):'—';$('#scoreRing').style.background=`radial-gradient(circle at center,var(--panel-2) 56%,transparent 57%),conic-gradient(var(--accent) ${score*3.6}deg,rgba(255,255,255,.08) 0deg)`;let badge='Waiting for data', cls='muted', title='Your signal starts here.', text='Once you add a few transactions, Cashflow will summarize your savings behavior without inventing anything.';if(d.transaction_count){if(d.savings_rate>=25){badge='Healthy';cls='good';title='You are keeping a useful margin.';text='Your current month has positive savings momentum. Keep the margin intentional.'}else if(d.savings_rate>=0){badge='Watch';cls='warn';title='You have room to strengthen the margin.';text='Income is covering your tracked expenses, but there is an opportunity to widen the gap.'}else{badge='Under pressure';cls='warn';title='Expenses are outrunning income.';text='Start by reviewing your biggest category and any recurring costs.'}}$('#healthBadge').textContent=badge;$('#healthBadge').className=`badge ${cls}`;$('#healthTitle').textContent=title;$('#healthText').textContent=text;$('#coverageValue').textContent=d.income?`${Math.max(0,Math.min(100,100-(d.expenses/d.income*100)).toFixed(0))}%`:'0%';$('#coverageBar').style.width=d.income?`${Math.max(0,Math.min(100,100-d.expenses/d.income*100))}%`:'0%';$('#budgetValue').textContent=`${budgetScore}%`;$('#budgetBar').style.width=`${budgetScore}%`}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[c]));}

async function loadTransactions(){const d=await api(`/api/transactions?month=${state.month}`);state.transactions=d.transactions;renderTransactions();}
function renderTransactions(){const q=$('#transactionSearch').value.trim().toLowerCase();const kind=$('#transactionKind').value;const cat=$('#transactionCategory').value;const rows=state.transactions.filter(x=>(kind==='all'||x.kind===kind)&&(cat==='all'||x.category===cat)&&(!q||`${x.note} ${x.category}`.toLowerCase().includes(q)));const body=$('#transactionsBody');const empty=$('#transactionsEmpty');body.innerHTML=rows.map(x=>`<tr><td>${dateFmt(x.date)}</td><td><span class="detail-main">${escapeHtml(x.note||x.category)}</span><span class="detail-sub">${escapeHtml(x.category)}</span></td><td>${escapeHtml(x.category)}</td><td><span class="type-pill ${x.kind}">${x.kind}</span></td><td class="${x.kind==='income'?'income-text':'expense-text'}">${x.kind==='income'?'+':'-'}${money(x.amount)}</td><td><div class="row-actions"><button class="delete-btn" data-edit="${x.id}" title="Edit">✎</button><button class="delete-btn" data-delete="${x.id}" title="Delete">×</button></div></td></tr>`).join('');empty.style.display=rows.length?'none':'block';$$('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteTx(b.dataset.delete)));$$('[data-edit]').forEach(b=>b.addEventListener('click',()=>editTx(b.dataset.edit)));}
$('#transactionSearch').addEventListener('input',renderTransactions);$('#transactionKind').addEventListener('change',renderTransactions);$('#transactionCategory').addEventListener('change',renderTransactions);

function editTx(id){const x=state.transactions.find(t=>String(t.id)===String(id));if(!x)return;state.editingId=x.id;$('#modalTitle').textContent='Edit transaction';$('#formKind').value=x.kind;$$('.seg').forEach(b=>b.classList.toggle('active',b.dataset.kind===x.kind));$('#formAmount').value=x.amount;$('#formCategory').value=x.category;syncCustomSelect($('#formCategory'));$('#formDate').value=x.date;$('#formNote').value=x.note||'';$('#currencyPrefix').textContent=state.user?.currency==='USD'?'$':state.user?.currency==='EUR'?'€':state.user?.currency==='GBP'?'£':'₹';$('#formError').textContent='';$('#modal').classList.remove('hidden')}
async function deleteTx(id){if(!confirm('Delete this transaction?'))return;try{await api(`/api/transactions/${id}`,{method:'DELETE'});toast('Transaction deleted');loadTransactions();loadDashboard();}catch(e){toast(e.message,true)}}

async function loadBudgets(){const d=await api(`/api/budgets?month=${state.month}`);state.budgets=d.budgets;const grid=$('#budgetGrid'),empty=$('#budgetEmpty');if(!state.budgets.length){grid.innerHTML='';empty.style.display='block';return}empty.style.display='none';grid.innerHTML=state.budgets.map(b=>{const pct=Math.min(100,Math.round((b.spent/b.amount)*100));return `<article class="budget-card"><header><div><h3>${escapeHtml(b.category)}</h3><small>${monthFmt(state.month)}</small></div><button class="delete-btn" data-budget-delete="${b.id}">×</button></header><div class="budget-amt"><strong>${money(b.spent)}</strong><span>of ${money(b.amount)}</span></div><div class="budget-progress"><i class="${pct>=100?'over':''}" style="width:${pct}%"></i></div><div class="budget-footer"><span>${pct}% used</span><span>${money(Math.max(0,b.amount-b.spent))} left</span></div></article>`}).join('');$$('[data-budget-delete]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Delete this budget?'))return;await api(`/api/budgets/${b.dataset.budgetDelete}`,{method:'DELETE'});toast('Budget removed');loadBudgets() }));}
function budgetPrompt(){const category=prompt('Category:\n\n'+['Food & Dining','Transport','Shopping','Bills & Utilities','Entertainment','Health','Education','Travel','Subscriptions','Other'].join(', '));if(!category)return;const amount=prompt(`Monthly budget for ${category}:`);if(!amount)return;api('/api/budgets',{method:'POST',body:JSON.stringify({category,amount,month:state.month})}).then(()=>{toast('Budget saved');loadBudgets()}).catch(e=>toast(e.message,true))}
$('#budgetBtn').addEventListener('click',budgetPrompt);$('#budgetBtn2').addEventListener('click',budgetPrompt);

async function loadInsights(){const d=await api(`/api/reports?month=${state.month}`);const has=d.days.some(x=>x.income||x.expense);$('#insightEmpty').style.display=has?'none':'flex';if(insightChart)insightChart.destroy();if(has){insightChart=new Chart($('#insightChart'),{type:'bar',data:{labels:d.days.map(x=>x.day),datasets:[{label:'Income',data:d.days.map(x=>x.income),backgroundColor:'rgba(111,231,194,.65)',borderRadius:6},{label:'Expense',data:d.days.map(x=>x.expense),backgroundColor:'rgba(141,121,255,.65)',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#778194',boxWidth:10,font:{size:10}}}},scales:{x:{grid:{display:false},ticks:{color:'#586477'}},y:{grid:{color:'rgba(255,255,255,.03)'},ticks:{color:'#586477'}}}}});}
const summary=await api(`/api/summary?month=${state.month}`);const cards=[];if(!summary.transaction_count)cards.push(['START HERE','Create your first transaction','Your report will stay intentionally empty until you add real activity.']);else{if(summary.savings_rate>=25)cards.push(['KEEP','Protect the margin',`You are saving ${summary.savings_rate}% of tracked income this month.`]);else if(summary.savings_rate>=0)cards.push(['OPTIMIZE','Find one category to tighten',`Your current margin is ${summary.savings_rate}%. Pick the biggest category and set a budget.`]);else cards.push(['REVIEW','Expenses are ahead of income','Look at the top spending category and any recurring costs before adding new ones.']);if(summary.transaction_count<5)cards.push(['SIGNAL','Add a few more data points',`You have ${summary.transaction_count} tracked transactions. A little more history will make trends more useful.`]);}$('#insightCards').innerHTML=cards.map(c=>`<div class="insight-card"><span>${c[0]}</span><h4>${c[1]}</h4><p>${c[2]}</p></div>`).join('')}

async function loadProfile(){const d=await api('/api/profile');$('#settingsName').value=d.user.name;$('#settingsEmail').value=d.user.email;$('#settingsCurrency').value=d.user.currency;syncCustomSelect($('#settingsCurrency'))}
$('#profileForm').addEventListener('submit',async e=>{e.preventDefault();try{const d=await api('/api/profile',{method:'PUT',body:JSON.stringify({name:$('#settingsName').value,currency:$('#settingsCurrency').value})});state.user=d.user;$('#profileName').textContent=d.user.name;$('#sidebarName').textContent=d.user.name.split(' ')[0]+' workspace';$('#avatar').textContent=initials(d.user.name);$('#avatarSmall').textContent=initials(d.user.name);$('#settingsMsg').textContent='Saved.';setTimeout(()=>$('#settingsMsg').textContent='',2000);toast('Profile updated');}catch(e){toast(e.message,true)}});

function openModal(){state.editingId=null;$('#modalTitle').textContent='Add transaction';$('#transactionForm').reset();syncCustomSelect($('#formCategory'));$('#formDate').value=new Date().toISOString().slice(0,10);$('#formKind').value='expense';$$('.seg').forEach(b=>b.classList.toggle('active',b.dataset.kind==='expense'));$('#currencyPrefix').textContent=state.user?.currency==='USD'?'$':state.user?.currency==='EUR'?'€':state.user?.currency==='GBP'?'£':'₹';$('#formError').textContent='';$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden')}
$('#closeModal').addEventListener('click',closeModal);$('#cancelModal').addEventListener('click',closeModal);$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
$$('.seg').forEach(b=>b.addEventListener('click',()=>{$$('.seg').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#formKind').value=b.dataset.kind}));
$('#transactionForm').addEventListener('submit',async e=>{e.preventDefault();$('#formError').textContent='';try{const payload={kind:$('#formKind').value,amount:$('#formAmount').value,category:$('#formCategory').value,date:$('#formDate').value,note:$('#formNote').value};await api(state.editingId?`/api/transactions/${state.editingId}`:'/api/transactions',{method:state.editingId?'PUT':'POST',body:JSON.stringify(payload)});toast(state.editingId?'Transaction updated':'Transaction saved');closeModal();await loadDashboard();if($('#view-transactions').classList.contains('active'))loadTransactions();}catch(e){$('#formError').textContent=e.message}});
$$('[data-action="add"]').forEach(b=>b.addEventListener('click',openModal));
$('#exportBtn').addEventListener('click',()=>{window.location.href=`/api/export.csv?month=${state.month}`});
$('#logoutBtn').addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST'});location.href='/';}catch(e){toast(e.message,true)}});

initCustomSelects();
init();
