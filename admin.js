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

  document.getElementById("startAt").value = data.startAt ? data.startAt.slice(0,16) : "";
  document.getElementById("endAt").value = data.endAt ? data.endAt.slice(0,16) : "";

  // ✅ zones (multi)
  const zonesSel = document.getElementById("zones");
  const zones = Array.isArray(data.zones) ? data.zones : (data.region ? [data.region] : []);

  for (const opt of zonesSel.options) {
    opt.selected = zones.includes(opt.value);
  }
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

// ✅ Publier
document.getElementById("saveBtn").addEventListener("click", async () => {
  saveMsg.textContent = "Enregistrement...";
  saveMsg.style.color = "#111";

  const level = document.getElementById("level").value;
  const title = document.getElementById("title").value.trim();
  const message = document.getElementById("message").value.trim();

  const startAt = document.getElementById("startAt").value;
  const endAt = document.getElementById("endAt").value;

  // ✅ multi zones
  const zonesSel = document.getElementById("zones");
  const zones = Array.from(zonesSel.selectedOptions).map(o => o.value);

  const payload = {
    level,
    active: level !== "none",
    zones,
    title: title || (level === "none" ? "Aucune alerte" : "ALERTE MÉTÉO"),
    message,
    startAt: startAt ? new Date(startAt).toISOString() : "",
    endAt: endAt ? new Date(endAt).toISOString() : ""
  };

  const res = await fetch("/api/alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) {
    saveMsg.textContent = out.error || "Erreur";
    saveMsg.style.color = "#b00020";
    return;
  }

  saveMsg.textContent = "Publié ✅";
  saveMsg.style.color = "#1b7f2a";
});

// ✅ Désactiver
document.getElementById("disableBtn").addEventListener("click", async () => {
  saveMsg.textContent = "Désactivation...";
  saveMsg.style.color = "#111";

  const payload = {
    active: false,
    level: "none",
    zones: [],
    title: "Aucune alerte",
    message: "",
    startAt: "",
    endAt: ""
  };

  const res = await fetch("/api/alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) {
    saveMsg.textContent = out.error || "Erreur";
    saveMsg.style.color = "#b00020";
    return;
  }

  saveMsg.textContent = "Désactivé ✅";
  saveMsg.style.color = "#1b7f2a";
  await loadCurrent();
});

// ✅ Filtre recherche dans la liste
const zoneSearch = document.getElementById("zoneSearch");
zoneSearch.addEventListener("input", () => {
  const q = zoneSearch.value.trim().toLowerCase();
  const zonesSel = document.getElementById("zones");
  for (const opt of zonesSel.options) {
    opt.style.display = opt.value.toLowerCase().includes(q) ? "" : "none";
  }
});

// ✅ Tout sélectionner / Tout enlever
document.getElementById("selectAllBtn").addEventListener("click", () => {
  const zonesSel = document.getElementById("zones");
  for (const opt of zonesSel.options) {
    if (opt.style.display !== "none") opt.selected = true;
  }
});

document.getElementById("clearAllBtn").addEventListener("click", () => {
  const zonesSel = document.getElementById("zones");
  for (const opt of zonesSel.options) opt.selected = false;
});
