// ===============================
// Krimo Alertes — app.js (FIX erreur main.json + points)
// ✅ L'heure (updatedAt) ne dépend PAS de main.json
// ✅ L'erreur main.json ne s'affiche QUE si main.json échoue vraiment
// ✅ Cache local main.json pour stabilité Render
// ===============================

let map;
let markersLayer;
let wilayasIndex = null;

const LS_WILAYAS_KEY = "krimo_wilayas_index_v2";

let mainJsonLoadedOnce = false; // ✅ important: évite erreur fantôme

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

function detectHazardIcon(data) {
  const t = normalizeName(data?.title || "");
  const m = normalizeName(data?.message || "");

  if (t.includes("orage") || m.includes("orage") || t.includes("orag") || m.includes("orag")) return "⛈️";
  if (t.includes("vent") || m.includes("vent") || t.includes("tempete") || m.includes("tempete")) return "💨";
  if (t.includes("pluie") || m.includes("pluie") || t.includes("inond") || m.includes("inond")) return "🌧️";

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

function setLoadWarning(msg) {
  // adapte aux IDs possibles chez toi
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

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function initMapIfNeeded() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;
  if (map) return;

  map = L.map("map", { zoomControl: true, scrollWheelZoom: false });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  map.setView([28.0, 2.5], 5);
  setTimeout(() => map.invalidateSize(), 300);
}

function clearMarkers() {
  if (markersLayer) markersLayer.clearLayers();
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

function saveWilayasIndexToCache(idx) {
  try {
    const obj = {};
    for (const [k, v] of idx.entries()) obj[k] = v;
    localStorage.setItem(LS_WILAYAS_KEY, JSON.stringify(obj));
  } catch {}
}

async function loadWilayasIndexStable() {
  if (wilayasIndex) return wilayasIndex;

  // ✅ 1) cache d’abord
  const cached = loadWilayasIndexFromCache();
  if (cached) {
    wilayasIndex = cached;
    return wilayasIndex;
  }

  // ✅ 2) réseau ensuite
  const data = await fetchJson("/main.json?ts=" + Date.now(), 12000);
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
      weight: 2,
    }).addTo(markersLayer);

    marker.bindPopup("📍 " + (name || found.name));
    bounds.push([found.lat, found.lon]);
  }

  if (bounds.length === 1) map.setView(bounds[0], 9);
  else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
  else map.setView([28.0, 2.5], 5);

  setTimeout(() => map.invalidateSize(), 150);
}

function applyAlertToUI(data) {
  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  const level = data.level || "none";
  const active = !!data.active;
  const wilayas = getWilayasArray(data);
  const icon = detectHazardIcon(data);

  if (badge) {
    badge.className = "badge " + (level || "none") + (active ? " blink" : "");
    badge.textContent =
      level === "red" ? "🔴 Vigilance Rouge" :
      level === "orange" ? "🟠 Vigilance Orange" :
      level === "yellow" ? "🟡 Vigilance Jaune" :
      "✅ Aucune alerte";
  }

  if (!active || level === "none") {
    if (title) title.textContent = (icon ? icon + " " : "") + "Aucune alerte";
    if (region) region.textContent = "";
    if (message) message.textContent = "";
  } else {
    if (title) title.textContent = (icon ? icon + " " : "") + (data.title || "ALERTE MÉTÉO");
    if (region) region.textContent = wilayas.length ? "📍 Wilayas : " + wilayas.join(" - ") : "";
    if (message) message.textContent = data.message || "";
  }

  // ✅ L'heure ne dépend que de api/alert
  if (updatedAt) {
    updatedAt.textContent = data.updatedAt
      ? new Date(data.updatedAt).toLocaleString("fr-FR")
      : "—";
  }
}

async function refresh() {
  // ✅ 1) charge api/alert → met l'heure (toujours)
  let data;
  try {
    data = await fetchJson("/api/alert?ts=" + Date.now(), 12000);
    setLoadWarning(""); // api ok
  } catch {
    setLoadWarning("⚠️ Problème de chargement (api/alert).");
    return;
  }

  applyAlertToUI(data);

  initMapIfNeeded();

  const active = !!data.active;
  const level = data.level || "none";
  const wilayas = getWilayasArray(data);

  // ✅ Pas d'alerte → pas besoin main.json, pas de message main.json
  if (!active || level === "none") {
    clearMarkers();
    setLoadWarning(""); // ✅ pas d'erreur quand aucune alerte
    return;
  }

  // ✅ 2) alerte active → on tente main.json
  try {
    await loadWilayasIndexStable();
    mainJsonLoadedOnce = true;     // ✅ si ça a réussi au moins une fois
    setLoadWarning("");            // ✅ effacer l’erreur main.json
    addMarkersFor(wilayas, level);
  } catch {
    // ✅ IMPORTANT : on n’affiche l’erreur main.json QUE si ça n’a jamais réussi
    if (!mainJsonLoadedOnce) {
      setLoadWarning("⚠️ Problème de chargement (main.json).");
      clearMarkers();
    } else {
      // si on a déjà réussi une fois : on ne pollue plus l’écran avec l’erreur
      // et on garde éventuellement les anciens points
      setLoadWarning("");
    }
  }
}

// boutons (si présents)
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

refresh();
setInterval(refresh, 30000);
