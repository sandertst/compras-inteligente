const ADMIN_EMAIL = "sandertst@gmail.com";

// Verificar se é admin na inicialização
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user || user.email !== ADMIN_EMAIL) {
    window.location.href = "/";
    return;
  }
  
  document.getElementById("adminEmail").textContent = user.email;
  carregarUsuarios();
});

// Carregar lista de usuários
async function carregarUsuarios() {
  try {
    const db = firebase.database();
    const snapshot = await db.ref("users").once("value");
    const listEl = document.getElementById("usersList");
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
          <span class="admin-user-email">${escapeHtml(dados.email)}</span>
          <span class="admin-user-date">Criado: ${new Date(dados.criadoEm).toLocaleDateString("pt-BR")}</span>
        </div>
        <div class="admin-user-stats">
          <div class="stat">
            <span class="stat-label">Produtos:</span>
            <strong>${(dados.lista?.produtos || []).length}</strong>
          </div>
          <div class="stat">
            <span class="stat-label">Comprados:</span>
            <strong>${Object.keys(dados.lista?.checksComprados || {}).length}</strong>
          </div>
        </div>
        <button class="btn-sm" onclick="window.verDetalhesUsuario('${uid}')">Ver detalhes</button>
      `;
      listEl.appendChild(userCard);
    });
  } catch (err) {
    console.error("Erro ao carregar usuários:", err);
  }
}

// Criar novo usuário (função global)
window.criarUsuarioAdmin = async function() {
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
  
  try {
    const result = await window.criarNovoUsuario(nome, email, senha);
    if (result) {
      msgEl.textContent = `✓ Usuário "${nome}" criado com sucesso!`;
      msgEl.className = "admin-msg success";
      msgEl.hidden = false;
      
      document.getElementById("novoUserNome").value = "";
      document.getElementById("novoUserEmail").value = "";
      document.getElementById("novoUserSenha").value = "";
      
      setTimeout(() => carregarUsuarios(), 1000);
    }
  } catch (err) {
    msgEl.textContent = "Erro: " + err.message;
    msgEl.className = "admin-msg error";
    msgEl.hidden = false;
  }
};

// Ver detalhes do usuário
window.verDetalhesUsuario = async function(uid) {
  try {
    const db = firebase.database();
    const snapshot = await db.ref(`users/${uid}`).once("value");
    
    if (!snapshot.exists()) {
      alert("Usuário não encontrado.");
      return;
    }
    
    const dados = snapshot.val();
    const lista = dados.lista || { produtos: [], checksComprados: {}, precos: {} };
    
    let msg = `=== ${dados.nome || "Usuário"} ===\n\n`;
    msg += `Email: ${dados.email}\n`;
    msg += `Criado: ${new Date(dados.criadoEm).toLocaleDateString("pt-BR")}\n\n`;
    
    msg += `Produtos cadastrados: ${lista.produtos.length}\n`;
    msg += `Itens para comprar: ${lista.produtos.filter(p => Math.max(0, p.minimo - (p.estoqueAtual || 0)) > 0).length}\n`;
    msg += `Comprados: ${Object.keys(lista.checksComprados).length}\n\n`;
    
    msg += `Total em preços: R$ ${formatarMoeda(Object.values(lista.precos || {}).reduce((a, b) => a + b, 0))}\n`;
    
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
