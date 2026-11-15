const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "northstar_portal_accounts_v1";
let extraAccounts = [];

$("year").textContent = new Date().getFullYear();

function readLocalAccounts() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function saveLocalAccounts(accounts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

async function loadExtraAccounts() {
  try {
    const response = await fetch("senhas.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível carregar senhas.json");
    const data = await response.json();
    extraAccounts = Array.isArray(data.accounts) ? data.accounts : [];
  } catch {
    extraAccounts = [];
    console.info("senhas.json não foi carregado. O cadastro local continua funcionando.");
  }
}

function setMode(mode) {
  const signup = mode === "signup";
  $("signupForm").classList.toggle("hidden", !signup);
  $("loginForm").classList.toggle("hidden", signup);
  $("signupTab").classList.toggle("active", signup);
  $("loginTab").classList.toggle("active", !signup);
  $("signupTab").setAttribute("aria-selected", String(signup));
  $("loginTab").setAttribute("aria-selected", String(!signup));
  $("formEyebrow").textContent = signup ? "COMECE POR AQUI" : "BEM-VINDO DE VOLTA";
  $("formTitle").textContent = signup ? "Criar sua conta" : "Entrar no portal";
  $("formDescription").textContent = signup
    ? "Preencha seus dados para fazer seu cadastro."
    : "Informe seu usuário e sua senha para acessar.";
  $("feedback").textContent = "";
  $("feedback").classList.remove("good");
}

function showSuccess() {
  $("authCard").classList.add("hidden");
  $("successCard").classList.remove("hidden");
}

function showAuth(mode = "login") {
  $("successCard").classList.add("hidden");
  $("authCard").classList.remove("hidden");
  setMode(mode);
}

$("signupTab").addEventListener("click", () => setMode("signup"));
$("loginTab").addEventListener("click", () => setMode("login"));
$("goLogin").addEventListener("click", () => {
  $("loginForm").reset();
  showAuth("login");
  $("loginUsername").focus();
});

$("signupForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const name = $("fullName").value.trim();
  const email = $("email").value.trim().toLowerCase();
  const username = $("signupUsername").value.trim();
  const password = $("signupPassword").value;
  const confirmation = $("confirmPassword").value;

  if (name.length < 2) return showFeedback("Informe seu nome completo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showFeedback("Digite um e-mail válido.");
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) return showFeedback("O usuário deve ter de 3 a 20 caracteres: letras, números, _ ou -.");
  if (password.length < 6) return showFeedback("A senha precisa ter pelo menos 6 caracteres.");
  if (password !== confirmation) return showFeedback("As senhas não são iguais.");

  const accounts = readLocalAccounts();
  const key = username.toLowerCase();
  const usernameInJson = extraAccounts.some(account =>
    String(account.username || "").toLowerCase() === key
  );

  if (accounts[key] || usernameInJson) {
    return showFeedback("Esse nome de usuário já está cadastrado.");
  }

  accounts[key] = { name, email, username, password };
  try {
    saveLocalAccounts(accounts);
  } catch {
    return showFeedback("Não foi possível salvar o cadastro neste navegador.");
  }

  $("signupForm").reset();
  showSuccess();
});

$("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const username = $("loginUsername").value.trim();
  const password = $("loginPassword").value;
  const key = username.toLowerCase();
  const localAccount = readLocalAccounts()[key];

  const localMatch = localAccount && localAccount.password === password;
  const jsonMatch = extraAccounts.some(account =>
    String(account.username || "").toLowerCase() === key &&
    String(account.password ?? "") === password
  );

  if (localMatch || jsonMatch) {
    $("loginForm").reset();
    showFeedback("Login realizado com sucesso!", true);
    return;
  }

  showFeedback("Usuário ou senha incorretos.");
});

function showFeedback(message, success = false) {
  $("feedback").textContent = message;
  $("feedback").classList.toggle("good", success);
}

loadExtraAccounts();
setMode("signup");
