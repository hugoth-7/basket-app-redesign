/* Banquillo PWA — vanilla JS, todo local */
const LS_TEAMS = 'bball.teams.v1';
const LS_MATCH = 'bball.match.v1';
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
let editingTeamId = null;
let draftPlayers = [];
let draftOpp = [];
let setupQuarterMin = 10;
let tickTimer = null;
let tickN = 0;

/* ---------- navegación ---------- */
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => showView(b.dataset.goto)));
function showView(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + name));
  if (name === 'summary') renderSummary();
  if (name === 'setup') renderSetup();
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
    stats: Object.fromEntries(roster.map(p => [p.id, { seconds: 0, total: 0, stint: 0, fouls: 0 }])),
    oppNumbers: [...draftOpp], oppFouls: Object.fromEntries(draftOpp.map(n => [n, 0])),
    teamFouls: [0], oppTeamFouls: [0], notes: [], status: 'live', startedAt: Date.now(), finishedAt: null
  };
  save(LS_MATCH, match);
  startTicker(); renderLive(); updatePill();
  showView('live'); toast('¡Partido en marcha! Elige el quinteto 🏀');
};

/* ---------- EN VIVO ---------- */
function cur() { return match; }
function persist() { save(LS_MATCH, match); }
// Migración suave: partidos guardados antes de existir oppTeamFouls / total+stint
function ensureShape() {
  if (!match) return;
  if (!Array.isArray(match.teamFouls)) match.teamFouls = [0];
  if (!Array.isArray(match.oppTeamFouls)) match.oppTeamFouls = [0];
  while (match.teamFouls.length < match.quarter) match.teamFouls.push(0);
  while (match.oppTeamFouls.length < match.quarter) match.oppTeamFouls.push(0);
  const on = new Set(match.onCourtIds || []);
  (match.roster || []).forEach(p => {
    if (!match.stats[p.id]) match.stats[p.id] = { seconds: 0, total: 0, stint: 0, fouls: 0 };
    const st = match.stats[p.id];
    if (st.total == null) st.total = st.seconds || 0;   // legacy: seconds era el total
    if (st.seconds == null) st.seconds = st.total || 0; // espejo para compatibilidad
    if (st.stint == null) st.stint = 0;                 // racha desconocida en partidos viejos → 0
    if (st.fouls == null) st.fouls = 0;
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
  if (empty) { updatePill(); return; }
  ensureShape();
  paintClock(); paintPlayers(); paintOpp(); paintNotes(); paintNotePlayers();
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
}
$('#btn-play').onclick = () => {
  if (!match || match.status !== 'live') return;
  if (match.clockRemainingMs <= 0) return toast('Cuarto a 0 — avanza de cuarto (▶) o resetea');
  match.clockRunning = true; match.lastTick = Date.now(); persist(); paintClock();
};
$('#btn-pause').onclick = () => { if (match) { match.clockRunning = false; persist(); paintClock(); } };
$('#btn-clock-reset').onclick = () => {
  if (!match || !confirm('¿Resetear el reloj de este cuarto?')) return;
  match.clockRunning = false; match.clockRemainingMs = match.quarterLengthSec * 1000; persist(); paintClock();
};
$('#btn-q-prev').onclick = () => {
  if (!match || match.quarter <= 1) return;
  match.quarter--; match.clockRunning = false; match.clockRemainingMs = match.quarterLengthSec * 1000; persist(); renderLive();
};
$('#btn-q-next').onclick = () => {
  if (!match) return;
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
    const st = match.stats[p.id] || { seconds: 0, total: 0, stint: 0, fouls: 0 };
    const total = st.total ?? st.seconds ?? 0;
    const stint = inCourt ? (st.stint ?? 0) : 0;
    const el = document.createElement('div');
    el.className = 'player-card' + (st.fouls >= 5 ? ' fouled-out' : st.fouls === 4 ? ' warning' : '');
    const badge = st.fouls >= 5 ? 'b5' : st.fouls === 4 ? 'b4' : '';
    const status = inCourt ? (match.clockRunning ? '● en pista' : 'en pista') : 'banquillo';
    const stintCls = !inCourt ? '' : stint >= 7 * 60 ? 'crit' : stint >= 4 * 60 ? 'warn' : '';
    const timeLine = inCourt
      ? `<small><span class="racha ${stintCls}"> ${fmtPlayed(stint)}</span> <span class="ptotal">(${fmtPlayed(total)} total)</span> · ${status}</small>`
      : `<small><span class="ptotal">Σ ${fmtPlayed(total)} total</span> · ${status}</small>`;
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
  const i = match.onCourtIds.indexOf(id);
  if (i >= 0) {
    // Sale a banquillo: la racha se congela en el total y se resetea a 0
    match.onCourtIds.splice(i, 1);
    if (match.stats[id]) { match.stats[id].stint = 0; match.stats[id].seconds = match.stats[id].total ?? 0; }
  } else {
    if (match.onCourtIds.length >= 5) return toast('Máximo 5 en pista — saca a una primero');
    match.onCourtIds.push(id);
    // Entra en pista: la racha arranca desde 0
    if (match.stats[id]) match.stats[id].stint = 0;
  }
  persist(); paintPlayers();
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
  const box = $('#notes-list'); box.innerHTML = '';
  [...match.notes].reverse().forEach(n => {
    const pname = n.playerId ? playerById(n.playerId)?.name || '' : 'General';
    const d = document.createElement('div'); d.className = 'player-card note';
    d.innerHTML = `<span class="pinfo"><strong>${esc(n.text)}</strong><small>${qLabel(n.quarter)} · quedan ${esc(n.clock)} · ${esc(pname)} · ${new Date(n.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</small></span>
      <button class="btn ghost sm">×</button>`;
    d.querySelector('button').onclick = () => { match.notes = match.notes.filter(x => x.id !== n.id); persist(); paintNotes(); };
    box.appendChild(d);
  });
  if (!match.notes.length) box.innerHTML = '<p class="hint">Sin notas. Ej: “#7 tarda en bajar”.</p>';
}
$('#btn-add-note').onclick = () => {
  const t = $('#note-text').value.trim();
  if (!t || !match) return;
  match.notes.push({ id: uid(), text: t, playerId: $('#note-player').value || null, quarter: match.quarter, clock: fmtClock(match.clockRemainingMs), createdAt: Date.now() });
  $('#note-text').value = ''; persist(); paintNotes(); toast('Nota guardada ✎');
};
$('#note-text').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-add-note').click(); });

$('#btn-finish').onclick = () => {
  if (!match || !confirm('¿Finalizar el partido y ver el resumen?')) return;
  match.status = 'finished'; match.finishedAt = Date.now(); match.clockRunning = false;
  persist(); updatePill(); showView('summary'); toast('Partido finalizado 🏁');
};

/* ---------- RESUMEN ---------- */
function renderSummary() {
  const box = $('#summary-body'); box.innerHTML = '';
  if (!match || match.status !== 'finished') {
    $('#summary-sub').textContent = match?.status === 'live' ? 'Hay un partido en curso — finalízalo para ver el resumen.' : 'Todavía no hay partido finalizado.';
    return;
  }
  $('#summary-sub').textContent = `${match.teamName} · ${new Date(match.startedAt).toLocaleDateString('es-ES')} · ${qLabel(match.quarter)} jugados`;
  const rows = [...match.roster].sort((a, b) => ((match.stats[b.id]?.total ?? match.stats[b.id]?.seconds) || 0) - ((match.stats[a.id]?.total ?? match.stats[a.id]?.seconds) || 0));
  let html = `<div class="card"><h2>Mi equipo · minutos y faltas</h2><table class="res">
    <tr><th>Dor</th><th>Jugadora</th><th>Min</th><th>Faltas</th></tr>`;
  rows.forEach(p => {
    const st = match.stats[p.id] || { seconds: 0, total: 0, fouls: 0 };
    const total = st.total ?? st.seconds ?? 0;
    html += `<tr><td>#${esc(p.number)}</td><td>${esc(p.name)} ${st.fouls >= 5 ? '🚨' : ''}</td><td>${fmtPlayed(total)}</td><td>🔴 ${st.fouls}</td></tr>`;
  });
  html += `</table><p class="hint">Faltas de equipo por cuarto: ${match.teamFouls.map((f, i) => qLabel(i + 1) + ': ' + f).join(' · ')}</p></div>`;
  ensureShape();
  html += `<div class="card"><h2>Rival · faltas</h2><p>${match.oppNumbers.map(n => '#' + esc(n) + ' (🔴' + (match.oppFouls[n] || 0) + ')').join(' · ') || '—'}</p><p class="hint">Faltas de equipo rival por cuarto: ${match.oppTeamFouls.map((f, i) => qLabel(i + 1) + ': ' + f).join(' · ')}</p></div>`;
  html += `<div class="card"><h2>Notas (${match.notes.length})</h2>` + (match.notes.map(n =>
    `<p>• <strong>[${qLabel(n.quarter)} · ${esc(n.clock)}]</strong> ${esc(n.text)} <span class="hint">— ${n.playerId ? esc(playerById(n.playerId)?.name || '') : 'General'}</span></p>`
  ).join('') || '<p class="hint">Sin notas.</p>') + `</div>`;
  box.innerHTML = html;
}
$('#btn-new-match').onclick = () => {
  if (match?.status === 'live' && !confirm('Hay un partido en vivo. ¿Descartarlo?')) return;
  match = null; persist(); renderLive(); updatePill(); showView('setup');
};
$('#btn-export').onclick = async () => {
  if (!match) return toast('Nada que copiar');
  const lines = [`BANQUILLO · ${match.teamName} · ${new Date(match.startedAt).toLocaleDateString('es-ES')}`, ''];
  match.roster.forEach(p => { const s = match.stats[p.id]; const t = s.total ?? s.seconds ?? 0; lines.push(`#${p.number} ${p.name} — ${fmtPlayed(t)} — ${s.fouls} faltas`); });
  lines.push('', 'Rival: ' + match.oppNumbers.map(n => `#${n} (${match.oppFouls[n] || 0})`).join(' '));
  if (Array.isArray(match.oppTeamFouls)) lines.push('Equipo rival por cuarto: ' + match.oppTeamFouls.map((f, i) => qLabel(i + 1) + ': ' + f).join(' '));
  match.notes.forEach(n => lines.push(`[${qLabel(n.quarter)} ${n.clock}] ${n.text}`));
  try { await navigator.clipboard.writeText(lines.join('\n')); toast('Resumen copiado 📋'); }
  catch { toast('No se pudo copiar'); }
};

/* ---------- init ---------- */
ensureShape();
renderTeams(); renderSetup(); renderLive(); startTicker(); updatePill();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
