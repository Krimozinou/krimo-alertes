// ===============================
// Krimo Alertes — app.js (COMPLET)
// ✅ Multi-wilayas
// ✅ Carte Leaflet
// ✅ Colorer wilayas concernées (si /wilayas.geojson existe)
// ✅ Zoom auto sur wilayas sélectionnées
// ✅ Icônes pluie/orage selon niveau
// ===============================

let map = null;
let baseLayer = null;
let geoLayer = null;
let markerLayer = null;
let mapReady = false;

let wilayasGeoJSON = null;

// ---------- Helpers texte (pour matcher les noms wilayas) ----------
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

function getRegions(data) {
  if (Array.isArray(data.regions)) return data.regions.filter(Boolean);
  if (Array.isArray(data.zones)) return data.zones.filter(Boolean); // compat si ancien
  if (typeof data.region === "string" && data.region.trim()) return [data.region.trim()];
  return [];
}

// ---------- Badge ----------
function badgeText(level) {
  return (
    level === "yellow" ? "🟡 Vigilance Jaune" :
    level === "orange" ? "🟠 Vigilance Orange" :
    level === "red" ? "🔴 Vigilance Rouge" :
    "⚠️ Alerte"
  );
}

// ---------- Leaflet init (UNE SEULE FOIS) ----------
function initMapOnce() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;

  // Leaflet pas chargé
  if (typeof window.L === "undefined") return;

  if (mapReady) return; // ✅ IMPORTANT

  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: false,
  });

  baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);

  map.setView([28.0, 2.5], 5);

  mapReady = true;
  setTimeout(() => map.invalidateSize(), 300);
}

// ---------- Charger GeoJSON wilayas ----------
async function loadWilayasGeoJSON() {
  try {
    const res = await fetch("/wilayas.geojson", { cache: "no-store" });
    if (!res.ok) throw new Error("wilayas.geojson introuvable");
    wilayasGeoJSON = await res.json();
  } catch {
    wilayasGeoJSON = null; // pas grave
  }
}

// ---------- Style wilayas ----------
function getWilayaStyle(isSelected, level) {
  let fill = "#e6e6e6";
  let stroke = "#bbbbbb";

  if (isSelected) {
    if (level === "yellow") fill = "#f7d23b";
    if (level === "orange") fill = "#ff8a1f";
    if (level === "red") fill = "#ff3b30";
    stroke = "#222";
  }

  return {
    color: stroke,
    weight: isSelected ? 2 : 1,
    fillColor: fill,
    fillOpacity: isSelected ? 0.45 : 0.15,
  };
}

// ---------- Dessiner wilayas ----------
function renderWilayas(regions, level) {
  if (!mapReady || !map || !wilayasGeoJSON) return;

  const selected = (regions || []).map(normalizeName);

  if (geoLayer) {
    geoLayer.remove();
    geoLayer = null;
  }

  geoLayer = L.geoJSON(wilayasGeoJSON, {
    style: (feature) => {
      const name =
        feature?.properties?.name ||
        feature?.properties?.NAME ||
        feature?.properties?.wilaya ||
        feature?.properties?.WILAYA ||
        "";
      const isSel = selected.includes(normalizeName(name));
      return getWilayaStyle(isSel, level);
    }
  }).addTo(map);
}

// ---------- Icônes ----------
function iconForLevel(level) {
  const emoji =
    level === "yellow" ? "⛅" :
    level === "orange" ? "🌧️" :
    level === "red" ? "⛈️" :
    "ℹ️";

  return L.divIcon({
    className: "krimo-marker",
    html: `<div style="font-size:28px;filter:drop-shadow(0 6px 8px rgba(0,0,0,.25));">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function renderIconsOnSelected(regions, level) {
  if (!mapReady || !markerLayer || !geoLayer) return;

  markerLayer.clearLayers();
  const selected = (regions || []).map(normalizeName);
  const icon = iconForLevel(level);

  geoLayer.eachLayer((layer) => {
    const feat = layer.feature;
    const name =
      feat?.properties?.name ||
      feat?.properties?.NAME ||
      feat?.properties?.wilaya ||
      feat?.properties?.WILAYA ||
      "";

    if (selected.includes(normalizeName(name))) {
      const c = layer.getBounds().getCenter();
      L.marker(c, { icon }).addTo(markerLayer);
    }
  });
}

// ---------- Zoom auto ----------
function zoomToSelected(regions) {
  if (!mapReady || !geoLayer) return;

  const selected = (regions || []).map(normalizeName);
  if (selected.length === 0) {
    map.setView([28.0, 2.5], 5);
    return;
  }

  let bounds = null;

  geoLayer.eachLayer((layer) => {
    const feat = layer.feature;
    const name =
      feat?.properties?.name ||
      feat?.properties?.NAME ||
      feat?.properties?.wilaya ||
      feat?.properties?.WILAYA ||
      "";

    if (selected.includes(normalizeName(name))) {
      const b = layer.getBounds();
      bounds = bounds ? bounds.extend(b) : b;
    }
  });

  if (bounds && bounds.isValid()) {
    map.fitBounds(bounds, { padding: [20, 20] });
  }
}

// ---------- Refresh UI ----------
async function refresh() {
  const res = await fetch("/api/alert", { cache: "no-store" });
  const data = await res.json();

  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const regionEl = document.getElementById("region");
  const messageEl = document.getElementById("message");
  const updatedAtEl = document.getElementById("updatedAt");

  const level = data.level || "none";
  const active = !!data.active && level !== "none";

  // Badge class + blink
  if (badge) badge.className = "badge " + level + (active ? " blink" : "");

  // Heure
  if (updatedAtEl) {
    updatedAtEl.textContent = data.updatedAt
      ? new Date(data.updatedAt).toLocaleString("fr-FR")
      : "—";
  }

  const regions = getRegions(data);

  // Aucune alerte
  if (!active) {
    if (badge) badge.textContent = "✅ Aucune alerte";
    if (title) title.textContent = "Aucune alerte";
    if (messageEl) messageEl.textContent = "";
    if (regionEl) regionEl.textContent = "";

    if (markerLayer) markerLayer.clearLayers();
    if (wilayasGeoJSON) {
      renderWilayas([], "none");
      zoomToSelected([]);
    }
    return;
  }

  // Alerte active
  if (badge) badge.textContent = badgeText(level);
  if (title) title.textContent = data.title || "ALERTE MÉTÉO";
  if (messageEl) messageEl.textContent = data.message || "";
  if (regionEl) regionEl.textContent = regions.length ? ("📍 Wilayas : " + regions.join(" - ")) : "";

  // Carte pro (si GeoJSON existe)
  if (wilayasGeoJSON) {
    renderWilayas(regions, level);
    renderIconsOnSelected(regions, level);
    zoomToSelected(regions);
  }
}

// ---------- Boutons Facebook ----------
document.addEventListener("DOMContentLoaded", async () => {
  initMapOnce();
  await loadWilayasGeoJSON();

  // Afficher carte grise si GeoJSON existe
  if (wilayasGeoJSON) renderWilayas([], "none");

  // Boutons
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

  await refresh();
  setInterval(refresh, 30000);
});
