const loginBox = document.getElementById("loginBox");
const panel = document.getElementById("panel");
const loginMsg = document.getElementById("loginMsg");
const saveMsg = document.getElementById("saveMsg");
const logoutBtn = document.getElementById("logoutBtn");

// ------- Helpers -------
function toLocalInputValue(iso) {
  // iso -> "YYYY-MM-DDTHH:MM"
  return iso ? iso.slice(0, 16) : "";
}

function toISOFromLocalInput(v) {
  // "YYYY-MM-DDTHH:MM" -> ISO (UTC)
  return v ? new Date(v).toISOString() : "";
}

function getSelectedRegions() {
  const zonesSel = document.getElementById("zones");
  return Array.from(zonesSel.selectedOptions).map((o) => o.value);
}

function setSelectedRegions(regions) {
  const zonesSel = document.getElementById("zones");
  const list = Array.isArray(regions) ? regions : [];
  for (const opt of zonesSel.options) {
    opt.selected = list.includes(opt.value);
  }
}

// ------- Load current alert -------
async function loadCurrent() {
  const r = await fetch("/api/alert", { cache: "no-store" });
  const data = await r.json();

  document.getElementById("level").value = data.level || "none";
  document.getElementById("title").value = data.title || "";
  document.getElementById("message").value = data.message || "";

  document.getElementById("startAt").value = toLocalInputValue(data.startAt);
  document.getElementById("endAt").value = toLocalInputValue(data.endAt);

  // ✅ multi wilayas: regions[] (compat si server renvoie encore region)
  const regions = Array.isArray(data.regions)
    ? data.regions
    : (data.region ? [data.region] : []);

  setSelectedRegions(regions);
}

// ------- Login -------
document.getElementById("loginBtn").addEventListener("click", async () => {
  loginMsg.textContent = "";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
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

// ------- Logout -------
logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
  location.reload();
});

// ------- Publier -------
document.getElementById("saveBtn").addEventListener("click", async () => {
  saveMsg.textContent = "Enregistrement...";
  saveMsg.style.color = "#111";

  const level = document.getElementById("level").value;
  const titleInput = document.getElementById("title").value.trim();
  const message = document.getElementById("message").value.trim();

  const startAtLocal = document.getElementById("startAt").value;
  const endAtLocal = document.getElementById("endAt").value;

  // ✅ regions multi
  const regions = getSelectedRegions();

  // ✅ titre par défaut propre
  const title =
    titleInput ||
    (level === "none" ? "Aucune alerte" : "ALERTE MÉTÉO");

  const payload = {
    level,
    // active est recalculé par server.js aussi, mais on laisse cohérent
    active: level !== "none",
    regions,                // ✅ nouveau champ officiel
    region: regions[0] || "",// ✅ compat (facultatif mais utile)
    title,
    message,
    startAt: toISOFromLocalInput(startAtLocal),
    endAt: toISOFromLocalInput(endAtLocal),
  };

  const res = await fetch("/api/alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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

// ------- Désactiver -------
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
    endAt: "",
  };

  const res = await fetch("/api/alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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

// ------- Recherche dans la liste -------
const zoneSearch = document.getElementById("zoneSearch");
zoneSearch.addEventListener("input", () => {
  const q = zoneSearch.value.trim().toLowerCase();
  const zonesSel = document.getElementById("zones");

  for (const opt of zonesSel.options) {
    opt.style.display = opt.value.toLowerCase().includes(q) ? "" : "none";
  }
});

// ------- Tout sélectionner / Tout enlever -------
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
