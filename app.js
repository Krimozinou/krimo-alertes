// ===============================
// Krimo Alertes — app.js (COMPLET)
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Carte Leaflet (points depuis main.json)
// ✅ Points rouges sur wilayas concernées + zoom auto
// ✅ Heure "Dernière mise à jour" OK
// ===============================

let map;
let markersLayer;

// -------- Helpers ----------
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
    "⚠️ Alerte"
  );
}

// -------- Leaflet init ----------
function initMap() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv || typeof L === "undefined") return;

  map = L.map("map", { zoomControl: true, scrollWheelZoom: false });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Vue par défaut Algérie
  map.setView([28.0, 2.5], 5);

  // Fix mobile
  setTimeout(() => map.invalidateSize(), 250);
}

// -------- Charger dataset wilayas (main.json) ----------
async function loadWilayasDataset() {
  // IMPORTANT: ton fichier doit s'appeler "main.json" et être au même niveau que index.html
  const res = await fetch("/main.json", { cache: "no-store" });
  if (!res.ok) throw new Error("main.json introuvable (vérifie qu'il est bien upload sur GitHub/Render)");
  const json = await res.json();

  // Le fichier contient { wilayas: [...] }
  const list = Array.isArray(json.wilayas) ? json.wilayas : [];
  return list;
}

// -------- Afficher points sur la carte ----------
function renderWilayasOnMap(wilayasList, selectedNames, level) {
  if (!map || !markersLayer) return;

  markersLayer.clearLayers();

  const selectedSet = new Set((selectedNames || []).map(normalizeName));
  const bounds = [];

  // couleur selon niveau
  const selectedColor =
    level === "red" ? "#e11d2e" :
    level === "orange" ? "#f97316" :
    level === "yellow" ? "#facc15" :
    "#2563eb"; // bleu si juste sélection

  wilayasList.forEach((w) => {
    const name = w.name || "";
    const lat = Number(w.latitude);
    const lng = Number(w.longitude);
    if (!name || !isFinite(lat) || !isFinite(lng)) return;

    const isSelected = selectedSet.has(normalizeName(name));

    // cercle (plus propre qu'un pin)
    const circle = L.circleMarker([lat, lng], {
      radius: isSelected ? 9 : 5,
      weight: isSelected ? 3 : 1,
      color: isSelected ? selectedColor : "#666",
      fillColor: isSelected ? selectedColor : "#999",
      fillOpacity: isSelected ? 0.9 : 0.5,
    });

    circle.bindPopup(
      `<b>${name}</b>` +
      (isSelected ? `<br/>⚠️ Wilaya concernée` : "")
    );

    circle.addTo(markersLayer);

    if (isSelected) bounds.push([lat, lng]);
  });

  // Zoom auto sur wilayas sélectionnées
  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [25, 25] });
  } else {
    map.setView([28.0, 2.5], 5);
  }

  setTimeout(() => map.invalidateSize(), 200);
}

// -------- Refresh UI ----------
async function refresh() {
  const res = await fetch("/api/alert", { cache: "no-store" });
  const data = await res.json();

  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const regionEl = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  const level = data.level || "none";

  // badge classes
  if (badge) badge.className = "badge " + level + (data.active ? " blink" : "");

  // récupérer les wilayas depuis plusieurs champs possibles
  let regions = [];
  if (Array.isArray(data.regions)) regions = data.regions;
  else if (Array.isArray(data.zones)) regions = data.zones;
  else if (Array.isArray(data.wilayas)) regions = data.wilayas;
  else if (data.region) regions = [data.region];

  // afficher texte wilayas
  const regionsText = regions.filter(Boolean).join(" - ");

  // cas aucune alerte
  if (!data.active || level === "none") {
    if (badge) badge.textContent = "✅ Aucune alerte";
    if (title) title.textContent = "Aucune alerte";
    if (message) message.textContent = "";
    if (regionEl) regionEl.textContent = "";

    // carte: afficher juste l'Algérie (sans sélection)
    try {
      const wilayasList = await loadWilayasDataset();
      renderWilayasOnMap(wilayasList, [], "none");
    } catch {
      // si main.json manque, on laisse la carte vide
    }
  } else {
    if (badge) badge.textContent = badgeText(level);
    if (title) title.textContent = data.title || "ALERTE MÉTÉO";
    if (message) message.textContent = data.message || "";

    if (regionEl) {
      regionEl.textContent = regionsText ? ("📍 Wilayas : " + regionsText) : "";
    }

    // carte: points + sélection
    try {
      const wilayasList = await loadWilayasDataset();
      renderWilayasOnMap(wilayasList, regions, level);
    } catch (e) {
      // si main.json introuvable, pas d'indication
      // (tu peux voir l'erreur dans la console navigateur)
    }
  }

  // heure (updatedAt)
  if (updatedAt) {
    updatedAt.textContent = data.updatedAt
      ? new Date(data.updatedAt).toLocaleString("fr-FR")
      : "—";
  }
}

// -------- Start ----------
initMap();
refresh();
setInterval(refresh, 30000);

// ✅ Bouton partager Facebook
const shareFbBtn = document.getElementById("shareFbBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");

if (shareFbBtn) {
  shareFbBtn.addEventListener("click", () => {
    const url = encodeURIComponent(window.location.href);
    window.open("https://www.facebook.com/sharer/sharer.php?u=" + url, "_blank");
  });
}

// ✅ Copier le lien
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
