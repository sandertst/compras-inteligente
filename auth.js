// auth.js — autenticação e gestão de usuários (Firebase compat, scripts globais)
// Carregado em: index.html e admin.html (nessa ordem: data.js -> firebase-config.js -> auth.js -> [script.js|admin.js])

const ADMIN_EMAIL = "sandertst@gmail.com";

// --- Inicialização do Firebase (síncrona, roda assim que o script carrega) ---
(function inicializarFirebase() {
  const cfg = window.firebaseSettings || {};
  if (!cfg.apiKey) {
    console.error("Firebase não configurado! Verifique o arquivo firebase-config.js.");
    return;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(cfg);
  }
})();

// --- Alternância genérica de telas (só age se os elementos existirem nesta página) ---
firebase.auth().onAuthStateChanged((user) => {
  const loginScreen = document.getElementById("screen-login");
  const appScreen = document.querySelector(".app");
  if (!loginScreen || !appScreen) return; // esta página (ex: admin.html) não usa essas telas

  if (user) {
    loginScreen.style.display = "none";
    appScreen.style.display = "flex";

    const adminBtn = document.getElementById("btnAdmin");
    if (adminBtn) adminBtn.style.display = (user.email === ADMIN_EMAIL) ? "inline-flex" : "none";

    const logoutBtn = document.querySelector(".btn-logout-sm");
    if (logoutBtn) logoutBtn.title = "Sair (" + user.email + ")";

    if (window.iniciarApp) window.iniciarApp(user.uid);
  } else {
    loginScreen.style.display = "flex";
    appScreen.style.display = "none";
  }
});

// --- Login ---
window.fazerLogin = async function (email, senha) {
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
    msgError.textContent =
      err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" ? "Email ou senha incorretos."
      : err.code === "auth/wrong-password" ? "Senha incorreta."
      : err.code === "auth/invalid-email" ? "Email inválido."
      : err.code === "auth/too-many-requests" ? "Muitas tentativas. Aguarde um pouco e tente de novo."
      : "Erro ao fazer login: " + err.message;
    msgError.style.display = "block";
  } finally {
    btnLogin.disabled = false;
    loader.style.display = "none";
  }
};

// --- Logout ---
window.fazerLogout = async function () {
  try {
    await firebase.auth().signOut();
  } catch (err) {
    console.error("Erro ao sair:", err);
  }
};

// --- Criar novo usuário (apenas admin) ---
// IMPORTANTE: usa um app Firebase SECUNDÁRIO para criar a conta.
// Isso evita um comportamento padrão do Firebase Auth em que criar um usuário
// pelo SDK do navegador loga automaticamente como esse novo usuário,
// o que derrubaria a sessão do admin. Com o app secundário, a sessão do
// admin no app principal nunca é afetada.
function obterAppSecundario() {
  const existente = firebase.apps.find((a) => a.name === "Secondary");
  if (existente) return existente;
  return firebase.initializeApp(window.firebaseSettings, "Secondary");
}

window.criarNovoUsuario = async function (nome, email, senha) {
  const adminAtual = firebase.auth().currentUser;
  if (!adminAtual || adminAtual.email !== ADMIN_EMAIL) {
    console.error("Apenas o admin pode criar usuários.");
    return false;
  }

  const appSecundario = obterAppSecundario();
  const authSecundario = appSecundario.auth();

  try {
    const result = await authSecundario.createUserWithEmailAndPassword(email, senha);

    // A escrita abaixo usa o app PRINCIPAL (onde o admin continua logado),
    // então as Regras do Realtime Database veem o admin como autor da escrita.
    await firebase.database().ref(`users/${result.user.uid}`).set({
      email: email,
      nome: nome,
      criadoEm: Date.now(),
      lista: {
        produtos: produtosPadrao.map((p) => ({ ...p, estoqueAtual: 0 })),
        checksComprados: {},
        precos: {},
      },
    });

    await authSecundario.signOut();
    return true;
  } catch (err) {
    console.error("Erro ao criar usuário:", err);
    let msg = "Erro ao criar usuário.";
    if (err.code === "auth/email-already-in-use") msg = "Este email já está cadastrado.";
    else if (err.code === "auth/invalid-email") msg = "Email inválido.";
    else if (err.code === "auth/weak-password") msg = "Senha muito fraca (mínimo 6 caracteres).";
    throw new Error(msg);
  }
};

// --- Ir para o painel admin ---
window.irParaAdmin = function () {
  window.location.href = "/admin.html";
};
