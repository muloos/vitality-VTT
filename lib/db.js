// ============================================================
// Camada de dados — toda conversa com o Supabase passa por aqui.
// Mantém o resto do app (login, lobby, árvore) desacoplado das tabelas.
// ============================================================
import { supabase } from './supabase.js';

// ---------- AUTH ----------

export async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || email.split('@')[0] } },
  });
  if (error) throw error;
  return data; // data.session pode vir null se a confirmação de email estiver ligada
}

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle(redirectTo) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw error;
  return data; // dispara o redirect; o retorno cai em redirectTo
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Dispara o email de recuperação de senha do Supabase; o link volta pra `redirectTo` com um
// token de recovery na URL, que vira uma sessão temporária (só serve pra chamar updatePassword).
export async function resetPasswordForEmail(email, redirectTo) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((event, session) => cb(session, event));
}

// Garante uma sessão real; se não houver, manda pro login (preservando a página de retorno).
// Páginas protegidas chamam isso no boot: `const session = await db.requireSession(); if (!session) return;`
export async function requireSession() {
  const session = await getSession();
  if (session) return session;
  const next = encodeURIComponent(location.pathname + location.search);
  location.href = `login.html?next=${next}`;
  return null;
}

// ---------- STORAGE (imagens de itens e mesas) ----------
// Sobe uma imagem pro bucket público `media` e devolve a URL pública.
// `folder` organiza os arquivos (ex.: 'items', 'campaigns').
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB (bate com o limite do bucket)

export async function uploadImage(file, folder = 'misc') {
  const user = await getUser();
  if (!user) throw new Error('Sem sessão.');
  if (!file) throw new Error('Nenhum arquivo selecionado.');
  if (!file.type || !file.type.startsWith('image/')) throw new Error('O arquivo precisa ser uma imagem.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Imagem muito grande (máx. 3 MB).');
  const ext = ((file.name || '').split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const rnd = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${folder}/${user.id}/${rnd}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}

// Sobe um arquivo de lore (imagem, PDF ou texto) pro bucket `lore` — background do personagem.
const MAX_LORE_BYTES = 10 * 1024 * 1024; // 10 MB (bate com o limite do bucket)
const LORE_MIME_OK = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain'];

export async function uploadLoreFile(file, folder = 'misc') {
  const user = await getUser();
  if (!user) throw new Error('Sem sessão.');
  if (!file) throw new Error('Nenhum arquivo selecionado.');
  if (!LORE_MIME_OK.includes(file.type)) throw new Error('Tipo de arquivo não aceito (use imagem, PDF ou texto).');
  if (file.size > MAX_LORE_BYTES) throw new Error('Arquivo muito grande (máx. 10 MB).');
  const ext = ((file.name || '').split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const rnd = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${folder}/${user.id}/${rnd}.${ext}`;
  const { error } = await supabase.storage.from('lore').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('lore').getPublicUrl(path);
  return { name: file.name || 'arquivo', url: data.publicUrl };
}

// ---------- PROFILE ----------

export async function getMyProfile() {
  const user = await getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateDisplayName(name) {
  const user = await getUser();
  if (!user) throw new Error('Sem sessão.');
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Troca a senha da conta logada (usada pelo menu Configurações). O Supabase já exige uma sessão
// válida pra isso, então não precisa reconfirmar a senha atual.
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ---------- CAMPAIGNS (mesas) ----------

export async function listMyCampaigns() {
  // Traz minhas mesas já com o MEU papel (gm/player) em cada uma.
  // Filtra por user_id: como Mestre, o RLS me deixa ver TODAS as associações
  // da minha mesa (pro roster), então sem este filtro o lobby duplicaria a mesa.
  const user = await getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('memberships')
    .select('role, created_at, campaign:campaigns(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  // ordena pela mesa com atividade mais recente (última rolagem/mensagem, ver last_active_at),
  // não pela ordem em que o usuário entrou nela — com várias mesas, a que rolou sessão ontem some
  // no meio da lista se a ordem for só "quando entrei"
  return (data || [])
    .filter((m) => m.campaign)
    .map((m) => ({ ...m.campaign, role: m.role }))
    .sort((a, b) => new Date(b.last_active_at || b.created_at) - new Date(a.last_active_at || a.created_at));
}

export async function getCampaign(campaignId) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Meu papel nesta mesa: 'gm' | 'player' | null
export async function getMyRole(campaignId) {
  const user = await getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}

// Lista de membros da mesa (para o roster do Mestre)
export async function listMembers(campaignId) {
  const { data, error } = await supabase
    .from('memberships')
    .select('role, user_id, created_at, profile:profiles(display_name)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
// nomes/donos das fichas da mesa inteira — só o Mestre enxerga todas (RLS de characters: jogador só
// vê a própria); usado pra montar o painel de iniciativa (Fase 9), que precisa saber quem tem ficha
// pronta pra oferecer um "Definir/Rolar" por participante, sem depender de N idas ao banco.
export async function listCampaignCharacters(campaignId) {
  const { data, error } = await supabase.from('characters').select('id, user_id, name').eq('campaign_id', campaignId);
  if (error) throw error;
  return data;
}

export async function leaveCampaign(campaignId) {
  const user = await getUser();
  if (!user) throw new Error('Sem sessão.');
  // apaga a própria ficha nesta mesa (cascata: atributos/itens/notas) e sai
  await supabase.from('characters').delete().eq('campaign_id', campaignId).eq('user_id', user.id);
  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id);
  if (error) throw error;
}

export async function createCampaign(name, systemId = null) {
  const user = await getUser();
  if (!user) throw new Error('Sem sessão.');
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({ name, gm_id: user.id, system_id: systemId })
    .select()
    .single();
  if (error) throw error;
  // o criador entra como GM
  const { error: mErr } = await supabase
    .from('memberships')
    .insert({ campaign_id: campaign.id, user_id: user.id, role: 'gm' });
  if (mErr) throw mErr;
  return campaign;
}

// Puxa TODO o conteúdo de um sistema de uma vez (pra a mesa usar).
export async function getSystemBundle(systemId) {
  if (!systemId) return null;
  const [system, stats, classes, trees, items, proficiencies, levels, levelTrees, equipmentSlots, currencies, origins, damageTypes, conditions] = await Promise.all([
    getSystem(systemId), listStats(systemId), listClasses(systemId),
    listSystemTrees(systemId), listSystemItems(systemId), listProficiencies(systemId), listSystemLevels(systemId), listSystemLevelTrees(systemId),
    listEquipmentSlots(systemId), listCurrencies(systemId), listOrigins(systemId), listDamageTypes(systemId), listConditions(systemId),
  ]);
  return { system, stats, classes, trees, items, proficiencies, levels, levelTrees, equipmentSlots, currencies, origins, damageTypes, conditions };
}

// GM não é dono do sistema da mesa: clona um sistema independente pra ele. Idempotente — se o GM
// já for dono, a função no servidor não faz nada e devolve o próprio system_id de volta.
export async function forkSystemForCampaign(campaignId, systemId) {
  const { data, error } = await supabase.rpc('fork_system_for_campaign', {
    p_campaign_id: campaignId, p_system_id: systemId,
  });
  if (error) throw error;
  return { newSystemId: data.new_system_id, treeMap: data.tree_map || {} };
}

export async function joinCampaignByCode(code) {
  // Via RPC SECURITY DEFINER: o jogador ainda não enxerga a mesa pelo RLS,
  // então a função do servidor faz a busca pelo código e cria a associação.
  const { data, error } = await supabase.rpc('join_campaign_by_code', { p_code: code });
  if (error) {
    if (/inválido/i.test(error.message)) throw new Error('Código de mesa inválido.');
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Código de mesa inválido.');
  return row; // { id, name }
}

// ---------- SKILL TREES (definição — do Mestre) ----------

export async function listTrees(campaignId) {
  const { data, error } = await supabase
    .from('skill_trees')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createTree(campaignId, name, defaultPoints = 6) {
  const { data, error } = await supabase
    .from('skill_trees')
    .insert({ campaign_id: campaignId, name, default_points: defaultPoints })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Carrega a DEFINIÇÃO completa de uma árvore: { tree, nodes, edges }
export async function loadTree(treeId) {
  const [treeRes, nodesRes, edgesRes] = await Promise.all([
    supabase.from('skill_trees').select('*').eq('id', treeId).single(),
    supabase.from('tree_nodes').select('*').eq('tree_id', treeId),
    supabase.from('tree_edges').select('*').eq('tree_id', treeId),
  ]);
  if (treeRes.error) throw treeRes.error;
  if (nodesRes.error) throw nodesRes.error;
  if (edgesRes.error) throw edgesRes.error;
  return { tree: treeRes.data, nodes: nodesRes.data, edges: edgesRes.data };
}

// CRUD granular de nós/arestas — mapeia direto pras ações do Mestre
// (patch / addPoints / handleLink / deleteSelected) na etapa 3.
export async function insertNode(treeId, node) {
  const { data, error } = await supabase
    .from('tree_nodes')
    .insert({ tree_id: treeId, ...node })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNode(nodeId, patch) {
  const { data, error } = await supabase
    .from('tree_nodes')
    .update(patch)
    .eq('id', nodeId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNode(nodeId) {
  const { error } = await supabase.from('tree_nodes').delete().eq('id', nodeId);
  if (error) throw error;
}

export async function insertEdge(treeId, a, b) {
  const { data, error } = await supabase
    .from('tree_edges')
    .insert({ tree_id: treeId, a, b })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEdge(edgeId) {
  const { error } = await supabase.from('tree_edges').delete().eq('id', edgeId);
  if (error) throw error;
}

export async function setTreeDefaultPoints(treeId, points) {
  const { data, error } = await supabase
    .from('skill_trees')
    .update({ default_points: points })
    .eq('id', treeId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- PROGRESS (por Jogador — separado da definição) ----------

// Carrega o progresso do usuário atual numa árvore: { progress, unlocks }
export async function loadProgress(treeId, userId) {
  const uid = userId ?? (await getUser())?.id;
  if (!uid) throw new Error('Sem sessão.');
  const [progRes, unlockRes] = await Promise.all([
    supabase.from('player_progress').select('*').eq('tree_id', treeId).eq('user_id', uid).maybeSingle(),
    supabase.from('player_unlocks').select('node_id').eq('tree_id', treeId).eq('user_id', uid),
  ]);
  if (progRes.error) throw progRes.error;
  if (unlockRes.error) throw unlockRes.error;
  return { progress: progRes.data, unlocks: unlockRes.data.map((u) => u.node_id) };
}

// Garante uma linha de progresso (cria com os pontos padrão da árvore se faltar)
export async function ensureProgress(treeId, totalPoints) {
  const user = await getUser();
  if (!user) throw new Error('Sem sessão.');
  const { data, error } = await supabase
    .from('player_progress')
    .upsert(
      { tree_id: treeId, user_id: user.id, total_points: totalPoints },
      { onConflict: 'tree_id,user_id', ignoreDuplicates: true }
    )
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setTotalPoints(treeId, userId, totalPoints) {
  const { data, error } = await supabase
    .from('player_progress')
    .update({ total_points: totalPoints })
    .eq('tree_id', treeId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// NOTA: estes dois ainda gravam direto. A regra de pré-requisito/pontos/
// conectividade será revalidada no servidor (RPC SECURITY DEFINER) na etapa 4.
export async function addUnlock(treeId, nodeId) {
  const user = await getUser();
  if (!user) throw new Error('Sem sessão.');
  const { error } = await supabase
    .from('player_unlocks')
    .insert({ tree_id: treeId, user_id: user.id, node_id: nodeId });
  if (error && error.code !== '23505') throw error;
}

export async function removeUnlock(treeId, nodeId) {
  const user = await getUser();
  if (!user) throw new Error('Sem sessão.');
  const { error } = await supabase
    .from('player_unlocks')
    .delete()
    .eq('tree_id', treeId)
    .eq('user_id', user.id)
    .eq('node_id', nodeId);
  if (error) throw error;
}

// ---------- MESA ATTRIBUTES (template de status — do Mestre) ----------

export async function listAttributes(campaignId) {
  const { data, error } = await supabase
    .from('mesa_attributes')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createAttribute(campaignId, attr) {
  const { data, error } = await supabase
    .from('mesa_attributes')
    .insert({ campaign_id: campaignId, ...attr })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAttribute(id, patch) {
  const { data, error } = await supabase
    .from('mesa_attributes')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAttribute(id) {
  const { error } = await supabase.from('mesa_attributes').delete().eq('id', id);
  if (error) throw error;
}

// ---------- CHARACTER (ficha do Jogador) ----------

export async function getMyCharacter(campaignId) {
  const user = await getUser();
  if (!user) throw new Error('Sem sessão.');
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Garante que o Jogador tem uma ficha nesta mesa (cria vazia se faltar)
export async function ensureCharacter(campaignId) {
  const existing = await getMyCharacter(campaignId);
  if (existing) return existing;
  const user = await getUser();
  const { data, error } = await supabase
    .from('characters')
    .insert({ campaign_id: campaignId, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCharacter(characterId, patch) {
  const { data, error } = await supabase
    .from('characters')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', characterId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Ficha completa: { character, attributes, values {attr_id: value}, systemId }
// Se a mesa usa um sistema, os "attributes" são os STATUS do sistema (com kind/formula/formula_key).
export async function loadSheet(campaignId) {
  const character = await ensureCharacter(campaignId);
  const campaign = await getCampaign(campaignId);
  let attributes;
  if (campaign?.system_id) {
    const stats = await listStats(campaign.system_id);
    attributes = stats.map((s) => ({
      id: s.id, name: s.name, kind: s.kind, formula: s.formula,
      formula_key: s.formula_key, default_value: s.default_value, is_resource: s.is_resource, is_skill: s.is_skill, color: s.color,
    }));
  } else {
    const { data, error } = await supabase.from('mesa_attributes').select('*').eq('campaign_id', campaignId)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (error) throw error;
    attributes = data;
  }
  const [{ data: vals, error: vErr }, resources, proficiencies] = await Promise.all([
    supabase.from('character_attributes').select('attribute_id, value').eq('character_id', character.id),
    getCharacterResources(character.id),
    getCharacterProficiencies(character.id),
  ]);
  if (vErr) throw vErr;
  const values = {};
  (vals || []).forEach((v) => { values[v.attribute_id] = v.value; });
  return { character, attributes, values, resources, proficiencies, systemId: campaign?.system_id || null };
}

export async function setCharacterAttribute(characterId, attributeId, value) {
  // is_class_default:false — uma escrita direta (jogador editando manualmente, ou o Mestre via
  // gmAdjustStat) sempre marca o status como "customizado", pra nunca mais ser sobrescrito
  // por um resync automático dos padrões de classe/subclasse (ver applyClassDefaults).
  const { error } = await supabase
    .from('character_attributes')
    .upsert({ character_id: characterId, attribute_id: attributeId, value, is_class_default: false },
            { onConflict: 'character_id,attribute_id' });
  if (error) throw error;
}

// Gasta 1 ponto de status (pool concedida pelo Mestre) pra subir +1 num status secundário.
// Validado no servidor via RPC — o jogador não escreve esse status diretamente (RLS bloqueia).
export async function spendStatPoint(characterId, statId) {
  const { data, error } = await supabase.rpc('spend_stat_point', { p_character_id: characterId, p_stat_id: statId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row; // { new_value, remaining_points }
}
// preenche os "Status base" de uma classe/subclasse na ficha do personagem — via RPC (não um
// insert direto), já que status base só podem mudar através de uma função validada no servidor
// (a mesma regra que já valia pra spend_stat_point). devolve quantos atributos foram preenchidos.
export async function applyClassDefaults(characterId, classId) {
  const { data, error } = await supabase.rpc('apply_class_defaults', { p_character_id: characterId, p_class_id: classId });
  if (error) throw error;
  return data ?? 0;
}

// ---------- INVENTORY (mochila) ----------

export async function listInventory(characterId) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('character_id', characterId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addItem(characterId, item) {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({ character_id: characterId, ...item })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateItem(id, patch) {
  const { data, error } = await supabase
    .from('inventory_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Copia um item do SISTEMA da mesa (com modificadores) pra dentro da mochila do jogador —
// cópia independente, editar depois não afeta o item do sistema.
export async function addInventoryItemFromSystem(characterId, systemItemId) {
  const { data: src, error: e1 } = await supabase.from('system_items').select('*').eq('id', systemItemId).single();
  if (e1) throw e1;
  return addItem(characterId, {
    name: src.name, description: src.description, modifiers: src.modifiers || [], qty: 1,
    weapon_damage: src.weapon_damage || null, damage_scale: src.damage_scale || null,
    protection: src.protection ?? null, protection_scale: src.protection_scale || null,
    equipment_type: src.equipment_type || null, image_url: src.image_url || null,
    rarity: src.rarity || null, weight: src.weight ?? null, consume_effects: src.consume_effects || null,
  });
}

// ---------- SLOTS DE EQUIPAMENTO (tela "paper doll" 100% customizável pelo Mestre) ----------
export async function listEquipmentSlots(systemId) {
  const { data, error } = await supabase.from('system_equipment_slots').select('*').eq('system_id', systemId)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
export async function createEquipmentSlot(systemId, slot) {
  const { data, error } = await supabase.from('system_equipment_slots').insert({ system_id: systemId, ...slot }).select().single();
  if (error) throw error;
  return data;
}
export async function updateEquipmentSlot(id, patch) {
  const { data, error } = await supabase.from('system_equipment_slots').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteEquipmentSlot(id) {
  // desequipa qualquer item que esteja nesse slot antes de apagar — sem isso o item ficava
  // marcado equipped:true com um equipped_slot_id órfão, continuando a somar bônus pra sempre
  const { error: unequipErr } = await supabase.from('inventory_items')
    .update({ equipped: false, equipped_slot_id: null }).eq('equipped_slot_id', id);
  if (unequipErr) throw unequipErr;
  const { error } = await supabase.from('system_equipment_slots').delete().eq('id', id);
  if (error) throw error;
}
// equipa um item num slot — se já tiver outro item nesse slot (pra esse mesmo personagem), tira
// ele de lá primeiro (troca automática, igual Diablo/Minecraft: soltar por cima substitui).
export async function equipToSlot(characterId, itemId, slotId) {
  const { error: e1 } = await supabase.from('inventory_items')
    .update({ equipped: false, equipped_slot_id: null })
    .eq('character_id', characterId).eq('equipped_slot_id', slotId).neq('id', itemId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('inventory_items')
    .update({ equipped: true, equipped_slot_id: slotId }).eq('id', itemId);
  if (e2) throw e2;
}
export async function unequipFromSlot(itemId) {
  const { error } = await supabase.from('inventory_items').update({ equipped: false, equipped_slot_id: null }).eq('id', itemId);
  if (error) throw error;
}

// ---------- PEDIDOS DE ITEM (o jogador não pega item do sistema direto — só solicita; o Mestre
// aprova/nega, e só na aprovação o item de fato entra na mochila) ----------
export async function requestItem(characterId, campaignId, systemItemId) {
  const { data, error } = await supabase.from('item_requests')
    .insert({ character_id: characterId, campaign_id: campaignId, system_item_id: systemItemId })
    .select().single();
  if (error) throw error;
  return data;
}
// pedidos do próprio jogador (qualquer status) — pra ele acompanhar o que já pediu
export async function listMyItemRequests(characterId) {
  const { data, error } = await supabase.from('item_requests')
    .select('*, system_items(name)').eq('character_id', characterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
export async function cancelItemRequest(id) {
  const { error } = await supabase.from('item_requests').delete().eq('id', id);
  if (error) throw error;
}
// pedidos pendentes de toda a mesa (visão do Mestre) — já traz nome do personagem e do item junto
export async function listPendingItemRequests(campaignId) {
  const { data, error } = await supabase.from('item_requests')
    .select('*, system_items(name), characters(name)')
    .eq('campaign_id', campaignId).eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
// aprovar concede o item de verdade (reaproveita addInventoryItemFromSystem — agora permitido pra
// GM via RLS) antes de marcar o pedido como resolvido; negar só marca, sem tocar na mochila.
export async function resolveItemRequest(id, approve) {
  if (approve) {
    const { data: req, error: e1 } = await supabase.from('item_requests').select('*').eq('id', id).single();
    if (e1) throw e1;
    await addInventoryItemFromSystem(req.character_id, req.system_item_id);
  }
  const { error } = await supabase.from('item_requests')
    .update({ status: approve ? 'approved' : 'denied', resolved_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
export function subscribeItemRequests(campaignId, onChange) {
  const ch = supabase.channel('ireq:' + campaignId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'item_requests', filter: `campaign_id=eq.${campaignId}` },
      () => { try { onChange(); } catch (_) {} })
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (_) {} };
}

export async function deleteItem(id) {
  const { error } = await supabase.from('inventory_items').delete().eq('id', id);
  if (error) throw error;
}

// ---------- NOTES (anotações privadas) ----------

export async function listNotes(characterId) {
  const { data, error } = await supabase
    .from('character_notes')
    .select('*')
    .eq('character_id', characterId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addNote(characterId, note) {
  const { data, error } = await supabase
    .from('character_notes')
    .insert({ character_id: characterId, ...note })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(id, patch) {
  const { data, error } = await supabase
    .from('character_notes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(id) {
  const { error } = await supabase.from('character_notes').delete().eq('id', id);
  if (error) throw error;
}

// ---------- GUIA RÁPIDO (fórmulas pessoais do jogador — privado, nem o Mestre vê) ----------

export async function listCharacterFormulas(characterId) {
  const { data, error } = await supabase.from('character_formulas').select('*').eq('character_id', characterId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
export async function addCharacterFormula(characterId, name, terms) {
  const { data, error } = await supabase.from('character_formulas')
    .insert({ character_id: characterId, name, terms }).select().single();
  if (error) throw error;
  return data;
}
export async function deleteCharacterFormula(id) {
  const { error } = await supabase.from('character_formulas').delete().eq('id', id);
  if (error) throw error;
}

// ---------- GERENCIAMENTO DA MESA (Mestre) ----------

// Mestre lê a ficha de um jogador (sem anotações — elas são privadas via RLS).
export async function loadPlayerSheet(campaignId, userId) {
  const campaign = await getCampaign(campaignId);
  const { data: character, error } = await supabase
    .from('characters')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;

  let attributes;
  if (campaign?.system_id) {
    const stats = await listStats(campaign.system_id);
    attributes = stats.map((s) => ({
      id: s.id, name: s.name, kind: s.kind, formula: s.formula,
      formula_key: s.formula_key, default_value: s.default_value, is_resource: s.is_resource, is_skill: s.is_skill, color: s.color,
    }));
  } else {
    const { data, error: aErr } = await supabase.from('mesa_attributes').select('*').eq('campaign_id', campaignId)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (aErr) throw aErr;
    attributes = data;
  }

  const valsP = character
    ? supabase.from('character_attributes').select('attribute_id, value').eq('character_id', character.id)
    : Promise.resolve({ data: [] });
  const invP = character
    ? supabase.from('inventory_items').select('*').eq('character_id', character.id)
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    : Promise.resolve({ data: [] });
  const resP = character ? getCharacterResources(character.id) : Promise.resolve({});
  const profP = character ? getCharacterProficiencies(character.id) : Promise.resolve({});
  const [valsRes, invRes, resources, proficiencies] = await Promise.all([valsP, invP, resP, profP]);
  if (valsRes.error) throw valsRes.error;
  const values = {};
  (valsRes.data || []).forEach((v) => { values[v.attribute_id] = v.value; });
  return { character, attributes, values, resources, proficiencies, inventory: invRes.data || [], systemId: campaign?.system_id || null };
}

// Mestre remove um jogador da mesa (apaga a ficha dele aqui e o vínculo).
export async function removeMember(campaignId, userId) {
  await supabase.from('characters').delete().eq('campaign_id', campaignId).eq('user_id', userId);
  const { error } = await supabase.from('memberships').delete()
    .eq('campaign_id', campaignId).eq('user_id', userId);
  if (error) throw error;
}

export async function renameCampaign(campaignId, name) {
  const { data, error } = await supabase.from('campaigns')
    .update({ name }).eq('id', campaignId).select().single();
  if (error) throw error;
  return data;
}

// Atualiza campos gerais da mesa (ex.: image_url — foto de perfil da mesa).
export async function updateCampaign(campaignId, patch) {
  const { data, error } = await supabase.from('campaigns')
    .update(patch).eq('id', campaignId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCampaign(campaignId) {
  const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
  if (error) throw error;
}

// ============================================================
// NPCS / MONSTROS — ficha enxuta que só o Mestre cria/edita (sem user_id, sem proficiências,
// sem inventário próprio nesta versão: o Mestre sempre age em nome do NPC no combate).
// npc_attributes/npc_resources espelham character_attributes/character_resources.
// ============================================================
export async function listNpcs(campaignId) {
  const { data, error } = await supabase.from('npcs').select('*').eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
export async function createNpc(campaignId, npc) {
  const { data, error } = await supabase.from('npcs').insert({ campaign_id: campaignId, ...npc }).select().single();
  if (error) throw error;
  return data;
}
export async function updateNpc(id, patch) {
  const { data, error } = await supabase.from('npcs').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteNpc(id) {
  const { error } = await supabase.from('npcs').delete().eq('id', id);
  if (error) throw error;
}
export async function getNpcAttributesValues(npcId) {
  const { data, error } = await supabase.from('npc_attributes').select('attribute_id, value').eq('npc_id', npcId);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.attribute_id] = r.value; });
  return map;
}
export async function setNpcAttribute(npcId, attributeId, value) {
  const { error } = await supabase.from('npc_attributes')
    .upsert({ npc_id: npcId, attribute_id: attributeId, value }, { onConflict: 'npc_id,attribute_id' });
  if (error) throw error;
}
export async function getNpcResources(npcId) {
  const { data, error } = await supabase.from('npc_resources').select('stat_id, current').eq('npc_id', npcId);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.stat_id] = r.current; });
  return map;
}
export async function setNpcResource(npcId, statId, current) {
  const { error } = await supabase.from('npc_resources')
    .upsert({ npc_id: npcId, stat_id: statId, current }, { onConflict: 'npc_id,stat_id' });
  if (error) throw error;
}

// ---------- ITENS (biblioteca do criador) ----------

// só os itens do próprio usuário — precisa do filtro explícito porque a RLS de leitura
// de "items" é aberta pra qualquer autenticado (ver listStoreItems), não mais dono-only.
export async function listItems() {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// "loja" — itens publicados por outros usuários (a biblioteca pessoal já tem sua própria aba)
export async function listStoreItems() {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .neq('owner_id', user.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(200); // teto de segurança — a loja ainda não tem paginação; sem isso a lista cresce sem limite
  if (error) throw error;
  return data;
}

// ids favoritados pelo usuário atual — usado pra marcar o coração em qualquer grade de itens
export async function listFavoriteItemIds() {
  const user = await getUser();
  if (!user) return new Set();
  const { data, error } = await supabase.from('item_favorites').select('item_id').eq('user_id', user.id);
  if (error) throw error;
  return new Set((data || []).map((r) => r.item_id));
}

// itens completos favoritados pelo usuário atual — alimenta a aba Favoritos
export async function listFavoriteItems() {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const { data, error } = await supabase
    .from('item_favorites')
    .select('item_id, items(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => r.items).filter(Boolean);
}

export async function addFavorite(itemId) {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const { error } = await supabase.from('item_favorites').insert({ user_id: user.id, item_id: itemId });
  if (error) throw error;
}

export async function removeFavorite(itemId) {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const { error } = await supabase.from('item_favorites').delete().eq('user_id', user.id).eq('item_id', itemId);
  if (error) throw error;
}

export async function createItem(item) {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const profile = await getMyProfile();
  const { data, error } = await supabase
    .from('items')
    .insert({ owner_id: user.id, creator_name: profile?.display_name || null, ...item })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateItem2(id, patch) {
  const { data, error } = await supabase
    .from('items')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteItem2(id) {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
}

// ---------- PACOTES DE ITENS ----------
// agrupa vários itens da biblioteca do criador num pacote só, pra importar todos de uma vez
// dentro de um sistema (em vez de copiar item por item)

export async function listItemPackages() {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const { data, error } = await supabase
    .from('item_packages')
    .select('*, item_package_items(item_id)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((p) => ({ ...p, item_ids: (p.item_package_items || []).map((r) => r.item_id) }));
}

export async function createItemPackage(name, itemIds = []) {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const { data, error } = await supabase.from('item_packages').insert({ owner_id: user.id, name }).select().single();
  if (error) throw error;
  if (itemIds.length) {
    const { error: e2 } = await supabase.from('item_package_items')
      .insert(itemIds.map((item_id, i) => ({ package_id: data.id, item_id, sort_order: i })));
    if (e2) throw e2;
  }
  return data;
}

export async function updateItemPackage(id, patch) {
  const { error } = await supabase.from('item_packages').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteItemPackage(id) {
  const { error } = await supabase.from('item_packages').delete().eq('id', id);
  if (error) throw error;
}

// substitui a lista de itens do pacote pela informada (mais simples que calcular diff add/remove)
export async function setItemPackageItems(packageId, itemIds) {
  const { error: e1 } = await supabase.from('item_package_items').delete().eq('package_id', packageId);
  if (e1) throw e1;
  if (itemIds.length) {
    const { error: e2 } = await supabase.from('item_package_items')
      .insert(itemIds.map((item_id, i) => ({ package_id: packageId, item_id, sort_order: i })));
    if (e2) throw e2;
  }
}

// copia todos os itens de um pacote pra dentro de um sistema de uma vez (reaproveita a mesma
// cópia usada em "Copiar p/ sistema" item a item); devolve quantos foram importados
export async function importPackageToSystem(systemId, packageId) {
  const { data: rows, error: e1 } = await supabase.from('item_package_items').select('item_id').eq('package_id', packageId);
  if (e1) throw e1;
  const itemIds = (rows || []).map((r) => r.item_id);
  if (!itemIds.length) return 0;
  const { data: existing, error: e2 } = await supabase.from('system_items').select('source_item_id').eq('system_id', systemId);
  if (e2) throw e2;
  const already = new Set((existing || []).map((r) => r.source_item_id).filter(Boolean));
  const toImport = itemIds.filter((id) => !already.has(id));
  for (const id of toImport) await addSystemItemFromLibrary(systemId, id);
  return toImport.length;
}

// ============================================================
// SISTEMAS de RPG (construtor da conta)
// ============================================================
// só os sistemas do próprio usuário — filtro explícito porque a RLS de leitura de "systems"
// é aberta pra sistemas publicados de qualquer autenticado (ver listStoreSystems), não mais dono-only.
export async function listSystems() {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const { data, error } = await supabase.from('systems').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
export async function createSystem(name) {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const profile = await getMyProfile();
  const { data, error } = await supabase.from('systems')
    .insert({ owner_id: user.id, creator_name: profile?.display_name || null, name }).select().single();
  if (error) throw error;
  return data;
}
export async function getSystem(id) {
  const { data, error } = await supabase.from('systems').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
export async function updateSystem(id, patch) {
  const { data, error } = await supabase.from('systems')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteSystem(id) {
  const { error } = await supabase.from('systems').delete().eq('id', id);
  if (error) throw error;
}

// "loja" de sistemas — sistemas publicados por outros usuários
export async function listStoreSystems() {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const { data, error } = await supabase.from('systems').select('*')
    .neq('owner_id', user.id).eq('is_published', true).order('created_at', { ascending: false })
    .limit(200); // mesmo teto de segurança de listStoreItems
  if (error) throw error;
  return data;
}

export async function listFavoriteSystemIds() {
  const user = await getUser();
  if (!user) return new Set();
  const { data, error } = await supabase.from('system_favorites').select('system_id').eq('user_id', user.id);
  if (error) throw error;
  return new Set((data || []).map((r) => r.system_id));
}

export async function listFavoriteSystems() {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const { data, error } = await supabase.from('system_favorites')
    .select('system_id, systems(*)').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => r.systems).filter(Boolean);
}

export async function addFavoriteSystem(systemId) {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const { error } = await supabase.from('system_favorites').insert({ user_id: user.id, system_id: systemId });
  if (error) throw error;
}

export async function removeFavoriteSystem(systemId) {
  const user = await getUser();
  if (!user) throw new Error('Sem identidade.');
  const { error } = await supabase.from('system_favorites').delete().eq('user_id', user.id).eq('system_id', systemId);
  if (error) throw error;
}

// ---- Status do sistema ----
export async function listStats(systemId) {
  const { data, error } = await supabase.from('system_stats').select('*').eq('system_id', systemId)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
export async function createStat(systemId, stat) {
  const { data, error } = await supabase.from('system_stats').insert({ system_id: systemId, ...stat }).select().single();
  if (error) throw error;
  return data;
}
export async function updateStat(id, patch) {
  const { data, error } = await supabase.from('system_stats').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteStat(id) {
  const { error } = await supabase.from('system_stats').delete().eq('id', id);
  if (error) throw error;
}

// ---- Classes / subclasses ----
export async function listClasses(systemId) {
  const { data, error } = await supabase.from('system_classes').select('*').eq('system_id', systemId)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return data; // a UI monta a hierarquia via parent_id
}
export async function createClass(systemId, cls) {
  const { data, error } = await supabase.from('system_classes').insert({ system_id: systemId, ...cls }).select().single();
  if (error) throw error;
  return data;
}
export async function updateClass(id, patch) {
  const { data, error } = await supabase.from('system_classes').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteClass(id) {
  const { error } = await supabase.from('system_classes').delete().eq('id', id);
  if (error) throw error;
}
export async function getClassBaseStats(classId) {
  const { data, error } = await supabase.from('class_base_stats').select('stat_id, value').eq('class_id', classId);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.stat_id] = r.value; });
  return map;
}
export async function setClassBaseStat(classId, statId, value) {
  const { error } = await supabase.from('class_base_stats')
    .upsert({ class_id: classId, stat_id: statId, value }, { onConflict: 'class_id,stat_id' });
  if (error) throw error;
}

// ---- Proficiências do sistema (binário: tem ou não tem — arma, idioma, ferramenta...) ----
export async function listProficiencies(systemId) {
  const { data, error } = await supabase.from('system_proficiencies').select('*').eq('system_id', systemId)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
export async function createProficiency(systemId, prof) {
  const { data, error } = await supabase.from('system_proficiencies').insert({ system_id: systemId, ...prof }).select().single();
  if (error) throw error;
  return data;
}
export async function updateProficiency(id, patch) {
  const { data, error } = await supabase.from('system_proficiencies').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteProficiency(id) {
  const { error } = await supabase.from('system_proficiencies').delete().eq('id', id);
  if (error) throw error;
}

// Moedas do sistema — um item tem um preço numa moeda só (não múltiplos preços simultâneos).
// Mesmo CRUD de system_proficiencies.
export async function listCurrencies(systemId) {
  const { data, error } = await supabase.from('system_currencies').select('*').eq('system_id', systemId)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
export async function createCurrency(systemId, currency) {
  const { data, error } = await supabase.from('system_currencies').insert({ system_id: systemId, ...currency }).select().single();
  if (error) throw error;
  return data;
}
export async function updateCurrency(id, patch) {
  const { data, error } = await supabase.from('system_currencies').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteCurrency(id) {
  const { error } = await supabase.from('system_currencies').delete().eq('id', id);
  if (error) throw error;
}

// Reordena uma lista qualquer regravando sort_order em sequência (0,1,2...) na ordem dada — usado
// pelo arrastar-para-reordenar em Status/Perícias/Proficiências/Classes/Itens (sistema.html).
export async function reorderRows(table, orderedIds) {
  const results = await Promise.all(orderedIds.map((id, i) => supabase.from(table).update({ sort_order: i }).eq('id', id)));
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
}
// concessão por classe/subclasse — mesma ideia do "Status base", só que liga/desliga (sem valor)
export async function getClassProficiencies(classId) {
  const { data, error } = await supabase.from('class_proficiencies').select('proficiency_id').eq('class_id', classId);
  if (error) throw error;
  return new Set((data || []).map((r) => r.proficiency_id));
}
export async function setClassProficiency(classId, proficiencyId, granted) {
  if (granted) {
    const { error } = await supabase.from('class_proficiencies')
      .upsert({ class_id: classId, proficiency_id: proficiencyId }, { onConflict: 'class_id,proficiency_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('class_proficiencies').delete()
      .eq('class_id', classId).eq('proficiency_id', proficiencyId);
    if (error) throw error;
  }
}
// concessão por personagem — só o Mestre grava direto (RLS); is_class_default:false trava contra
// o resync automático da classe sobrescrever uma decisão manual (mesmo espírito de setCharacterAttribute)
export async function getCharacterProficiencies(characterId) {
  const { data, error } = await supabase.from('character_proficiencies').select('proficiency_id, granted').eq('character_id', characterId);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.proficiency_id] = r.granted; });
  return map;
}
export async function gmSetProficiency(characterId, proficiencyId, granted) {
  const { error } = await supabase.from('character_proficiencies')
    .upsert({ character_id: characterId, proficiency_id: proficiencyId, granted, is_class_default: false },
            { onConflict: 'character_id,proficiency_id' });
  if (error) throw error;
}
// preenche as proficiências concedidas pela classe/subclasse — via RPC, mesmo padrão de applyClassDefaults
export async function applyClassProficiencies(characterId, classId) {
  const { data, error } = await supabase.rpc('apply_class_proficiencies', { p_character_id: characterId, p_class_id: classId });
  if (error) throw error;
  return data ?? 0;
}

// ---- Traços automáticos de classe (level null = sempre ativo) — modifiers na mesma forma
// {stat_id, amount} que system_tree_nodes.modifiers, pra alimentar o mesmo pipeline de bônus e
// de habilidades desbloqueadas (ver getSkillBonuses/getUnlockedAbilities mais abaixo) ----
export async function listClassFeatures(classId) {
  const { data, error } = await supabase.from('class_features').select('*').eq('class_id', classId)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
export async function createClassFeature(classId, feature) {
  const { data, error } = await supabase.from('class_features').insert({ class_id: classId, ...feature }).select().single();
  if (error) throw error;
  return data;
}
export async function updateClassFeature(id, patch) {
  const { data, error } = await supabase.from('class_features').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteClassFeature(id) {
  const { error } = await supabase.from('class_features').delete().eq('id', id);
  if (error) throw error;
}

// ---- Traços automáticos de raça — mesma forma exata de class_features, só trocando o eixo
// (origin_id em vez de class_id). Ver getSkillBonuses/getUnlockedAbilities mais abaixo. ----
export async function listOriginFeatures(originId) {
  const { data, error } = await supabase.from('origin_features').select('*').eq('origin_id', originId)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
export async function createOriginFeature(originId, feature) {
  const { data, error } = await supabase.from('origin_features').insert({ origin_id: originId, ...feature }).select().single();
  if (error) throw error;
  return data;
}
export async function updateOriginFeature(id, patch) {
  const { data, error } = await supabase.from('origin_features').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteOriginFeature(id) {
  const { error } = await supabase.from('origin_features').delete().eq('id', id);
  if (error) throw error;
}

// ---- Item inicial da classe — concedido uma única vez (characters.starting_items_granted_at),
// nunca no resync repetido, por isso é uma RPC separada em vez de reaproveitar applyClassDefaults ----
export async function listClassStartingItems(classId) {
  const { data, error } = await supabase.from('class_starting_items').select('*, system_items(name)').eq('class_id', classId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
export async function addClassStartingItem(classId, systemItemId, qty = 1) {
  const { data, error } = await supabase.from('class_starting_items')
    .insert({ class_id: classId, system_item_id: systemItemId, qty }).select().single();
  if (error) throw error;
  return data;
}
export async function updateClassStartingItem(id, patch) {
  const { data, error } = await supabase.from('class_starting_items').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function removeClassStartingItem(id) {
  const { error } = await supabase.from('class_starting_items').delete().eq('id', id);
  if (error) throw error;
}
export async function applyClassStartingItems(characterId, classId) {
  const { data, error } = await supabase.rpc('apply_class_starting_items', { p_character_id: characterId, p_class_id: classId });
  if (error) throw error;
  return data ?? 0;
}

// ---- Escolha de proficiência com orçamento — pool distinto das proficiências sempre concedidas
// (class_proficiencies); o jogador escolhe até system_classes.proficiency_choice_count dele, uma
// única vez (characters.proficiency_choices_made_at) ----
export async function getClassProficiencyChoices(classId) {
  const { data, error } = await supabase.from('class_proficiency_choices').select('proficiency_id').eq('class_id', classId);
  if (error) throw error;
  return new Set((data || []).map((r) => r.proficiency_id));
}
export async function setClassProficiencyChoice(classId, proficiencyId, inPool) {
  if (inPool) {
    const { error } = await supabase.from('class_proficiency_choices')
      .upsert({ class_id: classId, proficiency_id: proficiencyId }, { onConflict: 'class_id,proficiency_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('class_proficiency_choices').delete()
      .eq('class_id', classId).eq('proficiency_id', proficiencyId);
    if (error) throw error;
  }
}
export async function chooseClassProficiencies(characterId, classId, proficiencyIds) {
  const { data, error } = await supabase.rpc('choose_class_proficiencies',
    { p_character_id: characterId, p_class_id: classId, p_proficiency_ids: proficiencyIds });
  if (error) throw error;
  return data ?? 0;
}

// ---------- RAÇA / ESPÉCIE / ORIGEM (mesmo padrão auto-referente de system_classes: raiz = raça,
// parent_id = variação — ex.: "Híbrido" → "Gato"/"Lobo"/"Raposa") ----------
export async function listOrigins(systemId) {
  const { data, error } = await supabase.from('system_origins').select('*').eq('system_id', systemId)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
export async function createOrigin(systemId, origin) {
  const { data, error } = await supabase.from('system_origins').insert({ system_id: systemId, ...origin }).select().single();
  if (error) throw error;
  return data;
}
export async function updateOrigin(id, patch) {
  const { data, error } = await supabase.from('system_origins').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteOrigin(id) {
  const { error } = await supabase.from('system_origins').delete().eq('id', id);
  if (error) throw error;
}
export async function getOriginBaseStats(originId) {
  const { data, error } = await supabase.from('origin_base_stats').select('stat_id, value').eq('origin_id', originId);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.stat_id] = r.value; });
  return map;
}
export async function setOriginBaseStat(originId, statId, value) {
  const { error } = await supabase.from('origin_base_stats')
    .upsert({ origin_id: originId, stat_id: statId, value }, { onConflict: 'origin_id,stat_id' });
  if (error) throw error;
}
export async function getOriginProficiencies(originId) {
  const { data, error } = await supabase.from('origin_proficiencies').select('proficiency_id').eq('origin_id', originId);
  if (error) throw error;
  return new Set((data || []).map((r) => r.proficiency_id));
}
export async function setOriginProficiency(originId, proficiencyId, granted) {
  if (granted) {
    const { error } = await supabase.from('origin_proficiencies')
      .upsert({ origin_id: originId, proficiency_id: proficiencyId }, { onConflict: 'origin_id,proficiency_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('origin_proficiencies').delete()
      .eq('origin_id', originId).eq('proficiency_id', proficiencyId);
    if (error) throw error;
  }
}
export async function applyOriginDefaults(characterId, originId) {
  const { data, error } = await supabase.rpc('apply_origin_defaults', { p_character_id: characterId, p_origin_id: originId });
  if (error) throw error;
  return data ?? 0;
}
export async function applyOriginProficiencies(characterId, originId) {
  const { data, error } = await supabase.rpc('apply_origin_proficiencies', { p_character_id: characterId, p_origin_id: originId });
  if (error) throw error;
  return data ?? 0;
}

// ---------- TIPOS DE DANO — catálogo livre por sistema (mesmo espírito das `vias` de árvore) ----------
export async function listDamageTypes(systemId) {
  const { data, error } = await supabase.from('system_damage_types').select('*').eq('system_id', systemId)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
export async function createDamageType(systemId, damageType) {
  const { data, error } = await supabase.from('system_damage_types').insert({ system_id: systemId, ...damageType }).select().single();
  if (error) throw error;
  return data;
}
export async function updateDamageType(id, patch) {
  const { data, error } = await supabase.from('system_damage_types').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteDamageType(id) {
  const { error } = await supabase.from('system_damage_types').delete().eq('id', id);
  if (error) throw error;
}
// Resistência/vulnerabilidade/imunidade — SEMPRE configurada manualmente pelo criador (nunca
// derivada automaticamente); mesmo padrão de célula que class_base_stats/origin_base_stats, só que
// a "célula" aqui é {mode, value} em vez de um valor solto.
export async function getClassDamageModifiers(classId) {
  const { data, error } = await supabase.from('class_damage_modifiers').select('*').eq('class_id', classId);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.damage_type_id] = { mode: r.mode, value: r.value }; });
  return map;
}
export async function setClassDamageModifier(classId, damageTypeId, mode, value) {
  if (!mode) {
    const { error } = await supabase.from('class_damage_modifiers').delete().eq('class_id', classId).eq('damage_type_id', damageTypeId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('class_damage_modifiers')
    .upsert({ class_id: classId, damage_type_id: damageTypeId, mode, value }, { onConflict: 'class_id,damage_type_id' });
  if (error) throw error;
}
export async function getOriginDamageModifiers(originId) {
  const { data, error } = await supabase.from('origin_damage_modifiers').select('*').eq('origin_id', originId);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.damage_type_id] = { mode: r.mode, value: r.value }; });
  return map;
}
export async function setOriginDamageModifier(originId, damageTypeId, mode, value) {
  if (!mode) {
    const { error } = await supabase.from('origin_damage_modifiers').delete().eq('origin_id', originId).eq('damage_type_id', damageTypeId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('origin_damage_modifiers')
    .upsert({ origin_id: originId, damage_type_id: damageTypeId, mode, value }, { onConflict: 'origin_id,damage_type_id' });
  if (error) throw error;
}

// ---------- CONDIÇÕES / EFEITOS DE STATUS — catálogo + aplicação manual, sem duração/turno ----------
export async function listConditions(systemId) {
  const { data, error } = await supabase.from('system_conditions').select('*').eq('system_id', systemId)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
export async function createCondition(systemId, condition) {
  const { data, error } = await supabase.from('system_conditions').insert({ system_id: systemId, ...condition }).select().single();
  if (error) throw error;
  return data;
}
export async function updateCondition(id, patch) {
  const { data, error } = await supabase.from('system_conditions').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteCondition(id) {
  // tira a condição de qualquer personagem que a tenha ativa antes de apagar do catálogo — sem
  // isso character_conditions ficava com uma linha órfã apontando pra uma condição inexistente
  const { error: charErr } = await supabase.from('character_conditions').delete().eq('condition_id', id);
  if (charErr) throw charErr;
  const { error } = await supabase.from('system_conditions').delete().eq('id', id);
  if (error) throw error;
}
// presença = ativa — sem coluna de duração/expiração de propósito (o Mestre aplica/remove na mão)
export async function getCharacterConditions(characterId) {
  const { data, error } = await supabase.from('character_conditions').select('condition_id').eq('character_id', characterId);
  if (error) throw error;
  return new Set((data || []).map((r) => r.condition_id));
}
export async function applyCondition(characterId, conditionId) {
  const user = await getUser(); if (!user) throw new Error('Sem sessão.');
  const { error } = await supabase.from('character_conditions')
    .upsert({ character_id: characterId, condition_id: conditionId, applied_by: user.id }, { onConflict: 'character_id,condition_id' });
  if (error) throw error;
}
export async function removeCondition(characterId, conditionId) {
  const { error } = await supabase.from('character_conditions').delete().eq('character_id', characterId).eq('condition_id', conditionId);
  if (error) throw error;
}

// ---------- CONSUMÍVEIS — efeito de uso direto na mochila ----------
// soma cada {stat_id, amount} do item (mesmo formato dos modificadores de nó de árvore) direto no
// RECURSO atual do personagem via setCharacterResource (já gravável pelo próprio jogador — não
// precisa de RPC nova) e decrementa/remove o item. Só afeta RECURSOS de verdade — um efeito
// apontando pra um status calculado ou base é ignorado silenciosamente, não tem "atual" pra somar.
export async function consumeInventoryItem(characterId, itemId) {
  const { data: item, error: e1 } = await supabase.from('inventory_items').select('*').eq('id', itemId).single();
  if (e1) throw e1;
  const effects = item.consume_effects || [];
  if (effects.length) {
    const current = await getCharacterResources(characterId);
    for (const eff of effects) {
      if (!eff.stat_id) continue;
      const base = Number(current[eff.stat_id]) || 0;
      await setCharacterResource(characterId, eff.stat_id, Math.max(0, base + (Number(eff.amount) || 0)));
    }
  }
  if ((item.qty || 1) > 1) await updateItem(itemId, { qty: item.qty - 1 });
  else await deleteItem(itemId);
  return effects;
}

// ---- Progressão de nível (pontos de status concedidos automaticamente ao subir de nível) ----
export async function listSystemLevels(systemId) {
  const { data, error } = await supabase.from('system_levels').select('*').eq('system_id', systemId).order('level', { ascending: true });
  if (error) throw error;
  return data;
}
export async function setSystemLevel(systemId, level, statPoints) {
  const { error } = await supabase.from('system_levels')
    .upsert({ system_id: systemId, level, stat_points: statPoints }, { onConflict: 'system_id,level' });
  if (error) throw error;
}
export async function deleteSystemLevel(systemId, level) {
  const { error } = await supabase.from('system_levels').delete().eq('system_id', systemId).eq('level', level);
  if (error) throw error;
}
// concessão por árvore de habilidade — cada nível também pode dar pontos pra uma ou mais árvores
// do sistema, além dos pontos de status (um sistema pode ter várias árvores independentes).
export async function listSystemLevelTrees(systemId) {
  const { data, error } = await supabase.from('system_level_trees').select('*').eq('system_id', systemId);
  if (error) throw error;
  return data;
}
export async function setSystemLevelTree(systemId, level, treeId, points) {
  const { error } = await supabase.from('system_level_trees')
    .upsert({ system_id: systemId, level, tree_id: treeId, points }, { onConflict: 'system_id,level,tree_id' });
  if (error) throw error;
}
export async function deleteSystemLevelTree(systemId, level, treeId) {
  const { error } = await supabase.from('system_level_trees').delete().eq('system_id', systemId).eq('level', level).eq('tree_id', treeId);
  if (error) throw error;
}
// concede (via RPC) os pontos de status + pontos de árvore de todo nível entre o último já pago e
// o nível atual do personagem — nunca sobrescreve/retroage, só soma o que falta. Devolve
// {stat_points, tree_points} com quanto foi dado de cada.
export async function applyLevelRewards(characterId) {
  const { data, error } = await supabase.rpc('apply_level_rewards', { p_character_id: characterId });
  if (error) throw error;
  return data || { stat_points: 0, tree_points: 0 };
}

// ---- Árvores do sistema + atribuição a classes ----
export async function listSystemTrees(systemId) {
  const { data, error } = await supabase.from('system_skill_trees').select('*').eq('system_id', systemId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
export async function createSystemTree(systemId, name, gridShape) {
  const { data, error } = await supabase.from('system_skill_trees')
    .insert({ system_id: systemId, name, grid_shape: gridShape || 'octagon' }).select().single();
  if (error) throw error;
  return data;
}
export async function getSystemTree(id) {
  const { data, error } = await supabase.from('system_skill_trees').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
export async function updateSystemTree(id, patch) {
  const { data, error } = await supabase.from('system_skill_trees').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteSystemTree(id) {
  const { error } = await supabase.from('system_skill_trees').delete().eq('id', id);
  if (error) throw error;
}
export async function getTreeClasses(treeId) {
  const { data, error } = await supabase.from('skill_tree_classes').select('class_id').eq('tree_id', treeId);
  if (error) throw error;
  return (data || []).map((r) => r.class_id);
}
export async function assignTreeClass(treeId, classId) {
  const { error } = await supabase.from('skill_tree_classes').insert({ tree_id: treeId, class_id: classId });
  if (error && error.code !== '23505') throw error;
}
export async function unassignTreeClass(treeId, classId) {
  const { error } = await supabase.from('skill_tree_classes').delete().eq('tree_id', treeId).eq('class_id', classId);
  if (error) throw error;
}

// ---- Itens do sistema (CÓPIAS editáveis, independentes da biblioteca) ----
export async function listSystemItems(systemId) {
  const { data, error } = await supabase.from('system_items').select('*').eq('system_id', systemId)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
// Copia um item da biblioteca para dentro do sistema (cópia independente).
export async function addSystemItemFromLibrary(systemId, libraryItemId) {
  const { data: src, error: e1 } = await supabase.from('items').select('*').eq('id', libraryItemId).single();
  if (e1) throw e1;
  const { data, error } = await supabase.from('system_items').insert({
    system_id: systemId, source_item_id: src.id, name: src.name,
    category: src.category, rarity: src.rarity, description: src.description,
    modifiers: src.modifiers || [], image_url: src.image_url || null,
    weapon_damage: src.weapon_damage || null, protection: src.protection ?? null,
    equipment_type: src.equipment_type || null,
  }).select().single();
  if (error) throw error;
  return data;
}
export async function createSystemItem(systemId, item) {
  const { data, error } = await supabase.from('system_items').insert({ system_id: systemId, ...item }).select().single();
  if (error) throw error;
  return data;
}
export async function updateSystemItem(id, patch) {
  const { data, error } = await supabase.from('system_items')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteSystemItem(id) {
  const { error } = await supabase.from('system_items').delete().eq('id', id);
  if (error) throw error;
}

// ---- Editor de árvore do sistema (nós + arestas no banco) ----
// o PostgREST do Supabase devolve no máximo ~1000 linhas por chamada, mesmo sem LIMIT nenhum no
// select — uma árvore com mais de 1000 esferas OU mais de 1000 conexões vinha silenciosamente
// cortada, sem erro nenhum (confirmado testando com uma árvore sintética de ~2000 esferas: só as
// 1000 primeiras chegavam no editor). Pagina com .range() até uma página voltar mais curta que o
// tamanho pedido — sinal de que já chegou ao fim.
const TREE_PAGE_SIZE = 1000;
async function fetchAllPages(query) {
  let all = [], from = 0;
  for (;;) {
    const { data, error } = await query(from, from + TREE_PAGE_SIZE - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < TREE_PAGE_SIZE) return all;
    from += TREE_PAGE_SIZE;
  }
}
export async function loadSystemTree(treeId) {
  const [nodes, edges] = await Promise.all([
    fetchAllPages((from, to) => supabase.from('system_tree_nodes').select('*').eq('tree_id', treeId).range(from, to)),
    fetchAllPages((from, to) => supabase.from('system_tree_edges').select('*').eq('tree_id', treeId).range(from, to)),
  ]);
  return { nodes, edges };
}
export async function insertTreeNode(treeId, node) {
  const { data, error } = await supabase.from('system_tree_nodes').insert({ tree_id: treeId, ...node }).select().single();
  if (error) throw error;
  return data;
}
export async function updateTreeNode(id, patch) {
  const { data, error } = await supabase.from('system_tree_nodes').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteTreeNode(id) {
  const { error } = await supabase.from('system_tree_nodes').delete().eq('id', id);
  if (error) throw error;
}
export async function insertTreeEdge(treeId, a, b) {
  const { data, error } = await supabase.from('system_tree_edges').insert({ tree_id: treeId, a, b }).select().single();
  if (error && error.code !== '23505') { throw error; }
  return data;
}
export async function deleteTreeEdge(id) {
  const { error } = await supabase.from('system_tree_edges').delete().eq('id', id);
  if (error) throw error;
}

// ---------- progresso do jogador na árvore de esferas ----------
// RLS já filtra pra "minha linha OU eu sou mestre dessa árvore", então não precisa
// passar user_id nas leituras — o Supabase devolve só o que o usuário logado pode ver.
export async function getMyUnlocks(treeId) {
  const { data, error } = await supabase.from('system_player_unlocks').select('node_id').eq('tree_id', treeId);
  if (error) throw error;
  return new Set((data || []).map((r) => r.node_id));
}
// versão pro Mestre: quais esferas de UMA árvore um jogador específico já desbloqueou (filtra por
// user_id explicitamente, mesma razão de getTreePoints existir ao lado de getMyProgress — sem o
// filtro, o Mestre veria linhas de vários jogadores misturadas na mesma árvore).
export async function getPlayerUnlocks(treeId, userId) {
  const { data, error } = await supabase.from('system_player_unlocks').select('node_id').eq('tree_id', treeId).eq('user_id', userId);
  if (error) throw error;
  return new Set((data || []).map((r) => r.node_id));
}
export async function getMyProgress(treeId) {
  const { data, error } = await supabase.from('system_player_progress').select('total_points')
    .eq('tree_id', treeId).maybeSingle();
  if (error) throw error;
  return data?.total_points ?? 0;
}
// versão pro Mestre: pontos de um jogador específico numa árvore específica (filtra por
// user_id explicitamente, já que getMyProgress sozinho poderia bater em mais de uma linha
// quando quem chama é o Mestre, que enxerga a progressão de vários jogadores pela RLS).
export async function getTreePoints(treeId, userId) {
  const { data, error } = await supabase.from('system_player_progress').select('total_points')
    .eq('tree_id', treeId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.total_points ?? 0;
}
// valida conectividade + custo no servidor (RPC SECURITY DEFINER) — nunca grava direto na tabela
export async function unlockNode(nodeId) {
  const { error } = await supabase.rpc('unlock_tree_node', { p_node_id: nodeId });
  if (error) throw error;
}
// só o mestre (dono do sistema ou mestre de uma campanha que usa esse sistema) consegue —
// a RLS de system_player_progress recusa qualquer outro chamador.
export async function setTreePoints(treeId, userId, totalPoints) {
  const { error } = await supabase.from('system_player_progress')
    .upsert({ tree_id: treeId, user_id: userId, total_points: totalPoints }, { onConflict: 'tree_id,user_id' });
  if (error) throw error;
}
// resolve a classe (raiz) e subclasse do personagem de `userId` numa campanha — usado tanto pelos
// bônus de traço automático quanto pela lista de habilidades, pra não duplicar a busca duas vezes
async function resolveCharacterClassNodes(campaignId, userId, systemId) {
  const [classes, { data: character, error: cErr }] = await Promise.all([
    listClasses(systemId),
    supabase.from('characters').select('id, char_class, subclass, level').eq('campaign_id', campaignId).eq('user_id', userId).maybeSingle(),
  ]);
  if (cErr) throw cErr;
  if (!character?.char_class) return { character, nodes: [] };
  const cl = classes.find((x) => !x.parent_id && x.name === character.char_class) || null;
  const sub = (cl && character.subclass) ? classes.find((x) => x.parent_id === cl.id && x.name === character.subclass) || null : null;
  return { character, nodes: [cl, sub].filter(Boolean) };
}
// mesmo espírito de resolveCharacterClassNodes, pro eixo de Raça/Origem — lê
// origin_name/origin_variant_name (gravados por pickOrigin/pickOriginVariant em mesa.html)
async function resolveCharacterOriginNodes(campaignId, userId, systemId) {
  const [origins, { data: character, error: cErr }] = await Promise.all([
    listOrigins(systemId),
    supabase.from('characters').select('id, origin_name, origin_variant_name, level').eq('campaign_id', campaignId).eq('user_id', userId).maybeSingle(),
  ]);
  if (cErr) throw cErr;
  if (!character?.origin_name) return { character, nodes: [] };
  const o = origins.find((x) => !x.parent_id && x.name === character.origin_name) || null;
  const v = (o && character.origin_variant_name) ? origins.find((x) => x.parent_id === o.id && x.name === character.origin_variant_name) || null : null;
  return { character, nodes: [o, v].filter(Boolean) };
}
// soma os bônus de status de todas as esferas que `userId` já desbloqueou, em todas as
// árvores do sistema da campanha, mais os traços automáticos da classe/subclasse e da raça/
// variação escolhidas (mesma forma {stat_id,amount}) — usado pra aplicar automaticamente na
// ficha (mesa.html). `amount` sai CRU (string) — pode ser um número ("3") ou uma fórmula
// ("piso(nivel/2)"); quem avalia é resolveBonusAmounts() em mesa.html, que já tem nível e status
// do personagem em escopo (evalStatIn reaproveitado, ver mesa.html).
export async function getSkillBonuses(campaignId, userId) {
  const campaign = await getCampaign(campaignId);
  if (!campaign?.system_id) return [];
  const bonuses = [];
  const { data: trees, error: tErr } = await supabase.from('system_skill_trees').select('id').eq('system_id', campaign.system_id);
  if (tErr) throw tErr;
  const treeIds = (trees || []).map((t) => t.id);
  if (treeIds.length) {
    const { data: unlocks, error: uErr } = await supabase.from('system_player_unlocks')
      .select('node_id').eq('user_id', userId).in('tree_id', treeIds);
    if (uErr) throw uErr;
    const nodeIds = (unlocks || []).map((u) => u.node_id);
    if (nodeIds.length) {
      const { data: nodes, error: nErr } = await supabase.from('system_tree_nodes').select('id, name, modifiers').in('id', nodeIds);
      if (nErr) throw nErr;
      (nodes || []).forEach((n) => (n.modifiers || []).forEach((m) => {
        if (m.stat_id && String(m.amount ?? '').trim()) bonuses.push({ stat_id: m.stat_id, amount: String(m.amount).trim(), source_name: n.name || '(sem nome)' });
      }));
    }
  }
  const { character, nodes: classNodes } = await resolveCharacterClassNodes(campaignId, userId, campaign.system_id);
  if (classNodes.length) {
    const { data: features, error: fErr } = await supabase.from('class_features').select('*').in('class_id', classNodes.map((x) => x.id));
    if (fErr) throw fErr;
    (features || []).filter((f) => f.level == null || Number(f.level) <= Number(character?.level || 1))
      .forEach((f) => (f.modifiers || []).forEach((m) => {
        if (m.stat_id && String(m.amount ?? '').trim()) bonuses.push({ stat_id: m.stat_id, amount: String(m.amount).trim(), source_name: f.name || '(sem nome)' });
      }));
  }
  const { character: charForOrigin, nodes: originNodes } = await resolveCharacterOriginNodes(campaignId, userId, campaign.system_id);
  if (originNodes.length) {
    const { data: features, error: ofErr } = await supabase.from('origin_features').select('*').in('origin_id', originNodes.map((x) => x.id));
    if (ofErr) throw ofErr;
    (features || []).filter((f) => f.level == null || Number(f.level) <= Number(charForOrigin?.level || 1))
      .forEach((f) => (f.modifiers || []).forEach((m) => {
        if (m.stat_id && String(m.amount ?? '').trim()) bonuses.push({ stat_id: m.stat_id, amount: String(m.amount).trim(), source_name: f.name || '(sem nome)' });
      }));
  }
  return bonuses;
}
// lista completa de habilidades já desbloqueadas por `userId` em todas as árvores do sistema da
// campanha, mais os traços automáticos da classe/subclasse escolhida — usada pela aba
// "Habilidades" (jogador e Mestre, mesa.html). Diferente de getSkillBonuses (que só junta o
// EFEITO numérico com modificador de status), esta devolve a habilidade inteira
// (nome/tipo/via/descrição), incluindo o Núcleo de cada árvore mesmo sem nenhuma linha em
// system_player_unlocks (ele é sempre desbloqueado — mesma regra que isNodeUnlocked() já usa em
// arvore.js). O campo `source` em cada item ('arvore' | 'classe') é o gancho documentado pra somar
// outras fontes no futuro sem precisar mudar quem consome esta função.
export async function getUnlockedAbilities(campaignId, userId) {
  const campaign = await getCampaign(campaignId);
  if (!campaign?.system_id) return [];
  const trees = await listSystemTrees(campaign.system_id);
  const treeAbilities = trees.length ? (await Promise.all(trees.map(async (tree) => {
    const [{ nodes }, unlocked] = await Promise.all([loadSystemTree(tree.id), getPlayerUnlocks(tree.id, userId)]);
    const vias = (tree.vias && tree.vias.length) ? tree.vias : [{ key: 'neutral', name: 'Núcleo', color: '#e3c071' }];
    const viaByKey = (key) => vias.find((v) => v.key === key) || vias[0];
    return nodes.filter((n) => n.kind === 'core' || unlocked.has(n.id)).map((n) => {
      const via = viaByKey(n.fac);
      return { id: n.id, name: n.name, kind: n.kind, descr: n.descr, modifiers: n.modifiers || [],
        tree_id: tree.id, tree_name: tree.name, via_name: via.name, via_color: via.color, source: 'arvore' };
    });
  }))).flat() : [];

  const { character, nodes: classNodes } = await resolveCharacterClassNodes(campaignId, userId, campaign.system_id);
  let classAbilities = [];
  if (classNodes.length) {
    const { data: features, error: fErr } = await supabase.from('class_features').select('*').in('class_id', classNodes.map((x) => x.id));
    if (fErr) throw fErr;
    const byId = Object.fromEntries(classNodes.map((x) => [x.id, x]));
    classAbilities = (features || [])
      .filter((f) => f.level == null || Number(f.level) <= Number(character?.level || 1))
      .map((f) => { const via = byId[f.class_id];
        return { id: f.id, name: f.name, kind: 'passive', descr: f.description, modifiers: f.modifiers || [],
          tree_id: null, tree_name: 'Traços de Classe', via_name: via.name, via_color: via.color || '#7ee6dc', source: 'classe' }; });
  }

  const { character: charForOrigin, nodes: originNodes } = await resolveCharacterOriginNodes(campaignId, userId, campaign.system_id);
  let originAbilities = [];
  if (originNodes.length) {
    const { data: features, error: ofErr } = await supabase.from('origin_features').select('*').in('origin_id', originNodes.map((x) => x.id));
    if (ofErr) throw ofErr;
    const byId = Object.fromEntries(originNodes.map((x) => [x.id, x]));
    originAbilities = (features || [])
      .filter((f) => f.level == null || Number(f.level) <= Number(charForOrigin?.level || 1))
      .map((f) => { const via = byId[f.origin_id];
        return { id: f.id, name: f.name, kind: 'passive', descr: f.description, modifiers: f.modifiers || [],
          tree_id: null, tree_name: 'Traços de Raça', via_name: via.name, via_color: via.color || '#7ee6dc', source: 'raca' }; });
  }
  return [...treeAbilities, ...classAbilities, ...originAbilities];
}

// ============================================================
// ROLAGENS DE DADOS (log compartilhado + tempo real)
// ============================================================
export async function addRoll(campaignId, roll) {
  const user = await getUser(); if (!user) throw new Error('Sem sessão.');
  // roller_name mostra o personagem (nome de mesa), não a conta — quem chama passa
  // roll.rollerName quando existe personagem; sem isso (Mestre, que não tem ficha), cai pro
  // nome do perfil de conta mesmo, igual antes.
  const rollerName = roll.rollerName || (await getMyProfile())?.display_name || null;
  const { data, error } = await supabase.from('mesa_rolls').insert({
    campaign_id: campaignId, user_id: user.id, roller_name: rollerName,
    formula: roll.formula, detail: roll.detail, total: roll.total, is_private: !!roll.is_private,
  }).select().single();
  if (error) throw error;
  return data;
}
export async function listRolls(campaignId, limit = 40) {
  const { data, error } = await supabase.from('mesa_rolls').select('*').eq('campaign_id', campaignId)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}
// Assina inserts em tempo real; devolve uma função pra cancelar.
export function subscribeRolls(campaignId, onInsert) {
  const ch = supabase.channel('rolls:' + campaignId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mesa_rolls', filter: `campaign_id=eq.${campaignId}` },
      (payload) => { try { onInsert(payload.new); } catch (_) {} })
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (_) {} };
}

// ============================================================
// CHAT DA MESA (log compartilhado + tempo real) — mesmo padrão das rolagens
// ============================================================
export async function addMessage(campaignId, body) {
  const text = (body || '').trim(); if (!text) throw new Error('Escreva uma mensagem.');
  const user = await getUser(); if (!user) throw new Error('Sem sessão.');
  const profile = await getMyProfile();
  const { data, error } = await supabase.from('mesa_messages').insert({
    campaign_id: campaignId, user_id: user.id, sender_name: profile?.display_name || null, body: text,
  }).select().single();
  if (error) throw error;
  return data;
}
export async function listMessages(campaignId, limit = 60) {
  const { data, error } = await supabase.from('mesa_messages').select('*').eq('campaign_id', campaignId)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}
// Assina inserts em tempo real; devolve uma função pra cancelar.
export function subscribeMessages(campaignId, onInsert) {
  const ch = supabase.channel('chat:' + campaignId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mesa_messages', filter: `campaign_id=eq.${campaignId}` },
      (payload) => { try { onInsert(payload.new); } catch (_) {} })
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (_) {} };
}

// ============================================================
// RECURSOS DO PERSONAGEM (atual/máximo)
// ============================================================
export async function getCharacterResources(characterId) {
  const { data, error } = await supabase.from('character_resources').select('stat_id, current').eq('character_id', characterId);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.stat_id] = r.current; });
  return map;
}
export async function setCharacterResource(characterId, statId, current) {
  const { error } = await supabase.from('character_resources')
    .upsert({ character_id: characterId, stat_id: statId, current }, { onConflict: 'character_id,stat_id' });
  if (error) throw error;
}

// ============================================================
// PLAYER DE MÚSICA COMPARTILHADO DA MESA (YouTube) — só o Mestre
// comanda (RLS); todo mundo lê e escuta em tempo real pra tocar em sincronia.
// ============================================================
export async function getPlayerState(campaignId) {
  const { data, error } = await supabase.from('mesa_player_state').select('*').eq('campaign_id', campaignId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function setPlayerState(campaignId, patch) {
  const { data, error } = await supabase.from('mesa_player_state')
    .upsert({ campaign_id: campaignId, updated_at: new Date().toISOString(), ...patch }, { onConflict: 'campaign_id' })
    .select().single();
  if (error) throw error;
  return data;
}

// Assina mudanças de estado em tempo real; devolve uma função pra cancelar.
export function subscribePlayerState(campaignId, onChange) {
  const ch = supabase.channel('pstate:' + campaignId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mesa_player_state', filter: `campaign_id=eq.${campaignId}` },
      (payload) => { try { onChange(payload.new); } catch (_) {} })
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (_) {} };
}

// ============================================================
// INICIATIVA / COMBATE EM TEMPO REAL — mesa_combat_state é uma linha mutável por mesa (mesmo
// padrão de mesa_player_state, só o Mestre grava); mesa_initiative_entries é upsert por
// (campaign_id, participant_type, participant_ref) — cada participante tem sempre 1 linha
// "atual", nunca duplica quando rola de novo. A regra "quem inicia o combate age primeiro" NÃO
// mora aqui: é derivada no cliente (computeTurnOrder, mesa.html) a partir de combat_state.started_by.
// ============================================================
export async function getCombatState(campaignId) {
  const { data, error } = await supabase.from('mesa_combat_state').select('*').eq('campaign_id', campaignId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function setCombatState(campaignId, patch) {
  const { data, error } = await supabase.from('mesa_combat_state')
    .upsert({ campaign_id: campaignId, updated_at: new Date().toISOString(), ...patch }, { onConflict: 'campaign_id' })
    .select().single();
  if (error) throw error;
  return data;
}
export function subscribeCombatState(campaignId, onChange) {
  const ch = supabase.channel('combat:' + campaignId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mesa_combat_state', filter: `campaign_id=eq.${campaignId}` },
      (payload) => { try { onChange(payload.new); } catch (_) {} })
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (_) {} };
}
export async function listInitiativeEntries(campaignId) {
  const { data, error } = await supabase.from('mesa_initiative_entries').select('*').eq('campaign_id', campaignId);
  if (error) throw error;
  return data;
}
export async function setInitiativeEntry(campaignId, entry) {
  const { data, error } = await supabase.from('mesa_initiative_entries')
    .upsert({ campaign_id: campaignId, ...entry }, { onConflict: 'campaign_id,participant_type,participant_ref' })
    .select().single();
  if (error) throw error;
  return data;
}
// limpa a ordem anterior — chamado ao iniciar um combate novo, pra não misturar com a rodada passada
export async function clearInitiativeEntries(campaignId) {
  const { error } = await supabase.from('mesa_initiative_entries').delete().eq('campaign_id', campaignId);
  if (error) throw error;
}
export function subscribeInitiativeEntries(campaignId, onChange) {
  const ch = supabase.channel('initiative:' + campaignId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mesa_initiative_entries', filter: `campaign_id=eq.${campaignId}` },
      () => { try { onChange(); } catch (_) {} })
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (_) {} };
}

// Playlists salvas pelo Mestre pra acesso rápido no painel de música — mesmo padrão simples de
// listTrees/createTree (lista nomeada por mesa, sem junção com conteúdo pré-existente).
export async function listPlaylists(campaignId) {
  const { data, error } = await supabase
    .from('mesa_playlists')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createPlaylist(campaignId, { name, url, source }) {
  const { data, error } = await supabase
    .from('mesa_playlists')
    .insert({ campaign_id: campaignId, name, url, source })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlaylist(id) {
  const { error } = await supabase.from('mesa_playlists').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// TEMPO REAL DA FICHA/MOCHILA — pra ninguém precisar dar F5 quando outro
// cliente conectado (o próprio Mestre, ou o jogador em outra aba) muda algo.
// Mesmo padrão de canal das funções acima; aqui um canal só cobre tudo que
// forma "o estado ao vivo de um personagem" (ficha, recursos, itens, pedido
// de item, pontos de árvore) porque tudo isso já se atualiza junto na mesma
// tela (ficha/inventário). Reaproveitado tanto pelo próprio jogador quanto
// pela visão somente-leitura do Mestre (viewPlayer) — só troca o id.
// ============================================================
export function subscribeCharacterLive(characterId, userId, onChange) {
  const cb = () => { try { onChange(); } catch (_) {} };
  const ch = supabase.channel('charlive:' + characterId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'characters', filter: `id=eq.${characterId}` }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'character_attributes', filter: `character_id=eq.${characterId}` }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'character_resources', filter: `character_id=eq.${characterId}` }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items', filter: `character_id=eq.${characterId}` }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'item_requests', filter: `character_id=eq.${characterId}` }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'system_player_progress', filter: `user_id=eq.${userId}` }, cb)
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (_) {} };
}
// lista de jogadores (entrar/sair) — mantém a aba "Jogadores" do Mestre ao vivo
export function subscribeMemberships(campaignId, onChange) {
  const ch = supabase.channel('members:' + campaignId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'memberships', filter: `campaign_id=eq.${campaignId}` },
      () => { try { onChange(); } catch (_) {} })
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (_) {} };
}
// nome/foto da mesa — atualiza o topbar de todo mundo conectado
export function subscribeCampaign(campaignId, onChange) {
  const ch = supabase.channel('campaign:' + campaignId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` },
      (payload) => { try { onChange(payload.new); } catch (_) {} })
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (_) {} };
}

// "quem está online agora" na mesa — usa o recurso de Presence do Realtime (não grava nada no
// banco, é só um canal efêmero): cada aba que entra faz `track()` com o próprio user_id, e todo
// mundo no canal recebe o snapshot de quem está presente sempre que alguém entra/sai. onSync
// recebe um Set com os user_ids online agora (uma mesma pessoa com 2 abas conta uma vez só).
export function subscribePresence(campaignId, userId, onSync) {
  const ch = supabase.channel('presence:' + campaignId, { config: { presence: { key: userId } } });
  ch.on('presence', { event: 'sync' }, () => {
    try { onSync(new Set(Object.keys(ch.presenceState()))); } catch (_) {}
  });
  ch.subscribe((status) => { if (status === 'SUBSCRIBED') ch.track({ online_at: new Date().toISOString() }); });
  return () => { try { supabase.removeChannel(ch); } catch (_) {} };
}
