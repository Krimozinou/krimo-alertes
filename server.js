const express = require("express");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cookieParser());

// ✅ Render HTTPS Proxy
app.set("trust proxy", 1);

// ✅ Static files
app.use(express.static(__dirname));

const DATA_PATH = path.join(__dirname, "alert.json");

// ======================================
// ✅ ALERT PAR DÉFAUT
// ======================================
function defaultAlert() {
  return {
    active: false,
    level: "none",

    // ✅ Nouveau multi wilayas
    regions: [],

    // ✅ Compat ancien champ
    region: "",

    title: "Aucune alerte",
    message: "",

    startAt: "",
    endAt: "",

    updatedAt: new Date().toISOString(),
  };
}

// ======================================
// ✅ Vérifier si maintenant est dans la plage
// ======================================
function isNowBetween(startAt, endAt) {
  const now = Date.now();
  const start = startAt ? new Date(startAt).getTime() : null;
  const end = endAt ? new Date(endAt).getTime() : null;

  if (start && now < start) return false;
  if (end && now > end) return false;

  return true;
}

// ======================================
// ✅ Normaliser (compatibilité)
// ======================================
function normalizeAlert(data) {
  const merged = { ...defaultAlert(), ...data };

  // ✅ si "region" string → convertir en array
  if (
    merged.region &&
    (!Array.isArray(merged.regions) || merged.regions.length === 0)
  ) {
    merged.regions = [merged.region];
  }

  // ✅ remplir region avec première wilaya
  if (
    Array.isArray(merged.regions) &&
    merged.regions.length > 0 &&
    !merged.region
  ) {
    merged.region = merged.regions[0];
  }

  if (!Array.isArray(merged.regions)) merged.regions = [];

  return merged;
}

// ======================================
// ✅ Activer/désactiver automatique horaire
// ======================================
function computeActive(data) {
  if (data.startAt || data.endAt) {
    const ok = isNowBetween(data.startAt, data.endAt);
    data.active = ok && data.level !== "none";

    if (!data.active) {
      data.level = "none";
    }
  } else {
    data.active = data.level !== "none";
  }

  return data;
}

// ======================================
// ✅ Lire alert.json
// ======================================
function readAlert() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const data = JSON.parse(raw);

    return computeActive(normalizeAlert(data));
  } catch {
    return defaultAlert();
  }
}

// ======================================
// ✅ Écrire alert.json
// ======================================
function writeAlert(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// ======================================
// ✅ Auth Middleware Admin
// ======================================
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

// ======================================
// ✅ Pages
// ======================================
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

app.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "admin.html"))
);

// ======================================
// ✅ API PUBLIC
// ======================================
app.get("/api/alert", (req, res) => {
  res.json(readAlert());
});

// ======================================
// ✅ LOGIN ADMIN
// ======================================
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
      secure: true,
    });

    return res.json({ ok: true });
  }

  return res.status(401).json({ ok: false, error: "Identifiants incorrects" });
});

// ======================================
// ✅ LOGOUT
// ======================================
app.post("/api/logout", (req, res) => {
  res.clearCookie("krimo_token");
  res.json({ ok: true });
});

// ======================================
// ✅ PUBLIER UNE ALERTE
// ======================================
app.post("/api/alert", authMiddleware, (req, res) => {
  try {
    const payload = normalizeAlert(req.body || {});

    const data = {
      ...defaultAlert(),
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    // ✅ Si aucune alerte → reset complet MAIS updatedAt reste rempli
    if (data.level === "none") {
      data.active = false;
      data.title = "Aucune alerte";
      data.message = "";
      data.regions = [];
      data.region = "";
      data.startAt = "";
      data.endAt = "";
      data.updatedAt = new Date().toISOString();
    }

    writeAlert(data);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

// ======================================
// ✅ DÉSACTIVER RAPIDEMENT
// ======================================
app.post("/api/disable", authMiddleware, (req, res) => {
  const data = defaultAlert();
  data.updatedAt = new Date().toISOString();
  writeAlert(data);
  res.json({ ok: true });
});

// ======================================
// ✅ START SERVER
// ======================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Krimo Alertes lancé sur le port", PORT);
});
