const loginBox = document.getElementById("loginBox");
const panel = document.getElementById("panel");
const loginMsg = document.getElementById("loginMsg");
const saveMsg = document.getElementById("saveMsg");
const logoutBtn = document.getElementById("logoutBtn");

async function loadCurrent() {
  const r = await fetch("/api/alert", { cache: "no-store" });
  const data = await r.json();
  document.getElementById("level").value = data.level || "none";
  document.getElementById("title").value = data.title || "";
  document.getElementById("message").value = data.message || "";
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  loginMsg.textContent = "";
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) {
    loginMsg.textContent = out.error || "Erreur de connexion";
    return;
  }

  loginBox.style.display = "none";
  panel.style.display = "block";
  logoutBtn.style.display = "inline-block";
  await loadCurrent();
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  saveMsg.textContent = "Enregistrement...";
  saveMsg.textContent = "Enregistrement...";

const level = document.getElementById("level").value;
const region = document.getElementById("region").value;
const title = document.getElementById("title").value.trim();
const message = document.getElementById("message").value.trim();

const payload = {
  level,
  active: level !== "none",
  region,
  title: title || (level === "none" ? "Aucune alerte" : "ALERTE MÉTÉO"),
  message
};

  const res = await fetch("/api/admin/alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) {
    saveMsg.textContent = out.error || "Erreur";
    return;
  }
  saveMsg.textContent = "✅ Publié !";
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  panel.style.display = "none";
  loginBox.style.display = "block";
  logoutBtn.style.display = "none";
});
