// ===============================
// Krimo Alertes — app.js (COMPLET)
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Carte Leaflet (points depuis /main.json)
// ✅ Zoom auto sur wilayas sélectionnées
// ✅ Fix Alger (Alger / Algiers)
// ✅ Icône (pluie/orage/vent...) dans le titre
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

// ✅ Icône selon type (si data.hazard existe) OU détection depuis title/message
function detectHazardIcon(data) {
  const hazardRaw = (data?.hazard || data?.type || data?.event || "").toString().toLowerCase();
  const text = (hazardRaw + " " + (data?.title || "") + " " + (data?.message || ""))
    .toLowerCase();

  // Priorités (tu peux ajuster)
  if (/(orage|orages|orageux|foudre)/.test(text)) return "⛈️";
  if (/(vent|vents|rafale|rafales|tempete|tempête)/.test(text)) return "💨";
  if (/(pluie|pluies|averse|averses|torrentielle|torrentielles)/.test(text)) return "🌧️";
  if (/(inondation|inondations|crue|crues)/.test(text)) return "🌊";
  if (/(neige|neiges|verglas|gel)/.test(text)) return "❄️";
  if (/(canicule|chaleur)/.test(text)) return "🔥";

  return ""; // rien
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

    // ✅ alias spécial Alger (Alger / Algiers)
    if (normalizeName(n) === "algiers") {
      wilayasIndex.set("alger", { name: n, lat, lon });
    }
    if (normalizeName(n) === "alger") {
      wilayasIndex.set("algiers", { name: n, lat, lon });
    }
  }

  return wilayasIndex;
}

// --------- Placer points ----------
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

// --------- Refresh UI ----------
async function refresh() {
  const res = await fetch("/api/alert", { cache: "no-store" });
  const data = await res.json();

  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

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

  // Date
  if (updatedAt) {
    updatedAt.textContent = data.updatedAt
      ? new Date(data.updatedAt).toLocaleString("fr-FR")
      : "—";
  }

  // Icône
  const icon = detectHazardIcon(data);

  // Cas aucune alerte
  if (!active || level === "none") {
    if (badge) badge.textContent = "✅ Aucune alerte";
    if (title) title.textContent = "Aucune alerte";
    if (message) message.textContent = "";
    if (region) region.textContent = "";

    initMapIfNeeded();
    try { await loadWilayasIndex(); } catch {}
    clearMarkers();
    return;
  }

  // Alerte active
  if (badge) badge.textContent = badgeText(level);
  if (title) {
    const baseTitle = data.title || "ALERTE MÉTÉO";
    title.textContent = (icon ? icon + " " : "") + baseTitle;
  }
  if (message) message.textContent = data.message || "";
  if (region) {
    region.textContent = wilayas.length ? "📍 Wilayas : " + wilayas.join(" - ") : "";
  }

  // Carte + points
  initMapIfNeeded();
  const idx = await loadWilayasIndex();
  wilayasIndex = idx;
  addMarkersFor(wilayas, level);
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
