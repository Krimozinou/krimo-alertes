async function refresh() {
  const res = await fetch("/api/alert", { cache: "no-store" });
  const data = await res.json();

  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  const level = data.level || "none";

  // ✅ Badge + Blink
  badge.className = "badge " + level + (data.active ? " blink" : "");

  // ✅ Si aucune alerte
  if (!data.active || level === "none") {
    badge.textContent = "✅ Aucune alerte";
    title.textContent = "Aucune alerte";
    message.textContent = "";
    region.textContent = "";
  }

  // ✅ Si alerte active
  else {
    badge.textContent =
      level === "yellow"
        ? "🟡 Vigilance Jaune"
        : level === "orange"
        ? "🟠 Vigilance Orange"
        : level === "red"
        ? "🔴 Vigilance Rouge"
        : "⚠️ Alerte";

    title.textContent = data.title || "ALERTE MÉTÉO";
    message.textContent = data.message || "";

    // ✅ Plusieurs wilayas affichées
    const zones = Array.isArray(data.zones) ? data.zones : [];

    if (zones.length > 0) {
      region.textContent = "📍 Wilayas : " + zones.join(" - ");
    } else {
      region.textContent = "";
    }
  }

  // ✅ Date mise à jour
  updatedAt.textContent = data.updatedAt
    ? new Date(data.updatedAt).toLocaleString("fr-FR")
    : "—";
}

refresh();
setInterval(refresh, 30000);

// ✅ Bouton partager Facebook
const shareFbBtn = document.getElementById("shareFbBtn");
if (shareFbBtn) {
  shareFbBtn.addEventListener("click", () => {
    const url = encodeURIComponent(window.location.href);
    window.open(
      "https://www.facebook.com/sharer/sharer.php?u=" + url,
      "_blank"
    );
  });
}

// ✅ Copier le lien
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
