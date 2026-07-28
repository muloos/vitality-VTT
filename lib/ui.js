// ============================================================
// UI compartilhada — guias de uso (botão "?" flutuante + modal)
// ============================================================

const GUIDES = {
  home: {
    title: 'Guia · Vitality VTT',
    intro: 'O Vitality é uma mesa virtual onde você cria o próprio sistema de RPG e joga com seus amigos. O fluxo é simples:',
    steps: [
      ['Crie um sistema', 'Na aba Sistemas, monte as regras do seu jogo: status (HP, Força…), fórmulas, classes/subclasses, árvores de habilidade e itens.'],
      ['Crie uma mesa', 'Na aba Mesas, escolha o sistema e dê um nome. Você vira o Mestre e recebe um código de convite.'],
      ['Convide os jogadores', 'Compartilhe o código da mesa. Quem entrar com ele vira Jogador e monta a ficha usando o seu sistema.'],
      ['Biblioteca de itens', 'Em Meus Itens você guarda itens reutilizáveis. Dentro de um sistema, eles podem ser copiados e adaptados sem alterar o original.'],
    ],
    tips: [
      'Seu nome fica no canto superior direito — clique nele para mudar.',
      'A mesa mostra no topo qual sistema ela usa.',
      'Tudo salva automaticamente no banco.',
    ],
  },
  sistema: {
    title: 'Guia · Construtor de Sistema',
    intro: 'Aqui você monta as regras do seu RPG. Ordem recomendada:',
    steps: [
      ['Status', 'Crie os atributos do jogo. Base = o jogador preenche; Calculado = resolvido por fórmula usando os "nomes na fórmula" (ex.: ATAQUE = FORCA*5). Valide com o botão Testar.'],
      ['Classes', 'Crie classes e subclasses e defina os status base de cada uma — eles pré-preenchem a ficha do jogador.'],
      ['Árvores', 'Crie árvores de habilidade, atribua às classes/subclasses e clique em "Acessar árvore" para desenhar as esferas no editor visual.'],
      ['Itens', 'Adicione itens da sua biblioteca (viram cópias independentes do sistema) ou crie novos, com modificadores ligados aos status.'],
    ],
    tips: [
      'Tudo salva automaticamente conforme você edita.',
      'As mesas que usam este sistema puxam essas regras na hora.',
    ],
  },
  mesa: {
    title: 'Guia · Mesa',
    intro: 'A mesa é onde a campanha acontece. O que você vê depende do seu papel (Mestre ou Jogador):',
    steps: [
      ['Convide', 'Mestre: compartilhe o código no topo da tela — cada jogador entra com ele pela tela inicial.'],
      ['Jogadores (Mestre)', 'Veja as fichas dos jogadores (as anotações deles são privadas), remova jogadores, renomeie ou exclua a mesa.'],
      ['Sistema', 'Consulte os status, classes, árvores e itens que esta mesa usa — tudo vem do sistema escolhido na criação.'],
      ['Ficha (Jogador)', 'Preencha a identidade, escolha classe/subclasse (os status base entram sozinhos) e os status calculados são resolvidos automaticamente.'],
      ['Inventário e Anotações', 'Sua mochila de itens e suas notas privadas — o Mestre não lê as anotações.'],
    ],
    tips: [
      'O código da mesa fica sempre visível para o Mestre no topo.',
      'Role dados a qualquer momento pelo painel de rolagens no canto inferior direito — o histórico abre ancorado na parte de baixo da tela.',
      'A barra fixa embaixo é o player de música da mesa: toca igual pra todo mundo. Só o Mestre comanda (play/pausa, trocar de faixa, buscar e montar a fila) — o Jogador só ouve e ajusta o próprio volume.',
    ],
  },
  arvore: {
    title: 'Guia · Editor de Árvore',
    intro: 'Desenhe a árvore de habilidades do seu sistema — cada esfera é uma habilidade.',
    steps: [
      ['Ferramentas', 'Selecionar move e edita esferas · Esfera cria uma nova ao clicar no mapa · Conectar liga duas esferas (clique na primeira, depois na segunda).'],
      ['Editar esfera', 'Com Selecionar, clique numa esfera: o painel abre com nome, tipo (Passiva/Ativa/Núcleo), via, custo em pontos e descrição.'],
      ['Navegação', 'Arraste o fundo para mover o mapa; roda do mouse ou botões +/− dão zoom; o botão de recentralizar volta a visão ao meio.'],
      ['Cor de fundo', 'Escolha uma cor no seletor de cor e clique em Aplicar — ela fica salva para esta árvore.'],
    ],
    tips: [
      'Delete apaga a esfera selecionada; Esc fecha o painel.',
      'Tudo salva automaticamente no banco — cada árvore é independente.',
    ],
  },
};

export function mountHelp(page, opts = {}) {
  const g = GUIDES[page];
  if (!g) return;
  const fab = document.createElement('button');
  fab.className = 'help-fab';
  fab.textContent = '?';
  fab.title = 'Guia: como usar esta tela';
  fab.setAttribute('aria-label', 'Abrir guia de uso');
  if (opts.bottom) fab.style.bottom = opts.bottom;
  fab.onclick = () => openGuide(g);
  document.body.appendChild(fab);
}

// Mesmo guia do botão "?" flutuante, disparado pelo item "Ajuda ou suporte" do menu de conta —
// um só conteúdo por página (GUIDES), dois jeitos de abrir.
export function openHelpGuide(page) {
  const g = GUIDES[page];
  if (g) openGuide(g);
}

// ============================================================
// Alternador de tema claro/escuro (botão flutuante à esquerda + item "Tema" no menu de conta)
// ============================================================
export function getTheme() {
  try { return localStorage.getItem('vt_theme') || 'dark'; } catch (e) { return 'dark'; }
}
export function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('vt_theme', t); } catch (e) {}
}
const ICON_SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>';
// repinta o fab flutuante (se existir na página) — chamado tanto pelo próprio botão quanto pelo
// item do menu de conta, então os dois nunca ficam com o ícone dessincronizado entre si
function paintThemeFab() {
  const btn = document.querySelector('.theme-fab');
  if (!btn) return;
  const dark = getTheme() !== 'light';
  btn.innerHTML = dark ? ICON_SUN : ICON_MOON;
  btn.title = dark ? 'Mudar para tema claro' : 'Mudar para tema escuro';
  btn.setAttribute('aria-label', btn.title);
}
export function toggleTheme() {
  applyTheme(getTheme() === 'light' ? 'dark' : 'light');
  paintThemeFab();
}
export function mountThemeToggle() {
  const btn = document.createElement('button');
  btn.className = 'theme-fab';
  btn.onclick = () => toggleTheme();
  document.body.appendChild(btn);
  paintThemeFab();
  return btn;
}

// ============================================================
// Modais do menu de conta — Meu perfil / Configurações
// (recebem os dados e um callback de salvar; quem chama decide como persistir via db.js,
// mantendo este arquivo sem depender das tabelas — mesma separação do resto do app)
// ============================================================
const escHtml = (s) => (s == null ? '' : String(s)).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

function openFormModal({ title, bodyHtml, onSubmit, submitLabel = 'Salvar' }) {
  const trigger = document.activeElement;
  const w = document.createElement('div');
  w.className = 'ui-modal';
  w.setAttribute('role', 'dialog');
  w.setAttribute('aria-modal', 'true');
  w.innerHTML = `<div class="box guide">
    <div class="ghead"><h3>${title}</h3><button class="x" aria-label="Fechar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <form>
      ${bodyHtml}
      <p class="fld-err" id="fm-err"></p>
      <div class="full actions" style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
        <button type="submit" class="btn go auto" id="fm-submit"><span class="spin"></span>${submitLabel}</button>
      </div>
    </form>
  </div>`;
  const closeBtn = w.querySelector('.x');
  const close = () => { w.remove(); document.removeEventListener('keydown', onEsc); if (trigger && trigger.focus) trigger.focus(); };
  const onEsc = (e) => { if (e.key === 'Escape') close(); };
  w.addEventListener('click', (e) => { if (e.target === w) close(); });
  closeBtn.onclick = close;
  document.addEventListener('keydown', onEsc);
  const form = w.querySelector('form');
  const submitBtn = w.querySelector('#fm-submit');
  const errEl = w.querySelector('#fm-err');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.remove('show'); errEl.textContent = '';
    submitBtn.classList.add('loading'); submitBtn.disabled = true;
    try { await onSubmit(w, close); }
    catch (err) { errEl.textContent = err?.message || 'Não deu certo, tenta de novo.'; errEl.classList.add('show'); }
    finally { submitBtn.classList.remove('loading'); submitBtn.disabled = false; }
  });
  document.body.appendChild(w);
  w.querySelector('input, textarea, select')?.focus();
  return w;
}

// "Meu perfil" — ver e mudar dados pessoais (hoje: e-mail, só leitura, e o nome de exibição)
export function openProfileModal({ email, displayName, onSave }) {
  openFormModal({
    title: '<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.8-4 3.6-6.5 7.5-6.5s6.7 2.5 7.5 6.5"/></svg></span>Meu perfil',
    bodyHtml: `
      <div class="fld"><label>E-mail</label><input value="${escHtml(email || '—')}" disabled></div>
      <div class="fld"><label>Nome de exibição</label><input id="pm-name" value="${escHtml(displayName || '')}" maxlength="60" required></div>`,
    onSubmit: async (w, close) => {
      const name = w.querySelector('#pm-name').value.trim();
      if (!name) throw new Error('O nome não pode ficar em branco.');
      await onSave(name);
      close();
    },
  });
}

// "Configurações" — hoje: trocar a senha da conta (o resto das configurações é por mesa/sistema,
// e já fica dentro de cada um deles)
export function openSettingsModal({ onChangePassword }) {
  openFormModal({
    title: '<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.6M12 17.9v2.6M20.5 12h-2.6M6.1 12H3.5M17.7 6.3l-1.8 1.8M8.1 15.9l-1.8 1.8M17.7 17.7l-1.8-1.8M8.1 8.1 6.3 6.3"/></svg></span>Configurações',
    submitLabel: 'Trocar senha',
    bodyHtml: `
      <p style="font-family:var(--mono);font-size:11px;color:var(--ink-faint);line-height:1.6;margin:0 0 14px">
        Ajustes desta conta. Configurações de uma mesa ou sistema específico ficam dentro deles mesmos.</p>
      <div class="fld"><label>Nova senha</label><input id="sm-pw1" type="password" minlength="6" autocomplete="new-password" required></div>
      <div class="fld"><label>Confirmar nova senha</label><input id="sm-pw2" type="password" minlength="6" autocomplete="new-password" required></div>`,
    onSubmit: async (w, close) => {
      const pw1 = w.querySelector('#sm-pw1').value;
      const pw2 = w.querySelector('#sm-pw2').value;
      if (pw1.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      if (pw1 !== pw2) throw new Error('As senhas não são iguais.');
      await onChangePassword(pw1);
      close();
    },
  });
}

export function openGuide(g) {
  const trigger = document.activeElement;
  const w = document.createElement('div');
  w.className = 'ui-modal';
  w.setAttribute('role', 'dialog');
  w.setAttribute('aria-modal', 'true');
  w.setAttribute('aria-labelledby', 'guide-title');
  w.innerHTML = `<div class="box guide">
    <div class="ghead"><h3 id="guide-title">${g.title}</h3><button class="x" aria-label="Fechar">×</button></div>
    ${g.intro ? `<p class="gintro">${g.intro}</p>` : ''}
    ${g.steps.map((s, i) => `<div class="gstep"><div class="n">${i + 1}</div><div><b>${s[0]}</b><p>${s[1]}</p></div></div>`).join('')}
    ${g.tips && g.tips.length ? `<div class="gtips"><b>Dicas</b><ul>${g.tips.map((t) => `<li>${t}</li>`).join('')}</ul></div>` : ''}
  </div>`;
  const closeBtn = w.querySelector('.x');
  const close = () => { w.remove(); document.removeEventListener('keydown', onEsc); if (trigger && trigger.focus) trigger.focus(); };
  const onEsc = (e) => { if (e.key === 'Escape') close(); };
  w.addEventListener('click', (e) => { if (e.target === w) close(); });
  closeBtn.onclick = close;
  document.addEventListener('keydown', onEsc);
  document.body.appendChild(w);
  closeBtn.focus();
}
