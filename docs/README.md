# FootballRivals (footballrivals.be)
## Volledige Installatiegids voor Combell Node.js Expert Hosting

---

## ⚡ Wat is nieuw (juni 2026)

**Gameplay**
- **Seizoenssimulatie**: na de draft speelt je elftal een volledig Premier League-seizoen van 38 wedstrijden. Het resultaat (bijv. 30-5-3 = Champion, 38-0-0 = Perfect Season) bepaalt de winnaar. De resultpagina speelt het seizoen speeldag voor speeldag af.
- **Strikt positie-draften**: spelers passen alleen op posities in hun eigen zone (GK/DEF/MID/ATT). Je team vult zich live op een voetbalveld.
- **Dubbele spin**: elke speler krijgt per ronde zijn éígen willekeurige club (altijd verschillend van de tegenstander, nooit twee keer dezelfde club, en altijd met een speler die op jouw open posities past). Je ziet ook uit welke club je tegenstander draft.
- **Picktimer**: 60 seconden per ronde, daarna kiest het systeem automatisch.
- **Expert-modus** werkt nu echt: ratings en stats worden server-side verborgen tijdens het draften.
- **Quick match** (willekeurige tegenstander) en **rematch**-knop.
- **Gelijkspel** is nu mogelijk (zelfde punten, doelsaldo en goals) en telt mee in de stats.
- **8 nieuwe achievements** (o.a. GOAT, Invincible, Reuzendoder) en profielstats (titels, beste seizoen).

**Data**: de seed bevat 22 iconische Premier League-seizoenen (Invincibles 2003-04, Treble 1998-99, Leicester 2015-16, Centurions 2017-18, Liverpool 2019-20, het treble-seizoen van Haaland 2022-23, Klinsmanns Spurs 1994-95, Leeds 2000-01, ...) met 360+ spelers. De seed is **additief**: hij wist nooit bestaande data en vult alleen aan — veilig bij elke deploy. Volledig opnieuw opbouwen kan lokaal met `FORCE_SEED=1 node seed.js`.

**Techniek**: schema gewijzigd (slot op picks, seizoens-JSON op resultaten) → draai opnieuw `npx prisma db push` én `npm run seed` na het updaten. `JWT_SECRET` is nu **verplicht** in productie.

---

## Inhoud
1. [Projectstructuur](#1-projectstructuur)
2. [Lokale voorbereiding](#2-lokale-voorbereiding)
3. [Combell database instellen](#3-combell-database-instellen)
4. [.env bestand aanmaken](#4-env-bestand-aanmaken)
5. [Frontend bouwen](#5-frontend-bouwen)
6. [Bestanden uploaden naar Combell](#6-bestanden-uploaden-naar-combell)
7. [npm install op Combell](#7-npm-install-op-combell)
8. [Database migreren](#8-database-migreren)
9. [Seed uitvoeren](#9-seed-uitvoeren)
10. [Node.js start instellen](#10-nodejs-start-instellen)
11. [Testaccounts](#11-testaccounts)
12. [Veelgestelde problemen](#12-veelgestelde-problemen)

---

## 1. Projectstructuur

```
FootballRivals/
├── client/          ← React frontend (Vite)
├── server/          ← Node.js + Express backend
│   └── public/      ← Gebouwde React app (na build)
├── prisma/          ← Database schema + seed
├── .env.example     ← Voorbeeld .env bestand
└── docs/README.md   ← Dit bestand
```

---

## 2. Lokale voorbereiding

Je hebt nodig op je PC:
- **Node.js 18+** — download op nodejs.org
- **npm** (meegeleverd met Node.js)
- **FTP client** zoals FileZilla (voor upload naar Combell)

### Stap 1: Dependencies installeren

Open een terminal (cmd/PowerShell) in de projectmap:

```bash
# Server dependencies
cd server
npm install

# Prisma/seed dependencies
cd ../prisma
npm install

# Client dependencies
cd ../client
npm install
```

---

## 3. Combell database instellen

1. Log in op **my.combell.com**
2. Ga naar **Hosting → Databases → MySQL**
3. Maak een nieuwe MySQL 8 database aan
4. Noteer:
   - **Host** (bv. `mysql.combell.com` of een intern IP)
   - **Databasenaam** (bv. `jouwaccount_footballrivals`)
   - **Gebruikersnaam** (bv. `jouwaccount_fd`)
   - **Wachtwoord** (zelf kiezen)

> 💡 **Tip**: Bij Combell is de MySQL host soms `localhost` als je op het zelfde server account zit. Vraag bij twijfel aan Combell support.

---

## 4. .env bestand aanmaken

Kopieer `.env.example` naar `server/.env`:

```bash
# Windows (cmd)
copy .env.example server\.env

# Mac/Linux
cp .env.example server/.env
```

Open `server/.env` in een teksteditor en vul in:

```env
DATABASE_URL="mysql://DB_GEBRUIKER:DB_WACHTWOORD@DB_HOST:3306/DB_NAAM"
JWT_SECRET=maak_hier_een_lange_willekeurige_string_van_minimaal_32_tekens
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
CLIENT_URL=https://jouwdomein.be
```

### JWT_SECRET genereren (Windows PowerShell):
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 40 | % {[char]$_})
```

### JWT_SECRET genereren (Mac/Linux terminal):
```bash
openssl rand -base64 32
```

---

## 5. Frontend bouwen

Vanuit de `client/` map:

```bash
cd client
npm run build
```

Dit maakt automatisch de map `server/public/` aan met de gebouwde React app.

✅ Na de build zie je `server/public/index.html` en `server/public/assets/`

---

## 6. Bestanden uploaden naar Combell

### Via FTP (FileZilla)

**FTP gegevens** vind je in je Combell control panel:
- Host: `ftp.jouwdomein.be`
- Gebruiker: jouw Combell FTP gebruiker
- Wachtwoord: jouw FTP wachtwoord
- Poort: 21

### Mapstructuur op Combell

Upload de volgende mappen/bestanden naar de Node.js root (bv. `/httpdocs/` of `/nodejs/`):

```
/nodejs/
├── server/
│   ├── src/
│   ├── public/          ← gebouwde React app
│   ├── index.js
│   └── package.json
│   └── .env             ← !!! NIET vergeten !!!
└── prisma/
    ├── schema.prisma
    └── seed.js
```

> ⚠️ **Belangrijk**: Upload het `server/.env` bestand zeker mee! Zonder dit werkt de app niet.

> ⚠️ **Niet uploaden**: `node_modules/` map (die wordt op Combell aangemaakt)

---

## 7. npm install op Combell

Via **SSH** (Combell Expert hosting heeft SSH toegang):

```bash
ssh gebruiker@jouwdomein.be
```

Ga naar de server map en installeer:

```bash
cd /pad/naar/nodejs/server
npm install --omit=dev

# Seed dependencies
cd /pad/naar/nodejs/prisma
npm install --omit=dev
```

Genereer de Prisma client:

```bash
cd /pad/naar/nodejs
npx prisma generate --schema=./prisma/schema.prisma
```

> 💡 **Combell SSH** activeer je in het Combell control panel onder "SSH toegang"

---

## 8. Database migreren

Vanuit de Combell SSH sessie:

```bash
cd /pad/naar/nodejs

# Database schema aanmaken (tabellen aanmaken)
DATABASE_URL="mysql://GEBRUIKER:WACHTWOORD@HOST:3306/DBNAAM" \
  npx prisma db push --schema=./prisma/schema.prisma
```

Of als je `.env` al correct staat:

```bash
cd /pad/naar/nodejs/server
npx prisma db push --schema=../prisma/schema.prisma
```

✅ Je ziet: `Your database is now in sync with your Prisma schema.`

---

## 9. Seed uitvoeren

```bash
cd /pad/naar/nodejs/prisma

# Seed de database met clubs, spelers en testaccounts
node seed.js
```

Dit duurt 1-2 minuten. Je ziet output zoals:
```
🌱 Seeding FootballRivals database...
Creating clubs...
✅ Created 20 clubs
Creating seasons...
✅ Created 12 seasons
Creating club-season combinations and players...
✅ Created 300+ football players
✅ Created achievements
✅ Created users
🎉 Seeding complete!
```

---

## 10. Node.js start instellen

In het **Combell control panel** onder Node.js hosting:

| Instelling | Waarde |
|-----------|--------|
| **Start command** | `node server/index.js` |
| **Working directory** | `/pad/naar/nodejs` |
| **Node.js versie** | 18.x of 20.x |
| **Poort** | 3001 (of wat Combell toewijst) |

> 💡 Combell kan een andere PORT instellen via omgevingsvariabelen. De app leest `process.env.PORT` automatisch.

### Herstart de applicatie
Na het uploaden of wijzigen altijd de Node.js applicatie herstarten via het Combell panel.

---

## 11. Testaccounts

Na de seed zijn deze accounts beschikbaar:

| Email | Wachtwoord | Rol | ELO |
|-------|-----------|-----|-----|
| `admin@footballrivals.be` | `admin1234` | Admin | 1000 |
| `speler1@test.be` | `test1234` | Speler | 1200 |
| `speler2@test.be` | `test1234` | Speler | 1050 |
| `pro@test.be` | `test1234` | Speler | 1450 |
| `fan@test.be` | `test1234` | Speler | 980 |
| `king@test.be` | `test1234` | Speler | 1380 |

---

## 12. Veelgestelde problemen

### ❌ "Can't connect to MySQL"
- Controleer `DATABASE_URL` in `.env`
- Vraag de exacte MySQL host op bij Combell support
- Combell gebruikt soms een intern IP adres

### ❌ "Module not found" bij starten
```bash
cd /pad/naar/nodejs/server
npm install
npx prisma generate --schema=../prisma/schema.prisma
```

### ❌ Socket.IO verbindt niet
- Zorg dat WebSocket support aanstaat in Combell panel
- Controleer `CLIENT_URL` in `.env` (exact domein, geen trailing slash)

### ❌ Pagina laadt maar geeft 404 na refresh
- De Express catch-all route is aanwezig — controleer `NODE_ENV=production` in `.env`

### ❌ Seed mislukt met "duplicate entry"
- De seed draait al een keer. Verwijder de tabellen en opnieuw:
```bash
DATABASE_URL="..." npx prisma db push --force-reset --schema=./prisma/schema.prisma
node ../prisma/seed.js
```

### ❌ Lokaal testen (development)
```bash
# Terminal 1: Start server
cd server
npm run dev

# Terminal 2: Start React dev server
cd client
npm run dev
# Open: http://localhost:5173
```

---

## Snel overzicht alle commando's

```bash
# 1. Dependencies
cd server && npm install
cd ../prisma && npm install
cd ../client && npm install

# 2. Frontend bouwen
cd client && npm run build

# 3. Op Combell (via SSH):
cd /nodejs/server
npm install --omit=dev
cd ..
npx prisma generate --schema=./prisma/schema.prisma
npx prisma db push --schema=./prisma/schema.prisma
cd prisma && node seed.js

# 4. App starten (via Combell panel)
# Start command: node server/index.js
```

---

## Seed data overzicht

- **20 clubs**: Barcelona, Real Madrid, Man United, Arsenal, Chelsea, Liverpool, Bayern, Dortmund, Juventus, AC Milan, Inter, PSG, Ajax, Atlético, Porto, Benfica, Celtic, Club Brugge, Anderlecht, Galatasaray
- **12 seizoenen**: 1998-99 t/m 2009-10
- **300+ voetballers**: historische spelers per club
- **6 formaties**: 4-3-3, 4-4-2, 3-5-2, 5-3-2, 4-2-4
- **6 achievements**: automatisch te ontgrendelen

---

*FootballRivals (footballrivals.be) — Gebouwd met Node.js, Express, Socket.IO, React, Tailwind CSS & Prisma*

