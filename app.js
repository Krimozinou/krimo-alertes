// ===============================
// ✅ Krimo Alertes — app.js STABLE
// ✅ Points affichés dès qu'il y a des wilayas
// ✅ Ne dépend PLUS de active=true
// ✅ Debug clair en bas
// ===============================

let map;
let markersLayer;
let wilayasIndex = null;

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
  // On garde le blink si active=true (optionnel)
  return "badge " + (level || "none") + (active ? " blink" : "");
}

function detectIcon(title) {
  const t = normalizeName(title);
  if (t.includes("orage")) return "⛈️";
  if (t.includes("vent")) return "💨";
  if (t.includes("pluie") || t.includes("inond")) return "🌧️";
  if (t.includes("neige")) return "❄️";
  return "⚠️";
}

function setDebug(msg) {
  const dbg = document.getElementById("debug");
  if (dbg) dbg.textContent = msg || "";
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

  // Important sur mobile / Render
  setTimeout(() => map.invalidateSize(), 600);
}

async function loadWilayasIndex() {
  if (wilayasIndex) return wilayasIndex;

  const res = await fetch("/main.json", { cache: "no-store" });
  if (!res.ok) throw new Error("main.json introuvable (" + res.status + ")");

  const data = await res.json();
  const list = Array.isArray(data.wilayas) ? data.wilayas : [];

  const idx = new Map();

  for (const w of list) {
    const name = w.name;
    const lat = Number(w.latitude);
    const lon = Number(w.longitude);

    if (!name || !isFinite(lat) || !isFinite(lon)) continue;

    idx.set(normalizeName(name), { name, lat, lon });
  }

  // Alias simple “alger”
  if (idx.has("algiers") && !idx.has("alger")) idx.set("alger", idx.get("algiers"));
  if (idx.has("alger") && !idx.has("algiers")) idx.set("algiers", idx.get("alger"));

  wilayasIndex = idx;
  return wilayasIndex;
}

function clearMarkers() {
  if (markersLayer) markersLayer.clearLayers();
}

function addMarkersFor(wilayas) {
  if (!map || !markersLayer || !wilayasIndex) return;

  clearMarkers();

  const bounds = [];
  let added = 0;
  const missing = [];

  for (const w of wilayas) {
    const found = wilayasIndex.get(normalizeName(w));
    if (!found) {
      missing.push(w);
      continue;
    }

    // ✅ Point rouge très visible
    const marker = L.circleMarker([found.lat, found.lon], {
      radius: 10,
      color: "#ff0000",
      fillColor: "#ff0000",
      fillOpacity: 1,
      weight: 3,
    });

    marker.addTo(markersLayer);
    marker.bindPopup("📍 " + found.name);

    bounds.push([found.lat, found.lon]);
    added++;
  }

  if (bounds.length === 1) map.setView(bounds[0], 8);
  if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });

  setDebug(
    `✅ Points: ${added}/${wilayas.length}` +
    (missing.length ? ` — Introuvables: ${missing.join(", ")}` : "")
  );
}

async function refresh() {
  initMapIfNeeded();

  let alertData;
  try {
    const res = await fetch("/api/alert", { cache: "no-store" });
    if (!res.ok) throw new Error("api/alert " + res.status);
    alertData = await res.json();
  } catch (e) {
    setDebug("⚠️ Erreur chargement api/alert");
    return;
  }

  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  const level = alertData.level || "none";
  const active = !!alertData.active;

  const wilayas = Array.isArray(alertData.regions) ? alertData.regions : [];

  if (badge) {
    badge.className = badgeClass(level, active);
    badge.textContent = badgeText(level);
  }

  if (title) {
    const icon = detectIcon(alertData.title);
    title.textContent = icon + " " + (alertData.title || "Aucune alerte");
  }

  if (region) {
    region.textContent = wilayas.length ? "📍 Wilayas : " + wilayas.join(" - ") : "";
  }

  if (message) message.textContent = alertData.message || "";

  if (updatedAt) {
    updatedAt.textContent = alertData.updatedAt
      ? new Date(alertData.updatedAt).toLocaleString("fr-FR")
      : "—";
  }

  // ✅ IMPORTANT : on affiche les points dès qu’il y a des wilayas
  // (et que ce n’est pas "none"), même si active=false
  if (wilayas.length > 0 && level !== "none") {
    try {
      await loadWilayasIndex();
      // petit délai pour éviter le bug mobile (map pas “prête”)
      setTimeout(() => addMarkersFor(wilayas), 350);
    } catch (e) {
      setDebug("⚠️ Problème chargement main.json");
      clearMarkers();
    }
  } else {
    clearMarkers();
    setDebug("");
  }
}

refresh();
setInterval(refresh, 15000);
