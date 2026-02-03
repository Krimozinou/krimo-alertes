// ===============================
// Krimo Alertes — app.js (STABLE + ICÔNES)
// ✅ Points sur carte (Leaflet) depuis /main.json
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Zoom auto sur wilayas sélectionnées
// ✅ Heure "Dernière mise à jour" OK
// ✅ Fix Alger (Alger / Algiers)
// ✅ Icône alerte (pluie / orage / vent) devant le titre
// ===============================

let map;
let markersLayer;
let wilayasIndex = null; // Map(normalizedName -> { name, lat, lon })

// ---------- Helpers ----------
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
    "✅ Aucune alerte"
  );
}

function badgeClass(level, active) {
  return "badge " + (level || "none") + (active ? " blink" : "");
}

// ✅ Détecter l’icône depuis title/message
function hazardIcon(data) {
  const t = normalizeName(data?.title || "");
  const m = normalizeName(data?.message || "");

  // Orage / orageux / tonnerre
  if (t.includes("orage") || m.includes("orage") || t.includes("orageux") || m.includes("orageux")) {
    return "⛈️";
  }

  // Vent / tempête
  if (t.includes("vent") || m.includes("vent") || t.includes("tempete") || m.includes("tempete")) {
    return "🌪️";
  }

  // Pluie / inondation / pluies torrentielles
  if (t.includes("pluie") || m.includes("pluie") || t.includes("inond") || m.includes("inond") || t.includes("torrent") || m.includes("torrent")) {
    return "🌧️";
  }

  // Fallback selon niveau
  const lvl = data?.level || "none";
  if (lvl === "red") return "🚨";
  if (lvl === "orange") return "⚠️";
  if (lvl === "yellow") return "🟡";
  return "✅";
}

// ---------- Map init ----------
function initMapIfNeeded() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;
  if (map) return;

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

// ---------- Load wilayas index from /main.json ----------
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

    // Alias Alger / Algiers
    if (key === "algiers") wilayasIndex.set("alger", { name: n, lat, lon });
    if (key === "alger") wilayasIndex.set("algiers", { name: n, lat, lon });
  }

  return wilayasIndex;
}

// ---------- Markers ----------
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

  // Zoom auto
  if (bounds.length === 1) {
    map.setView(bounds[0], 9);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [30, 30] });
  } else {
    map.setView([28.0, 2.5], 5);
  }

  setTimeout(() => map.invalidateSize(), 150);
}

// ---------- Refresh UI ----------
async function refresh() {
  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  try {
    const res = await fetch("/api/alert", { cache: "no-store" });
    if (!res.ok) throw new Error("API /api/alert inaccessible");
    const data = await res.json();

    const level = data.level || "none";
    const active = !!data.active;

    // Multi champs possibles
    const wilayas =
      Array.isArray(data.regions) ? data.regions :
      Array.isArray(data.zones) ? data.zones :
      Array.isArray(data.wilayas) ? data.wilayas :
      (data.region ? [data.region] : []);

    // Badge
    if (badge) {
      badge.className = badgeClass(level, active);
      badge.textContent = badgeText(level);
    }

    // Titre & message
    const icon = hazardIcon(data);

    if (!active || level === "none") {
      if (title) title.textContent = icon + " Aucune alerte";
      if (message) message.textContent = "";
      if (region) region.textContent = "";
    } else {
      if (title) title.textContent = icon + " " + (data.title || "ALERTE MÉTÉO");
      if (message) message.textContent = data.message || "";
      if (region) {
        region.textContent = wilayas.length ? "📍 Wilayas : " + wilayas.join(" - ") : "";
      }
    }

    // Date à droite
    if (updatedAt) {
      updatedAt.textContent = data.updatedAt
        ? new Date(data.updatedAt).toLocaleString("fr-FR")
        : "—";
    }

    // Carte
    initMapIfNeeded();
    await loadWilayasIndex();

    if (!active || level === "none") {
      clearMarkers();
    } else {
      addMarkersFor(wilayas, level);
    }
  } catch (e) {
    // Ne pas casser l’UI
    if (updatedAt) updatedAt.textContent = "—";
    if (message) message.textContent = "⚠️ Problème de chargement (api/alert ou main.json)";
    initMapIfNeeded();
    clearMarkers();
  }
}

// ---------- Share buttons ----------
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

// ---------- Start ----------
refresh();
setInterval(refresh, 30000);
