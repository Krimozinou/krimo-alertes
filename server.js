const express = require("express");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cookieParser());

// ✅ Servir les fichiers statiques (index.html, admin.html, app.js, admin.js, css, images...)
app.use(express.static(__dirname));

const DATA_PATH = path.join(__dirname, "alert.json");

// ========= Helpers =========
function defaultAlert() {
  return {
    active: false,
    level: "none",
    region: "Aucune",
    title: "Aucune alerte",
    message: "",
    startAt: "",
    endAt: "",
    updatedAt: "",
  };
}

function isNowBetween(startAt, endAt) {
  const now = Date.now();
  const start = startAt ? new Date(startAt).getTime() : null;
  const end = endAt ? new Date(endAt).getTime() : null;

  // si start existe et maintenant < start => pas actif
  if (start && now < start) return false;
  // si end existe et maintenant > end => pas actif
  if (end && now > end) return false;

  return true;
}

function readAlert() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const data = JSON.parse(raw);

    // ✅ auto ON/OFF selon tranche horaire
    if (data.startAt || data.endAt) {
      const ok = isNowBetween(data.startAt, data.endAt);
      data.active = ok && data.level !== "none";

      // si hors plage => on force none (mais on garde title/message stockés si tu veux)
      if (!data.active) {
        data.level = "none";
      }
    } else {
      // si pas de tranche => actif seulement si level != none
      data.active = data.level !== "none";
    }

    return { ...defaultAlert(), ...data };
  } catch (e) {
    return defaultAlert();
  }
}

function writeAlert(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.krimo_token;
  if (!token) return res.status(401).json({ ok: false, error: "Non autorisé" });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Session expirée" });
  }
}

// ========= Pages =========
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// ========= API =========

// Public: lire l’alerte (page publique)
app.get("/api/alert", (req, res) => {
  res.json(readAlert());
});

// Login admin
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    const token = jwt.sign({ u: username }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("krimo_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // Render met https => tu peux mettre true plus tard si tu veux
    });

    return res.json({ ok: true });
  }

  return res.status(401).json({ ok: false, error: "Identifiants incorrects" });
});

// Logout admin
app.post("/api/logout", (req, res) => {
  res.clearCookie("krimo_token");
  res.json({ ok: true });
});

// Admin: publier/modifier l’alerte
app.post("/api/alert", authMiddleware, (req, res) => {
  try {
    const payload = req.body || {};

    const data = {
      ...defaultAlert(),
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    // sécurité: si level none => active false
    if (data.level === "none") data.active = false;

    writeAlert(data);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

// Admin: désactiver rapidement
app.post("/api/disable", authMiddleware, (req, res) => {
  const data = defaultAlert();
  data.updatedAt = new Date().toISOString();
  writeAlert(data);
  res.json({ ok: true });
});

// ========= Start =========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Krimo Alertes lancé sur le port", PORT);
});
