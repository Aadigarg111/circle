const API = 'http://localhost:3000/api';
let username = localStorage.getItem('circle_username') || '';

// --- Dark mode toggle ---
const darkModeToggle = document.getElementById('darkModeToggle');
function setDarkMode(on) {
  document.body.classList.toggle('dark-mode', on);
  darkModeToggle.textContent = on ? '☀️' : '🌙';
  localStorage.setItem('circle_darkmode', on ? '1' : '0');
}
darkModeToggle.onclick = () => setDarkMode(!document.body.classList.contains('dark-mode'));
if (localStorage.getItem('circle_darkmode') === '1') setDarkMode(true);

// --- Help modal ---
document.getElementById('helpBtn').onclick = () => {
  document.getElementById('helpModal').style.display = 'flex';
};
document.getElementById('closeHelpBtn').onclick = () => {
  document.getElementById('helpModal').style.display = 'none';
};

// --- Avatar picker ---
let avatarEmoji = localStorage.getItem('circle_avatar_emoji') || '😀';
let avatarColor = localStorage.getItem('circle_avatar_color') || '#a1c4fd';
const avatarEmojiInput = document.getElementById('avatarEmoji');
const avatarColorInput = document.getElementById('avatarColor');
if (avatarEmojiInput) avatarEmojiInput.value = avatarEmoji;
if (avatarColorInput) avatarColorInput.value = avatarColor;
if (avatarEmojiInput) avatarEmojiInput.onchange = e => {
  avatarEmoji = e.target.value;
  localStorage.setItem('circle_avatar_emoji', avatarEmoji);
};
if (avatarColorInput) avatarColorInput.oninput = e => {
  avatarColor = e.target.value;
  localStorage.setItem('circle_avatar_color', avatarColor);
};

// --- Username modal logic (store avatar info) ---
function showModal() {
  document.getElementById('usernameModal').style.display = 'flex';
}
function hideModal() {
  document.getElementById('usernameModal').style.display = 'none';
}
if (!username) showModal();
document.getElementById('usernameBtn').onclick = () => {
  const val = document.getElementById('usernameInput').value.trim();
  if (val) {
    username = val;
    localStorage.setItem('circle_username', username);
    avatarEmoji = avatarEmojiInput.value;
    avatarColor = avatarColorInput.value;
    localStorage.setItem('circle_avatar_emoji', avatarEmoji);
    localStorage.setItem('circle_avatar_color', avatarColor);
    hideModal();
    loadHistory();
    loadLeaderboard();
  }
};
if (username) {
  hideModal();
  loadHistory();
  loadLeaderboard();
}

// Drawing logic
const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
let drawing = false, points = [];
let pulseTime = 0;
let showBestFit = false;
let bestFitCircle = null;
let animateBestFit = false;
let bestFitAnimProgress = 0;
let liveScore = 0;
let showLiveScore = false;
let liveScorePos = {x: 0, y: 0};
let showEmoji = false;
let emoji = '';
let emojiAnim = 0;

function getInitials(name) {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0,2);
}

function drawCenterDot(ctx, pulse) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(canvas.width/2, canvas.height/2, 4.5 + pulse, 0, 2*Math.PI);
  ctx.fillStyle = '#ff3b3b';
  ctx.shadowColor = '#ff3b3b';
  ctx.shadowBlur = 8 + pulse*2;
  ctx.fill();
  ctx.restore();
}

function drawBestFitCircle(ctx, fit, progress=1) {
  if (!fit) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(fit.cx, fit.cy, fit.r, 0, 2*Math.PI*progress);
  ctx.strokeStyle = '#00c896';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 6]);
  ctx.globalAlpha = 0.7;
  ctx.shadowColor = '#00c896';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawGhostCircle(ctx) {
  if (points.length < 2) return;
  const start = points[0];
  const end = points[points.length-1];
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const r = Math.hypot(end.x - start.x, end.y - start.y) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2*Math.PI);
  ctx.strokeStyle = '#4e54c8';
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 3;
  ctx.setLineDash([2, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawLiveScore(ctx) {
  if (!showLiveScore) return;
  ctx.save();
  ctx.font = 'bold 1.2em Poppins, Arial';
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = liveScore > 80 ? '#00c896' : (liveScore > 60 ? '#4e54c8' : '#ff3b3b');
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.strokeText(`${liveScore}%`, liveScorePos.x, liveScorePos.y-10);
  ctx.fillText(`${liveScore}%`, liveScorePos.x, liveScorePos.y-10);
  ctx.restore();
}

function drawEmoji(ctx) {
  if (!showEmoji) return;
  ctx.save();
  ctx.font = `bold ${4 + 2*Math.abs(Math.sin(emojiAnim/8))}em Poppins, Arial`;
  ctx.globalAlpha = 0.92 - 0.2*Math.abs(Math.sin(emojiAnim/8));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 24;
  ctx.fillText(emoji, canvas.width/2, canvas.height/2);
  ctx.restore();
}

function redraw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // Animate center dot
  let pulse = 1.5 + Math.sin(pulseTime)*1.5;
  drawCenterDot(ctx, pulse);
  if (points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let p of points) ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#0077ff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    ctx.stroke();
  }
  if (drawing) drawGhostCircle(ctx);
  if (showBestFit && bestFitCircle) {
    if (animateBestFit) {
      drawBestFitCircle(ctx, bestFitCircle, bestFitAnimProgress);
    } else {
      drawBestFitCircle(ctx, bestFitCircle, 1);
    }
  }
  drawLiveScore(ctx);
  drawEmoji(ctx);
}

function animateCanvas() {
  pulseTime += 0.07;
  if (animateBestFit && bestFitCircle) {
    bestFitAnimProgress += 0.04;
    if (bestFitAnimProgress >= 1) {
      bestFitAnimProgress = 1;
      animateBestFit = false;
    }
  }
  if (showEmoji) emojiAnim += 1;
  redraw();
  requestAnimationFrame(animateCanvas);
}

canvas.addEventListener('mousedown', e => {
  drawing = true;
  points = [];
  showBestFit = false;
  bestFitCircle = null;
  showLiveScore = true;
  liveScore = 0;
  redraw();
});
canvas.addEventListener('mousemove', e => {
  if (!drawing) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  points.push({x, y});
  // Live score
  if (points.length > 10) {
    liveScore = getCircleScore(points);
    liveScorePos = {x, y};
  }
  redraw();
});
canvas.addEventListener('mouseup', e => {
  drawing = false;
  showLiveScore = false;
  redraw();
});
canvas.addEventListener('mouseleave', e => {
  drawing = false;
  showLiveScore = false;
  redraw();
});
// Touch support
canvas.addEventListener('touchstart', e => {
  drawing = true;
  points = [];
  showBestFit = false;
  bestFitCircle = null;
  showLiveScore = true;
  liveScore = 0;
  redraw();
});
canvas.addEventListener('touchmove', e => {
  if (!drawing) return;
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const x = t.clientX - rect.left, y = t.clientY - rect.top;
  points.push({x, y});
  if (points.length > 10) {
    liveScore = getCircleScore(points);
    liveScorePos = {x, y};
  }
  redraw();
  e.preventDefault();
}, {passive: false});
canvas.addEventListener('touchend', e => {
  drawing = false;
  showLiveScore = false;
  redraw();
});

// --- Improved Circle Fitting and Scoring ---
function fitCircleKasa(pts) {
  let sumX=0, sumY=0, sumX2=0, sumY2=0, sumXY=0, sumR=0, sumXR=0, sumYR=0;
  let N = pts.length;
  for (let p of pts) {
    let x = p.x, y = p.y;
    let x2 = x*x, y2 = y*y;
    sumX += x;
    sumY += y;
    sumX2 += x2;
    sumY2 += y2;
    sumXY += x*y;
    let r2 = x2 + y2;
    sumR += r2;
    sumXR += x*r2;
    sumYR += y*r2;
  }
  let C = N*sumX2 - sumX*sumX;
  let D = N*sumXY - sumX*sumY;
  let E = N*sumY2 - sumY*sumY;
  let G = 0.5*(N*sumXR - sumX*sumR);
  let H = 0.5*(N*sumYR - sumY*sumR);
  let denom = (C*E - D*D);
  if (Math.abs(denom) < 1e-12) return null;
  let cx = (G*E - H*D)/denom;
  let cy = (C*H - D*G)/denom;
  let r = 0;
  for (let p of pts) r += Math.hypot(p.x-cx, p.y-cy);
  r /= N;
  return {cx, cy, r};
}

function getCircleScore(pts) {
  if (pts.length < 10) return 0;
  let fit = fitCircleKasa(pts);
  if (!fit) return 0;
  let {cx, cy, r} = fit;
  let mad = pts.reduce((a,p)=>a+Math.abs(Math.hypot(p.x-cx,p.y-cy)-r),0)/pts.length;
  let score = 100 * (1 - Math.min(1, mad/(r/2)));
  return Math.round(score);
}

function animateResult(finalScore) {
  const el = document.getElementById('resultPercent');
  let start = 0;
  let duration = 800;
  let startTime = null;
  function animate(ts) {
    if (!startTime) startTime = ts;
    let progress = Math.min(1, (ts - startTime)/duration);
    let val = Math.round(progress * finalScore);
    el.textContent = `Your circle score: ${val}%`;
    if (progress < 1) requestAnimationFrame(animate);
    else el.textContent = `Your circle score: ${finalScore}%`;
  }
  requestAnimationFrame(animate);
}

// --- Sound effects ---
const soundSubmit = document.getElementById('soundSubmit');
const soundConfetti = document.getElementById('soundConfetti');
const soundHighscore = document.getElementById('soundHighscore');
function playSound(sound) {
  if (sound && sound.play) {
    sound.currentTime = 0;
    sound.play();
  }
}

// --- Challenge a Friend Mode ---
function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}
let challengeUser = getQueryParam('challenge');
let challengeScore = parseInt(getQueryParam('score'), 10);
let challengeActive = !!challengeUser && !isNaN(challengeScore);
const challengeBanner = document.getElementById('challengeBanner');
function showChallengeBanner(msg, dismissible=true) {
  challengeBanner.innerHTML = msg + (dismissible ? ' <button class="close" title="Dismiss">&times;</button>' : '');
  challengeBanner.style.display = 'block';
  if (dismissible) {
    challengeBanner.querySelector('.close').onclick = () => {
      challengeBanner.style.display = 'none';
    };
  }
}
if (challengeActive) {
  showChallengeBanner(`<b>Challenge from ${challengeUser}:</b> Can you beat ${challengeScore}%?`);
}

document.getElementById('submitBtn').onclick = async () => {
  if (!username) return showModal();
  if (points.length < 10) {
    document.getElementById('resultPercent').textContent = 'Draw a circle first!';
    return;
  }
  const score = getCircleScore(points);
  animateResult(score);
  // Show best fit circle with animation
  bestFitCircle = fitCircleKasa(points);
  showBestFit = true;
  animateBestFit = true;
  bestFitAnimProgress = 0;
  // Emoji feedback
  showEmoji = true;
  emojiAnim = 0;
  if (score >= 95) emoji = '🥇';
  else if (score >= 90) emoji = '🥳';
  else if (score >= 75) emoji = '😃';
  else if (score >= 50) emoji = '😐';
  else emoji = '😲';
  setTimeout(() => { showEmoji = false; }, 1800);
  // Confetti for high scores
  if (score >= 90) {
    launchConfetti();
    playSound(soundConfetti);
    playSound(soundHighscore);
  } else {
    playSound(soundSubmit);
  }
  // Show share button
  const shareBtn = document.getElementById('shareBtn');
  shareBtn.classList.add('show');
  shareBtn.style.display = 'inline-block';
  shareBtn.onclick = () => {
    const shareText = `I scored ${score}% drawing a circle! Can you beat me? https://yourgameurl.com`;
    if (navigator.share) {
      navigator.share({ title: 'Draw a Circle Game', text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
      shareBtn.textContent = 'Copied!';
      setTimeout(() => { shareBtn.textContent = 'Share'; }, 1200);
    }
  };
  // Show challenge button
  const challengeBtn = document.getElementById('challengeBtn');
  challengeBtn.classList.add('show');
  challengeBtn.style.display = 'inline-block';
  challengeBtn.onclick = () => {
    const link = `${window.location.origin}${window.location.pathname}?challenge=${encodeURIComponent(username)}&score=${score}`;
    navigator.clipboard.writeText(link);
    challengeBtn.textContent = 'Link Copied!';
    setTimeout(() => { challengeBtn.textContent = 'Challenge a Friend'; }, 1200);
  };
  // If this is a challenge, compare scores
  if (challengeActive) {
    let resultMsg = '';
    if (score > challengeScore) resultMsg = `🎉 You beat ${challengeUser}'s challenge! (${score}% > ${challengeScore}%)`;
    else if (score === challengeScore) resultMsg = `🤝 It's a tie with ${challengeUser}! (${score}%)`;
    else resultMsg = `😅 ${challengeUser} still leads. (${score}% < ${challengeScore}%)`;
    showChallengeBanner(resultMsg);
    // Remove challenge params from URL after result
    window.history.replaceState({}, document.title, window.location.pathname);
    challengeActive = false;
  }
  // Save to backend
  await fetch(`${API}/submit`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({username, percentage: score})
  });
  loadHistory();
  loadLeaderboard();
};

// Hide share button and challenge button on new draw
canvas.addEventListener('mousedown', () => {
  document.getElementById('shareBtn').classList.remove('show');
  document.getElementById('shareBtn').style.display = 'none';
  document.getElementById('challengeBtn').classList.remove('show');
  document.getElementById('challengeBtn').style.display = 'none';
});
canvas.addEventListener('touchstart', () => {
  document.getElementById('shareBtn').classList.remove('show');
  document.getElementById('shareBtn').style.display = 'none';
  document.getElementById('challengeBtn').classList.remove('show');
  document.getElementById('challengeBtn').style.display = 'none';
});

// Confetti animation
function launchConfetti() {
  const colors = ['#4e54c8','#8f94fb','#00c896','#fbc2eb','#ff3b3b'];
  const confetti = [];
  for (let i=0; i<32; ++i) {
    confetti.push({
      x: canvas.width/2,
      y: canvas.height/2,
      r: 6+Math.random()*6,
      color: colors[Math.floor(Math.random()*colors.length)],
      vx: (Math.random()-0.5)*8,
      vy: -Math.random()*8-2,
      g: 0.25+Math.random()*0.1,
      a: 1
    });
  }
  function drawConfetti() {
    ctx.save();
    for (let c of confetti) {
      ctx.globalAlpha = c.a;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, 2*Math.PI);
      ctx.fillStyle = c.color;
      ctx.fill();
    }
    ctx.restore();
  }
  let frames = 0;
  function animate() {
    frames++;
    for (let c of confetti) {
      c.x += c.vx;
      c.y += c.vy;
      c.vy += c.g;
      c.a -= 0.012;
    }
    redraw();
    drawConfetti();
    if (frames < 80) requestAnimationFrame(animate);
  }
  animate();
}

// --- Highlight best score in history, animate leaderboard entry for current user, and render avatars ---
function getAvatarHTML(name, emoji, color) {
  return `<span class="avatar" style="background:${color};">${emoji}</span>`;
}
async function loadHistory() {
  if (!username) return;
  const res = await fetch(`${API}/history?username=${encodeURIComponent(username)}`);
  const data = await res.json();
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  let best = Math.max(...data.map(item=>item.percentage));
  data.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = getAvatarHTML(username, avatarEmoji, avatarColor) + `${item.percentage}% - ${new Date(item.timestamp).toLocaleString()}`;
    if (item.percentage === best) {
      li.classList.add('best-score');
      li.innerHTML = getAvatarHTML(username, avatarEmoji, avatarColor) + `<strong>🏅 ${item.percentage}%</strong> - ${new Date(item.timestamp).toLocaleString()}`;
    }
    list.appendChild(li);
  });
}
async function loadLeaderboard() {
  const res = await fetch(`${API}/leaderboard`);
  const data = await res.json();
  const list = document.getElementById('leaderboardList');
  list.innerHTML = '';
  data.forEach((item, i) => {
    // Try to get avatar info from localStorage for current user, else use default
    let emoji = '😀', color = '#a1c4fd';
    if (item._id === username) {
      emoji = avatarEmoji;
      color = avatarColor;
    }
    const li = document.createElement('li');
    li.innerHTML = getAvatarHTML(item._id, emoji, color) + `${item._id} - ${item.best}%`;
    if (item._id === username) {
      li.classList.add('current-user');
      li.style.transition = 'background 0.5s';
      li.animate([
        { background: 'linear-gradient(90deg,#fbc2eb77,#a6c1ee77)' },
        { background: 'linear-gradient(90deg,#a1c4fd33,#c2e9fb33)' }
      ], { duration: 1200 });
    }
    list.appendChild(li);
  });
}

// Start animation loop
animateCanvas();
