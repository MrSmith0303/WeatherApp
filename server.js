const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

const WEATHER_API_KEY = 'cce392e54e0e4187ab793553252907';
const openWeatherMapKey = '87da1965868b55612a63a224e5d524b3';

app.get('/api/location', async (req, res) => {
  const { lat, lng, city } = req.query;
  
  let query;
  if (lat && lng) {
    query = `${lat},${lng}`;
  } else if (city) {
    query = city;
  } else {
    // IP alapú helymeghatározás - ha nincs megadva semmi
    query = 'auto:ip';
  }

  const url = `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${query}&lang=hu`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    res.json({
      city: data.location.name,
      country: data.location.country,
      region: data.location.region,
      localtime: data.location.localtime,
      weather: data.current,
    });
  } catch (err) {
    res.status(500).json({ error: 'Szerver hiba!' });
  }
});

// Új: OpenWeatherMap tile proxy endpoint
app.get('/api/tiles/:layer/:z/:x/:y.png', async (req, res) => {
  const { layer, z, x, y } = req.params;

  const url = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${openWeatherMapKey}`;

  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    res.set('Content-Type', 'image/png');
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).send('Hiba a tile betöltésénél');
  }
});

// Előrejelzés API végpont (OpenWeather - több napos)
app.get('/api/forecast', async (req, res) => {
  const { city, days } = req.query;
  
  if (!city) {
    return res.status(400).json({ error: 'Város megadása kötelező!' });
  }

  // 1) Geokódolás város → (lat, lon)
  const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${openWeatherMapKey}`;

  try {
    const geoResponse = await fetch(geoUrl);
    if (!geoResponse.ok) {
      return res.status(geoResponse.status).json({ error: 'Nem sikerült geokódolni a várost az OpenWeather-nél.' });
    }
    const geoData = await geoResponse.json();

    if (!Array.isArray(geoData) || geoData.length === 0) {
      return res.status(404).json({ error: 'A megadott város nem található az OpenWeather adatbázisában.' });
    }

    const { lat, lon } = geoData[0];

    // Próbáljuk a One Call API-t – ha nem elérhető a kulcsodnál, visszaesünk a 5 napos / 3 órás előrejelzésre
    const oneCallUrl = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts,current&units=metric&lang=hu&appid=${openWeatherMapKey}`;
    const oneCallResponse = await fetch(oneCallUrl);
    let dailyForecast;

    if (oneCallResponse.ok) {
      const oneCallData = await oneCallResponse.json();
      if (oneCallData && Array.isArray(oneCallData.daily) && oneCallData.daily.length > 0) {
        const requestedDays = Math.min(parseInt(days || '7', 10), Math.max(oneCallData.daily.length - 1, 0));
        const tzOffsetSec = typeof oneCallData.timezone_offset === 'number' ? oneCallData.timezone_offset : 0;
        dailyForecast = oneCallData.daily
          .slice(1, 1 + requestedDays)
          .map(d => {
            const localDate = new Date((d.dt + tzOffsetSec) * 1000);
            const weekday = localDate.toLocaleDateString('hu-HU', { weekday: 'short' });
            const weather = Array.isArray(d.weather) && d.weather.length > 0 ? d.weather[0] : null;
            const iconCode = weather ? weather.icon : '01d';
            const dateKey = `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}-${String(localDate.getUTCDate()).padStart(2, '0')}`;
            return {
              date: dateKey,
              day: weekday,
              maxTemp: Math.round(d.temp.max),
              minTemp: Math.round(d.temp.min),
              condition: weather ? weather.description : 'N/A',
              icon: `https://openweathermap.org/img/wn/${iconCode}@2x.png`,
              description: weather ? weather.description : 'N/A',
              uvIndex: typeof d.uvi === 'number' ? Math.round(d.uvi) : null,
              windSpeed: typeof d.wind_speed === 'number' ? Math.round(d.wind_speed) : null,
              windDeg: typeof d.wind_deg === 'number' ? d.wind_deg : null
            };
          });
      }
    }

    // Ha a One Call nem használható, használjuk a 5 napos / 3 órás előrejelzést és napi összesítést készítünk
    if (!dailyForecast) {
      const forecast5Url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=hu&appid=${openWeatherMapKey}`;
      const forecast5Response = await fetch(forecast5Url);
      if (!forecast5Response.ok) {
        return res.status(forecast5Response.status).json({ error: 'Nem sikerült lekérni az 5 napos előrejelzést az OpenWeather-től.' });
      }
      const forecast5Data = await forecast5Response.json();
      const timezoneOffsetSec = forecast5Data?.city?.timezone || 0;

      // Csoportosítás helyi napokra (város időzónája szerint)
      const byDate = {};
      for (const item of forecast5Data.list || []) {
        const localDate = new Date((item.dt + timezoneOffsetSec) * 1000);
        const yyyy = localDate.getUTCFullYear();
        const mm = String(localDate.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(localDate.getUTCDate()).padStart(2, '0');
        const dateKey = `${yyyy}-${mm}-${dd}`;
        if (!byDate[dateKey]) byDate[dateKey] = [];
        byDate[dateKey].push(item);
      }

      // Mai nap kulcsának meghatározása a város időzónájában
      const nowLocal = new Date((Math.floor(Date.now() / 1000) + timezoneOffsetSec) * 1000);
      const todayKey = `${nowLocal.getUTCFullYear()}-${String(nowLocal.getUTCMonth() + 1).padStart(2, '0')}-${String(nowLocal.getUTCDate()).padStart(2, '0')}`;

      const sortedKeys = Object.keys(byDate).sort();
      const futureKeys = sortedKeys.filter(k => k > todayKey);
      const requestedDays = Math.min(parseInt(days || '5', 10), futureKeys.length);
      const takeKeys = futureKeys.slice(0, requestedDays);

      dailyForecast = takeKeys.map(k => {
        const entries = byDate[k];
        let minTemp = Infinity;
        let maxTemp = -Infinity;
        let chosen = entries[0];

        for (const e of entries) {
          minTemp = Math.min(minTemp, e.main?.temp_min ?? e.main?.temp ?? minTemp);
          maxTemp = Math.max(maxTemp, e.main?.temp_max ?? e.main?.temp ?? maxTemp);
          if (String(e.dt_txt).includes('12:00:00')) {
            chosen = e;
          }
        }

        const dateObj = new Date(k);
        const weekday = dateObj.toLocaleDateString('hu-HU', { weekday: 'short' });
        const weather0 = Array.isArray(chosen.weather) && chosen.weather.length > 0 ? chosen.weather[0] : null;
        const iconCode = weather0 ? weather0.icon : '01d';

        return {
          date: k,
          day: weekday,
          maxTemp: Math.round(maxTemp),
          minTemp: Math.round(minTemp),
          condition: weather0 ? weather0.description : 'N/A',
          icon: `https://openweathermap.org/img/wn/${iconCode}@2x.png`,
          description: weather0 ? weather0.description : 'N/A',
          uvIndex: null,
          windSpeed: typeof chosen.wind?.speed === 'number' ? Math.round(chosen.wind.speed) : null,
          windDeg: typeof chosen.wind?.deg === 'number' ? chosen.wind.deg : null
        };
      });
    }

    // UV index kiegészítése Open-Meteo API-val, ha hiányzik
    try {
      const uvUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=uv_index_max&timezone=auto`;
      const uvResp = await fetch(uvUrl);
      if (uvResp.ok) {
        const uvData = await uvResp.json();
        const timeArr = uvData?.daily?.time || [];
        const uvArr = uvData?.daily?.uv_index_max || [];
        const uvByDate = {};
        for (let i = 0; i < timeArr.length; i++) {
          uvByDate[timeArr[i]] = uvArr[i];
        }
        dailyForecast = dailyForecast.map(d => ({
          ...d,
          uvIndex: typeof d.uvIndex === 'number' && d.uvIndex !== null ? d.uvIndex : (typeof uvByDate[d.date] === 'number' ? Math.round(uvByDate[d.date]) : d.uvIndex)
        }));
      }
    } catch (e) {
      // ignore
    }

    // Pollen logika eltávolítva kérésre

    res.json({ daily: dailyForecast });
  } catch (err) {
    console.error('Előrejelzés hiba (OpenWeather):', err);
    res.status(500).json({ error: 'Szerver hiba az előrejelzés lekérésekor (OpenWeather)!' });
  }
});

// Óránkénti előrejelzés (OpenWeather)
app.get('/api/hourly', async (req, res) => {
  const { city, hours } = req.query;
  if (!city) {
    return res.status(400).json({ error: 'Város megadása kötelező!' });
  }

  const requestedHours = Math.max(1, Math.min(parseInt(hours || '24', 10), 48));

  // Geokódolás
  const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${openWeatherMapKey}`;
  try {
    const geoResponse = await fetch(geoUrl);
    if (!geoResponse.ok) {
      return res.status(geoResponse.status).json({ error: 'Nem sikerült geokódolni a várost az OpenWeather-nél.' });
    }
    const geoData = await geoResponse.json();
    if (!Array.isArray(geoData) || geoData.length === 0) {
      return res.status(404).json({ error: 'A megadott város nem található az OpenWeather adatbázisában.' });
    }
    const { lat, lon } = geoData[0];

    // Első próbálkozás: One Call hourly
    const oneCallUrl = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,daily,alerts,current&units=metric&lang=hu&appid=${openWeatherMapKey}`;
    const oneCallResp = await fetch(oneCallUrl);
    let hourly = [];
    if (oneCallResp.ok) {
      const one = await oneCallResp.json();
      const tzOffsetSec = typeof one.timezone_offset === 'number' ? one.timezone_offset : 0;
      if (Array.isArray(one.hourly) && one.hourly.length) {
        hourly = one.hourly.slice(0, requestedHours).map(h => {
          const local = new Date((h.dt + tzOffsetSec) * 1000);
          const yyyy = local.getUTCFullYear();
          const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
          const dd = String(local.getUTCDate()).padStart(2, '0');
          const HH = String(local.getUTCHours()).padStart(2, '0');
          const MM = String(local.getUTCMinutes()).padStart(2, '0');
          const weather0 = Array.isArray(h.weather) && h.weather.length > 0 ? h.weather[0] : null;
          const iconCode = weather0 ? weather0.icon : '01d';
          return {
            date: `${yyyy}-${mm}-${dd}`,
            time: `${HH}:${MM}`,
            hour: `${HH}:00`,
            temp: Math.round(h.temp),
            condition: weather0 ? weather0.description : 'N/A',
            icon: `https://openweathermap.org/img/wn/${iconCode}@2x.png`,
            windSpeed: typeof h.wind_speed === 'number' ? Math.round(h.wind_speed) : null,
            windDeg: typeof h.wind_deg === 'number' ? h.wind_deg : null,
            uvIndex: typeof h.uvi === 'number' ? Math.round(h.uvi) : null
          };
        });
      }
    }

    // Fallback: 5 napos / 3 órás
    if (!hourly.length) {
      const forecast5Url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=hu&appid=${openWeatherMapKey}`;
      const fResp = await fetch(forecast5Url);
      if (!fResp.ok) {
        return res.status(fResp.status).json({ error: 'Nem sikerült lekérni az óránkénti előrejelzést.' });
      }
      const f = await fResp.json();
      const tzOffsetSec = f?.city?.timezone || 0;
      const needItems = Math.ceil(requestedHours / 3);
      hourly = (f.list || []).slice(0, needItems).flatMap(item => {
        const local = new Date((item.dt + tzOffsetSec) * 1000);
        const yyyy = local.getUTCFullYear();
        const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(local.getUTCDate()).padStart(2, '0');
        const HH = String(local.getUTCHours()).padStart(2, '0');
        const weather0 = Array.isArray(item.weather) && item.weather.length > 0 ? item.weather[0] : null;
        const iconCode = weather0 ? weather0.icon : '01d';
        return [{
          date: `${yyyy}-${mm}-${dd}`,
          time: `${HH}:00`,
          hour: `${HH}:00`,
          temp: Math.round(item.main?.temp ?? 0),
          condition: weather0 ? weather0.description : 'N/A',
          icon: `https://openweathermap.org/img/wn/${iconCode}@2x.png`,
          windSpeed: typeof item.wind?.speed === 'number' ? Math.round(item.wind.speed) : null,
          windDeg: typeof item.wind?.deg === 'number' ? item.wind.deg : null,
          uvIndex: null
        }];
      }).slice(0, requestedHours);
    }

    // UV fallback Open-Meteo óránkénti – timezone=auto, kulcs: YYYY-MM-DD HH:MM
    try {
      const uniqDates = Array.from(new Set(hourly.map(h => h.date))).sort();
      if (uniqDates.length) {
        const uvUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=uv_index&timezone=auto`;
        const uvResp = await fetch(uvUrl);
        if (uvResp.ok) {
          const uv = await uvResp.json();
          const times = uv?.hourly?.time || [];
          const vals = uv?.hourly?.uv_index || [];
          const map = {};
          for (let i = 0; i < times.length; i++) {
            map[times[i]] = vals[i];
          }
          hourly = hourly.map(h => {
            // összeállítjuk az Open-Meteo formátumú kulcsot: 'YYYY-MM-DDTHH:00'
            const key = `${h.date}T${h.hour}`;
            const v = map[key];
            return {
              ...h,
              uvIndex: (h.uvIndex === null || h.uvIndex === undefined) && typeof v === 'number' ? Math.round(v) : h.uvIndex
            };
          });
        }
      }
    } catch (e) {
      // ignore
    }

    res.json({ hourly });
  } catch (e) {
    console.error('Hourly hiba (OpenWeather):', e);
    res.status(500).json({ error: 'Szerver hiba az óránkénti előrejelzés lekérésekor!' });
  }
});

app.listen(5000, () => console.log('Server running on port 5000'));