const $ = (id) => document.getElementById(id);
const DB_KEY = "passcode_portal_accounts_v1";

let mode = "signup";
let activeUser = null;
let stage = 1;
let gameTimer = null;
let gameRunning = false;
let score = 0;
let remaining = 30;
let target = { x: 300, y: 200, r: 22 };

const requirements = {
  2: [
    { text: "Pelo menos 8 caracteres", test: value => value.length >= 8 },
    { text: "Uma letra maiúscula", test: value => /[A-Z]/.test(value) },
    { text: "Pelo menos um número", test: value => /[0-9]/.test(value) }
  ],
  3: [
    { text: "Pelo menos 12 caracteres", test: value => value.length >= 12 },
    { text: "Duas letras maiúsculas", test: value => (value.match(/[A-Z]/g) || []).length >= 2 },
    { text: "Dois números ou mais", test: value => (value.match(/[0-9]/g) || []).length >= 2 },
    { text: "Um símbolo especial", test: value => /[^A-Za-z0-9]/.test(value) },
    { text: "Sem espaços", test: value => !/\s/.test(value) }
  ]
};

function readDB() {
  try { return JSON.parse(localStorage.getItem(DB_KEY) || "{}"); }
  catch { return {}; }
}

function writeDB(database) {
  localStorage.setItem(DB_KEY, JSON.stringify(database));
}

async function hash(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function showPanel(panelId) {
  ["authPanel", "stagePanel", "finalPanel"].forEach(id => {
    $(id).classList.toggle("hidden", id !== panelId);
  });
}

function setMessage(id, message, good = false) {
  $(id).textContent = message;
  $(id).classList.toggle("good", good);
}

function setMode(nextMode) {
  mode = nextMode;
  $("signupTab").classList.toggle("active", mode === "signup");
  $("loginTab").classList.toggle("active", mode === "login");
  $("authButton").textContent = mode === "signup" ? "INICIALIZAR CONTA →" : "AUTENTICAR →";
  $("mainPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
  $("authMessage").textContent = "";
}

$("signupTab").addEventListener("click", () => setMode("signup"));
$("loginTab").addEventListener("click", () => setMode("login"));

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const username = $("username").value.trim();
  const password = $("mainPassword").value;

  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
    setMessage("authMessage", "Use de 3 a 20 caracteres: letras, números, _ ou -.");
    return;
  }
  if (password.length < 6) {
    setMessage("authMessage", "A senha principal precisa ter pelo menos 6 caracteres.");
    return;
  }

  const database = readDB();
  const key = username.toLowerCase();
  const passwordHash = await hash(password);

  if (mode === "signup") {
    if (database[key]) {
      setMessage("authMessage", "Esse identificador já existe neste navegador.");
      return;
    }
    database[key] = { username, main: passwordHash, keys: {}, completed: 0, best: 0 };
    writeDB(database);
    activeUser = key;
    stage = 2;
    openStage();
    return;
  }

  if (!database[key] || database[key].main !== passwordHash) {
    setMessage("authMessage", "Identificador ou senha incorretos.");
    return;
  }

  activeUser = key;
  if (database[key].completed >= 3) {
    openFinal();
    return;
  }
  stage = Math.max(2, database[key].completed + 2);
  openStage();
});

function openStage() {
  const database = readDB();
  const data = database[activeUser];
  if (!data) {
    showPanel("authPanel");
    return;
  }

  showPanel("stagePanel");
  $("currentUser").textContent = data.username;
  $("stagePassword").value = "";
  setMessage("stageMessage", "");
  $("progressCount").textContent = String(stage).padStart(2, "0") + " / 03";
  $("progressBar").style.width = (stage / 3 * 100) + "%";
  $("stageTag").textContent = "CAMADA 0" + stage;
  $("stageEyebrow").textContent = stage === 2 ? "Segunda camada" : "Terceira camada";
  $("stageTitle").innerHTML = stage === 2
    ? 'A segunda chave<span class="accent">.</span>'
    : 'Última verificação<span class="accent">.</span>';
  $("stageDescription").textContent = stage === 2
    ? "Uma nova camada foi ativada. Crie uma senha que cumpra todos os requisitos."
    : "Você chegou à última camada. Esta chave exige ainda mais atenção.";

  renderRules("");
}

function renderRules(value) {
  const list = requirements[stage] || [];
  $("rules").innerHTML = list.map(rule =>
    '<div class="rule ' + (rule.test(value) ? "ok" : "") + '">' +
      '<span class="rule-dot"></span><span>' + rule.text + '</span></div>'
  ).join("");
  $("stageButton").disabled = !list.every(rule => rule.test(value));
}

$("stagePassword").addEventListener("input", event => {
  renderRules(event.target.value);
  setMessage("stageMessage", "");
});

$("stageForm").addEventListener("submit", async event => {
  event.preventDefault();

  const value = $("stagePassword").value;
  const list = requirements[stage];
  if (!list.every(rule => rule.test(value))) return;

  const database = readDB();
  const data = database[activeUser];
  const passwordHash = await hash(value);

  if (Object.values(data.keys).includes(passwordHash)) {
    setMessage("stageMessage", "Esta chave já foi usada em outra camada. Escolha outra.");
    return;
  }

  data.keys["stage" + stage] = passwordHash;
  data.completed = stage - 1;
  writeDB(database);

  if (stage === 2) {
    stage = 3;
    openStage();
  } else {
    data.completed = 3;
    writeDB(database);
    openFinal();
  }
});

function openFinal() {
  showPanel("finalPanel");
  const database = readDB();
  $("best").textContent = database[activeUser]?.best || 0;
  drawGame();
  stopGame();
}

function drawGame() {
  const canvas = $("game");
  const context = canvas.getContext("2d");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#142b3b";
  context.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += 30) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 0; y < canvas.height; y += 30) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  const glow = context.createRadialGradient(target.x, target.y, 2, target.x, target.y, target.r * 2.2);
  glow.addColorStop(0, "#a9fff5");
  glow.addColorStop(.35, "#5de4df");
  glow.addColorStop(1, "#5de4df00");

  context.fillStyle = glow;
  context.beginPath();
  context.arc(target.x, target.y, target.r * 2.2, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#a9fff5";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(target.x, target.y, target.r, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#dffffb";
  context.beginPath();
  context.arc(target.x, target.y, 4, 0, Math.PI * 2);
  context.fill();
}

function moveTarget() {
  target = {
    x: 35 + Math.random() * 530,
    y: 35 + Math.random() * 340,
    r: 17 + Math.random() * 9
  };
  drawGame();
}

function stopGame() {
  if (gameTimer) clearInterval(gameTimer);
  gameTimer = null;
  gameRunning = false;
}

function startGame() {
  stopGame();
  score = 0;
  remaining = 30;
  gameRunning = true;
  $("score").textContent = score;
  $("time").textContent = remaining;
  moveTarget();

  gameTimer = setInterval(() => {
    remaining--;
    $("time").textContent = remaining;

    if (remaining <= 0) {
      stopGame();
      const database = readDB();
      if (database[activeUser]) {
        database[activeUser].best = Math.max(database[activeUser].best || 0, score);
        writeDB(database);
      }
      $("best").textContent = database[activeUser]?.best || score;
      drawGame();
    }
  }, 1000);
}

$("game").addEventListener("click", event => {
  if (!gameRunning) return;

  const rect = $("game").getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * 600;
  const y = (event.clientY - rect.top) / rect.height * 410;

  if (Math.hypot(x - target.x, y - target.y) <= target.r + 8) {
    score++;
    $("score").textContent = score;
    moveTarget();
  }
});

$("playAgain").addEventListener("click", startGame);

function logout() {
  stopGame();
  activeUser = null;
  $("authForm").reset();
  $("stageForm").reset();
  setMode("login");
  showPanel("authPanel");
}

$("logout").addEventListener("click", logout);
$("logoutFinal").addEventListener("click", logout);
