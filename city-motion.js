(() => {
  'use strict';
  const canvas = document.querySelector('#city-motion');
  const ctx = canvas && canvas.getContext('2d', {alpha:true});
  if (!ctx) return;
  const area = document.querySelector('.map-area');
  const stage = document.querySelector('#map-stage');
  const timeButton = document.querySelector('#city-time');
  const pauseButton = document.querySelector('#city-pause');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  let evening = false;
  let visible = true;
  let clock = 0;
  let lastFrame = 0;
  let frame = 0;
  let scale = 1;
  let width = 1536;
  let height = 1024;
  const TAU = Math.PI * 2;
  const fract = n => n - Math.floor(n);
  const random = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const lerp = (a,b,t) => a + (b-a)*t;
  const canopy = [[120,265],[250,130],[475,110],[595,165],[915,135],[1030,190],[1410,290],[1470,455],[1350,520],[1430,730],[1190,830],[980,925],[530,935],[150,650],[95,445],[410,605],[635,670],[960,460]];
  const leaves = Array.from({length:48},(_,i) => ({
    origin:canopy[i%canopy.length],phase:random(i+5),speed:12+random(i+13)*16,
    size:5+random(i+27)*7+(i%11===0?5:0),drift:45+random(i+39)*100,seed:random(i+61)*TAU,
    color:['#dca640','#e1b95d','#bf712a','#e2c875'][i%4]
  }));
  const motes = Array.from({length:68},(_,i) => ({
    x:90+random(i+90)*1350,y:65+random(i+170)*850,
    phase:random(i+260)*TAU,size:1.8+random(i+345)*3
  }));
  const lamps = [[122,477],[284,482],[446,480],[967,540],[1055,531],[1152,321],[1080,298],[912,685],[1022,747],[462,742],[533,662],[420,377],[549,204]];
  const windows = [[1218,168,8,16],[1241,174,8,16],[1270,181,8,16],[1301,187,8,16],[1354,199,7,15],[1410,212,7,15],[595,410,8,19],[618,410,8,19],[641,412,8,18],[882,409,8,18],[905,408,8,18],[928,408,8,18],[1210,424,9,20],[1344,433,8,20],[1364,433,8,20],[1386,433,8,20],[1228,756,8,18],[1250,745,8,18],[1278,735,8,18],[1312,691,8,18],[707,743,7,16],[798,741,7,16],[238,738,7,26],[332,737,7,26]];
  // Water silhouettes follow the canal, leaving buildings and bridges untouched.
  const water = new Path2D('M270 546 Q323 518 366 548 Q382 566 414 575 Q485 580 560 607 Q622 626 670 615 L674 653 Q600 656 540 635 Q436 615 381 587 Q322 571 279 597Z M1016 302 Q1065 291 1100 319 L1084 334 Q1046 330 1015 341Z M1033 365 Q1065 368 1093 352 L1090 400 Q1078 421 1101 454 L1105 505 L1044 528 Q1039 481 1028 461 L1022 420Z M1010 591 Q1045 579 1095 581 L1100 611 Q1052 614 1024 647 L957 659 L939 636 Q975 621 1010 591Z');
  const routes = [
    [[390,300],[450,335],[513,382],[498,441]],
    [[535,897],[660,911],[829,918],[982,854]],
    [[1001,743],[933,697],[958,652],[1027,643]],
    [[1173,291],[1180,283],[1210,279],[1242,279]]
  ];
  const walkers = [
    {route:0,duration:42,phase:.2,color:'#264c58',size:.78},
    {route:0,duration:42,phase:.24,color:'#a75538',size:.7},
    {route:1,duration:65,phase:.6,color:'#375c61',size:.9},
    {route:1,duration:65,phase:.63,color:'#ab7139',size:.77},
    {route:2,duration:46,phase:.4,color:'#33476b',size:.82},
    {route:3,duration:39,phase:.7,color:'#855643',size:.7}
  ];
  const cruises = [
    {path:[[313,565],[390,580],[532,640],[638,632]],duration:38,phase:.34,size:.82},
    {path:[[1055,383],[1078,407],[1060,464],[1074,505]],duration:29,phase:.74,size:.67}
  ];
  function point(path,t){
    const u=1-t;
    return {x:u*u*u*path[0][0]+3*u*u*t*path[1][0]+3*u*t*t*path[2][0]+t*t*t*path[3][0],y:u*u*u*path[0][1]+3*u*u*t*path[1][1]+3*u*t*t*path[2][1]+t*t*t*path[3][1]};
  }
  function glow(x,y,r,strength,color='255,203,105'){
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,`rgba(${color},${strength})`);
    g.addColorStop(.18,`rgba(${color},${strength*.48})`);
    g.addColorStop(1,`rgba(${color},0)`);
    ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  function drawCloud(x,y,s,opacity){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=opacity;ctx.fillStyle='#fffef8';
    for(const [cx,cy,r] of [[-55,5,24],[-27,-9,34],[7,-23,37],[39,-1,31],[66,9,23]]){
      ctx.beginPath();ctx.ellipse(cx,cy,r,r*.66,0,0,TAU);ctx.fill();
    }
    ctx.restore();
  }
  function drawWater(t){
    ctx.save();ctx.clip(water);ctx.strokeStyle=evening?'#d8cc96':'#e7fff0';ctx.lineWidth=1.3;
    for(let i=0;i<53;i++){
      const x=270+random(i+400)*850;
      const y=300+random(i+480)*350;
      const pulse=.25+.25*Math.sin(t*1.3+i);
      ctx.globalAlpha=pulse;
      ctx.beginPath();ctx.moveTo(x+Math.sin(t*.5+i)*5,y);ctx.quadraticCurveTo(x+10,y-3,x+22,y-1);ctx.stroke();
    }
    ctx.restore();
  }
  function drawBoat(cruise,t){
    const progress=fract(t/cruise.duration+cruise.phase);
    const p=point(cruise.path,progress),ahead=point(cruise.path,Math.min(progress+.01,1));
    const angle=Math.atan2(ahead.y-p.y,ahead.x-p.x);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.scale(cruise.size,cruise.size);
    ctx.globalAlpha=Math.min(1,progress*12,(1-progress)*12);
    ctx.strokeStyle=evening?'#d8d0a6':'#f2fcdf';ctx.lineWidth=1.7;
    for(let i=0;i<3;i++){
      const wake=(t*9+i*15)%45;
      ctx.globalAlpha*=.75;ctx.beginPath();ctx.moveTo(-24-wake,-6-wake*.2);ctx.quadraticCurveTo(-36-wake,0,-24-wake,6+wake*.2);ctx.stroke();
    }
    ctx.globalAlpha=Math.min(1,progress*12,(1-progress)*12);
    ctx.fillStyle='#173e3c';ctx.beginPath();ctx.ellipse(0,4,31,9,0,0,TAU);ctx.fill();
    ctx.fillStyle='#f0d09c';ctx.beginPath();ctx.moveTo(-29,-3);ctx.lineTo(23,-3);ctx.quadraticCurveTo(43,1,23,10);ctx.lineTo(-24,10);ctx.closePath();ctx.fill();
    ctx.fillStyle='#7f4a2a';ctx.fillRect(-22,-3,42,8);
    ctx.fillStyle='#f6edcf';ctx.beginPath();ctx.moveTo(-24,-4);ctx.lineTo(-13,-17);ctx.lineTo(17,-17);ctx.lineTo(27,-4);ctx.closePath();ctx.fill();
    ctx.fillStyle='#416c68';for(let i=0;i<4;i++)ctx.fillRect(-13+i*8,-12,5,8);
    ctx.fillStyle='#c28f43';ctx.fillRect(-24,-4,51,2);
    ctx.restore();
  }
  function drawWalker(w,t){
    const progress=fract(t/w.duration+w.phase),p=point(routes[w.route],progress);
    const ahead=point(routes[w.route],Math.min(progress+.01,1));
    const step=Math.sin(t*6+w.phase*12);
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(w.size,w.size);
    ctx.globalAlpha=Math.min(1,progress*15,(1-progress)*15);
    ctx.fillStyle='#173c3538';ctx.beginPath();ctx.ellipse(3,1,8,3,0,0,TAU);ctx.fill();
    ctx.strokeStyle='#35423e';ctx.lineWidth=2.5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-2,-8);ctx.lineTo(-2+step*2.4,0);ctx.moveTo(2,-8);ctx.lineTo(2-step*2.4,0);ctx.stroke();
    ctx.fillStyle=w.color;ctx.beginPath();ctx.roundRect(-4,-21,8,14,3);ctx.fill();
    ctx.strokeStyle=w.color;ctx.lineWidth=2.3;ctx.beginPath();ctx.moveTo(-3,-18);ctx.lineTo(-6,-9+step*2);ctx.moveTo(3,-18);ctx.lineTo(6,-9-step*2);ctx.stroke();
    ctx.fillStyle='#e6bd8d';ctx.beginPath();ctx.arc(0,-25,3.5,0,TAU);ctx.fill();
    ctx.fillStyle='#5a4231';ctx.beginPath();ctx.ellipse(0,-27,3.6,2.2,0,Math.PI,TAU);ctx.fill();
    if(ahead.x<p.x){ctx.fillStyle='#b5a67b';ctx.fillRect(-3,-18,6,7);}
    ctx.restore();
  }
  function drawBirds(t){
    for(let flock=0;flock<2;flock++){
      const p=fract(t/(42+flock*19)+flock*.51);
      for(let i=0;i<5;i++){
        const x=lerp(-80,1630,p)-i*29,y=70+flock*89+Math.sin(p*4+i*.22)*25+(i%2)*17;
        const flap=Math.sin(t*4.8-i*.9)*5;
        ctx.save();ctx.translate(x,y);ctx.globalAlpha=.56;ctx.strokeStyle=evening?'#f3e7c8':'#36564d';ctx.lineWidth=1.8;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(-9,-flap);ctx.quadraticCurveTo(-4,-5,0,0);ctx.quadraticCurveTo(5,-5,10,-flap);ctx.stroke();ctx.restore();
      }
    }
  }
  function drawLeaves(t){
    leaves.forEach(leaf=>{
      const progress=fract(t/leaf.speed+leaf.phase);
      const sway=Math.sin(progress*TAU*1.5+leaf.seed);
      const x=leaf.origin[0]+progress*leaf.drift+sway*20;
      const y=leaf.origin[1]+progress*200;
      ctx.save();ctx.translate(x,y);ctx.rotate(progress*7+leaf.seed);ctx.scale(.4+Math.abs(Math.cos(progress*6+leaf.seed))*.6,1);
      ctx.globalAlpha=Math.sin(progress*Math.PI)*.92;ctx.fillStyle=leaf.color;
      const s=leaf.size;
      ctx.beginPath();ctx.moveTo(0,-s);ctx.bezierCurveTo(s*.9,-s*.5,s*.9,s*.55,0,s);ctx.bezierCurveTo(-s*.85,s*.2,-s*.55,-s*.5,0,-s);ctx.fill();
      ctx.strokeStyle='#855b2b';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(0,-s*.7);ctx.lineTo(0,s*1.45);ctx.stroke();ctx.restore();
    });
  }
  function drawMotes(t){
    motes.forEach((m,i)=>{
      const x=m.x+Math.sin(t*.18+m.phase)*20,y=m.y+Math.cos(t*.14+m.phase)*18;
      const pulse=(Math.sin(t*(.65+i%3*.16)+m.phase)+1)*.5;
      ctx.globalAlpha=1;
      glow(x,y,evening?18+m.size*3:8+m.size*2,pulse*(evening?.85:.32));
      ctx.globalAlpha=(.26+pulse*.74)*(evening?1:.86);ctx.fillStyle=evening?'#fff1b9':'#ffe6a0';
      ctx.beginPath();ctx.arc(x,y,m.size*(evening?1.35:1),0,TAU);ctx.fill();
      if(i%7===0&&pulse>.6){ctx.lineWidth=1;ctx.strokeStyle='#fff4c5';ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x+7,y);ctx.moveTo(x,y-7);ctx.lineTo(x,y+7);ctx.stroke();}
    });ctx.globalAlpha=1;
  }
  function drawLights(t){
    if(!evening)return;
    windows.forEach(([x,y,w,h],i)=>{
      const bright=.48+Math.sin(t*.2+i)*.12;
      glow(x+w*.5,y+h*.5,24,bright*.85);ctx.fillStyle=`rgba(255,210,116,${bright+.16})`;ctx.fillRect(x,y,w,h);
    });
    lamps.forEach(([x,y],i)=>{glow(x,y,38,.72+Math.sin(t*.7+i)*.04);glow(x,y,7,1);});
  }
  function paint(){
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);ctx.setTransform(scale,0,0,scale,0,0);
    const t=clock/1000;
    drawCloud(fract(t/190+.12)*1850-160,80,1.4,evening?.075:.15);
    drawCloud(fract(t/220+.75)*1850-160,115,.9,evening?.06:.12);
    drawWater(t);cruises.forEach(c=>drawBoat(c,t));walkers.forEach(w=>drawWalker(w,t));
    drawLights(t);drawBirds(t);drawLeaves(t);drawMotes(t);
  }
  function canMove(){return !paused&&!reduced.matches&&!document.hidden&&visible&&!document.querySelector('dialog[open]');}
  function tick(now){
    frame=0;
    if(!canMove()){lastFrame=0;return;}
    if(!lastFrame)lastFrame=now;
    const delta=now-lastFrame;
    if(delta>=1000/30){clock+=Math.min(delta,80);lastFrame=now;paint();}
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    const still=paused||reduced.matches;
    const reading=!!document.querySelector('dialog[open]');
    document.body.classList.toggle('city-still',still||!visible||document.hidden);
    document.body.classList.toggle('city-reading',reading);
    pauseButton.setAttribute('aria-pressed',String(still));
    pauseButton.querySelector('span').textContent=still?'Оживить':'Пауза';
    pauseButton.setAttribute('aria-label',still?'Включить анимацию города':'Приостановить анимацию города');
    pauseButton.disabled=reduced.matches;
    if(reduced.matches)pauseButton.title='Устройство настроено на уменьшенное движение';
    else pauseButton.removeAttribute('title');
    if(canMove()&&!frame){lastFrame=0;frame=requestAnimationFrame(tick);}
    else if(!canMove()&&frame){cancelAnimationFrame(frame);frame=0;lastFrame=0;}
  }
  function resize(){
    const ratio=Math.min(devicePixelRatio||1,1.5);
    width=Math.max(1,Math.round(stage.clientWidth*ratio));height=Math.max(1,Math.round(width*2/3));
    canvas.width=width;canvas.height=height;scale=width/1536;paint();
  }
  timeButton.addEventListener('click',()=>{
    evening=!evening;area.classList.toggle('is-evening',evening);
    timeButton.setAttribute('aria-pressed',String(evening));
    timeButton.querySelector('span').textContent=evening?'День':'Вечер';
    timeButton.setAttribute('aria-label',evening?'Вернуть дневной город':'Включить вечерний город');
    paint();
  });
  pauseButton.addEventListener('click',()=>{paused=!paused;sync();});
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',()=>{sync();paint();});
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.05});observer.observe(area);
  const dialogs=new MutationObserver(sync);document.querySelectorAll('dialog').forEach(dialog=>dialogs.observe(dialog,{attributes:true,attributeFilter:['open']}));
  new ResizeObserver(resize).observe(stage);
  resize();sync();
})();
