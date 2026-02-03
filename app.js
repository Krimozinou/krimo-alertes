// ===============================
// Krimo Alertes — app.js (COMPLET)
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Carte Leaflet (points depuis /main.json)
// ✅ Zoom auto sur wilayas sélectionnées
// ✅ Icône pluie/orage/vent dans le titre
// ===============================

let map;
let markersLayer = null;
let wilayasIndex = null; // Map(normalizedName -> {name, lat, lon})

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

// ✅ Détecter une icône à mettre devant le titre
function detectHazardIcon(data) {
  const t = normalizeName(data?.title || "");
  const m = normalizeName(data?.message || "");

  // orage
  if (t.includes("orage") || m.includes("orage")) return "⛈️";
  // vent
  if (t.includes("vent") || m.includes("vent") || t.includes("tempete") || m.includes("tempete")) return "🌬️";
  // pluie / inondation
  if (t.includes("pluie") || m.includes("pluie") || t.includes("inond") || m.includes("inond")) return "🌧️";

  // sinon selon niveau
  if (data?.level === "red") return "🚨";
  if (data?.level === "orange") return "⚠️";
  if (data?.level === "yellow") return "🟡";
  return "";
}

function initMapIfNeeded() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;
  if (map) return;

  map = L.map("map", { zoomControl: true, scrollWheelZoom: false });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  // ✅ layer des points
  markersLayer = L.layerGroup().addTo(map);

  map.setView([28.0, 2.5], 5);
  setTimeout(() => map.invalidateSize(), 300);
}

async function loadWilayasIndex() {
  if (wilayasIndex) return wilayasIndex;

  const res = await fetch("/main.json", { cache: "no-store" });
  if (!res.ok) throw new Error("main.json introuvable");

  const data = await res.json();
  const list = Array.isArray(data.wilayas) ? data.wilayas : [];

  wilayasIndex = new Map();

  for (const w of list) {
    const n = w.name || "";
    const lat = Number(w.latitude);
    const lon = Number(w.longitude);
    if (!n || !isFinite(lat) || !isFinite(lon)) continue;

    wilayasIndex.set(normalizeName(n), { name: n, lat, lon });

    // ✅ alias Alger / Algiers
    if (normalizeName(n) === "algiers") wilayasIndex.set("alger", { name: n, lat, lon });
    if (normalizeName(n) === "alger") wilayasIndex.set("algiers", { name: n, lat, lon });
  }

  return wilayasIndex;
}

function clearMarkers() {
  try {
    if (markersLayer) markersLayer.clearLayers();
  } catch {}
}

function addMarkersFor(wilayas, level) {
  if (!map || !wilayasIndex) return;

  // ✅ si layer cassée, on la recrée
  if (!markersLayer) markersLayer = L.layerGroup().addTo(map);

  clearMarkers();

  const color =
    level === "red" ? "#e53935" :
    level === "orange" ? "#fb8c00" :
    level === "yellow" ? "#fdd835" :
    "#444";

  const bounds = [];

  for (const name of wilayas) {
    const found = wilayasIndex.get(normalizeName(name));
    if (!found) continue;

    const circle = L.circleMarker([found.lat, found.lon], {
      radius: 10,
      color,
      fillColor: color,
      fillOpacity: 0.9,
      weight: 2
    });

    // ✅ IMPORTANT : on ajoute à la layer, sinon direct à la map
    try {
      circle.addTo(markersLayer);
    } catch {
      circle.addTo(map);
    }

    circle.bindPopup("📍 " + name);
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

  const wilayas =
    Array.isArray(data.regions) ? data.regions :
    Array.isArray(data.zones) ? data.zones :
    Array.isArray(data.wilayas) ? data.wilayas :
    (data.region ? [data.region] : []);

  if (badge) badge.className = badgeClass(level, active);

  // ✅ Date à droite
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

  // ✅ icône dans le titre
  const ico = detectHazardIcon(data);
  if (title) title.textContent = (ico ? (ico + " ") : "") + (data.title || "ALERTE MÉTÉO");

  if (badge) badge.textContent = badgeText(level);
  if (message) message.textContent = data.message || "";
  if (region) region.textContent = wilayas.length ? "📍 Wilayas : " + wilayas.join(" - ") : "";

  try {
    wilayasIndex = await loadWilayasIndex();
    addMarkersFor(wilayas, level);
  } catch (e) {
    // si main.json ne charge pas, au moins on ne casse pas la page
    clearMarkers();
    console.error("Erreur main.json / points:", e);
  }
}

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

refresh();
setInterval(refresh, 30000);
