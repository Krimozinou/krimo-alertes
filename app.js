async function refresh() {
  const res = await fetch("/api/alert", { cache: "no-store" });
  const data = await res.json();

  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const region = document.getElementById("region");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  const level = data.level || "none";
  badge.className = "badge " + level + (data.active ? " blink" : "");

  // Texte du badge
  if (!data.active) {
    badge.textContent = "✅ Aucune alerte";
  } else {
    badge.textContent =
      level === "yellow" ? "🟡 Vigilance Jaune" :
      level === "orange" ? "🟠 Vigilance Orange" :
      level === "red" ? "🔴 Vigilance Rouge" :
      "⚠️ Alerte";
  }

  title.textContent = data.title || (data.active ? "ALERTE MÉTÉO" : "Aucune alerte");
  message.textContent = data.message || "";

  // ✅ Afficher la région
  if (data.active && data.region && data.region !== "Aucune") {
    region.textContent = "📍 Région : " + data.region;
  } else {
    region.textContent = "";
  }

  updatedAt.textContent = data.updatedAt
    ? new Date(data.updatedAt).toLocaleString("fr-FR")
    : "—";
}

refresh();
setInterval(refresh, 30000);
