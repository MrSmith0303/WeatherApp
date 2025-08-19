import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import React, { useState, useEffect } from 'react';
import RadarMap from './RadarMap';

function App() {

  const [weatherData, setWeatherData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [hourlyData, setHourlyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [hourlyLoading, setHourlyLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [searchCity, setSearchCity] = useState('');

  // IP alapú helymeghatározás - automatikus betöltés
  useEffect(() => {
    console.log('IP alapú helymeghatározás indítása...');
    setLoading(true);
    setError(null);

    fetch('http://localhost:5000/api/location')
      .then(res => res.json())
      .then(data => {
        console.log('IP alapú válasz:', data);
        if (data.error) {
          setError(`Szerver hiba: ${data.error}`);
        } else {
          setWeatherData(data);
          if (data.city) {
            fetchForecastData(data.city);
            fetchHourlyData(data.city);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch hiba:', err);
        setError(`Hálózati hiba: ${err.message}`);
        setLoading(false);
      });
  }, []);

  // Időjárás adatok lekérése a felhasználó helyéről
  useEffect(() => {
    if (userLocation) {
      setLoading(true);
      fetch(`http://localhost:5000/api/location?lat=${userLocation.lat}&lng=${userLocation.lng}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setError(`Szerver hiba: ${data.error}`);
          } else {
            setWeatherData(data);
            if (data.city) {
              fetchForecastData(data.city);
              fetchHourlyData(data.city);
            }
          }
          setLoading(false);
        })
        .catch(err => {
          setError(`Hálózati hiba: ${err.message}`);
          setLoading(false);
        });
    }
  }, [userLocation]);

  const fetchDataByLocation = (lat, lng, city = null) => {
    setLoading(true);
    setError(null);
    let url;

    if (city) {
      url = `http://localhost:5000/api/location?city=${encodeURIComponent(city)}`;
    } else if (lat && lng) {
      url = `http://localhost:5000/api/location?lat=${lat}&lng=${lng}`;
    } else {
      url = `http://localhost:5000/api/location`; // IP alapú helymeghatározás
    }

    // Lekérjük az aktuális időjárást
    fetch(url)
      .then(res => {
        if (!res.ok) {
          throw new Error('Szerver hiba az aktuális időjárás lekérésekor.');
        }
        return res.json();
      })
      .then(data => {
        setWeatherData(data);
        if (data.city) {
          fetchForecastData(data.city);
          fetchHourlyData(data.city);
        } else {
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Fetch hiba:', err);
        setError(`Hálózati hiba: ${err.message}`);
        setLoading(false);
      });
  };

  // A 4 napos előrejelzés lekérése
  const fetchForecastData = (city) => {
    console.log('Előrejelzés lekérése városra:', city);
    setForecastLoading(true);
    const url = `http://localhost:5000/api/forecast?city=${encodeURIComponent(city)}`;

    fetch(url)
      .then(res => {
        if (!res.ok) {
          throw new Error('Szerver hiba az előrejelzés lekérésekor.');
        }
        return res.json();
      })
      .then(data => {
        console.log('Előrejelzés adatok:', data);
        setForecastData(data.daily);
        setForecastLoading(false);
      })
      .catch(err => {
        console.error('Fetch hiba az előrejelzésnél:', err);
        setError(`Hálózati hiba az előrejelzésnél: ${err.message}`);
        setForecastLoading(false);
      });
  };

  // Óránkénti előrejelzés lekérése (következő 24 óra)
  const fetchHourlyData = (city) => {
    if (!city) return;
    setHourlyLoading(true);
    const url = `http://localhost:5000/api/hourly?city=${encodeURIComponent(city)}&hours=24`;
    fetch(url)
      .then(res => {
        if (!res.ok) {
          throw new Error('Szerver hiba az óránkénti előrejelzés lekérésekor.');
        }
        return res.json();
      })
      .then(data => {
        setHourlyData(data.hourly || []);
        setHourlyLoading(false);
      })
      .catch(err => {
        console.error('Fetch hiba az óránkénti előrejelzésnél:', err);
        setError(`Hálózati hiba az óránkénti előrejelzésnél: ${err.message}`);
        setHourlyLoading(false);
      });
  };

  // Manuális város keresés
  const handleSearch = () => {
    if (searchCity.trim()) {
      // Ékezetek eltávolítása
      const cleanCityName = searchCity.trim()
        .replace(/á/g, 'a')
        .replace(/é/g, 'e')
        .replace(/í/g, 'i')
        .replace(/ó/g, 'o')
        .replace(/ö/g, 'o')
        .replace(/ő/g, 'o')
        .replace(/ú/g, 'u')
        .replace(/ü/g, 'u')
        .replace(/ű/g, 'u')
        .replace(/Á/g, 'A')
        .replace(/É/g, 'E')
        .replace(/Í/g, 'I')
        .replace(/Ó/g, 'O')
        .replace(/Ö/g, 'O')
        .replace(/Ő/g, 'O')
        .replace(/Ú/g, 'U')
        .replace(/Ü/g, 'U')
        .replace(/Ű/g, 'U');

      console.log('Eredeti város:', searchCity.trim());
      console.log('Tisztított város:', cleanCityName);

      fetchDataByLocation(null, null, cleanCityName);
    }
  };

  // Enter gomb kezelése
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const degToCompass = (deg) => {
    if (deg === null || deg === undefined || isNaN(deg)) return null;
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(((deg % 360) / 45)) % 8;
    return dirs[idx];
  };

  const formatWind = (speed, deg) => {
    if (speed === null || speed === undefined) return '-';
    const dir = degToCompass(deg);
    return `${speed} m/s${dir ? ' ' + dir : ''}`;
  };


  return (

    <div className='container'>
      <nav className="navbar navbar-expand-md navbar-light">
        <div className="container-fluid px-0">
          <a className='navbar-brand d-flex align-items-center gap-2' href='#'>
            <h1>Időjárásapp </h1>
          </a>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarSupportedContent">
            <ul className='navbar-nav ms-auto'>
              <li className='nav-item'>
                <a className='nav-link navbar-text' href='#forecast'>Előrejelzés</a>
              </li>
              <li className='nav-item'>
                <a className='nav-link navbar-text' href='#hourly_forecast'>Óránkénti Előrejelzés</a>
              </li>
              <li className='nav-item'>
                <a className='nav-link navbar-text' href='#weather_radar'>Időjárás Radar</a>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <div className='current-weather'>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet"></link>
        <div className="search-bar">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Város keresése..."
              aria-label="Search"
              aria-describedby="search-addon"
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button
              className="btn btn-outline-secondary"
              type="button"
              id="search-addon"
              onClick={handleSearch}
            >
              <i className="fas fa-search"></i>
            </button>
          </div>
        </div>
        <div>
          {loading && <p></p>}
          {error && <p className="text-danger">{error}</p>}
          {weatherData && (
            <div className='d-flex justify-content-center align-items-center searched-data'>
              <div className="weather-info">
                <h1 className='temp-size'>{weatherData.weather.temp_c}°C</h1>
                <h2>{weatherData.city}, {weatherData.country}</h2>
                <p>{weatherData.weather.condition.text}</p>
              </div>
              <div>
                <img
                  className="img-fluid icon-size"
                  src={weatherData.weather.condition.icon.startsWith('http') ? weatherData.weather.condition.icon : 'https:' + weatherData.weather.condition.icon}
                  alt={weatherData.weather.condition.text}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className='row align-items-center forecast-container' id='forecast'>
      <h1>Előrejelzés</h1>
        <div className='col-md-8'>
          <section className="forecast-container">
            {forecastLoading && <p>Forecast loading...</p>}
            {error && <p className="text-danger">{error}</p>}
            {forecastData && forecastData.length > 0 ? (
              <div className="forecast-cards-wrapper">
                {forecastData.map((day, index) => (
                  <div key={index} className="forecast-card align-items-center">
                    <h3>{day.day}</h3>
                    <img
                      src={day.icon.startsWith('http') ? day.icon : 'https:' + day.icon}
                      alt={day.condition}
                    />
                    <p>{day.condition}</p>
                    <p className="description">
                      {day.maxTemp}°C / {day.minTemp}°C
                    </p>
                    <p>UV: {day.uvIndex ?? '-'}</p>
                    <p>Szél: {formatWind(day.windSpeed, day.windDeg)}</p>
                  </div>
                ))}
              </div>
            ) : !forecastLoading && (
              <p>Válassz egy várost az előrejelzés megtekintéséhez</p>
            )}
          </section>
        </div>
      </div>
      <div className='row align-items-center forecast-container' id='hourly_forecast'>
        <h1>Óránkénti Előrejelzés</h1>
        <div className='col-md-12'>
          <section>
            {hourlyLoading && <p>Hourly loading...</p>}
            {error && <p className="text-danger">{error}</p>}
            {hourlyData && hourlyData.length > 0 ? (
              <div className="forecast-cards-wrapper">
                {hourlyData.map((h, index) => (
                  <div key={index} className="forecast-card align-items-center">
                    <h3>{h.time}</h3>
                    <img src={h.icon} alt={h.condition} />
                    <p>{h.condition}</p>
                    <p className="description">{h.temp}°C</p>
                    <p>UV: {h.uvIndex ?? '-'}</p>
                    <p>Szél: {formatWind(h.windSpeed, h.windDeg)}</p>
                  </div>
                ))}
              </div>
            ) : !hourlyLoading && (
              <p>Válassz egy várost az óránkénti előrejelzéshez</p>
            )}
          </section>
        </div>
      </div>
      <div id='weather_radar'>
        <div className='weather-radar-padding'><h1>Időjárás Radar</h1></div>
        <div className='radar-map-container radar-map'>
          <RadarMap />
        </div>
      </div>

    </div>
  );
}

export default App;