// ===============================
// ✅ Krimo Alertes — app.js FINAL
// ✅ Points rouges toujours visibles
// ✅ Aucun bug main.json Render
// ✅ Icône météo dans le titre
// ===============================

let map;
let markersLayer;
let wilayasIndex = null;

// ---------- Normalisation ----------
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

// ---------- Badge ----------
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

// ---------- Icône météo ----------
function detectIcon(title) {
  title = normalizeName(title);

  if (title.includes("orage")) return "⛈️";
  if (title.includes("vent")) return "💨";
  if (title.includes("pluie")) return "🌧️";
  if (title.includes("neige")) return "❄️";

  return "⚠️";
}

// ---------- Init Map ----------
function initMapIfNeeded() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;

  if (map) return;

  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: false,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  map.setView([28.0, 2.5], 5);

  setTimeout(() => map.invalidateSize(), 500);
}

// ---------- Charger main.json ----------
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

    // ✅ Alger alias
    if (normalizeName(name) === "algiers") {
      wilayasIndex.set("alger", { name, lat, lon });
    }
    if (normalizeName(name) === "alger") {
      wilayasIndex.set("algiers", { name, lat, lon });
    }
  }

  return wilayasIndex;
}

// ---------- Nettoyer points ----------
function clearMarkers() {
  if (markersLayer) markersLayer.clearLayers();
}

// ---------- Ajouter points rouges ----------
function addMarkersFor(wilayas) {
  if (!map || !markersLayer || !wilayasIndex) return;

  clearMarkers();

  const bounds = [];

  wilayas.forEach((w) => {
    const found = wilayasIndex.get(normalizeName(w));
    if (!found) return;

    // ✅ POINT ROUGE GARANTI
    const marker = L.circleMarker([found.lat, found.lon], {
      radius: 10,
      color: "#ff0000",       // contour rouge
      fillColor: "#ff0000",   // remplissage rouge
      fillOpacity: 1,         // visible à 100%
      weight: 3,
    });

    marker.addTo(markersLayer);
    marker.bindPopup("📍 " + found.name);

    bounds.push([found.lat, found.lon]);
  });

  if (bounds.length === 1) {
    map.setView(bounds[0], 8);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

// ---------- Refresh ----------
async function refresh() {
  initMapIfNeeded();

  let alertData;

  try {
    const res = await fetch("/api/alert", { cache: "no-store" });
    alertData = await res.json();
  } catch {
    return;
  }

  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  const active = !!alertData.active;
  const level = alertData.level || "none";

  const wilayas = Array.isArray(alertData.regions)
    ? alertData.regions
    : [];

  if (badge) {
    badge.className = badgeClass(level, active);
    badge.textContent = badgeText(level);
  }

  // ✅ Titre + icône
  if (title) {
    const icon = detectIcon(alertData.title);
    title.textContent = icon + " " + (alertData.title || "Aucune alerte");
  }

  // Wilaya text
  if (region) {
    region.textContent =
      wilayas.length > 0
        ? "📍 Wilayas : " + wilayas.join(" - ")
        : "";
  }

  if (message) message.textContent = alertData.message || "";

  if (updatedAt) {
    updatedAt.textContent = alertData.updatedAt
      ? new Date(alertData.updatedAt).toLocaleString("fr-FR")
      : "—";
  }

  // ✅ Charger points seulement si alerte active
  if (active && wilayas.length > 0) {
    try {
      await loadWilayasIndex();
      addMarkersFor(wilayas);
    } catch {
      console.log("Erreur main.json");
    }
  } else {
    clearMarkers();
  }
}

// ---------- Start ----------
refresh();
setInterval(refresh, 15000);
