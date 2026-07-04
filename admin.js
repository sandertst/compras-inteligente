// admin.js — painel administrativo (depende de auth.js já carregado antes)
// NÃO redeclara ADMIN_EMAIL nem inicializa o Firebase: isso já é feito em auth.js.

firebase.auth().onAuthStateChanged((user) => {
  if (!user || user.email !== ADMIN_EMAIL) {
    window.location.href = "/";
    return;
  }
  document.getElementById("adminEmail").textContent = user.email;
  document.getElementById("adminContainer").style.display = "flex";
  carregarUsuarios();
});

// Carregar lista de usuários
async function carregarUsuarios() {
  const listEl = document.getElementById("usersList");
  try {
    const snapshot = await firebase.database().ref("users").once("value");
    listEl.innerHTML = "";

    if (!snapshot.exists()) {
      listEl.innerHTML = "<p>Nenhum usuário cadastrado ainda.</p>";
      return;
    }

    Object.entries(snapshot.val()).forEach(([uid, dados]) => {
      const userCard = document.createElement("div");
      userCard.className = "admin-user-card";
      userCard.innerHTML = `
        <div class="admin-user-info">
          <strong>${escapeHtml(dados.nome || "Sem nome")}</strong>
          <span class="admin-user-email">${escapeHtml(dados.email || "")}</span>
          <span class="admin-user-date">Criado: ${dados.criadoEm ? new Date(dados.criadoEm).toLocaleDateString("pt-BR") : "—"}</span>
        </div>
        <div class="admin-user-stats">
          <div class="stat">
            <span class="stat-label">Produtos</span>
            <strong>${(dados.lista && dados.lista.produtos || []).length}</strong>
          </div>
          <div class="stat">
            <span class="stat-label">Comprados</span>
            <strong>${Object.keys((dados.lista && dados.lista.checksComprados) || {}).length}</strong>
          </div>
        </div>
        <button class="btn-sm" onclick="window.verDetalhesUsuario('${uid}')">Ver detalhes</button>
      `;
      listEl.appendChild(userCard);
    });
  } catch (err) {
    console.error("Erro ao carregar usuários:", err);
    listEl.innerHTML = "<p>Erro ao carregar usuários. Veja o console (F12) para detalhes.</p>";
  }
}

// Criar novo usuário (chamado pelo botão)
window.criarUsuarioAdmin = async function () {
  const nome = document.getElementById("novoUserNome").value.trim();
  const email = document.getElementById("novoUserEmail").value.trim();
  const senha = document.getElementById("novoUserSenha").value.trim();
  const msgEl = document.getElementById("createUserMsg");

  if (!nome || !email || !senha) {
    msgEl.textContent = "Preencha todos os campos.";
    msgEl.className = "admin-msg error";
    msgEl.hidden = false;
    return;
  }
  if (senha.length < 6) {
    msgEl.textContent = "A senha precisa ter pelo menos 6 caracteres.";
    msgEl.className = "admin-msg error";
    msgEl.hidden = false;
    return;
  }

  try {
    await window.criarNovoUsuario(nome, email, senha);
    msgEl.textContent = `✓ Usuário "${nome}" criado com sucesso!`;
    msgEl.className = "admin-msg success";
    msgEl.hidden = false;

    document.getElementById("novoUserNome").value = "";
    document.getElementById("novoUserEmail").value = "";
    document.getElementById("novoUserSenha").value = "";

    setTimeout(carregarUsuarios, 800);
  } catch (err) {
    msgEl.textContent = err.message || "Erro ao criar usuário.";
    msgEl.className = "admin-msg error";
    msgEl.hidden = false;
  }
};

// Ver detalhes do usuário
window.verDetalhesUsuario = async function (uid) {
  try {
    const snapshot = await firebase.database().ref(`users/${uid}`).once("value");
    if (!snapshot.exists()) {
      alert("Usuário não encontrado.");
      return;
    }

    const dados = snapshot.val();
    const lista = dados.lista || { produtos: [], checksComprados: {}, precos: {} };
    const produtos = lista.produtos || [];
    const faltantes = produtos.filter((p) => Math.max(0, (p.minimo || 0) - (p.estoqueAtual || 0)) > 0).length;
    const totalPrecos = Object.values(lista.precos || {}).reduce((a, b) => a + Number(b || 0), 0);

    let msg = `${dados.nome || "Usuário"}\n`;
    msg += `${dados.email || ""}\n`;
    msg += `Criado: ${dados.criadoEm ? new Date(dados.criadoEm).toLocaleDateString("pt-BR") : "—"}\n\n`;
    msg += `Produtos cadastrados: ${produtos.length}\n`;
    msg += `Itens para comprar: ${faltantes}\n`;
    msg += `Comprados: ${Object.keys(lista.checksComprados || {}).length}\n`;
    msg += `Total em preços: R$ ${formatarMoeda(totalPrecos)}`;

    alert(msg);
  } catch (err) {
    console.error("Erro ao obter detalhes:", err);
    alert("Erro ao carregar detalhes do usuário.");
  }
};

function escapeHtml(text) {
  return String(text ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
