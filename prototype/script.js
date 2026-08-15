(function(){
  const COLS = 6;
  const COL_GAP = 4;
  const BIN_HEIGHT = 360;

  const TIERS = [
    { key:'small',  min:400,  max:1800, height:38, cls:'tier-small',  weight:0.52 },
    { key:'medium', min:1800, max:4500, height:58, cls:'tier-medium', weight:0.33 },
    { key:'large',  min:4500, max:8500, height:84, cls:'tier-large',  weight:0.15 },
  ];

  const binEl = document.getElementById('bin');
  const toastEl = document.getElementById('toast');
  const poolEl = document.getElementById('pool');
  const poolWaterEl = document.getElementById('poolWater');
  const poolPctEl = document.getElementById('poolPct');
  const poolAmtEl = document.getElementById('poolAmt');
  const startOverlay = document.getElementById('startOverlay');
  const overOverlay = document.getElementById('overOverlay');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const hudScore = document.getElementById('hudScore');
  const hudBatches = document.getElementById('hudBatches');
  const hudBest = document.getElementById('hudBest');
  const overScore = document.getElementById('overScore');
  const overBatches = document.getElementById('overBatches');
  const overTitle = document.getElementById('overTitle');
  const overSub = document.getElementById('overSub');
  const muteBtn = document.getElementById('muteBtn');

  /* ---------------- Audio: tiny 8-bit synth, no external files ---------------- */
  let audioCtx = null;
  let muted = localStorage.getItem('fxpool_muted') === '1';
  updateMuteBtn();

  function ensureAudio(){
    if(!audioCtx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(AC) audioCtx = new AC();
    }
    if(audioCtx && audioCtx.state === 'suspended'){
      audioCtx.resume();
    }
  }

  function beep(freq, dur, type, startDelay, gainPeak){
    if(muted || !audioCtx) return;
    const t0 = audioCtx.currentTime + (startDelay || 0);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak || 0.16, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function sfxMove(){ beep(320, 0.05, 'square', 0, 0.10); }
  function sfxLock(){ beep(140, 0.08, 'triangle', 0, 0.16); }
  function sfxClear(){
    [523, 659, 784, 1047].forEach((f,i)=> beep(f, 0.14, 'square', i*0.08, 0.14));
  }
  function sfxGameOver(){
    [392, 330, 262, 196].forEach((f,i)=> beep(f, 0.22, 'sawtooth', i*0.13, 0.13));
  }

  function updateMuteBtn(){
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.classList.toggle('muted', muted);
  }
  muteBtn.addEventListener('click', ()=>{
    muted = !muted;
    localStorage.setItem('fxpool_muted', muted ? '1' : '0');
    updateMuteBtn();
    if(!muted) ensureAudio();
  });

  /* ---------------- Game state ---------------- */
  let colEls = [];
  let columnHeights = new Array(COLS).fill(0);
  let colWidth = 0;

  function buildColumns(){
    Array.from(binEl.querySelectorAll('.col')).forEach(el => el.remove());
    colEls = [];
    for(let i=0;i<COLS;i++){
      const col = document.createElement('div');
      col.className = 'col';
      binEl.appendChild(col);
      colEls.push(col);
    }
  }
  buildColumns();

  const fallingEl = document.createElement('div');
  fallingEl.className = 'falling';
  binEl.appendChild(fallingEl);

  let pooledTotal = 0;
  let threshold = 11000;
  let speed = 78;
  let cumulativeHedged = 0;
  let batchesCleared = 0;
  let bestRun = Number(localStorage.getItem('fxpool_best') || 0);
  hudBest.textContent = '$' + bestRun.toLocaleString();

  let currentCol = Math.floor(COLS/2);
  let currentBlock = null;
  let currentY = 0;
  let running = false;
  let softDropping = false;
  let lastTime = 0;
  let rafId = null;

  function pickTier(){
    const r = Math.random();
    let acc = 0;
    for(const t of TIERS){
      acc += t.weight;
      if(r <= acc) return t;
    }
    return TIERS[0];
  }

  function randomBlock(){
    const tier = pickTier();
    const value = Math.round((tier.min + Math.random()*(tier.max-tier.min))/50)*50;
    return { tier, value, height: tier.height };
  }

  function landingY(col, h){
    return BIN_HEIGHT - columnHeights[col] - h;
  }

  function measureColWidth(){
    colWidth = colEls[0].getBoundingClientRect().width;
  }

  function renderFalling(){
    fallingEl.style.width = colWidth + 'px';
    fallingEl.style.height = currentBlock.height + 'px';
    fallingEl.style.left = (currentCol * (colWidth + COL_GAP)) + 'px';
    fallingEl.style.top = currentY + 'px';
    fallingEl.className = 'falling block ' + currentBlock.tier.cls;
    fallingEl.textContent = currentBlock.height >= 50 ? ('$' + currentBlock.value.toLocaleString()) : '';
  }

  function spawnNext(){
    currentBlock = randomBlock();
    currentY = -currentBlock.height;
    renderFalling();
  }

  function updateHud(){
    hudScore.textContent = '$' + cumulativeHedged.toLocaleString();
    hudBatches.textContent = String(batchesCleared);
  }

  function updatePool(){
    const pct = Math.min(100, (pooledTotal/threshold)*100);
    poolWaterEl.style.height = pct + '%';
    poolPctEl.textContent = Math.round(pct) + '%';
    poolAmtEl.textContent = '$' + pooledTotal.toLocaleString() + ' / $' + threshold.toLocaleString();
  }

  function showToast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(()=> toastEl.classList.remove('show'), 1300);
  }

  function splashBurst(){
    const rect = poolEl.getBoundingClientRect();
    for(let i=0;i<12;i++){
      const p = document.createElement('div');
      p.className = 'splash';
      const x = Math.random()*rect.width;
      p.style.left = x + 'px';
      p.style.bottom = '0px';
      poolEl.appendChild(p);
      const dx = (Math.random()-0.5)*40;
      const dy = -(30 + Math.random()*50);
      const dur = 380 + Math.random()*200;
      p.animate([
        { transform:'translate(0,0)', opacity:1 },
        { transform:`translate(${dx}px, ${dy}px)`, opacity:0 }
      ], { duration:dur, easing:'steps(5)' });
      setTimeout(()=> p.remove(), dur+50);
    }
  }

  function addLandedBlock(col, block){
    const el = document.createElement('div');
    el.className = 'block landed ' + block.tier.cls;
    el.style.height = block.height + 'px';
    el.textContent = block.height >= 50 ? ('$' + block.value.toLocaleString()) : '';
    colEls[col].appendChild(el);
  }

  function clearBinVisual(){
    colEls.forEach(c => { c.innerHTML = ''; });
  }

  function lockBlock(){
    const h = currentBlock.height;
    if(columnHeights[currentCol] + h > BIN_HEIGHT){
      gameOver();
      return;
    }
    sfxLock();
    addLandedBlock(currentCol, currentBlock);
    columnHeights[currentCol] += h;
    pooledTotal += currentBlock.value;
    updatePool();

    if(pooledTotal >= threshold){
      clearBatch();
    }
    spawnNext();
  }

  function clearBatch(){
    cumulativeHedged += pooledTotal;
    batchesCleared += 1;
    showToast('BATCH EXECUTED — RATE LOCKED');
    sfxClear();
    splashBurst();
    setTimeout(()=>{
      clearBinVisual();
      columnHeights.fill(0);
      pooledTotal = 0;
      threshold = Math.round(threshold * 1.16);
      speed = speed * 1.055;
      updateHud();
      updatePool();
    }, 220);
    updateHud();
  }

  function gameOver(){
    running = false;
    if(rafId) cancelAnimationFrame(rafId);
    sfxGameOver();
    if(cumulativeHedged > bestRun){
      bestRun = cumulativeHedged;
      localStorage.setItem('fxpool_best', String(bestRun));
      overTitle.textContent = 'NEW BEST RUN!';
      overSub.textContent = 'A column overflowed — but that\'s your best lifetime hedge yet.';
    } else {
      overTitle.textContent = 'POOL OVERFLOWED';
      overSub.textContent = 'A column ran out of room before the pool filled.';
    }
    overScore.textContent = '$' + cumulativeHedged.toLocaleString();
    overBatches.textContent = String(batchesCleared);
    hudBest.textContent = '$' + bestRun.toLocaleString();
    overOverlay.style.display = 'flex';
  }

  function loop(t){
    if(!running) return;
    if(!lastTime) lastTime = t;
    const dt = Math.min(0.05, (t - lastTime)/1000);
    lastTime = t;

    const spd = speed * (softDropping ? 7 : 1);
    currentY += spd * dt;
    const target = landingY(currentCol, currentBlock.height);

    if(currentY >= target){
      currentY = target;
      renderFalling();
      lockBlock();
      lastTime = t;
    } else {
      renderFalling();
    }
    rafId = requestAnimationFrame(loop);
  }

  function moveLeft(){ if(!running) return; const prev = currentCol; currentCol = Math.max(0, currentCol - 1); if(currentCol !== prev) sfxMove(); renderFalling(); }
  function moveRight(){ if(!running) return; const prev = currentCol; currentCol = Math.min(COLS-1, currentCol + 1); if(currentCol !== prev) sfxMove(); renderFalling(); }
  function hardDrop(){
    if(!running) return;
    currentY = landingY(currentCol, currentBlock.height);
    renderFalling();
    lockBlock();
  }

  document.addEventListener('keydown', (e)=>{
    if(e.code === 'ArrowLeft'){ moveLeft(); e.preventDefault(); }
    else if(e.code === 'ArrowRight'){ moveRight(); e.preventDefault(); }
    else if(e.code === 'ArrowDown'){ softDropping = true; e.preventDefault(); }
    else if(e.code === 'Space'){ hardDrop(); e.preventDefault(); }
  });
  document.addEventListener('keyup', (e)=>{
    if(e.code === 'ArrowDown'){ softDropping = false; }
  });

  document.getElementById('btnLeft').addEventListener('click', moveLeft);
  document.getElementById('btnRight').addEventListener('click', moveRight);
  document.getElementById('btnDrop').addEventListener('click', hardDrop);

  function resetState(){
    columnHeights.fill(0);
    pooledTotal = 0;
    threshold = 11000;
    speed = 78;
    cumulativeHedged = 0;
    batchesCleared = 0;
    currentCol = Math.floor(COLS/2);
    softDropping = false;
    lastTime = 0;
    clearBinVisual();
    updateHud();
    updatePool();
    spawnNext();
  }

  function startGame(){
    ensureAudio();
    measureColWidth();
    resetState();
    startOverlay.style.display = 'none';
    overOverlay.style.display = 'none';
    running = true;
    rafId = requestAnimationFrame(loop);
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);
  window.addEventListener('resize', measureColWidth);

  measureColWidth();
})();
