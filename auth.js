// Autenticação Firebase - sem imports, tudo global

const ADMIN_EMAIL = "sandertst@gmail.com";

let auth = null;
let db = null;

// Inicializar Firebase quando a página carregar
async function inicializarFirebaseAuth() {
  const cfg = window.firebaseSettings || {};
  
  if (!cfg.apiKey) {
    console.error("Firebase não configurado!");
    return;
  }

  const app = firebase.initializeApp(cfg);
  auth = firebase.auth(app);
  db = firebase.database(app);

  // Monitorar estado de autenticação
  firebase.auth().onAuthStateChanged(async (user) => {
    const loginScreen = document.getElementById("screen-login");
    const appScreen = document.querySelector(".app");
    
    if (user) {
      // Usuário logado
      if (loginScreen) loginScreen.style.display = "none";
      appScreen.style.display = "flex";
      
      // Mostrar email no header
      const userEmailEl = document.getElementById("userEmail");
      if (userEmailEl) userEmailEl.textContent = user.email;
      
      // Se é admin, mostrar botão do painel
      const adminBtn = document.getElementById("btnAdmin");
      if (adminBtn) adminBtn.style.display = user.email === ADMIN_EMAIL ? "inline-flex" : "none";
      
      // Inicializar o app com o UID do usuário
      if (window.iniciarApp) window.iniciarApp(user.uid);
    } else {
      // Usuário não logado
      if (loginScreen) loginScreen.style.display = "flex";
      appScreen.style.display = "none";
    }
  });
}

// Login
window.fazerLogin = async function(email, senha) {
  const btnLogin = document.getElementById("btnLogin");
  const msgError = document.getElementById("loginError");
  const loader = document.getElementById("loginLoader");
  
  if (!email || !senha) {
    msgError.textContent = "Preencha email e senha.";
    msgError.style.display = "block";
    return;
  }
  
  btnLogin.disabled = true;
  loader.style.display = "flex";
  msgError.style.display = "none";
  
  try {
    await firebase.auth().signInWithEmailAndPassword(email, senha);
  } catch (err) {
    msgError.textContent = err.code === "auth/user-not-found" ? "Usuário não encontrado." 
                          : err.code === "auth/wrong-password" ? "Senha incorreta."
                          : "Erro ao fazer login: " + err.message;
    msgError.style.display = "block";
  } finally {
    btnLogin.disabled = false;
    loader.style.display = "none";
  }
};

// Logout
window.fazerLogout = async function() {
  try {
    await firebase.auth().signOut();
  } catch (err) {
    console.error("Erro ao logout:", err);
  }
};

// Criar novo usuário (apenas admin)
window.criarNovoUsuario = async function(nome, email, senha) {
  const user = firebase.auth().currentUser;
  if (!user || user.email !== ADMIN_EMAIL) {
    return false;
  }
  
  try {
    const result = await firebase.auth().createUserWithEmailAndPassword(email, senha);
    
    // Salvar dados do usuário no Realtime Database
    await firebase.database().ref(`users/${result.user.uid}`).set({
      email: email,
      nome: nome,
      criadoEm: Date.now(),
      lista: {
        produtos: (window.produtosPadrao || []).map(p => ({ ...p, estoqueAtual: 0 })),
        checksComprados: {},
        precos: {}
      }
    });
    
    return true;
  } catch (err) {
    console.error("Erro ao criar usuário:", err);
    return false;
  }
};

// Obter todos os usuários (apenas admin)
window.obterTodosUsuarios = async function() {
  const user = firebase.auth().currentUser;
  if (!user || user.email !== ADMIN_EMAIL) {
    return [];
  }
  
  try {
    const snapshot = await firebase.database().ref("users").get();
    const usuarios = [];
    
    if (snapshot.exists()) {
      Object.entries(snapshot.val()).forEach(([uid, dados]) => {
        usuarios.push({
          uid,
          email: dados.email,
          nome: dados.nome || "Sem nome",
          criadoEm: dados.criadoEm
        });
      });
    }
    
    return usuarios;
  } catch (err) {
    console.error("Erro ao obter usuários:", err);
    return [];
  }
};

// Obter dados de um usuário específico
window.obterDadosUsuario = async function(uid) {
  const user = firebase.auth().currentUser;
  if (!user || user.email !== ADMIN_EMAIL) {
    return null;
  }
  
  try {
    const snapshot = await firebase.database().ref(`users/${uid}`).get();
    
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (err) {
    console.error("Erro ao obter dados do usuário:", err);
    return null;
  }
};

// Ir para painel admin
window.irParaAdmin = function() {
  window.location.href = "/admin.html";
};

// Inicializar quando o documento carregar
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarFirebaseAuth);
} else {
  inicializarFirebaseAuth();
}
