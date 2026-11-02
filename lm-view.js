/* ═══════════════════════════════════════════════════════════════
   CLT Scoreboard — SHARED VIEW (single source of truth)
   Loaded by BOTH the owner Command Deck (index.html) and the LM/AM
   phone app (lm.html). Pure render functions over a built model.
   Host supplies glue globals: lmGo(person,lens,metric), css(var),
   and (deck only) RAW/route/scopeToLM. RAW-absent paths degrade
   gracefully (team picker / company-goal / benchmark simply hide).
   ═══════════════════════════════════════════════════════════════ */
const lmNum=v=>(v==null||isNaN(v))?'—':Math.round(v).toLocaleString();
const lmMin=v=>(v==null||isNaN(v))?'—':(Math.round(v*10)/10).toLocaleString()+'m';
const lmSpd=v=>(v==null||isNaN(v))?'—':Math.round(v).toLocaleString()+' min';
const lmPctF=v=>(v==null||isNaN(v))?'—':(v*100).toFixed(0)+'%';
const lmMoney=v=>'$'+Math.round(v||0).toLocaleString();
/* PAY IS HIDDEN (D-5). Pay after the reorg is undecided and the old math paid the wrong people, so every
   pay figure on the phone and the owner preview sits behind this one switch. It must be a literal true:
   an endpoint from before D1 sends no flag, and hides pay too. The figures stay computed in M.comp. */
const lmPayOn=M=>!!M&&M.payPlanSet===true;
const LM_NOPAY='Pay plan not set';
const lmNoPay=()=>'<div class="lm-coach lm-nopay"><div class="lm-d-h">YOUR MONEY</div><p><b>'+LM_NOPAY+'.</b> Earned, Earmarked, Projected and Potential come back once Michael sets the plan.</p></div>';
const LM_FMT={num:lmNum,min:lmMin,spd:lmSpd,pct:lmPctF};
const LM_TILES=[{k:'calls',label:'Dials',fmt:'num'},{k:'conversations',label:'Conversations ≥75s',fmt:'num'},{k:'qualifying',label:'Qualifying ≥10m',fmt:'num'},{k:'connectRate',label:'Conv Rate (of dials)',fmt:'pct'},{k:'reached',label:'Reached (of tracked leads)',fmt:'pct'},{k:'talkTime',label:'Talk Time',fmt:'min'},{k:'speed',label:'Speed-to-Lead',fmt:'spd',low:true},{k:'leads',label:'New Leads',fmt:'num'},{k:'apptsBooked',label:'Appts Booked',fmt:'num'},{k:'apptsShowed',label:'Appts Showed',fmt:'num'},{k:'offersMade',label:'Offers Made',fmt:'num'},{k:'contractsSigned',label:'Contracts',fmt:'num'},{k:'showRate',label:'Show Rate',fmt:'pct'},{k:'leadToAppt',label:'Lead→Appt',fmt:'pct'},{k:'apptToContract',label:'Appt→Contract',fmt:'pct'}];
const LM_LENSES=[['today','Today'],['week','Week'],['month','Month'],['quarter','Quarter']];
const LM_PRIOR={today:'prior day',week:'last week',month:'last month',quarter:'last quarter',ytd:'last yr'};
const LM_LBL={today:'Today',week:'this week',month:'this month',quarter:'this quarter',ytd:'YTD'};
const LM_UNIT={today:'day',week:'week',month:'month',quarter:'quarter',ytd:'yr'};
const LM_DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const LM_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const lmDateLbl=d=>d?LM_DOW[d.getDay()]+' '+(d.getMonth()+1)+'/'+d.getDate():'';
/* the real current date/time, straight off the device clock — the single source of "now" */
const lmNowLbl=()=>{const d=new Date(),z=n=>(n<10?'0':'')+n;let h=d.getHours();const ap=h<12?'AM':'PM';h=h%12||12;return LM_DOW[d.getDay()]+', '+LM_MON[d.getMonth()]+' '+d.getDate()+' · '+h+':'+z(d.getMinutes())+':'+z(d.getSeconds())+' '+ap;};
/* honest relative label for an anchored data day vs real today */
const lmRel=a=>{if(!a)return 'Today';const t=LMEngine.sod(new Date()).getTime(),s=LMEngine.sod(a).getTime(),dd=Math.round((t-s)/864e5);return (dd===0?'Today':dd===1?'Yesterday':'Latest')+' · '+lmDateLbl(a);};
/* tick the live device clock every second wherever #lm-clock is on screen */
try{setInterval(function(){var el=document.getElementById('lm-clock');if(el)el.textContent=lmNowLbl();},1000);}catch(e){}
/* the four call-quality tiers, each labeled by its DURATION (not a jargon name) — longer = better */
const LM_CALLQ=[['connected','Pickups','any answer'],['conversations','Conversation','≥75s'],['deepConv','Deep','≥3 min'],['qualifying','Qualifying','≥10 min']];
const LM_CALLKEYS={connected:1,conversations:1,deepConv:1,qualifying:1};
const LM_XTILES={connected:{k:'connected',label:'Pickups (any answer, incl. voicemail)',fmt:'num'},deepConv:{k:'deepConv',label:'Deep ≥3 min',fmt:'num'}};
const lmTileDef=k=>LM_TILES.find(t=>t.k===k)||LM_XTILES[k]||{k:k,label:k,fmt:'num'};
function lmCallLadder(M,lens,key){var L=M.lenses[lens];return '<div class="lm-qh">Call-quality ladder · '+LM_LBL[lens]+' · longer call = better</div><div class="lm-ladder">'+LM_CALLQ.map(function(c){var lm=L[c[0]],v=lm?lm.current:0;return '<button class="lm-lad'+(c[0]===key?' on':'')+'" onclick="lmGo(\''+M.person+'\',\''+lens+'\',\''+c[0]+'\')"><span>'+c[2]+'</span><b>'+lmNum(v)+'</b></button>';}).join('<i>›</i>')+'</div>';}
const lmPaceCls=s=>s==='ahead'?'lm-ahead':s==='on'?'lm-on':s==='behind'?'lm-behind':'lm-none';
/* no value this period = no read: the engine's comparePct is then -100%, which is not a drop */
const lmPctOf=lm=>lm.current==null?null:lm.comparePct;
/* D-10: AM credit on Offers and Contracts is new (older rows carry AM = Michael, history is left as it is), so the AM
   view's counts are true but its past is empty by design. Measured against that past, a first few rows read as a record
   and a jump. So no badge, pace colour, % change or rails on these tiles until D2's AM tiles replace them. */
const LM_NOHIST={offersMade:1,contractsSigned:1,apptToContract:1};
const lmNoHist=(M,k)=>!!M&&M.dealRole==='AM'&&LM_NOHIST[k]===1;
const LM_NOHIST_TXT='AM credit only · no comparison yet';
function lmDeltaOf(lm,low){return lm.current==null?'<span class="lm-flat">— no data</span>':lmDelta(lm.comparePct,low);}
function lmDelta(p,low){if(p==null||!isFinite(p))return '<span class="lm-flat">— no prior</span>';const up=p>=0,good=low?!up:up;return '<span class="'+(good?'lm-up':'lm-dn')+'">'+(up?'▲':'▼')+' '+Math.abs(p*100).toFixed(0)+'%</span>';}
/* Zero-baselined mini bars. pct=true → fixed 0–100% scale (all ratio tiles
   comparable); else scale 0→series max (honest height, real zero baseline). */
function lmSpark(trend,pct){
  const vs=trend.map(t=>(t.value==null||isNaN(t.value))?0:t.value);
  if(!vs.length)return '<svg class="lm-spark" viewBox="0 0 100 28"></svg>';
  let mx=pct?1:Math.max(0,...vs); if(mx<=0)mx=1;
  const n=vs.length,bw=100/n,gap=Math.min(2.2,bw*0.3);let r='';
  for(let i=0;i<n;i++){const raw=(vs[i]/mx)*23,h=vs[i]>0?Math.max(0.8,raw):0,x=i*bw+gap/2,y=25.5-h;r+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+Math.max(0.5,bw-gap).toFixed(1)+'" height="'+h.toFixed(1)+'" rx="0.5"/>';}
  return '<svg class="lm-spark" viewBox="0 0 100 28" preserveAspectRatio="none"><line x1="0" y1="25.5" x2="100" y2="25.5" class="lm-base"/>'+r+'</svg>';
}
function lmLensBar(person,lens,metric){metric=metric||'';return '<div class="lm-seg">'+LM_LENSES.map(l=>'<button class="'+(lens===l[0]?'on':'')+'" onclick="lmGo(\''+person+'\',\''+l[0]+'\',\''+metric+'\')">'+l[1]+'</button>').join('')+'</div>';}
const LM_EARN={earned:1,earmarked:1,projected:1,potential:1};
function lmComp(M,person,lens){if(!lmPayOn(M))return lmNoPay();const c=M.comp,s=(l,v,cls,sub,b)=>'<button class="lm-cstat '+(cls||'')+'" onclick="lmGo(\''+person+'\',\''+lens+'\',\''+b+'\')"><div class="lm-cl">'+l+'</div><div class="lm-cv">'+v+'</div><div class="lm-cs">'+(sub||'')+'</div></button>';return '<section class="lm-comp">'+s('Earned',lmMoney(c.earned),'gr',c.earnedDeals.length+' closed','earned')+s('Earmarked',lmMoney(c.earmarked),'br',c.earmarkedDeals.length+' under contract','earmarked')+s('Projected',lmMoney(c.projected),'',c.projectedDeals.length+' pre-contract','projected')+s('Potential',lmMoney(c.potential),'',c.openOffers.length+' offers out','potential')+'</section>';}
/* both rails on the tile face: trailing average (the bar to beat) + fixed target (from LM Targets), formatted by metric type */
/* rail formatter: counts show 1 decimal when small/fractional (so a scaled daily target like 0.5 doesn't round to 0) */
function lmRailN(t,v){if(v==null)return null;if(t.fmt==='num')return (v>0&&v<10)?(Math.round(v*10)/10).toLocaleString():lmNum(v);return LM_FMT[t.fmt](v);}
function lmTileBars(lm,t){var g=lm.game,a=(lm.bar==null)?null:lmRailN(t,lm.bar),tg=(g&&g.bars&&g.bars.target!=null)?lmRailN(t,g.bars.target):null;if(a==null&&tg==null)return '';var p=[];if(a!=null)p.push('avg <b>'+a+'</b>');if(tg!=null)p.push('🎯 <b>'+tg+'</b>');return '<div class="lm-t-bars">'+p.join('<i>·</i>')+'</div>';}
function lmTile(M,person,lens,t){const lm=M.lenses[lens][t.k];if(!lm)return '';const g=lm.game,nh=lmNoHist(M,t.k);let badge='';if(!nh&&g&&g.streak&&g.streak.current>=2)badge='<span class="lm-badge fire">🔥'+g.streak.current+'</span>';if(!nh&&g&&g.pr&&g.pr.isRecord)badge='<span class="lm-badge pr">PR</span>';const pc=nh?'lm-none':lmPaceCls(lm.paceState);return '<button class="lm-tile '+pc+'" onclick="lmGo(\''+person+'\',\''+lens+'\',\''+t.k+'\')"><div class="lm-t-top"><span class="lm-t-lbl">'+t.label+'</span>'+badge+'</div><div class="lm-t-val">'+LM_FMT[t.fmt](lm.current)+'</div><div class="lm-t-spark '+pc+'">'+lmSpark(lm.trend,t.fmt==='pct')+'</div><div class="lm-t-foot">'+(nh?'<span class="lm-flat">'+LM_NOHIST_TXT+'</span>':lmDeltaOf(lm,t.low)+' <span>vs '+LM_PRIOR[lens]+'</span>')+'</div>'+(nh?'':lmTileBars(lm,t))+'</button>';}
function lmStreakHL(M,lens){let best=null;['calls','leads','apptsBooked','apptsShowed','talkTime'].forEach(k=>{const lm=M.lenses[lens][k];if(!lm||!lm.game)return;const s=lm.game.streak;if(s&&s.current>=1&&(!best||s.current>best.cur))best={k:k,cur:s.current};});if(!best)return '<div class="lm-hl-streak none">No active streak '+LM_LBL[lens]+' — start one.</div>';return '<div class="lm-hl-streak"><span class="fire">🔥</span><b>'+best.cur+' '+LM_UNIT[lens]+(best.cur>1?'s':'')+'</b> above your '+lmTileDef(best.k).label.toLowerCase()+' pace</div>';}
function lmPaceDay(M){const t=M.lenses.today.calls,d=t.anchorDate,bar=t.bar,when=lmRel(d);let tail='';if(bar!=null)tail=t.current>=bar?' · <span class="lm-up">+'+Math.round(t.current-bar)+' vs avg</span>':' · <span class="lm-dn">'+Math.round(bar-t.current)+' under avg</span>';const note=t.lagged?'latest closed day · today posts tomorrow AM':'today so far';return '<div class="lm-hl-pace"><div class="lm-pl">PACE THE DAY · '+when+'</div><div class="lm-pv">'+lmNum(t.current)+' calls</div><div class="lm-ps">'+note+' · avg '+(bar==null?'—':lmNum(bar))+tail+'</div></div>';}
function lmPicker(person,team){if(team.length<2)return '<span class="lm-person">'+person+'</span>';return '<select class="lm-person" onchange="lmGo(this.value,\'week\',\'\')">'+team.map(p=>'<option'+(p===person?' selected':'')+'>'+p+'</option>').join('')+'</select>';}
function lmBars(lm,t){const g=lm.game,F=t?function(v){return lmRailN(t,v);}:function(v){return v==null?'—':Math.round(v*10)/10;};let o='<div class="lm-bars"><div class="lm-bar"><span class="lm-bl">Trailing avg</span><span class="lm-bv">'+(lm.bar==null?'—':F(lm.bar))+'</span></div>';o+=(g&&g.bars&&g.bars.target!=null)?'<div class="lm-bar"><span class="lm-bl">🎯 Target</span><span class="lm-bv">'+F(g.bars.target)+'</span></div>':'<div class="lm-bar dim"><span class="lm-bl">🎯 Target</span><span class="lm-bv">not set</span></div>';return o+'</div>';}
function lmDiag(lm,t,lens){const b=[],pc=lmPctOf(lm);if(pc!=null){const up=pc>=0,good=t.low?!up:up;b.push(t.label+' is <b>'+Math.abs(pc*100).toFixed(0)+'% '+(up?'up':'down')+'</b> vs '+LM_PRIOR[lens]+' — '+(good?'right way.':'slipping.'));}if(lm.capped){const c=RATIO2[t.k];b.push('<i>Capped at 100%: '+(c?c[2][0]+' ran ahead of '+c[2][1]:'the count ran ahead of its base')+' in this window.</i>');}if(lm.bar!=null&&lm.paceState!=='none')b.push(lm.paceState==='on'?'On your trailing pace.':(lm.paceState==='ahead'?(t.low?'Faster than':'Above'):(t.low?'Slower than':'Below'))+' your trailing pace.');if(lm.game&&lm.game.pr&&lm.game.pr.toTie)b.push('<b>'+LM_FMT[t.fmt](lm.game.pr.toTie)+'</b> from your record ('+lm.game.pr.best.label+').');if(lm.lagged)b.push('<i>Latest complete day; today is live in GHL.</i>');return b;}
function lmReachPanel(M,lens){const L=M.lenses[lens];const rc=L.reached&&L.reached.reach;if(!rc)return '';const pct=(n,d)=>d?Math.round(n/d*100)+'%':'—';let h='<div class="lm-qh">Reach · diagnostic, not a competition</div><div class="lm-reach card">';
h+='<div class="lm-reach-m"><div class="lm-reach-l">A. LEAD RESPONSE <i>· of '+rc.speedLeads+' speed-tracked leads</i></div><div class="lm-reach-v">touched <b>'+rc.touched+'</b> ('+pct(rc.touched,rc.speedLeads)+') · reached <b>'+rc.connected+'</b> ('+pct(rc.connected,rc.speedLeads)+')</div></div>';
h+='<div class="lm-reach-m"><div class="lm-reach-l">B. DIALING EFFICIENCY <i>· of '+lmNum(rc.dials)+' dials</i></div><div class="lm-reach-v"><b>'+lmNum(rc.trueConnects)+'</b> true connects ('+pct(rc.trueConnects,rc.dials)+')</div></div>';
h+='<div class="lm-reach-m"><div class="lm-reach-l">C. ATTEMPT→CONNECT <i>· of '+rc.touched+' attempted leads</i></div><div class="lm-reach-v"><b>'+rc.connected+'</b> reached ('+pct(rc.connected,rc.touched)+')</div></div>';
if(rc.estimated)h+='<div class="lm-reach-row sub"><span>connects on estimated basis (no dual transcript)</span><b>'+rc.estimated+'</b></div>';
if(rc.inbound.att||rc.cold.att){h+='<div class="lm-reach-row sub"><span>· inbound leads reached</span><b>'+rc.inbound.con+' / '+rc.inbound.att+' ('+pct(rc.inbound.con,rc.inbound.att)+')</b></div>';h+='<div class="lm-reach-row sub"><span>· cold list (MLS) reached</span><b>'+rc.cold.con+' / '+rc.cold.att+' ('+pct(rc.cold.con,rc.cold.att)+')</b></div>';}
if(rc.never.length)h+='<div class="lm-reach-never"><span>Attempted, never connected ('+rc.never.length+') — coaching targets:</span> '+rc.never.slice(0,12).join(', ')+(rc.never.length>12?' +'+(rc.never.length-12)+' more':'')+'</div>';
h+='<div class="lm-reach-never">Reach depends on lead mix (inbound answers; cold lists screen calls) and young leads connect late — diagnose, don\'t race it.</div></div>';return h;}
function lmHome(M,person,lens,team){const role=lmRole(M),am=role==='AM',R=lmTabsNow(M),count=lmBoardCount(R.board,role,person),nav=(l,to,cls)=>'<button class="lm-deals-btn'+(cls?' '+cls:'')+'" onclick="lmGo('+lmJsq(person)+','+lmJsq(lens)+','+lmJsq(to)+')">'+l+' →</button>';
  let h='<div class="lm-head"><div><p class="eyebrow">Scoreboard</p><h1>'+person+'</h1></div>'+lmPicker(person,team)+'</div><div class="lm-clockbar">this device&rsquo;s clock → <span id="lm-clock">'+lmNowLbl()+'</span></div>'+lmComp(M,person,lens);
  if(am)h+=lmDayStrip(M,person,R);
  h+='<div class="sec-h"><h2>Scorecard</h2><span class="tag">'+lmScoreTag(R,'tap a tile')+'</span></div><section class="lm-tiles">'+LM_SCORE_TILES[role].map(id=>lmListTile(M,person,lens,R,id)).join('')+'</section>';
  /* the lens, the streak and the pace of the day are all about dials, and an AM gets no dial coaching */
  if(!am)h+='<div class="sec-h lm-sec2"><h2>Activity</h2><span class="tag">'+LM_LBL[lens]+' · tap a tile</span></div>'+lmLensBar(person,lens)+'<section class="lm-hero">'+lmStreakHL(M,lens)+lmPaceDay(M)+'</section><section class="lm-tiles">'+LM_ACTIVITY_TILES.map(k=>lmTile(M,person,lens,lmTileDef(k))).join('')+'</section>';
  h+=lmTasksBtn(M,person,lens)+nav('💰 Make More Money — your '+(lmPayOn(M)?'earning ':'')+'levers','focus','focusbtn');
  h+=nav('⊞ Deals &amp; Pipeline — '+(count===LM_SOURCE_STALE?count:count+(count===1?' deal':' deals'))+(lmPayOn(M)?' — '+lmMoney(M.comp.totalOpportunity)+' in play':''),'deals');
  if(am)h+=nav('⊟ My book','book');
  return h;}
function lmDetail(M,person,lens,key){if(lmGated(M,key))return lmNotHere(person,lens);const t=lmTileDef(key),lm=M.lenses[lens][key],nh=lmNoHist(M,key),g=nh?null:lm.game;let h='<button class="lm-back" onclick="lmGo(\''+person+'\',\''+lens+'\',\'\')">‹ Scoreboard</button><div class="lm-head"><div><p class="eyebrow">'+(lens==='today'?lmRel(lm.anchorDate):LM_LBL[lens])+'</p><h1>'+t.label+'</h1></div>'+lmLensBar(person,lens,key)+'</div><div class="lm-big '+(nh?'lm-none':lmPaceCls(lm.paceState))+'">'+LM_FMT[t.fmt](lm.current)+'</div><div class="lm-cmp">'+(nh?LM_NOHIST_TXT:lmDeltaOf(lm,t.low)+' vs '+LM_PRIOR[lens]+' ('+(lm.comparisonEst?'~':'')+LM_FMT[t.fmt](lm.comparison)+(lm.comparisonEst?' pace':'')+')')+'</div>'+(nh?'':lmBars(lm,t))+(LM_CALLKEYS[key]?lmCallLadder(M,lens,key):'')+(key==='speed'?'<p class="lm-cap">'+LM_SPEED_CAP+'</p>':'')+(key==='reached'?lmReachPanel(M,lens):'');if(g){h+='<div class="lm-gcards">';if(g.streak)h+='<div class="lm-gc"><div class="lm-gl">Streak</div><div class="lm-gv">'+g.streak.current+'</div><div class="lm-gs">best '+g.streak.best+' '+LM_UNIT[lens]+'s</div></div>';if(g.pr&&g.pr.best)h+='<div class="lm-gc"><div class="lm-gl">Personal record</div><div class="lm-gv">'+LM_FMT[t.fmt](g.pr.best.value)+'</div><div class="lm-gs">'+g.pr.best.label+(g.pr.toTie?' · '+LM_FMT[t.fmt](g.pr.toTie)+' to tie':(g.pr.isRecord?' · NEW 🎉':''))+'</div></div>';if(g.paceToBeat&&g.paceToBeat.remaining!=null&&g.paceToBeat.daysLeft>0){const b=g.paceToBeat;h+='<div class="lm-gc"><div class="lm-gl">Pace to beat '+b.basis+'</div>'+(b.lower?'<div class="lm-gv">'+LM_FMT[t.fmt](b.target)+'</div><div class="lm-gs">'+(b.alreadyBeat?'under it':LM_FMT[t.fmt](b.remaining)+' to cut')+' · '+b.daysLeft+'d left</div>':'<div class="lm-gv">'+(Math.round(b.perDayNeeded*10)/10)+'/day</div><div class="lm-gs">'+LM_FMT[t.fmt](b.remaining)+' over '+b.daysLeft+'d</div>')+'</div>';}h+='</div>';}h+='<div class="card chart-card"><h3>'+t.label+' · '+LM_LBL[lens]+'</h3><p class="sub">'+(RATIO2[key]?'two lines = the counts behind the % (e.g. showed vs booked)':'solid = you · dashed = your avg'+(g&&g.bars&&g.bars.target!=null?' · dotted = target':''))+'</p><div class="chart-wrap" onclick="lmFsOpen()"><canvas id="lmchart"></canvas><span class="chart-expand">⤢ tap to expand</span></div></div><div class="lm-diag"><div class="lm-d-h">READOUT</div>'+(nh?['AM credit on these rows is new, so this counts your rows and compares them to nothing yet.']:lmDiag(lm,t,lens)).map(x=>'<p>'+x+'</p>').join('')+'</div>';h+=lmCoachBlock(M,key)+lmRecList(M,key,lens);return h;}
/* ── records, dual-line ratios, coaching, deals view ── */
/* `as`: the role a record must carry to sit under its tile, so a list always matches the count ('deal' = M.dealRole) */
function inWin(d,w){return !!(d&&d.getTime()>=w.start.getTime()&&d.getTime()<=w.end.getTime());}
function lmWin(M,key,lens){const lm=M.lenses[lens][key],a=(lens==='today'&&lm&&lm.anchorDate)?LMEngine.eod(lm.anchorDate):M.asOf;return LMEngine.lensWindow(a,lens);}
const RECF={
  leads:{r:'leads',d:r=>r.date,det:r=>r.source||''},
  apptsBooked:{r:'appts',as:'LM',f:r=>/confirmed/i.test(r.outcome),d:r=>r.conf,det:r=>r.property||''},
  apptsShowed:{r:'appts',as:'LM',f:r=>/showed/i.test(r.outcome),d:r=>r.dispo,det:r=>r.property||''},
  showRate:{r:'appts',as:'LM',f:r=>/showed|no show/i.test(r.outcome),d:r=>r.dispo,det:r=>r.outcome},
  leadToAppt:{r:'appts',as:'LM',f:r=>/confirmed/i.test(r.outcome),d:r=>r.conf,det:r=>r.property||''},
  apptToContract:{r:'contracts',as:'deal',f:r=>/signed/i.test(r.outcome),d:r=>r.signed,det:r=>r.property||''},
  contractsSigned:{r:'contracts',as:'deal',f:r=>/signed/i.test(r.outcome),d:r=>r.signed,det:r=>r.property||''},
  offersMade:{r:'offers',as:'deal',f:r=>/made/i.test(r.outcome)&&r.made,d:r=>r.made,det:r=>r.property||''},
  speed:{r:'speed',d:r=>r.date,det:r=>Math.round(r.speed)+' min · '+(r.source||'')}
};
const RATIO2={showRate:['apptsShowed','apptsBooked',['Showed','Booked']],leadToAppt:['apptsBooked','leads',['Appts','Leads']],apptToContract:['contractsSigned','apptsShowed',['Contracts','Showed']],connectRate:['conversations','calls',['Conversations','Dials']]};
function lmRecList(M,key,lens){
  const sp=RECF[key];if(!sp||!M.records)return '';
  const w=lmWin(M,key,lens),recs=M.records[sp.r]||[],as=sp.as==='deal'?M.dealRole:sp.as;
  let rows=recs.filter(r=>(!as||LMEngine.hasRole(r,as))&&(!sp.f||sp.f(r))).map(r=>({d:sp.d(r),name:r.name||'—',det:sp.det(r)})).filter(x=>inWin(x.d,w));
  rows.sort((a,b)=>b.d-a.d);
  const head='<div class="lm-rec-h">RECORDS · '+LM_LBL[lens]+' ('+rows.length+')</div>';
  if(!rows.length)return '<div class="lm-reclist">'+head+'<div class="lm-rec none">No records in this window.</div></div>';
  const cap=rows.slice(0,15);
  return '<div class="lm-reclist">'+head+cap.map(x=>'<div class="lm-rec"><div class="lm-rmain"><div class="lm-rn">'+x.name+'</div>'+(x.det?'<div class="lm-rsub">'+x.det+'</div>':'')+'</div><div class="lm-rmetric lm-rd">'+lmDateLbl(x.d)+'</div></div>').join('')+(rows.length>15?'<div class="lm-rec more">+'+(rows.length-15)+' more</div>':'')+'</div>';
}
function lmCoach(M,key){
  const c=M.comp,y=M.lenses.ytd,a2c=y.apptToContract.current||0,l2a=y.leadToAppt.current||0,sr=y.showRate.current||0,perK=(c.avgFee||0)*(c.split||0.1),perShow=a2c*perK,perAppt=sr*perShow,P=v=>lmPctF(v);
  const L={
    calls:'Dials feed the funnel. At your '+P(l2a)+' Lead→Appt rate, ~'+(l2a?Math.round(1/l2a):'—')+' leads worked ≈ 1 appt — volume here is what creates everything downstream.',
    conversations:'Real conversations (≥75s) are the ONE call metric that matters — no-answers and voicemails don’t count. Each one is a chance to book; lift this and appts follow.',
    connectRate:'Of every dial, how many become a real ≥75s conversation. Yours is the leading quality signal — better openers turn more pickups into talks without dialing more.',
    qualifying:'Qualifying calls (≥10 min) are the premium avenue — a real discovery conversation. These convert to appts/offers far above any other call. Few and high-value: protect and grow them.',
    outbound:'Outbound is your controllable input. More dials → more conversations → more appts at your '+P(l2a)+' booking rate.',
    talkTime:'Talk time = conversation quality. Deeper conversations lift your booking rate (now '+P(l2a)+').',
    leads:'Each lead worked is worth ~'+lmMoney(l2a*perShow)+' to you (book '+P(l2a)+' → show '+P(sr)+' → contract '+P(a2c)+' × $'+Math.round(perK)+'/contract).',
    apptsBooked:'Every booked appt ≈ '+lmMoney(perAppt)+' to you (show '+P(sr)+' × contract '+P(a2c)+' × $'+Math.round(perK)+'). Book more, earn more.',
    apptsShowed:'A show is ~'+lmMoney(perShow)+' to you at your '+P(a2c)+' contract rate. Getting them to show is the unlock — speed-to-lead drives it.',
    showRate:'Show rate is a money lever: each appt that actually shows ≈ '+lmMoney(perShow)+'. The #1 driver of shows is fast first-touch — see Speed.',
    speed:'Faster first-touch lifts shows. Your YTD avg is '+Math.round(y.speed.current||0)+' clock min; the first-call rule is 30 working minutes. Every extra show ≈ '+lmMoney(perShow)+' to you.',
    leadToAppt:'Booking rate sets appt volume. At '+P(a2c)+' Appt→Contract and $'+Math.round(perK)+'/contract, each appt you book ≈ '+lmMoney(perAppt)+'.',
    apptToContract:'Your highest-$ lever: each contract ≈ $'+Math.round(perK)+' to you. Lifting Appt→Contract from '+P(a2c)+' compounds across every show you get.',
    offersMade:'Offers out become money once they go Under Contract — each ≈ $'+Math.round(perK)+' to you at the avg fee.',
    contractsSigned:'A signed contract is real money pending close — your '+lmMoney(perK)+' cut earmarks the moment its dispo goes Under Contract.'
  };
  // the same levers with no pay figure in them, until a plan is set
  const N={
    leads:'Each lead worked feeds the funnel: book '+P(l2a)+' → show '+P(sr)+' → contract '+P(a2c)+'.',
    apptsBooked:'Book more: '+P(sr)+' of booked appts show and '+P(a2c)+' of shows reach a contract.',
    apptsShowed:'Getting them to show is the unlock: '+P(a2c)+' of shows reach a contract, and speed-to-lead drives it.',
    showRate:'The #1 driver of shows is fast first-touch — see Speed.',
    speed:'Faster first-touch lifts shows. Your YTD avg is '+Math.round(y.speed.current||0)+' clock min; the first-call rule is 30 working minutes.',
    leadToAppt:'Booking rate sets appt volume, and '+P(a2c)+' of shows reach a contract.',
    apptToContract:'Lifting Appt→Contract from '+P(a2c)+' compounds across every show.',
    offersMade:'An offer out becomes a deal once it goes Under Contract.',
    contractsSigned:'A signed contract is a deal pending close.'
  };
  /* role LM: Andrew's coach lines name no offer, no contract and no dollar, with the pay switch on or off. His job ends at the walkthrough */
  const C={
    calls:'Dials feed everything downstream. At your '+P(l2a)+' Lead→Appt rate, ~'+(l2a?Math.round(1/l2a):'—')+' leads worked ≈ 1 appt. The queue sets the dials, not a fixed number a day.',
    conversations:L.conversations,
    connectRate:L.connectRate,
    qualifying:'Qualifying calls (≥10 min) are real discovery conversations, and they book far above any other call. Few and high-value: protect and grow them.',
    outbound:L.outbound,
    talkTime:L.talkTime,
    leads:'Each lead worked feeds your walkthroughs: book '+P(l2a)+' → show '+P(sr)+'.',
    apptsBooked:'Book more: '+P(sr)+' of booked appts show.',
    apptsShowed:'Getting them to show is the unlock, and the first call drives it.',
    showRate:N.showRate,
    speed:N.speed,
    leadToAppt:'Booking rate sets appt volume. Every lead worked raises your chance at the next walkthrough.'
  };
  if(lmRole(M)==='LM')return C[key]||'';
  return (!lmPayOn(M)&&N[key])||L[key]||'';
}
function lmCoachBlock(M,key){const x=lmCoach(M,key);return x?'<div class="lm-coach"><div class="lm-d-h">COACH — what moves the number</div><p>'+x+'</p></div>':'';}
function lmDealList(title,deals,noPay){if(!deals||!deals.length)return '';return '<div class="lm-reclist"><div class="lm-rec-h">'+title+' ('+deals.length+')</div>'+deals.map(d=>{
  // A partner-channel deal pays its rev-share on the HUD, so the fee shown here is the
  // GROSS the split is taken on — always name it, or the cut reads like the wrong percent.
  const sub=noPay?(d.stage||''):[d.stage||'',d.est?'est. at avg fee':'',d.partner?'gross fee '+lmMoney(d.fee)+' · CLT receives '+lmMoney(d.net):''].filter(Boolean).join(' · ');
  return '<div class="lm-rec"><div class="lm-rmain"><div class="lm-rn">'+d.name+'</div>'+(sub?'<div class="lm-rsub">'+sub+'</div>':'')+'</div>'+(noPay?'':'<div class="lm-rmetric lm-rd br">'+(d.est?'~':'')+lmMoney(d.cut)+'</div>')+'</div>';}).join('')+'</div>';}
/* Partner-rate alarm. A deal whose close date falls outside every rate term has NO
   defensible gross — the sheet refuses to guess and so does this. Show the deal by
   name and omit it from the money, never fold it in at a stale rate. */
function lmRateAlarm(c){const e=(c&&c.rateErrors)||[];if(!e.length)return '';
  return '<div class="lm-reclist"><div class="lm-rec-h">⚠ Excluded — no partner rate on file ('+e.length+')</div>'+
    e.map(x=>'<div class="lm-rec"><div class="lm-rmain"><div class="lm-rn">'+x.name+'</div><div class="lm-rsub">'+x.msg+'</div></div><div class="lm-rmetric lm-rd">—</div></div>').join('')+'</div>';}
function lmOfferList(title,offers,noPay){if(!offers||!offers.length)return '';return '<div class="lm-reclist"><div class="lm-rec-h">'+title+' ('+offers.length+')</div>'+offers.map(o=>'<div class="lm-rec"><div class="lm-rmain"><div class="lm-rn">'+o.name+'</div>'+(o.property?'<div class="lm-rsub">'+o.property+'</div>':'')+'</div>'+(noPay?'':'<div class="lm-rmetric lm-rd">~'+lmMoney(o.est)+'</div>')+'</div>').join('')+'</div>';}
/* Per-bucket earnings view — opened from a comp card. Focuses on ONE stage of
   money (Earned/Earmarked/Projected/Potential): its $, the exact deals/offers
   in it, and how it advances. Separate from the Funnel & Money (Deals) page. */
const LM_EARN_ORDER=['potential','projected','earmarked','earned'];
function lmEarnView(M,person,lens,bucket){
  if(!lmPayOn(M))return '<button class="lm-back" onclick="lmGo(\''+person+'\',\''+lens+'\',\'\')">‹ Scoreboard</button>'+lmNoPay();
  const c=M.comp,sp=lmPctF(c.split||0.1);
  const cfg={
    earned:{label:'Earned',cls:'gr',val:c.earned,deals:c.earnedDeals,kind:'deal',sub:'Closed deals — money in hand. Your '+sp+' of each closed wholesale fee.',empty:'No closed deals yet. Earmarked deals land here the day they close.'},
    earmarked:{label:'Earmarked',cls:'br',val:c.earmarked,deals:c.earmarkedDeals,kind:'deal',sub:'Signed AND under contract on the dispo side — a buyer is locked. This banks at close.',empty:'Nothing under contract yet. Projected deals move here once a buyer goes Under Contract.'},
    projected:{label:'Projected',cls:'',val:c.projected,deals:c.projectedDeals,kind:'deal',sub:'Signed, but the dispo side isn’t under contract yet — likely, not locked. Becomes Earmarked when a buyer goes Under Contract.',empty:'No signed-but-pre-contract deals right now.'},
    potential:{label:'Potential',cls:'',val:c.potential,deals:c.openOffers,kind:'offer',sub:'Open offers out, estimated at the avg fee × your '+sp+' split until one gets signed.',empty:'No open offers out right now.'}
  };
  const E=cfg[bucket]; if(!E)return '<p class="lede">Unknown earnings stage.</p>';
  let h='<button class="lm-back" onclick="lmGo(\''+person+'\',\''+lens+'\',\'\')">‹ Scoreboard</button>';
  h+='<div class="lm-head"><div><p class="eyebrow">Your money · '+E.label+'</p><h1 class="lm-earn-v '+E.cls+'">'+lmMoney(E.val)+'</h1></div></div>';
  h+='<div class="lm-ladder">'+LM_EARN_ORDER.map(k=>'<button class="lm-lad'+(k===bucket?' on':'')+' '+cfg[k].cls+'" onclick="lmGo(\''+person+'\',\''+lens+'\',\''+k+'\')"><span>'+cfg[k].label+'</span><b>'+lmMoney(cfg[k].val)+'</b></button>').join('<i>›</i>')+'</div>';
  h+='<p class="lede">'+E.sub+'</p>';
  const list=E.kind==='offer'?lmOfferList(E.label+' — offers out',E.deals):lmDealList(E.label,E.deals);
  h+=list||('<div class="lm-reclist"><div class="lm-rec none">'+E.empty+'</div></div>');
  h+=lmRateAlarm(c);
  return h;
}
/* The board is the AM's deal list. While it is not current his page would hold no deal name at all, so the rows the engine already
   has stand in, under their own label. They are comp()'s, which keeps LM rows: his LM credit, not his AM deals, and the label says so. */
function lmNoBoardLists(c){const l=lmDealList('Under contract',c.earmarkedDeals,1)+lmDealList('Signed — pre-contract',c.projectedDeals,1)+lmOfferList('Offers out',c.openOffers,1)+lmDealList('Closed',c.earnedDeals,1);
  return l?'<div class="sec-h lm-sec2"><h2>Your LM deals</h2><span class="tag">from the Contracts and Offers tabs, not the board</span></div>'+l:'';}
function lmDealsView(M,person,lens){
  const c=M.comp,L=M.lenses[lens],pay=lmPayOn(M),am=lmRole(M)==='AM',R=lmTabsNow(M);
  /* an AM's row by the AM tag; his Leads and Booked would count LM rows he no longer has. Role LM stops at Showed */
  const funnel=am?[['Offers Made',L.offersMade.current],['Contracts',L.contractsSigned.current]]:[['Leads',L.leads.current],['Appts Booked',L.apptsBooked.current],['Showed',L.apptsShowed.current]];
  let h='<button class="lm-back" onclick="lmGo(\''+person+'\',\''+lens+'\',\'\')">‹ Scoreboard</button>';
  h+='<div class="lm-head"><div><p class="eyebrow">Deals &amp; Pipeline</p><h1>'+(pay?'Funnel &amp; Money':'Your deals')+'</h1></div>'+lmLensBar(person,lens,'deals')+'</div>';
  h+=lmComp(M,person,lens);
  if(am)h+=lmDayStrip(M,person,R)+lmAmDeals(M,person,R);
  h+='<div class="sec-h lm-sec2"><h2>Funnel</h2><span class="tag">'+LM_LBL[lens]+'</span></div><div class="lm-funnel">'+funnel.map(f=>'<div class="lm-frow"><span class="lm-fl">'+f[0]+'</span><span class="lm-fv">'+lmNum(f[1])+'</span></div>').join('')+'</div>';
  if(!am)return h+lmWithList(person,R);
  if(!pay)return R.board.ok?h:h+lmNoBoardLists(c);
  h+=lmDealList('Under contract — earmarked',c.earmarkedDeals)+lmDealList('Projected — pre-contract',c.projectedDeals)+lmOfferList('Offers out — potential',c.openOffers);
  if(c.earnedDeals.length)h+=lmDealList('Closed — earned',c.earnedDeals);
  h+=lmRateAlarm(c);
  return h;
}
/* ── Focus On: backsolve company goal → required volumes + biggest $ lever ── */
const lmR=(n,d)=>{const f=Math.pow(10,d||0);return Math.round((+n||0)*f)/f;};
function lmFocus(M){
  const g=M.goals||{},y=M.lenses.ytd,avgDeal=+g.avgWholesaleFee||20000,split=M.comp.split||0.1;
  let monthGoal=0;const GA=(typeof RAW!=='undefined'&&RAW['Goals & Assumptions'])||[];
  for(let i=0;i<GA.length;i++){if(String(GA[i][0]||'').toLowerCase().indexOf('monthly revenue goal')>-1){monthGoal=parseFloat(String(GA[i][1]).replace(/[^0-9.]/g,''))||0;break;}}
  const a2c=y.apptToContract.current||(+g.apptToContract||0.5),sr=y.showRate.current||0.6,l2a=y.leadToAppt.current||(+g.leadToAppt||0.15),tA2C=+g.apptToContract||0.5;
  // what each funnel step is worth to the LM (their split on an avg deal)
  const perDeal=avgDeal*split,perShow=a2c*perDeal,perBooked=sr*perShow,perLead=l2a*perBooked;
  const cpb=(y.apptsBooked.current>0)?y.calls.current/y.apptsBooked.current:null,perDial=cpb?perBooked/cpb:null;
  const start=M.startDate||M.asOf,wks=Math.max(1,(M.asOf-start)/6048e5);
  // his ACTUAL current pace — the baseline every sprint is measured against
  const bookedYtd=y.apptsBooked.current||0,callsYtd=y.calls.current||0,showsYtd=y.apptsShowed.current||0,leadsYtd=(y.leads&&y.leads.current)||0;
  const apptsWk=bookedYtd/wks,dialsDay=callsYtd/(wks*5),showsWk=showsYtd/wks,leadsWk=leadsYtd/wks;
  const dealsMo=(monthGoal&&avgDeal)?monthGoal/avgDeal:0;
  const needShows=a2c?dealsMo/a2c:0,needBooked=(a2c&&sr)?dealsMo/a2c/sr:0,needLeads=(a2c&&sr&&l2a)?dealsMo/a2c/sr/l2a:0,needDials=cpb?needBooked*cpb:null;
  return {avgDeal:avgDeal,split:split,perDeal:perDeal,perShow:perShow,perBooked:perBooked,perLead:perLead,perDial:perDial,a2c:a2c,sr:sr,l2a:l2a,tA2C:tA2C,cpb:cpb,apptsWk:apptsWk,dialsDay:dialsDay,showsWk:showsWk,leadsWk:leadsWk,tL2A:(+g.leadToAppt||0.15),monthGoal:monthGoal,dealsMo:dealsMo,needShows:needShows,needBooked:needBooked,needLeads:needLeads,needDials:needDials,lmShareMo:dealsMo*perDeal};
}
/* Talk-time-per-call benchmark: this LM vs Michael's pre-hire bar. PERSON-DRIVEN —
   passing the name in is what lets a second LM see their own bar. A literal here
   meant any other LM silently scored 0 calls and the whole block vanished. */
function lmBench(person){
  if(typeof RAW==='undefined'||!RAW['Calls']||!person)return null;
  const C=RAW['Calls'],h=C[0],ui=h.findIndex(x=>String(x).toLowerCase().trim()==='user'),tci=h.findIndex(x=>/total calls/i.test(x)),tti=h.findIndex(x=>/total talk/i.test(x));
  const cut=new Date(2026,3,22);let jt=0,jc=0,mt=0,mc=0;
  for(let i=1;i<C.length;i++){const u=String(C[i][ui]||''),d=LMEngine.parseDate(C[i][0]),tc=+C[i][tci]||0,tt=+C[i][tti]||0;
    if(u===person){jt+=tt;jc+=tc;}else if(u==='Michael Fichman'&&d&&d<cut){mt+=tt;mc+=tc;}}
  return {j:jc?jt/jc:null,m:mc?mt/mc:null,jc:jc,mc:mc};
}
/* Living lever library — every item computed off f (his live rates).
   Each returns {key,title,now,goal,diff(1=Easy/2=Med/3=Hard),dollars(ADDED $),when,est?}.
   Levers with no gain (target already beaten) self-prune, so the queue tracks his real performance. */
function lmLevers(f,M){
  const CLOSE=45,wk=4.333,mo=21.7,D=864e5,asOf=M.asOf;
  const cashBy=d=>{try{return new Date(asOf.getTime()+d*D).toLocaleDateString('en-US',{month:'short',day:'numeric'});}catch(e){return'';}};
  const when=(d,pfx)=>(pfx||'banks ~by ')+cashBy(d+CLOSE)+' · '+CLOSE+'-day closes';
  const bookedMo=f.apptsWk*wk,leadsMo=(f.leadsWk||0)*wk;
  const showT=Math.min(1,Math.max(f.sr+0.1,0.75)),l2aT=Math.max(f.l2a+0.05,f.tL2A||0.15);
  const aimWk=Math.max(Math.ceil(f.apptsWk)+1,Math.round(f.apptsWk*2||2)),aimD=Math.round(f.dialsDay*1.5);
  const P=[
    {key:'appts',title:'Book more appointments',now:'You average '+lmR(f.apptsWk,1)+' booked/wk',goal:'Book '+Math.round(aimWk*3)+' over 3 weeks ('+aimWk+'/wk)',diff:2,dollars:(aimWk-f.apptsWk)*3*f.perBooked,when:when(21)},
    {key:'dials',title:'Turn up the dials',now:'You make '+lmR(f.dialsDay,0)+' dials/day',goal:'Hit '+aimD+'/day for a month (+'+lmR(aimD-f.dialsDay,0)+')',diff:1,dollars:Math.max(0,(aimD-f.dialsDay))*mo*f.perDial,when:when(30)},
    {key:'showrate',title:'Cut your no-shows',now:lmPctF(f.sr)+' of booked actually show',goal:'Confirm harder → '+lmPctF(showT)+' show up',diff:2,dollars:bookedMo*Math.max(0,showT-f.sr)*f.perShow,when:when(30)},
    {key:'l2a',title:'Book a bigger slice of leads',now:lmPctF(f.l2a)+' of leads become appts',goal:'Work them to '+lmPctF(l2aT),diff:3,dollars:leadsMo*Math.max(0,l2aT-f.l2a)*f.perBooked,when:when(35)},
    {key:'sat',title:'Work your Saturdays',now:'You run a 5-day week',goal:'Add 4 Saturdays of your normal pace',diff:2,dollars:(f.apptsWk/5)*4*f.perBooked,when:when(30)},
    {key:'speed',title:'Call new leads in 30 working minutes',now:'Speed-to-lead drives booking',goal:'Be first to every fresh lead',diff:1,dollars:leadsMo*0.05*f.perBooked,when:when(30),est:1},
    {key:'talk',title:'Win the conversation',now:'Better calls book more',goal:'Earn ~1 extra appt/week on connect quality',diff:1,dollars:1*wk*f.perBooked,when:when(25),est:1},
    {key:'nozero',title:'Kill your zero-call days',now:'Slow days bleed pipeline',goal:'Hit your dial average every working day',diff:1,dollars:f.dialsDay*2*f.perDial,when:when(30),est:1},
    {key:'confirm',title:'Confirm every appointment',now:'A reminder text saves shows',goal:'Recover ~10% of would-be no-shows',diff:1,dollars:bookedMo*0.10*f.perShow,when:when(30),est:1},
    {key:'sustain',title:'Lock in +1 appt/week',now:'Small bump, compounded',goal:'Hold +1 booked/wk for 3 months',diff:2,dollars:1*wk*3*f.perBooked,when:when(90,'fully banks ~by ')}
  ];
  // effort weeks per lever → drives $/week-of-effort so the pin is the most EFFICIENT lever, not just the biggest total
  const EW={appts:3,dials:4.33,showrate:4.33,l2a:4.33,sat:4.33,speed:4.33,talk:4.33,nozero:4.33,confirm:4.33,sustain:13};
  // monthly STRETCH phrasing — used only when a lever is pinned as the month's big goal (sustain it all month = bigger, harder)
  const MG={appts:'Hit '+aimWk+' booked every week, all month',dials:'Hold '+aimD+'/day for the entire month',showrate:'Get '+lmPctF(showT)+' of booked to show, all month',l2a:'Convert '+lmPctF(l2aT)+' of every lead this month',sat:'Work all 4 Saturdays this month',speed:'Be first to every fresh lead, all month',talk:'Win every conversation this month',nozero:'No zero-call days the whole month',confirm:'Confirm every appointment this month',sustain:'Lock +1/wk and hold it all quarter'};
  return P.filter(function(l){return l.dollars && isFinite(l.dollars) && l.dollars>=1;}).map(function(l){l.dollars=Math.round(l.dollars);l.ew=EW[l.key]||4.33;l.rate=l.dollars/l.ew;l.mdollars=Math.round(l.rate*4.33);l.mdiff=Math.min(3,l.diff+1);l.mg=MG[l.key]||'Go all-in on this all month';l.mwhen='banks ~by '+cashBy(30+CLOSE)+' · '+CLOSE+'-day closes';return l;});
}
function lmFocusView(M,person,lens){
  const back=lmBack(person,lmLensSafe(lens));
  /* no plan: the same levers from Role Scorecard, with no dollar anywhere. Every line below this is a dollar figure */
  if(!lmPayOn(M))return back+lmRoleLevers(M,person);
  const f=lmFocus(M),first=String(person||'').split(' ')[0]||'You';
  const pay=(l,v)=>'<div class="lm-pay"><span>'+l+'</span><b>'+lmMoney(v)+'</b></div>';
  const CLOSE_DAYS=45;
  const diffName=['','Easy','Medium','Hard'],diffBadge=d=>'<span class="lm-diff d'+d+'">'+('●'.repeat(d)+'○'.repeat(3-d))+' '+diffName[d]+'</span>';
  const card=(L,pin)=>'<div class="lm-scen'+(pin?' pin':'')+'"><div class="lm-scen-l"><div class="lm-scen-t">'+L.title+' '+diffBadge(L.diff)+(L.est?' <span class="lm-est">est.</span>':'')+'</div><div class="lm-scen-now">'+L.now+'</div><div class="lm-scen-goal">→ '+L.goal+'</div></div><div class="lm-scen-r"><div class="lm-scen-v">+'+lmMoney(L.dollars)+'</div><div class="lm-scen-when">'+L.when+'</div></div></div>';
  let h=back;
  h+='<div class="lm-head"><div><p class="eyebrow">Your money · how to make more of it</p><h1>'+first+'’s earning levers</h1></div></div>';
  h+='<div class="lm-foc"><div class="lm-foc-h">What each step pays YOU — '+lmPctF(f.split)+' of a '+lmMoney(f.avgDeal)+' deal = '+lmMoney(f.perDeal)+'/deal</div><div class="lm-pays">'+pay('Each deal',f.perDeal)+pay('Each show',f.perShow)+pay('Each booked appt',f.perBooked)+pay('Each lead worked',f.perLead)+(f.perDial?pay('Each dial',f.perDial):'')+'</div><p class="lm-foc-sub">Each action has a price tag — but you bank it at <b>close, ~'+CLOSE_DAYS+' days after a deal goes under contract</b>. Today’s work pays out in ~2–3 months.</p></div>';
  // LIVING QUEUE — full lever pool, biggest pinned, the rest rotate daily so the mix stays fresh
  const all=lmLevers(f,M);
  if(all.length){
    let topI=0;for(let i=1;i<all.length;i++){if(all[i].rate>all[topI].rate)topI=i;}
    const top=all[topI],rest=all.filter((_,i)=>i!==topI);
    // pin = the highest-leverage lever, scaled up to a bigger, harder MONTHLY goal — same $ unit as the picks below
    const big={title:top.title,now:top.now,goal:top.mg,diff:top.mdiff,dollars:top.mdollars,when:top.mwhen,est:top.est};
    const doy=Math.floor((M.asOf-new Date(M.asOf.getFullYear(),0,0))/864e5),N=Math.min(4,rest.length),show=[];
    for(let i=0;i<N;i++)show.push(rest[(doy+i)%rest.length]);
    h+='<div class="lm-foc lever"><div class="lm-foc-h">💰 Your earning queue — '+(1+show.length)+' of '+all.length+' levers · refreshes daily</div>';
    h+='<p class="lm-foc-sub">One big monthly goal up top, bite-size picks below — all in dollars you add, banked at close. Rotates daily, re-prices off your live numbers.</p>';
    h+='<div class="lm-q-lbl amber">⚡ This month’s big goal — your highest-leverage push</div>'+card(big,true);
    h+='<div class="lm-q-lbl">More ways to earn — fresh picks today</div>'+show.map(L=>card(L,false)).join('');
    h+='<p class="lm-foc-sub">Each $ is the <b>added</b> money on top of your current pace, banked at close (~'+CLOSE_DAYS+'-day). Come back tomorrow for a new set.</p></div>';
  }
  if(f.monthGoal){h+='<div class="lm-foc"><div class="lm-foc-h">Carry the company goal → '+lmMoney(f.lmShareMo)+'/mo to you</div><p class="lm-foc-sub">'+lmR(f.dealsMo,1)+' deals/mo. The daily pace that gets you paid:</p><table class="lm-foc-t"><tr><th>do</th><th>/mo</th><th>5-day/day</th><th>+Sat/day</th></tr>';
    const row=(l,mo)=>'<tr><td>'+l+'</td><td>'+lmR(mo,1)+'</td><td>'+lmR(mo/21.7,1)+'</td><td>'+lmR(mo/26,1)+'</td></tr>';
    h+=row('Leads worked',f.needLeads)+row('Booked appts',f.needBooked)+row('Showed',f.needShows)+(f.needDials?row('Dials',f.needDials):'')+'</table></div>';}
  const b=lmBench(person);
  if(b&&b.m!=null&&b.j!=null){h+='<div class="lm-foc"><div class="lm-foc-h">Your bar to beat — talk time per call</div><div class="lm-bench"><div class="lm-bn"><span>You</span><b>'+lmR(b.j,2)+'m</b></div><div class="lm-bn"><span>Michael · pre-hire</span><b>'+lmR(b.m,2)+'m</b></div></div><p class="lm-foc-sub">'+(b.j<b.m?'You’re <b>'+lmR(b.m-b.j,2)+'m shorter</b> per call than the pre-hire bar — and each booked appt is <b>'+lmMoney(f.perBooked)+'</b> to you. Better conversations book more appts.':'You’re matching the pre-hire bar on connect quality — keep it up.')+'</p></div>';}
  return h;
}
/* Shared chart mount — host supplies {mk,css}. Used by the deck (VIEWS.lm) AND Jordan's app. */
/* ── tap-to-fullscreen chart: a bigger, interactive version with its own lens
   switcher (change the timeframe in place). Self-contained — own Chart + colors,
   reads the model stashed by the last detail render (LM_FS_CTX). ── */
let LM_FS_CTX=null,LM_FS_CHART=null;
function lmFsCss(v){try{return (getComputedStyle(document.documentElement).getPropertyValue(v)||'').trim()||'#3FD0FF';}catch(e){return '#3FD0FF';}}
function lmFsMk(id,conf){try{if(LM_FS_CHART)LM_FS_CHART.destroy();}catch(e){}var el=document.getElementById(id);if(el&&window.Chart)LM_FS_CHART=new window.Chart(el,conf);}
function lmFsClose(){try{if(LM_FS_CHART){LM_FS_CHART.destroy();LM_FS_CHART=null;}}catch(e){}var h=document.getElementById('lm-fs');if(h)h.innerHTML='';try{document.documentElement.classList.remove('lm-fs-on');}catch(e){}}
function lmFsDraw(lens){if(!LM_FS_CTX)return;const M=LM_FS_CTX.M,metric=LM_FS_CTX.metric,t=lmTileDef(metric),host=document.getElementById('lm-fs');if(!host)return;LM_FS_CTX.lens=lens;
  host.innerHTML='<div class="lm-fs-top"><div class="lm-fs-ttl">'+t.label+' · '+LM_LBL[lens]+'</div><button class="lm-fs-x" onclick="lmFsClose()">✕</button></div>'
    +'<div class="lm-seg lm-fs-seg">'+LM_LENSES.map(l=>'<button class="'+(l[0]===lens?'on':'')+'" onclick="lmFsDraw(\''+l[0]+'\')">'+l[1]+'</button>').join('')+'</div>'
    +'<div class="lm-fs-wrap"><canvas id="lmfschart"></canvas></div>'
    +'<div class="lm-fs-hint">'+(RATIO2[metric]?'two lines = the counts behind the %':'solid = you · dashed = trailing avg · dotted = target')+' — switch the lens above to change the timeframe</div>';
  lmChartMount('lmfschart',M,lens,metric,{mk:lmFsMk,css:lmFsCss});
}
function lmFsOpen(){if(!LM_FS_CTX)return;var host=document.getElementById('lm-fs');if(!host){host=document.createElement('div');host.id='lm-fs';host.className='lm-fs';document.body.appendChild(host);}try{document.documentElement.classList.add('lm-fs-on');}catch(e){}lmFsDraw(LM_FS_CTX.lens||'week');}
function lmChartMount(cv,M,lens,metric,host){var mk=host.mk,css=host.css;try{
  if(lmIsView(metric)||lmGated(M,metric)||!M.lenses[lens]||!Object.prototype.hasOwnProperty.call(M.lenses[lens],metric))return;
  const lm=M.lenses[lens][metric],t=lmTileDef(metric),g=lm.game,gl=css('--glow'),amb=css('--amber'),grn=css('--green'),labels=lm.trend.map(x=>x.label);
  if(cv==='lmchart')LM_FS_CTX={M:M,metric:metric,lens:lens};   // stash for the tap-to-fullscreen view
  const big=cv==='lmfschart', fs=big?13:9, pr=big?4:3;
  // 18% headroom so the target/avg lines sit inside the frame, never jammed at the top
  const opt=(unit)=>({plugins:{legend:{display:true,position:'bottom',labels:{boxWidth:big?16:10,font:{size:fs},padding:big?16:8,usePointStyle:true}}},
    scales:{x:{grid:{display:false},ticks:{font:{size:fs},maxRotation:0,autoSkip:true}},
      y:{beginAtZero:true,grace:'18%',max:unit==='%'?100:undefined,title:{display:true,text:unit,font:{size:fs}},ticks:{font:{size:fs}},grid:{color:'rgba(122,176,230,.08)'}}},
    layout:{padding:{top:big?10:2}},interaction:{intersect:false,mode:'index'},maintainAspectRatio:false});
  if(RATIO2[metric]){
    const cc=RATIO2[metric],nd=lm.trend.map(x=>x.num),dd=lm.trend.map(x=>x.den);   // the ratio's own counts: never another population
    mk(cv,{type:'line',data:{labels:labels,datasets:[
      {label:cc[2][1],data:dd,borderColor:amb,backgroundColor:'transparent',tension:.3,pointRadius:pr,borderWidth:big?2.2:1.6,fill:false,spanGaps:true},
      {label:cc[2][0],data:nd,borderColor:gl,backgroundColor:'rgba(63,208,255,.12)',tension:.3,pointRadius:pr,borderWidth:big?2.8:2,fill:true,spanGaps:true}
    ]},options:opt('count')});
    return;
  }
  const sc=t.fmt==='pct'?100:1,r1=v=>(v==null||isNaN(v))?null:Math.round(v*sc*10)/10,data=lm.trend.map(x=>r1(x.value)),unit=t.fmt==='pct'?'%':(t.fmt==='min'||t.fmt==='spd')?'min':'count';
  let ds;
  {
    ds=[{label:t.label,data:data,borderColor:gl,backgroundColor:'rgba(63,208,255,.12)',fill:true,tension:.3,pointRadius:pr,pointBackgroundColor:gl,borderWidth:big?2.8:2,spanGaps:true}];
    if(lm.bar!=null)ds.push({label:'Your avg',data:labels.map(()=>r1(lm.bar)),borderColor:amb,borderDash:[5,4],pointRadius:0,borderWidth:big?2:1.4,fill:false});
  }
  const tg=(g&&g.bars&&g.bars.target!=null)?(t.fmt==='pct'&&g.bars.target<=1?g.bars.target*100:g.bars.target):null;
  if(tg!=null)ds.push({label:'🎯 Target',data:labels.map(()=>tg),borderColor:grn,borderDash:[2,3],pointRadius:0,borderWidth:big?2.4:1.4,fill:false});
  mk(cv,{type:'line',data:{labels:labels,datasets:ds},options:opt(unit)});
}catch(e){}}
/* ═══════════════════════════════════════════════════════════════
   TASKS & REVIEW (Phase 1) — contract: apps-script/TASKS.md
   Shared by lm.html (the LM app: lmTasksView + the home button) and
   index.html (the owner deck reuses lmTasksParse / lmTaskBuckets).
   The server scopes the rows; the client filters AGAIN (defensive):
   an LM never renders a visibility=owner row or another person's row.
   Writes go through the host: window.LMApp.post(action, fields) —
   fetch POST, text/plain body, redirect:'follow', then reload.
   ═══════════════════════════════════════════════════════════════ */
const LM_TASK_KINDS=['call-seller','text-seller','deliver-number','approve','decide','assign','enforce-lm-law','sit-in','check-in','escalation','walkthrough','follow-up','move-stage','fix-record','offer-owed','counter-owed','coaching','next-step','cadence','self'];
const LM_FLAG_REASONS=[['not-mine','Not mine'],['already-done','Already done'],['wrong-ask','Wrong ask'],['wrong-lead','Wrong lead'],['wrong-fact','Wrong fact'],['wrong-category','Wrong category'],['score-disagree','I disagree with the score'],['voicemail-not-conversation','Voicemail, not a conversation'],['number-input-wrong','A number input is wrong'],['rule-wrong','The rule is wrong'],['other','Other']];
const LM_FLAG_TYPES={task:1,text:1,call:1,deal:1,pulse:1,tracker:1};
const lmEsc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* a JS string literal safe inside a double-quoted onclick attribute */
const lmJsq=s=>"'"+String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,'\\n').replace(/</g,'\\x3c').replace(/&/g,'&amp;').replace(/"/g,'&quot;')+"'";
const lmDomId=s=>'lmt-'+String(s==null?'':s).replace(/[^A-Za-z0-9_-]/g,'_');
const lmPad2=n=>(n<10?'0':'')+n;
const lmDayStr=d=>d.getFullYear()+'-'+lmPad2(d.getMonth()+1)+'-'+lmPad2(d.getDate());   // device-local YYYY-MM-DD
/* the calendar day of a cell: 'YYYY-MM-DD' as-is; an ISO datetime → the device-local day; else '' */
function lmDayOf(v){const s=String(v==null?'':v).trim();if(!s)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const d=new Date(s);return isNaN(d)?'':lmDayStr(d);}
/* epoch ms of a REAL datetime only (a date-only cell Sheets coerced to local midnight is not a time) */
function lmMsOf(v){const s=String(v==null?'':v).trim();if(!s||/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;const d=new Date(s);if(isNaN(d)||(d.getHours()===0&&d.getMinutes()===0&&d.getSeconds()===0))return NaN;return d.getTime();}
/* header row + rows → objects keyed by header name (one parser for every tab of this shape) */
function lmTabObjs(tab){if(!Array.isArray(tab)||!tab.length)return [];const h=(tab[0]||[]).map(x=>String(x==null?'':x).trim()),out=[];for(let i=1;i<tab.length;i++){const r=tab[i]||[],o={};for(let j=0;j<h.length;j++)if(h[j])o[h[j]]=r[j]==null?'':r[j];out.push(o);}return out;}
/* ═══════════ ROLE TABS (D2) — the ONE reader of Role Scorecard and Deal Board ═══════════
   Every phone and owner view reads these two routine-written tabs through here, so there is one
   rule for what counts as current. Either tab can be missing (P4 creates them after this ships; an old
   script sends neither), empty, or a day behind, and each of those reads 'source stale': never a
   blank, a 0, a throw, or an old number passed off as today's.
     lmRoleTabs({tabs, dealBoardAsOf}, now) → {score, board}. The owner passes {tabs: RAW}.
     lmKpi(score, person, id)               → one KPI. Print .shown; a real 0 stays 0.
     lmBoardCount(board, role, person)      → a count, or 'source stale'.
     lmBoardMine(board, role, person)       → that person's rows; [] when the board is stale, so check board.ok.
   A renamed column reads 'source stale' too ('header changed'): the readers take each cell by its exact header name, so a
   rename would otherwise read as a blank on every row, and a fresh stamp would pass that off as nothing past the line.
   Call lmRoleTabs at render, not once at load: staleness depends on the clock, and the app stays open.
   A stale tab hands back no rows, so nothing downstream can show them by mistake. */
const LM_SOURCE_STALE='source stale';
const LM_SHEET_TZ='America/New_York';   // the workbook says America/Nassau, which keeps this same clock
const LM_FRESH_BY_HOUR=9;               // Eastern. The 5 AM nightly has landed by then
let lmSheetFmt=null;
/* `d` on the sheet's clock, on any device: {day:'YYYY-MM-DD', hour}. */
function lmSheetClock(d){try{if(!lmSheetFmt)lmSheetFmt=new Intl.DateTimeFormat('en-CA',{timeZone:LM_SHEET_TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});const p={};lmSheetFmt.formatToParts(d).forEach(x=>{p[x.type]=x.value;});return {day:p.year+'-'+p.month+'-'+p.day,hour:+p.hour};}catch(e){return {day:lmDayStr(d),hour:d.getHours()};}}
/* The calendar day a sheet cell means, 'YYYY-MM-DD'; '' when unreadable. A date as text stands as written. A
   real date cell reaches JSON as a UTC instant (midnight on the sheet = 04:00Z), which lmDayOf reads as the
   day before on a phone west of Eastern, so an instant is read on the sheet's clock instead. */
function lmSheetDay(v){if(typeof v==='number')return '';const s=String(v==null?'':v).trim();if(!s)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/);if(m)return m[3]+'-'+lmPad2(+m[1])+'-'+lmPad2(+m[2]);const d=new Date(s);return isNaN(d)?'':lmSheetClock(d).day;}
const lmDayShift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
/* The oldest scorecard Date still current at `now`. The nightly runs about 5 AM, every day, and writes
   yesterday's date, so yesterday is due from 9 AM; before that the run may just not have finished. */
function lmStaleFloor(now){const c=lmSheetClock(now);return lmDayShift(c.day,c.hour>=LM_FRESH_BY_HOUR?-1:-2);}
const lmNameKey=x=>String(x==null?'':x).trim().toLowerCase();
const lmCellTxt=v=>String(v==null?'':v).trim();
const lmCellOn=v=>/^(true|yes|y|1|red|stale)$/i.test(lmCellTxt(v));
/* a number when it reads as one, text verbatim when it does not, null when blank. A real 0 stays 0. */
const lmCellVal=v=>{const s=lmCellTxt(v);if(!s)return null;const n=Number(s);return isNaN(n)?s:n;};
/* Headers each reader cannot work without. Value only on the owner's board: a phone's row never has one, and `_as` marks that shape.
   Exact names, the way the readers look them up. No header at all is an empty tab, not a rename. */
const LM_SCORE_NEED=['Date','Person','KPI','Value','Target Status','Stale'],LM_BOARD_NEED=['Opp ID','Pipeline','Stage','Days','Red','LM','AM'];
const lmHeadOf=tab=>(tab[0]||[]).map(lmCellTxt);
const lmHeadMiss=(head,need)=>head.some(Boolean)&&need.some(n=>head.indexOf(n)<0);
/* The Target Status words scorecard.py writes on a row it stands behind */
const LM_STATUS_KNOWN={on_track:1,behind:1,'target not set':1,weekend:1};

function lmScoreRead(tab,now){const out={ok:false,why:'tab missing',asOf:'',latest:{}};if(!Array.isArray(tab))return out;
  if(lmHeadMiss(lmHeadOf(tab),LM_SCORE_NEED)){out.why='header changed';return out;}
  const today=lmSheetClock(now).day,rows=[];
  lmTabObjs(tab).forEach(r=>{const id=lmCellTxt(r.KPI).toUpperCase(),date=lmSheetDay(r.Date);if(lmNameKey(r.Person)&&id&&date&&date<=today)rows.push({r,id,date});});   // a future date is not a write, and must not hide a stale tab
  if(!rows.length){out.why='tab empty';return out;}
  rows.forEach(x=>{if(x.date>out.asOf)out.asOf=x.date;});
  if(out.asOf<lmStaleFloor(now)){out.why='stale';return out;}
  rows.forEach(x=>{const k=lmNameKey(x.r.Person)+'|'+x.id,was=out.latest[k];if(!was||x.date>=was.date)out.latest[k]=x;});
  out.ok=true;out.why='';return out;}

/* One KPI for one person, ids in either case. stale:true whenever the number cannot be trusted: then .value, .n,
   .target and .vsLastWeek are null, .status and .shown read 'source stale', and .why says which rule fired.
   Label, Source and Note survive, because a stale row's Note says what is missing.
   A blank Value is not stale by itself. P4 writes one on purpose when a KPI measures nothing tonight (nobody owed a dial): Stale
   false, a real Target Status, a Note saying why. That row is healthy: value null, printed '—', and no colour (lmKpiStatus), the way
   the email prints it. Only a blank with no status P4 writes reads 'blank value'. A Value that is not a finite number was not
   written by P4, and a green tile must not stand over it. */
function lmKpi(score,person,id){const kid=lmCellTxt(id).toUpperCase(),x=score&&score.latest?score.latest[lmNameKey(person)+'|'+kid]:null,r=x?x.r:{};
  const raw=lmCellTxt(r['Target Status']).toLowerCase(),status=raw||'target not set',value=lmCellVal(r.Value);
  const out={id:kid,person,role:lmCellTxt(r.Role),label:lmCellTxt(r.Label),source:lmCellTxt(r.Source),note:lmCellTxt(r.Note),date:x?x.date:'',tabAsOf:score&&score.asOf||'',value:null,n:null,target:null,vsLastWeek:null,status:LM_SOURCE_STALE,stale:true,shown:LM_SOURCE_STALE,why:''};
  out.why=!score?'tab missing':!score.ok?score.why:!x?'no row':x.date<score.asOf?'row is behind the tab':(lmCellOn(r.Stale)||status===LM_SOURCE_STALE)?'marked stale':value==null?(LM_STATUS_KNOWN[raw]===1?'':'blank value'):(typeof value==='number'&&isFinite(value))?'':'unreadable value';
  if(out.why)return out;
  out.value=value;out.n=lmCellVal(r.N);out.target=lmCellVal(r.Target);out.vsLastWeek=lmCellVal(r['Vs Last Week']);out.status=status;out.stale=false;out.shown=value;return out;}

/* `asOf` is the payload's dealBoardAsOf: a phone's columns stop before N2, and the endpoint sends null for an empty
   board. The owner's full tab carries the stamp itself. A fresh stamp with no rows on a phone is a real 0 deals. */
function lmBoardRead(tab,asOf,now){const out={ok:false,why:'tab missing',asOf:'',day:'',rows:[]};if(!Array.isArray(tab))return out;
  const head=lmHeadOf(tab);if(lmHeadMiss(head,head.indexOf('_as')>-1?LM_BOARD_NEED:LM_BOARD_NEED.concat(['Value']))){out.why='header changed';return out;}
  const all=lmTabObjs(tab),objs=all.filter(r=>lmCellTxt(r['Opp ID']));   // the stamp at N2 makes a phantom row on an empty board
  if(asOf==null&&!objs.length){out.why='tab empty';return out;}
  const raw=asOf!=null?asOf:all[0]['As Of'],day=lmSheetDay(raw);
  if(!day||day>lmSheetClock(now).day){out.why='no as-of';return out;}
  out.asOf=lmCellTxt(raw);out.day=day;
  if(day<lmDayShift(lmStaleFloor(now),1)){out.why='stale';return out;}   // stamped the morning it ran, a day after the Date it reports
  out.rows=objs.map(r=>({opp:lmCellTxt(r['Opp ID']),lead:lmCellTxt(r.Lead),pipeline:lmCellTxt(r.Pipeline),stage:lmCellTxt(r.Stage),days:lmCellVal(r.Days),red:lmCellOn(r.Red),lm:lmCellTxt(r.LM),am:lmCellTxt(r.AM),dm:lmCellTxt(r.DM),nextContact:lmSheetDay(r['Next Contact']),apptAt:lmCellTxt(r['Appt At']),apptDay:lmSheetDay(r['Appt At']),value:lmCellVal(r.Value),as:'_as' in r?lmCellTxt(r._as).split(',').map(lmCellTxt).filter(Boolean):null}));
  out.ok=true;out.why='';return out;}

/* `role` is 'LM' or 'AM'. By the `_as` tag where the endpoint scoped the rows (split on the comma, never equality), by the
   column on the owner's full tab. Jordan is 'AM, LM': his LM-tagged rows are not his AM deals. */
function lmBoardMine(board,role,person){if(!board||!board.ok)return [];const want=lmNameKey(person),col=role==='AM'?'am':'lm';return board.rows.filter(r=>r.as?r.as.indexOf(role)>-1:lmNameKey(r[col])===want);}
const lmBoardCount=(board,role,person)=>board&&board.ok?lmBoardMine(board,role,person).length:LM_SOURCE_STALE;
function lmRoleTabs(src,now){const s=src||{},tabs=s.tabs||{},t=now||new Date();return {score:lmScoreRead(tabs['Role Scorecard'],t),board:lmBoardRead(tabs['Deal Board'],s.dealBoardAsOf,t)};}

/* ═══════════ ROLE SCREENS (D2) — what each role sees ═══════════
   The phone and the owner preview render the same screens, so they cannot drift. M.dealRole picks them: 'AM' only when the
   payload is tagged and the Team role names AM, so 'AM, LM' gets the AM screens and an old payload gets the LM's, as the
   counts already do. Tile numbers come from Role Scorecard alone, through lmKpi. The engine's tiles stay in code, because the
   nightly reads their keys; the LM keeps two of them, Dials and Conversations, which follow the lens.
   Colour comes only from Target Status. Vs Last Week is the KPI's value 7 days back and never colours: the lower-is-better list
   leaves out A2-A5 and A9, so a good drop there would read red. Rates are fractions (0.85), the deck's own convention.
   Andrew's phone carries no offer, no contract and no dollar: those tiles are gone, saved links to them land on lmNotHere, his
   lists show a stage number only, and Role Scorecard text with those words is dropped before it prints (lmKpiText).
   P0d, Michael's KPI ruling: three of his tiles are counts with those words in their names, New Lead Offers, Follow-Up Offers and
   Contracts Signed. The sheet's Label is dropped like any other, and the name comes from LM_KPI, which holds no figure. No number of ours.
   A task's words stand, because they are his work and real rows use them in plain English (an agent's contract ending), but a
   dollar figure in one is masked (lmTaskClean). Whether the words go too is Michael's call: apps-script/README.md §5.
   On the wire, Deal Board carries no Value, and an LM-only row carries its Stage as the number alone (scopeByRole_). His
   payload still holds Offers, Contracts and his LM fees, and his Task text whole, which the engine's comp() and the nightly read. */
const lmRole=M=>M&&M.dealRole==='AM'?'AM':'LM';
/* a Team Role cell's lane: 'AM, LM' is AM, the way dealRole reads it; 'Owner, DM' is Owner; Partner has none */
const lmLaneOf=c=>{const s=String(c==null?'':c);return /\bAM\b/i.test(s)?'AM':/\bLM\b/i.test(s)?'LM':/\bOwner\b/i.test(s)?'Owner':'';};
const lmTabsNow=M=>lmRoleTabs(M&&M.roleSrc,new Date());   // at render: stale depends on the clock, and the app stays open
/* M.startDate is the viewer's own: Team Start Date, else their first activity. */
function lmStartOf(tabs,person){const want=lmNameKey(person),team=lmTabObjs(tabs.Team).find(r=>lmNameKey(r.Name)===want),day=team?lmSheetDay(team['Start Date']):'';
  if(day)return new Date(+day.slice(0,4),+day.slice(5,7)-1,+day.slice(8,10));
  let first=null;lmTabObjs(tabs.Calls).forEach(r=>{if(lmNameKey(r.User)!==want)return;const d=LMEngine.parseDate(r.Date);if(d&&(!first||d<first))first=d;});return first;}
/* The host's one call after buildModel. It keeps the raw tabs and not a parsed copy, for the same reason as lmTabsNow. */
function lmRoleAttach(M,p){if(!M)return M;const s=p||{},t=s.tabs||{};M.roleSrc={tabs:{'Role Scorecard':t['Role Scorecard'],'Deal Board':t['Deal Board']},dealBoardAsOf:s.dealBoardAsOf};M.startDate=lmStartOf(t,M.person);return M;}

/* role scopes the id: a saved link can never open another role's page. fmt: pct (scorecard.py's ratio(), a 0 to 1 fraction), hrs, num.
   The Label cell wins over label; a missing tab has no Label cell, so every id has its own. */
const LM_KPI={
  A1:{role:'LM',label:'Speed to Lead',fmt:'pct',coach:'Call every new lead inside 30 working minutes of its arrival.'},
  A2:{role:'LM',label:'Untouched leads',fmt:'num',coach:'Leads no person has touched yet. Work this queue first.'},
  A3:{role:'LM',label:'Sellers waiting on us',fmt:'num',coach:'Sellers whose last move was toward us. Answer them before new dials.'},
  A4:{role:'LM',label:'Holding past 1 hour',fmt:'num',coach:'Holding means no reply to the first text, so it is your window to call. Nobody sits there past 1 hour.'},
  A5:{role:'LM',label:'Cadence behind',fmt:'num',coach:'Leads behind their call cadence. Bring the oldest back on schedule first.'},
  A6:{role:'LM',label:'15 touches in the first 72 hours',fmt:'pct',coach:'A new lead gets 15 touches, calls and texts, in its first 72 hours.'},
  A7:{role:'LM',label:'Dials made vs required',fmt:'pct',coach:'Dials made against the dials your queue required. The queue sets the number, not a fixed count a day.'},
  A8:{role:'LM',label:'Appts Set',fmt:'num',coach:'Walkthroughs you confirmed, plus phone appointments you set with the AM. Each contact counts once.'},
  A9:{role:'LM',label:'LM-Law misses',fmt:'num',coach:'A lead does not move to 4 until Lead Qualification and Comparables are both Completed.'},
  A10:{role:'LM',label:'Lead to Appt',fmt:'pct',coach:'Appts set out of the leads that reached you, over 30 days.'},
  A11:{role:'LM',label:'New Lead Offers',fmt:'num',coach:'Leads worked through to the AM in the same Mon-Sun week they came in. A count, last 4 weeks, team.'},
  A12:{role:'LM',label:'Follow-Up Offers',fmt:'num',coach:'The same count for every older lead, last 4 weeks, team. A lead past its first week is still worth working.'},
  A13:{role:'LM',label:'Contracts Signed',fmt:'num',coach:'The team’s top line: signed over the last 4 weeks, per week. Pending, closed and fell sit beside it.'},
  J1:{role:'AM',label:'Hours, 5.1 to offer',fmt:'hrs',coach:'Hours from 5.1 entry to the offer out. The target is inside 1 business day.'},
  J3:{role:'AM',label:'Offer to Contract',fmt:'pct',coach:'Your offers that became contracts, team deals only, over 90 days.'},
  J4:{role:'AM',label:'MAO accuracy',fmt:'pct',coach:'How far your MAO sits from the calculated MAO, median across deals. Stay inside ±5%.'},
  J5:{role:'AM',label:'Next Contact current',fmt:'pct',coach:'Next Contact Date current on 5.2 to 5.4. Shown for reference: it has no target for now.'},
  J6:{role:'AM',label:'Late Offers',fmt:'num',coach:'Offers stuck or not made past 1 business day: cards sitting in 5.1. Clear them to zero.'},
  J9:{role:'AM',label:'Walkthrough status not set',fmt:'num',coach:'Yesterday’s walkthroughs still marked booked or confirmed. Set the status the same day.'},
  J10:{role:'AM',label:'Offers Sent',fmt:'num',coach:'Offers the seller got from you with a number, any medium, over 30 days. An offer with no number does not count.'},
  J11:{role:'AM',label:'New Lead Offers',fmt:'num',coach:'Offers on leads that came in the same Mon-Sun week as the offer. Last 4 weeks, team.'},
  J12:{role:'AM',label:'Follow-Up Offers',fmt:'num',coach:'Every other offer, last 4 weeks, team.'},
  J13:{role:'AM',label:'Contracts Signed',fmt:'num',coach:'The team’s top line: signed over the last 4 weeks, per week. Pending, closed and fell sit beside it.'},
  JB1:{role:'AM',label:'Own book: due',fmt:'num',book:1,coach:'Your own book: what has come due. A card you touch and re-date leaves the count.'},
  JB2:{role:'AM',label:'1.5 leads behind',fmt:'num',book:1,coach:'Your own 1.5 leads that have fallen behind.'},
  M8:{role:'Owner',label:'Deals to Sell',fmt:'num',coach:'Deals not under contract with a buyer. Every deal, no owner split.'},
  M9:{role:'Owner',label:'Pending Revenue',fmt:'usd',coach:'Fees on deals under contract with a buyer. Every deal, gross, nothing presumed.'},
  M10:{role:'Owner',label:'Contracts Signed',fmt:'num',coach:'The team’s top line: signed over the last 4 weeks, per week. Pending, closed and fell sit beside it.'}
};
/* Michael's lists, in his order, the top line first, then what stays as support. A lowercase entry is an engine tile: Conversations,
   the one KPI on a list that follows the lens and has no Role Scorecard row. The Owner list is the deck's alone: its rows reach no phone. */
const LM_SCORE_TILES={LM:['A13','A8','conversations','A1','A10','A11','A12','A2','A3','A4','A5','A6','A7'],AM:['J13','J10','J6','J3','J11','J12','J1','J5','J4','J9'],Owner:['M10','M8','M9']};
const LM_ACTIVITY_TILES=['calls'];
const LM_BOOK_TILES=['JB1','JB2'];
const LM_SPEED_CAP='first touch, calls + texts, clock minutes';
const LM_NOT_LM={offersMade:1,contractsSigned:1,apptToContract:1};
const LM_LM_BAR=/offer|contract|\$/i;
const lmGated=(M,k)=>lmRole(M)==='LM'&&LM_NOT_LM[k]===1;
const lmBack=(person,lens,to)=>'<button class="lm-back" onclick="lmGo('+lmJsq(person)+','+lmJsq(lens)+','+lmJsq(to||'')+')">‹ '+(to==='book'?'My book':'Scoreboard')+'</button>';
const lmNotHere=(person,lens)=>lmBack(person,lmLensSafe(lens))+'<div class="lm-coach"><div class="lm-d-h">NOT ON THIS PHONE</div><p>This number sits with the Acquisition Manager.</p></div>';
const lmLensSafe=l=>LM_LENSES.some(x=>x[0]===l)?l:'week';
const lmMD=day=>day?(+day.slice(5,7))+'/'+(+day.slice(8,10)):'';
const lmKpiNum=v=>(Math.round(v*10)/10).toLocaleString();
/* A Value cell reaches here as a number or null (lmKpi). Target and Vs Last Week come through here too, unchecked, so text prints as itself and never as NaN. */
function lmKpiShow(v,fmt){if(v==null)return '—';if(typeof v!=='number')return lmEsc(v);return fmt==='pct'?lmPctF(v):fmt==='hrs'?lmKpiNum(v)+' h':fmt==='usd'?lmMoney(v):lmKpiNum(v);}
/* J5 is parked (Michael 10/30): no target and no colour, whatever its row says. */
const lmKpiTarget=k=>k.id==='J5'?null:k.target;
/* k.why stays the reader's code, for the data-health strip. This is what a person reads under 'source stale'. */
function lmWhyWords(k){const w=k.why;return w==='stale'?(k.tabAsOf?'last run '+lmMD(k.tabAsOf):'no recent run'):w==='tab missing'||w==='tab empty'?'not published yet':w==='no row'?'no number for this KPI':w==='row is behind the tab'?'left out of the last run':w==='marked stale'?'the routine could not measure it':w==='blank value'?'no number and no status':w==='unreadable value'?'the cell is not a number':w==='header changed'?'a column was renamed':w||LM_SOURCE_STALE;}
/* [tile class, words]. Nothing measured tonight gets its status word and no colour: a green tile needs a number under it. */
function lmKpiStatus(k){if(k.stale)return ['lm-stale',lmWhyWords(k)];if(k.id==='J5')return ['lm-none','target not set'];const s=k.status.replace(/_/g,' ');return k.value==null?['lm-none',s]:s==='on track'?['lm-ahead',s]:s==='behind'?['lm-behind',s]:['lm-none',s];}
/* the sheet's words, cleared for this viewer. A row behind the tab keeps its Note in lmKpi, and that Note can hold yesterday's number. */
function lmKpiText(M,k){const ok=s=>lmRole(M)==='LM'&&LM_LM_BAR.test(s)?'':s,d=LM_KPI[k.id]||{};return {label:ok(k.label)||d.label||k.id,note:k.why==='row is behind the tab'?'':ok(k.note),source:ok(k.source)};}
function lmScoreTile(M,person,lens,R,id){const d=LM_KPI[id],k=lmKpi(R.score,person,id),st=lmKpiStatus(k),tx=lmKpiText(M,k),bits=[];
  if(!k.stale){const tg=lmKpiTarget(k);if(tg!=null)bits.push('🎯 <b>'+lmKpiShow(tg,d.fmt)+'</b>');if(k.vsLastWeek!=null)bits.push('last wk <b>'+lmKpiShow(k.vsLastWeek,d.fmt)+'</b>');if(k.n!=null)bits.push('n <b>'+lmEsc(k.n)+'</b>');}
  return '<button class="lm-tile '+st[0]+'" onclick="lmGo('+lmJsq(person)+','+lmJsq(lens)+','+lmJsq('kpi-'+id)+')"><div class="lm-t-top"><span class="lm-t-lbl">'+lmEsc(tx.label)+'</span></div><div class="lm-t-val'+(k.stale?' stale':'')+'">'+(k.stale?LM_SOURCE_STALE:lmKpiShow(k.shown,d.fmt))+'</div><div class="lm-t-foot"><span>'+lmEsc(st[1])+'</span></div>'+(bits.length?'<div class="lm-t-bars">'+bits.join('<i>·</i>')+'</div>':'')+(tx.note?'<div class="lm-t-note">'+lmEsc(tx.note)+'</div>':'')+'</button>';}
/* one entry of a tile list, either kind */
const lmListTile=(M,person,lens,R,id)=>LM_KPI[id]?lmScoreTile(M,person,lens,R,id):lmTile(M,person,lens,lmTileDef(id));
const lmScoreTag=(R,tail)=>R.score.ok?'as of '+lmMD(R.score.asOf)+(tail?' · '+tail:''):LM_SOURCE_STALE+(R.score.asOf?' · last '+lmMD(R.score.asOf):'');
function lmScoreDetail(M,person,lens,id){const d=LM_KPI[id],R=lmTabsNow(M),k=lmKpi(R.score,person,id),st=lmKpiStatus(k),tx=lmKpiText(M,k),go=(l,to)=>'<button class="lm-deals-btn" onclick="lmGo('+lmJsq(person)+','+lmJsq(lens)+','+lmJsq(to)+')">'+l+' →</button>';
  let h=lmBack(person,lens,d.book?'book':'')+'<div class="lm-head"><div><p class="eyebrow">Scorecard'+(k.stale?'':' · as of '+lmMD(k.date))+'</p><h1>'+lmEsc(tx.label)+'</h1></div></div>';
  h+='<div class="lm-big '+st[0]+(k.stale?' stale':'')+'">'+(k.stale?LM_SOURCE_STALE:lmKpiShow(k.shown,d.fmt))+'</div><div class="lm-cmp">'+lmEsc(st[1])+'</div>';
  const tg=lmKpiTarget(k);
  if(!k.stale)h+='<div class="lm-bars"><div class="lm-bar'+(tg==null?' dim':'')+'"><span class="lm-bl">🎯 Target</span><span class="lm-bv">'+(tg==null?'not set':lmKpiShow(tg,d.fmt))+'</span></div><div class="lm-bar'+(k.vsLastWeek==null?' dim':'')+'"><span class="lm-bl">Last week</span><span class="lm-bv">'+(k.vsLastWeek==null?'—':lmKpiShow(k.vsLastWeek,d.fmt))+'</span></div></div>';
  const read=[];if(tx.note)read.push(lmEsc(tx.note));if(!k.stale&&k.n!=null)read.push('Based on <b>'+lmEsc(k.n)+'</b>.');if(tx.source&&typeof RAW!=='undefined')read.push('Source: '+lmEsc(tx.source)+'.');   /* the Source cell is an engineering reference (code paths): owner preview only */
  if(read.length)h+='<div class="lm-diag"><div class="lm-d-h">READOUT</div>'+read.map(x=>'<p>'+x+'</p>').join('')+'</div>';
  h+='<div class="lm-coach"><div class="lm-d-h">COACH — what moves the number</div><p>'+d.coach+'</p></div>';
  if(id==='A1'){const s=M.lenses[lmLensSafe(lens)].speed;h+=go('Clock speed '+lmSpd(s.current)+' · '+LM_SPEED_CAP,'speed');}
  if(id==='J3'||id==='J10')h+=go('Offers Made','offersMade')+go('Contracts','contractsSigned');
  if(id==='J13')h+=go('Contracts','contractsSigned');
  if(id==='J6')h+=go('Deals','deals');
  return h;}
/* ── work lists: Deal Board, through lmBoardMine ── */
/* the number at the front of a stage name. Andrew's lists stop at this: the words past it name offers and contracts */
const lmStageNum=s=>{const m=String(s==null?'':s).match(/^\s*(\d+(?:\.\d+)?)/);return m?m[1]:'';};
const lmDaysTxt=n=>n==null?'':typeof n!=='number'?lmEsc(n):n+(n===1?' day':' days');
const lmByDays=(a,b)=>(+b.days||0)-(+a.days||0);
const lmFirst=s=>String(s||'').trim().split(/\s+/)[0]||'';
/* read-only for the LM: no link, no red, stage number + days. One list per AM, named from the AM column */
function lmWithList(person,R){const none=(t,m)=>'<div class="lm-reclist"><div class="lm-rec-h">'+t+'</div><div class="lm-rec none">'+m+'</div></div>';
  if(!R.board.ok)return none('With the AM',LM_SOURCE_STALE);
  const rows=lmBoardMine(R.board,'LM',person);if(!rows.length)return none('With the AM','Nothing with the AM right now.');
  const groups=Object.create(null),order=[];rows.forEach(r=>{const k=lmNameKey(r.am);if(!groups[k]){groups[k]=[];order.push(k);}groups[k].push(r);});
  order.sort((a,b)=>groups[b].length-groups[a].length);
  return order.map(k=>{const g=groups[k].sort(lmByDays),am=g[0].am,who=!am?'the AM':lmNameKey(am)===lmNameKey(person)?'you':lmFirst(am);
    return '<div class="lm-reclist"><div class="lm-rec-h">With '+lmEsc(who)+' ('+g.length+')</div>'+g.map(r=>{const st=lmStageNum(r.stage),sub=[r.pipeline&&!/^acq/i.test(r.pipeline)?lmEsc(r.pipeline):'',st?'stage '+lmEsc(st):'',lmDaysTxt(r.days)].filter(Boolean).join(' · ');return '<div class="lm-rec"><div class="lm-rmain"><div class="lm-rn">'+lmEsc(r.lead)+'</div>'+(sub?'<div class="lm-rsub">'+sub+'</div>':'')+'</div></div>';}).join('')+'</div>';}).join('');}
/* A plain link by default (Deal Board has no Contact ID): a Tasks row on the same opportunity lends its ghl_url, else the name is plain text.
   Whether a follower can open that link under assigned-only permission is Michael's to test. */
function lmOppLinks(M){const o=Object.create(null);((M.tasks&&M.tasks.tasks)||[]).forEach(t=>{if(t.opp_id&&!o[t.opp_id]&&/^https:\/\//i.test(t.ghl_url))o[t.opp_id]=t.ghl_url;});return o;}
const lmLeadCell=(r,links)=>links[r.opp]?'<a class="lm-task-lead" href="'+lmEsc(links[r.opp])+'" target="_blank" rel="noopener">'+lmEsc(r.lead)+'</a>':lmEsc(r.lead);
/* the time an Appt At cell means, on the sheet's clock; '' for a bare date */
function lmApptTime(s){const t=String(s||'').match(/\b(\d{1,2}:\d{2})(?::\d{2})?\s*([AP]M)\b/i);if(t)return t[1]+' '+t[2].toUpperCase();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return '';const d=new Date(s);if(isNaN(d))return '';try{const x=d.toLocaleTimeString('en-US',{timeZone:LM_SHEET_TZ,hour:'numeric',minute:'2-digit'}).replace(/\s+/g,' ');return x==='12:00 AM'?'':x;}catch(e){return '';}}
function lmDayStrip(M,person,R){const h='<div class="lm-reclist lm-strip"><div class="lm-rec-h">Today &amp; tomorrow';
  if(!R.board.ok)return h+'</div><div class="lm-rec none">'+LM_SOURCE_STALE+'</div></div>';
  const today=lmSheetClock(new Date()).day,tmrw=lmDayShift(today,1),links=lmOppLinks(M),rows=lmBoardMine(R.board,'AM',person).filter(r=>r.apptDay===today||r.apptDay===tmrw).sort((a,b)=>a.apptDay.localeCompare(b.apptDay)||(Date.parse(a.apptAt)||0)-(Date.parse(b.apptAt)||0));
  if(!rows.length)return h+'</div><div class="lm-rec none">Nothing booked today or tomorrow.</div></div>';
  return h+' ('+rows.length+')</div>'+rows.map(r=>'<div class="lm-rec"><div class="lm-rmain"><div class="lm-rn">'+lmLeadCell(r,links)+'</div><div class="lm-rsub">'+lmEsc(r.stage)+'</div></div><div class="lm-rmetric lm-rd">'+(r.apptDay===today?'Today':'Tomorrow')+' '+lmEsc(lmApptTime(r.apptAt))+'</div></div>').join('')+'</div>';}
/* Next Contact prints as plain text: NCD is parked, so it gets no colour and no alert. Red is the board's own cell, not recomputed */
function lmAmDeals(M,person,R){const h='<div class="lm-reclist"><div class="lm-rec-h">Deals';
  if(!R.board.ok)return h+'</div><div class="lm-rec none">'+LM_SOURCE_STALE+'</div></div>';
  const rows=lmBoardMine(R.board,'AM',person).slice().sort((a,b)=>(b.red-a.red)||lmByDays(a,b)),links=lmOppLinks(M);
  if(!rows.length)return h+' (0)</div><div class="lm-rec none">No deals on your board.</div></div>';
  return h+' ('+rows.length+')</div>'+rows.map(r=>{const sub=[r.stage?lmEsc(r.stage):'',r.nextContact?'next contact '+lmMD(r.nextContact):''].filter(Boolean).join(' · ');return '<div class="lm-rec"><div class="lm-rmain"><div class="lm-rn">'+lmLeadCell(r,links)+'</div>'+(sub?'<div class="lm-rsub">'+sub+'</div>':'')+'</div><div class="lm-rmetric lm-rd'+(r.red?' red':'')+'">'+lmDaysTxt(r.days)+'</div></div>';}).join('')+'</div>';}
function lmBookView(M,person,lens){const R=lmTabsNow(M);return lmBack(person,lens)+'<div class="lm-head"><div><p class="eyebrow">Your own leads</p><h1>My book</h1></div></div><div class="sec-h"><h2>Book</h2><span class="tag">'+lmScoreTag(R,'tap a tile')+'</span></div><section class="lm-tiles">'+LM_BOOK_TILES.map(id=>lmScoreTile(M,person,lens,R,id)).join('')+'</section>';}
/* ── Make More Money without a dollar: the role's levers, each with its number from Role Scorecard ── */
const LM_ROLE_LEVERS={
  LM:[{ids:['A1'],title:'Call new leads inside 30 working minutes',goal:'Be first to every fresh lead'},
    {ids:['A2'],title:'Clear the untouched queue',goal:'No new lead waits for a first human touch'},
    {ids:['A4'],title:'Keep Holding under 1 hour',goal:'Call everyone in Holding inside the hour'},
    {ids:['A5','A6'],title:'Stay on cadence',goal:'Keep every lead on its cadence: 15 touches, calls and texts, in its first 72 hours'},
    {ids:['A9'],title:'LQ + Comps before 4',goal:'Both Completed before a lead moves to stage 4'}],
  AM:[{ids:['J1'],title:'Offer out inside 1 business day',goal:'Move from 5.1 to an offer out the next business day at the latest'},
    {ids:['J6'],title:'Clear 5.1',goal:'No card sits in 5.1 past 1 business day'},
    {ids:['J4'],title:'MAO within ±5%',goal:'Stay inside ±5% of the calculated MAO'},
    {ids:['J9'],title:'Walkthrough status same day',goal:'Set every walkthrough’s status the day it happens'},
    {ids:['J3'],title:'Offer→contract',goal:'Follow up every offer out until it is a yes or a no'}]
};
function lmLeverNow(M,person,R,ids){const parts=ids.map(id=>{const k=lmKpi(R.score,person,id),d=LM_KPI[id];if(k.stale)return null;const tg=lmKpiTarget(k);return (ids.length>1?lmEsc(lmKpiText(M,k).label)+' ':'')+lmKpiShow(k.shown,d.fmt)+(tg!=null?' · target '+lmKpiShow(tg,d.fmt):k.status==='target not set'?' · target not set':'');});return parts.every(p=>p===null)?LM_SOURCE_STALE:parts.map(p=>p===null?LM_SOURCE_STALE:p).join(' · ');}
function lmRoleLevers(M,person){const R=lmTabsNow(M),first=lmFirst(person)||'You';
  const card=L=>'<div class="lm-scen"><div class="lm-scen-l"><div class="lm-scen-t">'+L.title+'</div><div class="lm-scen-now">'+lmLeverNow(M,person,R,L.ids)+'</div><div class="lm-scen-goal">→ '+L.goal+'</div></div></div>';
  return '<div class="lm-head"><div><p class="eyebrow">Make more money · your levers</p><h1>'+lmEsc(first)+'’s levers</h1></div></div>'+lmNoPay()+'<div class="lm-foc lever"><div class="lm-foc-h">What moves your numbers · '+lmScoreTag(R)+'</div>'+LM_ROLE_LEVERS[lmRole(M)].map(card).join('')+'</div>';}
/* ── one route table for both hosts ── */
const LM_ROUTES={deals:1,focus:1,tasks:1,book:1};
const lmKpiId=m=>/^kpi-/.test(String(m||''))?String(m).slice(4).toUpperCase():'';
const lmIsView=m=>!m||LM_ROUTES[m]===1||LM_EARN[m]===1||!!lmKpiId(m);
/* Whatever a saved link names: a route this role does not have, or a key this build does not know, lands on home, never on a render error. */
function lmRoute(M,person,lens,metric,team){const L=lmLensSafe(lens),kid=lmKpiId(metric),d=kid?LM_KPI[kid]:null;
  if(metric==='tasks')return lmTasksView(M,person);
  if(metric==='focus')return lmFocusView(M,person,L);
  if(metric==='deals')return lmDealsView(M,person,L);
  if(metric==='book'&&lmRole(M)==='AM')return lmBookView(M,person,L);
  if(LM_EARN[metric]===1)return lmEarnView(M,person,L,metric);
  if(d&&d.role===lmRole(M))return lmScoreDetail(M,person,L,kid);
  if(metric&&!lmIsView(metric)&&(lmGated(M,metric)||Object.prototype.hasOwnProperty.call(M.lenses[L],metric)))return lmDetail(M,person,L,metric);
  return lmHome(M,person,L,team);}

/* tabs.Tasks / tabs.Review → {present, tasks, flags}. present=false when the endpoint sent no Tasks tab (null). */
function lmTasksParse(tabs){tabs=tabs||{};const present=Array.isArray(tabs.Tasks);
  const tasks=present?lmTabObjs(tabs.Tasks).map(t=>{['task_id','owner','visibility','status','kind','source','lead','ask','why','due','date','note','done_at','done_by','snoozed_until','ghl_url','contact_id','opp_id','created_by'].forEach(k=>t[k]=String(t[k]==null?'':t[k]).trim());t.priority=(+t.priority>=1&&+t.priority<=3)?+t.priority:2;return t;}).filter(t=>t.task_id):[];
  const flags=Array.isArray(tabs.Review)?lmTabObjs(tabs.Review).map(f=>{Object.keys(f).forEach(k=>f[k]=String(f[k]==null?'':f[k]).trim());return f;}).filter(f=>f.flag_id):[];
  return {present:present,reviewPresent:Array.isArray(tabs.Review),tasks:tasks,flags:flags};}
/* the LM's own rows — and never a private (visibility=owner) row, whatever the payload says */
const lmTasksMine=(T,person)=>(T&&T.tasks||[]).filter(t=>t.owner===person&&t.visibility!=='owner');
const lmFlagsMine=(T,person)=>(T&&T.flags||[]).filter(f=>f.from===person);
/* Andrew's phone shows no dollar figure, and tasks_sync keeps a seller's own figures on an LM's task on purpose, so the view masks them
   for role LM. In lmTasksView, before the buckets, and never in lmTaskRow: the owner deck shares that row, and the flag form repeats
   this ask. A mask, not the report's dropped sentence (render_memo._withhold): on these rows the figure sits inside the instruction, and
   the sentence is the task. A figure only: '$/sqft' is his Comparables instruction. A typed `note` stays as written: its box saves back. */
const LM_FIGURE=/\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|mm?|thousand|million))?\b/gi;
const lmNoFigure=s=>String(s==null?'':s).replace(LM_FIGURE,'[figure]');
const lmTaskClean=(M,t)=>lmRole(M)==='LM'?Object.assign({},t,{ask:lmNoFigure(t.ask),why:lmNoFigure(t.why)}):t;
/* Overdue (due before today) · Now (priority 1, or due within the hour) · Today · Later (snoozed / priority 3 / future) · Done today */
function lmTaskBuckets(tasks,now){now=now||new Date();const today=lmDayStr(now),nowMs=now.getTime(),B={overdue:[],now:[],today:[],later:[],done:[]};
  (tasks||[]).forEach(t=>{let st=t.status;
    if(st==='snoozed'){const su=lmMsOf(t.snoozed_until);if(!isNaN(su)&&su<=nowMs)st='open';else{B.later.push(t);return;}}
    if(st==='open'){const day=lmDayOf(t.due),ms=lmMsOf(t.due);
      if(day&&day<today)B.overdue.push(t);
      else if(t.priority===1||(!isNaN(ms)&&ms<=nowMs+3600e3))B.now.push(t);
      else if(t.priority===3||(day&&day>today))B.later.push(t);
      else B.today.push(t);
      return;}
    if(st==='done'&&lmDayOf(t.done_at)===today)B.done.push(t);});
  const byPri=(a,b)=>(a.priority-b.priority)||String(a.due).localeCompare(String(b.due));
  Object.keys(B).forEach(k=>B[k].sort(byPri));
  B.open=B.overdue.length+B.now.length+B.today.length+B.later.filter(t=>t.status==='open').length;
  return B;}
/* home button: ✓ Today — <open> open, <overdue> overdue → (hidden when the endpoint sent no Tasks tab) */
function lmTasksBtn(M,person,lens){const T=M&&M.tasks;if(!T||!T.present)return '';const B=lmTaskBuckets(lmTasksMine(T,person));
  return '<button class="lm-deals-btn tasksbtn'+(B.overdue.length?' late':'')+'" onclick="lmGo(\''+person+'\',\''+lens+'\',\'tasks\')">✓ Today — '+B.open+' open, '+B.overdue.length+' overdue →</button>';}
function lmTaskDueLbl(t,today){const day=lmDayOf(t.due),ms=lmMsOf(t.due);let s='';
  if(!isNaN(ms)){const d=new Date(ms);let h=d.getHours();const ap=h<12?'AM':'PM';h=h%12||12;s=(day===today?'':day+' ')+h+':'+lmPad2(d.getMinutes())+' '+ap;}
  else if(day)s=day===today?'today':day;
  if(t.status==='snoozed'){const su=lmMsOf(t.snoozed_until);if(!isNaN(su)){const d=new Date(su);let h=d.getHours();const ap=h<12?'AM':'PM';h=h%12||12;s='⏰ '+(lmDayStr(d)===today?'':lmDayStr(d)+' ')+h+':'+lmPad2(d.getMinutes())+' '+ap;}else s='⏰ snoozed';}
  if(!s)return '';return '<span class="lm-task-due'+(day&&day<today?' late':'')+(t.priority===1?' p1':'')+'">'+lmEsc(s)+(t.priority===1?' · NOW':'')+'</span>';}
function lmTaskRow(t,today,readOnly){const id=lmDomId(t.task_id),q=lmJsq(t.task_id);
  const lead=t.lead?(t.ghl_url?'<a class="lm-task-lead" href="'+lmEsc(t.ghl_url)+'" target="_blank" rel="noopener">'+lmEsc(t.lead)+'</a>':'<span class="lm-task-lead">'+lmEsc(t.lead)+'</span>'):'';
  let h='<div class="lm-task'+(t.status==='snoozed'?' snoozed':'')+'" id="'+id+'"><div class="lm-task-meta">'+(t.kind?'<span class="lm-task-kind">'+lmEsc(t.kind)+'</span>':'')+lead+lmTaskDueLbl(t,today)+'</div>'
    +'<div class="lm-task-ask">'+lmEsc(t.ask)+'</div>'+(t.why?'<div class="lm-task-why">'+lmEsc(t.why)+'</div>':'')+(t.note?'<div class="lm-task-note">✎ '+lmEsc(t.note)+'</div>':'');
  if(readOnly)return h+'</div>';
  h+='<div class="lm-task-acts">'
    +'<button type="button" class="lm-tbtn done" onclick="lmTaskDone('+q+')" aria-label="Mark done">✓ done</button>'
    +'<button type="button" class="lm-tbtn" onclick="lmTaskToggle(\''+id+'-snz\')" aria-label="Snooze: show options">⏰ later</button>'
    +'<button type="button" class="lm-tbtn" onclick="lmTaskToggle(\''+id+'-note\')" aria-label="Add a note">✎ note</button>'
    +'<button type="button" class="lm-tbtn" onclick="lmFlagOpen({item_type:\'task\',item_key:'+lmJsq('task:'+t.task_id)+',memo_date:'+lmJsq(t.date)+',label:'+lmJsq(t.ask)+'})" aria-label="Flag this task for Michael">⚑ flag</button></div>'
    +'<div class="lm-task-form" id="'+id+'-snz" hidden><button type="button" class="lm-tbtn" onclick="lmTaskSnooze('+q+',\'2h\')">+2 hours</button><button type="button" class="lm-tbtn" onclick="lmTaskSnooze('+q+',\'tomorrow\')">Tomorrow 8:30 AM</button></div>'
    +'<div class="lm-task-form" id="'+id+'-note" hidden><textarea id="'+id+'-note-in" rows="2" placeholder="Note…" aria-label="Note">'+lmEsc(t.note)+'</textarea><button type="button" class="lm-tbtn done" onclick="lmTaskNote('+q+',\''+id+'\','+lmJsq(t.status)+','+lmJsq(t.snoozed_until)+')">Save note</button></div>'
    +'<div class="lm-task-err" id="'+id+'-err" role="alert"></div></div>';
  return h;}
function lmTaskSection(title,rows,cls,today){if(!rows.length)return '';return '<div class="lm-tsec '+(cls||'')+'"><div class="lm-tsec-h"><span>'+title+'</span><span>'+rows.length+'</span></div>'+rows.map(t=>lmTaskRow(t,today,false)).join('')+'</div>';}
function lmFlagFormHtml(c){if(!c)return '';const what=(c.item_type||'item')+' · '+(c.item_key||'');
  return '<div class="lm-flag-form card" id="lm-flag-form"><div class="lm-d-h">⚑ FLAG FOR MICHAEL</div><div class="lm-flag-what">'+lmEsc(what)+(c.label?' — '+lmEsc(c.label):'')+(c.memo_date?' <span class="lm-flag-date">memo '+lmEsc(c.memo_date)+'</span>':'')+'</div>'
    +'<label class="lm-flbl" for="lm-flag-reason">Reason</label><select id="lm-flag-reason" class="lm-sel">'+LM_FLAG_REASONS.map(r=>'<option value="'+r[0]+'"'+(c.reason===r[0]?' selected':'')+'>'+r[1]+'</option>').join('')+'</select>'
    +'<label class="lm-flbl" for="lm-flag-note">What happened (required)</label><textarea id="lm-flag-note" rows="3" placeholder="In your words…"></textarea>'
    +'<label class="lm-flbl" for="lm-flag-evidence">Evidence (optional) — mm:ss of the call, or a link</label><input id="lm-flag-evidence" class="lm-in" placeholder="e.g. 03:12">'
    +'<div class="lm-task-acts"><button type="button" class="lm-tbtn done" onclick="lmFlagSubmit()">Send flag</button><button type="button" class="lm-tbtn" onclick="lmFlagCancel()">Cancel</button></div><div class="lm-task-err" id="lm-flag-form-err" role="alert"></div></div>';}
function lmFlagsBlock(flags){if(!flags.length)return '';const rows=flags.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,20);
  return '<div class="lm-reclist lm-flags"><div class="lm-rec-h">My flags ('+flags.length+')</div>'+rows.map(f=>'<div class="lm-flag"><div class="lm-flag-k">'+lmEsc(f.item_type)+' · '+lmEsc(f.item_key)+(f.memo_date?' · memo '+lmEsc(f.memo_date):'')+'<span class="lm-pill '+lmEsc(f.status||'pending')+'">'+lmEsc(f.status||'pending')+'</span></div><div>'+lmEsc(f.reason)+(f.note?' — '+lmEsc(f.note):'')+'</div>'+(f.decision_note?'<div class="lm-flag-dec"><b>MICHAEL</b> '+lmEsc(f.decision_note)+'</div>':'')+'</div>').join('')+'</div>';}
/* the Tasks route. M.tasks = lmTasksParse(payload.tabs), attached by the host after buildModel. */
function lmTasksView(M,person){const T=M&&M.tasks,today=lmDayStr(new Date());
  let h='<button class="lm-back" onclick="lmGo(\''+person+'\',\'week\',\'\')">‹ Scoreboard</button><div class="lm-head"><div><p class="eyebrow">Today · '+lmEsc(today)+'</p><h1>Your tasks</h1></div></div>';
  if(!T||!T.present)return h+'<div class="lm-coach"><div class="lm-d-h">TASKS NOT CONNECTED</div><p>The endpoint did not send a Tasks tab. Ask Michael to redeploy the LM endpoint with the Tasks and Review tabs.</p></div>';
  if(LM_FLAG_CTX)LM_FLAG_CTX.person=M.person||person;     // the identity the token resolved to — the ONLY item_owner a flag ever carries
  h+=lmFlagFormHtml(LM_FLAG_CTX);
  const B=lmTaskBuckets(lmTasksMine(T,person).map(t=>lmTaskClean(M,t)));
  h+=lmTaskSection('Overdue',B.overdue,'red',today)+lmTaskSection('Now',B.now,'now',today)+lmTaskSection('Today',B.today,'',today)+lmTaskSection('Later',B.later,'dim',today);
  if(!B.overdue.length&&!B.now.length&&!B.today.length&&!B.later.length)h+='<div class="lm-tsec"><div class="lm-rec none">All clear — nothing open right now.</div></div>';
  if(B.done.length)h+='<details class="lm-tsec dim"><summary>Done today · '+B.done.length+'</summary>'+B.done.map(t=>lmTaskRow(t,today,true)).join('')+'</details>';
  h+='<details class="lm-tsec lm-add" id="lm-add"><summary>+ Add a task for yourself</summary><div class="lm-task-form"><textarea id="lm-add-ask" rows="2" placeholder="What needs doing?" aria-label="Task"></textarea>'
    +'<label class="lm-flbl" for="lm-add-due">Due</label><input id="lm-add-due" class="lm-in" type="date" value="'+today+'"><label class="lm-flbl" for="lm-add-pri">Priority</label><select id="lm-add-pri" class="lm-sel"><option value="1">1 · now</option><option value="2" selected>2 · today</option><option value="3">3 · this week</option></select>'
    +'<button type="button" class="lm-tbtn done" onclick="lmTaskAdd()">Add task</button></div><div class="lm-task-err" id="lm-add-err" role="alert"></div></details>';
  h+=lmFlagsBlock(lmFlagsMine(T,person));
  return h;}
/* ── actions: optimistic UI, inline errors, host does the POST + reload ── */
var LM_FLAG_CTX=null;   // {item_type,item_key,memo_date,label?,reason?,owner_hint?} — set by ⚑ or the #flag= deep link; `person` is stamped at render
function lmTasksHost(){return (typeof window!=='undefined'&&window.LMApp&&typeof window.LMApp.post==='function')?window.LMApp:null;}
function lmEl(id){try{return document.getElementById(id);}catch(e){return null;}}
function lmTaskToggle(id){const el=lmEl(id);if(!el)return;el.hidden=!el.hidden;}
function lmTaskPost(action,fields,domId){const el=domId?lmEl(domId):null,err=domId?lmEl(domId+'-err'):null;if(err)err.textContent='';
  const host=lmTasksHost();if(!host){if(err)err.textContent='Not connected — reload the app.';return Promise.resolve({ok:false,error:'no host'});}
  if(el&&el.classList)el.classList.add('busy');
  return host.post(action,fields).then(j=>{if(!j||!j.ok){if(el&&el.classList)el.classList.remove('busy');if(err)err.textContent='Could not save: '+((j&&j.error)||'error');}return j;})
    .catch(e=>{if(el&&el.classList)el.classList.remove('busy');if(err)err.textContent='Could not save: '+String((e&&e.message)||e);return {ok:false,error:String((e&&e.message)||e)};});}
function lmTaskDone(id){const d=lmDomId(id),el=lmEl(d);if(el&&el.classList)el.classList.add('lm-task-done');
  return lmTaskPost('set_status',{task_id:id,status:'done'},d).then(j=>{if(!(j&&j.ok)&&el&&el.classList)el.classList.remove('lm-task-done');return j;});}
function lmTaskSnooze(id,when){const d=new Date();if(when==='tomorrow'){d.setDate(d.getDate()+1);d.setHours(8,30,0,0);}else d.setTime(d.getTime()+7200e3);
  const dom=lmDomId(id),el=lmEl(dom);if(el&&el.classList)el.classList.add('snoozed');
  return lmTaskPost('set_status',{task_id:id,status:'snoozed',snoozed_until:d.toISOString()},dom);}
function lmTaskNote(id,dom,status,snoozedUntil){const ta=lmEl(dom+'-note-in'),note=ta?String(ta.value||'').trim():'';const f={task_id:id,status:status==='snoozed'?'snoozed':'open',note:note};if(f.status==='snoozed')f.snoozed_until=snoozedUntil||'';
  return lmTaskPost('set_status',f,dom);}
function lmTaskAdd(){const ask=String((lmEl('lm-add-ask')||{}).value||'').trim(),due=String((lmEl('lm-add-due')||{}).value||'').trim(),pri=String((lmEl('lm-add-pri')||{}).value||'2');
  if(!ask){const e=lmEl('lm-add-err');if(e)e.textContent='Write the task first.';return Promise.resolve({ok:false,error:'ask required'});}
  return lmTaskPost('add_task',{ask:ask,due:due,priority:pri},'lm-add');}
/* ⚑ — from a task row, or from the #flag=<item_key>&type=&owner=&date= deep link the email carries */
function lmFlagOpen(ctx){LM_FLAG_CTX=ctx?{item_type:LM_FLAG_TYPES[ctx.item_type]?ctx.item_type:'task',item_key:String(ctx.item_key||''),memo_date:String(ctx.memo_date||''),label:ctx.label||'',reason:ctx.reason||'',owner_hint:ctx.owner_hint||''}:null;
  const host=lmTasksHost();if(host&&typeof host.showTasks==='function')host.showTasks();else if(typeof lmGo==='function')lmGo('','','tasks');
  try{setTimeout(function(){const f=lmEl('lm-flag-form');if(f&&f.scrollIntoView)f.scrollIntoView({block:'start'});},0);}catch(e){}}
function lmFlagCancel(){LM_FLAG_CTX=null;const host=lmTasksHost();if(host&&typeof host.showTasks==='function')host.showTasks();else if(typeof lmGo==='function')lmGo('','','tasks');}
function lmFlagSubmit(){const c=LM_FLAG_CTX;if(!c)return Promise.resolve({ok:false,error:'no flag'});
  const reason=String((lmEl('lm-flag-reason')||{}).value||'other'),note=String((lmEl('lm-flag-note')||{}).value||'').trim(),evidence=String((lmEl('lm-flag-evidence')||{}).value||'').trim();
  if(!note){const e=lmEl('lm-flag-form-err');if(e)e.textContent='Say what happened — Michael reads this.';return Promise.resolve({ok:false,error:'note required'});}
  /* item_owner is ALWAYS the identity the token resolved to (M.person) — never the hash's owner, which only prefills. */
  const fields={item_type:c.item_type,item_key:c.item_key,item_owner:c.person||'',memo_date:c.memo_date||'',reason:reason,note:note,evidence:evidence};
  return lmTaskPost('flag',fields,'lm-flag-form').then(j=>{if(j&&j.ok)LM_FLAG_CTX=null;return j;});}
