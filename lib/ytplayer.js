// ============================================================
// Player de áudio do YouTube — barra fixa embaixo, tocando IGUAL
// para todo mundo na mesa (Mestre comanda, todos ouvem). Só o
// Mestre controla play/pausa/faixa/busca/fila; o Jogador só ouve
// e ajusta o PRÓPRIO volume (nunca sincronizado).
// ============================================================

const VOL_KEY = 'vt_music_vol';

export function mountYtPlayer({ campaignId, role, db }) {
  if (document.getElementById('yt-bar')) return; // já montado
  document.body.classList.add('has-ytbar');
  const isGM = role === 'gm';

  const bar = document.createElement('div');
  bar.id = 'yt-bar';
  bar.innerHTML = `
    ${isGM ? `<div class="yt-controls">
      <button class="yt-btn tgl" id="yt-shuffle" title="Aleatório: desligado">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
      </button>
      <button class="yt-btn" id="yt-prev" title="Faixa anterior"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6z"/><path d="M18 6v12L8 12z"/></svg></button>
      <button class="yt-btn" id="yt-back" title="Voltar 10 segundos"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 6 3 12l9 6V6z"/><path d="M21 6l-9 6 9 6V6z"/></svg></button>
      <button class="yt-btn play" id="yt-play" title="Play/Pausar"><svg id="yt-play-icon" viewBox="0 0 24 24" fill="#08161a"><path d="M8 5v14l11-7z"/></svg></button>
      <button class="yt-btn" id="yt-fwd" title="Avançar 10 segundos"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 6l9 6-9 6V6z"/><path d="M3 6l9 6-9 6V6z"/></svg></button>
      <button class="yt-btn" id="yt-next" title="Próxima faixa"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2z"/><path d="M6 6v12l10-6z"/></svg></button>
      <button class="yt-btn tgl" id="yt-repeat" title="Repetir: desligado">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
        <span class="one">1</span>
      </button>
    </div>` : ''}
    <div class="yt-track" id="yt-track-title">Nenhuma música</div>
    <div class="yt-progress-wrap">
      <span class="yt-time" id="yt-cur">0:00</span>
      ${isGM
        ? '<input id="yt-seek" type="range" min="0" max="100" value="0" step="0.1">'
        : '<div class="yt-progress-bar"><i class="yt-fill" id="yt-fill"></i></div>'}
      <span class="yt-time" id="yt-dur">0:00</span>
    </div>
    <div class="yt-vol"><span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg></span><input id="yt-vol" type="range" min="0" max="100" value="80" title="Seu volume (só neste dispositivo)"></div>
    ${isGM ? `<button class="yt-btn" id="yt-panel-toggle" title="Adicionar música (link do YouTube)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9v6l5.5-3z" fill="currentColor" stroke="none"/></svg>
    </button>` : ''}`;
  document.body.appendChild(bar);

  let panel = null;
  if (isGM) {
    panel = document.createElement('div');
    panel.id = 'yt-panel';
    panel.innerHTML = `
      <div class="yt-panel-head"><b><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg></span>Player de música (YouTube)</b><button class="x" id="yt-panel-close"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      <div class="yt-panel-body">
        <div class="url-row">
          <input id="yt-url" type="text" placeholder="Cole o link do vídeo ou playlist...">
          <button id="yt-search">Buscar</button>
        </div>
        <div id="yt-search-status"></div>
        <div id="yt-result"></div>
        <div class="sep"></div>
        <div class="queue-head">
          <span class="lbl">Fila (visível só pra você)</span>
          <button id="yt-clear">limpar</button>
        </div>
        <div id="yt-queue-empty">A fila está vazia. Busque uma música e clique em "+ Fila".</div>
        <div id="yt-queue" class="list" style="display:none"></div>
        <div class="hint">Toca igual para todos na mesa — só você comanda.<br>Atalhos: Espaço = play/pausa · ← → = 10s</div>
      </div>`;
    document.body.appendChild(panel);
  }

  const host = document.createElement('div');
  host.id = 'yt-player-host';
  host.innerHTML = '<div id="yt-iframe"></div>';
  document.body.appendChild(host);

  let player = null, scanner = null, ready = false, timer = null, seeking = false, loadTimeout = null, unlockTimeout = null;
  let queue = [];              // GM: { id, title } — a fila que o Mestre monta localmente
  let repeatMode = 'off';      // GM only — só importa em quem decide a próxima faixa
  let shuffle = false;         // GM only
  let history = [];            // GM only: video_ids já tocados, pro "anterior"
  let remoteState = null;      // último estado compartilhado (mesa_player_state)

  const $ = (id) => document.getElementById(id);

  // ---- YouTube IFrame API ----
  if (!window.YT && !window.__ytApiLoading) {
    window.__ytApiLoading = true;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }

  const prevReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (prevReady) prevReady();
    player = new YT.Player('yt-iframe', {
      height: '180', width: '320',
      playerVars: { playsinline: 1, controls: 0 },
      events: {
        onReady: () => {
          ready = true;
          const savedRaw = localStorage.getItem(VOL_KEY);
          const savedVol = savedRaw === null ? NaN : Number(savedRaw);
          const vol = isNaN(savedVol) ? 80 : Math.min(100, Math.max(0, savedVol));
          $('yt-vol').value = vol;
          player.setVolume(vol);
          if (remoteState) syncToRemoteState(remoteState);
        },
        onStateChange: onState, onError,
      },
    });
  };
  if (window.YT && window.YT.Player) window.onYouTubeIframeAPIReady();

  // ---- Estado compartilhado da mesa ----
  db.getPlayerState(campaignId).then((st) => syncToRemoteState(st)).catch(() => {});
  db.subscribePlayerState(campaignId, (st) => syncToRemoteState(st));

  function computeCurrentTime(state) {
    if (!state || !state.video_id) return 0;
    if (!state.is_playing || !state.started_at) return Number(state.offset_seconds) || 0;
    const elapsed = (Date.now() - new Date(state.started_at).getTime()) / 1000;
    return (Number(state.offset_seconds) || 0) + Math.max(0, elapsed);
  }

  function syncToRemoteState(state) {
    remoteState = state;
    if (isGM) renderQueue(); // realça a faixa atual na fila mesmo antes do player carregar
    if (!ready) return;
    if (!state || !state.video_id) {
      player.pauseVideo && player.pauseVideo();
      setNowPlaying('Nenhuma música', 'idle');
      return;
    }
    const cur = player.getVideoData && player.getVideoData();
    const target = computeCurrentTime(state);
    if (!cur || cur.video_id !== state.video_id) {
      // loadVideoById(id) sozinho + um seekTo logo depois é instável (o vídeo ainda não "pegou" o
      // seek e volta pro 0:00) — por isso passa o startSeconds já na chamada de load, que é atômica.
      // É o que resolve a música voltar do início ao dar F5 ou reabrir a mesa (GM ou Jogador).
      player.loadVideoById(state.video_id, target);
    } else if (Math.abs((player.getCurrentTime() || 0) - target) > 1.2) {
      try { player.seekTo(target, true); } catch (_) {}
    }
    if (state.is_playing) attemptPlay(); else player.pauseVideo();
    setNowPlaying(state.title || 'Carregando…');
  }

  function attemptPlay() {
    player.playVideo();
    clearTimeout(unlockTimeout);
    unlockTimeout = setTimeout(() => {
      const st = player.getPlayerState && player.getPlayerState();
      if (st !== YT.PlayerState.PLAYING && st !== YT.PlayerState.BUFFERING) showUnlockButton();
    }, 1200);
  }
  function showUnlockButton() {
    if ($('yt-unlock-fab')) return;
    const btn = document.createElement('button');
    btn.className = 'yt-unlock-fab'; btn.id = 'yt-unlock-fab';
    btn.innerHTML = '<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg></span>Ativar áudio';
    btn.onclick = () => { player.playVideo(); btn.remove(); };
    document.body.appendChild(btn);
  }

  function broadcastAndSync(patch) {
    return db.setPlayerState(campaignId, patch).then(syncToRemoteState).catch((e) => setNowPlaying(e.message, 'error'));
  }

  // Player oculto e mudo, usado só pelo Mestre pra ler as músicas de uma playlist
  function getScanner(cb) {
    if (scanner) return cb(scanner);
    const scHost = document.createElement('div');
    scHost.id = 'yt-scanner';
    scHost.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:320px;height:180px';
    document.body.appendChild(scHost);
    scanner = new YT.Player('yt-scanner', {
      height: '180', width: '320',
      events: { onReady: () => { scanner.mute(); cb(scanner); } },
    });
  }

  function enumeratePlaylist(listId, cb) {
    getScanner((s) => {
      s.mute();
      s.cuePlaylist({ list: listId });
      const t0 = Date.now();
      const iv = setInterval(() => {
        const pl = s.getPlaylist && s.getPlaylist();
        if (pl && pl.length) { clearInterval(iv); cb(pl); }
        else if (Date.now() - t0 > 8000) { clearInterval(iv); cb(pl && pl.length ? pl : null); }
      }, 300);
    });
  }

  // ---- Helpers ----
  function fmt(s) {
    s = Math.floor(s || 0);
    const m = Math.floor(s / 60), sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function parseId(url) {
    if (!url) return null;
    url = url.trim();
    let m;
    if ((m = url.match(/[?&]v=([\w-]{11})/))) return m[1];
    if ((m = url.match(/youtu\.be\/([\w-]{11})/))) return m[1];
    if ((m = url.match(/\/embed\/([\w-]{11})/))) return m[1];
    if ((m = url.match(/\/shorts\/([\w-]{11})/))) return m[1];
    if (/^[\w-]{11}$/.test(url)) return url;
    return null;
  }

  function parseList(url) {
    const m = (url || '').match(/[?&]list=([\w-]+)/);
    return m ? m[1] : null;
  }

  function oEmbed(id) {
    const u = 'https://www.youtube.com/oembed?url=https://youtu.be/' + id + '&format=json';
    return fetch(u).then((r) => {
      if (!r.ok) return null;
      return r.json().then((j) => ({ id, title: j.title, author: j.author_name, thumb: j.thumbnail_url }));
    }).catch(() => null);
  }

  function setSearchStatus(text, cls) {
    const el = $('yt-search-status'); if (!el) return;
    el.textContent = text || '';
    el.className = cls || '';
  }
  function setNowPlaying(text, cls) {
    const el = $('yt-track-title');
    el.textContent = text;
    el.className = cls || '';
  }

  // volume é sempre local (nunca sincronizado) — vale pros dois papéis
  $('yt-vol').addEventListener('input', function () {
    if (ready) player.setVolume(this.value);
    localStorage.setItem(VOL_KEY, this.value);
  });

  if (!isGM) return; // jogador: só ouve e mexe no próprio volume — nada abaixo é montado pra ele

  // ================= A PARTIR DAQUI, SÓ O MESTRE =================

  // ---- Busca ----
  function buscar() {
    const raw = $('yt-url').value.trim();
    if (!raw) { setSearchStatus('Cole um link primeiro.', 'error'); return; }
    if (!ready) { setSearchStatus('Iniciando player…'); setTimeout(buscar, 400); return; }
    $('yt-result').innerHTML = '';
    const listId = parseList(raw);
    const vid = parseId(raw);

    if (listId) {
      setSearchStatus('Lendo playlist…');
      enumeratePlaylist(listId, (ids) => {
        if (ids && ids.length) { setSearchStatus(ids.length + ' música(s) encontradas.', 'ok'); renderPlaylist(ids); }
        else if (vid) { validateSingle(vid); }
        else { setSearchStatus('Não consegui ler a playlist (pode ser privada ou uma "mix").', 'error'); }
      });
      return;
    }
    if (vid) { validateSingle(vid); return; }
    setSearchStatus('Link inválido. Cole o endereço de um vídeo ou playlist do YouTube.', 'error');
  }

  function validateSingle(vid) {
    setSearchStatus('Verificando vídeo…');
    oEmbed(vid).then((info) => {
      if (!info) { setSearchStatus('Vídeo não encontrado (removido, privado ou link errado).', 'error'); return; }
      setSearchStatus('Vídeo encontrado.', 'ok');
      renderSingle(info);
    });
  }

  function renderSingle(info) {
    const wrap = $('yt-result');
    wrap.innerHTML =
      `<div class="card">
        <img src="${info.thumb}" alt="">
        <div class="meta"><div class="t"></div><div class="a"></div></div>
      </div>
      <div class="acts">
        <button class="primary" id="r-play"><span class="ic"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>Reproduzir pra mesa</button>
        <button id="r-queue">+ Fila</button>
      </div>`;
    wrap.querySelector('.card .t').textContent = info.title;
    wrap.querySelector('.card .a').textContent = info.author || '';
    $('r-play').onclick = () => reproduzir({ id: info.id, title: info.title });
    $('r-queue').onclick = () => enfileirar({ id: info.id, title: info.title });
  }

  function renderPlaylist(ids) {
    const items = ids.map((id) => ({ id, title: '' }));
    const wrap = $('yt-result');
    wrap.innerHTML =
      `<div class="pl-head"><span class="lbl">Playlist · ${items.length} músicas</span>
      <button class="rowbtn" id="pl-all" title="Adicionar todas à fila" style="width:auto;padding:0 8px">+ Todas</button></div>
      <div class="list" id="pl-list"></div>`;
    const list = $('pl-list');
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = '<span class="rt">Carregando…</span>' +
        '<button class="rowbtn play" title="Tocar agora pra mesa"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>' +
        '<button class="rowbtn" title="Adicionar à fila">+</button>';
      const rt = row.querySelector('.rt');
      const btns = row.querySelectorAll('button');
      btns[0].onclick = () => reproduzir(item);
      btns[1].onclick = () => enfileirar(item);
      item._rt = rt;
      list.appendChild(row);
    });
    $('pl-all').onclick = () => { items.forEach((it) => enfileirar(it)); setSearchStatus('Playlist adicionada à fila.', 'ok'); };
    fillTitles(items); // busca os títulos progressivamente (4 por vez)
  }

  function fillTitles(items) {
    let i = 0, active = 0;
    const MAX = 4;
    function next() {
      while (active < MAX && i < items.length) {
        const item = items[i++];
        active++;
        oEmbed(item.id).then((info) => {
          item.title = info ? info.title : '(indisponível)';
          if (item._rt) item._rt.textContent = item.title;
          renderQueue();
          active--; next();
        });
      }
    }
    next();
  }

  function ensureTitle(item) {
    if (item.title) return;
    oEmbed(item.id).then((info) => {
      item.title = info ? info.title : '(indisponível)';
      if (remoteState && remoteState.video_id === item.id) setNowPlaying(item.title);
      renderQueue();
    });
  }

  // ---- Fila (local do Mestre — só decide o que vai tocar pra mesa) ----
  function enfileirar(item) {
    const it = { id: item.id, title: item.title || '' };
    queue.push(it);
    if (!it.title) ensureTitle(it);
    renderQueue();
    setSearchStatus('Adicionado à fila (' + queue.length + ').', 'ok');
  }

  function reproduzir(item) {
    let idx = queue.findIndex((q) => q.id === item.id);
    if (idx === -1) {
      const curIdx = queue.findIndex((q) => q.id === remoteState?.video_id);
      const at = curIdx >= 0 ? curIdx + 1 : queue.length;
      queue.splice(at, 0, { id: item.id, title: item.title || '' });
      idx = at;
    }
    playAt(idx);
  }

  function playAt(i, record) {
    if (i < 0 || i >= queue.length || !ready) return;
    const item = queue[i];
    if (record !== false && remoteState && remoteState.video_id && remoteState.video_id !== item.id) history.push(remoteState.video_id);
    clearTimeout(loadTimeout);
    loadTimeout = setTimeout(() => {
      if (!player.getPlayerState || player.getPlayerState() !== YT.PlayerState.PLAYING) {
        setNowPlaying('Não carregou. O vídeo pode ter reprodução externa desativada.', 'error');
      }
    }, 12000);
    broadcastAndSync({ video_id: item.id, title: item.title || '', is_playing: true, offset_seconds: 0, started_at: new Date().toISOString() });
    if (!item.title) ensureTitle(item);
  }

  function removeAt(i) {
    queue.splice(i, 1);
    history = [];
    renderQueue();
  }

  function renderQueue() {
    const list = $('yt-queue'), empty = $('yt-queue-empty');
    if (!list || !empty) return;
    if (!queue.length) { list.style.display = 'none'; empty.style.display = 'block'; list.innerHTML = ''; return; }
    empty.style.display = 'none'; list.style.display = 'block';
    list.innerHTML = '';
    queue.forEach((item, i) => {
      const playing = remoteState && remoteState.video_id === item.id;
      const row = document.createElement('div');
      row.className = 'qrow' + (playing ? ' current' : '');
      row.innerHTML = `<span class="idx">${i + 1}</span><span class="qt"></span><button class="x" title="Remover">×</button>`;
      row.querySelector('.qt').textContent = item.title || 'Carregando…';
      row.querySelector('.qt').onclick = () => playAt(i);
      row.querySelector('.idx').onclick = () => playAt(i);
      row.querySelector('.x').onclick = (e) => { e.stopPropagation(); removeAt(i); };
      list.appendChild(row);
    });
  }

  // ---- Estados do player ----
  function onState(e) {
    updatePlayIcon();
    const S = YT.PlayerState;
    if (e.data === S.PLAYING) {
      clearTimeout(loadTimeout);
      $('yt-dur').textContent = fmt(player.getDuration());
      startTimer();
    } else if (e.data === S.ENDED) {
      stopTimer();
      if (isGM) advanceAuto(); // só o Mestre decide a próxima faixa e transmite pra mesa
    } else if (e.data !== S.BUFFERING) {
      stopTimer();
    }
  }

  function onError(e) {
    clearTimeout(loadTimeout);
    stopTimer();
    const msg = ({
      2: 'Link inválido.',
      5: 'Erro no player. Tente outro vídeo.',
      100: 'Vídeo não encontrado (removido ou privado).',
      101: 'O dono desativou a reprodução deste vídeo fora do YouTube.',
      150: 'O dono desativou a reprodução deste vídeo fora do YouTube.',
    })[e.data] || 'Não foi possível tocar este vídeo.';
    setNowPlaying(msg, 'error');
    if (isGM && queue.length > 1 && remoteState?.video_id) setTimeout(() => playNext(), 1800); // pula pra próxima da fila
  }

  function startTimer() {
    stopTimer();
    const seekEl = $('yt-seek'), fillEl = $('yt-fill');
    timer = setInterval(() => {
      if (seeking || !player.getDuration) return;
      const cur = player.getCurrentTime(), dur = player.getDuration();
      $('yt-cur').textContent = fmt(cur);
      const pct = dur ? (cur / dur) * 100 : 0;
      if (seekEl) seekEl.value = pct;       // Mestre: barra arrastável
      if (fillEl) fillEl.style.transform = `scaleX(${pct / 100})`; // Jogador: barra só de exibição
    }, 250);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  function updatePlayIcon() {
    const el = $('yt-play-icon');
    if (!el) return; // jogador não tem botão de play (não controla)
    const st = player && player.getPlayerState && player.getPlayerState();
    const playing = st === YT.PlayerState.PLAYING || st === YT.PlayerState.BUFFERING;
    el.innerHTML = playing
      ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
  }

  function togglePlay() {
    if (!ready) return;
    if (!remoteState || !remoteState.video_id) { if (queue.length) playAt(0); return; }
    if (remoteState.is_playing) {
      broadcastAndSync({ is_playing: false, offset_seconds: computeCurrentTime(remoteState) });
    } else {
      broadcastAndSync({ is_playing: true, started_at: new Date().toISOString() });
    }
  }
  function back10() {
    if (!ready || !remoteState?.video_id) return;
    const t = Math.max(0, player.getCurrentTime() - 10);
    player.seekTo(t, true);
    broadcastAndSync({ offset_seconds: t, started_at: new Date().toISOString(), is_playing: remoteState.is_playing });
  }
  function fwd10() {
    if (!ready || !remoteState?.video_id) return;
    const t = player.getCurrentTime() + 10;
    player.seekTo(t, true);
    broadcastAndSync({ offset_seconds: t, started_at: new Date().toISOString(), is_playing: remoteState.is_playing });
  }

  function pickNext() {
    if (!queue.length) return -1;
    const curIdx = queue.findIndex((q) => q.id === remoteState?.video_id);
    if (shuffle) {
      if (queue.length === 1) return 0;
      let n; do { n = Math.floor(Math.random() * queue.length); } while (n === curIdx);
      return n;
    }
    if (curIdx + 1 < queue.length) return curIdx + 1;
    return repeatMode === 'all' ? 0 : -1;
  }
  function playNext() { const n = pickNext(); if (n >= 0) playAt(n); }
  function advanceAuto() {
    const curIdx = queue.findIndex((q) => q.id === remoteState?.video_id);
    if (repeatMode === 'one' && curIdx >= 0) { playAt(curIdx, false); return; }
    const n = pickNext();
    if (n >= 0) playAt(n);
    else setNowPlaying('Fila terminada.', 'idle');
  }
  function playPrev() {
    if (!queue.length) return;
    const curIdx = queue.findIndex((q) => q.id === remoteState?.video_id);
    if (ready && curIdx >= 0 && player.getCurrentTime() > 3) { player.seekTo(0, true); back10(); return; }
    if (history.length) {
      const prevId = history.pop();
      const idx = queue.findIndex((q) => q.id === prevId);
      if (idx >= 0) { playAt(idx, false); return; }
    }
    if (curIdx > 0) playAt(curIdx - 1, false);
    else if (repeatMode === 'all') playAt(queue.length - 1, false);
  }
  function updateRepeatUI() {
    const b = $('yt-repeat');
    b.classList.toggle('active', repeatMode !== 'off');
    b.querySelector('.one').style.display = repeatMode === 'one' ? 'block' : 'none';
    b.title = repeatMode === 'off' ? 'Repetir: desligado'
      : (repeatMode === 'all' ? 'Repetir: toda a fila' : 'Repetir: uma música');
  }

  // ---- Ligações de UI ----
  $('yt-search').onclick = buscar;
  $('yt-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); });
  $('yt-play').onclick = togglePlay;
  $('yt-back').onclick = back10;
  $('yt-fwd').onclick = fwd10;
  $('yt-prev').onclick = playPrev;
  $('yt-next').onclick = playNext;
  $('yt-shuffle').onclick = function () {
    shuffle = !shuffle;
    this.classList.toggle('active', shuffle);
    this.title = shuffle ? 'Aleatório: ligado' : 'Aleatório: desligado';
  };
  $('yt-repeat').onclick = () => {
    repeatMode = repeatMode === 'off' ? 'all' : (repeatMode === 'all' ? 'one' : 'off');
    updateRepeatUI();
  };
  $('yt-clear').onclick = () => { queue = []; history = []; renderQueue(); };

  const seek = $('yt-seek');
  seek.addEventListener('input', () => { seeking = true; });
  seek.addEventListener('change', () => {
    if (ready && remoteState?.video_id && player.getDuration) {
      const t = player.getDuration() * (seek.value / 100);
      player.seekTo(t, true);
      broadcastAndSync({ offset_seconds: t, started_at: new Date().toISOString(), is_playing: remoteState.is_playing });
    }
    seeking = false;
  });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || !ready) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); back10(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); fwd10(); }
  });

  $('yt-panel-toggle').onclick = () => panel.classList.toggle('open');
  $('yt-panel-close').onclick = () => panel.classList.remove('open');
}
