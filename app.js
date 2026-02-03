// =====================
//  Krimo Alertes - app.js (COMPLET)
// =====================

function getZones(data) {
  // Nouveau format : zones[]
  if (Array.isArray(data?.zones)) return data.zones.filter(Boolean);

  // Compat ancien : region
  if (typeof data?.region === "string" && data.region.trim()) return [data.region.trim()];

  return [];
}

function formatBadgeText(level, active) {
  if (!active || level === "none") return "✅ Aucune alerte";
  if (level === "yellow") return "🟡 Vigilance Jaune";
  if (level === "orange") return "🟠 Vigilance Orange";
  if (level === "red") return "🔴 Vigilance Rouge";
  return "⚠️ Alerte";
}

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ✅ Liste 69 (58 + 11 Krimo)
const ALL_ZONES = [
  "Adrar","Chlef","Laghouat","Oum El Bouaghi","Batna","Béjaïa","Biskra","Béchar","Blida","Bouira",
  "Tamanrasset","Tébessa","Tlemcen","Tiaret","Tizi Ouzou","Alger","Djelfa","Jijel","Sétif","Saïda",
  "Skikda","Sidi Bel Abbès","Annaba","Guelma","Constantine","Médéa","Mostaganem","M’Sila","Mascara","Ouargla",
  "Oran","El Bayadh","Illizi","Bordj Bou Arréridj","Boumerdès","El Tarf","Tindouf","Tissemsilt","El Oued","Khenchela",
  "Souk Ahras","Tipaza","Mila","Aïn Defla","Naâma","Aïn Témouchent","Ghardaïa","Relizane","Timimoun","Bordj Badji Mokhtar",
  "Ouled Djellal","Béni Abbès","In Salah","In Guezzam","Touggourt","Djanet","El Meghaier","El Meniaa",

  // +11 Krimo
  "Aflou","Brikcha (Bir El Ater)","El-Qantara","Bir El Ater","El Aricha","Ksar Chelala","Aïn Oussera","M’saâd",
  "Ksar El Boukhari","Boussaâda","El Abiodh Sidi Cheikh"
];

function renderMap(selectedZones) {
  const map = document.getElementById("map");
  if (!map) return; // si pas de conteneur dans index.html

  // évite de recréer si déjà fait
  if (!map.dataset.ready) {
    map.dataset.ready = "1";
    map.innerHTML = `
      <div style="margin-top:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <h3 style="margin:0;">🗺️ Carte interactive (wilayas)</h3>
          <input id="mapSearch" placeholder="Rechercher..." style="max-width:260px;width:100%;padding:10px;border-radius:12px;border:1px solid #e3e8ef;" />
        </div>

        <div id="mapGrid"
             style="margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
        </div>

        <small style="display:block;margin-top:10px;opacity:.75;">
          Astuce : les wilayas concernées par l’alerte sont surlignées.
        </small>
      </div>
    `;

    // events recherche
    const mapSearch = document.getElementById("mapSearch");
    mapSearch.addEventListener("input", () => {
      const q = normalize(mapSearch.value);
      const chips = map.querySelectorAll("[data-zone]");
      chips.forEach(chip => {
        const z = normalize(chip.getAttribute("data-zone"));
        chip.style.display = z.includes(q) ? "" : "none";
      });
    });
  }

  const set = new Set(selectedZones.map(z => normalize(z)));

  const grid = document.getElementById("mapGrid");
  grid.innerHTML = "";

  for (const zone of ALL_ZONES) {
    const isOn = set.has(normalize(zone));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = zone;
    btn.setAttribute("data-zone", zone);

    btn.style.padding = "10px 12px";
    btn.style.borderRadius = "14px";
    btn.style.border = "1px solid #e3e8ef";
    btn.style.cursor = "pointer";
    btn.style.textAlign = "left";
    btn.style.fontWeight = "600";
    btn.style.background = isOn ? "#ffe3e3" : "#f7f9fc";
    btn.style.color = "#111";

    // petit indicateur
    const dot = document.createElement("span");
    dot.textContent = isOn ? "  🔴" : "  ⚪";
    dot.style.fontWeight = "700";
    btn.appendChild(dot);

    // clic = juste info (pas modification)
    btn.addEventListener("click", () => {
      if (isOn) {
        alert("✅ Wilaya concernée par l’alerte : " + zone);
      } else {
        alert("ℹ️ Wilaya non concernée par l’alerte : " + zone);
      }
    });

    grid.appendChild(btn);
  }
}

async function refresh() {
  const res = await fetch("/api/alert", { cache: "no-store" });
  const data = await res.json();

  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region"); // affichage wilayas
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  const level = data.level || "none";
  const active = !!data.active;

  // Classe du badge + clignotement si actif
  if (badge) badge.className = "badge " + level + (active ? " blink" : "");

  // Texte badge
  if (badge) badge.textContent = formatBadgeText(level, active);

  // Zones / wilayas
  const zones = getZones(data);

  // Cas : pas d’alerte
  if (!active || level === "none") {
    if (title) title.textContent = "Aucune alerte";
    if (message) message.textContent = "";
    if (region) region.textContent = "";
    renderMap([]); // carte vide
  } else {
    if (title) title.textContent = data.title || "ALERTE MÉTÉO";
    if (message) message.textContent = data.message || "";
    if (region) region.textContent = zones.length ? ("📍 Wilayas : " + zones.join(" • ")) : "";
    renderMap(zones);
  }

  // Date
  if (updatedAt) {
    updatedAt.textContent = data.updatedAt
      ? new Date(data.updatedAt).toLocaleString("fr-FR")
      : "—";
  }
}

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
