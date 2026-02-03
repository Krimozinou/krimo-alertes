// ===============================
// Krimo Alertes — app.js (COMPLET + main.json STABLE)
// ✅ Multi-wilayas
// ✅ Leaflet + points depuis /main.json
// ✅ Fix Alger
// ✅ Icône météo
// ✅ Anti-Render sleep: garde dernière alerte + cache main.json localStorage
// ===============================

let map;
let markersLayer;

let wilayasIndex = null;
let lastGoodAlert = null;
let lastGoodWilayasIndex = null;

const MAINJSON_CACHE_KEY = "krimo_mainjson_cache_v1";

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

function detectHazardIcon(data) {
  const t = normalizeName(data?.title || "");
  const m = normalizeName(data?.message || "");

  if (t.includes("orage") || m.includes("orage") || t.includes("orageux") || m.includes("orageux")) return "⛈️";
  if (t.includes("vent") || m.includes("vent") || t.includes("tempete") || m.includes("tempete")) return "💨";
  if (t.includes("pluie") || m.includes("pluie") || t.includes("inond") || m.includes("inond")) return "🌧️";

  if (data?.level === "red") return "🚨";
  if (data?.level === "orange") return "⚠️";
  if (data?.level === "yellow") return "🟡";
  return "";
}

// --------- UI erreur ----------
function setLoadError(text) {
  let el =
    document.getElementById("loadError") ||
    document.getElementById("error") ||
    document.getElementById("errorBox");

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
async function fetchJSON(url, timeoutMs = 15000) {
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

  map = L.map("map", { zoomControl: true, scrollWheelZoom: false });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  map.setView([28.0, 2.5], 5);
  setTimeout(() => map.invalidateSize(), 300);
}

// --------- Construire l'index wilayas à partir d'un JSON main.json ----------
function buildWilayasIndexFromMainJson(data) {
  const list = Array.isArray(data?.wilayas) ? data.wilayas : [];
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

  return idx;
}

// --------- Charger main.json (avec RETRY + cache localStorage) ----------
async function loadWilayasIndex() {
  if (wilayasIndex) return wilayasIndex;

  // 1) essayer de charger depuis le cache localStorage (instantané)
  try {
    const cached = localStorage.getItem(MAINJSON_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      const idx = buildWilayasIndexFromMainJson(data);
      if (idx && idx.size > 0) {
        wilayasIndex = idx;
        lastGoodWilayasIndex = idx;
      }
    }
  } catch {}

  // 2) essayer de récupérer le vrai main.json (3 tentatives)
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const data = await fetchJSON("/main.json", 25000); // timeout plus long
      // stocker en cache pour les prochains "sleep"
      try {
        localStorage.setItem(MAINJSON_CACHE_KEY, JSON.stringify(data));
      } catch {}

      const idx = buildWilayasIndexFromMainJson(data);
      wilayasIndex = idx;
      lastGoodWilayasIndex = idx;
      return wilayasIndex;
    } catch (e) {
      lastErr = e;
      // petite pause entre tentatives
      await new Promise(r => setTimeout(r, attempt * 800));
    }
  }

  // 3) si fetch échoue, mais on a déjà un index (cache ou ancien) => on l'utilise sans “casser”
  if (wilayasIndex && wilayasIndex.size > 0) return wilayasIndex;
  if (lastGoodWilayasIndex && lastGoodWilayasIndex.size > 0) {
    wilayasIndex = lastGoodWilayasIndex;
    return wilayasIndex;
  }

  throw lastErr || new Error("main.json introuvable");
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
      color,
      fillColor: color,
      fillOpacity: 0.85,
      weight: 2
    }).addTo(markersLayer);

    marker.bindPopup("📍 " + (name || found.name));
    bounds.push([found.lat, found.lon]);
  }

  if (bounds.length === 1) map.setView(bounds[0], 9);
  else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
  else map.setView([28.0, 2.5], 5);

  setTimeout(() => map.invalidateSize(), 150);
}

// --------- Refresh UI ----------
async function refresh() {
  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  initMapIfNeeded();

  // 1) Charger l'alerte
  let data;
  try {
    data = await fetchJSON("/api/alert", 12000);
    lastGoodAlert = data;
  } catch {
    if (lastGoodAlert) {
      data = lastGoodAlert;
      setLoadError("Serveur en démarrage (Render) — les données reviennent…");
    } else {
      setLoadError("Problème de chargement (api/alert).");
      return;
    }
  }

  const level = data.level || "none";
  const active = !!data.active;

  const wilayas =
    Array.isArray(data.regions) ? data.regions :
    Array.isArray(data.zones) ? data.zones :
    Array.isArray(data.wilayas) ? data.wilayas :
    (data.region ? [data.region] : []);

  if (badge) badge.className = badgeClass(level, active);

  const icon = detectHazardIcon(data);

  if (!active || level === "none") {
    if (badge) badge.textContent = "✅ Aucune alerte";
    if (title) title.textContent = (icon ? icon + " " : "") + "Aucune alerte";
    if (message) message.textContent = "";
    if (region) region.textContent = "";
    clearMarkers();
  } else {
    if (badge) badge.textContent = badgeText(level);
    if (title) title.textContent = (icon ? icon + " " : "") + (data.title || "ALERTE MÉTÉO");
    if (message) message.textContent = data.message || "";
    if (region) region.textContent = wilayas.length ? "📍 Wilayas : " + wilayas.join(" - ") : "";

    // 2) Charger main.json (cache + retry)
    try {
      wilayasIndex = await loadWilayasIndex();
      setLoadError(""); // efface car on a l'index
      addMarkersFor(wilayas, level);
    } catch {
      // si on a au moins un cache utilisable, on n'affiche pas l'erreur
      if (wilayasIndex && wilayasIndex.size > 0) {
        setLoadError("");
        addMarkersFor(wilayas, level);
      } else {
        setLoadError("Problème de chargement (main.json).");
      }
    }
  }

  // Date
  if (updatedAt) {
    const iso = data.updatedAt || data.updated_at || data.lastUpdated || "";
    updatedAt.textContent = iso ? new Date(iso).toLocaleString("fr-FR") : "—";
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
setInterval(refresh, 30000);

// retries rapides (utile quand Render se réveille)
setTimeout(refresh, 4000);
setTimeout(refresh, 9000);
setTimeout(refresh, 15000);
