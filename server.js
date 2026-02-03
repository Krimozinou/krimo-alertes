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

function defaultAlert() {
  return {
    active: false,
    level: "none",
    region: "Aucune",
    title: "Aucune alerte",
    message: "",
    updatedAt: ""
  };
}

function readAlert() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const data = JSON.parse(raw);
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

// Pages
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "admin.html")));

// API
app.get("/api/alert", (req, res) => {
  res.json(readAlert());
});

app.post("/api/alert", authMiddleware, (req, res) => {
  const body = req.body || {};

  const level = String(body.level || "none");
  const active = level !== "none";

  const allowedRegions = ["OUEST", "CENTRE-OUEST", "CENTRE", "CENTRE-EST", "EST", "Aucune"];
  const region = allowedRegions.includes(body.region) ? body.region : "Aucune";

  const title = String(body.title || (active ? "ALERTE MÉTÉO" : "Aucune alerte"));
  const message = String(body.message || "");
  const updatedAt = String(body.updatedAt || new Date().toISOString());

  const data = { active, level, region, title, message, updatedAt };
  writeAlert(data);

  res.json({ ok: true, data });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username !== process.env.ADMIN_USER || password !== process.env.ADMIN_PASS) {
    return res.status(401).json({ ok: false, error: "Identifiants invalides" });
  }

  const token = jwt.sign({ u: username }, process.env.JWT_SECRET, { expiresIn: "7d" });

  res.cookie("krimo_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true
  });

  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("krimo_token");
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Krimo Alertes lancé sur le port", PORT));
