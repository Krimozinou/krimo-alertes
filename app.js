// ===============================
// Krimo Alertes — app.js (COMPLET)
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Carte Leaflet (points depuis main.json avec fallback)
// ✅ Zoom auto sur wilayas sélectionnées
// ✅ Ne plante plus si main.json manque
// ===============================

let map;
let markersLayer;

let wilayasIndex = null; // Map(normalized -> {name, lat, lon})

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

function badgeClass(level, active) {
  return "badge " + (level || "none") + (active ? " blink" : "");
}

function initMapIfNeeded() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;
  if (map) return;

  map = L.map("map", { zoomControl: true, scrollWheelZoom: false });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  map.setView([28.0, 2.5], 5);
  setTimeout(() => map.invalidateSize(), 300);
}

function clearMarkers() {
  if (markersLayer) markersLayer.clearLayers();
}

// ✅ Charge main.json avec fallback (3 essais)
async function loadWilayasIndex() {
  if (wilayasIndex) return wilayasIndex;

  const sources = [
    "/main.json",
    "/public/main.json",
    "https://raw.githubusercontent.com/Mohamed-gp/algeria_69_wilayas/main/main.json"
  ];

  let data = null;

  for (const url of sources) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      data = await res.json();
      break;
    } catch (_) {}
  }

  if (!data) {
    throw new Error("Impossible de charger main.json (aucune source ne marche).");
  }

  const list = Array.isArray(data.wilayas) ? data.wilayas : [];
  wilayasIndex = new Map();

  for (const w of list) {
    const n = w.name || "";
    const lat = Number(w.latitude);
    const lon = Number(w.longitude);
    if (!n || !isFinite(lat) || !isFinite(lon)) continue;

    const key = normalizeName(n);
    wilayasIndex.set(key, { name: n, lat, lon });

    // alias alger/algiers
    if (key === "alger") wilayasIndex.set("algiers", { name: n, lat, lon });
    if (key === "algiers") wilayasIndex.set("alger", { name: n, lat, lon });
  }

  return wilayasIndex;
}

function addMarkersFor(wilayas, level) {
  if (!map || !markersLayer) return;

  clearMarkers();

  const color =
    level === "red" ? "#e53935" :
    level === "orange" ? "#fb8c00" :
    level === "yellow" ? "#fdd835" :
    "#444";

  const bounds = [];

  for (const name of wilayas) {
    const key = normalizeName(name);

    // ✅ Alger garanti (même si pas trouvé dans main.json)
    if (key === "alger" || key === "algiers") {
      const lat = 36.7538;
      const lon = 3.0588;

      const m = L.circleMarker([lat, lon], {
        radius: 9, color, fillColor: color, fillOpacity: 0.85, weight: 2
      }).addTo(markersLayer);

      m.bindPopup("📍 Alger");
      bounds.push([lat, lon]);
      continue;
    }

    const found = wilayasIndex ? wilayasIndex.get(key) : null;
    if (!found) continue;

    const m = L.circleMarker([found.lat, found.lon], {
      radius: 9, color, fillColor: color, fillOpacity: 0.85, weight: 2
    }).addTo(markersLayer);

    m.bindPopup("📍 " + (name || found.name));
    bounds.push([found.lat, found.lon]);
  }

  if (bounds.length === 1) map.setView(bounds[0], 9);
  else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
  else map.setView([28.0, 2.5], 5);

  setTimeout(() => map.invalidateSize(), 150);
}

async function refresh() {
  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  let data = {};
  try {
    const res = await fetch("/api/alert", { cache: "no-store" });
    data = await res.json();
  } catch (e) {
    if (title) title.textContent = "Erreur";
    if (message) message.textContent = "Impossible de charger /api/alert";
    if (updatedAt) updatedAt.textContent = "—";
    return;
  }

  const level = data.level || "none";
  const active = !!data.active;

  const wilayas =
    Array.isArray(data.regions) ? data.regions :
    Array.isArray(data.zones) ? data.zones :
    Array.isArray(data.wilayas) ? data.wilayas :
    (data.region ? [data.region] : []);

  if (badge) badge.className = badgeClass(level, active);

  // ✅ Heure (on l’écrit TOUJOURS, même si main.json plante)
  if (updatedAt) {
    updatedAt.textContent = data.updatedAt
      ? new Date(data.updatedAt).toLocaleString("fr-FR")
      : "—";
  }

  initMapIfNeeded();

  if (!active || level === "none") {
    if (badge) badge.textContent = "✅ Aucune alerte";
    if (title) title.textContent = "Aucune alerte";
    if (message) message.textContent = "";
    if (region) region.textContent = "";
    clearMarkers();
    return;
  }

  if (badge) badge.textContent = badgeText(level);
  if (title) title.textContent = data.title || "ALERTE MÉTÉO";
  if (message) message.textContent = data.message || "";

  if (region) {
    region.textContent = wilayas.length ? "📍 Wilayas : " + wilayas.join(" - ") : "";
  }

  // ✅ points (si main.json marche)
  try {
    wilayasIndex = await loadWilayasIndex();
    addMarkersFor(wilayas, level);
  } catch (e) {
    // On n’écrase pas l’heure / le texte : on affiche juste une indication
    if (message) {
      const base = (data.message || "").trim();
      const warn = "⚠️ Carte: main.json introuvable → pas de points.";
      message.textContent = base ? (base + "\n\n" + warn) : warn;
    }
    clearMarkers();
  }
}

// Partage
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

refresh();
setInterval(refresh, 30000);
