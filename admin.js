const loginBox = document.getElementById("loginBox");
const panel = document.getElementById("panel");
const loginMsg = document.getElementById("loginMsg");
const saveMsg = document.getElementById("saveMsg");
const logoutBtn = document.getElementById("logoutBtn");

function toLocalDatetimeValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  // datetime-local attend "YYYY-MM-DDTHH:mm"
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

function fromLocalDatetimeValue(value) {
  if (!value) return "";
  // On convertit en ISO pour le serveur
  return new Date(value).toISOString();
}

async function loadCurrent() {
  const r = await fetch("/api/alert", { cache: "no-store" });
  const data = await r.json();

  document.getElementById("level").value = data.level || "none";
  document.getElementById("region").value = data.region || "Adrar";
  document.getElementById("title").value = data.title || "";
  document.getElementById("message").value = data.message || "";
  document.getElementById("startAt").value = toLocalDatetimeValue(data.startAt);
  document.getElementById("endAt").value = toLocalDatetimeValue(data.endAt);
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  loginMsg.textContent = "";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const out = await res.json().catch(() => ({}));

    if (!res.ok || !out.ok) {
      loginMsg.textContent = out.error || "Erreur de connexion";
      return;
    }

    loginBox.style.display = "none";
    panel.style.display = "block";
    logoutBtn.style.display = "inline-block";

    await loadCurrent();
  } catch (e) {
    loginMsg.textContent = "Erreur réseau";
  }
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
  location.reload();
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  saveMsg.textContent = "Enregistrement...";
  saveMsg.style.color = "#111";

  const level = document.getElementById("level").value;
  const region = document.getElementById("region").value;
  const titleInput = document.getElementById("title").value.trim();
  const message = document.getElementById("message").value.trim();
  const startAt = fromLocalDatetimeValue(document.getElementById("startAt").value);
  const endAt = fromLocalDatetimeValue(document.getElementById("endAt").value);

  const payload = {
    level,
    active: level !== "none",
    region,
    title: titleInput || (level === "none" ? "Aucune alerte" : "ALERTE MÉTÉO"),
    message,
    startAt,
    endAt,
  };

  try {
    const res = await fetch("/api/alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const out = await res.json().catch(() => ({}));

    if (!res.ok || !out.ok) {
      saveMsg.textContent = out.error || "Erreur";
      saveMsg.style.color = "#b00020";
      return;
    }

    saveMsg.textContent = "✅ Publiée";
    saveMsg.style.color = "#0a7a2f";
  } catch (e) {
    saveMsg.textContent = "Erreur réseau";
    saveMsg.style.color = "#b00020";
  }
});

document.getElementById("disableBtn").addEventListener("click", async () => {
  saveMsg.textContent = "Désactivation...";
  saveMsg.style.color = "#111";

  const payload = {
    active: false,
    level: "none",
    region: document.getElementById("region").value || "Adrar",
    title: "Aucune alerte",
    message: "",
    startAt: "",
    endAt: "",
  };

  try {
    const res = await fetch("/api/alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const out = await res.json().catch(() => ({}));

    if (!res.ok || !out.ok) {
      saveMsg.textContent = out.error || "Erreur";
      saveMsg.style.color = "#b00020";
      return;
    }

    saveMsg.textContent = "✅ Désactivée";
    saveMsg.style.color = "#0a7a2f";

    await loadCurrent();
  } catch (e) {
    saveMsg.textContent = "Erreur réseau";
    saveMsg.style.color = "#b00020";
  }
});
