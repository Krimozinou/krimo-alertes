// ===============================
// Krimo Alertes — app.js (STABLE + DEBUG)
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Leaflet markers (visibles)
// ✅ Cache-busting main.json (stop cache Render)
// ✅ Debug sur page: "Points X/Y" + wilayas manquantes
// ✅ Icône météo (pluie / orage / vent) dans le titre
// ===============================

let map;
let markersLayer;
let wilayasIndex = null; // Map(normalizedName -> {name, lat, lon})

function normalizeName(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[’']/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function badgeText(level) {
  return (
    level === "yellow" ? "🟡 Vigilance Jaune" :
    level === "orange" ? "🟠 Vigilance Orange" :
    level === "red" ? "🔴 Vigilance Rouge" :
    "✅ Aucune alerte"
  );
}

function badgeClass(level, active) {
  return "badge " + (level || "none") + (active ? " blink" : "");
}

function detectHazardIcon(data) {
  const t = normalizeName(data?.title || "");
  const m = normalizeName(data?.message || "");

  if (t.includes("orage") || m.includes("orage")) return "⛈️";
  if (t.includes("vent") || m.includes("vent") || t.includes("tempete") || m.includes("tempete")) return "💨";
  if (t.includes("pluie") || m.includes("pluie") || t.includes("inond") || m.includes("inond")) return "🌧️";
  return "";
}

// --------- Init carte ----------
function initMapIfNeeded() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;
  if (map) return;

  if (typeof L === "undefined") {
    const dbg = document.getElementById("debug");
    if (dbg) dbg.textContent = "⚠️ Leaflet non chargé (L undefined)";
    return;
  }

  map = L.map("map", { zoomControl: true, scrollWheelZoom: false });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  map.setView([28.0, 2.5], 5);
  setTimeout(() => map.invalidateSize(), 300);
}

// --------- Charger index wilayas depuis main.json (anti-cache) ----------
async function loadWilayasIndex() {
  if (wilayasIndex) return wilayasIndex;

  // ✅ anti-cache (Render peut servir une version ancienne)
  const url = "main.json?v=" + Date.now();

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("main.json introuvable (" + res.status + ")");

  const data = await res.json();
  const list = Array.isArray(data.wilayas) ? data.wilayas : [];

  wilayasIndex = new Map();

  for (const w of list) {
    const n = w.name || "";
    const lat = Number(w.latitude);
    const lon = Number(w.longitude);
    if (!n || !isFinite(lat) || !isFinite(lon)) continue;

    const key = normalizeName(n);
    wilayasIndex.set(key, { name: n, lat, lon });

    // ✅ alias Alger
    if (key === "algiers") wilayasIndex.set("alger", { name: n, lat, lon });
    if (key === "alger") wilayasIndex.set("algiers", { name: n, lat, lon });
  }

  return wilayasIndex;
}

function clearMarkers() {
  if (markersLayer) markersLayer.clearLayers();
}

function makeIcon(level) {
  // petite pastille colorée (très visible)
  const bg =
    level === "red" ? "#e53935" :
    level === "orange" ? "#fb8c00" :
    level === "yellow" ? "#fdd835" :
    "#444";

  const html = `
    <div style="
      width:16px;height:16px;border-radius:50%;
      background:${bg};
      border:2px solid white;
      box-shadow:0 0 4px rgba(0,0,0,.35);
    "></div>
  `;

  return L.divIcon({
    className: "",
    html,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

// --------- Placer points + debug ----------
function addMarkersFor(wilayas, level) {
  if (!map || !markersLayer || !wilayasIndex) return;

  clearMarkers();

  const icon = makeIcon(level);
  const bounds = [];
  const missing = [];
  let foundCount = 0;

  for (const name of wilayas) {
    const key = normalizeName(name);
    const found = wilayasIndex.get(key);

    if (!found) {
      missing.push(name);
      continue;
    }

    foundCount++;

    const marker = L.marker([found.lat, found.lon], { icon }).addTo(markersLayer);
    marker.bindPopup("📍 " + (name || found.name));
    bounds.push([found.lat, found.lon]);
  }

  // ✅ Debug visible sur la page (pas besoin console)
  const dbg = document.getElementById("debug");
  if (dbg) {
    const base = `📌 Points trouvés : ${foundCount}/${wilayas.length}`;
    dbg.textContent = missing.length
      ? base + ` — ❌ Non trouvées: ${missing.join(" - ")}`
      : base;
  }

  // Zoom auto
  if (bounds.length === 1) {
    map.setView(bounds[0], 9);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [30, 30] });
  } else {
    map.setView([28.0, 2.5], 5);
  }

  setTimeout(() => map.invalidateSize(), 150);
}

// --------- Refresh UI ----------
async function refresh() {
  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");
  const dbg = document.getElementById("debug");

  try {
    const res = await fetch("api/alert?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("api/alert " + res.status);

    const data = await res.json();

    const level = data.level || "none";
    const active = !!data.active;

    const wilayas =
      Array.isArray(data.regions) ? data.regions :
      Array.isArray(data.zones) ? data.zones :
      Array.isArray(data.wilayas) ? data.wilayas :
      (data.region ? [data.region] : []);

    if (badge) badge.className = badgeClass(level, active);
    if (badge) badge.textContent = badgeText(level);

    const icon = detectHazardIcon(data);

    if (!active || level === "none") {
      if (title) title.textContent = (icon ? icon + " " : "") + "Aucune alerte";
      if (message) message.textContent = "";
      if (region) region.textContent = "";
      if (dbg) dbg.textContent = "";

      initMapIfNeeded();
      clearMarkers();
    } else {
      if (title) title.textContent = (icon ? icon + " " : "") + (data.title || "ALERTE MÉTÉO");
      if (message) message.textContent = data.message || "";

      if (region) {
        region.textContent = wilayas.length
          ? "📍 Wilayas : " + wilayas.join(" - ")
          : "";
      }

      initMapIfNeeded();

      // ✅ charge main.json puis place points
      wilayasIndex = await loadWilayasIndex();
      addMarkersFor(wilayas, level);
    }

    if (updatedAt) {
      updatedAt.textContent = data.updatedAt
        ? new Date(data.updatedAt).toLocaleString("fr-FR")
        : "—";
    }
  } catch (e) {
    // ✅ message d’erreur clair (pas de disparition silencieuse)
    if (dbg) dbg.textContent = "⚠️ Problème de chargement (api/alert ou main.json)";
    // on ne casse pas la page
  }
}

// --------- Partage ----------
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
document.addEventListener("DOMContentLoaded", () => {
  refresh();
  setInterval(refresh, 30000);
});
