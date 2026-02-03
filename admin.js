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

  // ✅ regions (multi)
  const regionsSel = document.getElementById("zones"); // ton select multi garde id="zones"
  const regions = Array.isArray(data.regions)
    ? data.regions
    : (data.region ? [data.region] : []);

  for (const opt of regionsSel.options) {
    opt.selected = regions.includes(opt.value);
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

  // ✅ multi regions
  const regionsSel = document.getElementById("zones");
  const regions = Array.from(regionsSel.selectedOptions).map(o => o.value);

  const payload = {
    level,
    active: level !== "none",
    regions,
    region: regions[0] || "", // compat
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
    regions: [],
    region: "",
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

// ✅ Recherche
const zoneSearch = document.getElementById("zoneSearch");
zoneSearch.addEventListener("input", () => {
  const q = zoneSearch.value.trim().toLowerCase();
  const regionsSel = document.getElementById("zones");
  for (const opt of regionsSel.options) {
    opt.style.display = opt.value.toLowerCase().includes(q) ? "" : "none";
  }
});

// ✅ Tout sélectionner / tout enlever
document.getElementById("selectAllBtn").addEventListener("click", () => {
  const regionsSel = document.getElementById("zones");
  for (const opt of regionsSel.options) {
    if (opt.style.display !== "none") opt.selected = true;
  }
});

document.getElementById("clearAllBtn").addEventListener("click", () => {
  const regionsSel = document.getElementById("zones");
  for (const opt of regionsSel.options) opt.selected = false;
});
