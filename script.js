const STORAGE_KEY_PRODUTOS = "comprasInteligenteProdutos";
const STORAGE_KEY_CHECKS = "comprasInteligenteChecks";
const STORAGE_KEY_PRECOS = "comprasInteligentePrecos";

let produtos = [];
let checksComprados = {};
let precos = {};
let firebaseAtivo = false;
let listaRef = null;
let ignorarRenderRemoto = false;
let usuarioUID = null;

const revisados = new Set();      // itens conferidos nesta sessão (somem do estoque)
let mostrarComprados = false;     // mostrar/ocultar comprados na lista
let abaAtual = "estoque";

/* ---------- utilidades ---------- */
function formatarNumero(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseNumero(valor) {
  let s = String(valor).trim();
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  return Math.max(0, Number(s) || 0);
}
function numStr(n) { return String(Number(n) || 0).replace(".", ","); }
function escapeHtml(t) {
  return String(t ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function carregarLocal(chave, fallback) {
  try { const v = JSON.parse(localStorage.getItem(chave)); return v ?? fallback; } catch { return fallback; }
}
function salvarLocal(chave, valor) { localStorage.setItem(chave, JSON.stringify(valor)); }
function getCard(id) { return document.querySelector(`.card[data-id="${id}"]`); }
function buscaValor() { return document.getElementById("buscaProduto").value; }
function passoUnidade(u) { return /kg|kilo|litro/i.test(u || "") ? 0.5 : 1; }
function faltaDe(p) { return Math.max(0, Number(p.minimo || 0) - Math.max(0, Number(p.estoqueAtual || 0))); }
function normalizarProdutos(bruto) {
  let arr = Array.isArray(bruto) ? bruto
    : (bruto && typeof bruto === "object" ? Object.values(bruto) : []);
  arr = arr.filter(p => p && typeof p === "object" && p.nome != null);
  return arr.map((p, i) => ({
    id: p.id || `prod_${Date.now()}_${i}`,
    nome: String(p.nome || ""),
    minimo: Number(p.minimo) || 0,
    unidade: p.unidade || "un",
    estoqueAtual: Number(p.estoqueAtual) || 0,
  }));
}
function produtosDefault() { return produtosPadrao.map(p => ({ ...p, estoqueAtual: 0 })); }

/* ---------- Firebase ---------- */
function atualizarStatus(texto, online) {
  const el = document.getElementById("syncStatus");
  if (!el) return;
  el.lastChild.textContent = texto;
  el.title = online ? "Sincronizado com o Firebase" : "Salvando só neste aparelho";
  el.classList.toggle("online", !!online);
}
function snapshotPadrao() {
  return { produtos: produtosDefault(), checksComprados: {}, precos: {}, atualizadoEm: Date.now() };
}
async function iniciarFirebaseSeConfigurado() {
  const cfg = window.firebaseSettings || {};
  if (!cfg.enabled || !cfg.apiKey || !cfg.databaseURL || !cfg.projectId || !cfg.appId || !usuarioUID) {
    atualizarStatus("Local", false);
    return;
  }

  try {
    const db = firebase.database();
    listaRef = db.ref(`users/${usuarioUID}/lista`);
    firebaseAtivo = true;
    atualizarStatus("Online", true);

    // Verificar se dados existem no Firebase
    listaRef.once("value", async (snap) => {
      if (!snap.exists()) {
        await listaRef.set(snapshotPadrao());
      }
    });

    // Ouvir mudanças em tempo real
    listaRef.on("value", (snap) => {
      const dados = snap.val() || snapshotPadrao();
      ignorarRenderRemoto = true;
      produtos = normalizarProdutos(dados.produtos);
      if (produtos.length === 0) produtos = produtosDefault();
      checksComprados = dados.checksComprados || {};
      precos = dados.precos || {};
      salvarTudoLocal();
      renderizarTudo();
      ignorarRenderRemoto = false;
    });
  } catch (err) {
    console.error("Erro ao configurar Firebase:", err);
    atualizarStatus("Local", false);
  }
}
async function sincronizarRemoto() {
  if (!firebaseAtivo || !listaRef || ignorarRenderRemoto) return;
  try {
    await listaRef.update({ produtos, checksComprados, precos, atualizadoEm: Date.now() });
  } catch (err) {
    console.error("Erro ao sincronizar:", err);
  }
}

/* ---------- estado local ---------- */
function carregarEstadoInicial() {
  produtos = normalizarProdutos(carregarLocal(STORAGE_KEY_PRODUTOS, null));
  if (produtos.length === 0) produtos = produtosDefault();
  checksComprados = carregarLocal(STORAGE_KEY_CHECKS, {});
  precos = carregarLocal(STORAGE_KEY_PRECOS, {});
}
function salvarTudoLocal() {
  salvarLocal(STORAGE_KEY_PRODUTOS, produtos);
  salvarLocal(STORAGE_KEY_CHECKS, checksComprados);
  salvarLocal(STORAGE_KEY_PRECOS, precos);
}
function salvarESincronizar() { salvarTudoLocal(); sincronizarRemoto(); }

/* ---------- ABA ESTOQUE ---------- */
function ajustarEstoque(id, delta) {
  const p = produtos.find(x => x.id === id);
  if (!p) return;
  p.estoqueAtual = Math.max(0, Math.round(((Number(p.estoqueAtual) || 0) + delta) * 100) / 100);
  const inp = document.getElementById(`estoque-${id}`);
  if (inp) inp.value = numStr(p.estoqueAtual);
  atualizarTag(id);
  salvarESincronizar();
}
function definirEstoqueDireto(id, valor) {
  const p = produtos.find(x => x.id === id);
  if (!p) return;
  p.estoqueAtual = parseNumero(valor);
  atualizarTag(id);
  salvarESincronizar();
}
function atualizarTag(id) {
  const p = produtos.find(x => x.id === id);
  const tag = document.getElementById(`tag-${id}`);
  if (!p || !tag) return;
  const falta = faltaDe(p);
  if (falta > 0) {
    tag.className = "tag tag-falta";
    tag.textContent = `Falta ${formatarNumero(falta)}`;
  } else {
    tag.className = "tag tag-ok";
    tag.textContent = "Ok";
  }
}
function confirmarItem(id) {
  if (!produtos.find(p => p.id === id)) return;
  revisados.add(id);
  const card = getCard(id);
  if (card) { card.classList.add("hiding"); setTimeout(() => renderizarProdutos(buscaValor()), 220); }
  else renderizarProdutos(buscaValor());
}
function alternarEdicao(id) {
  const card = getCard(id);
  if (!card) return;
  const box = card.querySelector(".edit-box");
  if (box) box.hidden = !box.hidden;
}
function atualizarProduto(id, campo, valor) {
  const p = produtos.find(x => x.id === id);
  if (!p) return;
  if (campo === "nome") {
    p.nome = valor;
    const card = getCard(id);
    if (card) card.querySelector(".prod-name").textContent = valor || "Produto";
  } else if (campo === "unidade") {
    p.unidade = valor;
  } else if (campo === "minimo") {
    p.minimo = parseNumero(valor);
    atualizarTag(id);
  }
  salvarESincronizar();
}
function adicionarProduto() {
  const nome = document.getElementById("novoNome").value.trim();
  const minimo = parseNumero(document.getElementById("novoMinimo").value);
  const unidade = document.getElementById("novoUnidade").value.trim() || "un";
  if (!nome) { alert("Digite o nome do produto."); return; }
  produtos.unshift({ id: `prod_${Date.now()}_${Math.floor(Math.random() * 1000)}`, nome, minimo, unidade, estoqueAtual: 0 });
  document.getElementById("novoNome").value = "";
  document.getElementById("novoMinimo").value = "";
  document.getElementById("novoUnidade").value = "un";
  document.getElementById("boxNovo").hidden = true;
  salvarESincronizar();
  renderizarProdutos(buscaValor());
  atualizarBadge();
}
function excluirProduto(id, el) {
  const p = produtos.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Excluir o produto "${p.nome}"?`)) { if (el) el.checked = false; return; }
  produtos = produtos.filter(x => x.id !== id);
  delete checksComprados[id];
  delete precos[id];
  revisados.delete(id);
  salvarESincronizar();
  renderizarProdutos(buscaValor());
  atualizarBadge();
}

function renderizarProdutos(filtro = "") {
  const cont = document.getElementById("listaProdutos");
  const vazio = document.getElementById("estoqueVazio");
  const termo = filtro.trim().toLowerCase();
  cont.innerHTML = "";
  let visiveis = 0;

  produtos.forEach((p, i) => {
    if (!p.id) p.id = `prod_${Date.now()}_${i}`;
    if (p.estoqueAtual == null) p.estoqueAtual = 0;
    if (revisados.has(p.id)) return;
    if (termo && !String(p.nome || "").toLowerCase().includes(termo)) return;
    visiveis++;

    const falta = faltaDe(p);
    const passo = passoUnidade(p.unidade);
    const card = document.createElement("div");
    card.className = "card prod";
    card.setAttribute("data-id", p.id);
    card.innerHTML = `
      <div class="prod-head">
        <div>
          <span class="prod-name">${escapeHtml(p.nome)}</span>
          <span class="tag ${falta > 0 ? "tag-falta" : "tag-ok"}" id="tag-${p.id}">${falta > 0 ? "Falta " + formatarNumero(falta) : "Ok"}</span>
          <div class="prod-sub">Mínimo: ${formatarNumero(p.minimo)} ${escapeHtml(p.unidade || "un")}</div>
        </div>
        <button class="icon-btn" type="button" aria-label="Editar" onclick="window.app.alternarEdicao('${p.id}')">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
      </div>
      <div class="stepper">
        <button class="step" type="button" aria-label="Diminuir" onclick="window.app.ajustarEstoque('${p.id}', -${passo})">−</button>
        <input class="step-val" type="text" inputmode="decimal" id="estoque-${p.id}" value="${numStr(p.estoqueAtual)}"
          onfocus="this.select()" oninput="window.app.definirEstoqueDireto('${p.id}', this.value)" />
        <button class="step" type="button" aria-label="Aumentar" onclick="window.app.ajustarEstoque('${p.id}', ${passo})">+</button>
        <button class="ok-btn" type="button" onclick="window.app.confirmarItem('${p.id}')">OK</button>
      </div>
      <div class="edit-box" hidden>
        <label>Nome do produto
          <input type="text" value="${escapeHtml(p.nome)}" oninput="window.app.atualizarProduto('${p.id}','nome',this.value)" />
        </label>
        <div class="edit-row">
          <label>Estoque mínimo
            <input type="number" min="0" step="0.01" inputmode="decimal" value="${p.minimo ?? 0}" oninput="window.app.atualizarProduto('${p.id}','minimo',this.value)" />
          </label>
          <label>Unidade
            <input type="text" value="${escapeHtml(p.unidade || "un")}" oninput="window.app.atualizarProduto('${p.id}','unidade',this.value)" />
          </label>
        </div>
        <label class="del-check">
          <input type="checkbox" onchange="window.app.excluirProduto('${p.id}', this)" />
          <span>Excluir este produto</span>
        </label>
      </div>`;
    cont.appendChild(card);
  });

  const revisadosN = produtos.filter(p => revisados.has(p.id)).length;
  const infoEl = document.getElementById("reviewCount");
  const btnTodos = document.getElementById("btnMostrarTodos");
  btnTodos.hidden = revisadosN === 0;

  if (termo) {
    infoEl.textContent = visiveis === 0 ? "Nenhum produto encontrado" : `${visiveis} encontrado(s)`;
  } else if (revisadosN > 0) {
    const restam = produtos.length - revisadosN;
    infoEl.textContent = restam > 0 ? `Faltam conferir: ${restam}` : "";
  } else {
    infoEl.textContent = `Confira seu estoque · ${produtos.length} itens`;
  }

  vazio.hidden = !(!termo && visiveis === 0 && produtos.length > 0);
  atualizarBadge();
}

/* ---------- ABA LISTA ---------- */
function gerarLista() {
  const cont = document.getElementById("listaCompras");
  const vazia = document.getElementById("listaVazia");
  const btnVer = document.getElementById("btnVerComprados");
  cont.innerHTML = "";

  const faltantes = produtos.filter(p => faltaDe(p) > 0);
  const total = faltantes.length;
  const comprados = faltantes.filter(p => checksComprados[p.id]).length;

  faltantes.forEach((p) => {
    const comprado = !!checksComprados[p.id];
    if (comprado && !mostrarComprados) return;
    const falta = faltaDe(p);
    const valPreco = precos[p.id] ? formatarMoeda(precos[p.id]) : "";
    const item = document.createElement("div");
    item.className = "card shop" + (comprado ? " comprado" : "");
    item.setAttribute("data-id", p.id);
    item.innerHTML = `
      <label class="shop-check">
        <input type="checkbox" ${comprado ? "checked" : ""} onchange="window.app.marcarComprado('${p.id}', this.checked)" />
        <span class="checkmark"></span>
      </label>
      <div class="shop-info">
        <div class="shop-name">${escapeHtml(p.nome)}</div>
        <div class="shop-qty">Comprar ${formatarNumero(falta)} ${escapeHtml(p.unidade || "un")}</div>
      </div>
      <div class="shop-price">
        <span>R$</span>
        <input type="text" inputmode="decimal" placeholder="000,00" value="${valPreco}"
          onfocus="this.select()" oninput="window.app.definirPreco('${p.id}', this.value)" />
      </div>`;
    cont.appendChild(item);
  });

  const pct = total === 0 ? 0 : Math.round((comprados / total) * 100);
  const barra = document.getElementById("barra");
  barra.style.width = pct + "%";
  document.getElementById("listaPct").textContent = pct + "%";
  document.getElementById("listaResumo").textContent = total === 0 ? "Lista vazia" : `${comprados} de ${total} no carrinho`;

  vazia.hidden = total !== 0;

  const naoComprados = total - comprados;
  if (comprados > 0) {
    btnVer.hidden = false;
    btnVer.textContent = mostrarComprados ? "Ocultar comprados" : `Ver ${comprados} já no carrinho`;
  } else {
    btnVer.hidden = true;
  }

  atualizarTotalPreco();
  atualizarBadge();
}
function marcarComprado(id, checked) {
  checksComprados[id] = checked;
  salvarESincronizar();
  if (checked && !mostrarComprados) {
    const card = getCard(id);
    if (card) {
      card.classList.add("hiding");
      setTimeout(() => gerarLista(), 220);
      atualizarTotalPreco();
      return;
    }
  }
  gerarLista();
}
function definirPreco(id, valor) {
  const v = parseNumero(valor);
  if (v > 0) precos[id] = v; else delete precos[id];
  atualizarTotalPreco();
  salvarESincronizar();
}
function atualizarTotalPreco() {
  let soma = 0;
  produtos.forEach(p => { if (faltaDe(p) > 0 && precos[p.id]) soma += Number(precos[p.id]); });
  document.getElementById("precoTotal").textContent = formatarMoeda(soma);
}
function atualizarBadge() {
  const faltam = produtos.filter(p => faltaDe(p) > 0 && !checksComprados[p.id]).length;
  const badge = document.getElementById("badgeLista");
  badge.textContent = faltam;
  badge.hidden = faltam === 0;
}
function enviarWhatsApp() {
  const faltantes = produtos.filter(p => faltaDe(p) > 0 && !checksComprados[p.id]);
  if (faltantes.length === 0) { alert("Não há itens pendentes para enviar."); return; }
  let linhas = faltantes.map(p => {
    const base = `- ${p.nome}: ${formatarNumero(faltaDe(p))} ${p.unidade || "un"}`;
    return precos[p.id] ? `${base} (R$ ${formatarMoeda(precos[p.id])})` : base;
  });
  let total = 0;
  produtos.forEach(p => { if (faltaDe(p) > 0 && precos[p.id]) total += Number(precos[p.id]); });
  let texto = "Lista de compras:\n" + linhas.join("\n");
  if (total > 0) texto += `\n\nTotal estimado: R$ ${formatarMoeda(total)}`;
  window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank");
}

/* ---------- restaurar / abas ---------- */
function restaurarPadrao() {
  if (!confirm("Restaurar a lista padrão e apagar as alterações?")) return;
  produtos = produtosDefault();
  checksComprados = {};
  precos = {};
  revisados.clear();
  salvarESincronizar();
  renderizarTudo();
}
function trocarAba(nome) {
  abaAtual = nome;
  document.getElementById("screen-estoque").classList.toggle("is-active", nome === "estoque");
  document.getElementById("screen-lista").classList.toggle("is-active", nome === "lista");
  document.getElementById("tabEstoque").classList.toggle("is-active", nome === "estoque");
  document.getElementById("tabLista").classList.toggle("is-active", nome === "lista");
  window.scrollTo(0, 0);
  if (nome === "lista") gerarLista(); else renderizarProdutos(buscaValor());
}
function renderizarTudo() {
  renderizarProdutos(buscaValor());
  gerarLista();
}

/* ---------- eventos ---------- */
function bindEventos() {
  document.getElementById("btnToggleNovo").addEventListener("click", () => {
    const box = document.getElementById("boxNovo");
    box.hidden = !box.hidden;
    if (!box.hidden) document.getElementById("novoNome").focus();
  });
  document.getElementById("btnAdicionarProduto").addEventListener("click", adicionarProduto);
  document.getElementById("novoNome").addEventListener("keydown", (e) => { if (e.key === "Enter") adicionarProduto(); });
  document.getElementById("buscaProduto").addEventListener("input", (e) => renderizarProdutos(e.target.value));
  document.getElementById("btnMostrarTodos").addEventListener("click", () => { revisados.clear(); renderizarProdutos(buscaValor()); });
  document.getElementById("btnRestaurar").addEventListener("click", restaurarPadrao);
  document.getElementById("btnIrParaLista").addEventListener("click", () => trocarAba("lista"));
  document.getElementById("btnVerComprados").addEventListener("click", () => { mostrarComprados = !mostrarComprados; gerarLista(); });
  document.getElementById("btnWhats").addEventListener("click", enviarWhatsApp);
  document.getElementById("tabEstoque").addEventListener("click", () => trocarAba("estoque"));
  document.getElementById("tabLista").addEventListener("click", () => trocarAba("lista"));
}

window.app = { ajustarEstoque, definirEstoqueDireto, confirmarItem, alternarEdicao, atualizarProduto, excluirProduto, marcarComprado, definirPreco };

window.iniciarApp = async function(uid) {
  usuarioUID = uid;
  carregarEstadoInicial();
  bindEventos();
  renderizarTudo();
  await iniciarFirebaseSeConfigurado();
};
