/* Banquillo PWA — vanilla JS, todo local */
const LS_TEAMS = 'bball.teams.v1';
const LS_MATCH = 'bball.match.v1';
const LS_HISTORY = 'bball.history.v1';
const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtClock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
const fmtPlayed = (sec) => {
  sec = Math.floor(sec);
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
};
const qLabel = (q) => (q <= 4 ? q + 'º' : 'PR' + (q - 4));

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}
const load = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let teams = load(LS_TEAMS, []);
let match = load(LS_MATCH, null);
let history = load(LS_HISTORY, []);
let editingTeamId = null;
let draftPlayers = [];
let draftOpp = [];
let setupQuarterMin = 10;
let tickTimer = null;
let tickN = 0;
let wakeLock = null;
let pendingSubId = null;
let notesFilter = 'all';
let selectedHistoryId = 'current';

function saveHistoryMatch(m) {
  if (!m || m.status !== 'finished') return;
  const copy = structuredClone(m);
  const idx = history.findIndex(h => h.id === m.id);
  if (idx >= 0) history[idx] = copy;
  else history.unshift(copy);
  save(LS_HISTORY, history);
}

/* ---------- Screen Wake Lock ---------- */
async function requestWakeLock() {
  if ('wakeLock' in navigator && !wakeLock && match && match.status === 'live') {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {}
  }
}
function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const v = document.querySelector('.view.is-active');
    if (v && v.id === 'view-live' && match?.status === 'live') requestWakeLock();
  } else {
    releaseWakeLock();
  }
});

/* ---------- navegación ---------- */
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => showView(b.dataset.goto)));
function showView(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + name));
  if (name === 'summary') renderSummary();
  if (name === 'setup') renderSetup();
  if (name === 'live' && match?.status === 'live') requestWakeLock();
  else releaseWakeLock();
  window.scrollTo({ top: 0 });
}

/* ---------- EQUIPOS ---------- */
function renderTeams() {
  const list = $('#teams-list'); list.innerHTML = '';
  if (!teams.length) list.innerHTML = '<div class="card center"><p>No hay equipos todavía. Crea el primero abajo 👇</p></div>';
  teams.forEach(t => {
    const d = document.createElement('div');
    d.className = 'team-card';
    d.innerHTML = `<div class="t-head"><strong>${esc(t.name)}</strong>
      <span class="badge">${t.players.length} jug.</span></div>
      <p class="hint">${t.players.map(p => '#' + esc(p.number) + ' ' + esc(p.name)).join(' · ') || 'Sin jugadoras'}</p>
      <div class="t-actions">
        <button class="btn ghost sm" data-act="edit">✏️ Editar</button>
        <button class="btn ghost sm" data-act="dup">⧉ Duplicar</button>
        <button class="btn ghost sm" data-act="del">🗑</button>
      </div>`;
    d.querySelector('[data-act="edit"]').onclick = () => {
      editingTeamId = t.id; draftPlayers = [...t.players];
      $('#team-name').value = t.name; $('#team-form-title').textContent = 'Editar equipo';
      $('#btn-cancel-edit').classList.remove('hidden'); renderDraft();
      window.scrollTo({ top: document.body.scrollHeight });
    };
    d.querySelector('[data-act="dup"]').onclick = () => {
      teams.push({ ...structuredClone(t), id: uid(), name: t.name + ' (copia)' });
      save(LS_TEAMS, teams); renderTeams(); renderSetup(); toast('Equipo duplicado');
    };
    d.querySelector('[data-act="del"]').onclick = () => {
      if (!confirm('¿Borrar "' + t.name + '"?')) return;
      teams = teams.filter(x => x.id !== t.id);
      save(LS_TEAMS, teams); renderTeams(); renderSetup(); toast('Equipo borrado');
    };
    list.appendChild(d);
  });
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function renderDraft() {
  const box = $('#player-draft-list'); box.innerHTML = '';
  draftPlayers.forEach(p => {
    const c = document.createElement('span'); c.className = 'chip';
    c.innerHTML = `#${esc(p.number)} ${esc(p.name)} <button>×</button>`;
    c.querySelector('button').onclick = () => { draftPlayers = draftPlayers.filter(x => x.id !== p.id); renderDraft(); };
    box.appendChild(c);
  });
}
$('#btn-add-player').onclick = () => {
  const name = $('#player-name').value.trim(), number = $('#player-number').value.trim();
  if (!name || !number) return toast('Pon nombre y dorsal');
  if (draftPlayers.some(p => p.number === number)) return toast('Dorsal repetido en este equipo');
  draftPlayers.push({ id: uid(), name, number });
  $('#player-name').value = ''; $('#player-number').value = ''; $('#player-name').focus();
  renderDraft();
};
$('#btn-save-team').onclick = () => {
  const name = $('#team-name').value.trim();
  if (!name) return toast('Ponle nombre al equipo');
  if (!draftPlayers.length) return toast('Añade al menos 1 jugadora');
  if (editingTeamId) {
    teams = teams.map(t => t.id === editingTeamId ? { ...t, name, players: draftPlayers } : t);
    toast('Equipo actualizado');
  } else {
    teams.push({ id: uid(), name, players: draftPlayers, createdAt: Date.now() });
    toast('Equipo guardado 🏀');
  }
  editingTeamId = null; draftPlayers = [];
  $('#team-name').value = ''; $('#team-form-title').textContent = 'Nuevo equipo';
  $('#btn-cancel-edit').classList.add('hidden');
  save(LS_TEAMS, teams); renderTeams(); renderSetup(); renderDraft();
};
$('#btn-cancel-edit').onclick = () => {
  editingTeamId = null; draftPlayers = [];
  $('#team-name').value = ''; $('#team-form-title').textContent = 'Nuevo equipo';
  $('#btn-cancel-edit').classList.add('hidden'); renderDraft();
};

/* ---------- BACKUP (COPIA DE SEGURIDAD) ---------- */
$('#btn-export-backup').onclick = () => {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    teams: load(LS_TEAMS, []),
    match: load(LS_MATCH, null),
    history: load(LS_HISTORY, [])
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `banquillo-backup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Copia descargada 📥');
};
$('#btn-import-backup').onclick = () => {
  $('#backup-file-input').click();
};
$('#backup-file-input').onchange = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!imported || (!Array.isArray(imported.teams) && !imported.match && !Array.isArray(imported.history))) {
        return toast('Archivo JSON no válido');
      }
      if (!confirm('¿Restaurar copia de seguridad? Se reemplazarán los equipos, historial y partido actual.')) return;
      if (Array.isArray(imported.teams)) {
        teams = imported.teams;
        save(LS_TEAMS, teams);
      }
      if (imported.match !== undefined) {
        match = imported.match;
        save(LS_MATCH, match);
      }
      if (Array.isArray(imported.history)) {
        history = imported.history;
        save(LS_HISTORY, history);
      }
      ensureShape();
      renderTeams();
      renderSetup();
      renderLive();
      renderSummary();
      updatePill();
      toast('¡Copia restaurada con éxito! 🏀');
    } catch (err) {
      toast('Error al leer el archivo JSON');
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
};

/* ---------- SETUP ---------- */
function renderSetup() {
  const sel = $('#setup-team'); sel.innerHTML = '';
  if (!teams.length) sel.innerHTML = '<option value="">— crea un equipo primero —</option>';
  teams.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); });
  $('#q-len-label').textContent = setupQuarterMin;
  renderRoster(); renderOppDraft();
}
function selectedTeam() { return teams.find(t => t.id === $('#setup-team').value) || teams[0]; }
$('#setup-team').onchange = renderRoster;
$('#q-minus').onclick = () => { setupQuarterMin = Math.max(1, setupQuarterMin - 1); $('#q-len-label').textContent = setupQuarterMin; };
$('#q-plus').onclick = () => { setupQuarterMin = Math.min(20, setupQuarterMin + 1); $('#q-len-label').textContent = setupQuarterMin; };

let rosterSel = new Set();
function renderRoster() {
  const t = selectedTeam(); const box = $('#roster-list'); box.innerHTML = '';
  if (!t) { box.innerHTML = '<p class="hint">Sin equipos.</p>'; return; }
  if (!rosterSel.size) rosterSel = new Set(t.players.map(p => p.id));
  t.players.forEach(p => {
    const row = document.createElement('label');
    row.className = 'roster-row';
    const checked = rosterSel.has(p.id);
    row.innerHTML = `<input type="checkbox" style="width:28px;height:28px" ${checked ? 'checked' : ''}>
      <span class="dorsal" style="min-width:52px;height:52px;font-size:22px">#${esc(p.number)}</span>
      <span class="pinfo"><strong>${esc(p.name)}</strong></span>`;
    row.querySelector('input').onchange = (e) => {
      e.target.checked ? rosterSel.add(p.id) : rosterSel.delete(p.id);
      $('#roster-count').textContent = rosterSel.size;
    };
    box.appendChild(row);
  });
  $('#roster-count').textContent = rosterSel.size || t.players.length;
  if (!rosterSel.size) rosterSel = new Set(t.players.map(p => p.id));
}
function renderOppDraft() {
  const box = $('#opp-draft-list'); box.innerHTML = '';
  draftOpp.forEach(n => {
    const c = document.createElement('span'); c.className = 'chip'; c.innerHTML = `#${esc(n)} <button>×</button>`;
    c.querySelector('button').onclick = () => { draftOpp = draftOpp.filter(x => x !== n); renderOppDraft(); };
    box.appendChild(c);
  });
}
$('#btn-add-opp').onclick = () => {
  const n = $('#opp-number').value.trim();
  if (!n) return;
  if (draftOpp.includes(n)) return toast('Dorsal ya añadido');
  draftOpp.push(n); $('#opp-number').value = ''; $('#opp-number').focus(); renderOppDraft();
};
$('#opp-number').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-add-opp').click(); });

$('#btn-start-match').onclick = () => {
  const t = selectedTeam();
  const warn = $('#setup-warn'); warn.classList.add('hidden');
  if (!t) { warn.textContent = 'Crea tu equipo primero en la pestaña Equipos.'; warn.classList.remove('hidden'); return; }
  const roster = t.players.filter(p => rosterSel.has(p.id));
  if (roster.length < 5) { warn.textContent = 'Convoca al menos 5 jugadoras para empezar.'; warn.classList.remove('hidden'); return; }
  if (!draftOpp.length && !confirm('Sin dorsales del rival. ¿Empezar igualmente?')) return;
  const qSec = setupQuarterMin * 60;
  match = {
    id: uid(), teamId: t.id, teamName: t.name, quarterLengthSec: qSec,
    quarter: 1, clockRemainingMs: qSec * 1000, clockRunning: false, lastTick: null,
    roster: roster.map(p => ({ ...p })),
    onCourtIds: roster.slice(0, 5).map(p => p.id),
    stats: Object.fromEntries(roster.map(p => [p.id, { seconds: 0, total: 0, stint: 0, fouls: 0, plusMinus: 0 }])),
    oppNumbers: [...draftOpp], oppFouls: Object.fromEntries(draftOpp.map(n => [n, 0])),
    teamFouls: [0], oppTeamFouls: [0],
    possession: 'team',
    timeouts: { team: { h1: 0, h2: 0, ot: {} }, opp: { h1: 0, h2: 0, ot: {} } },
    score: { team: 0, opp: 0 },
    scoreByQuarter: [{ team: 0, opp: 0 }],
    scoreLog: [],
    notes: [], status: 'live', startedAt: Date.now(), finishedAt: null
  };
  save(LS_MATCH, match);
  startTicker(); renderLive(); updatePill();
  requestWakeLock();
  showView('live'); toast('¡Partido en marcha! Elige el quinteto 🏀');
};

/* ---------- EN VIVO ---------- */
function cur() { return match; }
function persist() { save(LS_MATCH, match); }
// Migración suave: partidos guardados antes de existir oppTeamFouls / total+stint / timeouts / possession
function ensureShape() {
  if (!match) return;
  if (!Array.isArray(match.teamFouls)) match.teamFouls = [0];
  if (!Array.isArray(match.oppTeamFouls)) match.oppTeamFouls = [0];
  while (match.teamFouls.length < match.quarter) match.teamFouls.push(0);
  while (match.oppTeamFouls.length < match.quarter) match.oppTeamFouls.push(0);
  if (!match.possession) match.possession = 'team';
  if (!match.score || typeof match.score.team !== 'number' || typeof match.score.opp !== 'number') {
    match.score = { team: 0, opp: 0 };
  }
  if (!Array.isArray(match.scoreByQuarter)) match.scoreByQuarter = [];
  while (match.scoreByQuarter.length < match.quarter) match.scoreByQuarter.push({ team: 0, opp: 0 });
  match.scoreByQuarter.forEach(q => {
    if (typeof q.team !== 'number') q.team = 0;
    if (typeof q.opp !== 'number') q.opp = 0;
  });
  if (!Array.isArray(match.scoreLog)) match.scoreLog = [];
  if (!match.timeouts) match.timeouts = { team: { h1: 0, h2: 0, ot: {} }, opp: { h1: 0, h2: 0, ot: {} } };
  if (!match.timeouts.team) match.timeouts.team = { h1: 0, h2: 0, ot: {} };
  if (!match.timeouts.opp) match.timeouts.opp = { h1: 0, h2: 0, ot: {} };
  if (typeof match.timeouts.team.ot !== 'object' || match.timeouts.team.ot === null) match.timeouts.team.ot = {};
  if (typeof match.timeouts.opp.ot !== 'object' || match.timeouts.opp.ot === null) match.timeouts.opp.ot = {};
  const on = new Set(match.onCourtIds || []);
  (match.roster || []).forEach(p => {
    if (!match.stats[p.id]) match.stats[p.id] = { seconds: 0, total: 0, stint: 0, fouls: 0, plusMinus: 0 };
    const st = match.stats[p.id];
    if (st.total == null) st.total = st.seconds || 0;   // legacy: seconds era el total
    if (st.seconds == null) st.seconds = st.total || 0; // espejo para compatibilidad
    if (st.stint == null) st.stint = 0;                 // racha desconocida en partidos viejos → 0
    if (st.fouls == null) st.fouls = 0;
    if (st.plusMinus == null) st.plusMinus = 0;
    if (!on.has(p.id)) st.stint = 0; // en banquillo nunca hay racha
  });
}
function updatePill() {
  const on = match && match.status === 'live';
  $('#live-pill').classList.toggle('hidden', !on);
  if (on) $('#live-pill-text').textContent = 'EN VIVO · ' + qLabel(match.quarter);
}
function startTicker() {
  clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    if (!match || !match.clockRunning || match.status !== 'live') return;
    const now = Date.now();
    const dt = now - (match.lastTick || now);
    match.lastTick = now;
    match.clockRemainingMs -= dt;
    const add = dt / 1000;
    match.onCourtIds.forEach(id => {
      const st = match.stats[id];
      if (!st) return;
      st.total = (st.total ?? st.seconds ?? 0) + add;
      st.stint = (st.stint ?? 0) + add;
      st.seconds = st.total; // espejo legacy
    });
    if (match.clockRemainingMs <= 0) {
      match.clockRemainingMs = 0; match.clockRunning = false;
      try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch {}
      toast('⏱ Fin del ' + qLabel(match.quarter) + ' — pulsa ▶ en el siguiente');
    }
    persist(); paintClock();
    // Repintar jugadoras ~1 vez/seg para no interferir con toques (el tick es 250ms)
    tickN = (tickN + 1) % 4;
    if (tickN === 0) paintPlayers();
  }, 250);
}
function renderLive() {
  const empty = !match || match.status !== 'live';
  $('#live-empty').classList.toggle('hidden', !empty);
  $('#live-body').classList.toggle('hidden', empty);
  if (empty) { updatePill(); releaseWakeLock(); pendingSubId = null; return; }
  ensureShape();
  requestWakeLock();
  paintClock(); paintScore(); paintPossession(); paintTimeouts(); paintPlayers(); paintOpp(); paintNotes(); paintNotePlayers();
  updatePill();
}
function paintClock() {
  $('#clock').textContent = fmtClock(match.clockRemainingMs);
  $('#quarter-label').textContent = qLabel(match.quarter);
  const pct = 100 * match.clockRemainingMs / (match.quarterLengthSec * 1000);
  $('#progress-fill').style.width = pct + '%';
  const tf = match.teamFouls[match.quarter - 1] || 0;
  $('#team-fouls-num').textContent = tf;
  $('#bonus-pill').classList.toggle('on', tf >= 4);
  $('#bonus-pill').textContent = tf >= 4 ? '★ BONUS ★' : 'BONUS (4)';
  const otf = match.oppTeamFouls[match.quarter - 1] || 0;
  const otfNum = $('#opp-team-fouls-num');
  if (otfNum) otfNum.textContent = otf;
  const ob = $('#opp-bonus-pill');
  if (ob) { ob.classList.toggle('on', otf >= 4); ob.textContent = otf >= 4 ? '★ BONUS ★' : 'BONUS (4)'; }
  $('#btn-play').textContent = match.clockRunning ? '⏳ corriendo…' : '▶';
  paintPossession();
  paintTimeouts();
  paintScore();
}

/* ---------- MARCADOR + PLUS/MINUS ---------- */
function paintScore() {
  if (!match || !match.score) return;
  const st = $('#score-team'), so = $('#score-opp');
  if (st) st.textContent = match.score.team ?? 0;
  if (so) so.textContent = match.score.opp ?? 0;
  const diff = (match.score.team ?? 0) - (match.score.opp ?? 0);
  const dEl = $('#score-diff');
  if (dEl) {
    dEl.textContent = (diff >= 0 ? '+' : '') + diff;
    dEl.classList.toggle('lead', diff > 0);
    dEl.classList.toggle('trail', diff < 0);
  }
  const qEl = $('#score-quarter');
  if (qEl) {
    const q = match.scoreByQuarter?.[match.quarter - 1] || { team: 0, opp: 0 };
    qEl.textContent = qLabel(match.quarter) + ' ' + q.team + '-' + q.opp;
  }
  paintScoreLog();
}
function paintScoreLog() {
  const box = $('#score-log');
  if (!box || !match) return;
  const cnt = $('#score-log-count');
  const log = match.scoreLog || [];
  if (cnt) cnt.textContent = log.length;
  box.innerHTML = '';
  if (!log.length) { box.innerHTML = '<span class="hint">Sin canastas todavía.</span>'; return; }
  [...log].slice(-6).reverse().forEach(e => {
    const d = document.createElement('div');
    d.className = 'score-log-item' + (e.side === 'opp' ? ' opp' : '') + (e.points < 0 ? ' corr' : '');
    const label = e.points < 0
      ? `−1 corrección ${e.side === 'team' ? 'NOS' : 'RIV'}`
      : `+${e.points} ${e.side === 'team' ? 'NOS' : 'RIV'}`;
    d.innerHTML = `<span><strong>${label}</strong> <small>${qLabel(e.quarter)} · ${esc(e.clock || '')}</small></span><button class="btn ghost sm" title="Borrar esta canasta">×</button>`;
    d.querySelector('button').onclick = () => removeBasketById(e.id);
    box.appendChild(d);
  });
}
function addBasket(side, pts) {
  if (!match || match.status !== 'live') return;
  ensureShape();
  if (pts <= 0) return;
  // Evitar marcador negativo en correcciones manuales (no aplica aquí, solo suma)
  match.score[side] = (match.score[side] || 0) + pts;
  const qi = match.quarter - 1;
  match.scoreByQuarter[qi][side] = (match.scoreByQuarter[qi][side] || 0) + pts;
  // Plus/Minus: las 5 en pista suman si anotamos, restan si encajan
  const delta = side === 'team' ? pts : -pts;
  const snapshot = [...match.onCourtIds];
  snapshot.forEach(id => {
    if (!match.stats[id]) match.stats[id] = { seconds: 0, total: 0, stint: 0, fouls: 0, plusMinus: 0 };
    if (match.stats[id].plusMinus == null) match.stats[id].plusMinus = 0;
    match.stats[id].plusMinus += delta;
  });
  match.scoreLog.push({
    id: uid(), side, points: pts,
    quarter: match.quarter, clock: fmtClock(match.clockRemainingMs),
    onCourtIds: snapshot, createdAt: Date.now()
  });
  try { navigator.vibrate && navigator.vibrate(20); } catch {}
  persist(); paintScore(); paintPlayers();
}
/* Corrección fina −1: p. ej. pulsaste +3 en vez de +2. Resta 1 al marcador
   y ajusta el +/- del quinteto actual. Queda registrada en el log. */
function correctScore(side) {
  if (!match || match.status !== 'live') return;
  ensureShape();
  if ((match.score[side] || 0) <= 0) return toast('Marcador ya en 0');
  match.score[side]--;
  const qi = match.quarter - 1;
  if (match.scoreByQuarter[qi]) match.scoreByQuarter[qi][side] = Math.max(0, (match.scoreByQuarter[qi][side] || 0) - 1);
  const delta = side === 'team' ? -1 : 1;
  const snapshot = [...match.onCourtIds];
  snapshot.forEach(id => {
    const s = match.stats[id];
    if (s) {
      if (s.plusMinus == null) s.plusMinus = 0;
      s.plusMinus += delta;
    }
  });
  match.scoreLog.push({
    id: uid(), side, points: -1, isCorrection: true,
    quarter: match.quarter, clock: fmtClock(match.clockRemainingMs),
    onCourtIds: snapshot, createdAt: Date.now()
  });
  persist(); paintScore(); paintPlayers();
  toast('Corrección −1 aplicada');
}
function revertBasketEntry(entry) {
  // Revierte marcador + cuarto + Plus/Minus de quienes estaban en pista entonces.
  // Funciona tanto para canastas (+1/+2/+3) como correcciones (−1).
  match.score[entry.side] = Math.max(0, (match.score[entry.side] || 0) - entry.points);
  const qi = (entry.quarter || 1) - 1;
  if (match.scoreByQuarter[qi]) {
    match.scoreByQuarter[qi][entry.side] = Math.max(0, (match.scoreByQuarter[qi][entry.side] || 0) - entry.points);
  }
  const delta = entry.side === 'team' ? -entry.points : entry.points;
  (entry.onCourtIds || []).forEach(id => {
    const s = match.stats[id];
    if (s && s.plusMinus != null) s.plusMinus += delta;
  });
}
function removeBasketById(id) {
  if (!match || match.status !== 'live') return;
  ensureShape();
  const idx = (match.scoreLog || []).findIndex(e => e.id === id);
  if (idx < 0) return;
  const entry = match.scoreLog[idx];
  if (!confirm(`¿Borrar ${entry.points < 0 ? 'corrección −1' : '+' + entry.points + ' ' + (entry.side === 'team' ? 'NOS' : 'RIV')} (${qLabel(entry.quarter)} ${entry.clock})?`)) return;
  match.scoreLog.splice(idx, 1);
  revertBasketEntry(entry);
  persist(); paintScore(); paintPlayers();
  toast('Canasta borrada');
}
function undoLastBasket() {
  if (!match || match.status !== 'live') return;
  ensureShape();
  const last = (match.scoreLog || [])[match.scoreLog.length - 1];
  if (!last) return toast('Sin canastas que deshacer');
  match.scoreLog.pop();
  revertBasketEntry(last);
  persist(); paintScore(); paintPlayers();
  toast('Canasta deshecha ↩');
}
['1', '2', '3'].forEach(v => {
  const n = parseInt(v, 10);
  $('#btn-score-team-' + v).onclick = () => { addBasket('team', n); toast(`+${n} Nosotros 🏀`); };
  $('#btn-score-opp-' + v).onclick = () => { addBasket('opp', n); toast(`+${n} Rival 🏀`); };
});
$('#btn-score-team-corr').onclick = () => correctScore('team');
$('#btn-score-opp-corr').onclick = () => correctScore('opp');
$('#btn-score-undo').onclick = () => {
  if (!confirm('¿Deshacer la última canasta?')) return;
  undoLastBasket();
};
$('#btn-play').onclick = () => {
  if (!match || match.status !== 'live') return;
  if (match.clockRemainingMs <= 0) return toast('Cuarto a 0 — avanza de cuarto (▶) o resetea');
  match.clockRunning = true; match.lastTick = Date.now(); persist(); paintClock();
  requestWakeLock();
};
$('#btn-pause').onclick = () => { if (match) { match.clockRunning = false; persist(); paintClock(); } };
$('#btn-clock-reset').onclick = () => {
  if (!match || !confirm('¿Resetear el reloj de este cuarto?')) return;
  pendingSubId = null;
  match.clockRunning = false; match.clockRemainingMs = match.quarterLengthSec * 1000; persist(); paintClock();
};
function adjustClock(deltaSec) {
  if (!match || match.status !== 'live') return;
  const maxMs = match.quarterLengthSec * 1000;
  const oldMs = match.clockRemainingMs;
  const newMs = Math.max(0, Math.min(maxMs, oldMs + deltaSec * 1000));
  const effectiveDeltaMs = newMs - oldMs;
  if (effectiveDeltaMs === 0) return;

  match.clockRemainingMs = newMs;
  if (match.clockRunning) match.lastTick = Date.now();

  // El reloj es una cuenta atrás:
  // Si restamos segundos al reloj (ej. −5s), se ha jugado más tiempo real (+5s para las de pista).
  // Si sumamos segundos al reloj (ej. +5s), retrocedemos el tiempo de juego (−5s para las de pista).
  const playedDeltaSec = -(effectiveDeltaMs / 1000);
  match.onCourtIds.forEach(id => {
    const st = match.stats[id];
    if (!st) return;
    st.total = Math.max(0, (st.total ?? st.seconds ?? 0) + playedDeltaSec);
    st.stint = Math.max(0, (st.stint ?? 0) + playedDeltaSec);
    st.seconds = st.total;
  });

  if (match.clockRemainingMs <= 0) {
    match.clockRemainingMs = 0;
    match.clockRunning = false;
    try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch {}
    toast('⏱ Fin del ' + qLabel(match.quarter) + ' — pulsa ▶ en el siguiente');
  }

  persist();
  paintClock();
  paintPlayers();
  toast(`Reloj: ${fmtClock(match.clockRemainingMs)}`);
}
$('#btn-adj-m5').onclick = () => adjustClock(-5);
$('#btn-adj-m1').onclick = () => adjustClock(-1);
$('#btn-adj-p1').onclick = () => adjustClock(1);
$('#btn-adj-p5').onclick = () => adjustClock(5);

function paintPossession() {
  const b = $('#btn-possession'), t = $('#poss-arrow-text');
  if (!b || !t || !match) return;
  const isTeam = match.possession === 'team';
  b.classList.toggle('poss-team', isTeam);
  b.classList.toggle('poss-opp', !isTeam);
  t.textContent = isTeam ? '◀ NOSOTROS' : 'RIVAL ▶';
}
$('#btn-possession').onclick = () => {
  if (!match || match.status !== 'live') return;
  match.possession = match.possession === 'team' ? 'opp' : 'team';
  persist(); paintPossession();
  toast(match.possession === 'team' ? 'Posesión: Mi equipo ◀' : 'Posesión: Rival ▶');
};

function getTimeoutsInfo() {
  const q = match.quarter;
  if (q <= 2) {
    return {
      label: '1ª P (2 TM)',
      max: 2,
      usedTeam: match.timeouts.team.h1 || 0,
      usedOpp: match.timeouts.opp.h1 || 0,
      setTeam: (v) => { match.timeouts.team.h1 = v; },
      setOpp: (v) => { match.timeouts.opp.h1 = v; }
    };
  } else if (q <= 4) {
    return {
      label: '2ª P (3 TM)',
      max: 3,
      usedTeam: match.timeouts.team.h2 || 0,
      usedOpp: match.timeouts.opp.h2 || 0,
      setTeam: (v) => { match.timeouts.team.h2 = v; },
      setOpp: (v) => { match.timeouts.opp.h2 = v; }
    };
  } else {
    const otNum = q - 4;
    return {
      label: `PR${otNum} (1 TM)`,
      max: 1,
      usedTeam: match.timeouts.team.ot[q] || 0,
      usedOpp: match.timeouts.opp.ot[q] || 0,
      setTeam: (v) => { match.timeouts.team.ot[q] = v; },
      setOpp: (v) => { match.timeouts.opp.ot[q] = v; }
    };
  }
}
function paintTimeouts() {
  if (!match) return;
  const info = getTimeoutsInfo();
  const badge = $('#to-phase-badge');
  if (badge) badge.textContent = info.label;
  const boxTeam = $('#to-dots-team'), boxOpp = $('#to-dots-opp');
  if (!boxTeam || !boxOpp) return;
  boxTeam.innerHTML = ''; boxOpp.innerHTML = '';

  for (let i = 1; i <= info.max; i++) {
    const dotT = document.createElement('button');
    dotT.type = 'button';
    dotT.className = 'to-dot' + (i <= info.usedTeam ? ' active' : '');
    dotT.title = i <= info.usedTeam ? `TM ${i} pedido (toca para desmarcar)` : `Marcar TM ${i} (Mi equipo)`;
    dotT.onclick = () => {
      const next = i <= info.usedTeam ? i - 1 : i;
      info.setTeam(next);
      if (next >= i) {
        match.notes.push({
          id: uid(),
          text: '⏱️ TM pedido (Mi equipo)',
          playerId: null,
          quarter: match.quarter,
          clock: fmtClock(match.clockRemainingMs),
          createdAt: Date.now()
        });
        paintNotes();
        toast('TM registrado · Mi equipo');
      } else {
        const revIdx = [...match.notes].reverse().findIndex(n => n.text?.includes('TM') && n.text?.includes('Mi equipo') && n.quarter === match.quarter);
        if (revIdx >= 0) {
          const actualIdx = match.notes.length - 1 - revIdx;
          match.notes.splice(actualIdx, 1);
          paintNotes();
        }
        toast('TM desmarcado · Mi equipo');
      }
      persist(); paintTimeouts();
    };
    boxTeam.appendChild(dotT);

    const dotO = document.createElement('button');
    dotO.type = 'button';
    dotO.className = 'to-dot opp' + (i <= info.usedOpp ? ' active' : '');
    dotO.title = i <= info.usedOpp ? `TM Rival ${i} pedido (toca para desmarcar)` : `Marcar TM Rival ${i}`;
    dotO.onclick = () => {
      const next = i <= info.usedOpp ? i - 1 : i;
      info.setOpp(next);
      if (next >= i) {
        match.notes.push({
          id: uid(),
          text: '⏱️ TM pedido (Rival)',
          playerId: null,
          quarter: match.quarter,
          clock: fmtClock(match.clockRemainingMs),
          createdAt: Date.now()
        });
        paintNotes();
        toast('TM registrado · Rival');
      } else {
        const revIdx = [...match.notes].reverse().findIndex(n => n.text?.includes('TM') && n.text?.includes('Rival') && n.quarter === match.quarter);
        if (revIdx >= 0) {
          const actualIdx = match.notes.length - 1 - revIdx;
          match.notes.splice(actualIdx, 1);
          paintNotes();
        }
        toast('TM desmarcado · Rival');
      }
      persist(); paintTimeouts();
    };
    boxOpp.appendChild(dotO);
  }
}
$('#btn-q-prev').onclick = () => {
  if (!match || match.quarter <= 1) return;
  pendingSubId = null;
  match.quarter--; match.clockRunning = false; match.clockRemainingMs = match.quarterLengthSec * 1000; persist(); renderLive();
};
$('#btn-q-next').onclick = () => {
  if (!match) return;
  pendingSubId = null;
  match.quarter++; match.clockRunning = false; match.clockRemainingMs = match.quarterLengthSec * 1000;
  ensureShape();
  persist(); renderLive(); toast('Cuarto: ' + qLabel(match.quarter));
};
$('#btn-tf-plus').onclick = () => {
  if (!match) return;
  match.teamFouls[match.quarter - 1] = (match.teamFouls[match.quarter - 1] || 0) + 1;
  persist(); paintClock();
};
$('#btn-tf-minus').onclick = () => {
  if (!match) return;
  match.teamFouls[match.quarter - 1] = Math.max(0, (match.teamFouls[match.quarter - 1] || 0) - 1);
  persist(); paintClock();
};
$('#btn-otf-plus').onclick = () => {
  if (!match) return;
  ensureShape();
  match.oppTeamFouls[match.quarter - 1] = (match.oppTeamFouls[match.quarter - 1] || 0) + 1;
  persist(); paintClock();
};
$('#btn-otf-minus').onclick = () => {
  if (!match) return;
  ensureShape();
  match.oppTeamFouls[match.quarter - 1] = Math.max(0, (match.oppTeamFouls[match.quarter - 1] || 0) - 1);
  persist(); paintClock();
};

function playerById(id) { return match.roster.find(p => p.id === id); }
function paintPlayers() {
  const court = $('#court-list'), bench = $('#bench-list');
  const on = new Set(match.onCourtIds);
  $('#court-count').textContent = match.onCourtIds.length + '/5';
  const mk = (p, inCourt) => {
    const st = match.stats[p.id] || { seconds: 0, total: 0, stint: 0, fouls: 0, plusMinus: 0 };
    const total = st.total ?? st.seconds ?? 0;
    const stint = inCourt ? (st.stint ?? 0) : 0;
    const pm = st.plusMinus ?? 0;
    const pmCls = pm > 0 ? 'pos' : pm < 0 ? 'neg' : '';
    const pmTxt = (pm > 0 ? '+' : '') + pm;
    const el = document.createElement('div');
    const subTargetCls = pendingSubId === p.id ? ' is-sub-target' : (pendingSubId && inCourt ? ' can-sub-out' : '');
    el.className = 'player-card' + (st.fouls >= 5 ? ' fouled-out' : st.fouls === 4 ? ' warning' : '') + subTargetCls;
    const badge = st.fouls >= 5 ? 'b5' : st.fouls === 4 ? 'b4' : '';
    const status = inCourt ? (match.clockRunning ? '● en pista' : 'en pista') : 'banquillo';
    const stintCls = !inCourt ? '' : stint >= 7 * 60 ? 'crit' : stint >= 4 * 60 ? 'warn' : '';
    const timeLine = inCourt
      ? `<small><span class="racha ${stintCls}"> ${fmtPlayed(stint)}</span> <span class="ptotal">(${fmtPlayed(total)} total)</span> · ${status} · <span class="pm-badge ${pmCls}" title="Plus/Minus">${pmTxt}</span></small>`
      : `<small><span class="ptotal">Σ ${fmtPlayed(total)} total</span> · ${status} · <span class="pm-badge ${pmCls}" title="Plus/Minus">${pmTxt}</span></small>`;
    el.innerHTML = `
      <span class="dorsal">#${esc(p.number)}</span>
      <span class="pinfo"><strong>${esc(p.name)}</strong>
        ${timeLine}</span>
      <span class="foul-badge ${badge}">🔴${st.fouls}</span>
      <span class="foul-btns">
        <button class="btn ghost sm" data-a="sub" title="Mover">⇄</button>
        <button class="btn primary sm" data-a="plus" title="Sumar falta">+F</button>
        <button class="btn ghost sm" data-a="minus" title="Corregir">−</button>
      </span>`;
    el.querySelector('[data-a="sub"]').onclick = (e) => { e.stopPropagation(); toggleCourt(p.id); };
    el.querySelector('[data-a="plus"]').onclick = (e) => { e.stopPropagation(); addFoul(p.id); };
    el.querySelector('[data-a="minus"]').onclick = (e) => {
      e.stopPropagation();
      if (match.stats[p.id].fouls > 0) {
        match.stats[p.id].fouls--;
        // La falta individual también contó como falta de equipo: descontarla
        const q = match.quarter - 1;
        match.teamFouls[q] = Math.max(0, (match.teamFouls[q] || 0) - 1);
      }
      persist(); paintPlayers(); paintClock();
    };
    el.onclick = () => toggleCourt(p.id);
    return el;
  };
  const cIds = match.onCourtIds.map(playerById).filter(Boolean);
  const bPs = match.roster.filter(p => !on.has(p.id));
  court.innerHTML = ''; bench.innerHTML = '';
  cIds.forEach(p => court.appendChild(mk(p, true)));
  bPs.forEach(p => bench.appendChild(mk(p, false)));
  if (!cIds.length) court.innerHTML = '<p class="hint">Toca una jugadora del banquillo para sacarla a pista.</p>';
}

function toggleCourt(id) {
  if (!match || match.status !== 'live') return;
  const i = match.onCourtIds.indexOf(id);
  const p = playerById(id);
  if (!p) return;
  const nowMs = match.clockRemainingMs;
  const qNow = match.quarter;
  const st = match.stats[id] || (match.stats[id] = { seconds: 0, total: 0, stint: 0, fouls: 0, plusMinus: 0 });

  // CASO 1: Hay una jugadora del banquillo esperando cambio directo (pendingSubId)
  if (pendingSubId) {
    if (pendingSubId === id) {
      pendingSubId = null;
      paintPlayers();
      toast('Cambio cancelado');
      return;
    }

    if (i < 0) {
      // Ha pulsado otra del banquillo: cambiar la selección
      pendingSubId = id;
      paintPlayers();
      toast(`Seleccionada #${p.number} ${p.name} · Toca quién sale de pista`);
      return;
    }

    // Toca jugadora en pista (i >= 0): cambio directo A por B
    const pIn = playerById(pendingSubId);
    const pOut = p;
    const stIn = match.stats[pIn.id] || (match.stats[pIn.id] = { seconds: 0, total: 0, stint: 0, fouls: 0 });
    const stOut = st;

    // Salida pOut
    match.onCourtIds.splice(i, 1);
    stOut.prevStint = stOut.stint;
    stOut.stint = 0;
    stOut.seconds = stOut.total ?? 0;
    stOut.leftAtMs = nowMs;
    stOut.leftAtQuarter = qNow;

    // Entrada pIn
    match.onCourtIds.push(pIn.id);
    stIn.stint = 0;
    stIn.enteredAtMs = nowMs;
    stIn.enteredAtQuarter = qNow;

    const noteOutId = uid();
    const noteInId = uid();
    stOut.lastSubNoteId = noteOutId;
    stIn.lastSubNoteId = noteInId;

    match.notes.push({
      id: noteOutId,
      text: `🔄 Sale #${pOut.number} ${pOut.name}`,
      playerId: pOut.id,
      quarter: qNow,
      clock: fmtClock(nowMs),
      createdAt: Date.now()
    });
    match.notes.push({
      id: noteInId,
      text: `🔄 Entra #${pIn.number} ${pIn.name}`,
      playerId: pIn.id,
      quarter: qNow,
      clock: fmtClock(nowMs),
      createdAt: Date.now() + 1
    });

    pendingSubId = null;
    persist();
    paintPlayers();
    paintNotes();
    toast(`Cambio: Entra #${pIn.number} ⇄ Sale #${pOut.number} 🔄`);
    return;
  }

  // CASO 2: La jugadora está EN PISTA y sale a banquillo
  if (i >= 0) {
    // Si acaba de entrar por error (menos de 8s de reloj) y se vuelve a pulsar: deshacer
    if (st.enteredAtMs != null && st.enteredAtQuarter === qNow && Math.abs(nowMs - st.enteredAtMs) < 8000) {
      match.onCourtIds.splice(i, 1);
      st.stint = 0;
      st.seconds = st.total ?? 0;
      if (st.lastSubNoteId) {
        match.notes = match.notes.filter(n => n.id !== st.lastSubNoteId);
        st.lastSubNoteId = null;
      }
      persist();
      paintPlayers();
      paintNotes();
      toast(`Cambio deshecho · #${p.number} ${p.name} al banquillo`);
      return;
    }

    // Salida normal a banquillo
    match.onCourtIds.splice(i, 1);
    st.prevStint = st.stint;
    st.stint = 0;
    st.seconds = st.total ?? 0;
    st.leftAtMs = nowMs;
    st.leftAtQuarter = qNow;

    const noteId = uid();
    st.lastSubNoteId = noteId;
    match.notes.push({
      id: noteId,
      text: `🔄 Sale #${p.number} ${p.name}`,
      playerId: p.id,
      quarter: qNow,
      clock: fmtClock(nowMs),
      createdAt: Date.now()
    });

    persist();
    paintPlayers();
    paintNotes();
    toast(`Sale #${p.number} ${p.name}`);
    return;
  }

  // CASO 3: La jugadora está EN BANQUILLO
  if (match.onCourtIds.length >= 5) {
    // Ya hay 5 en pista: activar modo cambio directo
    pendingSubId = id;
    paintPlayers();
    toast(`🔄 Seleccionada #${p.number} ${p.name} · Toca quién sale de pista (o toca de nuevo para cancelar)`);
    return;
  }

  // Hay menos de 5 en pista: entra directamente
  // Si acaba de salir por error (menos de 8s de reloj) y se vuelve a meter: deshacer salida
  if (st.leftAtMs != null && st.leftAtQuarter === qNow && Math.abs(nowMs - st.leftAtMs) < 8000) {
    match.onCourtIds.push(id);
    st.stint = (st.prevStint || 0) + (st.leftAtMs - nowMs) / 1000;
    if (st.lastSubNoteId) {
      match.notes = match.notes.filter(n => n.id !== st.lastSubNoteId);
      st.lastSubNoteId = null;
    }
    persist();
    paintPlayers();
    paintNotes();
    toast(`Cambio deshecho · #${p.number} ${p.name} sigue en pista`);
    return;
  }

  // Entrada normal
  match.onCourtIds.push(id);
  st.stint = 0;
  st.enteredAtMs = nowMs;
  st.enteredAtQuarter = qNow;

  const noteId = uid();
  st.lastSubNoteId = noteId;
  match.notes.push({
    id: noteId,
    text: `🔄 Entra #${p.number} ${p.name}`,
    playerId: p.id,
    quarter: qNow,
    clock: fmtClock(nowMs),
    createdAt: Date.now()
  });

  persist();
  paintPlayers();
  paintNotes();
  toast(`Entra #${p.number} ${p.name}`);
}
function addFoul(id) {
  const st = match.stats[id]; st.fouls++;
  match.teamFouls[match.quarter - 1] = (match.teamFouls[match.quarter - 1] || 0) + 1;
  try { navigator.vibrate && navigator.vibrate(40); } catch {}
  if (st.fouls === 5) toast('🚨 ¡5 faltas! ' + (playerById(id)?.name || '') + ' eliminada');
  persist(); paintPlayers(); paintClock();
}

/* Rival */
function paintOpp() {
  const box = $('#opp-live-list'); box.innerHTML = '';
  match.oppNumbers.forEach(n => {
    const c = match.oppFouls[n] || 0;
    const d = document.createElement('div'); d.className = 'opp-card';
    d.innerHTML = `<strong>#${esc(n)}</strong><span class="foul-badge ${c >= 5 ? 'b5' : c === 4 ? 'b4' : ''}">🔴 ${c}</span>
      <div class="foul-btns" style="justify-content:center;margin-top:8px">
        <button class="btn primary sm" data-a="+">+ Falta</button>
        <button class="btn ghost sm" data-a="-">−</button>
      </div>`;
    d.querySelector('[data-a="+"]').onclick = () => {
      match.oppFouls[n]++;
      ensureShape();
      match.oppTeamFouls[match.quarter - 1] = (match.oppTeamFouls[match.quarter - 1] || 0) + 1;
      persist(); paintOpp(); paintClock();
    };
    d.querySelector('[data-a="-"]').onclick = () => {
      if ((match.oppFouls[n] || 0) > 0) {
        match.oppFouls[n]--;
        ensureShape();
        const q = match.quarter - 1;
        match.oppTeamFouls[q] = Math.max(0, (match.oppTeamFouls[q] || 0) - 1);
      }
      persist(); paintOpp(); paintClock();
    };
    box.appendChild(d);
  });
  if (!match.oppNumbers.length) box.innerHTML = '<p class="hint">Sin dorsales rivales.</p>';
}

/* Notas */
function paintNotePlayers() {
  const s = $('#note-player'); const cur0 = s.value;
  s.innerHTML = '<option value="">General</option>';
  match.roster.forEach(p => {
    const o = document.createElement('option'); o.value = p.id; o.textContent = '#' + p.number + ' ' + p.name; s.appendChild(o);
  });
  s.value = cur0;
}
function paintNotes() {
  const box = $('#notes-list');
  if (!box || !match) return;
  box.innerHTML = '';

  const allNotes = match.notes || [];
  const tacticalNotes = allNotes.filter(n => !n.text?.startsWith('🔄') && !n.text?.startsWith('⏱️'));
  const subNotes = allNotes.filter(n => n.text?.startsWith('🔄'));
  const tmNotes = allNotes.filter(n => n.text?.startsWith('⏱️'));

  const cAll = $('#cnt-all'); if (cAll) cAll.textContent = allNotes.length;
  const cTac = $('#cnt-tactical'); if (cTac) cTac.textContent = tacticalNotes.length;
  const cSub = $('#cnt-subs'); if (cSub) cSub.textContent = subNotes.length;
  const cTm = $('#cnt-tm'); if (cTm) cTm.textContent = tmNotes.length;

  let displayNotes = allNotes;
  if (notesFilter === 'tactical') displayNotes = tacticalNotes;
  else if (notesFilter === 'subs') displayNotes = subNotes;
  else if (notesFilter === 'tm') displayNotes = tmNotes;

  [...displayNotes].reverse().forEach(n => {
    const pname = n.playerId ? playerById(n.playerId)?.name || '' : 'General';
    const isSub = n.text?.startsWith('🔄');
    const isTm = n.text?.startsWith('⏱️');
    const d = document.createElement('div');
    d.className = 'player-card note' + (isSub ? ' note-sub' : isTm ? ' note-tm' : '');
    d.innerHTML = `<span class="pinfo"><strong>${esc(n.text)}</strong><small>${qLabel(n.quarter)} · quedan ${esc(n.clock)} · ${esc(pname)} · ${new Date(n.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</small></span>
      <button class="btn ghost sm" title="Eliminar de las notas">×</button>`;
    d.querySelector('button').onclick = () => {
      match.notes = match.notes.filter(x => x.id !== n.id);
      persist();
      paintNotes();
      toast('Nota eliminada');
    };
    box.appendChild(d);
  });

  if (!displayNotes.length) {
    const emptyMsg = notesFilter === 'tactical' ? 'Sin notas tácticas.' :
      notesFilter === 'subs' ? 'Sin cambios registrados.' :
      notesFilter === 'tm' ? 'Sin tiempos muertos registrados.' :
      'Sin notas ni eventos todavía.';
    box.innerHTML = `<p class="hint">${emptyMsg}</p>`;
  }
}

document.querySelectorAll('.btn-filter').forEach(b => {
  b.addEventListener('click', () => {
    notesFilter = b.dataset.filter || 'all';
    document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.toggle('is-active', btn === b));
    paintNotes();
  });
});

$('#btn-add-note').onclick = () => {
  const t = $('#note-text').value.trim();
  if (!t || !match) return;
  match.notes.push({ id: uid(), text: t, playerId: $('#note-player').value || null, quarter: match.quarter, clock: fmtClock(match.clockRemainingMs), createdAt: Date.now() });
  $('#note-text').value = ''; persist(); paintNotes(); toast('Nota guardada ✎');
};
$('#note-text').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-add-note').click(); });

$('#btn-finish').onclick = () => {
  if (!match || !confirm('¿Finalizar el partido y ver el resumen?')) return;
  pendingSubId = null;
  match.status = 'finished'; match.finishedAt = Date.now(); match.clockRunning = false;
  releaseWakeLock();
  saveHistoryMatch(match);
  persist(); updatePill();
  selectedHistoryId = 'current';
  showView('summary'); toast('Partido finalizado 🏁');
};

/* ---------- RESUMEN & HISTORIAL ---------- */
function renderSummary() {
  const box = $('#summary-body');
  const selCard = $('#history-selector-card');
  const selBox = $('#history-select');
  const btnDelHist = $('#btn-del-history');

  const hasHistory = history.length > 0;
  if (hasHistory || (match && match.status === 'live')) {
    selCard.classList.remove('hidden');
    let selHtml = '';
    if (match) {
      const tag = match.status === 'live' ? ' (en vivo)' : ' (actual)';
      selHtml += `<option value="current">${esc(match.teamName)}${tag} · ${new Date(match.startedAt).toLocaleDateString('es-ES')}</option>`;
    }
    history.forEach(h => {
      selHtml += `<option value="${h.id}">${esc(h.teamName)} · ${new Date(h.startedAt).toLocaleDateString('es-ES')} (${qLabel(h.quarter)})</option>`;
    });
    selBox.innerHTML = selHtml;
    if (selectedHistoryId !== 'current' && !history.some(h => h.id === selectedHistoryId)) {
      selectedHistoryId = match ? 'current' : (history[0]?.id || 'current');
    }
    selBox.value = selectedHistoryId;
  } else {
    selCard.classList.add('hidden');
  }

  let curM = null;
  if (selectedHistoryId === 'current') {
    curM = match;
  } else {
    curM = history.find(h => h.id === selectedHistoryId);
  }

  if (!curM || (curM === match && match.status !== 'finished')) {
    $('#summary-sub').textContent = match?.status === 'live'
      ? 'Hay un partido en curso — finalízalo para ver el resumen.'
      : 'Todavía no hay ningún partido finalizado en el historial.';
    box.innerHTML = '';
    btnDelHist.classList.add('hidden');
    return;
  }

  if (selectedHistoryId !== 'current' || (!match && curM)) {
    btnDelHist.classList.remove('hidden');
  } else {
    btnDelHist.classList.add('hidden');
  }

  $('#summary-sub').textContent = `${curM.teamName} · ${new Date(curM.startedAt).toLocaleDateString('es-ES')} · ${qLabel(curM.quarter)} jugados`;

  const scT = curM.score?.team ?? 0, scO = curM.score?.opp ?? 0;
  const scDiff = scT - scO;
  let html = `<div class="card center"><h2>Marcador final</h2>
    <div class="final-score"><span>NOS ${scT}</span><span class="final-diff">${scDiff >= 0 ? '+' : ''}${scDiff}</span><span>RIV ${scO}</span></div>
    <p class="hint">Por cuarto: ${((curM.scoreByQuarter || []).map((q, i) => qLabel(i + 1) + ' ' + (q.team || 0) + '-' + (q.opp || 0)).join(' · ') || '—')}</p></div>`;

  const rows = [...(curM.roster || [])].sort((a, b) => ((curM.stats[b.id]?.plusMinus ?? 0) - (curM.stats[a.id]?.plusMinus ?? 0)) || (((curM.stats[b.id]?.total ?? curM.stats[b.id]?.seconds) || 0) - (((curM.stats[a.id]?.total ?? curM.stats[a.id]?.seconds) || 0))));
  html += `<div class="card"><h2>Mi equipo · minutos, faltas y +/−</h2><table class="res">
    <tr><th>Dor</th><th>Jugadora</th><th>Min</th><th>+/-</th><th>Faltas</th></tr>`;
  rows.forEach(p => {
    const st = curM.stats[p.id] || { seconds: 0, total: 0, fouls: 0, plusMinus: 0 };
    const total = st.total ?? st.seconds ?? 0;
    const pm = st.plusMinus ?? 0;
    const pmTxt = (pm > 0 ? '+' : '') + pm;
    html += `<tr><td>#${esc(p.number)}</td><td>${esc(p.name)} ${st.fouls >= 5 ? '🚨' : ''}</td><td>${fmtPlayed(total)}</td><td><strong>${pmTxt}</strong></td><td>🔴 ${st.fouls}</td></tr>`;
  });
  html += `</table><p class="hint">Faltas de equipo por cuarto: ${(curM.teamFouls || []).map((f, i) => qLabel(i + 1) + ': ' + f).join(' · ')}</p></div>`;

  html += `<div class="card"><h2>Rival · faltas</h2><p>${(curM.oppNumbers || []).map(n => '#' + esc(n) + ' (🔴' + (curM.oppFouls[n] || 0) + ')').join(' · ') || '—'}</p><p class="hint">Faltas de equipo rival por cuarto: ${(curM.oppTeamFouls || []).map((f, i) => qLabel(i + 1) + ': ' + f).join(' · ')}</p></div>`;

  const tmTeam = `1ª Parte: ${curM.timeouts?.team?.h1 || 0}/2 · 2ª Parte: ${curM.timeouts?.team?.h2 || 0}/3`;
  const tmOpp = `1ª Parte: ${curM.timeouts?.opp?.h1 || 0}/2 · 2ª Parte: ${curM.timeouts?.opp?.h2 || 0}/3`;
  html += `<div class="card"><h2>Tiempos Muertos y Posesión</h2>
    <p><strong>TM Mi equipo:</strong> ${tmTeam}</p>
    <p><strong>TM Rival:</strong> ${tmOpp}</p>
    <p class="hint">Última flecha de posesión: ${curM.possession === 'team' ? 'Mi equipo' : 'Rival'}</p>
  </div>`;

  const allNotes = curM.notes || [];
  const tacticalNotes = allNotes.filter(n => !n.text?.startsWith('🔄') && !n.text?.startsWith('⏱️'));
  const eventNotes = allNotes.filter(n => n.text?.startsWith('🔄') || n.text?.startsWith('⏱️'));

  let notesHtml = `<div class="card"><h2>Notas tácticas (${tacticalNotes.length})</h2>`;
  if (tacticalNotes.length) {
    notesHtml += tacticalNotes.map(n =>
      `<p>• <strong>[${qLabel(n.quarter)} · ${esc(n.clock)}]</strong> ${esc(n.text)} <span class="hint">— ${n.playerId ? esc(playerById(n.playerId)?.name || '') : 'General'}</span></p>`
    ).join('');
  } else {
    notesHtml += '<p class="hint">Sin notas tácticas en este partido.</p>';
  }
  notesHtml += `</div>`;

  notesHtml += `<div class="card"><h2>Historial de cambios y TMs (${eventNotes.length})</h2>`;
  if (eventNotes.length) {
    notesHtml += eventNotes.map(n =>
      `<p>• <strong>[${qLabel(n.quarter)} · ${esc(n.clock)}]</strong> ${esc(n.text)}</p>`
    ).join('');
  } else {
    notesHtml += '<p class="hint">Sin eventos registrados.</p>';
  }
  notesHtml += `</div>`;

  const scoreLog = curM.scoreLog || [];
  let scoreHtml = `<div class="card"><h2>Canastas (${scoreLog.length})</h2>`;
  if (scoreLog.length) {
    scoreHtml += scoreLog.map(e =>
      `<p>• <strong>[${qLabel(e.quarter)} · ${esc(e.clock || '')}]</strong> ${e.points < 0 ? '−1 corrección' : '+' + e.points} ${e.side === 'team' ? 'NOS' : 'RIV'}</p>`
    ).join('');
  } else {
    scoreHtml += '<p class="hint">Sin canastas registradas.</p>';
  }
  scoreHtml += `</div>`;

  box.innerHTML = html + notesHtml + scoreHtml;
}

$('#history-select').onchange = (e) => {
  selectedHistoryId = e.target.value;
  renderSummary();
};

$('#btn-del-history').onclick = () => {
  if (selectedHistoryId === 'current') return;
  if (!confirm('¿Eliminar este partido del historial? Esta acción no se puede deshacer.')) return;
  history = history.filter(h => h.id !== selectedHistoryId);
  save(LS_HISTORY, history);
  selectedHistoryId = match ? 'current' : (history[0]?.id || 'current');
  renderSummary();
  toast('Partido eliminado del historial 🗑');
};

$('#btn-new-match').onclick = () => {
  if (match?.status === 'live' && !confirm('Hay un partido en vivo. ¿Descartarlo?')) return;
  if (match?.status === 'finished') {
    saveHistoryMatch(match);
  }
  pendingSubId = null;
  releaseWakeLock();
  match = null; persist(); renderLive(); updatePill();
  selectedHistoryId = history.length ? history[0].id : 'current';
  showView('setup');
};

$('#btn-export').onclick = async () => {
  const curM = (selectedHistoryId !== 'current' && history.find(h => h.id === selectedHistoryId)) || match;
  if (!curM) return toast('Nada que copiar');
  const lines = [`BANQUILLO · ${curM.teamName} · ${new Date(curM.startedAt).toLocaleDateString('es-ES')}`, ''];
  lines.push(`MARCADOR: NOS ${curM.score?.team ?? 0} - ${curM.score?.opp ?? 0} RIV`);
  if (Array.isArray(curM.scoreByQuarter)) lines.push('Por cuarto: ' + curM.scoreByQuarter.map((q, i) => qLabel(i + 1) + ' ' + (q.team || 0) + '-' + (q.opp || 0)).join(' '));
  lines.push('');
  [...(curM.roster || [])].sort((a, b) => ((curM.stats[b.id]?.plusMinus ?? 0) - (curM.stats[a.id]?.plusMinus ?? 0))).forEach(p => {
    const s = curM.stats[p.id];
    const t = s ? (s.total ?? s.seconds ?? 0) : 0;
    const pm = s?.plusMinus ?? 0;
    lines.push(`#${p.number} ${p.name} — ${fmtPlayed(t)} — ${pm >= 0 ? '+' : ''}${pm} — ${s?.fouls || 0} faltas`);
  });
  lines.push('', 'Rival: ' + (curM.oppNumbers || []).map(n => `#${n} (${curM.oppFouls[n] || 0})`).join(' '));
  if (Array.isArray(curM.oppTeamFouls)) lines.push('Equipo rival por cuarto: ' + curM.oppTeamFouls.map((f, i) => qLabel(i + 1) + ': ' + f).join(' '));
  lines.push('', `Tiempos Muertos Mi equipo: ${curM.timeouts?.team?.h1 || 0}/2 (1ªP) · ${curM.timeouts?.team?.h2 || 0}/3 (2ªP)`);
  lines.push(`Tiempos Muertos Rival: ${curM.timeouts?.opp?.h1 || 0}/2 (1ªP) · ${curM.timeouts?.opp?.h2 || 0}/3 (2ªP)`);
  lines.push(`Posesión: ${curM.possession === 'team' ? 'Mi equipo' : 'Rival'}`);
  if ((curM.scoreLog || []).length) {
    lines.push('', 'Canastas:');
    (curM.scoreLog || []).forEach(e => lines.push(`[${qLabel(e.quarter)} ${e.clock || ''}] ${e.points < 0 ? '−1 corrección' : '+' + e.points} ${e.side === 'team' ? 'NOS' : 'RIV'}`));
  }
  lines.push('', 'Notas y eventos:');
  (curM.notes || []).forEach(n => lines.push(`[${qLabel(n.quarter)} ${n.clock}] ${n.text}`));
  try { await navigator.clipboard.writeText(lines.join('\n')); toast('Resumen copiado 📋'); }
  catch { toast('No se pudo copiar'); }
};

/* ---------- init ---------- */
ensureShape();
renderTeams(); renderSetup(); renderLive(); startTicker(); updatePill();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
