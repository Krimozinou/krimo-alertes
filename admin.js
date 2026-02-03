const loginBox = document.getElementById("loginBox");
const panel = document.getElementById("panel");
const loginMsg = document.getElementById("loginMsg");
const saveMsg = document.getElementById("saveMsg");
const logoutBtn = document.getElementById("logoutBtn");

async function loadCurrent() {
  const r = await fetch("/api/alert", { cache: "no-store" });
  const data = await r.json();

  document.getElementById("level").value = data.level || "none";
  document.getElementById("region").value = data.region || "Aucune";
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

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
  location.reload();
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  saveMsg.textContent = "Enregistrement...";

  const level = document.getElementById("level").value;
  const region = document.getElementById("region").value;
  const title = document.getElementById("title").value.trim();
  const message = document.getElementById("message").value.trim();

  const payload = {
    level,
    region,
    title: title || (level === "none" ? "Aucune alerte" : "ALERTE MÉTÉO"),
    message,
    updatedAt: new Date().toISOString()
  };

  const res = await fetch("/api/alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) {
    saveMsg.textContent = "❌ Erreur: " + (out.error || "Impossible");
    return;
  }

  saveMsg.textContent = "✅ Publié";
  setTimeout(() => (saveMsg.textContent = ""), 2000);
});

document.getElementById("disableBtn").addEventListener("click", async () => {
  saveMsg.textContent = "Désactivation...";

  const payload = {
    level: "none",
    region: "Aucune",
    title: "Aucune alerte",
    message: "",
    updatedAt: new Date().toISOString()
  };

  const res = await fetch("/api/alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) {
    saveMsg.textContent = "❌ Erreur: " + (out.error || "Impossible");
    return;
  }

  await loadCurrent();
  saveMsg.textContent = "✅ Alerte désactivée";
  setTimeout(() => (saveMsg.textContent = ""), 2000);
});
