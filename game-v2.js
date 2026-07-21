/* Treasure Hunt Expedition V2 — progressively enhanced over the original game. */
(() => {
'use strict';

const SIZE=12, SAVE_KEY='thExpeditionV2';
const FIREBASE_PLAYERS_REST='https://game-bca4b-default-rtdb.asia-southeast1.firebasedatabase.app/treasure_hunt_v2/players';
const FLOOR_THEMES=[
  {name:'Mỏ Than Bỏ Hoang',icon:'🪨',tone:'#64748b',hazard:'water'},
  {name:'Hang Pha Lê',icon:'💎',tone:'#38bdf8',hazard:'water'},
  {name:'Di Tích Cổ',icon:'🏛️',tone:'#a78bfa',hazard:'trap'},
  {name:'Lõi Dung Nham',icon:'🌋',tone:'#f97316',hazard:'lava'}
];
const DIFF={easy:{label:'Dễ',mult:1,time:24,damage:1},medium:{label:'Vừa',mult:2,time:18,damage:1},hard:{label:'Khó',mult:3,time:12,damage:2}};
const UPGRADE_DEFS={
  heart:{name:'Tim bền bỉ',icon:'❤️',max:3,base:90,desc:'+1 tim đầu mỗi ván'},
  energy:{name:'Ba lô năng lượng',icon:'⚡',max:3,base:75,desc:'+15 năng lượng tối đa'},
  sight:{name:'Đèn thợ mỏ',icon:'🔦',max:2,base:100,desc:'Đuốc cháy lâu thêm 4 bước'},
  fortune:{name:'May mắn',icon:'🍀',max:3,base:85,desc:'+12% vàng tìm được'},
  starter:{name:'Túi sinh tồn',icon:'🎒',max:3,base:110,desc:'Thêm vật phẩm đầu ván'}
};
const ACHIEVEMENTS={
  firstWin:['Kho báu đầu tiên','Hoàn thành một chuyến thám hiểm'],
  scholar:['Học giả dưới lòng đất','Trả lời đúng 25 câu'],
  combo5:['Không thể cản phá','Đạt chuỗi 5 câu đúng'],
  rich:['Đại gia hầm mỏ','Sở hữu 500 vàng trong ngân hàng'],
  flawless:['Thám hiểm hoàn hảo','Thắng mà không trả lời sai'],
  explorer:['Nhà thám hiểm','Khám phá 150 ô'],
  gemHunter:['Thợ săn pha lê','Thu thập tổng cộng 20 kim cương'],
  bossSlayer:['Kẻ hạ Golem','Đánh bại boss tầng cuối']
};
const SKINS=[
  {id:'miner',name:'Thợ mỏ',icon:'👷',cost:0},
  {id:'prospector',name:'Nhà khai khoáng',icon:'🧔',cost:180},
  {id:'ninja',name:'Thợ mỏ bóng đêm',icon:'🥷',cost:350},
  {id:'wizard',name:'Pháp sư pha lê',icon:'🧙',cost:600}
];

let profile=loadProfile(), run=null, modal=null, toastTimer=null, questionTimer=null, leaderboard=[];
const DB_ROOMS=DB.ref('treasure_party_rooms_v1');
let onlineRoom={code:'',ref:null,data:null,host:false,listening:false};

function defaultProfile(){return{
  bankGold:0,upgrades:{heart:0,energy:0,sight:0,fortune:0,starter:0},
  achievements:{},unlockedSkins:['miner'],skin:'miner',
  stats:{wins:0,correct:0,wrong:0,steps:0,gems:0,explored:0,bosses:0},
  missions:{day:'',items:[]}
}}
function loadProfile(){try{return mergeProfile(JSON.parse(localStorage.getItem(SAVE_KEY))||{})}catch(_){return defaultProfile()}}
function mergeProfile(p){const d=defaultProfile();return{...d,...p,upgrades:{...d.upgrades,...(p.upgrades||{})},achievements:{...(p.achievements||{})},stats:{...d.stats,...(p.stats||{})},missions:{...d.missions,...(p.missions||{})}}}
function saveProfile(){localStorage.setItem(SAVE_KEY,JSON.stringify(profile));saveIdentity();syncCloud()}
function today(){return new Date().toISOString().slice(0,10)}
function ensureMissions(){
  if(profile.missions.day===today()&&profile.missions.items?.length)return;
  const pool=[
    {id:'correct',name:'Trả lời đúng 8 câu',goal:8,reward:55},
    {id:'gold',name:'Thu thập 180 vàng trong một chuyến',goal:180,reward:65},
    {id:'steps',name:'Đi 60 bước',goal:60,reward:45},
    {id:'gems',name:'Tìm 4 kim cương',goal:4,reward:70},
    {id:'combo',name:'Đạt combo x4',goal:4,reward:60}
  ];
  profile.missions={day:today(),items:shuffle(pool).slice(0,3).map(x=>({...x,value:0,claimed:false}))};saveProfile()
}
function missionAdd(id,value=1,absolute=false){profile.missions.items.forEach(m=>{if(m.id===id&&!m.claimed)m.value=Math.min(m.goal,absolute?Math.max(m.value,value):m.value+value)});saveProfile();renderSide()}
function claimMission(i){const m=profile.missions.items[i];if(!m||m.claimed||m.value<m.goal)return;m.claimed=true;profile.bankGold+=m.reward;log(`Nhiệm vụ hoàn thành: +${m.reward} vàng ngân hàng`,'gold');checkAchievements();saveProfile();renderAll()}
function unlock(id){if(profile.achievements[id])return;profile.achievements[id]=Date.now();const a=ACHIEVEMENTS[id];toast(`🏅 Thành tích: ${a[0]}`);saveProfile()}
function checkAchievements(){
  if(profile.stats.wins>=1)unlock('firstWin');if(profile.stats.correct>=25)unlock('scholar');
  if(profile.bankGold>=500)unlock('rich');if(profile.stats.explored>=150)unlock('explorer');
  if(profile.stats.gems>=20)unlock('gemHunter');if(profile.stats.bosses>=1)unlock('bossSlayer')
}

function shuffle(a){for(let i=a.length-1;i;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
function rand(n){return Math.random()*n|0}
function key(r,c){return `${r},${c}`}
function distance(a,b){return Math.abs(a.r-b.r)+Math.abs(a.c-b.c)}
function skin(){return SKINS.find(s=>s.id===profile.skin)||SKINS[0]}
function maxHearts(){return 3+(profile.upgrades.heart||0)}
function maxEnergy(){return 70+(profile.upgrades.energy||0)*15}

function createRun(options={}){
  const starter=0;
  run={floor:1,board:[],pos:{r:0,c:0},prev:{r:0,c:0},seen:new Set(),
    hearts:3,maxHearts:3,energy:70,maxEnergy:70,
    gold:0,gems:0,keys:0,torch:starter>0?1:0,pickaxe:starter>1?1:0,shield:starter>2?1:0,
    potion:1,compass:0,torchTurns:0,compassTurns:0,pickMode:false,
    combo:0,bestCombo:0,correct:0,wrong:0,steps:0,score:0,explored:0,
    bossHp:3,bossMax:3,bossDefeated:false,finished:false,started:Date.now(),logs:[],usedQuestions:[],party:null};
  generateFloor();if(options.roomData?.board)run.board=options.roomData.board.map(row=>row.map(c=>({...c,baseType:c.baseType||c.type})));initParty(options);log(options.online?'Phòng online bắt đầu! Mỗi người có 15 vòng để kiếm cúp.':'Party bắt đầu! Hãy tung xúc xắc và kiếm nhiều cúp nhất sau 15 vòng.','good');renderAll()
}

function partyPlayer(id,name,icon,color,bot=false){return{id,name,icon,color,bot,pos:{r:0,c:0},cups:0,gold:0,gems:0,keys:0,hearts:3,correct:0,wrong:0,knowledge:0,combo:0,bestCombo:0,steps:0,monsters:0,cleared:new Set()}}
function initParty(options={}){let players;if(options.online){const colors=['#fbbf24','#fb7185','#60a5fa','#a78bfa','#34d399','#f97316'];players=Object.entries(options.roomData?.players||{}).map(([id,p],i)=>partyPlayer(id,p.name,p.icon||'👷',colors[i%colors.length],false));players.sort((a,b)=>a.id===G.myPlayerId?-1:b.id===G.myPlayerId?1:0)}else players=[partyPlayer('human',G.myPlayerName||'Bạn',skin().icon,'#fbbf24'),partyPlayer('ruby','Ruby','👩‍🚀','#fb7185',true),partyPlayer('max','Max','🧑‍🔧','#60a5fa',true),partyPlayer('luna','Luna','🧝','#a78bfa',true)];run.party={round:1,maxRounds:15,phase:'roll',movesLeft:0,pendingStep:false,players,bonuses:[],bonusIndex:0,rewardsCommitted:false,online:!!options.online,roomCode:options.roomCode||''};applyOnlineStates(options.roomData?.states||{})}
function humanParty(){return run?.party?.players?.find(p=>run.party.online?p.id===G.myPlayerId:!p.bot)||null}
function syncHumanParty(){const p=humanParty();if(!p)return;p.pos={...run.pos};p.gold=run.gold;p.gems=run.gems;p.keys=run.keys;p.hearts=run.hearts;p.correct=run.correct;p.wrong=run.wrong;p.combo=run.combo;p.bestCombo=run.bestCombo;p.steps=run.steps}
function renderPartyPanel(){const box=document.getElementById('v2Party');if(!box||!run.party)return;syncHumanParty();const humanId=humanParty()?.id;document.getElementById('v2Round').textContent=`Vòng ${run.party.round}/${run.party.maxRounds}`;const ordered=[...run.party.players].sort((a,b)=>b.cups-a.cups||b.gold-a.gold);box.innerHTML=ordered.map((p,i)=>`<div class="v2-party-row ${p.id===humanId?'me':''}"><span class="v2-party-rank">${i+1}</span><span class="v2-party-avatar" style="--party-color:${p.color}">${p.icon}</span><span class="v2-party-name">${escapeHtml(p.name)}${p.id===humanId?' (Bạn)':''}<small>🪙 ${p.gold} · 💎 ${p.gems} · ❤️ ${p.hearts}</small></span><b>🏆 ${p.cups}</b></div>`).join('')}

function makeCell(type='empty'){return{type,baseType:type,cleared:false}}
function generateFloor(){
  let board;
  for(let attempt=0;attempt<250;attempt++){
    board=Array.from({length:SIZE},()=>Array.from({length:SIZE},()=>makeCell()));
    board[0][0]=makeCell('start');board[SIZE-1][SIZE-1]=makeCell('exit');
    const candidates=[];for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if((r||c)&&(r!==7||c!==7))candidates.push({r,c});
    shuffle(candidates).slice(0,38+run.floor*2).forEach(p=>board[p.r][p.c]=makeCell('wall'));
    if(validPath(board)&&reachableCells(board).length>=88)break
  }
  run.board=board;run.pos={r:0,c:0};run.prev={r:0,c:0};run.seen=new Set();run.keys=0;run.pickMode=false;
  const empty=reachableCells(board).filter(p=>board[p.r][p.c].type==='empty');shuffle(empty);
  const put=(type,n)=>{for(let i=0;i<n&&empty.length;i++){const p=empty.pop();board[p.r][p.c]=makeCell(type)}};
  put('key',1);put('question',12);put('monster',5+run.floor);put('gold',14);put('gem',5);
  put('trap',8);put('torch',3);put('item',5);put('secret',3);put('camp',2);put('merchant',2);
  put(FLOOR_THEMES[run.floor-1].hazard,5);put('cart',2);put('portal',2);
  if(run.floor===4){run.bossHp=3;run.bossDefeated=false}
  revealAround();renderAll()
}
function validPath(b){const q=[{r:0,c:0}],seen=new Set(['0,0']);while(q.length){const p=q.shift();if(p.r===SIZE-1&&p.c===SIZE-1)return true;for(const[dr,dc]of[[1,0],[-1,0],[0,1],[0,-1]]){const r=p.r+dr,c=p.c+dc,k=key(r,c);if(r>=0&&c>=0&&r<SIZE&&c<SIZE&&!seen.has(k)&&b[r][c].type!=='wall'){seen.add(k);q.push({r,c})}}}return false}
function reachableCells(b){const q=[{r:0,c:0}],out=[],seen=new Set(['0,0']);while(q.length){const p=q.shift();out.push(p);for(const[dr,dc]of[[1,0],[-1,0],[0,1],[0,-1]]){const r=p.r+dr,c=p.c+dc,k=key(r,c);if(r>=0&&c>=0&&r<SIZE&&c<SIZE&&!seen.has(k)&&b[r][c].type!=='wall'){seen.add(k);q.push({r,c})}}}return out}

function appHtml(){return `<div class="v2-shell">
  <header class="v2-top"><div class="v2-top-row"><div><div class="v2-brand">🎲 TREASURE PARTY</div><div class="v2-floor" id="v2Floor"></div></div><div class="v2-stats" id="v2Stats"></div></div></header>
  <main class="v2-main"><section class="v2-card v2-board-card"><div class="v2-toolbar"><div class="v2-objective" id="v2Objective"></div><button class="v2-btn v2-roll" id="v2RollBtn" onclick="V2.rollDice()">🎲 Tung xúc xắc</button><button class="v2-btn" onclick="V2.openHelp()">?</button></div><div class="v2-board" id="v2Board" aria-label="Bản đồ hầm mỏ"></div><div class="v2-dpad" aria-label="Điều khiển di chuyển"><button aria-label="Đi lên" onclick="V2.go(-1,0)">▲</button><button aria-label="Đi sang trái" onclick="V2.go(0,-1)">◀</button><button class="v2-dpad-center" disabled>⛏️</button><button aria-label="Đi sang phải" onclick="V2.go(0,1)">▶</button><button aria-label="Đi xuống" onclick="V2.go(1,0)">▼</button></div><div class="v2-inventory" id="v2Inventory"></div></section>
  <aside class="v2-side"><section class="v2-card v2-section"><div class="v2-title">🏁 Bảng đấu Party <small id="v2Round"></small></div><div id="v2Party"></div></section><section class="v2-card v2-section"><div class="v2-title">📜 Nhật ký <small id="v2Accuracy"></small></div><div class="v2-log" id="v2Log"></div></section><section class="v2-card v2-section"><div class="v2-title">🎯 Nhiệm vụ ngày <small id="v2Bank"></small></div><div id="v2Missions"></div></section><section class="v2-card v2-section"><div class="v2-title">Trại thám hiểm</div><div class="v2-actions"><button class="v2-btn gold" onclick="V2.openUpgrades()">⬆️ Nâng cấp</button><button class="v2-btn" onclick="V2.openAchievements()">🏅 Thành tích</button><button class="v2-btn" onclick="V2.openRanking()">🏆 Xếp hạng</button><button class="v2-btn" onclick="V2.confirmRestart()">🔄 Ván mới</button></div></section></aside></main></div><div class="v2-toast" id="v2Toast"></div>`}

const ICONS={start:'🏕️',exit:'🚪',wall:'🪨',question:'📦',monster:'👹',gold:'🪙',gem:'💎',key:'🗝️',trap:'🕳️',torch:'🔥',item:'🎒',secret:'❔',camp:'⛺',merchant:'🧙‍♂️',water:'💧',lava:'🌋',cart:'🛒',portal:'🌀',empty:'',cleared:''};
function renderAll(){renderTop();renderBoard();renderInventory();renderSide()}
function renderTop(){if(!run)return;document.getElementById('v2Floor').textContent=`🎉 Party · Vòng ${run.party?.round||1}/${run.party?.maxRounds||15}`;document.body.style.setProperty('--miner',`'${skin().icon}'`);document.getElementById('v2Stats').innerHTML=`<span class="v2-pill danger">❤️ ${run.hearts}/${run.maxHearts}</span><span class="v2-pill energy">⚡ ${run.energy}/${run.maxEnergy}</span><span class="v2-pill">🏆 ${humanParty()?.cups||0}</span><span class="v2-pill">🪙 ${run.gold}</span><span class="v2-pill combo">🔥 x${run.combo}</span>`;const p=run.party,roll=document.getElementById('v2RollBtn');if(p){roll.disabled=p.phase!=='roll';roll.textContent=p.phase==='move'?`🎲 Còn ${p.movesLeft} bước`:'🎲 Tung xúc xắc';document.getElementById('v2Objective').innerHTML=p.phase==='roll'?`Lượt của bạn — tung xúc xắc để bắt đầu.`:`Chọn hướng đi · còn <b>${p.movesLeft}</b> bước · ${run.keys?'đã có 🗝️, hãy tới 🚪':'hãy tìm 🗝️'}`}}
function sightRadius(){return SIZE*2}
function revealAround(){for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){const k=key(r,c);if(!run.seen.has(k)){run.seen.add(k);run.explored++;profile.stats.explored++}}}
function renderBoard(){if(!run)return;const el=document.getElementById('v2Board');if(!el)return;el.innerHTML='';const human=humanParty();for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){const cell=run.board[r][c],isPlayer=r===run.pos.r&&c===run.pos.c,others=(run.party?.players||[]).filter(p=>p.id!==human?.id&&p.pos.r===r&&p.pos.c===c),d=document.createElement('div'),tileIcon=ICONS[cell.cleared?'cleared':cell.type]||'';d.className=`v2-cell ${(r+c)%2?'v2-odd':'v2-even'} ${cell.type} seen near ${isPlayer?'player':''}`;d.setAttribute('aria-label',isPlayer?`Người chơi trên ô ${cell.type}`:cell.type);if(isPlayer){d.innerHTML=tileIcon?`<div class="v2-cell-pair"><span class="v2-under-icon">${tileIcon}</span><span class="v2-player-icon">${skin().icon}</span></div>`:`<span class="v2-player-icon solo">${skin().icon}</span>`}else{d.innerHTML=`<span class="v2-marker">${tileIcon}</span>${cell.type==='exit'?`<small class="v2-small">${run.keys?'MỞ':'KHÓA'}</small>`:''}`};if(others.length)d.insertAdjacentHTML('beforeend',`<div class="v2-bot-stack">${others.map(b=>`<span style="--party-color:${b.color}" title="${escapeHtml(b.name)}">${b.icon}</span>`).join('')}</div>`);el.appendChild(d)}}
function renderInventory(){const items=[['torch','🔥','Đuốc',run.torch],['pickaxe','⛏️','Cuốc',run.pickaxe],['shield','🛡️','Khiên',run.shield],['potion','🧪','Thuốc',run.potion],['compass','🧭','La bàn',run.compass],['key','🗝️','Chìa',run.keys]];document.getElementById('v2Inventory').innerHTML=items.map(([id,ic,n,v])=>`<button class="v2-item" onclick="V2.useItem('${id}')" ${v<=0||id==='key'?'disabled':''}><span>${ic}</span>${n} · ${v}</button>`).join('')}
function renderSide(){if(!run)return;renderPartyPanel();document.getElementById('v2Accuracy').textContent=run.correct+run.wrong?`${Math.round(run.correct/(run.correct+run.wrong)*100)}% đúng`:'';document.getElementById('v2Log').innerHTML=run.logs.slice(-9).reverse().map(x=>`<div class="v2-log-line ${x.kind}">${x.text}</div>`).join('');document.getElementById('v2Bank').textContent=`🏦 ${profile.bankGold}`;document.getElementById('v2Missions').innerHTML=profile.missions.items.map((m,i)=>`<div class="v2-mission"><div style="display:flex;justify-content:space-between"><span>${m.name}</span><b>${m.value}/${m.goal}</b></div><div class="v2-progress"><i style="width:${Math.min(100,m.value/m.goal*100)}%"></i></div>${m.value>=m.goal&&!m.claimed?`<button class="v2-btn green" style="width:100%;margin-top:5px" onclick="V2.claimMission(${i})">Nhận ${m.reward} 🪙</button>`:m.claimed?'<small style="color:#4ade80">✓ Đã nhận</small>':''}</div>`).join('')}
function log(text,kind=''){if(!run)return;run.logs.push({text,kind});if(run.logs.length>30)run.logs.shift();renderSide()}
function toast(text){const el=document.getElementById('v2Toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300)}

function rollDice(){if(!run?.party||run.finished||modal||run.party.phase!=='roll')return;const dice=1+rand(6);run.party.movesLeft=dice;run.party.phase='move';toast(`🎲 Bạn tung được ${dice}!`);log(`Vòng ${run.party.round}: bạn tung được ${dice}.`,'good');renderAll()}
function finishHumanStep(){if(!run?.party||run.finished)return;syncHumanParty();if(run.party.online)syncOnlinePlayer();if(run.party.movesLeft>0){renderAll();return}run.party.phase='bots';renderAll();setTimeout(runBotTurns,450)}
function targetForBot(bot){if(bot.keys>0)return{r:SIZE-1,c:SIZE-1};for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(run.board[r][c].baseType==='key')return{r,c};return{r:SIZE-1,c:SIZE-1}}
function nextBotStep(start,target){const q=[start],seen=new Set([key(start.r,start.c)]),prev=new Map();while(q.length){const p=q.shift();if(p.r===target.r&&p.c===target.c)break;for(const[dr,dc]of shuffle([[1,0],[-1,0],[0,1],[0,-1]])){const n={r:p.r+dr,c:p.c+dc},k=key(n.r,n.c);if(n.r>=0&&n.c>=0&&n.r<SIZE&&n.c<SIZE&&!seen.has(k)&&run.board[n.r][n.c].type!=='wall'){seen.add(k);prev.set(k,p);q.push(n)}}}let cur=target;if(!seen.has(key(cur.r,cur.c))){const options=[[1,0],[-1,0],[0,1],[0,-1]].map(([dr,dc])=>({r:start.r+dr,c:start.c+dc})).filter(n=>n.r>=0&&n.c>=0&&n.r<SIZE&&n.c<SIZE&&run.board[n.r][n.c].type!=='wall');return options[rand(options.length)]||start}while(prev.has(key(cur.r,cur.c))){const p=prev.get(key(cur.r,cur.c));if(p.r===start.r&&p.c===start.c)return cur;cur=p}return start}
function resolveBotCell(bot){const cell=run.board[bot.pos.r][bot.pos.c],type=cell.baseType||cell.type,k=key(bot.pos.r,bot.pos.c),once=!bot.cleared.has(k);if(!once&&!['water','lava','exit'].includes(type))return;switch(type){
  case'gold':bot.gold+=12+rand(20);bot.cleared.add(k);break;
  case'gem':bot.gems++;bot.cleared.add(k);break;
  case'key':bot.keys=1;bot.cleared.add(k);break;
  case'trap':bot.hearts=Math.max(1,bot.hearts-1);bot.cleared.add(k);break;
  case'lava':bot.hearts=Math.max(1,bot.hearts-1);break;
  case'camp':bot.hearts=Math.min(3,bot.hearts+1);bot.cleared.add(k);break;
  case'secret':bot.gold+=25+rand(45);bot.cleared.add(k);break;
  case'question':case'monster':{const chance=bot.id==='luna'?0.84:bot.id==='max'?0.77:0.7,ok=Math.random()<chance;if(ok){bot.correct++;bot.combo++;bot.bestCombo=Math.max(bot.bestCombo,bot.combo);bot.knowledge+=1+rand(3);bot.gold+=10+bot.combo*2;if(type==='monster')bot.monsters++}else{bot.wrong++;bot.combo=0;bot.hearts=Math.max(1,bot.hearts-1)}bot.cleared.add(k);break}
  case'exit':if(bot.keys>0){bot.keys=0;bot.cups++;bot.gold+=30;bot.pos={r:0,c:0};const keyPos=(()=>{for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(run.board[r][c].baseType==='key')return key(r,c)})();if(keyPos)bot.cleared.delete(keyPos);log(`${bot.icon} ${bot.name} vừa nhận 1 cúp!`,'gold')}break
}}
function runBotTurns(){if(!run?.party||run.finished)return;if(run.party.online){finishOnlineRound();return}for(const bot of run.party.players.filter(p=>p.bot)){const dice=1+rand(6);for(let i=0;i<dice;i++){const next=nextBotStep(bot.pos,targetForBot(bot));bot.pos={...next};bot.steps++;resolveBotCell(bot)}}renderAll();if(run.party.round>=run.party.maxRounds){setTimeout(endPartyMatch,550);return}run.party.round++;run.party.phase='roll';run.party.movesLeft=0;log(`Bắt đầu vòng ${run.party.round}. Đến lượt bạn!`,'good');renderAll()}

function move(dr,dc){
  if(!run||run.finished||modal)return;if(run.party&&run.party.phase!=='move'){toast(run.party.phase==='roll'?'🎲 Hãy tung xúc xắc trước!':'Đang chờ các đối thủ…');return}const nr=run.pos.r+dr,nc=run.pos.c+dc;if(nr<0||nc<0||nr>=SIZE||nc>=SIZE)return;
  const cell=run.board[nr][nc];
  if(cell.type==='wall'){
    if(run.pickMode&&run.pickaxe>0){run.pickaxe--;run.pickMode=false;run.board[nr][nc]=makeCell('empty');log('Bạn phá tảng đá và mở một lối mới.','good');renderAll();return}
    run.pickMode=false;toast('🪨 Đường bị chặn. Dùng cuốc để phá đá.');return
  }
  run.prev={...run.pos};run.pos={r:nr,c:nc};run.steps++;if(run.party)run.party.movesLeft=Math.max(0,run.party.movesLeft-1);profile.stats.steps++;missionAdd('steps');
  const energyCost=run.torchTurns>0?(cell.type==='water'?1:0):(cell.type==='water'?3:1);
  spendEnergy(energyCost);if(run.finished)return;
  if(run.torchTurns>0)run.torchTurns--;if(run.compassTurns>0)run.compassTurns--;revealAround();renderAll();resolveCell(cell,nr,nc);if(!modal)finishHumanStep()
}
function spendEnergy(n){run.energy=Math.max(0,run.energy-n);if(run.energy===0){damage(1,'Kiệt sức! Bạn mất 1 tim và hồi lại một nửa năng lượng.');run.energy=Math.ceil(run.maxEnergy/2)}}
function resolveCell(cell,r,c){
  if(cell.cleared||cell.type==='empty'||cell.type==='start')return;
  switch(cell.type){
    case'gold':{const fortune=run.party?0:(profile.upgrades.fortune||0);const gain=Math.round((12+rand(20))*(1+fortune*.12));run.gold+=gain;run.score+=gain;missionAdd('gold',run.gold,true);clearCell(cell);log(`Tìm thấy ${gain} vàng.`,'gold');break}
    case'gem':run.gems++;run.score+=55;profile.stats.gems++;missionAdd('gems');clearCell(cell);log('Tìm thấy một viên kim cương hiếm!','gold');checkAchievements();break;
    case'key':run.keys++;clearCell(cell);log('Đã tìm được chìa khóa kho báu.','good');toast('🗝️ Bạn có thể tới cửa để nhận cúp!');break;
    case'torch':run.torch++;clearCell(cell);log('Nhặt được một bó đuốc.','good');break;
    case'item':giveRandomItem();clearCell(cell);break;
    case'trap':clearCell(cell);if(run.shield>0){run.shield--;log('Khiên đã chặn bẫy sập.','good')}else damage(1,'Bạn dẫm phải bẫy sập!');break;
    case'lava':if(run.shield>0){run.shield--;log('Khiên bảo vệ bạn khỏi dung nham.','good')}else damage(1,'Dung nham thiêu cháy một tim!');break;
    case'water':log('Nước sâu làm tốn thêm năng lượng.','bad');break;
    case'camp':run.energy=Math.min(run.maxEnergy,run.energy+30);run.hearts=Math.min(run.maxHearts,run.hearts+1);clearCell(cell);log('Nghỉ tại trại: hồi năng lượng và 1 tim.','good');break;
    case'secret':openSecret(cell);break;
    case'cart':teleportTo('cart',r,c,'Xe goòng đưa bạn xuyên qua đường hầm!');break;
    case'portal':teleportTo('portal',r,c,'Cổng cổ đại dịch chuyển bạn!');break;
    case'merchant':openMerchant(cell);break;
    case'question':chooseDifficulty({kind:'crate',cell});break;
    case'monster':chooseDifficulty({kind:'monster',cell});break;
    case'exit':enterExit();break
  }
  renderAll()
}
function clearCell(c){c.cleared=true;c.type='empty'}
function giveRandomItem(){const pool=['torch','pickaxe','shield','potion','compass'],id=pool[rand(pool.length)];run[id]++;log(`Túi đồ chứa ${ICONS[id]||{pickaxe:'⛏️',shield:'🛡️',potion:'🧪',compass:'🧭'}[id]} ${id}.`,'good')}
function openSecret(cell){const roll=rand(3);if(roll===0){run.gems++;profile.stats.gems++;log('Căn phòng bí mật chứa một viên kim cương!','gold')}else if(roll===1){run.gold+=60;log('Căn phòng bí mật chứa 60 vàng!','gold')}else{run.potion++;run.shield++;log('Tìm thấy thuốc và khiên trong căn phòng bí mật.','good')}clearCell(cell);missionAdd('gold',run.gold,true);checkAchievements()}
function teleportTo(type,r,c,msg){const targets=[];for(let rr=0;rr<SIZE;rr++)for(let cc=0;cc<SIZE;cc++)if(run.board[rr][cc].type===type&&(rr!==r||cc!==c))targets.push({r:rr,c:cc});if(targets.length){run.pos={...targets[0]};revealAround();log(msg,'good')}}
function damage(n,msg){if(run.shield>0){run.shield--;log(`Khiên hấp thụ sát thương. ${msg}`,'good');return}run.hearts=Math.max(0,run.hearts-n);run.combo=0;log(msg,'bad');toast(msg);if(run.hearts<=0){if(run.party)endPartyMatch();else endRun(false)}}

function useItem(id){if(!run||modal)return;
  if(id==='torch'&&run.torch>0){const duration=12+(run.party?0:(profile.upgrades.sight||0)*4);run.torch--;run.torchTurns+=duration;run.energy=Math.min(run.maxEnergy,run.energy+20);log(`Đuốc hồi 20 năng lượng và cháy trong ${duration} bước.`,'good')}
  if(id==='pickaxe'&&run.pickaxe>0){run.pickMode=!run.pickMode;toast(run.pickMode?'Chọn một tảng đá cạnh bạn để phá.':'Đã cất cuốc.')}
  if(id==='potion'&&run.potion>0&&run.hearts<run.maxHearts){run.potion--;run.hearts=Math.min(run.maxHearts,run.hearts+2);log('Uống thuốc và hồi 2 tim.','good')}
  if(id==='compass'&&run.compass>0){toast('🧭 Hãy dùng La bàn khi bảng câu hỏi đang mở để loại 2 đáp án sai.')}
  renderAll()
}

function chooseDifficulty(ctx){openModal(`<h2>${ctx.kind==='monster'?'👹 Quái vật chặn đường':'📦 Rương kiến thức'}</h2><p>Chọn độ khó. Câu khó cho nhiều vàng và điểm hơn nhưng thời gian ngắn hơn.</p><div class="v2-difficulty">${Object.entries(DIFF).map(([id,d])=>`<button onclick="V2.startQuestion('${id}')"><strong>${d.label} · x${d.mult}</strong><small>${d.time} giây</small></button>`).join('')}</div><button class="v2-btn" style="width:100%;margin-top:10px" onclick="V2.retreat()">Rút lui</button>`,{type:'difficulty',ctx,resumeParty:true})}
function questionComplexity(q){return q.q.length+Math.max(q.a.length,q.b.length,q.c.length,q.d.length)*1.5}
function freshQuestion(diffId){
  const ordered=[...QUESTIONS].sort((a,b)=>questionComplexity(a)-questionComplexity(b)),third=Math.ceil(ordered.length/3);
  const tier=diffId==='easy'?ordered.slice(0,third):diffId==='hard'?ordered.slice(third*2):ordered.slice(third,third*2);
  let available=tier.filter(q=>!run.usedQuestions.includes(q.q));if(!available.length){run.usedQuestions=run.usedQuestions.filter(t=>!tier.some(q=>q.q===t));available=tier}
  const q=available[rand(available.length)];run.usedQuestions.push(q.q);return q
}
function startQuestion(diffId){const ctx=modal.ctx,d=DIFF[diffId],q=freshQuestion(diffId),answers=shuffle([{l:'A',t:q.a},{l:'B',t:q.b},{l:'C',t:q.c},{l:'D',t:q.d}]);openModal(`<h2>❓ ${d.label} · x${d.mult}</h2><p style="color:#f8fafc;font-weight:800;margin:10px 0">${q.q}</p><div class="v2-progress"><i id="v2QuestionTime" style="width:100%"></i></div><div class="v2-choices">${answers.map(a=>`<button class="v2-choice" data-answer="${a.l}" onclick="V2.answer('${a.l}')"><b>${a.l}.</b> ${a.t}</button>`).join('')}</div><button class="v2-btn" style="width:100%;margin-top:10px" onclick="V2.useFifty()" ${run.compass<=0?'disabled':''}>🧭 Dùng la bàn loại 2 đáp án (${run.compass})</button>`,{type:'question',ctx,diffId,q,ends:Date.now()+d.time*1000,resumeParty:true});
  clearInterval(questionTimer);questionTimer=setInterval(()=>{if(!modal||modal.type!=='question')return clearInterval(questionTimer);const left=Math.max(0,modal.ends-Date.now()),bar=document.getElementById('v2QuestionTime');if(bar)bar.style.width=`${left/(d.time*1000)*100}%`;if(left<=0){clearInterval(questionTimer);answer(null)}},100)
}
function useFifty(){if(!modal||modal.type!=='question'||run.compass<=0)return;run.compass--;const wrong=[...document.querySelectorAll('.v2-choice')].filter(b=>b.dataset.answer!==modal.q.ans&&!b.disabled);shuffle(wrong).slice(0,2).forEach(b=>{b.disabled=true;b.style.opacity='.22'});renderInventory()}
function answer(label){if(!modal||modal.type!=='question')return;clearInterval(questionTimer);const {q,ctx,diffId}=modal,d=DIFF[diffId],correct=label===q.ans,buttons=[...document.querySelectorAll('.v2-choice')];buttons.forEach(b=>{b.disabled=true;if(b.dataset.answer===q.ans)b.classList.add('correct');if(label&&b.dataset.answer===label&&!correct)b.classList.add('wrong')});
  if(correct){run.correct++;profile.stats.correct++;run.combo++;run.bestCombo=Math.max(run.bestCombo,run.combo);const reward=8*d.mult+run.combo*2;run.gold+=reward;run.score+=reward*3;if(humanParty())humanParty().knowledge+=d.mult;missionAdd('correct');missionAdd('combo',run.combo,true);if(run.combo>=5)unlock('combo5');log(`Đúng! Combo x${run.combo}, nhận ${reward} vàng.`,'good');
    if(ctx.kind==='boss'){run.bossHp--;if(run.bossHp<=0){run.bossDefeated=true;profile.stats.bosses++;unlock('bossSlayer');log('Golem cổ đại đã bị đánh bại!','gold')}}else{if(ctx.kind==='monster'&&humanParty())humanParty().monsters++;clearCell(ctx.cell)}
  }else{run.wrong++;profile.stats.wrong++;run.combo=0;const dmg=d.damage;setTimeout(()=>damage(dmg,label?'Trả lời sai — bạn phải lùi lại!':'Hết giờ — bạn phải lùi lại!'),250);run.pos={...run.prev}}
  saveProfile();setTimeout(()=>{closeModal();renderAll();if(correct&&ctx.kind==='boss'&&!run.bossDefeated)toast(`Golem còn ${run.bossHp} điểm giáp. Hãy vào cửa lần nữa!`);if(correct&&ctx.kind==='boss'&&run.bossDefeated)enterExit()},750)
}
function retreat(){if(!modal)return;run.pos={...run.prev};closeModal();renderAll()}

function enterExit(){if(run.keys<=0){toast('🔒 Bạn cần tìm chìa khóa trước!');run.pos={...run.prev};renderAll();return}if(run.party){run.keys=0;humanParty().cups++;run.gold+=30;run.pos={r:0,c:0};run.prev={r:0,c:0};for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(run.board[r][c].baseType==='key'){run.board[r][c].type='key';run.board[r][c].cleared=false}log('🏆 Bạn đã mở kho báu và nhận 1 cúp! Quay lại trại để tiếp tục.','gold');toast('🏆 +1 CÚP!');renderAll();return}if(run.floor===4&&!run.bossDefeated){chooseDifficulty({kind:'boss',cell:run.board[SIZE-1][SIZE-1]});return}if(run.floor<4){openModal(`<div class="v2-end"><div class="trophy">${FLOOR_THEMES[run.floor-1].icon}</div><h2>Hoàn thành tầng ${run.floor}</h2><p>Bạn có thể nghỉ ngắn trước khi đi sâu hơn.</p><div class="v2-end-grid"><div class="v2-end-stat"><strong>${run.gold}</strong>Vàng</div><div class="v2-end-stat"><strong>${run.gems}</strong>Kim cương</div></div><button class="v2-btn gold" style="width:100%" onclick="V2.nextFloor()">Xuống tầng ${run.floor+1}</button></div>`,{type:'floorEnd'})}else endRun(true)}
function nextFloor(){run.floor++;run.hearts=Math.min(run.maxHearts,run.hearts+1);run.energy=run.maxEnergy;closeModal();generateFloor();log(`Tiến vào ${FLOOR_THEMES[run.floor-1].name}.`,'gold')}
function endRun(win){if(!run||run.finished)return;run.finished=true;const time=Math.max(1,Math.round((Date.now()-run.started)/1000));const accuracy=run.correct+run.wrong?Math.round(run.correct/(run.correct+run.wrong)*100):0;const deposit=Math.round(run.gold+(win?run.gems*70:run.gems*25));profile.bankGold+=deposit;G.totalMoves=(G.totalMoves||0)+run.steps;if(win){profile.stats.wins++;G.cups=Math.min(999,(G.cups||0)+1);if(run.wrong===0)unlock('flawless')}checkAchievements();saveProfile();syncCloud();openModal(`<div class="v2-end"><div class="trophy">${win?'🏆':'💀'}</div><h2>${win?'KHO BÁU ĐÃ ĐƯỢC TÌM THẤY!':'CHUYẾN ĐI KẾT THÚC'}</h2><p>${win?'Bạn đã vượt qua cả bốn tầng và đánh bại Golem.':'Bạn giữ lại một phần chiến lợi phẩm đã thu thập.'}</p><div class="v2-end-grid"><div class="v2-end-stat"><strong>${deposit}</strong>Vàng gửi ngân hàng</div><div class="v2-end-stat"><strong>${accuracy}%</strong>Độ chính xác</div><div class="v2-end-stat"><strong>${run.bestCombo}</strong>Combo cao nhất</div><div class="v2-end-stat"><strong>${run.steps}</strong>Số bước · ${time}s</div></div><button class="v2-btn gold" style="width:100%" onclick="V2.newRun()">Chơi chuyến mới</button><button class="v2-btn" style="width:100%;margin-top:7px" onclick="V2.openUpgrades()">Dùng vàng nâng cấp</button></div>`,{type:'result',locked:true})}

const PARTY_BONUSES=[
  {id:'scholar',icon:'🧠',name:'Học giả',desc:'Điểm từ câu hỏi cao nhất',value:p=>p.knowledge},
  {id:'accuracy',icon:'🎯',name:'Bậc thầy chính xác',desc:'Tỷ lệ trả lời đúng cao nhất',value:p=>(p.correct+p.wrong)?p.correct/(p.correct+p.wrong):0},
  {id:'combo',icon:'🔥',name:'Vua combo',desc:'Chuỗi trả lời đúng dài nhất',value:p=>p.bestCombo},
  {id:'treasure',icon:'💰',name:'Thợ săn kho báu',desc:'Giá trị vàng và kim cương lớn nhất',value:p=>p.gold+p.gems*50},
  {id:'monster',icon:'⚔️',name:'Kẻ hạ quái',desc:'Đánh bại nhiều quái vật nhất',value:p=>p.monsters},
  {id:'survivor',icon:'❤️',name:'Bậc thầy sinh tồn',desc:'Còn nhiều tim nhất',value:p=>p.hearts}
];
function partyScoreRows(){const humanId=humanParty()?.id;return[...run.party.players].sort((a,b)=>b.cups-a.cups||b.gold-a.gold).map((p,i)=>`<div class="v2-party-result ${p.id===humanId?'me':''}"><span>${i+1}. ${p.icon} <b>${escapeHtml(p.name)}</b></span><strong>🏆 ${p.cups}</strong><small>🪙 ${p.gold} · 💎 ${p.gems}</small></div>`).join('')}
function endPartyMatch(){if(!run?.party||run.party.phase==='ceremony')return;syncHumanParty();run.finished=true;run.party.phase='ceremony';run.party.bonuses=shuffle([...PARTY_BONUSES]).slice(0,3);run.party.bonusIndex=0;openModal(`<div class="v2-end v2-ceremony"><div class="trophy">🎊</div><h2>HẾT 15 VÒNG!</h2><p>Cúp trong trận đã được chốt. Tiếp theo là 3 cúp thành tích bí mật.</p><div class="v2-party-results">${partyScoreRows()}</div><button class="v2-btn gold" style="width:100%;margin-top:12px" onclick="V2.revealBonus()">🎁 Công bố cúp thành tích đầu tiên</button></div>`,{type:'partyCeremony',locked:true})}
function revealBonus(){const p=run.party,index=p.bonusIndex;if(index>=p.bonuses.length)return showPartyFinal();const bonus=p.bonuses[index],values=p.players.map(x=>bonus.value(x)),best=Math.max(...values),winners=p.players.filter(x=>bonus.value(x)===best);winners.forEach(x=>x.cups++);p.bonusIndex++;const winnerText=winners.map(x=>`${x.icon} ${escapeHtml(x.name)}`).join(' & ');openModal(`<div class="v2-end v2-ceremony"><div class="v2-bonus-icon">${bonus.icon}</div><div class="v2-bonus-label">CÚP THÀNH TÍCH ${index+1}/3</div><h2>${bonus.name}</h2><p>${bonus.desc}</p><div class="v2-bonus-winner"><span>${winnerText}</span><strong>+1 🏆</strong></div><div class="v2-party-results">${partyScoreRows()}</div><button class="v2-btn gold" style="width:100%;margin-top:12px" onclick="V2.revealBonus()">${p.bonusIndex<p.bonuses.length?'🎁 Công bố giải tiếp theo':'🏁 Xem kết quả chung cuộc'}</button></div>`,{type:'partyCeremony',locked:true})}
function partyPodium(ordered){const card=(p,rank,cls,crown='')=>p?`<div class="${cls}">${crown}${p.icon}<small>Hạng ${rank}</small><b>${escapeHtml(p.name)}</b><span>🏆 ${p.cups}</span></div>`:'';return`<div class="v2-podium">${card(ordered[1],2,'second')}${card(ordered[0],1,'first','👑<br>')}${card(ordered[2],3,'third')}</div>`}
function showPartyFinal(){const p=run.party,ordered=[...p.players].sort((a,b)=>b.cups-a.cups||b.gold-a.gold||b.knowledge-a.knowledge),human=humanParty(),humanWon=ordered[0].id===human.id;if(!p.rewardsCommitted){p.rewardsCommitted=true;const deposit=run.gold+run.gems*50;profile.bankGold+=deposit;G.cups=Math.min(999,(G.cups||0)+human.cups);G.totalMoves=(G.totalMoves||0)+run.steps;if(humanWon){profile.stats.wins++;if(run.wrong===0)unlock('flawless')}checkAchievements();saveProfile();syncCloud()}openModal(`<div class="v2-end v2-ceremony"><div class="trophy">${humanWon?'👑':'🏁'}</div><h2>${humanWon?'BẠN CHIẾN THẮNG!':'KẾT QUẢ CHUNG CUỘC'}</h2>${partyPodium(ordered)}<p>Bạn nhận <b>${human.cups} cúp</b> vào tài khoản và gửi <b>${run.gold+run.gems*50} vàng</b> vào ngân hàng.</p><button class="v2-btn gold" style="width:100%;margin-top:12px" onclick="${p.online?'V2.modeMenu()':'V2.newRun()'}">${p.online?'↩️ Về menu chính':'🎲 Chơi trận Party mới'}</button></div>`,{type:'partyFinal',locked:true})}

function openMerchant(cell){const offers=[['potion','🧪 Thuốc hồi máu',35],['torch','🔥 Đuốc',25],['pickaxe','⛏️ Cuốc',45],['shield','🛡️ Khiên',55],['compass','🧭 La bàn',50]];openModal(`<h2>🧙‍♂️ Thương nhân dưới lòng đất</h2><p>Vàng trong chuyến đi có thể đổi lấy đồ sinh tồn.</p><div class="v2-shop">${offers.map(([id,n,c])=>`<div class="v2-shop-row"><div class="desc"><strong>${n}</strong>Hữu ích trong chuyến đi hiện tại</div><button class="v2-btn gold" onclick="V2.buyRunItem('${id}',${c})">${c} 🪙</button></div>`).join('')}</div><button class="v2-btn" style="width:100%" onclick="V2.closeModal()">Rời đi</button>`,{type:'merchant',cell,resumeParty:true})}
function buyRunItem(id,cost){if(run.gold<cost)return toast('Không đủ vàng.');run.gold-=cost;run[id]++;log(`Đã mua ${id} với ${cost} vàng.`,'gold');renderAll();openMerchant(modal?.cell||makeCell('merchant'))}

function openUpgrades(){const rows=Object.entries(UPGRADE_DEFS).map(([id,u])=>{const lv=profile.upgrades[id]||0,cost=u.base*(lv+1);return `<div class="v2-shop-row"><div style="font-size:1.5rem">${u.icon}</div><div class="desc"><strong>${u.name} · cấp ${lv}/${u.max}</strong>${u.desc}</div><button class="v2-btn gold" ${lv>=u.max?'disabled':''} onclick="V2.buyUpgrade('${id}')">${lv>=u.max?'MAX':cost+' 🪙'}</button></div>`}).join('');const skinRows=SKINS.map(s=>`<div class="v2-shop-row"><div style="font-size:1.6rem">${s.icon}</div><div class="desc"><strong>${s.name}</strong>${profile.skin===s.id?'Đang sử dụng':profile.unlockedSkins.includes(s.id)?'Đã mở khóa':'Trang phục thám hiểm'}</div><button class="v2-btn" onclick="V2.skinAction('${s.id}')">${profile.unlockedSkins.includes(s.id)?'Chọn':s.cost+' 🪙'}</button></div>`).join('');openModal(`<h2>⬆️ Trại nâng cấp</h2><p>Vàng ngân hàng: <b style="color:#fbbf24">${profile.bankGold} 🪙</b>. Nâng cấp có hiệu lực từ chuyến đi tiếp theo.</p><div class="v2-tabs"><button class="v2-btn gold">Nâng cấp</button><button class="v2-btn">Trang phục</button></div><div class="v2-shop">${rows}<h2 style="margin-top:10px">🎭 Trang phục</h2>${skinRows}</div><button class="v2-btn" style="width:100%" onclick="V2.closeModal()">Đóng</button>`,{type:'upgrade',locked:run?.finished})}
function buyUpgrade(id){const u=UPGRADE_DEFS[id],lv=profile.upgrades[id]||0,cost=u.base*(lv+1);if(lv>=u.max)return;if(profile.bankGold<cost)return toast('Chưa đủ vàng ngân hàng.');profile.bankGold-=cost;profile.upgrades[id]=lv+1;saveProfile();openUpgrades();renderSide()}
function skinAction(id){const s=SKINS.find(x=>x.id===id);if(!s)return;if(!profile.unlockedSkins.includes(id)){if(profile.bankGold<s.cost)return toast('Chưa đủ vàng ngân hàng.');profile.bankGold-=s.cost;profile.unlockedSkins.push(id)}profile.skin=id;saveProfile();renderAll();openUpgrades()}
function openAchievements(){openModal(`<h2>🏅 Thành tích</h2><p>${Object.keys(profile.achievements).length}/${Object.keys(ACHIEVEMENTS).length} đã mở khóa</p><div style="margin-top:12px">${Object.entries(ACHIEVEMENTS).map(([id,a])=>`<div class="v2-achievement ${profile.achievements[id]?'':'locked'}"><b>${profile.achievements[id]?'🏅':'🔒'} ${a[0]}</b><br>${a[1]}</div>`).join('')}</div><button class="v2-btn" style="width:100%;margin-top:8px" onclick="V2.closeModal()">Đóng</button>`,{type:'achievements'})}
function openRanking(){const rows=leaderboard.slice(0,20).map((p,i)=>`<div class="v2-rank ${p.playerId===G.myPlayerId?'me':''}"><b>#${i+1}</b><span style="flex:1">${escapeHtml(p.name||'Ẩn danh')}</span><span>🏆 ${p.cups||0}</span></div>`).join('')||'<p>Chưa tải được bảng xếp hạng.</p>';openModal(`<h2>🏆 Bảng xếp hạng</h2><div>${rows}</div><button class="v2-btn" style="width:100%;margin-top:10px" onclick="V2.closeModal()">Đóng</button>`,{type:'ranking'})}
function openHelp(){
  const tiles=[
    ['🪨','Tảng đá','Không thể đi qua. Bật Cuốc rồi đi về phía tảng đá để phá nó.','neutral','shake'],
    ['📦','Rương câu hỏi','Chọn Dễ, Vừa hoặc Khó. Đúng: rương biến mất và nhận vàng. Sai: mất 1–2 tim, mất combo và lùi lại ô trước.','quiz','pulse'],
    ['👹','Quái vật','Phải trả lời đúng để đánh bại. Trả lời sai sẽ mất tim và bị đẩy lùi.','danger','shake'],
    ['🪙','Vàng','Nhặt ngay khi bước vào. Nhận khoảng 12–31 vàng, nâng cấp May mắn giúp nhận nhiều hơn.','reward','bob'],
    ['💎','Kim cương','Nhận 55 điểm và tăng thưởng cuối chuyến: 70 vàng/viên nếu thắng, 25 vàng/viên nếu thất bại.','reward','sparkle'],
    ['🗝️','Chìa khóa','Bắt buộc phải nhặt trước khi mở kho báu. Sau khi nhận cúp, chìa khóa xuất hiện lại để tiếp tục tranh cúp.','special','bob'],
    ['🕳️','Bẫy sập','Bước vào sẽ mất 1 tim. Nếu có Khiên, khiên bị tiêu hao thay cho tim. Bẫy chỉ kích hoạt một lần.','danger','shake'],
    ['💧','Nước sâu','Không mất tim nhưng mỗi bước trên ô này tiêu hao 3 năng lượng thay vì 1.','danger','wave'],
    ['🌋','Dung nham','Mỗi lần bước vào sẽ mất 1 tim; Khiên có thể chặn một lần. Ô vẫn nguy hiểm khi quay lại.','danger','pulse'],
    ['🔥','Bó đuốc','Nhặt thêm 1 Đuốc. Khi dùng: hồi 20 năng lượng; trong lúc cháy, bước thường không tốn năng lượng và Nước sâu chỉ tốn 1.','reward','flame'],
    ['🎒','Túi vật phẩm','Mở ra một vật phẩm ngẫu nhiên: Đuốc, Cuốc, Khiên, Thuốc hoặc La bàn.','special','bob'],
    ['❔','Phòng bí mật','Có thể chứa 60 vàng, 1 kim cương hoặc bộ Thuốc + Khiên. Chỉ mở một lần.','special','pulse'],
    ['⛺','Trại nghỉ','Hồi ngay 30 năng lượng và 1 tim, nhưng không vượt quá giới hạn tối đa.','safe','bob'],
    ['🧙‍♂️','Thương nhân','Cho phép dùng vàng đang mang để mua vật phẩm sinh tồn cho chuyến hiện tại.','safe','float'],
    ['🛒','Xe goòng','Dịch chuyển tức thì đến xe goòng còn lại trên cùng tầng.','special','slide'],
    ['🌀','Cổng cổ đại','Dịch chuyển tức thì đến cổng còn lại trên cùng tầng.','special','spin'],
    ['🚪','Kho báu cúp','Cần Chìa khóa. Mở thành công nhận +1 cúp và quay về trại; sau đó có thể tiếp tục kiếm cúp.','goal','pulse']
  ];
  const items=[
    ['🔥','Đuốc','Hồi 20 năng lượng và giảm tiêu hao khi di chuyển.'],['⛏️','Cuốc','Bật Cuốc rồi di chuyển vào đá để phá.'],
    ['🛡️','Khiên','Tự động chặn một lần mất tim.'],['🧪','Thuốc','Hồi 2 tim khi chưa đầy máu.'],
    ['🧭','La bàn','Trong câu hỏi, loại bỏ 2 đáp án sai.'],['🗝️','Chìa','Mở kho báu và nhận 1 cúp.']
  ];
  const tileHtml=tiles.map(([icon,name,effect,kind,anim])=>`<div class="v2-guide-card ${kind}"><div class="v2-guide-icon ${anim}">${icon}</div><div><strong>${name}</strong><p>${effect}</p></div></div>`).join('');
  const itemHtml=items.map(([icon,name,effect])=>`<div class="v2-guide-item"><span>${icon}</span><div><strong>${name}</strong><small>${effect}</small></div></div>`).join('');
  openModal(`<div class="v2-guide-head"><div class="v2-guide-compass">🧭</div><div><h2>Sổ tay thám hiểm</h2><p>Biết rõ mỗi biểu tượng trước khi chọn đường đi.</p></div></div>
    <div class="v2-guide-section"><h3>🎮 Luật Party và điều khiển</h3><div class="v2-guide-controls"><div class="v2-guide-keys"><kbd>▲</kbd><div><kbd>◀</kbd><kbd>▼</kbd><kbd>▶</kbd></div></div><p>Mỗi vòng, nhấn <b>🎲 Tung xúc xắc</b> rồi dùng phím mũi tên, WASD, vuốt hoặc cụm điều hướng để đi đúng số bước.<br>Trận có <b>15 vòng</b>. Nhặt 🗝️ và tới 🚪 để nhận cúp. Cuối trận trao thêm 3 cúp thành tích; ai nhiều cúp nhất sẽ thắng.</p></div></div>
    <div class="v2-guide-section"><h3>❤️ Chỉ số sinh tồn</h3><div class="v2-guide-stats"><div><b>❤️ Tim</b><span>Về 0: kết thúc chuyến đi.</span></div><div><b>⚡ Năng lượng</b><span>Mỗi bước mất 1. Về 0: mất 1 tim rồi hồi 50%.</span></div><div><b>🔥 Combo</b><span>Đúng liên tiếp tăng vàng; trả lời sai sẽ về 0.</span></div><div><b>🪙 / 💎</b><span>Đổi thành vàng ngân hàng khi kết thúc.</span></div></div></div>
    <div class="v2-guide-section"><h3>🗺️ Khi bước vào từng ô</h3><div class="v2-guide-legend"><span class="safe">Có lợi</span><span class="reward">Phần thưởng</span><span class="quiz">Câu hỏi</span><span class="danger">Nguy hiểm</span><span class="special">Đặc biệt</span></div><div class="v2-guide-grid">${tileHtml}</div></div>
    <div class="v2-guide-section"><h3>🎒 Cách dùng vật phẩm</h3><div class="v2-guide-items">${itemHtml}</div></div>
    <div class="v2-guide-tip"><span>💡</span><p><b>Mẹo:</b> quan sát toàn bản đồ trước khi đi. Ưu tiên Chìa khóa, Trại nghỉ và vật phẩm; tránh đi lặp qua Dung nham hoặc Nước sâu khi năng lượng thấp.</p></div>
    <button class="v2-btn gold" style="width:100%;margin-top:12px" onclick="V2.closeModal()">⛏️ Bắt đầu thám hiểm</button>`,{type:'help'})
}

function openModal(html,data={}){clearInterval(questionTimer);closeModal(true);const ov=document.createElement('div');ov.className='v2-overlay';ov.innerHTML=`<div class="v2-modal">${html}</div>`;document.body.appendChild(ov);modal={...data,el:ov}}
function closeModal(force=false){if(!modal)return;if(modal.locked&&!force)return;const resume=modal.resumeParty&&!force;clearInterval(questionTimer);modal.el?.remove();modal=null;if(resume)setTimeout(finishHumanStep,0)}
function confirmRestart(){const online=run?.party?.online;openModal(`<h2>${online?'🚪 Rời trận Online?':'🔄 Bắt đầu trận mới?'}</h2><p>${online?'Bạn sẽ rời khỏi phòng và không nhận phần thưởng của trận này.':'Chiến lợi phẩm chưa gửi vào ngân hàng của trận hiện tại sẽ mất.'}</p><div class="v2-actions" style="margin-top:14px"><button class="v2-btn" onclick="V2.closeModal()">Hủy</button><button class="v2-btn primary" onclick="${online?'V2.leaveRoom()':'V2.newRun()'}">${online?'Rời trận':'Bắt đầu lại'}</button></div>`,{type:'confirm'})}

function syncCloud(){if(!G?.myPlayerId)return;const payload={name:G.myPlayerName,playerId:G.myPlayerId,cups:G.cups||0,totalMoves:G.totalMoves||0,expeditionGold:profile.bankGold,expeditionWins:profile.stats.wins,lastActive:firebase.database.ServerValue.TIMESTAMP,online:true};DB_PLAYERS.child(G.myPlayerId).update(payload).catch(()=>{})}
function listenRanks(){DB_PLAYERS.on('value',s=>{leaderboard=Object.values(s.val()||{}).filter(Boolean).sort((a,b)=>(b.cups||0)-(a.cups||0)||(b.expeditionGold||0)-(a.expeditionGold||0))},()=>{})}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function timeoutAfter(ms,label){return new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} quá thời gian chờ (${ms/1000}s)`)),ms))}
async function readPlayersResilient(){
  let sdkError=null;
  try{
    const snap=await Promise.race([DB_PLAYERS.once('value'),timeoutAfter(9000,'Firebase SDK')]);
    return snap.val()||{}
  }catch(e){sdkError=e;console.warn('Firebase SDK read failed, trying REST:',e)}
  try{
    const response=await Promise.race([fetch(`${FIREBASE_PLAYERS_REST}.json`,{cache:'no-store'}),timeoutAfter(9000,'Firebase REST')]);
    if(!response.ok)throw new Error(`Firebase REST HTTP ${response.status}`);
    return await response.json()||{}
  }catch(restError){
    const error=new Error(`SDK: ${sdkError?.code||sdkError?.message||'không rõ'} · REST: ${restError.message}`);
    error.cause=restError;throw error
  }
}
async function writePlayerResilient(playerId,payload,replace=false){
  try{
    const op=replace?DB_PLAYERS.child(playerId).set(payload):DB_PLAYERS.child(playerId).update(payload);
    await Promise.race([op,timeoutAfter(9000,'Ghi Firebase SDK')]);return
  }catch(e){console.warn('Firebase SDK write failed, trying REST:',e)}
  const response=await Promise.race([fetch(`${FIREBASE_PLAYERS_REST}/${encodeURIComponent(playerId)}.json`,{method:replace?'PUT':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),timeoutAfter(9000,'Ghi Firebase REST')]);
  if(!response.ok)throw new Error(`Không thể ghi Firebase (HTTP ${response.status})`)
}
function friendlyFirebaseError(e){
  const raw=e?.code||e?.message||String(e||'Lỗi không xác định');
  if(/permission.denied/i.test(raw))return 'Firebase từ chối quyền truy cập. Hãy kiểm tra Database Rules.';
  if(/network|failed to fetch|connection|offline/i.test(raw))return `Không truy cập được Firebase: ${raw}`;
  return `Lỗi Firebase: ${raw}`
}

function roomPlayerPayload(){return{name:G.myPlayerName,icon:skin().icon,joinedAt:firebase.database.ServerValue.TIMESTAMP,online:true}}
function roomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=chars[rand(chars.length)];return s}
function cleanupRoomListener(){if(onlineRoom.ref&&onlineRoom.listening)onlineRoom.ref.off('value');onlineRoom.listening=false}
function showModeMenu(){cleanupRoomListener();onlineRoom={code:'',ref:null,data:null,host:false,listening:false};openModal(`<div class="v2-end"><div class="trophy">🎲</div><h2>CHỌN CHẾ ĐỘ PARTY</h2><p>Bản đồ 12×12 · tối đa 6 người</p><div class="v2-mode-grid"><button class="v2-mode-card" onclick="V2.startBots()"><span>🤖</span><strong>Đấu với máy</strong><small>Bạn và 3 bot · chơi ngay</small></button><button class="v2-mode-card online" onclick="V2.createRoom()"><span>🌐</span><strong>Tạo phòng Online</strong><small>Nhận mã để mời tối đa 5 người</small></button></div><div class="v2-join-box"><b>Tham gia bằng mã phòng</b><div><input id="v2RoomCode" maxlength="6" placeholder="VD: A7K9PQ" oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'')"><button class="v2-btn gold" onclick="V2.joinRoom()">Tham gia</button></div><small id="v2RoomError"></small></div></div>`,{type:'mode',locked:true})}
function startBots(){closeModal(true);createRun()}
async function createOnlineRoom(){const error=document.getElementById('v2RoomError');if(error)error.textContent='Đang tạo phòng…';try{let code,ref,exists;for(let i=0;i<5;i++){code=roomCode();ref=DB_ROOMS.child(code);exists=(await ref.once('value')).exists();if(!exists)break}await ref.set({code,hostId:G.myPlayerId,status:'lobby',maxPlayers:6,createdAt:firebase.database.ServerValue.TIMESTAMP,players:{[G.myPlayerId]:roomPlayerPayload()}});connectRoom(code,true)}catch(e){if(error)error.textContent=friendlyFirebaseError(e)}}
async function joinOnlineRoom(){const input=document.getElementById('v2RoomCode'),error=document.getElementById('v2RoomError'),code=input?.value.trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(code))return error.textContent='Mã phòng phải có đúng 6 ký tự.';error.textContent='Đang tìm phòng…';try{const ref=DB_ROOMS.child(code);const serverSnapshot=await ref.once('value');const serverRoom=serverSnapshot.val();if(!serverRoom)throw new Error('Không tìm thấy phòng. Hãy kiểm tra lại mã 6 ký tự.');if(serverRoom.status!=='lobby')throw new Error('Trận đấu đã bắt đầu hoặc phòng đã kết thúc.');const serverPlayers=serverRoom.players||{};if(!serverPlayers[G.myPlayerId]&&Object.keys(serverPlayers).length>=6)throw new Error('Phòng đã đủ 6 người.');error.textContent='Đang tham gia…';let reason='';const result=await ref.transaction(room=>{if(!room){reason='Phòng vừa bị đóng.';return}if(room.status!=='lobby'){reason='Trận đấu đã bắt đầu hoặc phòng đã kết thúc.';return}room.players=room.players||{};if(!room.players[G.myPlayerId]&&Object.keys(room.players).length>=6){reason='Phòng đã đủ 6 người.';return}room.players[G.myPlayerId]=roomPlayerPayload();return room});if(!result.committed)throw new Error(reason||'Không thể tham gia phòng. Vui lòng thử lại.');connectRoom(code,result.snapshot.val()?.hostId===G.myPlayerId)}catch(e){error.textContent=e?.message&&/Không tìm thấy|đã bắt đầu|đã kết thúc|đã đủ|vừa bị đóng|Không thể tham gia/.test(e.message)?e.message:friendlyFirebaseError(e)}}
function connectRoom(code,isHost){cleanupRoomListener();onlineRoom={code,ref:DB_ROOMS.child(code),data:null,host:isHost,listening:true};onlineRoom.ref.on('value',snap=>{const data=snap.val();if(!data){toast('Phòng đã đóng.');showModeMenu();return}onlineRoom.data=data;onlineRoom.host=data.hostId===G.myPlayerId;handleRoomData(data)},e=>toast(friendlyFirebaseError(e)));onlineRoom.ref.child(`players/${G.myPlayerId}`).onDisconnect().remove()}
function handleRoomData(data){if(data.status==='lobby'){const ids=Object.keys(data.players||{});if(ids.length&&!data.players?.[data.hostId])onlineRoom.ref.child('hostId').transaction(h=>h===data.hostId?ids[0]:h);renderOnlineLobby(data);return}if(data.status==='playing'){if(!run?.party?.online){closeModal(true);createRun({online:true,roomCode:data.code,roomData:data})}const ids=Object.keys(data.players||{});if(run?.party?.online)run.party.players=run.party.players.filter(p=>ids.includes(p.id));applyOnlineStates(data.states||{});if(run?.party?.online){renderAll();const states=data.states||{};if(ids.length&&ids.every(id=>states[id]?.finished))onlineRoom.ref.child('status').transaction(s=>s==='playing'?'ceremony':s)}}else if(data.status==='ceremony')beginOnlineCeremony(data)}
function renderOnlineLobby(data){const players=Object.entries(data.players||{}),host=data.hostId===G.myPlayerId;openModal(`<div class="v2-end"><div class="v2-room-code-label">MÃ PHÒNG</div><div class="v2-room-code">${escapeHtml(data.code)}</div><p>Gửi mã này cho bạn bè · ${players.length}/6 người</p><div class="v2-lobby-list">${players.map(([id,p],i)=>`<div><span>${p.icon||'👷'}</span><b>${escapeHtml(p.name)}</b>${id===data.hostId?'<small>👑 Chủ phòng</small>':'<small>Đã sẵn sàng</small>'}</div>`).join('')}${Array.from({length:6-players.length},()=>'<div class="empty"><span>＋</span><b>Đang chờ…</b></div>').join('')}</div><button class="v2-btn" style="width:100%" onclick="V2.copyRoom()">📋 Sao chép mã phòng</button>${host?`<button class="v2-btn gold" style="width:100%;margin-top:8px" ${players.length<2?'disabled':''} onclick="V2.startOnline()">🚀 Bắt đầu trận (${players.length}/6)</button><small style="display:block;margin-top:5px;color:#94a3b8">Cần ít nhất 2 người</small>`:'<div class="v2-waiting">⏳ Đang chờ chủ phòng bắt đầu…</div>'}<button class="v2-btn" style="width:100%;margin-top:8px" onclick="V2.leaveRoom()">Rời phòng</button></div>`,{type:'lobby',locked:true})}
async function copyRoomCode(){try{await navigator.clipboard.writeText(onlineRoom.code);toast('📋 Đã sao chép mã phòng!')}catch(_){toast(`Mã phòng: ${onlineRoom.code}`)}}
async function startOnlineRoom(){const data=onlineRoom.data,players=Object.keys(data?.players||{});if(!onlineRoom.host||players.length<2)return;closeModal(true);createRun({online:true,roomCode:onlineRoom.code,roomData:data});const states={};run.party.players.forEach(p=>states[p.id]=onlineState(p));await onlineRoom.ref.update({status:'playing',board:run.board,bonusIds:shuffle(PARTY_BONUSES.map(b=>b.id)).slice(0,3),states,startedAt:firebase.database.ServerValue.TIMESTAMP})}
async function leaveOnlineRoom(){const ref=onlineRoom.ref,status=onlineRoom.data?.status;if(ref){cleanupRoomListener();if(onlineRoom.host&&status==='lobby')await ref.remove().catch(()=>{});else await ref.child(`players/${G.myPlayerId}`).remove().catch(()=>{})}showModeMenu()}
function onlineState(p,extra={}){return{id:p.id,name:p.name,icon:p.icon,pos:p.pos,cups:p.cups,gold:p.gold,gems:p.gems,keys:p.keys,hearts:p.hearts,correct:p.correct,wrong:p.wrong,knowledge:p.knowledge,combo:p.combo,bestCombo:p.bestCombo,steps:p.steps,monsters:p.monsters,round:run?.party?.round||1,finished:false,...extra}}
function applyOnlineStates(states){if(!run?.party?.players)return;for(const p of run.party.players){const s=states[p.id];if(!s||p.id===G.myPlayerId)continue;Object.assign(p,s,{cleared:p.cleared||new Set()})}}
function syncOnlinePlayer(extra={}){if(!run?.party?.online||!onlineRoom.ref)return;syncHumanParty();onlineRoom.ref.child(`states/${G.myPlayerId}`).update(onlineState(humanParty(),extra)).catch(()=>{})}
function finishOnlineRound(){if(!run?.party?.online)return;if(run.party.round>=run.party.maxRounds){syncOnlinePlayer({finished:true,round:run.party.round});run.finished=true;run.party.phase='waiting';openModal(`<div class="v2-end"><div class="trophy">⏳</div><h2>BẠN ĐÃ HOÀN THÀNH!</h2><p>Đang chờ những người chơi còn lại kết thúc 15 vòng…</p><div class="v2-party-results">${partyScoreRows()}</div></div>`,{type:'onlineWaiting',locked:true});return}run.party.round++;run.party.phase='roll';run.party.movesLeft=0;syncOnlinePlayer({round:run.party.round});log(`Bắt đầu vòng ${run.party.round}.`,'good');renderAll()}
function beginOnlineCeremony(data){if(!run?.party?.online||run.party.phase==='ceremony')return;applyOnlineStates(data.states||{});run.finished=true;run.party.phase='ceremony';run.party.bonuses=(data.bonusIds||[]).map(id=>PARTY_BONUSES.find(b=>b.id===id)).filter(Boolean);while(run.party.bonuses.length<3)run.party.bonuses.push(PARTY_BONUSES[run.party.bonuses.length]);run.party.bonusIndex=0;openModal(`<div class="v2-end v2-ceremony"><div class="trophy">🌐</div><h2>MỌI NGƯỜI ĐÃ HOÀN THÀNH!</h2><p>Cúp trong trận đã được chốt. Bắt đầu trao 3 cúp thành tích chung của phòng.</p><div class="v2-party-results">${partyScoreRows()}</div><button class="v2-btn gold" style="width:100%;margin-top:12px" onclick="V2.revealBonus()">🎁 Công bố cúp thành tích đầu tiên</button></div>`,{type:'partyCeremony',locked:true})}

function loginScreen(){openModal(`<div class="v2-end"><div class="trophy">🎲</div><h2>TREASURE PARTY</h2><p>Đăng nhập để chơi với bot hoặc mời tối đa 5 người bạn.</p><input id="v2Name" maxlength="20" placeholder="Tên người chơi" style="width:100%;margin-top:14px;padding:12px;border-radius:10px;border:1px solid #405171;background:#0b111e;color:white"><input id="v2Pass" type="password" maxlength="50" placeholder="Mật khẩu (ít nhất 4 ký tự)" style="width:100%;margin-top:8px;padding:12px;border-radius:10px;border:1px solid #405171;background:#0b111e;color:white"><div id="v2LoginError" style="color:#fca5a5;font-size:.78rem;margin-top:7px"></div><button class="v2-btn gold" style="width:100%;margin-top:10px" onclick="V2.login()">Tiếp tục</button></div>`,{type:'login',locked:true});setTimeout(()=>document.getElementById('v2Name')?.focus(),50)}
async function login(){
  const name=document.getElementById('v2Name')?.value.trim(),pw=document.getElementById('v2Pass')?.value||'',err=document.getElementById('v2LoginError');
  if(!name||name.length<2)return err.textContent='Tên cần ít nhất 2 ký tự.';if(pw.length<4)return err.textContent='Mật khẩu cần ít nhất 4 ký tự.';
  err.textContent='Đang kết nối Firebase…';
  try{
    const data=await readPlayersResilient(),entry=Object.entries(data).find(([,p])=>p?.name?.trim()===name),hashed=await hashPassword(pw);
    if(entry){
      const[id,p]=entry;if(p.password&&p.password!==hashed)return err.textContent='Sai mật khẩu cho tên này.';
      if(!p.password)await writePlayerResilient(id,{password:hashed});
      G.myPlayerId=p.playerId||id;G.myPlayerName=p.name;G.cups=p.cups||0;G.totalMoves=p.totalMoves||0
    }else{
      G.myPlayerId=pid();G.myPlayerName=name;G.cups=0;G.totalMoves=0;
      await writePlayerResilient(G.myPlayerId,{name,playerId:G.myPlayerId,password:hashed,cups:0,totalMoves:0,online:true,lastActive:{'.sv':'timestamp'}},true)
    }
    saveIdentity();closeModal(true);showModeMenu()
  }catch(e){console.error('Treasure Expedition login error:',e);err.textContent=friendlyFirebaseError(e)}
}

function init(){
  document.body.className='v2';document.body.innerHTML=appHtml();ensureMissions();listenRanks();loadIdentity();
  window.addEventListener('keydown',e=>{if(modal||!run)return;const map={ArrowUp:[-1,0],w:[-1,0],W:[-1,0],ArrowDown:[1,0],s:[1,0],S:[1,0],ArrowLeft:[0,-1],a:[0,-1],A:[0,-1],ArrowRight:[0,1],d:[0,1],D:[0,1]};if(map[e.key]){e.preventDefault();move(...map[e.key])}});
  let touch=null;document.addEventListener('touchstart',e=>{if(e.target.closest('.v2-board'))touch={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});document.addEventListener('touchend',e=>{if(!touch||modal)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;touch=null;if(Math.max(Math.abs(dx),Math.abs(dy))<28)return;if(Math.abs(dx)>Math.abs(dy))move(0,dx>0?1:-1);else move(dy>0?1:-1,0)},{passive:true});
  if(G.myPlayerId)showModeMenu();else loginScreen()
}

window.V2={go:move,rollDice,revealBonus,useItem,claimMission,startQuestion,answer,useFifty,retreat,nextFloor,newRun:()=>{closeModal(true);createRun()},modeMenu:showModeMenu,startBots,createRoom:createOnlineRoom,joinRoom:joinOnlineRoom,copyRoom:copyRoomCode,startOnline:startOnlineRoom,leaveRoom:leaveOnlineRoom,buyRunItem,buyUpgrade,skinAction,openUpgrades,openAchievements,openRanking,openHelp,closeModal,confirmRestart,login};
init();
})();
