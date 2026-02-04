// ===============================
// Krimo Alertes — app.js (STABLE)
// - Retry /api/alert + /main.json (Render cold start)
// - Cache bust + no-store
// - Points wilayas depuis main.json
// - Heure en Africa/Algiers
// ===============================

let map;
let markers = [];
let wilayasIndex = null;

const DEFAULT_VIEW = { lat: 28.0, lon: 2.5, zoom: 5 };

// ---- Helpers DOM
const $ = (id) => document.getElementById(id);

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "";
}
function setHTML(id, value) {
  const el = $(id);
  if (el) el.innerHTML = value ?? "";
}
function showError(msg) {
  // zone erreur si tu as un bloc #error, sinon on crée un message simple
  let el = $("error");
  if (!el) {
    // tente d'ajouter sous la carte
    const parent = document.body;
    el = document.createElement("div");
    el.id = "error";
    el.style.marginTop = "12px";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "12px";
    el.style.fontWeight = "700";
    el.style.background = "#fde68a";
    el.style.color = "#111827";
    el.style.maxWidth = "900px";
    el.style.marginLeft = "auto";
    el.style.marginRight = "auto";
    parent.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = "block";
}
function hideError() {
  const el = $("error");
  if (el) el.style.display = "none";
}

// ---- Normalisation noms
function normalizeName(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[’']/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

// ---- Badge
function badgeText(level) {
  if (level === "yellow") return "🟡 Vigilance Jaune";
  if (level === "orange") return "🟠 Vigilance Orange";
  if (level === "red") return "🔴 Vigilance Rouge";
  return "✅ Aucune alerte";
}
function badgeClass(level, active) {
  const base = "badge";
  const lvl = level || "none";
  const blink = active ? " blink" : "";
  return `${base} ${lvl}${blink}`;
}

// ---- Icône météo dans le titre
function detectHazardIcon(data) {
  const t = normalizeName(data?.title || "");
  const m = normalizeName(data?.message || "");

  if (t.includes("orage") || m.includes("orage")) return "⛈️";
  if (
    t.includes("vent") ||
    m.includes("vent") ||
    t.includes("tempete") ||
    m.includes("tempete")
  )
    return "💨";
  if (t.includes("pluie") || m.includes("pluie") || t.includes("inond") || m.includes("inond"))
    return "🌧️";

  if (data?.level === "red") return "🚨";
  if (data?.level === "orange") return "⚠️";
  if (data?.level === "yellow") return "🟡";
  return "✅";
}

// ---- Time format Algérie
function formatDZ(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Africa/Algiers",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return fmt.format(d).replace(",", "");
  } catch {
    return "—";
  }
}

// ---- Leaflet
function initMapIfNeeded() {
  const mapDiv = $("map");
  if (!mapDiv) return;

  if (map) return;
  if (typeof L === "undefined") {
    showError("Leaflet n'est pas chargé (script manquant).");
    return;
  }

  map = L.map("map", { zoomControl: true, scrollWheelZoom: false });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  map.setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lon], DEFAULT_VIEW.zoom);

  // Fix parfois sur mobile
  setTimeout(() => map.invalidateSize(), 400);
}

function clearMarkers() {
  if (!map) return;
  markers.forEach((mk) => {
    try {
      map.removeLayer(mk);
    } catch {}
  });
  markers = [];
}

function addMarker(lat, lon, label) {
  if (!map) return;
  const mk = L.circleMarker([lat, lon], {
    radius: 9,
    weight: 2,
    fillOpacity: 0.85,
  }).bindPopup(label || "");
  mk.addTo(map);
  markers.push(mk);
}

// ---- Fetch avec retry + timeout
async function fetchWithRetry(url, tries = 6, baseDelayMs = 800, timeoutMs = 9000) {
  let lastErr;

  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const bust = url.includes("?") ? "&" : "?";
      const res = await fetch(`${url}${bust}v=${Date.now()}`, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;

      // attendre (backoff)
      const wait = baseDelayMs * Math.pow(1.4, i);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ---- Charger main.json une fois
async function loadWilayasIndex() {
  if (wilayasIndex) return wilayasIndex;

  const data = await fetchWithRetry("/main.json", 6, 800, 9000);

  // attend un format: { wilayas: [{ name, latitude, longitude }, ...] }
  const arr = Array.isArray(data?.wilayas) ? data.wilayas : [];
  const idx = new Map();

  for (const w of arr) {
    const name = w?.name;
    const lat = Number(w?.latitude);
    const lon = Number(w?.longitude);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    idx.set(normalizeName(name), { name, lat, lon });
  }

  wilayasIndex = idx;
  return idx;
}

// ---- Charger alerte
function defaultAlert() {
  return {
    active: false,
    level: "none",
    regions: [],
    region: "",
    title: "Aucune alerte",
    message: "",
    startAt: "",
    endAt: "",
    updatedAt: "",
  };
}

function normalizeAlert(data) {
  const merged = { ...defaultAlert(), ...(data || {}) };

  if (merged.region && (!Array.isArray(merged.regions) || merged.regions.length === 0)) {
    merged.regions = [merged.region];
  }
  if (Array.isArray(merged.regions) && merged.regions.length > 0 && !merged.region) {
    merged.region = merged.regions[0];
  }
  if (!Array.isArray(merged.regions)) merged.regions = [];

  return merged;
}

async function loadAlert() {
  const data = await fetchWithRetry("/api/alert", 6, 800, 9000);
  return normalizeAlert(data);
}

// ---- UI render
function renderAlertUI(alert) {
  // Badge (si ton HTML a #badge)
  const badge = $("badge");
  if (badge) {
    badge.textContent = badgeText(alert.level);
    badge.className = badgeClass(alert.level, !!alert.active);
  }

  const icon = detectHazardIcon(alert);
  setText("title", `${alert.title || "Aucune alerte"}`);
  // si tu as un élément #icon
  const iconEl = $("icon");
  if (iconEl) iconEl.textContent = icon;

  // si tu n'as pas #icon, on préfixe le titre en HTML (si #title existe)
  const titleEl = $("title");
  if (titleEl && !iconEl) titleEl.textContent = `${icon} ${alert.title || "Aucune alerte"}`;

  setText("message", alert.message || "");

  // Wilayas
  const wilayasLine = (alert.regions || []).filter(Boolean).join(" - ");
  const wilayasEl = $("wilayas");
  if (wilayasEl) {
    wilayasEl.textContent = wilayasLine ? `Wilayas : ${wilayasLine}` : "";
  }

  // Dernière mise à jour
  const upd = $("updatedAt");
  if (upd) upd.textContent = formatDZ(alert.updatedAt);
}

// ---- Points sur carte
async function renderMarkers(alert) {
  initMapIfNeeded();
  if (!map) return;

  clearMarkers();

  const regs = (alert.regions || []).filter(Boolean);
  if (regs.length === 0) {
    map.setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lon], DEFAULT_VIEW.zoom);
    return;
  }

  const idx = await loadWilayasIndex();
  let any = false;
  const bounds = [];

  for (const r of regs) {
    const hit = idx.get(normalizeName(r));
    if (!hit) continue;
    addMarker(hit.lat, hit.lon, hit.name);
    bounds.push([hit.lat, hit.lon]);
    any = true;
  }

  if (any && bounds.length > 0) {
    try {
      map.fitBounds(bounds, { padding: [25, 25] });
    } catch {
      // fallback
      const first = bounds[0];
      map.setView(first, 7);
    }
  }
}

// ---- Main loop
async function refreshOnce() {
  try {
    hideError();

    const alert = await loadAlert();
    renderAlertUI(alert);

    // Si aucune alerte, pas besoin de main.json ni de points
    if (alert.level === "none" || !alert.active) {
      initMapIfNeeded();
      if (map) {
        clearMarkers();
        map.setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lon], DEFAULT_VIEW.zoom);
      }
      return;
    }

    await renderMarkers(alert);
    hideError(); // succès final
  } catch (e) {
    // On affiche une erreur, mais on retentera au prochain refresh
    showError("⚠️ Problème de chargement (api/alert ou main.json).");
  }
}

function start() {
  // premier chargement
  refreshOnce();

  // refresh périodique (utile quand Render se réveille)
  setInterval(refreshOnce, 30 * 1000);

  // quand on revient sur l’onglet
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshOnce();
  });
}

document.addEventListener("DOMContentLoaded", start);
