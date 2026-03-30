import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getDatabase, ref, onValue, set, update, get } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

const STORAGE_KEY_PRODUTOS = "comprasInteligenteProdutos";
const STORAGE_KEY_TOTAL = "comprasInteligenteTotal";
const STORAGE_KEY_CHECKS = "comprasInteligenteChecks";

let produtos = [];
let totalCompra = 0;
let checksComprados = {};
let firebaseAtivo = false;
let db = null;
let listaRef = null;
let ignorarRenderRemoto = false;

function formatarNumero(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function escapeHtml(texto) {
  return String(texto ?? "").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
function carregarLocal(chave, fallback) {
  try { const valor = JSON.parse(localStorage.getItem(chave)); return valor ?? fallback; } catch { return fallback; }
}
function salvarLocal(chave, valor) { localStorage.setItem(chave, JSON.stringify(valor)); }
function atualizarStatus(texto) { document.getElementById("syncStatus").textContent = texto; }
function snapshotPadrao() {
  return { produtos: [...produtosPadrao].map(p => ({...p, estoqueAtual: 0})), totalCompra: 0, checksComprados: {}, atualizadoEm: Date.now() };
}

async function iniciarFirebaseSeConfigurado() {
  const cfg = window.firebaseSettings || {};
  if (!cfg.enabled || !cfg.apiKey || !cfg.databaseURL || !cfg.projectId || !cfg.appId) {
    atualizarStatus("Modo local");
    return;
  }
  const app = initializeApp({
    apiKey: cfg.apiKey, authDomain: cfg.authDomain, databaseURL: cfg.databaseURL, projectId: cfg.projectId, appId: cfg.appId
  });
  db = getDatabase(app);
  listaRef = ref(db, `listas/${cfg.shoppingListId}`);
  firebaseAtivo = true;
  atualizarStatus("Sincronização ativa");

  const existente = await get(listaRef);
  if (!existente.exists()) await set(listaRef, snapshotPadrao());

  onValue(listaRef, (snapshot) => {
    const dados = snapshot.val() || snapshotPadrao();
    ignorarRenderRemoto = true;
    produtos = Array.isArray(dados.produtos) ? dados.produtos : snapshotPadrao().produtos;
    totalCompra = Number(dados.totalCompra || 0);
    checksComprados = dados.checksComprados || {};
    salvarLocal(STORAGE_KEY_PRODUTOS, produtos);
    salvarLocal(STORAGE_KEY_TOTAL, totalCompra);
    salvarLocal(STORAGE_KEY_CHECKS, checksComprados);
    renderizarTudo();
    ignorarRenderRemoto = false;
  });
}

async function sincronizarRemoto() {
  if (!firebaseAtivo || !listaRef || ignorarRenderRemoto) return;
  await update(listaRef, { produtos, totalCompra, checksComprados, atualizadoEm: Date.now() });
}

function carregarEstadoInicial() {
  produtos = carregarLocal(STORAGE_KEY_PRODUTOS, [...produtosPadrao].map(p => ({...p, estoqueAtual: 0})));
  totalCompra = Number(localStorage.getItem(STORAGE_KEY_TOTAL) || "0") || 0;
  checksComprados = carregarLocal(STORAGE_KEY_CHECKS, {});
}
function salvarTudoLocal() {
  salvarLocal(STORAGE_KEY_PRODUTOS, produtos);
  localStorage.setItem(STORAGE_KEY_TOTAL, String(totalCompra));
  salvarLocal(STORAGE_KEY_CHECKS, checksComprados);
}
function atualizarProduto(id, campo, valor) {
  const produto = produtos.find(p => p.id === id);
  if (!produto) return;
  if (campo === "nome" || campo === "unidade") produto[campo] = valor;
  else if (campo === "minimo" || campo === "estoqueAtual") produto[campo] = Math.max(0, Number(String(valor).replace(",", ".")) || 0);
  salvarTudoLocal();
  sincronizarRemoto();
}
function adicionarProduto() {
  const nome = document.getElementById("novoNome").value.trim();
  const minimo = Math.max(0, parseFloat(String(document.getElementById("novoMinimo").value).replace(",", ".")) || 0);
  const unidade = document.getElementById("novoUnidade").value.trim() || "un";
  if (!nome) { alert("Digite o nome do produto."); return; }
  produtos.unshift({ id: `prod_${Date.now()}_${Math.floor(Math.random()*1000)}`, nome, minimo, unidade, estoqueAtual: 0 });
  salvarTudoLocal();
  renderizarProdutos(document.getElementById("buscaProduto").value);
  sincronizarRemoto();
  document.getElementById("novoNome").value = "";
  document.getElementById("novoMinimo").value = "";
  document.getElementById("novoUnidade").value = "un";
}
function excluirProduto(id) {
  const produto = produtos.find(p => p.id === id);
  if (!produto) return;
  if (!confirm(`Excluir o produto "${produto.nome}"?`)) return;
  produtos = produtos.filter(p => p.id !== id);
  delete checksComprados[id];
  salvarTudoLocal();
  renderizarTudo();
  sincronizarRemoto();
}
function renderizarProdutos(filtro = "") {
  const container = document.getElementById("listaProdutos");
  const termo = filtro.trim().toLowerCase();
  container.innerHTML = "";
  let exibidos = 0;

  produtos.forEach((produto, index) => {
    if (!produto.id) produto.id = `prod_${Date.now()}_${index}`;
    if (produto.estoqueAtual === undefined || produto.estoqueAtual === null) produto.estoqueAtual = 0;
    const nome = String(produto.nome || "").toLowerCase();
    if (termo && !nome.includes(termo)) return;
    exibidos++;

    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-grid">
        <div>
          <label class="product-label">Produto / observação</label>
          <input type="text" value="${escapeHtml(produto.nome)}" placeholder="Nome do produto"
            oninput="window.app.atualizarProduto('${produto.id}', 'nome', this.value)" />
        </div>
        <div>
          <label class="product-label">Estoque mínimo</label>
          <input type="number" min="0" step="0.01" value="${produto.minimo ?? 0}"
            oninput="window.app.atualizarProduto('${produto.id}', 'minimo', this.value)" />
        </div>
        <div>
          <label class="product-label">Unidade</label>
          <input type="text" value="${escapeHtml(produto.unidade || "un")}"
            oninput="window.app.atualizarProduto('${produto.id}', 'unidade', this.value)" />
        </div>
        <div>
          <label class="product-label">Estoque atual</label>
          <input type="number" min="0" step="0.01" value="${produto.estoqueAtual ?? 0}"
            oninput="window.app.atualizarProduto('${produto.id}', 'estoqueAtual', this.value)" />
        </div>
      </div>
      <div class="product-actions">
        <button class="btn btn-delete btn-full" onclick="window.app.excluirProduto('${produto.id}')">Excluir produto</button>
      </div>`;
    container.appendChild(card);
  });

  document.getElementById("contadorProdutos").textContent = `${exibidos} produtos`;
}
function gerarLista() {
  const lista = document.getElementById("listaCompras");
  const resumo = document.getElementById("listaResumo");
  lista.innerHTML = "";

  let totalItens = 0;
  let itensComprados = 0;

  produtos.forEach((produto) => {
    const minimo = Math.max(0, Number(produto.minimo || 0));
    const estoqueAtual = Math.max(0, Number(produto.estoqueAtual || 0));
    const falta = Math.max(0, minimo - estoqueAtual);
    if (falta > 0) {
      totalItens++;
      if (checksComprados[produto.id]) itensComprados++;
      const item = document.createElement("div");
      item.className = "shopping-item" + (checksComprados[produto.id] ? " comprado" : "");
      item.innerHTML = `
        <input type="checkbox" ${checksComprados[produto.id] ? "checked" : ""}
          onchange="window.app.marcarComprado('${produto.id}', this.checked)" />
        <div>
          <div class="item-title">${escapeHtml(produto.nome)}</div>
          <span class="qty-badge">Falta comprar: ${formatarNumero(falta)} ${escapeHtml(produto.unidade || "un")}</span>
          <span class="item-meta">Estoque mínimo: ${formatarNumero(minimo)} ${escapeHtml(produto.unidade || "un")}</span>
          <span class="item-meta">Você tem em casa: ${formatarNumero(estoqueAtual)} ${escapeHtml(produto.unidade || "un")}</span>
        </div>`;
      lista.appendChild(item);
    }
  });

  const percentual = totalItens === 0 ? 0 : Math.round((itensComprados / totalItens) * 100);
  const barra = document.getElementById("barra");
  barra.style.width = percentual + "%";
  barra.textContent = percentual + "%";

  resumo.textContent = totalItens === 0
    ? "Tudo certo. Sua lista zerou bonito."
    : `Você precisa comprar ${totalItens} item(ns). O progresso sincroniza entre os celulares quando o Firebase estiver configurado.`;
}
function marcarComprado(id, checked) {
  checksComprados[id] = checked;
  salvarTudoLocal();
  gerarLista();
  sincronizarRemoto();
}
function adicionarValor() {
  const campo = document.getElementById("valorItem");
  const valor = parseFloat(String(campo.value).replace(",", ".")) || 0;
  totalCompra += valor;
  salvarTudoLocal();
  document.getElementById("total").textContent = formatarMoeda(totalCompra);
  campo.value = "";
  sincronizarRemoto();
}
function zerarTotal() {
  totalCompra = 0;
  salvarTudoLocal();
  document.getElementById("total").textContent = formatarMoeda(totalCompra);
  sincronizarRemoto();
}
function restaurarPadrao() {
  if (!confirm("Deseja restaurar a lista padrão e apagar alterações locais?")) return;
  produtos = [...produtosPadrao].map(p => ({...p, estoqueAtual: 0}));
  totalCompra = 0;
  checksComprados = {};
  salvarTudoLocal();
  renderizarTudo();
  sincronizarRemoto();
}
function renderizarTudo() {
  document.getElementById("total").textContent = formatarMoeda(totalCompra);
  renderizarProdutos(document.getElementById("buscaProduto").value);
  gerarLista();
}
function bindEventos() {
  document.getElementById("btnAdicionarProduto").addEventListener("click", adicionarProduto);
  document.getElementById("btnGerarLista").addEventListener("click", async () => { salvarTudoLocal(); gerarLista(); await sincronizarRemoto(); });
  document.getElementById("btnSalvar").addEventListener("click", async () => { salvarTudoLocal(); await sincronizarRemoto(); alert("Dados salvos."); });
  document.getElementById("btnRestaurar").addEventListener("click", restaurarPadrao);
  document.getElementById("btnAdicionarValor").addEventListener("click", adicionarValor);
  document.getElementById("btnZerarTotal").addEventListener("click", zerarTotal);
  document.getElementById("valorItem").addEventListener("keydown", (e) => { if (e.key === "Enter") adicionarValor(); });
  document.getElementById("buscaProduto").addEventListener("input", (e) => { renderizarProdutos(e.target.value); });
  document.getElementById("novoUnidade").value = "un";
}
window.app = { atualizarProduto, excluirProduto, marcarComprado };
async function iniciar() {
  carregarEstadoInicial();
  bindEventos();
  renderizarTudo();
  await iniciarFirebaseSeConfigurado();
}
iniciar();
