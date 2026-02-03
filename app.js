// ===============================
// Krimo Alertes — app.js (COMPLET)
// ✅ Multi-wilayas
// ✅ Carte Leaflet
// ✅ Colorer wilayas concernées
// ✅ Zoom auto sur wilayas sélectionnées
// ✅ Icônes pluie/orage selon niveau
// ===============================

let map;
let baseLayer;
let geoLayer;
let markerLayer;

let wilayasGeoJSON = null;

// ---------- Helpers texte (pour matcher les noms wilayas) ----------
function normalizeName(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // enlève accents
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
    "⚠️ Alerte"
  );
}

// ---------- Leaflet init ----------
function initMap() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;

  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: false,
  });

  // Base map (OSM)
  baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);

  // Vue par défaut sur Algérie
  map.setView([28.0, 2.5], 5);

  // Fix affichage sur mobile (quand la carte apparaît)
  setTimeout(() => map.invalidateSize(), 300);
}

// ---------- Charger GeoJSON wilayas ----------
async function loadWilayasGeoJSON() {
  try {
    const res = await fetch("/wilayas.geojson", { cache: "no-store" });
    if (!res.ok) throw new Error("wilayas.geojson introuvable");
    wilayasGeoJSON = await res.json();
  } catch (e) {
    console.warn("⚠️ GeoJSON manquant: /wilayas.geojson (pas de coloration possible).", e);
    wilayasGeoJSON = null;
  }
}

// ---------- Style wilayas ----------
function getWilayaStyle(isSelected, level) {
  // couleurs selon niveau
  let fill = "#e6e6e6"; // gris défaut
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

// ---------- Ajouter/mettre à jour layer GeoJSON ----------
function renderWilayas(regions, level) {
  if (!map) return;
  if (!wilayasGeoJSON) return;

  const selected = (regions || []).map(normalizeName);

  // Supprimer ancien layer
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
    },
    onEachFeature: (feature, layer) => {
      const name =
        feature?.properties?.name ||
        feature?.properties?.NAME ||
        feature?.properties?.wilaya ||
        feature?.properties?.WILAYA ||
        "Wilaya";

      layer.bindTooltip(name, { sticky: true });

      // clic = zoom sur cette wilaya
      layer.on("click", () => {
        const b = layer.getBounds();
        if (b && b.isValid()) map.fitBounds(b, { padding: [20, 20] });
      });
    }
  }).addTo(map);
}

// ---------- Icônes météo sur wilayas sélectionnées ----------
function iconForLevel(level) {
  // icône simple (emoji) = fiable partout
  const emoji =
    level === "yellow" ? "⛅" :
    level === "orange" ? "🌧️" :
    level === "red" ? "⛈️" :
    "ℹ️";

  return L.divIcon({
    className: "krimo-marker",
    html: `<div style="
      font-size:28px;
      filter: drop-shadow(0 6px 8px rgba(0,0,0,.25));
      ">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function renderIconsOnSelected(regions, level) {
  if (!map || !geoLayer) return;

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
      const c = layer.getBounds().getCenter(); // centre polygon
      L.marker(c, { icon }).addTo(markerLayer);
    }
  });
}

// ---------- Zoom auto sur les wilayas sélectionnées ----------
function zoomToSelected(regions) {
  if (!map || !geoLayer) return;

  const selected = (regions || []).map(normalizeName);
  if (selected.length === 0) {
    // pas de sélection => vue Algérie
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
      if (!bounds) bounds = b;
      else bounds.extend(b);
    }
  });

  if (bounds && bounds.isValid()) {
    map.fitBounds(bounds, { padding: [20, 20] });
  }
}

// ---------- UI refresh ----------
async function refresh() {
  const res = await fetch("/api/alert", { cache: "no-store" });
  const data = await res.json();

  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const regionEl = document.getElementById("region");
  const messageEl = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  const level = data.level || "none";

  // Badge class
  badge.className = "badge " + level + (data.active ? " blink" : "");

  // ✅ récupère multi-wilayas (regions) + compat ancien (region)
  let regions = [];
  if (Array.isArray(data.regions)) regions = data.regions;
  else if (Array.isArray(data.zones)) regions = data.zones; // compat si tu avais zones
  else if (data.region) regions = [data.region];

  // Cas aucune alerte
  if (!data.active || level === "none") {
    badge.textContent = "✅ Aucune alerte";
    title.textContent = "Aucune alerte";
    messageEl.textContent = "";
    if (regionEl) regionEl.textContent = "";

    // carte: reset vue + enlever icônes + gris
    if (wilayasGeoJSON) {
      renderWilayas([], "none");
      markerLayer && markerLayer.clearLayers();
      zoomToSelected([]);
    }
  } else {
    badge.textContent = badgeText(level);

    title.textContent = data.title || "ALERTE MÉTÉO";
    messageEl.textContent = data.message || "";

    // ✅ Affichage wilayas
    if (regionEl) {
      const txt = regions.length ? regions.join(" - ") : "";
      regionEl.textContent = txt ? ("📍 Wilayas : " + txt) : "";
    }

    // ✅ Carte : color + zoom + icônes
    if (wilayasGeoJSON) {
      renderWilayas(regions, level);
      renderIconsOnSelected(regions, level);
      zoomToSelected(regions);
    }
  }

  // Date (heure)
  updatedAt.textContent = data.updatedAt
    ? new Date(data.updatedAt).toLocaleString("fr-FR")
    : "—";
}

// ---------- Boutons Facebook ----------
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

// ---------- Boot ----------
(async function boot() {
  initMap();
  await loadWilayasGeoJSON();
  // afficher wilayas même si aucune alerte (gris)
  if (wilayasGeoJSON) renderWilayas([], "none");

  await refresh();
  setInterval(refresh, 30000);
})();
