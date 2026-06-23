/* ═══════════════════════════════════════════════════════════════
   CLT LM Scoreboard — SHARED VIEW (single source of truth)
   Loaded by BOTH the owner Command Deck (index.html) and Jordan's
   standalone app (lm.html). Pure render functions over a built model.
   Host supplies glue globals: lmGo(person,lens,metric), css(var),
   and (deck only) RAW/route/scopeToLM. RAW-absent paths degrade
   gracefully (team picker / company-goal / benchmark simply hide).
   ═══════════════════════════════════════════════════════════════ */
const lmNum=v=>(v==null||isNaN(v))?'—':Math.round(v).toLocaleString();
const lmMin=v=>(v==null||isNaN(v))?'—':(Math.round(v*10)/10).toLocaleString()+'m';
const lmSpd=v=>(v==null||isNaN(v))?'—':Math.round(v).toLocaleString()+' min';
const lmPctF=v=>(v==null||isNaN(v))?'—':(v*100).toFixed(0)+'%';
const lmMoney=v=>'$'+Math.round(v||0).toLocaleString();
const LM_FMT={num:lmNum,min:lmMin,spd:lmSpd,pct:lmPctF};
const LM_TILES=[{k:'calls',label:'Dials',fmt:'num'},{k:'conversations',label:'Conversations ≥75s',fmt:'num'},{k:'qualifying',label:'Qualifying ≥10m',fmt:'num'},{k:'connectRate',label:'Connect Rate',fmt:'pct'},{k:'talkTime',label:'Talk Time',fmt:'min'},{k:'speed',label:'Speed-to-Lead',fmt:'spd',low:true},{k:'leads',label:'New Leads',fmt:'num'},{k:'apptsBooked',label:'Appts Booked',fmt:'num'},{k:'apptsShowed',label:'Appts Showed',fmt:'num'},{k:'offersMade',label:'Offers Made',fmt:'num'},{k:'contractsSigned',label:'Contracts',fmt:'num'},{k:'showRate',label:'Show Rate',fmt:'pct'},{k:'leadToAppt',label:'Lead→Appt',fmt:'pct'},{k:'apptToContract',label:'Appt→Contract',fmt:'pct'}];
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
const LM_CALLQ=[['connected','Answered','any'],['conversations','Conversation','≥75s'],['deepConv','Deep','≥3 min'],['qualifying','Qualifying','≥10 min']];
const LM_CALLKEYS={connected:1,conversations:1,deepConv:1,qualifying:1};
const LM_XTILES={connected:{k:'connected',label:'Answered (any length)',fmt:'num'},deepConv:{k:'deepConv',label:'Deep ≥3 min',fmt:'num'}};
const lmTileDef=k=>LM_TILES.find(t=>t.k===k)||LM_XTILES[k]||{k:k,label:k,fmt:'num'};
function lmCallLadder(M,lens,key){var L=M.lenses[lens];return '<div class="lm-qh">Call-quality ladder · '+LM_LBL[lens]+' · longer call = better</div><div class="lm-ladder">'+LM_CALLQ.map(function(c){var lm=L[c[0]],v=lm?lm.current:0;return '<button class="lm-lad'+(c[0]===key?' on':'')+'" onclick="lmGo(\''+M.person+'\',\''+lens+'\',\''+c[0]+'\')"><span>'+c[2]+'</span><b>'+lmNum(v)+'</b></button>';}).join('<i>›</i>')+'</div>';}
const lmPaceCls=s=>s==='ahead'?'lm-ahead':s==='on'?'lm-on':s==='behind'?'lm-behind':'lm-none';
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
function lmComp(M,person,lens){const c=M.comp,s=(l,v,cls,sub,b)=>'<button class="lm-cstat '+(cls||'')+'" onclick="lmGo(\''+person+'\',\''+lens+'\',\''+b+'\')"><div class="lm-cl">'+l+'</div><div class="lm-cv">'+v+'</div><div class="lm-cs">'+(sub||'')+'</div></button>';return '<section class="lm-comp">'+s('Earned',lmMoney(c.earned),'gr',c.earnedDeals.length+' closed','earned')+s('Earmarked',lmMoney(c.earmarked),'br',c.earmarkedDeals.length+' under contract','earmarked')+s('Projected',lmMoney(c.projected),'',c.projectedDeals.length+' pre-contract','projected')+s('Potential',lmMoney(c.potential),'',c.openOffers.length+' offers out','potential')+'</section>';}
/* both rails on the tile face: trailing average (the bar to beat) + fixed target (from LM Targets), formatted by metric type */
function lmTileBars(lm,t){var g=lm.game,F=LM_FMT[t.fmt],a=(lm.bar==null)?null:F(lm.bar),tg=(g&&g.bars&&g.bars.target!=null)?F(g.bars.target):null;if(a==null&&tg==null)return '';var p=[];if(a!=null)p.push('avg <b>'+a+'</b>');if(tg!=null)p.push('🎯 <b>'+tg+'</b>');return '<div class="lm-t-bars">'+p.join('<i>·</i>')+'</div>';}
function lmTile(M,person,lens,t){const lm=M.lenses[lens][t.k];if(!lm)return '';const g=lm.game;let badge='';if(g&&g.streak&&g.streak.current>=2)badge='<span class="lm-badge fire">🔥'+g.streak.current+'</span>';if(g&&g.pr&&g.pr.isRecord)badge='<span class="lm-badge pr">PR</span>';const pc=lmPaceCls(lm.paceState);return '<button class="lm-tile '+pc+'" onclick="lmGo(\''+person+'\',\''+lens+'\',\''+t.k+'\')"><div class="lm-t-top"><span class="lm-t-lbl">'+t.label+'</span>'+badge+'</div><div class="lm-t-val">'+LM_FMT[t.fmt](lm.current)+'</div><div class="lm-t-spark '+pc+'">'+lmSpark(lm.trend,t.fmt==='pct')+'</div><div class="lm-t-foot">'+lmDelta(lm.comparePct,t.low)+' <span>vs '+LM_PRIOR[lens]+'</span></div>'+lmTileBars(lm,t)+'</button>';}
function lmStreakHL(M,lens){let best=null;['calls','leads','apptsBooked','apptsShowed','talkTime','speed'].forEach(k=>{const lm=M.lenses[lens][k];if(!lm||!lm.game)return;const s=lm.game.streak;if(s&&s.current>=1&&(!best||s.current>best.cur))best={k:k,cur:s.current};});if(!best)return '<div class="lm-hl-streak none">No active streak '+LM_LBL[lens]+' — start one.</div>';return '<div class="lm-hl-streak"><span class="fire">🔥</span><b>'+best.cur+' '+LM_UNIT[lens]+(best.cur>1?'s':'')+'</b> above your '+lmTileDef(best.k).label.toLowerCase()+' pace</div>';}
function lmPaceDay(M){const t=M.lenses.today.calls,d=t.anchorDate,bar=t.bar,when=lmRel(d);let tail='';if(bar!=null)tail=t.current>=bar?' · <span class="lm-up">+'+Math.round(t.current-bar)+' vs avg</span>':' · <span class="lm-dn">'+Math.round(bar-t.current)+' under avg</span>';const note=t.lagged?'latest closed day · today posts tomorrow AM':'today so far';return '<div class="lm-hl-pace"><div class="lm-pl">PACE THE DAY · '+when+'</div><div class="lm-pv">'+lmNum(t.current)+' calls</div><div class="lm-ps">'+note+' · avg '+(bar==null?'—':lmNum(bar))+tail+'</div></div>';}
function lmPicker(person,team){if(team.length<2)return '<span class="lm-person">'+person+'</span>';return '<select class="lm-person" onchange="lmGo(this.value,\'week\',\'\')">'+team.map(p=>'<option'+(p===person?' selected':'')+'>'+p+'</option>').join('')+'</select>';}
function lmBars(lm,t){const g=lm.game,F=(t&&LM_FMT[t.fmt])||function(v){return v==null?'—':Math.round(v*10)/10;};let o='<div class="lm-bars"><div class="lm-bar"><span class="lm-bl">Trailing avg</span><span class="lm-bv">'+(lm.bar==null?'—':F(lm.bar))+'</span></div>';o+=(g&&g.bars&&g.bars.target!=null)?'<div class="lm-bar"><span class="lm-bl">🎯 Target</span><span class="lm-bv">'+F(g.bars.target)+'</span></div>':'<div class="lm-bar dim"><span class="lm-bl">🎯 Target</span><span class="lm-bv">not set</span></div>';return o+'</div>';}
function lmDiag(lm,t,lens){const b=[];if(lm.comparePct!=null){const up=lm.comparePct>=0,good=t.low?!up:up;b.push(t.label+' is <b>'+Math.abs(lm.comparePct*100).toFixed(0)+'% '+(up?'up':'down')+'</b> vs '+LM_PRIOR[lens]+' — '+(good?'right way.':'slipping.'));}if(lm.bar!=null)b.push(lm.paceState==='ahead'?'Above your trailing pace.':lm.paceState==='on'?'On your trailing pace.':'Below your trailing pace.');if(lm.game&&lm.game.pr&&lm.game.pr.toTie)b.push('<b>'+LM_FMT[t.fmt](lm.game.pr.toTie)+'</b> from your record ('+lm.game.pr.best.label+').');if(lm.lagged)b.push('<i>Latest complete day; today is live in GHL.</i>');return b;}
function lmHome(M,person,lens,team){return '<div class="lm-head"><div><p class="eyebrow">LM Scoreboard</p><h1>'+person+'</h1></div>'+lmPicker(person,team)+'</div><div class="lm-clockbar">this device&rsquo;s clock → <span id="lm-clock">'+lmNowLbl()+'</span></div>'+lmLensBar(person,lens)+lmComp(M,person,lens)+'<section class="lm-hero">'+lmStreakHL(M,lens)+lmPaceDay(M)+'</section><div class="sec-h"><h2>Scoreboard</h2><span class="tag">'+LM_LBL[lens]+' · tap a tile</span></div><section class="lm-tiles">'+LM_TILES.map(t=>lmTile(M,person,lens,t)).join('')+'</section><button class="lm-deals-btn focusbtn" onclick="lmGo(\''+person+'\',\''+lens+'\',\'focus\')">💰 Make More Money — your earning levers →</button><button class="lm-deals-btn" onclick="lmGo(\''+person+'\',\''+lens+'\',\'deals\')">⊞ Deals &amp; Pipeline — '+lmMoney(M.comp.totalOpportunity)+' in play →</button><div class="lm-lb">Solo · self-competition. Head-to-head ranking activates when a 2nd LM joins.</div>';}
function lmDetail(M,person,lens,key){const t=lmTileDef(key),lm=M.lenses[lens][key],g=lm.game;let h='<button class="lm-back" onclick="lmGo(\''+person+'\',\''+lens+'\',\'\')">‹ Scoreboard</button><div class="lm-head"><div><p class="eyebrow">'+(lens==='today'?lmRel(lm.anchorDate):LM_LBL[lens])+'</p><h1>'+t.label+'</h1></div>'+lmLensBar(person,lens,key)+'</div><div class="lm-big '+lmPaceCls(lm.paceState)+'">'+LM_FMT[t.fmt](lm.current)+'</div><div class="lm-cmp">'+lmDelta(lm.comparePct,t.low)+' vs '+LM_PRIOR[lens]+' ('+LM_FMT[t.fmt](lm.comparison)+')</div>'+lmBars(lm,t)+(LM_CALLKEYS[key]?lmCallLadder(M,lens,key):'');if(g){h+='<div class="lm-gcards">';if(g.streak)h+='<div class="lm-gc"><div class="lm-gl">Streak</div><div class="lm-gv">'+g.streak.current+'</div><div class="lm-gs">best '+g.streak.best+' '+LM_UNIT[lens]+'s</div></div>';if(g.pr&&g.pr.best)h+='<div class="lm-gc"><div class="lm-gl">Personal record</div><div class="lm-gv">'+LM_FMT[t.fmt](g.pr.best.value)+'</div><div class="lm-gs">'+g.pr.best.label+(g.pr.toTie?' · '+LM_FMT[t.fmt](g.pr.toTie)+' to tie':(g.pr.isRecord?' · NEW 🎉':''))+'</div></div>';if(g.paceToBeat&&g.paceToBeat.remaining!=null&&g.paceToBeat.daysLeft>0)h+='<div class="lm-gc"><div class="lm-gl">Pace to beat '+g.paceToBeat.basis+'</div><div class="lm-gv">'+(Math.round(g.paceToBeat.perDayNeeded*10)/10)+'/day</div><div class="lm-gs">'+LM_FMT[t.fmt](g.paceToBeat.remaining)+' over '+g.paceToBeat.daysLeft+'d</div></div>';h+='</div>';}h+='<div class="card chart-card"><h3>'+t.label+' · '+LM_LBL[lens]+'</h3><p class="sub">'+(RATIO2[key]?'two lines = the counts behind the % (e.g. showed vs booked)':'solid = you · dashed = your avg'+(g&&g.bars&&g.bars.target!=null?' · dotted = target':''))+'</p><div class="chart-wrap"><canvas id="lmchart"></canvas></div></div><div class="lm-diag"><div class="lm-d-h">READOUT</div>'+lmDiag(lm,t,lens).map(x=>'<p>'+x+'</p>').join('')+'</div>';h+=lmCoachBlock(M,key)+lmRecList(M,key,lens);return h;}
/* ── records, dual-line ratios, coaching, deals view ── */
function inWin(d,w){return !!(d&&d.getTime()>=w.start.getTime()&&d.getTime()<=w.end.getTime());}
function lmWin(M,key,lens){const lm=M.lenses[lens][key],a=(lens==='today'&&lm&&lm.anchorDate)?LMEngine.eod(lm.anchorDate):M.asOf;return LMEngine.lensWindow(a,lens);}
const RECF={
  leads:{r:'leads',d:r=>r.date,det:r=>r.source||''},
  apptsBooked:{r:'appts',f:r=>/confirmed/i.test(r.outcome),d:r=>r.conf,det:r=>r.property||''},
  apptsShowed:{r:'appts',f:r=>/showed/i.test(r.outcome),d:r=>r.dispo,det:r=>r.property||''},
  showRate:{r:'appts',f:r=>/showed|no show/i.test(r.outcome),d:r=>r.dispo,det:r=>r.outcome},
  leadToAppt:{r:'appts',f:r=>/confirmed/i.test(r.outcome),d:r=>r.conf,det:r=>r.property||''},
  apptToContract:{r:'contracts',f:r=>/signed/i.test(r.outcome),d:r=>r.signed,det:r=>r.property||''},
  contractsSigned:{r:'contracts',f:r=>/signed/i.test(r.outcome),d:r=>r.signed,det:r=>r.property||''},
  offersMade:{r:'offers',f:r=>/made/i.test(r.outcome)&&r.made,d:r=>r.made,det:r=>r.property||''},
  speed:{r:'speed',d:r=>r.date,det:r=>Math.round(r.speed)+' min · '+(r.source||'')}
};
const RATIO2={showRate:['apptsShowed','apptsBooked',['Showed','Booked']],leadToAppt:['apptsBooked','leads',['Appts','Leads']],apptToContract:['contractsSigned','apptsShowed',['Contracts','Showed']],connectRate:['conversations','calls',['Conversations','Dials']]};
function lmRecList(M,key,lens){
  const sp=RECF[key];if(!sp||!M.records)return '';
  const w=lmWin(M,key,lens),recs=M.records[sp.r]||[];
  let rows=recs.filter(r=>(!sp.f||sp.f(r))).map(r=>({d:sp.d(r),name:r.name||'—',det:sp.det(r)})).filter(x=>inWin(x.d,w));
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
    conversations:'Real conversations (≥75s) are the ONE call metric that matters — no-answers and voicemails don’t count. Target ~3/day. Each one is a chance to book; lift this and appts follow.',
    connectRate:'Of every dial, how many become a real ≥75s conversation. Yours is the leading quality signal — better openers turn more pickups into talks without dialing more.',
    qualifying:'Qualifying calls (≥10 min) are the premium avenue — a real discovery conversation. These convert to appts/offers far above any other call. Few and high-value: protect and grow them.',
    outbound:'Outbound is your controllable input. More dials → more conversations → more appts at your '+P(l2a)+' booking rate.',
    talkTime:'Talk time = conversation quality. Deeper conversations lift your booking rate (now '+P(l2a)+').',
    leads:'Each lead worked is worth ~'+lmMoney(l2a*perShow)+' to you (book '+P(l2a)+' → show '+P(sr)+' → contract '+P(a2c)+' × $'+Math.round(perK)+'/contract).',
    apptsBooked:'Every booked appt ≈ '+lmMoney(perAppt)+' to you (show '+P(sr)+' × contract '+P(a2c)+' × $'+Math.round(perK)+'). Book more, earn more.',
    apptsShowed:'A show is ~'+lmMoney(perShow)+' to you at your '+P(a2c)+' contract rate. Getting them to show is the unlock — speed-to-lead drives it.',
    showRate:'Show rate is a money lever: each appt that actually shows ≈ '+lmMoney(perShow)+'. The #1 driver of shows is fast first-touch — see Speed.',
    speed:'Faster first-touch lifts shows. Your YTD avg is '+Math.round(y.speed.current||0)+' min; sub-5-min is the target. Every extra show ≈ '+lmMoney(perShow)+' to you.',
    leadToAppt:'Booking rate sets appt volume. At '+P(a2c)+' Appt→Contract and $'+Math.round(perK)+'/contract, each appt you book ≈ '+lmMoney(perAppt)+'.',
    apptToContract:'Your highest-$ lever: each contract ≈ $'+Math.round(perK)+' to you. Lifting Appt→Contract from '+P(a2c)+' compounds across every show you get.',
    offersMade:'Offers out become money once they go Under Contract — each ≈ $'+Math.round(perK)+' to you at the avg fee.',
    contractsSigned:'A signed contract is real money pending close — your '+lmMoney(perK)+' cut earmarks the moment its dispo goes Under Contract.'
  };
  return L[key]||'';
}
function lmCoachBlock(M,key){const x=lmCoach(M,key);return x?'<div class="lm-coach"><div class="lm-d-h">COACH — what moves the number</div><p>'+x+'</p></div>':'';}
function lmDealList(title,deals){if(!deals||!deals.length)return '';return '<div class="lm-reclist"><div class="lm-rec-h">'+title+' ('+deals.length+')</div>'+deals.map(d=>'<div class="lm-rec"><div class="lm-rmain"><div class="lm-rn">'+d.name+'</div>'+(d.stage?'<div class="lm-rsub">'+d.stage+'</div>':'')+'</div><div class="lm-rmetric lm-rd br">'+lmMoney(d.cut)+'</div></div>').join('')+'</div>';}
function lmOfferList(title,offers){if(!offers||!offers.length)return '';return '<div class="lm-reclist"><div class="lm-rec-h">'+title+' ('+offers.length+')</div>'+offers.map(o=>'<div class="lm-rec"><div class="lm-rmain"><div class="lm-rn">'+o.name+'</div>'+(o.property?'<div class="lm-rsub">'+o.property+'</div>':'')+'</div><div class="lm-rmetric lm-rd">~'+lmMoney(o.est)+'</div></div>').join('')+'</div>';}
/* Per-bucket earnings view — opened from a comp card. Focuses on ONE stage of
   money (Earned/Earmarked/Projected/Potential): its $, the exact deals/offers
   in it, and how it advances. Separate from the Funnel & Money (Deals) page. */
const LM_EARN_ORDER=['potential','projected','earmarked','earned'];
function lmEarnView(M,person,lens,bucket){
  const c=M.comp,sp=lmPctF(c.split||0.1);
  const cfg={
    earned:{label:'Earned',cls:'gr',val:c.earned,deals:c.earnedDeals,kind:'deal',sub:'Closed deals — money in hand. Your '+sp+' of each closed wholesale fee.',empty:'No closed deals yet. Earmarked deals land here the day they close.'},
    earmarked:{label:'Earmarked',cls:'br',val:c.earmarked,deals:c.earmarkedDeals,kind:'deal',sub:'Signed AND under contract on the dispo side — a buyer is locked. This banks at close.',empty:'Nothing under contract yet. Projected deals move here once a buyer goes Under Contract.'},
    projected:{label:'Projected',cls:'',val:c.projected,deals:c.projectedDeals,kind:'deal',sub:'Signed, but the dispo side isn’t under contract yet — likely, not locked. Becomes Earmarked when a buyer goes Under Contract.',empty:'No signed-but-pre-contract deals right now.'},
    potential:{label:'Potential',cls:'',val:c.potential,deals:c.openOffers,kind:'offer',sub:'Open offers out, estimated at the avg fee × your '+sp+' split until one gets signed.',empty:'No open offers out right now — make offers to fill this.'}
  };
  const E=cfg[bucket]; if(!E)return '<p class="lede">Unknown earnings stage.</p>';
  let h='<button class="lm-back" onclick="lmGo(\''+person+'\',\''+lens+'\',\'\')">‹ Scoreboard</button>';
  h+='<div class="lm-head"><div><p class="eyebrow">Your money · '+E.label+'</p><h1 class="lm-earn-v '+E.cls+'">'+lmMoney(E.val)+'</h1></div></div>';
  h+='<div class="lm-ladder">'+LM_EARN_ORDER.map(k=>'<button class="lm-lad'+(k===bucket?' on':'')+' '+cfg[k].cls+'" onclick="lmGo(\''+person+'\',\''+lens+'\',\''+k+'\')"><span>'+cfg[k].label+'</span><b>'+lmMoney(cfg[k].val)+'</b></button>').join('<i>›</i>')+'</div>';
  h+='<p class="lede">'+E.sub+'</p>';
  const list=E.kind==='offer'?lmOfferList(E.label+' — offers out',E.deals):lmDealList(E.label,E.deals);
  h+=list||('<div class="lm-reclist"><div class="lm-rec none">'+E.empty+'</div></div>');
  return h;
}
function lmDealsView(M,person,lens){
  const c=M.comp,L=M.lenses[lens];
  const funnel=[['Leads',L.leads.current],['Appts Booked',L.apptsBooked.current],['Showed',L.apptsShowed.current],['Offers Made',L.offersMade.current],['Contracts',L.contractsSigned.current]];
  let h='<button class="lm-back" onclick="lmGo(\''+person+'\',\''+lens+'\',\'\')">‹ Scoreboard</button>';
  h+='<div class="lm-head"><div><p class="eyebrow">Deals &amp; Pipeline</p><h1>Funnel &amp; Money</h1></div>'+lmLensBar(person,lens,'deals')+'</div>';
  h+=lmComp(M,person,lens);
  h+='<div class="sec-h"><h2>Funnel</h2><span class="tag">'+LM_LBL[lens]+'</span></div><div class="lm-funnel">'+funnel.map(f=>'<div class="lm-frow"><span class="lm-fl">'+f[0]+'</span><span class="lm-fv">'+lmNum(f[1])+'</span></div>').join('')+'</div>';
  h+=lmDealList('Under contract — earmarked',c.earmarkedDeals)+lmDealList('Projected — pre-contract',c.projectedDeals)+lmOfferList('Offers out — potential',c.openOffers);
  if(c.earnedDeals.length)h+=lmDealList('Closed — earned',c.earnedDeals);
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
  const start=new Date(2026,3,22),wks=Math.max(1,(M.asOf-start)/6048e5);
  // his ACTUAL current pace — the baseline every sprint is measured against
  const bookedYtd=y.apptsBooked.current||0,callsYtd=y.calls.current||0,showsYtd=y.apptsShowed.current||0,leadsYtd=(y.leads&&y.leads.current)||0;
  const apptsWk=bookedYtd/wks,dialsDay=callsYtd/(wks*5),showsWk=showsYtd/wks,leadsWk=leadsYtd/wks;
  const dealsMo=(monthGoal&&avgDeal)?monthGoal/avgDeal:0;
  const needShows=a2c?dealsMo/a2c:0,needBooked=(a2c&&sr)?dealsMo/a2c/sr:0,needLeads=(a2c&&sr&&l2a)?dealsMo/a2c/sr/l2a:0,needDials=cpb?needBooked*cpb:null;
  return {avgDeal:avgDeal,split:split,perDeal:perDeal,perShow:perShow,perBooked:perBooked,perLead:perLead,perDial:perDial,a2c:a2c,sr:sr,l2a:l2a,tA2C:tA2C,cpb:cpb,apptsWk:apptsWk,dialsDay:dialsDay,showsWk:showsWk,leadsWk:leadsWk,tL2A:(+g.leadToAppt||0.15),monthGoal:monthGoal,dealsMo:dealsMo,needShows:needShows,needBooked:needBooked,needLeads:needLeads,needDials:needDials,lmShareMo:dealsMo*perDeal};
}
function lmBench(){
  if(typeof RAW==='undefined'||!RAW['Calls'])return null;
  const C=RAW['Calls'],h=C[0],ui=h.findIndex(x=>String(x).toLowerCase().trim()==='user'),tci=h.findIndex(x=>/total calls/i.test(x)),tti=h.findIndex(x=>/total talk/i.test(x));
  const cut=new Date(2026,3,22);let jt=0,jc=0,mt=0,mc=0;
  for(let i=1;i<C.length;i++){const u=String(C[i][ui]||''),d=LMEngine.parseDate(C[i][0]),tc=+C[i][tci]||0,tt=+C[i][tti]||0;
    if(u==='Jordan Mathis'){jt+=tt;jc+=tc;}else if(u==='Michael Fichman'&&d&&d<cut){mt+=tt;mc+=tc;}}
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
  const showT=Math.max(f.sr+0.1,0.75),l2aT=Math.max(f.l2a+0.05,f.tL2A||0.15);
  const aimWk=Math.max(Math.ceil(f.apptsWk)+1,Math.round(f.apptsWk*2||2)),aimD=Math.round(f.dialsDay*1.5);
  const P=[
    {key:'appts',title:'Book more appointments',now:'You average '+lmR(f.apptsWk,1)+' booked/wk',goal:'Book '+Math.round(aimWk*3)+' over 3 weeks ('+aimWk+'/wk)',diff:2,dollars:(aimWk-f.apptsWk)*3*f.perBooked,when:when(21)},
    {key:'close',title:'Close more of your shows',now:'You close '+lmPctF(f.a2c)+' of shows',goal:'Take your next 4 shows to '+lmPctF(f.tA2C),diff:3,dollars:4*Math.max(0,f.tA2C-f.a2c)*f.perDeal,when:when(28)},
    {key:'dials',title:'Turn up the dials',now:'You make '+lmR(f.dialsDay,0)+' dials/day',goal:'Hit '+aimD+'/day for a month (+'+lmR(aimD-f.dialsDay,0)+')',diff:1,dollars:Math.max(0,(aimD-f.dialsDay))*mo*f.perDial,when:when(30)},
    {key:'showrate',title:'Cut your no-shows',now:lmPctF(f.sr)+' of booked actually show',goal:'Confirm harder → '+lmPctF(showT)+' show up',diff:2,dollars:bookedMo*Math.max(0,showT-f.sr)*f.perShow,when:when(30)},
    {key:'l2a',title:'Book a bigger slice of leads',now:lmPctF(f.l2a)+' of leads become appts',goal:'Work them to '+lmPctF(l2aT),diff:3,dollars:leadsMo*Math.max(0,l2aT-f.l2a)*f.perBooked,when:when(35)},
    {key:'sat',title:'Work your Saturdays',now:'You run a 5-day week',goal:'Add 4 Saturdays of your normal pace',diff:2,dollars:(f.apptsWk/5)*4*f.perBooked,when:when(30)},
    {key:'dormant',title:'Re-work 10 dead leads',now:'Old "no" ≠ forever',goal:'Re-touch 10 dormant leads',diff:2,dollars:10*f.l2a*f.perBooked,when:when(35)},
    {key:'dormant25',title:'Mine your whole old list',now:'Months of leads sitting cold',goal:'Re-touch 25 dormant leads',diff:2,dollars:25*f.l2a*f.perBooked,when:when(40)},
    {key:'onedeal',title:'Steal one extra close',now:'One deal you’d have let slip',goal:'Push 1 more deal over the line this month',diff:3,dollars:f.perDeal,when:when(0)},
    {key:'speed',title:'Call new leads in 5 min',now:'Speed-to-lead drives booking',goal:'Be first to every fresh lead',diff:1,dollars:leadsMo*0.05*f.perBooked,when:when(30),est:1},
    {key:'talk',title:'Win the conversation',now:'Better calls book more',goal:'Earn ~1 extra appt/week on connect quality',diff:1,dollars:1*wk*f.perBooked,when:when(25),est:1},
    {key:'nozero',title:'Kill your zero-call days',now:'Slow days bleed pipeline',goal:'Hit your dial average every working day',diff:1,dollars:f.dialsDay*2*f.perDial,when:when(30),est:1},
    {key:'confirm',title:'Confirm every appointment',now:'A reminder text saves shows',goal:'Recover ~10% of would-be no-shows',diff:1,dollars:bookedMo*0.10*f.perShow,when:when(30),est:1},
    {key:'sustain',title:'Lock in +1 appt/week',now:'Small bump, compounded',goal:'Hold +1 booked/wk for 3 months',diff:2,dollars:1*wk*3*f.perBooked,when:when(90,'fully banks ~by ')}
  ];
  // effort weeks per lever → drives $/week-of-effort so the pin is the most EFFICIENT lever, not just the biggest total
  const EW={appts:3,close:4,dials:4.33,showrate:4.33,l2a:4.33,sat:4.33,dormant:1.5,dormant25:3,onedeal:4.33,speed:4.33,talk:4.33,nozero:4.33,confirm:4.33,sustain:13};
  // monthly STRETCH phrasing — used only when a lever is pinned as the month's big goal (sustain it all month = bigger, harder)
  const MG={appts:'Hit '+aimWk+' booked every week, all month',close:'Close '+lmPctF(f.tA2C)+' of every show this month',dials:'Hold '+aimD+'/day for the entire month',showrate:'Get '+lmPctF(showT)+' of booked to show, all month',l2a:'Convert '+lmPctF(l2aT)+' of every lead this month',sat:'Work all 4 Saturdays this month',dormant:'Re-touch dead leads every week this month',dormant25:'Mine your whole old list this month',onedeal:'Force 2 extra closes this month',speed:'Be first to every fresh lead, all month',talk:'Win every conversation this month',nozero:'No zero-call days the whole month',confirm:'Confirm every appointment this month',sustain:'Lock +1/wk and hold it all quarter'};
  return P.filter(function(l){return l.dollars && isFinite(l.dollars) && l.dollars>=1;}).map(function(l){l.dollars=Math.round(l.dollars);l.ew=EW[l.key]||4.33;l.rate=l.dollars/l.ew;l.mdollars=Math.round(l.rate*4.33);l.mdiff=Math.min(3,l.diff+1);l.mg=MG[l.key]||'Go all-in on this all month';l.mwhen='banks ~by '+cashBy(30+CLOSE)+' · '+CLOSE+'-day closes';return l;});
}
function lmFocusView(M,person){
  const f=lmFocus(M),first=String(person||'').split(' ')[0]||'You';
  const pay=(l,v)=>'<div class="lm-pay"><span>'+l+'</span><b>'+lmMoney(v)+'</b></div>';
  const CLOSE_DAYS=45;
  const diffName=['','Easy','Medium','Hard'],diffBadge=d=>'<span class="lm-diff d'+d+'">'+('●'.repeat(d)+'○'.repeat(3-d))+' '+diffName[d]+'</span>';
  const card=(L,pin)=>'<div class="lm-scen'+(pin?' pin':'')+'"><div class="lm-scen-l"><div class="lm-scen-t">'+L.title+' '+diffBadge(L.diff)+(L.est?' <span class="lm-est">est.</span>':'')+'</div><div class="lm-scen-now">'+L.now+'</div><div class="lm-scen-goal">→ '+L.goal+'</div></div><div class="lm-scen-r"><div class="lm-scen-v">+'+lmMoney(L.dollars)+'</div><div class="lm-scen-when">'+L.when+'</div></div></div>';
  let h='<button class="lm-back" onclick="lmGo(\''+person+'\',\'ytd\',\'\')">‹ Scoreboard</button>';
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
  const b=lmBench();
  if(b&&b.m!=null&&b.j!=null){h+='<div class="lm-foc"><div class="lm-foc-h">Your bar to beat — talk time per call</div><div class="lm-bench"><div class="lm-bn"><span>You</span><b>'+lmR(b.j,2)+'m</b></div><div class="lm-bn"><span>Michael · pre-hire</span><b>'+lmR(b.m,2)+'m</b></div></div><p class="lm-foc-sub">'+(b.j<b.m?'You’re <b>'+lmR(b.m-b.j,2)+'m shorter</b> per call than the pre-hire bar — and each booked appt is <b>'+lmMoney(f.perBooked)+'</b> to you. Better conversations book more appts.':'You’re matching the pre-hire bar on connect quality — keep it up.')+'</p></div>';}
  return h;
}
/* Shared chart mount — host supplies {mk,css}. Used by the deck (VIEWS.lm) AND Jordan's app. */
function lmChartMount(M,lens,metric,host){var mk=host.mk,css=host.css;try{
  if(!metric||metric==='deals'||metric==='focus'||LM_EARN[metric])return;
  const lm=M.lenses[lens][metric],t=lmTileDef(metric),g=lm.game,gl=css('--glow'),amb=css('--amber'),grn=css('--green'),labels=lm.trend.map(x=>x.label);
  if(RATIO2[metric]){
    const cc=RATIO2[metric],nd=M.lenses[lens][cc[0]].trend.map(x=>x.value),dd=M.lenses[lens][cc[1]].trend.map(x=>x.value);
    mk('lmchart',{type:'line',data:{labels:labels,datasets:[
      {label:cc[2][1],data:dd,borderColor:amb,backgroundColor:'transparent',tension:.3,pointRadius:3,borderWidth:1.6,fill:false,spanGaps:true},
      {label:cc[2][0],data:nd,borderColor:gl,backgroundColor:'rgba(63,208,255,.12)',tension:.3,pointRadius:3,borderWidth:2,fill:true,spanGaps:true}
    ]},options:{plugins:{legend:{display:true,position:'bottom',labels:{boxWidth:10,font:{size:9}}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,title:{display:true,text:'count',font:{size:9}}}},maintainAspectRatio:false}});
    return;
  }
  const sc=t.fmt==='pct'?100:1,r1=v=>(v==null||isNaN(v))?null:Math.round(v*sc*10)/10,data=lm.trend.map(x=>r1(x.value)),unit=t.fmt==='pct'?'%':(t.fmt==='min'||t.fmt==='spd')?'min':'count';
  const ds=[{label:t.label,data:data,borderColor:gl,backgroundColor:'rgba(63,208,255,.12)',fill:true,tension:.3,pointRadius:3,pointBackgroundColor:gl,borderWidth:2,spanGaps:true}];
  if(lm.bar!=null)ds.push({label:'Your avg',data:labels.map(()=>r1(lm.bar)),borderColor:amb,borderDash:[5,4],pointRadius:0,borderWidth:1.4,fill:false});
  const tg=(g&&g.bars&&g.bars.target!=null)?(t.fmt==='pct'&&g.bars.target<=1?g.bars.target*100:g.bars.target):null;
  if(tg!=null)ds.push({label:'Target',data:labels.map(()=>tg),borderColor:grn,borderDash:[2,3],pointRadius:0,borderWidth:1.4,fill:false});
  mk('lmchart',{type:'line',data:{labels:labels,datasets:ds},options:{plugins:{legend:{display:true,position:'bottom',labels:{boxWidth:10,font:{size:9}}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,title:{display:true,text:unit,font:{size:9}}}},maintainAspectRatio:false}});
}catch(e){}}
