const express = require("express");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cookieParser());

// ✅ Servir les fichiers statiques depuis la racine du repo
app.use(express.static(__dirname));

const DATA_PATH = path.join(__dirname, "alert.json");

function readAlert() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return { active: false, level: "none", title: "Aucune alerte", message: "", updatedAt: "" };
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

// Page d'accueil
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Admin
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// API publique
app.get("/api/alert", (req, res) => {
  res.json(readAlert());
});

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: "Champs manquants" });

  if (username !== process.env.ADMIN_USER || password !== process.env.ADMIN_PASS) {
    return res.status(401).json({ ok: false, error: "Identifiants incorrects" });
  }

  const token = jwt.sign({ u: username }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie("krimo_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false
  });

  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("krimo_token");
  res.json({ ok: true });
});

// Publier alerte (admin)
app.post("/api/admin/alert", authMiddleware, (req, res) => {
  const { active, level, region, title, message } = req.body || {};
  const allowed = ["none", "yellow", "orange", "red"];
  if (!allowed.includes(level)) return res.status(400).json({ ok: false, error: "Niveau invalide" });

  const payload = {
  active: Boolean(active) && level !== "none",
  level,
  region: String(region || "Aucune"),
  title: String(title || (level === "none" ? "Aucune alerte" : "ALERTE MÉTÉO")).slice(0, 80),
  message: String(message || "").slice(0, 400),
  updatedAt: new Date().toISOString()
};

  writeAlert(payload);
  res.json({ ok: true, alert: payload });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Krimo Alertes lancé sur http://localhost:" + PORT));
