// ===============================
// Krimo Alertes — app.js (COMPLET)
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Carte Leaflet (points depuis /main.json)
// ✅ Zoom auto sur wilayas sélectionnées
// ✅ Fix Alger (Alger / Algiers) GARANTI
// ===============================

let map;
let markersLayer;

let wilayasIndex = null; // Map(normalizedName -> {name, lat, lon})

// --------- Helpers ----------
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
    "⚠️ Alerte"
  );
}

function badgeClass(level, active) {
  return "badge " + (level || "none") + (active ? " blink" : "");
}

// --------- Init carte ----------
function initMapIfNeeded() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;

  if (map) return; // déjà init

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

// --------- Charger index wilayas depuis main.json ----------
async function loadWilayasIndex() {
  if (wilayasIndex) return wilayasIndex;

  const res = await fetch("/main.json", { cache: "no-store" });
  if (!res.ok) throw new Error("main.json introuvable ( /main.json )");

  const data = await res.json();

  // data.wilayas = [{name, latitude, longitude, ...}]
  const list = Array.isArray(data.wilayas) ? data.wilayas : [];

  wilayasIndex = new Map();

  for (const w of list) {
    const n = w.name || "";
    const lat = Number(w.latitude);
    const lon = Number(w.longitude);
    if (!n || !isFinite(lat) || !isFinite(lon)) continue;

    wilayasIndex.set(normalizeName(n), { name: n, lat, lon });

    // ✅ alias spécial Alger (au cas où)
    if (normalizeName(n) === "algiers") {
      wilayasIndex.set("alger", { name: "Alger", lat, lon });
    }
    if (normalizeName(n) === "alger") {
      wilayasIndex.set("algiers", { name: "Algiers", lat, lon });
    }
  }

  return wilayasIndex;
}

// --------- Placer points ----------
function clearMarkers() {
  if (markersLayer) markersLayer.clearLayers();
}

function addMarkersFor(wilayas, level) {
  if (!map || !markersLayer || !wilayasIndex) return;

  clearMarkers();

  // couleur simple par niveau
  const color =
    level === "red" ? "#e53935" :
    level === "orange" ? "#fb8c00" :
    level === "yellow" ? "#fdd835" :
    "#444";

  const bounds = [];

  for (const name of wilayas) {
    const key = normalizeName(name);

    // ✅ FIX GARANTI pour Alger (même si ça ne match pas)
    if (key === "alger" || key === "algiers") {
      const lat = 36.7538;
      const lon = 3.0588;

      const marker = L.circleMarker([lat, lon], {
        radius: 9,
        color: color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 2
      }).addTo(markersLayer);

      marker.bindPopup("📍 Alger");
      bounds.push([lat, lon]);
      continue;
    }

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
    // rien trouvé -> vue Algérie
    map.setView([28.0, 2.5], 5);
  }

  setTimeout(() => map.invalidateSize(), 150);
}

// --------- Refresh UI ----------
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

  // ✅ Multi champs possibles
  const wilayas =
    Array.isArray(data.regions) ? data.regions :
    Array.isArray(data.zones) ? data.zones :
    Array.isArray(data.wilayas) ? data.wilayas :
    (data.region ? [data.region] : []);

  // Badge
  if (badge) badge.className = badgeClass(level, active);

  // Cas aucune alerte
  if (!active || level === "none") {
    if (badge) badge.textContent = "✅ Aucune alerte";
    if (title) title.textContent = "Aucune alerte";
    if (message) message.textContent = "";
    if (region) region.textContent = "";

    initMapIfNeeded();
    try { await loadWilayasIndex(); } catch {}
    clearMarkers();
  } else {
    if (badge) badge.textContent = badgeText(level);
    if (title) title.textContent = data.title || "ALERTE MÉTÉO";
    if (message) message.textContent = data.message || "";

    if (region) {
      region.textContent = wilayas.length
        ? "📍 Wilayas : " + wilayas.join(" - ")
        : "";
    }

    initMapIfNeeded();
    wilayasIndex = await loadWilayasIndex();
    addMarkersFor(wilayas, level);
  }

  // Date
  if (updatedAt) {
    updatedAt.textContent = data.updatedAt
      ? new Date(data.updatedAt).toLocaleString("fr-FR")
      : "—";
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
