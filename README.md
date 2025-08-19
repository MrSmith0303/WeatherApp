# Weather App

Egy modern időjárás alkalmazás, amely valós adatokat jelenít meg az aktuális időjárásról és 4 napos előrejelzésről.

## Funkciók

- **Aktuális időjárás**: Valós időjárás adatok bármely városra
- **2 napos előrejelzés**: Részletes előrejelzés a következő 2 napra (free tier korlátozás)
- **Automatikus helymeghatározás**: IP alapú helymeghatározás
- **Város keresés**: Keresés város neve alapján
- **Időjárás radar**: Interaktív térkép az időjárási viszonyokról
- **Poison green színséma**: Modern, kellemes design

## Telepítés

1. Klónozd le a repository-t:
```bash
git clone <repository-url>
cd weatherapp
```

2. Telepítsd a függőségeket:
```bash
npm install
```

3. Indítsd el a szervert:
```bash
node server.js
```

4. Egy új terminálban indítsd el a React alkalmazást:
```bash
npm start
```

## Használat

1. **Aktuális időjárás**: Az alkalmazás automatikusan betölti az aktuális helyed időjárását
2. **Város keresés**: Írd be a város nevét a keresőmezőbe és nyomd meg az Enter gombot
3. **Előrejelzés**: Miután kiválasztottál egy várost, automatikusan megjelenik a 4 napos előrejelzés
4. **Radar térkép**: Az alsó részen megtalálható az interaktív időjárás radar

## API Végpontok

- `GET /api/location` - Aktuális időjárás lekérése
- `GET /api/forecast` - 4 napos előrejelzés lekérése
- `GET /api/tiles/:layer/:z/:x/:y.png` - Időjárás térkép tile-ok

## Technológiai stack

- **Frontend**: React.js, Bootstrap CSS
- **Backend**: Node.js, Express.js
- **API**: WeatherAPI.com, OpenWeatherMap
- **Térkép**: OpenWeatherMap tiles

## Színséma

Az alkalmazás a "méregzöld" (poison green) színsémát használja:
- Fő szín: `#4ade80`
- Kártya háttér: `#22c55e`
- Gradiens átmenetek a háttérben

## Fejlesztői megjegyzések

- Az alkalmazás automatikusan lekéri az előrejelzést, amikor egy város időjárását lekérdezed
- A statikus előrejelzés kártyák helyett most valós adatok jelennek meg
- A szerver automatikusan kezeli a hibákat és a betöltési állapotokat
- Reszponzív design mobil és asztali eszközökre
