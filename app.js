// ===============================
// Krimo Alertes — app.js (COMPLET)
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Carte Leaflet (points depuis /main.json)
// ✅ Zoom auto sur wilayas sélectionnées
// ✅ Icône météo (pluie / orage / vent) dans le titre
// ✅ Message d'erreur clair si main.json/ api tombe
// ✅ Fix Alger (Alger / Algiers)
// ===============================

let map;
let markersLayer;
let wilayasIndex = null; // Map(normalizedName -> { name, lat, lon })

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

function detectHazardIcon(data) {
  const t = normalizeName(data?.title || "");
  const m = normalizeName(data?.message || "");

  // orage
  if (t.includes("orage") || m.includes("orage") || t.includes("orageux") || m.includes("orageux"))
    return "⛈️";

  // vent
  if (t.includes("vent") || m.includes("vent") || t.includes("tempete") || m.includes("tempete"))
    return "💨";

  // pluie / inond
  if (t.includes("pluie") || m.includes("pluie") || t.includes("inond") || m.includes("inond"))
    return "🌧️";

  // fallback selon niveau
  if (data?.level === "red") return "🚨";
  if (data?.level === "orange") return "⚠️";
  if (data?.level === "yellow") return "🟡";
  return "✅";
}

function setError(msg) {
  const el = document.getElementById("error");
  if (!el) return;
  if (!msg) {
    el.style.display = "none";
    el.textContent = "";
  } else {
    el.style.display = "block";
    el.textContent = "⚠️ " + msg;
  }
}

// --------- Init carte ----------
function initMapIfNeeded() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;

  if (map) return; // déjà init

  map = L.map("map", { zoomControl: true, scrollWheelZoom: false });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Vue par défaut Algérie
  map.setView([28.0, 2.5], 5);
  setTimeout(() => map.invalidateSize(), 300);
}

function clearMarkers() {
  if (markersLayer) markersLayer.clearLayers();
}

// --------- Charger index wilayas depuis main.json ----------
async function loadWilayasIndex() {
  if (wilayasIndex) return wilayasIndex;

  // IMPORTANT: on force no-store pour éviter cache téléphone
  const res = await fetch("/main.json?v=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("main.json introuvable ( /main.json )");

  const data = await res.json();
  const list = Array.isArray(data.wilayas) ? data.wilayas : [];

  const idx = new Map();

  for (const w of list) {
    const n = w.name || "";
    const lat = Number(w.latitude);
    const lon = Number(w.longitude);

    if (!n || !isFinite(lat) || !isFinite(lon)) continue;

    idx.set(normalizeName(n), { name: n, lat, lon });

    // ✅ alias spécial Alger / Algiers
    if (normalizeName(n) === "algiers") idx.set("alger", { name: n, lat, lon });
    if (normalizeName(n) === "alger") idx.set("algiers", { name: n, lat, lon });
  }

  wilayasIndex = idx;
  return wilayasIndex;
}

// --------- Placer points ----------
function addMarkersFor(wilayas, level) {
  if (!map || !markersLayer || !wilayasIndex) return;

  clearMarkers();

  const color =
    level === "red" ? "#e53935" :
    level === "orange" ? "#fb8c00" :
    level === "yellow" ? "#fdd835" :
    "#444";

  const bounds = [];
  let foundCount = 0;

  for (const name of wilayas) {
    const key = normalizeName(name);
    const found = wilayasIndex.get(key);

    if (!found) continue;

    foundCount++;

    const marker = L.circleMarker([found.lat, found.lon], {
      radius: 9,
      color: color,
      fillColor: color,
      fillOpacity: 0.9,
      weight: 2
    });

    marker.addTo(markersLayer);
    marker.bindPopup("📍 " + (name || found.name));
    bounds.push([found.lat, found.lon]);
  }

  // Zoom auto
  if (bounds.length === 1) map.setView(bounds[0], 9);
  else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
  else map.setView([28.0, 2.5], 5);

  setTimeout(() => map.invalidateSize(), 150);

  return foundCount;
}

// --------- Refresh UI ----------
async function refresh() {
  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  try {
    setError(""); // reset

    // 1) Charger alert
    const res = await fetch("/api/alert?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("API /api/alert introuvable");

    const data = await res.json();

    const level = data.level || "none";
    const active = !!data.active;

    // ✅ Multi champs possibles
    const wilayas =
      Array.isArray(data.regions) ? data.regions :
      Array.isArray(data.zones) ? data.zones :
      Array.isArray(data.wilayas) ? data.wilayas :
      (data.region ? [data.region] : []);

    // Badge
    if (badge) {
      badge.className = badgeClass(level, active);
      badge.textContent = active && level !== "none" ? badgeText(level) : "✅ Aucune alerte";
    }

    // Title + icon
    const icon = detectHazardIcon(data);
    if (title) {
      const t = active && level !== "none"
        ? (data.title || "ALERTE MÉTÉO")
        : "Aucune alerte";
      title.textContent = t;
      // si tu as un element séparé pour l’icône, sinon on préfixe au titre via CSS (ici simple)
      const iconEl = document.getElementById("titleIcon");
      if (iconEl) iconEl.textContent = icon;
    }

    if (message) message.textContent = data.message || "";

    if (region) {
      region.textContent = wilayas.length ? "📍 Wilayas : " + wilayas.join(" - ") : "";
    }

    // Date (ne doit jamais être "—" si API OK)
    if (updatedAt) {
      updatedAt.textContent = data.updatedAt
        ? new Date(data.updatedAt).toLocaleString("fr-FR")
        : new Date().toLocaleString("fr-FR");
    }

    // 2) Carte + points
    initMapIfNeeded();

    // Si pas d’alerte : on efface
    if (!active || level === "none") {
      clearMarkers();
      map.setView([28.0, 2.5], 5);
      return;
    }

    // Charger main.json
    try {
      await loadWilayasIndex();
    } catch (e) {
      clearMarkers();
      setError("Impossible de charger main.json (points). Vérifie que /main.json s’ouvre.");
      return;
    }

    const foundCount = addMarkersFor(wilayas, level);

    if (!foundCount) {
      setError("Aucune wilaya trouvée dans main.json (noms différents ?).");
    }

  } catch (e) {
    clearMarkers();
    setError("Erreur de chargement (api/alert ou main.json)");
    // On essaie quand même d'afficher une heure locale
    const updatedAt = document.getElementById("updatedAt");
    if (updatedAt && updatedAt.textContent.trim() === "—") {
      updatedAt.textContent = new Date().toLocaleString("fr-FR");
    }
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
