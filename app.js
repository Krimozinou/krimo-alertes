async function refresh() {
  const res = await fetch("/api/alert", { cache: "no-store" });
  const data = await res.json();

  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region"); // on garde l'id "region" dans HTML, mais on affiche Zone
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  const level = data.level || "none";

  // Classe du badge + clignotement si actif
  badge.className = "badge " + level + (data.active ? " blink" : "");

  // Cas : pas d’alerte
  if (!data.active || level === "none") {
    badge.textContent = "✅ Aucune alerte";
    title.textContent = "Aucune alerte";
    message.textContent = "";
    if (region) region.textContent = "";
  } else {
    // Texte du badge
    badge.textContent =
      level === "yellow" ? "🟡 Vigilance Jaune" :
      level === "orange" ? "🟠 Vigilance Orange" :
      level === "red" ? "🔴 Vigilance Rouge" :
      "⚠️ Alerte";

    // Titre & message
    title.textContent = data.title || "ALERTE MÉTÉO";
    message.textContent = data.message || "";

    // ✅ Zone/Wilaya (stockée dans data.region)
    const z = data.region || "";
    if (region) {
      region.textContent = z ? ("📍 Zone : " + z) : "";
    }
  }

  // Date
  updatedAt.textContent = data.updatedAt
    ? new Date(data.updatedAt).toLocaleString("fr-FR")
    : "—";
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
