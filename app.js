async function refresh() {
  const res = await fetch("/api/alert", { cache: "no-store" });
  const data = await res.json();

  const badge = document.getElementById("badge");
  const title = document.getElementById("title");
  const message = document.getElementById("message");
  const updatedAt = document.getElementById("updatedAt");

  const level = data.level || "none";
  badge.className = "badge " + level + (data.active ? " blink" : "");
  badge.textContent =
    data.active
      ? (level === "yellow" ? "🟡 Vigilance Jaune" : level === "orange" ? "🟠 Vigilance Orange" : "🔴 Vigilance Rouge")
      : "✅ Aucune alerte";

  title.textContent = data.title || (data.active ? "ALERTE MÉTÉO" : "Aucune alerte");
  message.textContent = data.message || "";

  updatedAt.textContent = data.updatedAt ? new Date(data.updatedAt).toLocaleString("fr-FR") : "—";
}

refresh();
setInterval(refresh, 30000);
