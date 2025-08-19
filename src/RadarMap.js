import React, { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const RadarMap = () => {
  const mapCenter = [47.4979, 19.0402];
  const mapZoom = 8;
  const [activeLayer, setActiveLayer] = useState("clouds_new");


  return (
    <div style={{ position: "relative" }}>
      <div className="radar-controls">
        <button
          onClick={() => setActiveLayer("clouds_new")}
          className={`radar-btn ${activeLayer === "clouds_new" ? 'active' : ''}`}
          aria-pressed={activeLayer === "clouds_new"}
        >
          ☁️ Felhők
        </button>
        <button
          onClick={() => setActiveLayer("precipitation_new")}
          className={`radar-btn ${activeLayer === "precipitation_new" ? 'active' : ''}`}
          aria-pressed={activeLayer === "precipitation_new"}
        >
          🌧️ Csapadék
        </button>
        <button
          onClick={() => setActiveLayer("rain")}
          className={`radar-btn ${activeLayer === "rain" ? 'active' : ''}`}
          aria-pressed={activeLayer === "rain"}
        >
          💧 Eső
        </button>
        <button
          onClick={() => setActiveLayer("snow")}
          className={`radar-btn ${activeLayer === "snow" ? 'active' : ''}`}
          aria-pressed={activeLayer === "snow"}
        >
          ❄️ Hó
        </button>
        <button
          onClick={() => setActiveLayer("temp_new")}
          className={`radar-btn ${activeLayer === "temp_new" ? 'active' : ''}`}
          aria-pressed={activeLayer === "temp_new"}
        >
          🌡️ Hőmérséklet
        </button>
      </div>

      {/* Térkép */}
      <MapContainer center={[47.4979, 19.0402]} zoom={6} style={{ height: '900px', width: '100%' }}>
        {/* Alapréteg */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {/* Időjárási réteg */}
        <TileLayer
          url={`http://localhost:5000/api/tiles/${activeLayer}/{z}/{x}/{y}.png`}
          attribution='&copy; <a href="https://openweathermap.org/">OpenWeatherMap</a>'
          opacity={0.7}
        />

      </MapContainer>
    </div>
  );
};

export default RadarMap;