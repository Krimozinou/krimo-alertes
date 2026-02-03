let map;          // la carte
let markerLayer;  // couche des marqueurs

function initLeaflet() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;

  // ✅ Evite double init (si refresh appelle plusieurs fois)
  if (map) return;

  // ✅ Centre par défaut : Alger
  map = L.map("map", { zoomControl: true }).setView([36.7538, 3.0588], 6);

  // ✅ Fond de carte gratuit (OpenStreetMap)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 18
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
}

// ✅ Met à jour la carte selon les wilayas sélectionnées
function updateMap(data) {
  initLeaflet();
  if (!map || !markerLayer) return;

  markerLayer.clearLayers();

  // ✅ Récupère les wilayas (nouveau = regions[], ancien = region)
  const list = Array.isArray(data.regions) && data.regions.length
    ? data.regions
    : (data.region ? [data.region] : []);

  // ✅ Si aucune alerte -> centre carte sur Algérie
  if (!data.active || data.level === "none" || list.length === 0) {
    map.setView([28.0339, 1.6596], 5); // Algérie
    return;
  }

  // ✅ Pour l’instant: 1 marker sur Alger + popup texte
  // (Prochaine étape: on met les vraies coordonnées de chaque wilaya)
  const popupText = "Wilayas : " + list.join(" - ");
  const m = L.marker([36.7538, 3.0588]).bindPopup(popupText);
  markerLayer.addLayer(m);
  m.openPopup();

  map.setView([36.7538, 3.0588], 6);
}

async function refresh() {
  const res = await fetch("/api/alert", { cache: "no-store" });
  const data = await res.json();

  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  const level = data.level || "none";

  badge.className = "badge " + level + (data.active ? " blink" : "");

  // ✅ Affichage texte wilayas
  const list = Array.isArray(data.regions) && data.regions.length
    ? data.regions
    : (data.region ? [data.region] : []);
