async function refresh() {
  const res = await fetch("/api/alert", { cache: "no-store" });
  const data = await res.json();

  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region"); // on garde l'id region dans HTML
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  const level = data.level || "none";

  badge.className = "badge " + level + (data.active ? " blink" : "");

  // ✅ Wilayas (nouveau)
  const wilayas = Array.isArray(data.wilayas) ? data.wilayas : [];
  const wilayasTxt =
    wilayas.length === 0
      ? ""
      : wilayas.length === 1
      ? "📍 Wilaya : " + wilayas[0]
      : "📍 Wilayas : " + wilayas.join(", ");

  // Pas d’alerte
  if (!data.active || level === "none") {
    badge.textContent = "✅ Aucune alerte";
    title.textContent = "Aucune alerte";
    message.textContent = "";
    if (region) region.textContent = "";
  } else {
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
    if (region) region.textContent = wilayasTxt;
  }

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
