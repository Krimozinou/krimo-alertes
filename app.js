// ===============================
// Krimo Alertes — app.js (COMPLET)
// ✅ Multi-wilayas (regions / zones / wilayas / region)
// ✅ Carte Leaflet (points depuis /main.json)
// ✅ Points + zoom auto
// ✅ Icône simple (pluie/orange/vent) dans le titre
// ✅ Message erreur clair si /api/alert ou /main.json échoue
// ===============================

let map;
let markersLayer;

let wilayasIndex = null; // Map(normalized -> {name, lat, lon})

// -------- Helpers --------
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
    "✅ Aucune alerte"
  );
}

function badgeClass(level, active) {
  return "badge " + (level || "none") + (active ? " blink" : "");
}

// Icône météo selon titre/message
function detectHazardIcon(data) {
  const t = normalizeName(data?.title || "");
  const m = normalizeName(data?.message || "");

  if (t.includes("orage") || m.includes("orage")) return "⛈️";
  if (t.includes("vent") || m.includes("vent") || t.includes("tempete") || m.includes("tempete")) return "💨";
  if (t.includes("pluie") || m.includes("pluie") || t.includes("inond") || m.includes("inond")) return "🌧️";

  // fallback niveau
  if (data?.level === "red") return "🚨";
  if (data?.level === "orange") return "⚠️";
  if (data?.level === "yellow") return "🟡";
  return "🚨";
}

// -------- Erreur UI --------
function setError(text) {
  let el = document.getElementById("errorBox");
  if (!el) {
    el = document.createElement("div");
    el.id = "errorBox";
    el.style.margin = "8px 0 0";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "10px";
    el.style.background = "#fff3cd";
    el.style.color = "#664d03";
    el.style.fontWeight = "700";
    el.textContent = "";
    const title = document.getElementById("title");
    if (title && title.parentNode) title.parentNode.insertBefore(el, title.nextSibling);
  }
  el.textContent = "⚠️ " + text;
  el.style.display = "block";
}

function clearError() {
  const el = document.getElementById("errorBox");
  if (el) el.style.display = "none";
}

// -------- Map --------
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

  if (bounds.length === 1) map.setView(bounds[0], 9);
  else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
  else map.setView([28.0, 2.5], 5);

  setTimeout(() => map.invalidateSize(), 150);
}

// -------- Charger main.json --------
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

    // alias Alger
    if (normalizeName(n) === "algiers") wilayasIndex.set("alger", { name: n, lat, lon });
    if (normalizeName(n) === "alger") wilayasIndex.set("algiers", { name: n, lat, lon });
  }

  return wilayasIndex;
}

// -------- Refresh --------
async function refresh() {
  try {
    clearError();

    // 1) alert
    const r1 = await fetch("/api/alert", { cache: "no-store" });
    if (!r1.ok) throw new Error("api/alert ne répond pas");
    const data = await r1.json();

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

    if (badge) {
      badge.className = badgeClass(level, active);
      badge.textContent = badgeText(level);
    }

    // 2) date (toujours)
    if (updatedAt) {
      updatedAt.textContent = data.updatedAt
        ? new Date(data.updatedAt).toLocaleString("fr-FR")
        : "—";
    }

    // 3) UI + carte
    initMapIfNeeded();

    if (!active || level === "none") {
      const icon = "🚨";
      if (title) title.textContent = icon + " Aucune alerte";
      if (message) message.textContent = "";
      if (region) region.textContent = wilayas.length ? "📍 Wilayas : " + wilayas.join(" - ") : "";
      clearMarkers();
      return;
    }

    const icon = detectHazardIcon(data);
    if (title) title.textContent = icon + " " + (data.title || "ALERTE MÉTÉO");
    if (message) message.textContent = data.message || "";
    if (region) region.textContent = wilayas.length ? "📍 Wilayas : " + wilayas.join(" - ") : "";

    // 4) main.json + points
    await loadWilayasIndex();
    addMarkersFor(wilayas, level);
  } catch (e) {
    setError("Erreur de chargement (api/alert ou main.json)");
    // on évite de casser la page
    try { initMapIfNeeded(); } catch {}
  }
}

// -------- Partage --------
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
