// ===============================
// Krimo Alertes — app.js (COMPLET)
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Carte Leaflet (points depuis /main.json)
// ✅ Zoom auto sur wilayas sélectionnées
// ✅ Icône météo (pluie / orage / vent) dans le titre
// ✅ Affichage "Dernière mise à jour" OK
// ===============================

let map = null;
let markersLayer = null;

let wilayasIndex = null; // Map(normalizedName -> {name, lat, lon})

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
    "✅ Aucune alerte"
  );
}

function badgeClass(level, active) {
  return "badge " + (level || "none") + (active ? " blink" : "");
}

// Icône météo simple (basé sur title/message)
function detectHazardIcon(data) {
  const t = normalizeName(data?.title || "");
  const m = normalizeName(data?.message || "");

  // Orage
  if (t.includes("orage") || m.includes("orage") || t.includes("tempete") || m.includes("tempete")) return "⛈️";

  // Vent
  if (t.includes("vent") || m.includes("vent")) return "💨";

  // Pluie / inondations
  if (t.includes("pluie") || m.includes("pluie") || t.includes("inond") || m.includes("inond")) return "🌧️";

  // Sinon selon niveau
  if (data?.level === "red") return "🚨";
  if (data?.level === "orange") return "⚠️";
  if (data?.level === "yellow") return "🟡";
  return "";
}

// --------- Init carte ----------
function initMapIfNeeded() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;

  if (map) return; // déjà initialisée

  map = L.map("map", { zoomControl: true, scrollWheelZoom: false });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Vue par défaut Algérie
  map.setView([28.0, 2.5], 5);

  // Fix affichage mobile
  setTimeout(() => map.invalidateSize(), 300);
}

// --------- Charger index wilayas depuis main.json ----------
async function loadWilayasIndex() {
  if (wilayasIndex) return wilayasIndex;

  const res = await fetch("/main.json", { cache: "no-store" });
  if (!res.ok) throw new Error("main.json introuvable");

  const data = await res.json();
  const list = Array.isArray(data.wilayas) ? data.wilayas : [];

  wilayasIndex = new Map();

  for (const w of list) {
    const name = w.name;
    const lat = Number(w.latitude);
    const lon = Number(w.longitude);

    if (!name || !isFinite(lat) || !isFinite(lon)) continue;

    wilayasIndex.set(normalizeName(name), { name, lat, lon });

    // ✅ alias Alger <-> Algiers (au cas où)
    if (normalizeName(name) === "alger") {
      wilayasIndex.set("algiers", { name, lat, lon });
    }
    if (normalizeName(name) === "algiers") {
      wilayasIndex.set("alger", { name, lat, lon });
    }
  }

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

    // ✅ petit correctif : parfois "Alger " avec espace
    const found = wilayasIndex.get(key) || wilayasIndex.get(key.replace(/\s+/g, " "));

    if (!found) continue;

    const marker = L.circleMarker([found.lat, found.lon], {
      radius: 10,
      color,
      fillColor: color,
      fillOpacity: 0.85,
      weight: 2
    }).addTo(markersLayer);

    marker.bindPopup("📍 " + found.name);
    bounds.push([found.lat, found.lon]);
  }

  // Zoom auto
  if (bounds.length === 1) {
    map.setView(bounds[0], 9);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [35, 35] });
  } else {
    // rien trouvé -> vue Algérie
    map.setView([28.0, 2.5], 5);
  }

  setTimeout(() => map.invalidateSize(), 150);
}

// --------- Refresh UI ----------
async function refresh() {
  const badge = document.getElementById("badge");
  const titleEl = document.getElementById("title");
  const regionEl = document.getElementById("region");
  const messageEl = document.getElementById("message");
  const updatedAtEl = document.getElementById("updatedAt");

  try {
    const res = await fetch("/api/alert", { cache: "no-store" });
    const data = await res.json();

    const level = data.level || "none";
    const active = !!data.active;

    // ✅ multi champs possibles
    const wilayas =
      Array.isArray(data.regions) ? data.regions :
      Array.isArray(data.zones) ? data.zones :
      Array.isArray(data.wilayas) ? data.wilayas :
      (data.region ? [data.region] : []);

    // Badge
    if (badge) {
      badge.className = badgeClass(level, active);
      badge.textContent = active && level !== "none" ? badgeText(level) : "✅ Aucune alerte";
    }

    // Titre + icône météo
    const hazardIcon = detectHazardIcon(data);
    const cleanTitle = data.title || (active ? "ALERTE MÉTÉO" : "Aucune alerte");
    if (titleEl) titleEl.textContent = (hazardIcon ? (hazardIcon + " ") : "") + cleanTitle;

    // Message
    if (messageEl) messageEl.textContent = data.message || "";

    // Liste wilayas
    if (regionEl) {
      regionEl.textContent = wilayas.length ? ("📍 Wilayas : " + wilayas.join(" - ")) : "";
    }

    // Date
    if (updatedAtEl) {
      updatedAtEl.textContent = data.updatedAt
        ? new Date(data.updatedAt).toLocaleString("fr-FR")
        : "—";
    }

    // Carte + points
    initMapIfNeeded();

    // si pas d'alerte : effacer points
    if (!active || level === "none") {
      clearMarkers();
      return;
    }

    // charger index puis afficher points
    wilayasIndex = await loadWilayasIndex();
    addMarkersFor(wilayas, level);

  } catch (e) {
    // En cas d'erreur, on affiche un message simple mais on ne casse pas tout
    if (messageEl) messageEl.textContent = "⚠️ Erreur de chargement (api/alert ou main.json)";
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
