// ===============================
// Krimo Alertes — app.js (COMPLET)
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Carte Leaflet (points depuis /main.json)
// ✅ Zoom auto sur wilayas sélectionnées
// ✅ Fix Alger (Alger / Algiers)
// ✅ Icône météo (pluie / orage / vent) SUR LES POINTS + dans le titre
// ===============================

let map;
let markersLayer;

let wilayasIndex = null; // Map(normalizedName -> {name, lat, lon})

// --------- Helpers ----------
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

// Détecter l’icône météo selon titre/message
function hazardEmoji(data) {
  const t = normalizeName(data?.title || "");
  const m = normalizeName(data?.message || "");

  // Orages
  if (t.includes("orage") || m.includes("orage") || t.includes("orag") || m.includes("orag")) return "⛈️";
  // Vent / tempête
  if (t.includes("vent") || m.includes("vent") || t.includes("tempete") || m.includes("tempete")) return "💨";
  // Pluie / inondations
  if (t.includes("pluie") || m.includes("pluie") || t.includes("inond") || m.includes("inond")) return "🌧️";

  // Par défaut selon niveau
  if (data?.level === "red") return "🚨";
  if (data?.level === "orange") return "⚠️";
  if (data?.level === "yellow") return "🟡";
  return "";
}

function levelColor(level) {
  return (
    level === "red" ? "#e53935" :
    level === "orange" ? "#fb8c00" :
    level === "yellow" ? "#fdd835" :
    "#444"
  );
}

// --------- Init carte ----------
function initMapIfNeeded() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;

  if (map) return; // déjà init

  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: false
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Vue par défaut Algérie
  map.setView([28.0, 2.5], 5);

  // Fix affichage (mobile)
  setTimeout(() => map.invalidateSize(), 300);
}

// --------- Charger index wilayas depuis main.json ----------
async function loadWilayasIndex() {
  if (wilayasIndex) return wilayasIndex;

  const res = await fetch("/main.json", { cache: "no-store" });
  if (!res.ok) throw new Error("main.json introuvable ( /main.json )");

  const data = await res.json();

  // data.wilayas = [{name, latitude, longitude, ...}]
  const list = Array.isArray(data.wilayas) ? data.wilayas : [];

  wilayasIndex = new Map();

  for (const w of list) {
    const n = w.name || "";
    const lat = Number(w.latitude);
    const lon = Number(w.longitude);
    if (!n || !isFinite(lat) || !isFinite(lon)) continue;

    wilayasIndex.set(normalizeName(n), { name: n, lat, lon });

    // ✅ alias spécial Alger
    if (normalizeName(n) === "algiers") {
      wilayasIndex.set("alger", { name: n, lat, lon });
    }
    if (normalizeName(n) === "alger") {
      wilayasIndex.set("algiers", { name: n, lat, lon });
    }
  }

  return wilayasIndex;
}

// --------- Points ----------
function clearMarkers() {
  if (markersLayer) markersLayer.clearLayers();
}

function makeEmojiMarkerIcon(emoji, color) {
  // Icône 100% inline (pas besoin de modifier app.css)
  const html = `
    <div style="
      width: 28px; height: 28px;
      border-radius: 999px;
      background: ${color};
      border: 2px solid rgba(0,0,0,0.25);
      display:flex; align-items:center; justify-content:center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      font-size: 16px;
      line-height: 1;
    ">${emoji || "📍"}</div>
  `;

  return L.divIcon({
    html,
    className: "", // évite les styles par défaut
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
}

function addMarkersFor(wilayas, level, emoji) {
  if (!map || !markersLayer || !wilayasIndex) return;

  clearMarkers();

  const color = levelColor(level);
  const bounds = [];

  for (const name of wilayas) {
    const key = normalizeName(name);
    const found = wilayasIndex.get(key);
    if (!found) continue;

    const marker = L.marker([found.lat, found.lon], {
      icon: makeEmojiMarkerIcon(emoji, color)
    }).addTo(markersLayer);

    marker.bindPopup(`${emoji || "📍"} ${name || found.name}`);
    bounds.push([found.lat, found.lon]);
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

  let data;
  try {
    const res = await fetch("/api/alert", { cache: "no-store" });
    data = await res.json();
  } catch (e) {
    // si api/alert ne répond pas, on évite de casser l’écran
    if (badge) badge.className = badgeClass("none", false);
    if (badge) badge.textContent = "⚠️ Problème réseau";
    if (title) title.textContent = "Erreur de chargement";
    if (message) message.textContent = "";
    if (region) region.textContent = "";
    if (updatedAt) updatedAt.textContent = "—";
    return;
  }

  const level = data.level || "none";
  const active = !!data.active;

  // ✅ Multi champs possibles
  const wilayas =
    Array.isArray(data.regions) ? data.regions :
    Array.isArray(data.zones) ? data.zones :
    Array.isArray(data.wilayas) ? data.wilayas :
    (data.region ? [data.region] : []);

  // Badge
  if (badge) badge.className = badgeClass(level, active);

  const icon = hazardEmoji(data);

  // Cas aucune alerte
  if (!active || level === "none") {
    if (badge) badge.textContent = "✅ Aucune alerte";
    if (title) title.textContent = "Aucune alerte";
    if (message) message.textContent = "";
    if (region) region.textContent = "";

    initMapIfNeeded();
    try {
      await loadWilayasIndex();
      clearMarkers();
    } catch {
      // si main.json ne charge pas, on garde juste la carte sans points
      clearMarkers();
    }
  } else {
    if (badge) badge.textContent = badgeText(level);

    const t = data.title || "ALERTE MÉTÉO";
    if (title) title.textContent = (icon ? icon + " " : "") + t;

    if (message) message.textContent = data.message || "";

    if (region) {
      region.textContent = wilayas.length
        ? "📍 Wilayas : " + wilayas.join(" - ")
        : "";
    }

    // Carte + points
    initMapIfNeeded();

    try {
      const idx = await loadWilayasIndex();
      wilayasIndex = idx;
      addMarkersFor(wilayas, level, icon || "📍");
    } catch {
      // Si main.json ne charge pas, on n’affiche pas d’erreur “agressive”
      // on garde la carte, sans points
      clearMarkers();
    }
  }

  // Date
  if (updatedAt) {
    updatedAt.textContent = data.updatedAt
      ? new Date(data.updatedAt).toLocaleString("fr-FR")
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
setInterval(refresh, 30000);
