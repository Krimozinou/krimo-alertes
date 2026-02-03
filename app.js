// ===============================
// Krimo Alertes — app.js (COMPLET)
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Carte Leaflet (points depuis /main.json)
// ✅ Zoom auto sur wilayas sélectionnées
// ✅ Heure "Dernière mise à jour" OK
// ✅ Icône météo (pluie / orage / vent) dans le titre
// ✅ Fix Alger (Alger / Algiers)
// ===============================

let map;
let markersLayer;
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

// Icône selon le contenu (simple et efficace)
function detectHazardIcon(data) {
  const t = normalizeName(data?.title || "");
  const m = normalizeName(data?.message || "");

  // orage
  if (t.includes("orage") || m.includes("orage") || t.includes("tempete") || m.includes("tempete")) return "⛈️";
  // vent
  if (t.includes("vent") || m.includes("vent")) return "💨";
  // pluie / inondation
  if (t.includes("pluie") || m.includes("pluie") || t.includes("inond") || m.includes("inond")) return "🌧️";

  // fallback par niveau
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

  markersLayer = L.layerGroup().addTo(map);

  map.setView([28.0, 2.5], 5);
  setTimeout(() => map.invalidateSize(), 300);
}

async function loadWilayasIndex() {
  if (wilayasIndex) return wilayasIndex;

  const res = await fetch("/main.json", { cache: "no-store" });
  if (!res.ok) throw new Error("main.json introuvable ( /main.json )");

  const data = await res.json();
  const list = Array.isArray(data.wilayas) ? data.wilayas : [];

  wilayasIndex = new Map();

  for (const w of list) {
    const n = w.name || "";
    const lat = Number(w.latitude);
    const lon = Number(w.longitude);
    if (!n || !isFinite(lat) || !isFinite(lon)) continue;

    const key = normalizeName(n);
    wilayasIndex.set(key, { name: n, lat, lon });

    // ✅ Fix Alger / Algiers
    if (key === "alger") wilayasIndex.set("algiers", { name: n, lat, lon });
    if (key === "algiers") wilayasIndex.set("alger", { name: n, lat, lon });
  }

  return wilayasIndex;
}

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
      color,
      fillColor: color,
      fillOpacity: 0.85,
      weight: 2,
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

    // multi champs possibles
    const wilayas =
      Array.isArray(data.regions) ? data.regions :
      Array.isArray(data.zones) ? data.zones :
      Array.isArray(data.wilayas) ? data.wilayas :
      (data.region ? [data.region] : []);

    // Badge
    if (badge) {
      badge.className = badgeClass(level, active && level !== "none");
      badge.textContent = (!active || level === "none") ? "✅ Aucune alerte" : badgeText(level);
    }

    // Heure
    if (updatedAtEl) {
      updatedAtEl.textContent = data.updatedAt
        ? new Date(data.updatedAt).toLocaleString("fr-FR")
        : "—";
    }

    // Texte
    if (!active || level === "none") {
      if (titleEl) titleEl.textContent = "Aucune alerte";
      if (regionEl) regionEl.textContent = "";
      if (messageEl) messageEl.textContent = "";

      initMapIfNeeded();
      clearMarkers();
      return;
    }

    const icon = detectHazardIcon(data);
    if (titleEl) titleEl.textContent = (icon ? icon + " " : "") + (data.title || "ALERTE MÉTÉO");
    if (regionEl) regionEl.textContent = wilayas.length ? "📍 Wilayas : " + wilayas.join(" - ") : "";
    if (messageEl) messageEl.textContent = data.message || "";

    // Carte + points
    initMapIfNeeded();
    await loadWilayasIndex();
    addMarkersFor(wilayas, level);

  } catch (e) {
    // En cas d'erreur : on affiche proprement
    if (updatedAtEl) updatedAtEl.textContent = "—";
    if (regionEl) regionEl.textContent = "⚠️ Erreur chargement main.json / points";
    initMapIfNeeded();
    clearMarkers();
  }
}

// Boutons Facebook
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

// Start
refresh();
setInterval(refresh, 30000);
