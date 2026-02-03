let map = null;
let markersLayer = null;
let mapReady = false;

function safeSet(el, text) {
  if (el) el.textContent = text;
}

function normalizeRegions(data) {
  // Supporte toutes les versions: regions[], zones[], region (string)
  if (Array.isArray(data.regions)) return data.regions.filter(Boolean);
  if (Array.isArray(data.zones)) return data.zones.filter(Boolean);
  if (typeof data.region === "string" && data.region.trim()) return [data.region.trim()];
  return [];
}

function initMapIfPossible() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;

  // Donne une hauteur minimale au cas où le CSS n’est pas chargé
  if (!mapDiv.style.height) mapDiv.style.height = "280px";

  // Leaflet pas chargé => on n’explose pas
  if (typeof window.L === "undefined") {
    mapDiv.innerHTML =
      `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#666;">
        Carte indisponible (Leaflet non chargé)
      </div>`;
    return;
  }

  // Déjà initialisée
  if (mapReady) return;

  try {
    map = L.map("map", { zoomControl: true }).setView([28.0, 2.8], 5); // Algérie approx
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap"
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
    mapReady = true;

    // Fix taille si la carte est dans un container qui change
    setTimeout(() => map.invalidateSize(), 250);
  } catch (e) {
    mapDiv.innerHTML =
      `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#b00020;">
        Erreur carte
      </div>`;
    console.error("Erreur Leaflet:", e);
  }
}

function setMapMarkers(regions, level, active) {
  if (!mapReady || !map || !markersLayer) return;

  markersLayer.clearLayers();

  // Si pas d’alerte => pas de marqueurs (tu peux aussi afficher un centre Algérie)
  if (!active || level === "none" || regions.length === 0) {
    map.setView([28.0, 2.8], 5);
    return;
  }

  // ✅ Coordonnées simples (à compléter plus tard si tu veux “super pro”)
  // Pour l’instant: marqueur au centre de l’Algérie + popup liste wilayas
  const label = regions.join(" - ");
  const marker = L.marker([28.0, 2.8]).addTo(markersLayer);
  marker.bindPopup(`<b>Wilayas :</b><br>${label}`).openPopup();
  map.setView([28.0, 2.8], 5);
}

async function refresh() {
  try {
    const res = await fetch("/api/alert", { cache: "no-store" });
    const data = await res.json();

    const badge = document.getElementById("badge");
    const title = document.getElementById("title");
    const regionEl = document.getElementById("region");
    const message = document.getElementById("message");
    const updatedAt = document.getElementById("updatedAt");

    const level = data.level || "none";
    const active = !!data.active;

    // Badge style
    if (badge) {
      badge.className = "badge " + level + (active ? " blink" : "");
    }

    // Heure (même si carte plante, ça doit s’afficher)
    safeSet(
      updatedAt,
      data.updatedAt ? new Date(data.updatedAt).toLocaleString("fr-FR") : "—"
    );

    const regions = normalizeRegions(data);

    // Cas: aucune alerte
    if (!active || level === "none") {
      safeSet(badge, "✅ Aucune alerte");
      safeSet(title, "Aucune alerte");
      safeSet(message, "");
      safeSet(regionEl, "");
      initMapIfPossible();          // carte “ok” mais vide
      setMapMarkers([], level, false);
      return;
    }

    // Texte badge
    const badgeText =
      level === "yellow" ? "🟡 Vigilance Jaune" :
      level === "orange" ? "🟠 Vigilance Orange" :
      level === "red" ? "🔴 Vigilance Rouge" :
      "⚠️ Alerte";

    safeSet(badge, badgeText);
    safeSet(title, data.title || "ALERTE MÉTÉO");
    safeSet(message, data.message || "");

    // Wilayas
    if (regionEl) {
      regionEl.textContent = regions.length
        ? ("📍 Wilayas : " + regions.join(" - "))
        : "";
    }

    // Carte
    initMapIfPossible();
    setMapMarkers(regions, level, active);

  } catch (e) {
    console.error("refresh() erreur:", e);
    // Même en cas d’erreur, on évite de casser la page
  }
}

document.addEventListener("DOMContentLoaded", () => {
  refresh();
  setInterval(refresh, 30000);

  // Partage FB
  const shareFbBtn = document.getElementById("shareFbBtn");
  if (shareFbBtn) {
    shareFbBtn.addEventListener("click", () => {
      const url = encodeURIComponent(window.location.href);
      window.open("https://www.facebook.com/sharer/sharer.php?u=" + url, "_blank");
    });
  }

  // Copier lien
  const copyLinkBtn = document.getElementById("copyLinkBtn");
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
});
