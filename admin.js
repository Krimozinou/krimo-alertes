const loginBox = document.getElementById("loginBox");
const panel = document.getElementById("panel");
const loginMsg = document.getElementById("loginMsg");
const saveMsg = document.getElementById("saveMsg");
const logoutBtn = document.getElementById("logoutBtn");

function toDatetimeLocal(iso) {
  if (!iso) return "";
  // iso -> "YYYY-MM-DDTHH:MM"
  return iso.slice(0, 16);
}

function toISO(dtLocal) {
  // "YYYY-MM-DDTHH:MM" -> ISO
  if (!dtLocal) return "";
  return new Date(dtLocal).toISOString();
}

async function loadCurrent() {
  const r = await fetch("/api/alert", { cache: "no-store" });
  const data = await r.json();

  document.getElementById("level").value = data.level || "none";
  document.getElementById("region").value = data.region || "OUEST";
  document.getElementById("title").value = data.title || "";
  document.getElementById("message").value = data.message || "";

  document.getElementById("startAt").value = toDatetimeLocal(data.startAt);
  document.getElementById("endAt").value = toDatetimeLocal(data.endAt);
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

  const startAtLocal = document.getElementById("startAt").value;
  const endAtLocal = document.getElementById("endAt").value;

  const payload = {
    level,
    region,
    title: title || (level === "none" ? "Aucune alerte" : "ALERTE MÉTÉO"),
    message: message || "",
    startAt: toISO(startAtLocal),
    endAt: toISO(endAtLocal)
  };

  const res = await fetch("/api/alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) {
    saveMsg.textContent = out.error || "Erreur";
    return;
  }

  saveMsg.textContent = "✅ Publié";
  setTimeout(() => (saveMsg.textContent = ""), 2000);
});

document.getElementById("disableBtn").addEventListener("click", async () => {
  saveMsg.textContent = "Désactivation...";

  const res = await fetch("/api/disable", {
    method: "POST"
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) {
    saveMsg.textContent = out.error || "Erreur";
    return;
  }

  await loadCurrent();
  saveMsg.textContent = "✅ Désactivée";
  setTimeout(() => (saveMsg.textContent = ""), 2000);
});
