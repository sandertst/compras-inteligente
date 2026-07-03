import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

const cfg = window.firebaseSettings || {};
const app = initializeApp({
  apiKey: cfg.apiKey,
  authDomain: cfg.authDomain,
  databaseURL: cfg.databaseURL,
  projectId: cfg.projectId,
  appId: cfg.appId
});

const auth = getAuth(app);
const db = getDatabase(app);
const ADMIN_EMAIL = "sandertst@gmail.com";

// Monitorar estado de autenticação
onAuthStateChanged(auth, async (user) => {
  const loginScreen = document.getElementById("screen-login");
  const appScreen = document.querySelector(".app");
  
  if (user) {
    // Usuário logado
    loginScreen?.style.display = "none";
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
    loginScreen.style.display = "flex";
    appScreen.style.display = "none";
  }
});

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
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (err) {
    msgError.textContent = err.code === "auth/user-not-found" ? "Usuário não encontrado." 
                          : err.code === "auth/wrong-password" ? "Senha incorreta."
                          : "Erro ao fazer login.";
    msgError.style.display = "block";
  } finally {
    btnLogin.disabled = false;
    loader.style.display = "none";
  }
};

// Logout
window.fazerLogout = async function() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Erro ao logout:", err);
  }
};

// Criar novo usuário (apenas admin)
window.criarNovoUsuario = async function(nome, email, senha) {
  const user = auth.currentUser;
  if (!user || user.email !== ADMIN_EMAIL) {
    return false;
  }
  
  try {
    const result = await createUserWithEmailAndPassword(auth, email, senha);
    
    // Salvar dados do usuário no Realtime Database
    const userRef = ref(db, `users/${result.user.uid}`);
    await set(userRef, {
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
  const user = auth.currentUser;
  if (!user || user.email !== ADMIN_EMAIL) {
    return [];
  }
  
  try {
    const usersRef = ref(db, "users");
    const snapshot = await get(usersRef);
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
  const user = auth.currentUser;
  if (!user || user.email !== ADMIN_EMAIL) {
    return null;
  }
  
  try {
    const userRef = ref(db, `users/${uid}`);
    const snapshot = await get(userRef);
    
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

export { auth, db, ADMIN_EMAIL };
