// ===============================
// Krimo Alertes — app.js (STABLE)
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Leaflet
// ✅ Zoom auto
// ✅ Fix Alger (Alger / Algiers)
// ✅ Icône météo dans le titre (pluie/orages/vent)
// ✅ ROBUSTE Render : cache + retry (api/alert & main.json)
// ===============================

let map;
let markersLayer;
let wilayasIndex = null; // Map(normalizedName -> {name, lat, lon})

const LS_ALERT_KEY = "krimo_last_alert_v1";
const LS_WILAYAS_KEY = "krimo_wilayas_index_v1";

// ---------- Helpers ----------
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

// Icône selon title/message
function detectHazardIcon(data) {
  const t = normalizeName(data?.title || "");
  const m = normalizeName(data?.message || "");

  // orage
  if (t.includes("orage") || m.includes("orage") || t.includes("orag") || m.includes("orag")) return "⛈️";
  // vent / tempête
  if (t.includes("vent") || m.includes("vent") || t.includes("tempete") || m.includes("tempete")) return "💨";
  // pluie / inond
  if (t.includes("pluie") || m.includes("pluie") || t.includes("inond") || m.includes("inond")) return "🌧️";

  // fallback selon niveau
  if (data?.level === "red") return "🚨";
  if (data?.level === "orange") return "⚠️";
  if (data?.level === "yellow") return "🟡";
  return "";
}

function getWilayasArray(data) {
  return (
    (Array.isArray(data?.regions) && data.regions) ||
    (Array.isArray(data?.zones) && data.zones) ||
    (Array.isArray(data?.wilayas) && data.wilayas) ||
    (data?.region ? [data.region] : [])
  );
}

// ---------- Mini fetch robuste ----------
async function fetchJsonWithRetry(url, opts = {}, tries = 3, timeoutMs = 9000) {
  let lastErr;

  for (let i = 0; i < tries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...opts,
        cache: "no-store",
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      // petite pause avant retry
      await new Promise(r => setTimeout(r, 400 + i * 500));
    }
  }

  throw lastErr;
}

// ---------- Init carte ----------
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

  // Vue Algérie
  map.setView([28.0, 2.5], 5);
  setTimeout(() => map.invalidateSize(), 300);
}

// ---------- Cache wilayasIndex ----------
function saveWilayasIndexToCache(idx) {
  try {
    const obj = {};
    for (const [k, v] of idx.entries()) obj[k] = v;
    localStorage.setItem(LS_WILAYAS_KEY, JSON.stringify(obj));
  } catch {}
}

function loadWilayasIndexFromCache() {
  try {
    const raw = localStorage.getItem(LS_WILAYAS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const idx = new Map();
    for (const k of Object.keys(obj)) idx.set(k, obj[k]);
    return idx.size ? idx : null;
  } catch {
    return null;
  }
}

// ---------- Charger index wilayas depuis main.json (avec cache + retry) ----------
async function loadWilayasIndexStable() {
  if (wilayasIndex) return wilayasIndex;

  // 1) cache local d’abord
  const cached = loadWilayasIndexFromCache();
  if (cached) {
    wilayasIndex = cached;
    // on tente quand même un refresh réseau en arrière-plan (sans casser si échec)
    refreshWilayasIndexInBackground();
    return wilayasIndex;
  }

  // 2) sinon réseau avec retry
  const data = await fetchJsonWithRetry("/main.json?ts=" + Date.now(), {}, 3, 12000);
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
  saveWilayasIndexToCache(idx);
  return wilayasIndex;
}

async function refreshWilayasIndexInBackground() {
  try {
    const data = await fetchJsonWithRetry("/main.json?ts=" + Date.now(), {}, 2, 10000);
    const list = Array.isArray(data.wilayas) ? data.wilayas : [];
    const idx = new Map();
    for (const w of list) {
      const n = w.name || "";
      const lat = Number(w.latitude);
      const lon = Number(w.longitude);
      if (!n || !isFinite(lat) || !isFinite(lon)) continue;
      idx.set(normalizeName(n), { name: n, lat, lon });
      if (normalizeName(n) === "algiers") idx.set("alger", { name: n, lat, lon });
      if (normalizeName(n) === "alger") idx.set("algiers", { name: n, lat, lon });
    }
    if (idx.size) {
      wilayasIndex = idx;
      saveWilayasIndexToCache(idx);
    }
  } catch {
    // on ignore : on garde le cache existant
  }
}

// ---------- Points ----------
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

// ---------- UI helpers ----------
function setLoadWarning(msg) {
  const el =
    document.getElementById("loadError") ||
    document.getElementById("error") ||
    document.getElementById("errorBox");

  if (!el) return;

  if (!msg) {
    el.style.display = "none";
    el.textContent = "";
  } else {
    el.style.display = "";
    el.textContent = msg;
  }
}

function saveLastAlert(data) {
  try {
    localStorage.setItem(LS_ALERT_KEY, JSON.stringify(data));
  } catch {}
}

function loadLastAlert() {
  try {
    const raw = localStorage.getItem(LS_ALERT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------- Refresh ----------
async function refresh() {
  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  // 0) Si on a un cache alert, on l’affiche immédiatement (zéro clignotement)
  const cachedAlert = loadLastAlert();
  if (cachedAlert) applyAlertToUI(cachedAlert, { fromCache: true });

  // 1) Charger api/alert (avec retry)
  let data;
  try {
    data = await fetchJsonWithRetry("/api/alert?ts=" + Date.now(), {}, 3, 12000);
    saveLastAlert(data);
  } catch (e) {
    // On garde le cache affiché, et on affiche un petit warning (sans casser l’heure)
    setLoadWarning("⚠️ Problème de chargement (api/alert).");
    return;
  }

  // api ok -> on enlève warning (on gérera main.json après)
  setLoadWarning("");

  // 2) Appliquer UI
  applyAlertToUI(data, { fromCache: false });

  // 3) Carte + points
  initMapIfNeeded();

  const active = !!data.active;
  const level = data.level || "none";
  const wilayas = getWilayasArray(data);

  if (!active || level === "none") {
    clearMarkers();
    return;
  }

  // 4) Charger main.json (stable)
  try {
    await loadWilayasIndexStable();
    addMarkersFor(wilayas, level);
    setLoadWarning("");
  } catch (e) {
    // IMPORTANT : on ne casse pas l’heure, on ne casse pas l’alerte
    // juste un warning, et on garde les points si on avait déjà un index en cache
    if (wilayasIndex) {
      // on a un index (cache) -> on essaie de placer quand même
      addMarkersFor(wilayas, level);
      setLoadWarning(""); // pas besoin d'affoler l’utilisateur
    } else {
      setLoadWarning("⚠️ Problème de chargement (main.json).");
      clearMarkers();
    }
  }

  // 5) Date (toujours à la fin)
  if (updatedAt) {
    updatedAt.textContent = data.updatedAt
      ? new Date(data.updatedAt).toLocaleString("fr-FR")
      : "—";
  }
}

function applyAlertToUI(data, { fromCache }) {
  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  const level = data.level || "none";
  const active = !!data.active;
  const wilayas = getWilayasArray(data);

  if (badge) badge.className = badgeClass(level, active);

  const icon = detectHazardIcon(data);

  if (!active || level === "none") {
    if (badge) badge.textContent = "✅ Aucune alerte";
    if (title) title.textContent = (icon ? icon + " " : "") + "Aucune alerte";
    if (message) message.textContent = "";
    if (region) region.textContent = "";
  } else {
    if (badge) badge.textContent = badgeText(level);
    if (title) title.textContent = (icon ? icon + " " : "") + (data.title || "ALERTE MÉTÉO");
    if (message) message.textContent = data.message || "";
    if (region) {
      region.textContent = wilayas.length ? "📍 Wilayas : " + wilayas.join(" - ") : "";
    }
  }

  // Date : si on est en cache, on affiche quand même la dernière date connue
  if (updatedAt && data.updatedAt) {
    updatedAt.textContent = new Date(data.updatedAt).toLocaleString("fr-FR");
  } else if (updatedAt && !fromCache) {
    updatedAt.textContent = "—";
  }
}

// ---------- Boutons ----------
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

// ---------- Start ----------
refresh();
setInterval(refresh, 30000);
