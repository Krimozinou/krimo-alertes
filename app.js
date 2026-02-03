// ===============================
// Krimo Alertes — app.js (COMPLET + STABLE Render)
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Carte Leaflet (points depuis /main.json)
// ✅ Zoom auto sur wilayas sélectionnées
// ✅ Fix Alger (Alger / Algiers)
// ✅ Icône météo dans le titre (pluie / orage / vent)
// ✅ Anti-bug Render sleep: garde la dernière donnée + retries
// ===============================

let map;
let markersLayer;

let wilayasIndex = null;          // Map(normalizedName -> {name, lat, lon})
let lastGoodAlert = null;         // dernière alerte OK (pour éviter écran "cassé")
let lastGoodWilayasIndex = null;  // dernier index OK
let consecutiveFails = 0;

// --------- Helpers ----------
function normalizeName(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

function badgeText(level) {
  return (
    level === "yellow" ? "🟡 Vigilance Jaune" :
    level === "orange" ? "🟠 Vigilance Orange" :
    level === "red" ? "🔴 Vigilance Rouge" :
    "⚠️ Alerte"
  );
}

function badgeClass(level, active) {
  return "badge " + (level || "none") + (active ? " blink" : "");
}

// Icône météo (simple et fiable)
function detectHazardIcon(data) {
  const t = normalizeName(data?.title || "");
  const m = normalizeName(data?.message || "");

  // orage / tempête
  if (t.includes("orage") || m.includes("orage") || t.includes("orageux") || m.includes("orageux")) return "⛈️";

  // vent
  if (t.includes("vent") || m.includes("vent") || t.includes("tempete") || m.includes("tempete")) return "💨";

  // pluie / inond
  if (t.includes("pluie") || m.includes("pluie") || t.includes("inond") || m.includes("inond")) return "🌧️";

  // fallback selon niveau
  if (data?.level === "red") return "🚨";
  if (data?.level === "orange") return "⚠️";
  if (data?.level === "yellow") return "🟡";
  return "";
}

// --------- Mini UI erreur ----------
function setLoadError(text) {
  // essaie d'utiliser un bloc existant si tu l'as
  let el =
    document.getElementById("loadError") ||
    document.getElementById("error") ||
    document.getElementById("errorBox");

  // si aucun bloc n'existe, on en crée un juste avant les boutons
  if (!el) {
    const copyBtn = document.getElementById("copyLinkBtn");
    const parent = copyBtn?.closest(".card") || document.body;
    el = document.createElement("div");
    el.id = "loadError";
    el.style.margin = "12px 0";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "10px";
    el.style.background = "#fff3cd";
    el.style.color = "#6b4e00";
    el.style.fontWeight = "600";
    // on le met avant la zone boutons si possible
    if (copyBtn && copyBtn.parentElement) {
      copyBtn.parentElement.parentElement?.insertBefore(el, copyBtn.parentElement);
    } else {
      parent.appendChild(el);
    }
  }

  el.textContent = text ? "⚠️ " + text : "";
  el.style.display = text ? "block" : "none";
}

// --------- Fetch JSON avec timeout + cache-bust ----------
async function fetchJSON(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(url + sep + "t=" + Date.now(), {
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// --------- Init carte ----------
function initMapIfNeeded() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;

  if (map) return;

  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: false
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  map.setView([28.0, 2.5], 5);

  setTimeout(() => map.invalidateSize(), 300);
}

// --------- Charger index wilayas depuis main.json ----------
async function loadWilayasIndex() {
  if (wilayasIndex) return wilayasIndex;

  const data = await fetchJSON("/main.json", 12000);

  const list = Array.isArray(data.wilayas) ? data.wilayas : [];
  const idx = new Map();

  for (const w of list) {
    const n = w.name || "";
    const lat = Number(w.latitude);
    const lon = Number(w.longitude);
    if (!n || !isFinite(lat) || !isFinite(lon)) continue;

    idx.set(normalizeName(n), { name: n, lat, lon });

    // alias Alger/Algiers
    if (normalizeName(n) === "algiers") idx.set("alger", { name: n, lat, lon });
    if (normalizeName(n) === "alger") idx.set("algiers", { name: n, lat, lon });
  }

  wilayasIndex = idx;
  lastGoodWilayasIndex = idx;

  return wilayasIndex;
}

// --------- Markers ----------
function clearMarkers() {
  if (markersLayer) markersLayer.clearLayers();
}

function addMarkersFor(wilayas, level) {
  if (!map || !markersLayer || !wilayasIndex) return;

  clearMarkers();

  const color =
    level === "red" ? "#e53935" :
    level === "orange" ? "#fb8c00" :
    level === "yellow" ? "#fdd835" :
    "#444";

  const bounds = [];

  for (const name of wilayas) {
    const key = normalizeName(name);
    const found = wilayasIndex.get(key);
    if (!found) continue;

    const marker = L.circleMarker([found.lat, found.lon], {
      radius: 9,
      color: color,
      fillColor: color,
      fillOpacity: 0.85,
      weight: 2
    }).addTo(markersLayer);

    marker.bindPopup("📍 " + (name || found.name));
    bounds.push([found.lat, found.lon]);
  }

  if (bounds.length === 1) {
    map.setView(bounds[0], 9);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [30, 30] });
  } else {
    map.setView([28.0, 2.5], 5);
  }

  setTimeout(() => map.invalidateSize(), 150);
}

// --------- Refresh UI (anti-Render sleep) ----------
async function refresh() {
  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  initMapIfNeeded();

  let data = null;

  // 1) Charger l'alerte
  try {
    data = await fetchJSON("/api/alert", 8000);
    lastGoodAlert = data;
    consecutiveFails = 0;
    setLoadError(""); // efface
  } catch (e) {
    consecutiveFails++;

    // si on a déjà une donnée OK, on continue à l'afficher
    if (lastGoodAlert) {
      data = lastGoodAlert;

      // on affiche juste un message "Render se réveille"
      setLoadError("Serveur en démarrage (Render) — les données vont revenir automatiquement…");
    } else {
      // rien à afficher => message clair
      setLoadError("Problème de chargement (api/alert). Réessaie dans quelques secondes…");
      return; // on sort, sans casser la page
    }
  }

  const level = data.level || "none";
  const active = !!data.active;

  const wilayas =
    Array.isArray(data.regions) ? data.regions :
    Array.isArray(data.zones) ? data.zones :
    Array.isArray(data.wilayas) ? data.wilayas :
    (data.region ? [data.region] : []);

  // Badge
  if (badge) badge.className = badgeClass(level, active);

  // Icône + titre
  const icon = detectHazardIcon(data);

  if (!active || level === "none") {
    if (badge) badge.textContent = "✅ Aucune alerte";
    if (title) title.textContent = (icon ? icon + " " : "") + "Aucune alerte";
    if (message) message.textContent = "";
    if (region) region.textContent = "";

    // on garde la carte, mais sans points
    clearMarkers();
  } else {
    if (badge) badge.textContent = badgeText(level);
    if (title) title.textContent = (icon ? icon + " " : "") + (data.title || "ALERTE MÉTÉO");
    if (message) message.textContent = data.message || "";
    if (region) region.textContent = wilayas.length ? "📍 Wilayas : " + wilayas.join(" - ") : "";

    // 2) Charger main.json (index)
    try {
      wilayasIndex = await loadWilayasIndex();
    } catch (e) {
      // si main.json échoue mais on avait déjà un index OK => on l'utilise
      if (lastGoodWilayasIndex) {
        wilayasIndex = lastGoodWilayasIndex;
        setLoadError("Serveur en démarrage (Render) — points en cours de retour…");
      } else {
        setLoadError("Problème de chargement (main.json).");
        return;
      }
    }

    addMarkersFor(wilayas, level);
  }

  // Date (garde la dernière si Render a dormi)
  if (updatedAt) {
    const iso = data.updatedAt || data.updated_at || data.lastUpdated || "";
    updatedAt.textContent = iso
      ? new Date(iso).toLocaleString("fr-FR")
      : "—";
  }
}

// --------- Boutons partage ----------
const shareFbBtn = document.getElementById("shareFbBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");

if (shareFbBtn) {
  shareFbBtn.addEventListener("click", () => {
    const url = encodeURIComponent(window.location.href);
    window.open("https://www.facebook.com/sharer/sharer.php?u=" + url, "_blank");
  });
}

if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Lien copié ✅");
    } catch {
      prompt("Copie manuelle :", window.location.href);
    }
  });
}

// --------- Start ----------
refresh();

// refresh normal
setInterval(refresh, 30000);

// petit retry rapide au démarrage (utile pour Render waking up)
setTimeout(refresh, 4000);
setTimeout(refresh, 9000);
