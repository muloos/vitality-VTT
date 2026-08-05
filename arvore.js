(async () => {
"use strict";
const $ = (i) => document.getElementById(i);
const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));
// nota histórica: "a árvore não carrega" (tela em branco, sem erro nenhum) era um comentário HTML
// em arvore.html fechado com "*/" (sintaxe de JS) em vez de "-->", que nunca fechava e engolia
// como texto TODO o resto do arquivo — inclusive a tag <script> inteira, que por isso nunca virava
// um elemento de verdade. Já corrigido; o script virou arquivo externo (arvore.js) durante essa
// investigação e não há motivo pra voltar a ser inline.
// erro de carregamento da árvore (ex.: RLS negou acesso, árvore/sistema não existe mais, módulo não
// carregou, rede caiu no meio do boot) — escrever só em #tree-name (dentro do .topbar padrão) fazia
// esse erro ficar INVISÍVEL no modo embutido, já que esse topbar some de propósito dentro da mesa
// (quem tem o dela por fora é a própria mesa). Sem aviso nenhum, a árvore só "não carregava", sem
// pista de por quê — por isso este banner central, que aparece em cima de tudo nos dois modos.
// Definida como "function" (não const) de propósito: fica disponível por hoisting mesmo sendo
// chamada mais acima no arquivo, dentro do catch dos imports logo abaixo.
function showBootError(msg) {
  const tn = $('tree-name'); if (tn) tn.innerHTML = `Erro: ${esc(msg)} <button type="button" class="btn sm auto" style="margin-left:8px" onclick="location.reload()">Tentar de novo</button>`;
  let banner = $('boot-error-banner');
  if (!banner) { banner = document.createElement('div'); banner.id = 'boot-error-banner'; banner.className = 'boot-error-banner'; document.body.appendChild(banner); }
  banner.innerHTML = `<span>Não deu pra carregar a árvore: ${esc(msg)}</span><button type="button" class="btn sm auto" onclick="location.reload()">Tentar de novo</button>`;
}
// import ESTÁTICO (`import x from 'y'`) não dá pra envolver em try/catch — se falhar (rede caiu,
// CDN do Supabase bloqueado por extensão, MIME errado do servidor, erro de sintaxe em db.js/ui.js),
// o módulo INTEIRO trava silenciosamente, sem lançar nada visível no console e sem rodar nem uma
// linha do resto do script (nem o catch do boot lá embaixo, que também é código deste mesmo módulo).
// Foi exatamente isso que aconteceu depois da correção grande: a árvore ficava com a tela em branco
// (ou, no modo embutido, com a barra da mesa E a barra da árvore empilhadas, já que a classe que
// esconde a segunda nunca era aplicada) sem NENHUM sinal de erro em lugar nenhum. Import DINÂMICO
// (`await import(...)`) dá pra envolver em try/catch de verdade — qualquer falha aqui agora aparece
// no banner central acima, com a mensagem exata, em vez de travar tudo em silêncio.
let db, mountHelp, mountThemeToggle, openHelpGuide, openProfileModal, openSettingsModal, toggleTheme, getTheme, trapFocus;
try {
  db = await import('./lib/db.js?v=40');
  ({ mountHelp, mountThemeToggle, openHelpGuide, openProfileModal, openSettingsModal, toggleTheme, getTheme, trapFocus } = await import('./lib/ui.js?v=4'));
} catch (e) {
  showBootError(`Não deu pra carregar os módulos da página (db.js/ui.js): ${e && e.message ? e.message : e}`);
  throw e;
}
// modo embutido: mesa.html mostra a árvore direto dentro da aba "Árvores" (dentro de um iframe),
// em vez de navegar pra esta página separada — isso é o que mantém a música tocando (o documento
// da mesa nunca descarrega) e o topbar/abas da mesa visíveis. Aberta assim, esta página não precisa
// da própria navegação (marca/voltar/menu de conta) nem dos próprios FABs de ajuda/tema — a mesa já
// tem os dela cobrindo a página inteira; um segundo botão flutuante dentro da caixa do iframe só
// ficaria redundante. Aberta direto (sem "embed=1" na URL), continua 100% igual a antes.
// A classe .embedded já foi aplicada bem mais cedo por um <script> síncrono logo no início do
// <body> (não depende de nada carregar) — aqui só cobre o caso não-embutido (FABs próprios).
const embedded = new URLSearchParams(location.search).get('embed') === '1';
if (!embedded) { mountHelp('arvore', { bottom: '52px' }); mountThemeToggle(); }
window.goBackEmbedded = async () => {
  if (hasUnsavedChanges()) {
    const ok = await confirmModal({ title: 'Sair sem salvar?', desc: 'Você tem edições não salvas nesta árvore — elas serão perdidas.', confirmLabel: 'Sair sem salvar' });
    if (!ok) return;
  }
  try { window.parent.backToArvoreList(); } catch (_) {}
};
// link "Voltar" do topbar padrão (modo não-embutido) — mesma checagem de edição pendente.
$('back')?.addEventListener('click', async (ev) => {
  if (!hasUnsavedChanges()) return;
  ev.preventDefault();
  const ok = await confirmModal({ title: 'Sair sem salvar?', desc: 'Você tem edições não salvas nesta árvore — elas serão perdidas.', confirmLabel: 'Sair sem salvar' });
  if (ok) location.href = $('back').href;
});
// ícones de linha (svgrepo-style, 24x24, stroke) — sem emoji em nenhuma opção de UI. O "✦" do
// selo de custo desenhado NA esfera do canvas fica de fora de propósito: é conteúdo visual do
// jogo (tema da árvore), não um ícone de interface.
const ic = (paths, attrs = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${attrs}>${paths}</svg>`;
const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>';
// menu de conta no topo — mesmo padrão de mesa.html (perfil/configurações/ajuda/tema/sair)
let myName = null, myEmail = null;
function paintThemeMenuItem() {
  const icon = $('theme-menu-icon'), label = $('theme-menu-label'); if (!icon || !label) return;
  const light = getTheme() === 'light';
  icon.innerHTML = light ? ICON_SUN : ICON_MOON;
  label.textContent = light ? 'Tema: claro' : 'Tema: escuro';
}
paintThemeMenuItem();
function closeUserMenu() { $('nav-user')?.classList.remove('open'); $('nav-user-btn')?.setAttribute('aria-expanded', 'false'); }
window.toggleUserMenu = () => {
  const el = $('nav-user'); if (!el) return;
  const open = el.classList.toggle('open');
  $('nav-user-btn')?.setAttribute('aria-expanded', String(open));
  if (open) el.querySelector('.drop [role="menuitem"]')?.focus();
};
document.addEventListener('click', (e) => { if (!e.target.closest('#nav-user')) closeUserMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeUserMenu(); });
window.openProfile = () => {
  closeUserMenu();
  openProfileModal({
    email: myEmail, displayName: myName,
    onSave: async (name) => {
      await db.updateDisplayName(name);
      myName = name;
      $('who').textContent = myName;
      $('nav-av').textContent = myName.trim().charAt(0).toUpperCase() || '?';
    },
  });
};
window.openSettings = () => {
  closeUserMenu();
  openSettingsModal({ onChangePassword: async (pw) => { await db.updatePassword(pw); } });
};
window.openHelp = () => { closeUserMenu(); openHelpGuide('arvore'); };
window.doToggleTheme = () => { toggleTheme(); paintThemeMenuItem(); cssVarCache.clear(); }; // cores resolvidas do canvas (--ink/--brass/--maq/--mono) mudam de valor com o tema
window.logout = () => { db.signOut().then(() => { location.href = 'login.html'; }); };
// modal de confirmação estilizado (mesmo padrão visual do guia) — substitui confirm() nativo
function confirmModal({ title, desc, confirmLabel = 'Confirmar', danger = true } = {}) {
  return new Promise((resolve) => {
    const trigger = document.activeElement;
    const w = document.createElement('div');
    w.className = 'ui-modal';
    w.setAttribute('role', 'alertdialog');
    w.setAttribute('aria-modal', 'true');
    w.setAttribute('aria-labelledby', 'confirm-title');
    w.innerHTML = `<div class="box guide">
      <div class="ghead"><h3 id="confirm-title">${esc(title)}</h3><button class="x" aria-label="Fechar">×</button></div>
      <p class="gintro">${esc(desc)}</p>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:6px">
        <button class="btn auto" id="cm-cancel">Cancelar</button>
        <button class="btn auto ${danger ? 'danger' : 'go'}" id="cm-ok">${esc(confirmLabel)}</button>
      </div>
    </div>`;
    const untrap = trapFocus(w);
    const finish = (result) => { untrap(); w.remove(); document.removeEventListener('keydown', onEsc); if (trigger && trigger.focus) trigger.focus(); resolve(result); };
    const onEsc = (e) => { if (e.key === 'Escape') finish(false); };
    w.addEventListener('click', (e) => { if (e.target === w) finish(false); });
    w.querySelector('.x').onclick = () => finish(false);
    w.querySelector('#cm-cancel').onclick = () => finish(false);
    w.querySelector('#cm-ok').onclick = () => finish(true);
    document.addEventListener('keydown', onEsc);
    document.body.appendChild(w);
    w.querySelector('#cm-ok').focus();
  });
}
// seletor de cor próprio — um color picker de verdade (quadrado de saturação/brilho + barra de
// matiz arrastáveis + hex + atalhos de paleta), substitui <input type="color"> nativo do navegador.
// openColorPicker(botãoGatilho, corAtual, (novaCor)=>...) — chama onPick a cada mudança (igual o
// oninput do color picker nativo), pro chamador poder ter preview ao vivo se quiser.
const COLOR_PRESETS = ['#f2585e','#fb923c','#f5b93d','#eab308','#84cc16','#22c55e','#3ecf7e','#10b981',
  '#14b8a6','#35c6d4','#18b5c6','#0ea5e9','#3b82f6','#6366f1','#8b5cf6','#a855f7',
  '#d946ef','#ec4899','#e9edf1','#93a0ab','#5c6771','#7ee6dc'];
function hexToHsv(hex) {
  hex = (hex || '#7ee6dc').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16) / 255 || 0, g = parseInt(hex.slice(2, 4), 16) / 255 || 0, b = parseInt(hex.slice(4, 6), 16) / 255 || 0;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
function hsvToHex(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}
let _colorPop = null;
function closeColorPicker() {
  if (!_colorPop) return;
  _colorPop.remove(); _colorPop = null;
  document.removeEventListener('mousedown', _cpOutside, true);
  document.removeEventListener('keydown', _cpEsc);
}
function _cpOutside(e) { if (_colorPop && !_colorPop.contains(e.target)) closeColorPicker(); }
function _cpEsc(e) { if (e.key === 'Escape') closeColorPicker(); }
window.openColorPicker = (trigger, current, onPick) => {
  closeColorPicker();
  const state = hexToHsv(current);
  const pop = document.createElement('div');
  pop.className = 'color-pop';
  pop.innerHTML = `
    <div class="cp-sv" id="cp-sv"><div class="cp-sv-cursor" id="cp-sv-cursor"></div></div>
    <div class="cp-hue" id="cp-hue"><div class="cp-hue-cursor" id="cp-hue-cursor"></div></div>
    <div class="cp-bottom">
      <span class="cp-preview" id="cp-preview"></span>
      <input type="text" class="cp-hex" id="cp-hex" maxlength="7">
    </div>
    <div class="cp-grid">${COLOR_PRESETS.map((c) => `<button type="button" class="cp-swatch" style="--sw:${c}" data-c="${c}" title="${c}"></button>`).join('')}</div>`;
  document.body.appendChild(pop);

  const svEl = pop.querySelector('#cp-sv'), svCur = pop.querySelector('#cp-sv-cursor');
  const hueEl = pop.querySelector('#cp-hue'), hueCur = pop.querySelector('#cp-hue-cursor');
  const preview = pop.querySelector('#cp-preview'), hexInput = pop.querySelector('#cp-hex');

  function render() {
    svEl.style.setProperty('--h', state.h);
    svCur.style.left = (state.s * svEl.clientWidth) + 'px';
    svCur.style.top = ((1 - state.v) * svEl.clientHeight) + 'px';
    hueCur.style.left = (state.h / 360 * hueEl.clientWidth) + 'px';
    const hex = hsvToHex(state.h, state.s, state.v);
    preview.style.setProperty('--sw', hex);
    hexInput.value = hex;
    trigger.style.setProperty('--sw', hex);
    onPick(hex);
  }
  function dragSV(e) {
    const r = svEl.getBoundingClientRect();
    state.s = Math.min(Math.max(0, e.clientX - r.left), r.width) / r.width;
    state.v = 1 - Math.min(Math.max(0, e.clientY - r.top), r.height) / r.height;
    render();
  }
  function dragHue(e) {
    const r = hueEl.getBoundingClientRect();
    state.h = Math.min(Math.max(0, e.clientX - r.left), r.width) / r.width * 360;
    render();
  }
  svEl.addEventListener('pointerdown', (e) => {
    svEl.setPointerCapture(e.pointerId); dragSV(e);
    const mv = (ev) => dragSV(ev), up = () => { svEl.removeEventListener('pointermove', mv); svEl.removeEventListener('pointerup', up); };
    svEl.addEventListener('pointermove', mv); svEl.addEventListener('pointerup', up);
  });
  hueEl.addEventListener('pointerdown', (e) => {
    hueEl.setPointerCapture(e.pointerId); dragHue(e);
    const mv = (ev) => dragHue(ev), up = () => { hueEl.removeEventListener('pointermove', mv); hueEl.removeEventListener('pointerup', up); };
    hueEl.addEventListener('pointermove', mv); hueEl.addEventListener('pointerup', up);
  });
  pop.querySelectorAll('.cp-swatch').forEach((b) => {
    b.onclick = () => { const hsv = hexToHsv(b.dataset.c); state.h = hsv.h; state.s = hsv.s; state.v = hsv.v; render(); };
  });
  hexInput.addEventListener('change', () => {
    const v = hexInput.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { const hsv = hexToHsv(v); state.h = hsv.h; state.s = hsv.s; state.v = hsv.v; render(); }
  });

  const r = trigger.getBoundingClientRect();
  let left = r.left, top = r.bottom + 6;
  if (left + pop.offsetWidth > window.innerWidth - 8) left = window.innerWidth - pop.offsetWidth - 8;
  if (top + pop.offsetHeight > window.innerHeight - 8) top = r.top - pop.offsetHeight - 6;
  pop.style.left = Math.max(8, left) + 'px';
  pop.style.top = Math.max(8, top) + 'px';
  _colorPop = pop;
  render();
  setTimeout(() => {
    document.addEventListener('mousedown', _cpOutside, true);
    document.addEventListener('keydown', _cpEsc);
  }, 0);
};
const ICONS = {
  check: ic('<path d="M5 12.5l4.5 4.5L19 7"/>', 'stroke-width="1.8"'),
  x: ic('<path d="M6 6l12 12M18 6 6 18"/>', 'stroke-width="1.8"'),
  flipV: ic('<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>'),
  flipH: ic('<path d="M3 12h18M7 8 3 12l4 4M17 8l4 4-4 4"/>'),
  rotateCw: ic('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>'),
  rotateCcw: ic('<path d="M4 12a8 8 0 1 1 2.3 5.6"/><path d="M4 4v5h5"/>'),
  sparkle: ic('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/><circle cx="12" cy="12" r="2.4"/>'),
};
const params = new URLSearchParams(location.search);
const treeId = params.get('tree'), systemId = params.get('system');
// kind ('ok'/undefined=erro) só estiliza a cor — várias chamadas já passavam isso mas era
// ignorado, então sucesso e erro apareciam idênticos
const showMsg = (t, kind) => { const el = $('count'); el.textContent = t; el.className = 'count' + (kind === 'ok' ? ' ok' : ' err'); setTimeout(() => refreshCount(), 2500); };

const SVGNS = "http://www.w3.org/2000/svg";
// SVG puro (decoração): #rings/#gridPolar/#snapMark. As esferas/conexões (antes um <g id="world">
// cheio de <g>/<line> de SVG) viraram um <canvas> — ver o comentário grande perto de drawWorld()
// mais abaixo pra entender por quê. "stage" é o elemento que recebe todo clique/arrasto agora
// (pan/zoom/pinça/arrastar esfera/colocar/ligar/área) — antes isso morava no <svg id="grid"> inteiro.
const stage = $('worldCanvas'), sctx = stage.getContext('2d');
const ringsEl = $('rings'), ringsInner = $('ringsInner');
const gridPolarEl = $('gridPolar'), gridPolarInner = $('gridPolarInner'), snapMarkEl = $('snapMark');
const marqueeEl = $('marquee'), batchPanelEl = $('batchpanel');
const focusProxy = $('tree-focus-proxy'), liveRegion = $('tree-live'); // acessibilidade por teclado — ver seção "teclado (canvas)"
let focusedNodeId = null; // id (não índice) — ver seção "teclado (canvas)" mais abaixo pro motivo
let W = innerWidth, H = innerHeight;
let DPR = Math.min(devicePixelRatio || 1, 2); // usado pelo #fx (partículas) e pelo #worldCanvas
// "modo leve": acima desse tamanho de árvore, desliga a rotação contínua da textura das esferas e
// o pulsar animado das conexões "ligadas" — o efeito continua aceso, só o movimento constante some.
// Com canvas isso já não é sobre custo de repintura de DOM (não existe mais DOM por esfera) — é só
// pra não gastar quadro à toa com sprites de textura sendo regerados sem necessidade numa árvore
// gigante. Reavaliado a cada render() (troca de árvore, adicionar/excluir esfera).
const LITE_MODE_NODE_THRESHOLD = 30;
let liteMode = false;
let isGM = false; // só vira true depois do boot confirmar que o usuário é dono do sistema
let nodeById = new Map(); // reconstruído em rebuildIndexes() — usado no lugar de nodes.find()
// nada no editor de esfera grava sozinho mais — os campos só mudam o rascunho local (`selected`)
// e mostram o botão Salvar; editorSnapshot guarda como a esfera estava ao abrir, pra dar pra
// descartar (trocar de esfera ou fechar o painel com edição pendente pede confirmação).
let editorDirty = false, editorSnapshot = null;
// prévias de cor de fundo/linhas/anéis nunca tiveram estado de "sujo" — dava pra mexer no seletor,
// nunca clicar em Aplicar, e sair (Voltar/fechar aba) sem nenhum aviso de que a prévia se perderia
let colorPreviewDirty = false;
function hasUnsavedChanges() {
  if (editorDirty || colorPreviewDirty) return true;
  // linha de Via com o próprio botão "Salvar" visível = edição pendente também
  return [...document.querySelectorAll('[id^="via-save-"]')].some((b) => b.style.display !== 'none');
}
addEventListener('beforeunload', (e) => { if (hasUnsavedChanges()) { e.preventDefault(); e.returnValue = ''; } });
let tool = 'select', selected = null, linkSrc = null, view = { x: W/2, y: H/2, s: 1 }, coreNode = null;
let selectedEdge = null; // conexão clicada (só GM) — Delete apaga; antes não existia jeito nenhum
                          // de remover UMA ligação sem apagar uma das duas esferas inteiras
let nodes = [], edges = [];
let areaSelection = new Set();
const byId = (i) => nodeById.get(i); // Map.get é O(1) — nodes.find() era O(n), rodava por quadro dentro do desenho das conexões
const MINZOOM = 0.35;

/* ---------- grade de encaixe — formato escolhido por árvore ----------
   octógono/hexágono: polar centrada no Núcleo, anéis concêntricos divididos em ângulos
   iguais (múltiplos de 8 ou 6), pra que caminhos que saem do centro sempre formem
   polígonos regulares, nunca a distância desigual entre vizinhos de uma grade quadrada.
   linear: grade quadrada simples (linhas/colunas), independente do Núcleo. */
const RING_STEP = 48, RING_MAX = 25, LINEAR_STEP = 60;
const SHAPE_SEGMENTS = { octagon: 8, hexagon: 6 };
let gridShape = 'octagon';
let ringColor = '#c6d2ff';
let ringOpacity = 1;
let edgeColor = '#d6f0ff';

function polarSnap(x, y) {
  const core = coreNode || nodes.find((n) => n.kind === 'core');
  if (!core) return { x: Math.round(x), y: Math.round(y) };
  const segs0 = SHAPE_SEGMENTS[gridShape] || 8;
  const dx = x - core.x, dy = y - core.y;
  const dist = Math.hypot(dx, dy);
  const ringIndex = Math.max(1, Math.min(RING_MAX, Math.round(dist / RING_STEP)));
  const r = ringIndex * RING_STEP, segs = segs0 * ringIndex, step = (Math.PI * 2) / segs;
  const angle = dist < 1e-6 ? 0 : Math.atan2(dy, dx);
  const snappedAngle = Math.round(angle / step) * step;
  return { x: Math.round(core.x + r * Math.cos(snappedAngle)), y: Math.round(core.y + r * Math.sin(snappedAngle)) };
}
function linearSnap(x, y) { return { x: Math.round(x / LINEAR_STEP) * LINEAR_STEP, y: Math.round(y / LINEAR_STEP) * LINEAR_STEP }; }
// grade quadrada simples, no mesmo passo dos anéis (RING_STEP) — usada só pelo Núcleo em formato
// octógono/hexágono, onde polarSnap não pode ser aplicado nele (a grade polar É centrada nele;
// "encaixar" o próprio centro na grade que nasce dele seria autorreferente, sempre voltaria pra
// uma distância mínima de 1 anel de si mesmo, nunca ficando de fato onde foi arrastado). Sem isso
// o Núcleo era o único ponto da árvore que se movia livre, pixel a pixel, enquanto tudo ao redor
// dele encaixava direitinho.
function coreSnap(x, y) { return { x: Math.round(x / RING_STEP) * RING_STEP, y: Math.round(y / RING_STEP) * RING_STEP }; }
function gridSnap(x, y, isCore) {
  // Em formato linear, a grade é uma malha fixa independente do Núcleo — ele deve encaixar nela
  // igual qualquer outra esfera, senão fica "solto" enquanto tudo ao redor está alinhado.
  if (isCore) return gridShape === 'linear' ? linearSnap(x, y) : coreSnap(x, y);
  return gridShape === 'linear' ? linearSnap(x, y) : polarSnap(x, y);
}
function buildGridVisual() {
  if (gridShape === 'linear') {
    const R = 1200; let s = '';
    for (let x = -R; x <= R; x += LINEAR_STEP) for (let y = -R; y <= R; y += LINEAR_STEP)
      s += `<circle class="gpdot" cx="${x}" cy="${y}" r="1.6"></circle>`;
    gridPolarInner.innerHTML = s;
    return;
  }
  const segs0 = SHAPE_SEGMENTS[gridShape] || 8; let s = '';
  for (let i = 1; i <= RING_MAX; i++) {
    const r = i * RING_STEP, segs = segs0 * i;
    s += `<circle class="gpring" r="${r}"></circle>`;
    for (let k = 0; k < segs; k++) { const a = (Math.PI * 2 * k) / segs;
      s += `<circle class="gpdot" cx="${(r * Math.cos(a)).toFixed(2)}" cy="${(r * Math.sin(a)).toFixed(2)}" r="1.6"></circle>`; }
  }
  gridPolarInner.innerHTML = s;
}
window.changeGridShape = (v) => {
  if (!isGM) return;
  gridShape = v; buildGridVisual(); buildRings(); renderDupOptions();
  db.updateSystemTree(treeId, { grid_shape: v }).catch((e) => showMsg(e.message));
};
let snapMarkPos = null;
function updateSnapMarkTransform() { if (snapMarkPos) snapMarkEl.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.s}) translate(${snapMarkPos.x} ${snapMarkPos.y})`); }
function showSnapMark(x, y) { snapMarkPos = { x, y }; snapMarkEl.classList.add('show'); updateSnapMarkTransform(); }
function hideSnapMark() { snapMarkPos = null; snapMarkEl.classList.remove('show'); }

/* ---------- Vias (afinidades) — lista livre por árvore, nasce só com "Núcleo" ----------
   o Mestre adiciona outras manualmente (nome + cor livre), do mesmo jeito que escolhe a cor de fundo. */
const DEFAULT_VIAS = [{ key: 'neutral', name: 'Núcleo', color: '#e3c071' }];
let vias = DEFAULT_VIAS.map((v) => ({ ...v }));
/* ---------- atributos do sistema (pra ligar modificador de esfera a um status real) e
   progresso do jogador (esferas desbloqueadas + pontos disponíveis) ---------- */
let stats = [];
let unlockedIds = new Set();
let myPoints = 0;
const statById = (id) => stats.find((s) => s.id === id);
const viaByKey = (key) => vias.find((v) => v.key === key) || vias[0] || DEFAULT_VIAS[0];
const genViaKey = () => 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function saveVias() { return db.updateSystemTree(treeId, { vias }); }
function renderViaChips() {
  $('e-fac').innerHTML = vias.map((v) =>
    `<div class="chip" data-f="${v.key}" style="--vc:${v.color}" onclick="patch('fac','${v.key}')">${esc(v.name)}</div>`).join('');
  if (selected) $('e-fac').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.f === selected.fac));
  // mesmos chips, no painel de edição em lote — aplica a via pra toda a seleção de área de uma vez
  $('batch-fac').innerHTML = vias.map((v) =>
    `<div class="chip" style="--vc:${v.color}" onclick="batchSet('fac','${v.key}')">${esc(v.name)}</div>`).join('');
  renderViaLegend();
}
// legenda fixa "nome da via — cor" num canto do canvas — antes só dava pra saber a via de uma
// esfera clicando nela uma a uma; com 1 via só (a "Núcleo" padrão) não há distinção nenhuma pra
// mostrar, então a legenda fica escondida
function renderViaLegend() {
  const el = $('via-legend'); if (!el) return;
  if (vias.length <= 1) { el.style.display = 'none'; return; }
  el.innerHTML = vias.map((v) =>
    `<div class="via-legend-row"><span class="via-legend-dot" style="background:${esc(v.color)}"></span><span class="via-legend-name">${esc(v.name)}</span></div>`).join('');
  el.style.display = '';
}
function renderViaManager() {
  $('via-edit').innerHTML = vias.map((v) => `
    <div class="via-row">
      <button type="button" class="color-swatch sm" title="Cor da via" style="--sw:${v.color}" onclick="openColorPicker(this, '${v.color}', (c)=>onViaFieldChange('${v.key}','color',c))"></button>
      <input type="text" value="${esc(v.name)}" maxlength="24" oninput="onViaFieldChange('${v.key}','name',this.value)">
      <button type="button" class="btn sm go" id="via-save-${v.key}" style="display:none" onclick="saveViaRow('${v.key}')" title="Salvar"><span class="ic">${ICONS.check}</span></button>
      <button type="button" class="via-del" onclick="deleteVia('${v.key}')" title="Excluir via" aria-label="Excluir via"><span class="ic">${ICONS.x}</span></button>
    </div>`).join('') + `
    <div class="via-row">
      <button type="button" class="color-swatch sm" title="Cor da nova via" style="--sw:#7ee6dc" onclick="openColorPicker(this, document.getElementById('via-new-color').value, (v)=>{ document.getElementById('via-new-color').value = v; })"></button>
      <input type="hidden" id="via-new-color" value="#7ee6dc">
      <input type="text" id="via-new-name" placeholder="Nova via (ex.: Sangue)" maxlength="24">
      <button type="button" class="via-add-btn" onclick="addVia()" title="Adicionar via" aria-label="Adicionar via">+</button>
    </div>`;
}
window.toggleViaEdit = () => { if (!isGM) return; const el = $('via-edit'); el.style.display = el.style.display === 'none' ? '' : 'none'; };
// edita localmente (com pré-visualização imediata na árvore) — só grava no banco quando a linha
// da via é salva explicitamente, igual ao resto do editor agora.
window.onViaFieldChange = (key, field, value) => {
  if (!isGM) return; const v = viaByKey(key); if (!v) return;
  v[field] = field === 'name' ? value : value; // nome só normaliza (trim) ao salvar, não durante a digitação
  renderViaChips(); if (field === 'color') render();
  const b = $('via-save-' + key); if (b) b.style.display = '';
};
window.saveViaRow = (key) => {
  if (!isGM) return; const v = viaByKey(key); if (!v) return;
  v.name = (v.name || '').trim() || v.name;
  const btn = $('via-save-' + key); if (btn) { btn.classList.add('loading'); btn.disabled = true; }
  saveVias().then(() => { renderViaChips(); if (btn) btn.style.display = 'none'; showMsg('Via salva.', 'ok'); })
    .catch((e) => showMsg(e.message))
    .finally(() => { if (btn) { btn.classList.remove('loading'); btn.disabled = false; } });
};
window.addVia = () => {
  if (!isGM) return;
  const name = ($('via-new-name').value || '').trim() || 'Nova via';
  const color = $('via-new-color').value || '#7ee6dc';
  vias.push({ key: genViaKey(), name, color });
  renderViaChips(); renderViaManager(); saveVias().catch((e) => showMsg(e.message));
};
window.deleteVia = async (key) => {
  if (!isGM) return;
  if (vias.length <= 1) { showMsg('Precisa sobrar pelo menos uma Via.'); return; }
  if (nodes.some((n) => n.fac === key)) { showMsg('Essa via está em uso — troque a via das esferas antes de excluir.'); return; }
  const via = vias.find((v) => v.key === key);
  const ok = await confirmModal({ title: 'Excluir via', desc: `Remove "${via?.name || 'esta via'}" das opções de afinidade. Não dá pra desfazer.`, confirmLabel: 'Excluir' });
  if (!ok) return;
  vias = vias.filter((v) => v.key !== key);
  renderViaChips(); renderViaManager(); saveVias().catch((e) => showMsg(e.message));
};

/* ---------- tamanho da esfera ---------- */
const SIZE_SCALE = { small: 1, medium: 1.4, large: 1.8 };

/* ---------- boot ---------- */
// diagnóstico: cada etapa do boot é logada com um prefixo fixo, pra dar pra ver exatamente onde
// ele parou (F12 → Console) se algo travar sem lançar erro nenhum (ex.: uma promessa que nunca
// resolve nem rejeita). Também alimenta um timeout de segurança logo abaixo.
const BOOT_LOG = '[árvore boot]';
let _bootStep = 'iniciando';
function bootStep(label) { _bootStep = label; console.log(BOOT_LOG, label); }
// se depois de 10s o boot ainda não terminou (nem sucesso nem erro caído no catch), mostra um
// aviso com a última etapa conhecida — evita a tela ficar em branco pra sempre, sem pista nenhuma,
// no caso (raro) de uma chamada ao Supabase nunca resolver
let _bootDone = false;
setTimeout(() => {
  if (_bootDone) return;
  showBootError(`Travou na etapa "${_bootStep}" por mais de 10s (sem erro nenhum lançado — provavelmente uma chamada de rede que não voltou).`);
}, 10000);
(async () => {
  bootStep('checando parâmetros da URL');
  if (!treeId) { location.href = 'app.html'; return; }
  // sempre volta pra tela inicial do app — o link antigo mandava pra dentro do sistema do Mestre
  // mesmo quando quem clicou era um jogador (mesa.html sempre manda "system=" no link,
  // GM ou não), o que abria a tela de edição do sistema pra gente sem permissão nenhuma
  $('back').href = 'app.html';
  bootStep('confirmando sessão');
  const session = await db.requireSession();
  if (!session) return;
  bootStep('carregando perfil');
  const [profile, user] = await Promise.all([db.getMyProfile(), db.getUser()]);
  myEmail = user?.email || null;
  myName = profile?.display_name || user?.email?.split('@')[0] || '—';
  $('who').textContent = myName;
  $('nav-av').textContent = myName.trim().charAt(0).toUpperCase() || '?';
  try {
    bootStep('buscando a árvore (getSystemTree)');
    const tree = await db.getSystemTree(treeId);
    bootStep('confirmando posse do sistema (getSystem)');
    try {
      const sys = await db.getSystem(tree.system_id);
      isGM = !!(sys && sys.owner_id === session.user.id);
    } catch (_) { isGM = false; } // falhou em confirmar posse — trata como jogador (falha segura)
    document.body.classList.toggle('is-gm', isGM);
    updateEpanelOffset();
    $('tree-name').innerHTML = esc(tree?.name || 'Árvore') + '<small>' + (isGM ? 'EDITOR DA ÁRVORE DE ESFERAS' : 'ÁRVORE DE ESFERAS') + '</small>';
    applyBg(tree?.bg_color || '#1b1536');
    $('bg-color').value = tree?.bg_color || '#1b1536';
    gridShape = tree?.grid_shape || 'octagon'; $('shape-select').value = gridShape;
    ringColor = tree?.ring_color || '#c6d2ff'; $('ring-color').value = ringColor;
    ringOpacity = tree?.ring_opacity ?? 1; $('ring-opacity').value = ringOpacity;
    edgeColor = tree?.edge_color || '#d6f0ff'; $('edge-color').value = edgeColor;
    vias = (tree?.vias && tree.vias.length) ? tree.vias.map((v) => ({ ...v })) : DEFAULT_VIAS.map((v) => ({ ...v }));
    renderViaChips(); renderViaManager();
    bootStep('carregando status do sistema (listStats)');
    try { stats = await db.listStats(tree.system_id); } catch (_) { stats = []; } // sem atributos cadastrados ainda — ok
    bootStep('carregando esferas e conexões (loadSystemTree)');
    const data = await db.loadSystemTree(treeId);
    nodes = data.nodes.map((n) => ({ ...n }));
    edges = data.edges.map((e) => ({ id: e.id, a: e.a, b: e.b }));
    console.log(BOOT_LOG, 'dados recebidos:', nodes.length, 'esferas,', edges.length, 'conexões, isGM =', isGM);
    if (!nodes.length && isGM) { // jogador nunca cria dados — só o dono pode inicializar a árvore
      const core = await db.insertTreeNode(treeId, { name: 'Núcleo', kind: 'core', fac: 'neutral', cost: 0, descr: 'A origem da árvore.', x: 0, y: 0 });
      nodes.push({ ...core });
    }
    if (!isGM) { // progresso de desbloqueio só existe pro jogador
      try { unlockedIds = await db.getMyUnlocks(treeId); myPoints = await db.getMyProgress(treeId); }
      catch (_) { unlockedIds = new Set(); myPoints = 0; }
    }
  } catch (e) {
    _bootDone = true;
    console.error(BOOT_LOG, 'falhou na etapa "' + _bootStep + '":', e);
    showBootError(`(${_bootStep}) ${e.message}`);
    return;
  }
  bootStep('desenhando o canvas');
  // recalcula W/H aqui (não só no <script> carregar) e recentraliza a câmera — dentro de um
  // iframe embutido, innerWidth/innerHeight lidos lá em cima podiam não refletir ainda o tamanho
  // final do iframe (que só se estabiliza depois do layout da página-mãe rodar), deixando a árvore
  // centralizada num ponto errado e, na prática, fora da área visível.
  W = innerWidth; H = innerHeight; view = { x: W/2, y: H/2, s: 1 };
  fxResize(); resizeStage(); buildDotSphere(); buildRings(); applyRingColor(ringColor); applyRingOpacity(ringOpacity); applyEdgeColor(edgeColor); buildGridVisual(); renderDupOptions(); applyRingsToggle(); applyParticlesToggle();
  // applyView() TEM que rodar antes de render() agora: render() faz culling de viewport
  // (computeVisibleIds), que lê a posição da câmera via getBoundingClientRect() do <svg> — se a
  // câmera ainda não tiver sido posicionada, o cálculo do que está "visível" sairia errado logo
  // no primeiro carregamento (culling tudo, ou a área errada).
  applyView(); render(); updateCoreAnchor(); requestAnimationFrame(tick);
  _bootDone = true;
  console.log(BOOT_LOG, 'concluído — W/H =', W, H, '· view =', view);
})();

/* ---------- cor de fundo (roda de cores) ---------- */
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [27, 21, 54];
}
function applyBg(color) {
  const [r, g, b] = hexToRgb(color);
  // a cor escolhida vira o fundo INTEIRO da árvore (glow + base sólida + vinheta) — mora só aqui,
  // no #fallback, independente dos anéis (que podem estar ligados ou desligados).
  // usa rgba() (não hex+alfa) de propósito — mais robusto entre navegadores.
  $('fallback').style.background =
    `radial-gradient(900px 680px at 50% 40%, rgba(${r},${g},${b},.4), transparent 62%),` +
    `radial-gradient(1500px 1100px at 50% 34%, rgba(255,255,255,.12), transparent 55%),` +
    `radial-gradient(1700px 1400px at 50% 125%, rgba(0,0,0,.6), transparent 72%),` +
    `${color}`;
  // a poeira cósmica usa mistura aditiva ("lighter"), que some em fundos claros — adapta a cor/mistura
  // das partículas pra sempre contrastar com o fundo escolhido, escuro ou claro.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum > 0.6) { partRGB = '40,32,58'; partBlend = 'multiply'; }
  else { partRGB = '206,196,255'; partBlend = 'lighter'; }
}
window.previewBg = (c) => { if (isGM) { applyBg(c); colorPreviewDirty = true; } };   // pré-visualiza ao mexer no seletor
window.saveBg = () => { if (!isGM) return; const c = $('bg-color').value; applyBg(c);
  db.updateSystemTree(treeId, { bg_color: c }).then(() => { colorPreviewDirty = false; showMsg('Cor de fundo salva.', 'ok'); }).catch((e) => showMsg(e.message)); };

/* ---------- partículas flutuantes (tela fixa, independente do pan/zoom da árvore) ----------
   ficam em coordenadas de TELA (sx,sy), não de mundo — são atmosfera decorativa, não fazem
   parte do mapa de esferas. Guardar em world-space e reprojetar por view.s (jeito antigo) fazia
   as partículas "recém-nascidas" herdarem um raio de mundo cada vez menor conforme o zoom
   aumentava (a fórmula de respawn dividia por view.s), então elas acabavam se acumulando todas
   perto de um único ponto do mundo assim que o zoom mudava de novo. */
const REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;
const fx = $('fx'), fctx = fx.getContext('2d');
let parts = [], partRGB = '206,196,255', partBlend = 'lighter', psprite = {};
function spr(rgb) {
  if (psprite[rgb]) return psprite[rgb];
  const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(.4, `rgba(${rgb},.3)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, s, s); return psprite[rgb] = cv;
}
function seedParts() {
  const n = REDUCED ? 24 : Math.min(120, Math.round(W * H / 13000)); parts = [];
  for (let i = 0; i < n; i++) parts.push({ sx:Math.random()*W, sy:Math.random()*H, r:.9+Math.random()*2.4, a:.3+Math.random()*.5, tw:.4+Math.random()*1.4, ph:Math.random()*7, vx:(Math.random()-.5)*.06, vy:(Math.random()-.5)*.06 });
}
function fxResize() { fx.width = W*DPR; fx.height = H*DPR; fx.style.width = W+'px'; fx.style.height = H+'px'; fctx.setTransform(DPR,0,0,DPR,0,0); seedParts(); }
function resizeStage() { stage.width = W*DPR; stage.height = H*DPR; stage.style.width = W+'px'; stage.style.height = H+'px'; }

/* ---------- esfera de pontos 3D (gira) — textura dentro de cada esfera ----------
   antes era um <g id="dotSphere"> de SVG compartilhado via <use> por TODAS as esferas (repintar a
   fonte forçava recálculo em cada referência). Agora é um sprite de canvas pré-desenhado, cacheado
   POR COR DE VIA (poucas cores distintas por árvore) — desenhar a esfera é só um drawImage barato,
   e o sprite só é regerado quando o ângulo avança (mesmo throttle de antes: 1 em 6 quadros, parado
   durante interação/modo leve). */
let dotEls = [], dotAngle = 0;
const TILT = 18 * Math.PI / 180, cT = Math.cos(TILT), sT = Math.sin(TILT);
const DOT_SPRITE_SIZE = 200; // px — mapeia a esfera de raio 100 (unidades do modelo 3D) pro sprite
let dotSpriteCache = new Map(); // cor (hex) -> canvas
function buildDotSphere() {
  const data = [];
  for (let lat = -80; lat <= 80; lat += 13) { const rad = lat * Math.PI/180, cl = Math.cos(rad); const n = Math.max(6, Math.round(17*cl));
    for (let i = 0; i < n; i++) data.push({ lat: rad, lon0: (i/n)*Math.PI*2 }); }
  dotEls = data;
  invalidateDotSprites();
}
function invalidateDotSprites() { dotSpriteCache = new Map(); }
function dotSpriteFor(color) {
  let cv = dotSpriteCache.get(color);
  if (cv) return cv;
  const size = DOT_SPRITE_SIZE, c = size / 2, scale = c / 100;
  cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'); g.fillStyle = color;
  for (const d of dotEls) {
    const lon = d.lon0 + dotAngle, cl = Math.cos(d.lat);
    const x = 100*cl*Math.sin(lon), y = -100*Math.sin(d.lat), z = 100*cl*Math.cos(lon);
    const y2 = y*cT - z*sT, z2 = y*sT + z*cT;
    if (z2 < -1) continue;
    g.globalAlpha = 0.16 + 0.84*(z2/100);
    g.beginPath(); g.arc(c + x*scale, c + y2*scale, Math.max(1.2, 1.7 + 1.2*(z2/100)) * scale, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  dotSpriteCache.set(color, cv);
  return cv;
}
let last = performance.now();
function tick(now) {
  // try/catch pra um erro pontual (ex.: numa cor mal formada) nunca travar a animação pro resto da sessão —
  // o requestAnimationFrame fica DE FORA do catch, sempre reagenda o próximo quadro.
  try {
    const dt = Math.min(40, now - last); last = now;
    // a esfera de pontos e a poeira cósmica não pausam mais durante pan/zoom/arrasto (correção da
    // época do SVG, onde repintar essas animações competia de verdade com o tempo de quadro do
    // gesto) — em canvas nenhuma das duas custa o suficiente pra isso importar: invalidateDotSprites
    // só limpa o cache de sprite (poucas cores distintas por árvore, não uma por esfera).
    if ((tick.fc = (tick.fc || 0) + 1) % 6 === 0) { dotAngle += 0.027; invalidateDotSprites(); }
    fctx.clearRect(0, 0, W, H);
    if (particlesOn) {
      fctx.globalCompositeOperation = partBlend;
      const t = now * .001, sp = spr(partRGB), m = 160;
      for (const p of parts) {
        p.sx += p.vx * dt; p.sy += p.vy * dt;
        if (p.sx < -m || p.sx > W + m || p.sy < -m || p.sy > H + m) { p.sx = Math.random()*W; p.sy = Math.random()*H; continue; }
        fctx.globalAlpha = Math.max(0, p.a * (.5 + .5 * Math.sin(t * p.tw + p.ph)));
        fctx.drawImage(sp, p.sx - p.r*3, p.sy - p.r*3, p.r*6, p.r*6);
      }
      fctx.globalAlpha = 1;
    }
    // o mundo (esferas/conexões) redesenha TODO quadro, sem exceção — diferente da poeira/textura
    // decorativas acima, isso é o conteúdo em si, precisa continuar atualizado durante pan/arrasto
    // pra mostrar o movimento. Canvas aguenta redesenhar tudo 60x/s tranquilo (é exatamente esse o
    // ponto de ter trocado de SVG pra canvas) — nada de dirty-flag, sempre desenha.
    drawWorld(now);
  } catch (err) { console.error('[tick]', err); }
  requestAnimationFrame(tick);
}

/* ---------- anéis arcanos do Crystarium (giram e seguem o Núcleo) ----------
   os raios são proporcionais ao alcance de verdade da árvore (distância da esfera mais afastada
   até o Núcleo, em unidades de RING_STEP) — raios fixos (indo até 24 aneis = 1152 unidades)
   ficavam enormes e desproporcionais numa árvore pequena, com só 2-3 aneis de esferas de verdade
   perdidos no meio de um cenário gigante. As FRAÇÕES abaixo são as mesmas proporções de antes
   (quando o maior anel fixo era 24), só que agora escalam com `ringExtent()` em vez de um número
   fixo. Recalculado em render() (após criar/excluir/duplicar esfera) e ao soltar um arrasto que
   mude a posição de alguma esfera — não a cada quadro, já que isso significa reconstruir um bloco
   de innerHTML de SVG. */
const RING_TICK_SEGMENTS = { octagon: 8, hexagon: 6, linear: 8 };
function ringExtent() {
  const core = coreNode || nodes.find((n) => n.kind === 'core');
  let maxRing = 4; // piso — uma árvore só com o Núcleo (ou bem pequena) ainda mostra aneis razoáveis
  if (core) for (const n of nodes) { if (n === core) continue; maxRing = Math.max(maxRing, Math.hypot(n.x - core.x, n.y - core.y) / RING_STEP); }
  return maxRing;
}
function buildRings() {
  const C = (r, cls, extra) => `<circle class="${cls}" cx="0" cy="0" r="${r}" fill="none" ${extra || ''}></circle>`;
  const segs = RING_TICK_SEGMENTS[gridShape] || 8;
  const ext = ringExtent();
  let s = '';
  // raio contínuo (NÃO arredondado pra múltiplo inteiro de RING_STEP) — arredondar fazia frações
  // diferentes caírem no mesmo raio inteiro em árvores pequenas (ext baixo), sobrepondo uma linha
  // estática e um anel giratório tracejado exatamente um em cima do outro (o "os dois no mesmo"
  // reportado). As duas listas de fração abaixo nunca têm valores iguais entre si, então raio
  // contínuo garante raios sempre distintos, não importa o tamanho da árvore.
  [0.125, 0.25, 0.375, 0.542, 0.708, 0.833, 1].forEach((f) => { s += C((f * ext * RING_STEP).toFixed(2), 'ring'); });
  const spins = [
    { f: 0.167, mult: 9,  width: 6,  speed: 110, rev: false },
    { f: 0.333, mult: 13, width: 10, speed: 150, rev: false },
    { f: 0.5,   mult: 10, width: 4,  speed: 95,  rev: true },
    { f: 0.667, mult: 16, width: 8,  speed: 170, rev: false },
    { f: 0.875, mult: 12, width: 5,  speed: 130, rev: true },
  ];
  spins.forEach(({ f, mult, width, speed, rev }) => {
    const r = f * ext * RING_STEP, n = segs * mult, seg = (2 * Math.PI * r) / n, dash = seg * .15, gap = seg - dash;
    s += `<g class="ringspin${rev ? ' rev' : ''}" style="animation-duration:${speed}s">` +
      C(r.toFixed(2), 'ringTick', `stroke-width="${width}" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"`) + '</g>';
  });
  ringsInner.innerHTML = s;
}
function applyRingColor(hex) {
  ringColor = hex;
  ringsEl.style.setProperty('--ringc', hexToRgb(hex).join(','));
}
window.previewRingColor = (c) => { if (isGM) { applyRingColor(c); colorPreviewDirty = true; } };
function applyRingOpacity(v) {
  ringOpacity = +v;
  ringsEl.style.opacity = ringOpacity;
}
window.previewRingOpacity = (v) => { if (isGM) { applyRingOpacity(v); colorPreviewDirty = true; } };
window.saveRingSettings = () => {
  if (!isGM) return;
  const c = $('ring-color').value, o = +$('ring-opacity').value;
  applyRingColor(c); applyRingOpacity(o);
  db.updateSystemTree(treeId, { ring_color: c, ring_opacity: o })
    .then(() => { colorPreviewDirty = false; showMsg('Anéis salvos.', 'ok'); }).catch((e) => showMsg(e.message));
};
function applyEdgeColor(hex) { edgeColor = hex; } // lido direto por drawEdge() via hexToRgb() — não existe mais custom property de CSS pra isso
window.previewEdgeColor = (c) => { if (isGM) { applyEdgeColor(c); colorPreviewDirty = true; } };
window.saveEdgeColor = () => { if (!isGM) return; const c = $('edge-color').value; applyEdgeColor(c);
  db.updateSystemTree(treeId, { edge_color: c }).then(() => { colorPreviewDirty = false; showMsg('Cor das linhas salva.', 'ok'); }).catch((e) => showMsg(e.message)); };

/* ---------- liga/desliga os anéis (a animação pode atrapalhar durante a edição) ---------- */
let ringsOn = true;
try { ringsOn = localStorage.getItem('vt_rings') !== '0'; } catch (_) {}
function applyRingsToggle() {
  ringsEl.style.display = ringsOn ? '' : 'none';
  const btn = $('rings-toggle');
  btn.classList.toggle('on', ringsOn);
  btn.innerHTML = '<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg></span>Anéis';
  btn.setAttribute('aria-pressed', String(ringsOn));
}
window.toggleRings = () => {
  ringsOn = !ringsOn;
  try { localStorage.setItem('vt_rings', ringsOn ? '1' : '0'); } catch (_) {}
  applyRingsToggle();
};

/* ---------- liga/desliga a poeira cósmica (partículas) ---------- */
let particlesOn = true;
try { particlesOn = localStorage.getItem('vt_particles') !== '0'; } catch (_) {}
function applyParticlesToggle() {
  const btn = $('particles-toggle');
  btn.classList.toggle('on', particlesOn);
  btn.innerHTML = `<span class="ic">${ICONS.sparkle}</span>Poeira`;
  btn.setAttribute('aria-pressed', String(particlesOn));
}
window.toggleParticles = () => {
  particlesOn = !particlesOn;
  try { localStorage.setItem('vt_particles', particlesOn ? '1' : '0'); } catch (_) {}
  applyParticlesToggle();
};

/* ---------- render (canvas) ----------
   Reescrito nesta sessão: esferas/conexões eram um <g id="world"> de SVG (~8 filhos de DOM por
   esfera). SVG tem um teto real de desempenho — o navegador recalcula estilo/layout/pintura pra
   CADA elemento a cada mudança, custo que cresce com o número de esferas não importa quanta
   otimização se aplique por cima (já tentamos: cortar filter:drop-shadow, evitar reconstruir tudo
   a cada edição, culling de viewport, indexar conexões por esfera, "modo leve"). Canvas desenha
   PIXELS, não elementos — o custo por quadro passa a depender só do que é desenhado (barato, e
   cacheável via sprite pré-renderizado), não de quantos elementos de DOM existem. */
// null de propósito (não 0/0): a primeira chamada é o boot posicionando a câmera pela primeira
// vez, não um "movimento" de verdade — sem essa guarda, esse primeiro ajuste depositaria as
// partículas recém-semeadas todas deslocadas pro canto errado antes mesmo da árvore aparecer.
let lastViewX = null, lastViewY = null;
function applyView() {
  // a poeira cósmica vive em coordenadas de TELA (não de mundo, ver seedParts) — sem isso ela
  // ficava parada no lugar enquanto a câmera (pan/zoom/pinça) se movia por baixo dela. Desloca
  // todas as partículas pelo mesmo delta que a câmera moveu — é só uma translação (nunca reescala
  // pelo zoom), então não reintroduz o bug antigo de partículas se acumulando num ponto só quando
  // o zoom mudava (aquele vinha de REPROJETAR posição por view.s, não de uma soma simples).
  if (lastViewX !== null) {
    const dx = view.x - lastViewX, dy = view.y - lastViewY;
    if (dx || dy) for (const p of parts) { p.sx += dx; p.sy += dy; }
  }
  lastViewX = view.x; lastViewY = view.y;
  const tr = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
  ringsEl.style.transform = tr; gridPolarEl.style.transform = tr;
  updateSnapMarkTransform();
}
// separado de applyView(): o Núcleo só muda de posição quando ele é arrastado, não a cada
// pan/zoom — recalcular isso em todo pointermove do pan era escrita de DOM desperdiçada
function updateCoreAnchor() {
  const c = coreNode || nodes.find((n) => n.kind === 'core');
  if (c) { ringsInner.setAttribute('transform', `translate(${c.x} ${c.y})`); gridPolarInner.setAttribute('transform', `translate(${c.x} ${c.y})`); }
}
function toWorld(cx, cy) { const r = stage.getBoundingClientRect(); return { x: (cx-r.left-view.x)/view.s, y: (cy-r.top-view.y)/view.s }; }
function refreshCount() { const el = $('count'); el.className = 'count'; el.textContent = nodes.length + ' esferas · ' + edges.length + ' conexões'; }
function nodeRadius(n) { const base = n.kind === 'core' ? 22 : (n.kind === 'active' ? 16 : 13); return Math.round(base * (SIZE_SCALE[n.size] || 1)); }
// culling de viewport: mesmo sem custo de DOM, ainda tem custo real desenhar cada esfera (sprite +
// alguns traços). Só considerar o que está dentro da tela (mais uma margem folgada, pra não
// "piscar" nada com panorâmicas pequenas) mantém esse custo dependendo de quantas esferas CABEM na
// tela, não de quantas a árvore tem no total. Roda TODO quadro agora (dentro de drawWorld) — é só
// um teste de retângulo, barato o bastante pra não precisar mais esperar o gesto terminar (isso só
// era necessário quando "recalcular o que é visível" também significava recriar DOM).
const CULL_MARGIN_PX = 500;
function computeVisibleIds() {
  const pad = CULL_MARGIN_PX / view.s;
  const tl = toWorld(0, 0), br = toWorld(W, H);
  const x1 = tl.x - pad, y1 = tl.y - pad, x2 = br.x + pad, y2 = br.y + pad;
  const ids = new Set();
  for (const n of nodes) {
    const r = nodeRadius(n);
    if (n.x + r >= x1 && n.x - r <= x2 && n.y + r >= y1 && n.y - r <= y2) ids.add(n.id);
  }
  return ids;
}
// índice por id — usado no desenho das conexões (achar as duas pontas) e no hit-test, que rodam
// por quadro/por clique; nodes.find() linear seria O(n) nesses pontos quentes. (Não existe mais um
// índice de conexão-por-esfera separado: esse só fazia sentido pra atualizar cirurgicamente o DOM
// de UMA esfera arrastada, sem precisar varrer todas as conexões — em canvas, drawWorld() já varre
// "edges" inteiro todo quadro de qualquer jeito, então o índice seria trabalho refeito à toa.)
function rebuildIndexes() { nodeById = new Map(nodes.map((n) => [n.id, n])); }
// chamado sempre que nodes/edges são substituídos ou ganham/perdem itens (criar/excluir/duplicar
// esfera ou conexão, carregar a árvore) — recalcula os índices e o Núcleo. NÃO desenha nada: o
// desenho em si roda todo quadro dentro de tick()/drawWorld(), então qualquer mudança de dados
// (posição, cor, nome, seleção...) aparece sozinha no próximo quadro sem precisar chamar nada aqui.
function render() {
  coreNode = nodes.find((n) => n.kind === 'core') || null;
  rebuildIndexes();
  liteMode = nodes.length > LITE_MODE_NODE_THRESHOLD;
  refreshCount();
  buildRings(); // o alcance dos anéis decorativos depende de onde as esferas estão — ver ringExtent()
}

/* ---------- sprites (cache por cor/raio) ----------
   Recalcular um gradiente radial por esfera a CADA QUADRO reintroduziria custo por esfera — o
   oposto do motivo de ter trocado pra canvas. Em vez disso, cada combinação (cor, raio) do halo e
   cada raio do corpo são desenhados UMA vez num canvas fora de tela, cacheados, e reaproveitados
   via drawImage (barato) por todas as esferas que compartilham a combinação — normalmente só um
   punhado de combinações distintas numa árvore inteira. */
let spriteCache = new Map();
function glowSpriteFor(colorHex, r) {
  const key = 'glow|' + colorHex + '|' + r;
  let cv = spriteCache.get(key);
  if (cv) return cv;
  const d = Math.max(2, Math.ceil(r * 2 * DPR));
  cv = document.createElement('canvas'); cv.width = cv.height = d;
  const g = cv.getContext('2d'), [cr, cgg, cb] = hexToRgb(colorHex);
  const grad = g.createRadialGradient(d/2, d/2, 0, d/2, d/2, d/2);
  grad.addColorStop(0, `rgba(${cr},${cgg},${cb},1)`);
  grad.addColorStop(.55, `rgba(${cr},${cgg},${cb},.45)`);
  grad.addColorStop(1, `rgba(${cr},${cgg},${cb},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, d, d);
  spriteCache.set(key, cv);
  return cv;
}
function bodySpriteFor(r) {
  const key = 'body|' + r;
  let cv = spriteCache.get(key);
  if (cv) return cv;
  const d = Math.max(2, Math.ceil(r * 2 * DPR));
  cv = document.createElement('canvas'); cv.width = cv.height = d;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(d*.42, d*.36, 0, d*.5, d*.5, d*.64);
  grad.addColorStop(0, '#15131f'); grad.addColorStop(.55, '#0b0914'); grad.addColorStop(1, '#050308');
  g.fillStyle = grad; g.beginPath(); g.arc(d/2, d/2, d/2, 0, Math.PI*2); g.fill();
  spriteCache.set(key, cv);
  return cv;
}
// sprite de texto do selo de custo — pré-desenhado numa resolução acima do normal (cobre o zoom
// máximo de 2.6x do próprio editor, ver zoomAt) pra não ficar borrado quando o jogador dá zoom in;
// zoomado pra fora (o caso que ficava lento) ele só encolhe, sem nunca precisar redesenhar o texto.
const COST_SPRITE_OVERSAMPLE = 2.6;
let costSpriteCache = new Map();
function costBadgeSpriteFor(text, color) {
  const key = text + '|' + color;
  let cv = costSpriteCache.get(key);
  if (cv) return cv;
  const scale = DPR * COST_SPRITE_OVERSAMPLE, fontPx = 11 * scale, pad = 4 * scale;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `700 ${fontPx}px ${cssVar('--mono', 'monospace')}`;
  const w = Math.ceil(probe.measureText(text).width) + pad * 2, h = Math.ceil(fontPx * 1.7);
  cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.font = `700 ${fontPx}px ${cssVar('--mono', 'monospace')}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 3 * scale; g.strokeStyle = '#080615'; g.globalAlpha = .95;
  g.strokeText(text, w / 2, h / 2);
  g.fillStyle = color; g.globalAlpha = 1;
  g.fillText(text, w / 2, h / 2);
  costSpriteCache.set(key, cv);
  return cv;
}
// variáveis CSS (cor do tema) resolvidas de verdade — canvas não entende var(--x), precisa do
// valor final. Cacheado e invalidado só quando o tema muda (ver doToggleTheme).
let cssVarCache = new Map();
function cssVar(name, fallback) {
  if (cssVarCache.has(name)) return cssVarCache.get(name);
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  cssVarCache.set(name, v);
  return v;
}

/* ---------- desenho ---------- */
let hoveredNode = null; // esfera sob o cursor (mostra o rótulo do nome, igual :hover de antes)
function drawWorld(now) {
  const ctx = sctx;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.s, view.s);
  const visible = computeVisibleIds();
  for (const e of edges) {
    const A = nodeById.get(e.a), B = nodeById.get(e.b);
    if (!A || !B) continue;
    // corta a conexão se NENHUMA das duas pontas está visível — mesma lógica de antes, só que
    // recalculada todo quadro em vez de só no fim do gesto (agora é barato o bastante pra isso)
    if (!visible.has(e.a) && !visible.has(e.b)) continue;
    drawEdge(ctx, A, B, e, now);
  }
  for (const n of nodes) {
    if (!visible.has(n.id)) continue;
    drawNode(ctx, n, now);
  }
  ctx.restore();
}
function drawEdge(ctx, A, B, e, now) {
  const on = A.enabled !== false && B.enabled !== false;
  const [er, eg, eb] = hexToRgb(edgeColor);
  ctx.save();
  ctx.lineCap = 'round';
  if (e === selectedEdge) {
    ctx.strokeStyle = cssVar('--brass', '#18b5c6'); ctx.lineWidth = 3;
    if (!liteMode) { ctx.shadowColor = cssVar('--brass', '#18b5c6'); ctx.shadowBlur = 12; }
  } else if (on) {
    // brilho de verdade via shadowBlur nativo do canvas (equivalente ao filter:drop-shadow do
    // design original) — a versão anterior desenhava uma SEGUNDA linha larga e translúcida por
    // baixo da nítida, sem borrão nenhum: no zoom normal isso lia como uma faixa sólida meio
    // esbranquiçada ao redor da linha, não como um brilho de verdade. shadowBlur aplica o borrão
    // de graça em cima do stroke, sem o custo por-elemento que o drop-shadow tinha em SVG — o
    // pulsar (2.6s) não depende mais de liteMode, só o próprio shadowBlur (mais caro por chamada
    // que um stroke simples) continua desligado em árvores muito grandes.
    let mul = .78;
    if (!REDUCED) {
      const phase = ((now / 1000) % 2.6) / 2.6 * Math.PI * 2;
      mul = 0.78 + 0.22 * (0.5 - 0.5 * Math.cos(phase));
    }
    ctx.strokeStyle = `rgba(${er},${eg},${eb},.95)`; ctx.lineWidth = 2;
    if (!liteMode) { ctx.shadowColor = `rgba(${er},${eg},${eb},${mul.toFixed(3)})`; ctx.shadowBlur = 9; }
  } else {
    ctx.strokeStyle = `rgba(${er},${eg},${eb},.3)`; ctx.lineWidth = 1.4;
  }
  ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
  ctx.restore();
}
function drawNode(ctx, n, now) {
  const r = nodeRadius(n);
  const color = viaByKey(n.fac).color;
  const disabled = n.enabled === false;
  const acquired = !isGM && isNodeUnlocked(n);
  const isSelected = n === selected;
  const isMultisel = areaSelection.has(n.id);
  ctx.save();
  ctx.translate(n.x, n.y);
  // halo — ver comentário nos sprites; substitui filter:drop-shadow (caro por elemento em SVG)
  if (!disabled) {
    const glowR = r * 2.4, sprite = glowSpriteFor(color, glowR);
    ctx.globalAlpha = acquired ? .9 : .6;
    ctx.drawImage(sprite, -glowR, -glowR, glowR * 2, glowR * 2);
    ctx.globalAlpha = 1;
  }
  // corpo (gradiente escuro, sprite cacheado por raio) + aro finíssimo translúcido na cor da via
  ctx.drawImage(bodySpriteFor(r), -r, -r, r * 2, r * 2);
  const [cr, cg, cb] = hexToRgb(color);
  ctx.strokeStyle = `rgba(${cr},${cg},${cb},.25)`; ctx.lineWidth = .6;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  // textura de pontos giratória (sprite cacheado por cor, ver dotSpriteFor)
  if (!disabled) ctx.drawImage(dotSpriteFor(color), -r, -r, r * 2, r * 2);
  // aro de destaque (rim) — dourado grosso se o JOGADOR já desbloqueou de verdade, senão a cor da via
  if (!disabled) {
    ctx.strokeStyle = acquired ? cssVar('--brass', '#18b5c6') : color;
    ctx.lineWidth = acquired ? 3 : 1.8;
    ctx.globalAlpha = .9;
    if (n === linkSrc) ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  // flash de desbloqueio — anel branco que expande e some (disparado em doUnlock)
  if (n._flashStart != null) {
    const p = (now - n._flashStart) / 700;
    if (p >= 1) n._flashStart = null;
    else {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.globalAlpha = .95 * (1 - p);
      ctx.beginPath(); ctx.arc(0, 0, (r + 7) * (1 + p * 1.6), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  // anel de seleção (pulsa) / multi-seleção (área) / foco de teclado
  if (isSelected) {
    let mulO = .7, mulR = 1;
    if (!REDUCED) {
      const phase = ((now / 1000) % 1.8) / 1.8 * Math.PI * 2;
      mulO = 0.2 + 0.5 * (0.5 + 0.5 * Math.cos(phase));
      mulR = 1 + 0.15 * (0.5 - 0.5 * Math.cos(phase));
    }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.3; ctx.globalAlpha = .9 * mulO;
    ctx.beginPath(); ctx.arc(0, 0, (r + 9) * mulR, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (isMultisel) {
    ctx.strokeStyle = cssVar('--brass', '#18b5c6'); ctx.fillStyle = 'rgba(227,192,113,.1)';
    ctx.lineWidth = 1.6; ctx.globalAlpha = .95;
    ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (n === focusedNode() && document.activeElement === $('tree-focus-proxy')) {
    // anel de foco por teclado — só quando o proxy de acessibilidade tem o foco de verdade
    // (clique de mouse nunca foca o proxy, então isso nunca "pisca" por engano num clique)
    ctx.strokeStyle = cssVar('--maq', '#35c6d4'); ctx.lineWidth = 2.4; ctx.globalAlpha = .95;
    ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // selo de custo — sempre visível (herdava .unlocked, que era incondicional, exceto desativada).
  // Medido numa árvore sintética de ~1000 esferas visíveis de uma vez (bem afastado, o cenário
  // real do relato original de lentidão): strokeText+fillText por esfera, a cada quadro, era o
  // maior custo de longe — texto é caro de rasterizar em canvas, muito mais que um drawImage. Vira
  // sprite cacheado (por texto+cor, igual glow/corpo/pontos) e, abaixo de um tamanho de tela onde o
  // texto seria ilegível de qualquer jeito, nem desenha (sprite ou não) — sem perda visual real.
  if (!disabled && r * view.s > 5) {
    const label = (n.cost || 0) + ' ✦';
    const sp = costBadgeSpriteFor(label, color);
    // o sprite é desenhado numa resolução MAIOR que o tamanho final (ver COST_SPRITE_OVERSAMPLE) só
    // pra ficar nítido no zoom — dividir por DPR sozinho esquecia de desfazer esse fator extra, e o
    // selo saía ~2.6x maior do que deveria (o bug do "número gigante" em cima da esfera).
    const w = sp.width / (DPR * COST_SPRITE_OVERSAMPLE), h = sp.height / (DPR * COST_SPRITE_OVERSAMPLE);
    ctx.drawImage(sp, -w / 2, -(r + 9) - h / 2, w, h);
  }
  // rótulo do nome — só em hover/selecionado, igual antes
  if (isSelected || n === hoveredNode) {
    ctx.font = `11px ${cssVar('--mono', 'monospace')}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = n.name || '(sem nome)';
    ctx.lineWidth = 4; ctx.strokeStyle = '#080615'; ctx.globalAlpha = .97;
    ctx.strokeText(label, 0, r + 16);
    ctx.fillStyle = cssVar('--ink', '#e9edf1'); ctx.fillText(label, 0, r + 16);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ---------- hit-test (clique) ----------
   Varredura linear — um clique é um evento só, até em milhares de esferas isso é sub-milissegundo;
   não compensa a complexidade de um índice espacial que precisaria ficar sincronizado a cada
   arrasto/criação/exclusão de esfera. */
function hitTestNodeAt(wx, wy) {
  for (let i = nodes.length - 1; i >= 0; i--) { // de trás pra frente: a última desenhada vence, igual antes
    const n = nodes[i], r = nodeRadius(n), dx = wx - n.x, dy = wy - n.y;
    if (dx * dx + dy * dy <= r * r) return n;
  }
  return null;
}
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
// tolerância em unidades de MUNDO (não pixels de tela), pra continuar escalando com o zoom igual
// antes. Alargada de propósito em relação à linha fina de antes (só a linha nítida, 1.4 de
// espessura, recebia clique) — um alvo bem fino e fácil de errar; agora perto da largura do brilho.
const EDGE_HIT_TOLERANCE = 5;
function hitTestEdgeAt(wx, wy) {
  let best = null, bestD = EDGE_HIT_TOLERANCE;
  for (const e of edges) {
    const A = nodeById.get(e.a), B = nodeById.get(e.b); if (!A || !B) continue;
    const d = distToSegment(wx, wy, A.x, A.y, B.x, B.y);
    if (d <= bestD) { bestD = d; best = e; }
  }
  return best;
}

// arrastar esfera (Mestre) — chamado pelo pointerdown de "stage" quando o hit-test acha uma esfera.
// Sem setAttribute/updateEdges nenhum: só muda n.x/n.y, o próximo quadro de drawWorld() já desenha
// a posição atual. Mantém o caso especial do Núcleo (a âncora dos anéis/grade decorativos).
function startNodeDrag(n, ev) {
  let moved = false; const sx = ev.clientX, sy = ev.clientY, ox = n.x, oy = n.y;
  try { stage.setPointerCapture(ev.pointerId); } catch (_) {}
  const mv = (e) => { const dx = (e.clientX-sx)/view.s, dy = (e.clientY-sy)/view.s;
    if (!moved && Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy) > 4) { moved = true; if (n.kind !== 'core') gridPolarEl.classList.add('show'); }
    if (!moved) return;
    const snapped = gridSnap(ox+dx, oy+dy, n.kind === 'core');
    n.x = snapped.x; n.y = snapped.y; if (n.kind === 'core') updateCoreAnchor(); };
  const up = () => { try { stage.releasePointerCapture(ev.pointerId); } catch(_){}
    stage.removeEventListener('pointermove', mv); stage.removeEventListener('pointerup', up);
    // só esconde a grade se a ferramenta "esfera" não estiver mais ativa — ela já é quem decide se
    // a grade fica visível (ver setTool). Escondendo sempre aqui, incondicionalmente, a grade sumia
    // depois de soltar uma esfera arrastada mesmo com a ferramenta "esfera" ainda ligada.
    if (tool !== 'add') gridPolarEl.classList.remove('show');
    if (moved) { db.updateTreeNode(n.id, { x: n.x, y: n.y }).catch((e) => showMsg(e.message)); buildRings(); }
    else selectNode(n); };
  stage.addEventListener('pointermove', mv); stage.addEventListener('pointerup', up);
}
async function selectNode(n) {
  if (isGM && editorDirty && selected && selected.id !== n.id) {
    const ok = await confirmModal({ title: 'Descartar alterações', desc: `Você tem alterações não salvas em "${selected.name || 'esta esfera'}". Trocar de esfera mesmo assim?`, confirmLabel: 'Descartar' });
    if (!ok) return;
    discardEditorDraft();
  }
  deselectEdge();
  selected = n;
  focusedNodeId = n.id; // clique de mouse também move o "foco lógico" de teclado (sem roubar o foco visual à toa)
  if (isGM) openEditor(n); else openViewer(n);
}
function snapshotNode(n) {
  return { name: n.name, kind: n.kind, size: n.size, enabled: n.enabled, fac: n.fac, cost: n.cost, descr: n.descr,
    modifiers: (n.modifiers || []).map((m) => ({ ...m })) };
}
function discardEditorDraft() {
  if (selected && editorSnapshot) { Object.assign(selected, editorSnapshot); render(); applyView(); }
  editorDirty = false;
}
function markEditorDirty() { editorDirty = true; const b = $('node-save-btn'); if (b) b.style.display = ''; }
function refreshEditorFields(n) {
  $('e-name').value = n.name || ''; $('e-desc').value = n.descr || '';
  // o Núcleo É a esfera inicial (só pode haver um por árvore, e ele já nasce automaticamente
  // desbloqueado — ver isNodeUnlocked) — sempre grátis, então trava o campo em 0 em vez de deixar
  // salvar um custo>0 que nunca seria realmente cobrado
  $('e-cost').value = n.kind === 'core' ? 0 : (n.cost || 0);
  $('e-cost').disabled = n.kind === 'core';
  $('e-cost').title = n.kind === 'core' ? 'O Núcleo é a esfera inicial — sempre grátis' : '';
  document.querySelectorAll('#e-type .chip').forEach((c) => c.classList.toggle('on', c.dataset.v === n.kind));
  document.querySelectorAll('#e-size .chip').forEach((c) => c.classList.toggle('on', c.dataset.s === (n.size || 'small')));
  document.querySelectorAll('#e-enabled .chip').forEach((c) => c.classList.toggle('on', c.dataset.e === (n.enabled === false ? '0' : '1')));
  document.querySelectorAll('#e-fac .chip').forEach((c) => c.classList.toggle('on', c.dataset.f === n.fac));
  renderModRows(n);
}
function openEditor(n) {
  editorSnapshot = snapshotNode(n); editorDirty = false;
  const saveBtn = $('node-save-btn'); if (saveBtn) saveBtn.style.display = 'none';
  refreshEditorFields(n);
  $('editor').classList.add('open');
}
window.saveNodeEditor = () => {
  if (!isGM || !selected) return;
  const btn = $('node-save-btn'); if (btn) { btn.classList.add('loading'); btn.disabled = true; }
  const patch = { name: selected.name, kind: selected.kind, size: selected.size, enabled: selected.enabled,
    fac: selected.fac, cost: selected.cost, descr: selected.descr, modifiers: selected.modifiers };
  db.updateTreeNode(selected.id, patch).then(() => {
    editorSnapshot = snapshotNode(selected); editorDirty = false;
    if (btn) btn.style.display = 'none';
    showMsg('Esfera salva.', 'ok');
  }).catch((e) => showMsg(e.message))
    .finally(() => { if (btn) { btn.classList.remove('loading'); btn.disabled = false; } });
};
/* ---------- modificadores de status da esfera (mira um atributo real do sistema) ---------- */
function renderModRows(n) {
  if (!stats.length) {
    $('e-mods').innerHTML = `<p style="font-family:var(--mono);font-size:10px;color:var(--ink-faint);line-height:1.6;margin:0">Este sistema ainda não tem atributos cadastrados (aba Geral do sistema) — cadastre um pra poder linkar um modificador aqui.</p>`;
    return;
  }
  const mods = n.modifiers || [];
  const rowStyle = 'flex:1;background:rgba(255,255,255,.06);border:1px solid var(--line2);border-radius:8px;color:var(--ink);font-family:var(--mono);font-size:12px;padding:7px 9px';
  let html = mods.map((m, i) => `
    <div class="via-row">
      <select onchange="setNodeModStat(${i},this.value)" style="${rowStyle}">
        ${stats.map((s) => `<option value="${s.id}" ${s.id === m.stat_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
      </select>
      <input type="number" step="1" value="${m.amount ?? 0}" oninput="setNodeModAmount(${i},this.value)" style="width:64px;${rowStyle}flex:0 0 auto">
      <button type="button" class="via-del" onclick="removeNodeMod(${i})" title="Remover"><span class="ic">${ICONS.x}</span></button>
    </div>`).join('');
  html += `<button type="button" class="via-add-btn" style="width:100%;height:32px;border-radius:8px" onclick="addNodeMod()">+ Adicionar modificador</button>`;
  $('e-mods').innerHTML = html;
}
window.addNodeMod = () => { if (!isGM || !selected || !stats.length) return;
  selected.modifiers = [...(selected.modifiers || []), { stat_id: stats[0].id, amount: 1 }];
  renderModRows(selected); markEditorDirty(); };
window.removeNodeMod = (i) => { if (!isGM || !selected) return;
  selected.modifiers = (selected.modifiers || []).filter((_, idx) => idx !== i);
  renderModRows(selected); markEditorDirty(); };
window.setNodeModStat = (i, statId) => { if (!isGM || !selected || !selected.modifiers[i]) return;
  selected.modifiers[i].stat_id = statId; markEditorDirty(); };
window.setNodeModAmount = (i, amount) => { if (!isGM || !selected || !selected.modifiers[i]) return;
  selected.modifiers[i].amount = Number(amount) || 0; markEditorDirty(); };
window.closePanel = async () => {
  if (editorDirty) {
    const ok = await confirmModal({ title: 'Descartar alterações', desc: 'As alterações não salvas nesta esfera serão perdidas.', confirmLabel: 'Descartar' });
    if (!ok) return;
    discardEditorDraft();
  }
  $('editor').classList.remove('open'); selected = null;
};
// nome/custo/descrição vêm de oninput (dispara a cada tecla, não só ao concluir) — só nome e
// custo aparecem desenhados na esfera (rótulo/selo), e descrição não aparece na esfera nenhuma;
// então em vez de chamar render() (que apaga e recria TODAS as esferas/conexões do zero, incluindo
// os listeners de cada uma) a cada caractere digitado, atualiza só o texto no lugar. Com poucas
// esferas isso não se notava, mas o custo do render() cresce com o número de esferas — daí a
// digitação ficar visivelmente mais lenta quanto mais esferas a árvore tem. Só troca de "kind"/
// "size"/"enabled"/"via" (cliques em chip, não oninput) ainda passam por render() completo, já que
// mudam o visual da esfera inteira (cor/raio/classe) e só acontecem uma vez por clique, não a cada tecla.
window.patch = async (k, v) => {
  if (!isGM || !selected) return;
  // só um Núcleo por árvore — os anéis/âncora da grade (polarSnap, updateCoreAnchor, buildRings)
  // sempre pegam o PRIMEIRO nó com kind:'core' que encontram; um segundo Núcleo simplesmente
  // ficava inerte, sem nenhum aviso de que aquele clique não fazia o que parecia fazer
  if (k === 'kind' && v === 'core') {
    const other = nodes.find((x) => x !== selected && x.kind === 'core');
    if (other) {
      const ok = await confirmModal({ title: 'Já existe um Núcleo', desc: `"${other.name || 'outra esfera'}" já é o Núcleo desta árvore — só uma pode ser. Trocar o Núcleo pra esta esfera?`, confirmLabel: 'Trocar', danger: false });
      if (!ok) { refreshEditorFields(selected); return; }
      other.kind = 'active';
      db.updateTreeNode(other.id, { kind: 'active' }).catch((e) => showMsg(e.message));
    }
    selected.kind = v;
    // troca de Núcleo grava na hora, ao contrário dos outros campos (que só viram rascunho até
    // clicar "Salvar"): a outra esfera já foi rebaixada de verdade no banco acima — se essa
    // promoção ficasse pendente e o Mestre saísse sem salvar, a árvore ficaria sem NENHUM Núcleo
    // até alguém notar e corrigir na mão.
    db.updateTreeNode(selected.id, { kind: 'core' }).catch((e) => showMsg(e.message));
    render(); applyView();
    refreshEditorFields(selected);
    return;
  }
  // deixando de ser Núcleo (sem virar outra coisa "core" no processo) — a âncora dos anéis/grade
  // precisa migrar pro que sobrar; esse caminho já não tem o risco de "ficar sem Núcleo nenhum"
  // acima (a árvore simplesmente perde a âncora até alguém marcar outra esfera como Núcleo), então
  // continua no fluxo normal de rascunho+Salvar como qualquer outro campo.
  const coreChanged = k === 'kind' && selected.kind === 'core' && v !== 'core';
  selected[k] = v;
  // canvas lê nome/custo/tamanho/estado/via/tipo direto de "selected" em todo quadro — nenhum campo
  // precisa de atualização manual aqui além do caso especial acima (troca de Núcleo mexe com a
  // âncora dos anéis/grade pra TODA a árvore, não só com o visual da esfera em si)
  if (coreChanged) { render(); applyView(); }
  refreshEditorFields(selected); markEditorDirty();
};
/* ---------- visão somente-leitura pro jogador — mesmos dados, sem nenhum campo editável ---------- */
// o Núcleo É a esfera inicial — só pode haver um por árvore (ver patch()) e ele nasce
// automaticamente desbloqueado, sem precisar de nenhuma marcação separada.
function isNodeUnlocked(n) { return n.kind === 'core' || unlockedIds.has(n.id); }
// usado no aria-label do proxy de foco de teclado (ver seção "teclado (canvas)") — inclui tipo e
// (pro jogador) custo/estado de desbloqueio, não só o nome: quem navega só por teclado não tem
// como "ver" a cor do aro ou o selo de custo desenhado na esfera, então precisa ouvir essa
// informação de algum jeito
function nodeAriaLabel(n) {
  const kindLabel = n.kind === 'core' ? 'Núcleo' : n.kind === 'active' ? 'esfera ativa' : 'esfera passiva';
  let label = (n.name || 'Esfera sem nome') + ', ' + kindLabel;
  if (n.enabled === false) label += ', desativada';
  if (!isGM) label += isNodeUnlocked(n) ? ', desbloqueada' : `, bloqueada, custa ${n.cost || 0} ponto${n.cost === 1 ? '' : 's'}`;
  return label;
}
function canUnlock(n) {
  if (isNodeUnlocked(n)) return { ok: false, reason: 'already' };
  const connected = edges.some((e) => (e.a === n.id || e.b === n.id) && isNodeUnlocked(byId(e.a === n.id ? e.b : e.a) || {}));
  if (!connected) return { ok: false, reason: 'connectivity' };
  // o Núcleo é sempre grátis — não entra na conta de pontos gastos, mesmo que tenha um custo>0
  // salvo de antes da trava do campo (árvores mais antigas)
  const spent = nodes.filter((x) => isNodeUnlocked(x) && x.kind !== 'core').reduce((s, x) => s + (x.cost || 0), 0);
  const remaining = myPoints - spent;
  if (remaining < (n.cost || 0)) return { ok: false, reason: 'points', remaining };
  return { ok: true };
}
function openViewer(n) {
  $('v-name').textContent = n.name || '(sem nome)';
  $('v-type').textContent = n.kind === 'core' ? 'Núcleo' : n.kind === 'active' ? 'Ativa' : 'Passiva';
  const via = viaByKey(n.fac);
  $('v-via').innerHTML = `<div class="chip on" style="--vc:${via.color};flex:0 0 auto;cursor:default">${esc(via.name)}</div>`;
  $('v-cost').innerHTML = `<span class="ic">${ICONS.sparkle}</span>${n.cost || 0}`;
  $('v-desc').textContent = n.descr || 'Sem descrição.';
  const mods = n.modifiers || [];
  if (mods.length) {
    $('v-mods-fld').style.display = '';
    $('v-mods').innerHTML = mods.map((m) => { const s = statById(m.stat_id);
      return `<div style="font-family:var(--mono);font-size:12px;color:var(--brass)">${s ? esc(s.name) : '(atributo removido)'}: ${m.amount >= 0 ? '+' : ''}${m.amount}</div>`; }).join('');
  } else { $('v-mods-fld').style.display = 'none'; }
  if (isGM) { $('v-unlock-fld').style.display = 'none'; }
  else {
    $('v-unlock-fld').style.display = '';
    const btn = $('v-unlock-btn'), msg = $('v-unlock-msg');
    if (isNodeUnlocked(n)) {
      btn.style.display = 'none';
      msg.innerHTML = `<span class="ic">${ICONS.check}</span>Já desbloqueada.`;
    } else {
      btn.style.display = '';
      const check = canUnlock(n);
      btn.disabled = !check.ok;
      btn.textContent = `Desbloquear (custo: ${n.cost || 0} ponto${n.cost === 1 ? '' : 's'})`;
      msg.textContent = check.ok ? ''
        : check.reason === 'connectivity' ? 'Conecte a uma esfera já desbloqueada primeiro.'
        : `Pontos insuficientes (você tem ${Math.max(0, check.remaining)} disponível).`;
    }
  }
  $('viewer').classList.add('open');
}
window.closeViewer = () => { $('viewer').classList.remove('open'); selected = null; };
window.doUnlock = async () => {
  if (isGM || !selected) return;
  const n = selected, btn = $('v-unlock-btn');
  btn.disabled = true;
  try {
    await db.unlockNode(n.id);
    unlockedIds.add(n.id);
    try { myPoints = await db.getMyProgress(treeId); } catch (_) {}
    render(); openViewer(n);
    // flash de desbloqueio: um anel branco que expande e some (ver o bloco "_flashStart" em
    // drawNode) — dá o "momento de recompensa" ao desbloquear
    n._flashStart = performance.now();
    showMsg('Esfera desbloqueada!');
  } catch (e) { showMsg(e.message); btn.disabled = false; }
};
window.deleteSelected = async () => {
  if (!isGM || !selected) return;
  const n = selected;
  // apagar em lote (deleteAreaSelection) já pede confirmação — apagar uma esfera avulsa não pedia,
  // então quem aprendeu "excluir em lote confirma" era pego de surpresa nessa aqui
  const desc = n.kind === 'core'
    ? 'Esta é o Núcleo da árvore — apagar remove o encaixe de grade e a âncora dos anéis até outra esfera virar Núcleo. Não dá pra desfazer.'
    : 'Não dá pra desfazer.';
  const ok = await confirmModal({ title: 'Excluir esfera', desc, confirmLabel: 'Excluir' });
  if (!ok) return;
  db.deleteTreeNode(n.id).then(() => { edges = edges.filter((x) => x.a !== n.id && x.b !== n.id); nodes = nodes.filter((x) => x !== n);
    selected = null; editorDirty = false; closePanel(); render(); applyView(); }).catch((e) => showMsg(e.message)); };

// esfera de origem da ligação: o anel tracejado dela é desenhado direto em drawNode (checa
// `n === linkSrc`) — não precisa de classe de DOM nenhuma pra "marcar" visualmente
function handleLink(n) {
  if (!linkSrc) { linkSrc = n; return; }
  if (linkSrc !== n) {
    const ex = edges.some((x) => (x.a === linkSrc.id && x.b === n.id) || (x.a === n.id && x.b === linkSrc.id));
    // antes, clicar num par já ligado não fazia NADA visível — dava pra achar que o clique
    // simplesmente não funcionou, em vez de saber que a conexão já existia
    if (ex) showMsg('Essas esferas já estão conectadas.');
    else db.insertTreeEdge(treeId, linkSrc.id, n.id).then((e) => { if (e) { edges.push({ id: e.id, a: e.a, b: e.b }); render(); } }).catch((er) => showMsg(er.message));
  }
  linkSrc = null;
}
// selecionar uma conexão (só o Mestre, ferramenta Selecionar) — Delete apaga só ela, sem precisar
// excluir uma das duas esferas inteiras (o único jeito que existia antes)
function selectEdge(e) {
  if (!isGM || tool !== 'select') return;
  if (selected) { selected = null; closePanel(); }
  selectedEdge = e;
}
function deselectEdge() { selectedEdge = null; }
function deleteSelectedEdge() {
  const e = selectedEdge; if (!isGM || !e) return;
  db.deleteTreeEdge(e.id).then(() => { edges = edges.filter((x) => x !== e); selectedEdge = null; render(); }).catch((er) => showMsg(er.message));
}

/* ---------- pan / zoom / add / seleção por área ---------- */
// Não existe mais um "modo interagindo" que pausa animação durante pan/zoom/arrasto — isso era uma
// correção da época do SVG (repintar anéis/pulso competia de verdade com o tempo de quadro do
// gesto). Em canvas, culling roda todo quadro de qualquer jeito (ver computeVisibleIds em
// drawWorld) e girar a textura/pulsar uma conexão custa quase nada — deixar tudo sempre ligado,
// inclusive durante o gesto, não compete com mais nada.
let panning = false, pStart, vStart;
let areaDragging = false, areaScreenStart = null;
// pinch-to-zoom: nenhum gesto de toque tinha suporte antes (só wheel do mouse e os botões +/− do
// HUD) — num tablet/celular, dar zoom exigia cutucar um botão pequeno repetidas vezes. Rastreado
// por pointerId (não só "o último pointermove") porque sem isso um segundo dedo tocando a tela
// durante um pan em andamento sobrescrevia pStart/vStart com as coordenadas do dedo novo, causando
// um salto visual perceptível na câmera.
let activePointers = new Map(); // pointerId -> {x,y}
let pinchLastDist = null;
function pointerDist() { const pts = [...activePointers.values()]; return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); }
function pointerMid() { const pts = [...activePointers.values()]; return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }; }
// hit-test de esfera/conexão primeiro (prioridade de pintura: esfera por cima, depois conexão),
// senão cai pra pan/marquee/colocar — mesma ordem de prioridade de quando cada esfera tinha seu
// próprio elemento de SVG com stopPropagation() (ver a nota histórica em startNodeDrag)
stage.addEventListener('pointerdown', async (ev) => {
  activePointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (activePointers.size === 2 && tool === 'select') {
    panning = false; areaDragging = false; stage.classList.remove('panning');
    pinchLastDist = pointerDist();
    return;
  }
  if (activePointers.size > 1) return; // dedo extra durante outro gesto — ignora

  const p = toWorld(ev.clientX, ev.clientY);
  // ferramenta "área" ignora esferas no hit-test de propósito — clicar numa esfera com essa
  // ferramenta ativa começa um marquee a partir dali, igual antes (não seleciona/arrasta ela)
  const hitNode = tool !== 'area' ? hitTestNodeAt(p.x, p.y) : null;
  if (hitNode) {
    if (!isGM) { selectNode(hitNode); return; }
    if (tool === 'link') { handleLink(hitNode); return; }
    startNodeDrag(hitNode, ev);
    return;
  }
  if (tool === 'select' && isGM) {
    const hitEdge = hitTestEdgeAt(p.x, p.y);
    if (hitEdge) { selectEdge(hitEdge); return; }
  }
  if (tool === 'add' && isGM) {
    const snapped = gridSnap(p.x, p.y);
    const node = { name: '', kind: 'active', fac: vias[0].key, size: 'small', cost: 1, descr: '', x: snapped.x, y: snapped.y };
    try { const saved = await db.insertTreeNode(treeId, node); node.id = saved.id; nodes.push(node); render(); selectNode(node); } catch (e) { showMsg(e.message); }
    return; }
  if (tool === 'area') {
    areaDragging = true; areaScreenStart = { x: ev.clientX, y: ev.clientY };
    Object.assign(marqueeEl.style, { left: ev.clientX + 'px', top: ev.clientY + 'px', width: '0px', height: '0px', display: 'block' });
    return; }
  panning = true; stage.classList.add('panning'); pStart = { x: ev.clientX, y: ev.clientY }; vStart = { x: view.x, y: view.y }; });
stage.addEventListener('pointermove', (ev) => {
  if (activePointers.has(ev.pointerId)) activePointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (activePointers.size === 2 && pinchLastDist != null) {
    const dist = pointerDist(), mid = pointerMid();
    if (dist > 0 && pinchLastDist > 0) { zoomAt(mid.x, mid.y, dist / pinchLastDist); }
    pinchLastDist = dist;
    return;
  }
  if (areaDragging) {
    const x1 = Math.min(areaScreenStart.x, ev.clientX), y1 = Math.min(areaScreenStart.y, ev.clientY);
    Object.assign(marqueeEl.style, { left: x1 + 'px', top: y1 + 'px',
      width: Math.abs(ev.clientX - areaScreenStart.x) + 'px', height: Math.abs(ev.clientY - areaScreenStart.y) + 'px' });
    return; }
  if (panning) { view.x = vStart.x+(ev.clientX-pStart.x); view.y = vStart.y+(ev.clientY-pStart.y); applyView(); return; }
  if (tool === 'add') { const p = toWorld(ev.clientX, ev.clientY); const s = gridSnap(p.x, p.y); showSnapMark(s.x, s.y); }
  // hover: mostra o rótulo do nome (drawNode) e o cursor de "pode clicar" — antes vinha de graça
  // via :hover do CSS, agora precisa ser calculado à mão (só custa algo por movimento real do
  // ponteiro, não por quadro)
  if (activePointers.size < 2) {
    const wp = toWorld(ev.clientX, ev.clientY);
    hoveredNode = hitTestNodeAt(wp.x, wp.y);
    stage.style.cursor = hoveredNode || (tool === 'select' && isGM && hitTestEdgeAt(wp.x, wp.y)) ? 'pointer' : '';
  }
});
stage.addEventListener('pointerleave', () => { hoveredNode = null; stage.style.cursor = ''; });
function endPointer(ev) {
  activePointers.delete(ev.pointerId);
  if (activePointers.size < 2) pinchLastDist = null;
  // sobrou 1 dedo depois de um pinch — retoma o pan a partir da posição atual dele, sem salto
  if (activePointers.size === 1 && tool === 'select' && !panning) {
    const [[, p]] = activePointers;
    panning = true; stage.classList.add('panning');
    pStart = { x: p.x, y: p.y }; vStart = { x: view.x, y: view.y };
    return;
  }
  if (activePointers.size === 0) {
    panning = false; stage.classList.remove('panning');
    if (areaDragging) { areaDragging = false; marqueeEl.style.display = 'none';
      finalizeAreaSelection(toWorld(areaScreenStart.x, areaScreenStart.y), toWorld(ev.clientX, ev.clientY)); }
  }
}
addEventListener('pointerup', endPointer);
addEventListener('pointercancel', endPointer);
function finalizeAreaSelection(p1, p2) {
  const x1 = Math.min(p1.x, p2.x), x2 = Math.max(p1.x, p2.x), y1 = Math.min(p1.y, p2.y), y2 = Math.max(p1.y, p2.y);
  if (x2 - x1 < 4 && y2 - y1 < 4) return; // arrasto quase nulo (clique) — ignora, não seleciona tudo sem querer
  areaSelection = new Set(nodes.filter((n) => n.kind !== 'core' && n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2).map((n) => n.id));
  updateBatchPanel();
}
function updateBatchPanel() {
  const n = areaSelection.size;
  $('batch-count').textContent = n + (n === 1 ? ' esfera selecionada' : ' esferas selecionadas');
  batchPanelEl.classList.toggle('open', n > 0);
}
window.clearAreaSelection = () => { areaSelection = new Set(); batchPanelEl.classList.remove('open'); };
/* edição em lote — aplica um campo (via/tamanho/estado) a todas as esferas da seleção de área de uma vez */
window.batchSet = (key, value) => {
  if (!isGM) return;
  const ids = [...areaSelection];
  if (!ids.length) return;
  // canvas lê o campo direto da esfera em todo quadro — não precisa de nenhuma atualização visual manual aqui
  ids.forEach((id) => { const n = byId(id); if (n) n[key] = value; });
  Promise.all(ids.map((id) => db.updateTreeNode(id, { [key]: value })))
    .then(() => showMsg(`${ids.length} esfera(s) atualizada(s).`))
    .catch((e) => showMsg(e.message));
};

/* opções de duplicação — dependem do formato da grade, geradas dinamicamente */
function renderDupOptions() {
  const box = $('rotgrid');
  if (gridShape === 'linear') {
    $('dup-title').textContent = 'Espelhar cópia pelo Núcleo';
    $('dup-hint').textContent = 'A cópia espelha pelo Núcleo e reconecta onde a seleção original se conectava — sempre encaixada na grade quadrada.';
    box.innerHTML = `
      <button class="tool" onclick="duplicateSelection('flipV')"><span class="ic">${ICONS.flipV}</span>Cima/baixo</button>
      <button class="tool" onclick="duplicateSelection('flipH')"><span class="ic">${ICONS.flipH}</span>Esquerda/direita</button>
      <button class="tool" onclick="duplicateSelection('flip180')"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20 20 4"/><path d="M9 4H4v5"/><path d="M15 20h5v-5"/></svg></span>Diagonal</button>`;
    return;
  }
  $('dup-title').textContent = 'Girar cópia ao redor do Núcleo';
  $('dup-hint').textContent = 'A cópia gira ao redor do Núcleo e reconecta onde a seleção original se conectava — sempre encaixada na grade.';
  const unit = 360 / (SHAPE_SEGMENTS[gridShape] || 8);
  let html = '';
  for (let k = 1; k * unit < 180; k++) html += `<button class="tool" onclick="duplicateSelection(${k * unit})"><span class="ic">${ICONS.rotateCw}</span>${k * unit}°</button>`;
  html += `<button class="tool" onclick="duplicateSelection(180)"><span class="ic">${ICONS.rotateCw}</span>180°</button>`;
  for (let k = 1; k * unit < 180; k++) html += `<button class="tool" onclick="duplicateSelection(${-k * unit})"><span class="ic">${ICONS.rotateCcw}</span>${k * unit}°</button>`;
  box.innerHTML = html;
}
function transformPoint(x, y, cx, cy, op) {
  if (typeof op === 'number') {
    const a = op * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), dx = x - cx, dy = y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  }
  const dx = x - cx, dy = y - cy;
  if (op === 'flipV') return { x: cx + dx, y: cy - dy };
  if (op === 'flipH') return { x: cx - dx, y: cy + dy };
  if (op === 'flip180') return { x: cx - dx, y: cy - dy };
  return { x, y };
}
window.duplicateSelection = async (op) => {
  if (!isGM) return;
  const core = coreNode || nodes.find((n) => n.kind === 'core');
  const ids = [...areaSelection];
  if (!core || !ids.length) { showMsg('Nada pra duplicar.'); return; }
  const idSet = new Set(ids);
  const internalEdges = edges.filter((e) => idSet.has(e.a) && idSet.has(e.b));
  const boundaryEdges = edges.filter((e) => idSet.has(e.a) !== idSet.has(e.b));
  showMsg('Duplicando…');
  try {
    // esferas primeiro, em paralelo (cada uma é independente das outras) — antes era um await por
    // esfera, um round-trip de cada vez, proporcionalmente mais lento quanto maior a seleção
    const created = await Promise.all(ids.map(async (id) => {
      const n = byId(id); if (!n) return null;
      const t = transformPoint(n.x, n.y, core.x, core.y, op);
      const snapped = gridSnap(t.x, t.y);
      const saved = await db.insertTreeNode(treeId, { name: n.name, kind: n.kind, fac: n.fac, size: n.size, cost: n.cost, descr: n.descr, x: snapped.x, y: snapped.y });
      return { oldId: id, saved };
    }));
    const idMap = new Map();
    created.forEach((c) => { if (c && c.saved) { nodes.push({ ...c.saved }); idMap.set(c.oldId, c.saved.id); } });
    // as conexões só podem ser criadas depois que TODAS as esferas novas existirem (precisam do
    // idMap completo), mas internas e de fronteira entre si também são independentes
    const [internalSaved, boundarySaved] = await Promise.all([
      Promise.all(internalEdges.map((e) => {
        const a = idMap.get(e.a), b = idMap.get(e.b); if (!a || !b) return null;
        return db.insertTreeEdge(treeId, a, b);
      })),
      Promise.all(boundaryEdges.map((e) => {
        const insideOld = idSet.has(e.a) ? e.a : e.b, outside = idSet.has(e.a) ? e.b : e.a;
        const insideNew = idMap.get(insideOld); if (!insideNew) return null;
        return db.insertTreeEdge(treeId, insideNew, outside);
      })),
    ]);
    [...internalSaved, ...boundarySaved].forEach((saved) => { if (saved) edges.push({ id: saved.id, a: saved.a, b: saved.b }); });
    render(); applyView(); clearAreaSelection();
    showMsg(`${ids.length} esfera(s) duplicada(s).`);
  } catch (e) { showMsg('Erro ao duplicar: ' + e.message); }
};
window.deleteAreaSelection = async () => {
  if (!isGM) return;
  const ids = [...areaSelection];
  if (!ids.length) return;
  const ok = await confirmModal({ title: 'Excluir esferas', desc: `Excluir ${ids.length} esfera(s) selecionada(s)? As conexões delas também somem. Não dá pra desfazer.`, confirmLabel: 'Excluir' });
  if (!ok) return;
  showMsg('Excluindo…');
  Promise.all(ids.map((id) => db.deleteTreeNode(id))).then(() => {
    const idSet = new Set(ids);
    edges = edges.filter((e) => !idSet.has(e.a) && !idSet.has(e.b));
    nodes = nodes.filter((n) => !idSet.has(n.id));
    if (selected && idSet.has(selected.id)) { selected = null; closePanel(); }
    clearAreaSelection(); render(); applyView();
    showMsg(`${ids.length} esfera(s) excluída(s).`);
  }).catch((e) => showMsg('Erro ao excluir: ' + e.message));
};
stage.addEventListener('wheel', (ev) => { ev.preventDefault(); zoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.12 : .89); }, { passive: false });
function zoomAt(cx, cy, f) { const r = stage.getBoundingClientRect(); const wx = (cx-r.left-view.x)/view.s, wy = (cy-r.top-view.y)/view.s;
  view.s = Math.max(MINZOOM, Math.min(2.6, view.s*f)); view.x = cx-r.left-wx*view.s; view.y = cy-r.top-wy*view.s; applyView(); }
window.zoom = (f) => { zoomAt(W/2, H/2, f); render(); };
window.resetView = () => { view = { x: W/2, y: H/2, s: 1 }; applyView(); render(); };
window.setTool = (t) => { if (!isGM) return; tool = t; linkSrc = null;
  document.querySelectorAll('.tool[data-tool]').forEach((b) => { const on = b.dataset.tool === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  stage.classList.toggle('adding', t === 'add');
  stage.classList.toggle('areaing', t === 'area'); gridPolarEl.classList.toggle('show', t === 'add'); if (t !== 'add') hideSnapMark(); };
addEventListener('keydown', (ev) => {
  if (ev.key === 'Delete' && isGM) { if (selected) deleteSelected(); else if (selectedEdge) deleteSelectedEdge(); }
  if (ev.key === 'Escape') { linkSrc = null; if (areaSelection.size) clearAreaSelection(); deselectEdge(); closePanel(); closeViewer(); }
});
addEventListener('resize', () => { W = innerWidth; H = innerHeight; fxResize(); resizeStage(); render(); });

/* ---------- teclado (canvas) ----------
   Cada esfera tinha sua própria parada real de Tab (um <g tabindex="0">) — não dá pra ter um
   elemento de DOM focável por esfera sem reintroduzir o custo de DOM que o canvas existe pra
   eliminar. Trocado (confirmado com o usuário) por um proxy único: Tab alcança a árvore UMA vez,
   as setas navegam entre esferas, Enter/Espaço ativa a esfera focada — mesma ação de um clique.
   O foco é rastreado pelo ID da esfera (não pelo índice no array): um índice guardado ficava
   apontando pra outra esfera, silenciosamente, sempre que alguma esfera ANTES dela no array era
   excluída (o array inteiro desliza, o índice não sabe disso) — quem estava navegando por teclado
   podia ativar a esfera errada sem perceber. ID é estável mesmo com o array mudando de tamanho. */
function focusedNode() { return focusedNodeId != null ? nodeById.get(focusedNodeId) || null : null; }
// índice ATUAL da esfera focada dentro de "nodes" — recalculado on-demand (nunca guardado), pra
// nunca dessincronizar do array de verdade. Se a esfera focada foi excluída, cai pra -1 e a
// próxima seta simplesmente foca a primeira/última esfera, em vez de mirar em outra por engano.
function focusedNodeArrayIndex() { return focusedNodeId != null ? nodes.findIndex((n) => n.id === focusedNodeId) : -1; }
function updateFocusProxyLabel() {
  const n = focusedNode();
  focusProxy.setAttribute('aria-label', n ? nodeAriaLabel(n) : 'Árvore de esferas — use as setas do teclado para navegar entre as esferas');
}
// se a navegação por seta levar o foco pra fora da área visível, ajusta a câmera o suficiente pra
// trazer a esfera de volta pra dentro da tela — senão navegar por seta numa árvore grande seria "às cegas"
function ensureNodeVisible(n) {
  const pad = 80, sx = n.x * view.s + view.x, sy = n.y * view.s + view.y;
  let dx = 0, dy = 0;
  if (sx < pad) dx = pad - sx; else if (sx > W - pad) dx = (W - pad) - sx;
  if (sy < pad) dy = pad - sy; else if (sy > H - pad) dy = (H - pad) - sy;
  if (dx || dy) { view.x += dx; view.y += dy; applyView(); }
}
function focusNodeByIndex(i) {
  if (!nodes.length) return;
  const idx = ((i % nodes.length) + nodes.length) % nodes.length;
  const n = nodes[idx];
  focusedNodeId = n.id;
  updateFocusProxyLabel();
  ensureNodeVisible(n);
  if (liveRegion) liveRegion.textContent = nodeAriaLabel(n);
}
focusProxy?.addEventListener('focus', () => {
  if (focusedNodeId == null && nodes.length) { const idx = nodes.findIndex((n) => n.kind === 'core'); focusNodeByIndex(idx >= 0 ? idx : 0); }
  else updateFocusProxyLabel();
});
focusProxy?.addEventListener('keydown', (ev) => {
  if (!nodes.length) return;
  const cur = focusedNodeArrayIndex();
  if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { ev.preventDefault(); focusNodeByIndex(cur + 1); }
  else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { ev.preventDefault(); focusNodeByIndex(cur - 1); }
  else if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    const n = focusedNode(); if (!n) return;
    if (tool === 'link' && isGM) handleLink(n); else selectNode(n);
  }
});

// mede a altura real da .arvore-toolbar (pode quebrar em 2-3 linhas dependendo da largura) e
// publica como custom property pro .epanel (editor/viewer/lote) nunca ficar embaixo dela
function updateEpanelOffset() {
  const toolsEl = $('tools');
  if (!isGM || !toolsEl || getComputedStyle(toolsEl).display === 'none') {
    document.documentElement.style.setProperty('--toolbar-bottom', '64px');
    return;
  }
  const bottom = toolsEl.getBoundingClientRect().bottom;
  document.documentElement.style.setProperty('--toolbar-bottom', Math.round(bottom + 8) + 'px');
}
new ResizeObserver(updateEpanelOffset).observe($('tools'));
addEventListener('resize', updateEpanelOffset);
})();
