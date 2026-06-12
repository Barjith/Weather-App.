'use strict';

// ── CONFIG — paste your free API key from openweathermap.org here ─────────────
const API_KEY = '6f4c7d53153b6c41945d43acd298d849';
const BASE    = 'https://api.openweathermap.org/data/2.5';
const UNITS   = 'metric'; // 'imperial' for °F

// ── Theme ─────────────────────────────────────────────────────────────────────
const html     = document.documentElement;
const themeBtn = document.getElementById('themeBtn');
const saved    = localStorage.getItem('wn_theme') || 'dark';
html.setAttribute('data-theme', saved);
themeBtn.textContent = saved === 'dark' ? '🌙' : '☀️';
themeBtn.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('wn_theme', next);
  themeBtn.textContent = next === 'dark' ? '🌙' : '☀️';
});

// ── DOM refs ──────────────────────────────────────────────────────────────────
const searchForm    = document.getElementById('searchForm');
const cityInput     = document.getElementById('cityInput');
const loader        = document.getElementById('loader');
const errorBanner   = document.getElementById('errorBanner');
const errorMsg      = document.getElementById('errorMsg');
const weatherDisplay= document.getElementById('weatherDisplay');
const apiNotice     = document.getElementById('apiNotice');

// ── Helpers ───────────────────────────────────────────────────────────────────
const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

const fmtTime = (unix, offset) => {
  const d = new Date((unix + offset) * 1000);
  return d.toUTCString().slice(17, 22); // HH:MM
};

const windDir = deg => {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
};

const showError = msg => {
  loader.hidden        = true;
  weatherDisplay.hidden= true;
  errorBanner.hidden   = false;
  errorMsg.textContent = msg;
};

const showLoader = () => {
  errorBanner.hidden   = true;
  weatherDisplay.hidden= true;
  loader.hidden        = false;
};

const showWeather = () => {
  loader.hidden        = true;
  errorBanner.hidden   = true;
  weatherDisplay.hidden= false;
};

// ── Fetch weather ─────────────────────────────────────────────────────────────
const fetchWeather = async (city) => {
  if (API_KEY === 'YOUR_API_KEY_HERE') {
    showError('No API key set. Please add your OpenWeatherMap API key in app.js (line 3).');
    return;
  }

  showLoader();

  try {
    // Fetch current weather and 5-day forecast in parallel
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`${BASE}/weather?q=${encodeURIComponent(city)}&units=${UNITS}&appid=${API_KEY}`),
      fetch(`${BASE}/forecast?q=${encodeURIComponent(city)}&units=${UNITS}&appid=${API_KEY}`)
    ]);

    if (!currentRes.ok) {
      const err = await currentRes.json();
      throw new Error(err.message || `City "${city}" not found.`);
    }

    const current  = await currentRes.json();
    const forecast = await forecastRes.json();

    renderCurrent(current);
    renderForecast(forecast);
    showWeather();

    // Save last searched city
    localStorage.setItem('wn_last_city', city);

  } catch (err) {
    if (err.name === 'TypeError') {
      showError('Network error — check your internet connection and try again.');
    } else {
      showError(err.message);
    }
  }
};

// ── Render current weather ────────────────────────────────────────────────────
const renderCurrent = (d) => {
  const unit     = UNITS === 'metric' ? '°C' : '°F';
  const speedUnit= UNITS === 'metric' ? 'km/h' : 'mph';
  const windSpd  = UNITS === 'metric'
    ? Math.round(d.wind.speed * 3.6)
    : Math.round(d.wind.speed);

  // Location & time
  set('countryName', `${d.sys.country} · ${d.coord.lat.toFixed(2)}°, ${d.coord.lon.toFixed(2)}°`);
  set('cityName', d.name);
  set('dateTime', new Date().toLocaleDateString('en-GB', {weekday:'long',day:'numeric',month:'long',year:'numeric'}));

  // Temperature
  set('tempMain',   `${Math.round(d.main.temp)}${unit}`);
  set('tempFeels',  `${Math.round(d.main.feels_like)}${unit}`);
  set('tempMax',    `${Math.round(d.main.temp_max)}${unit}`);
  set('tempMin',    `${Math.round(d.main.temp_min)}${unit}`);
  set('weatherDesc', d.weather[0].description);

  // Icon
  const icon = document.getElementById('weatherIcon');
  icon.src = `https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png`;
  icon.alt = d.weather[0].description;

  // Stats
  set('humidity',  `${d.main.humidity}%`);
  set('windSpeed', `${windSpd} ${speedUnit}`);
  set('windDir',   `Direction: ${windDir(d.wind.deg)}`);
  set('pressure',  `${d.main.pressure} hPa`);
  set('visibility',`${(d.visibility / 1000).toFixed(1)} km`);
  set('sunrise',   fmtTime(d.sys.sunrise, d.timezone));
  set('sunset',    fmtTime(d.sys.sunset,  d.timezone));

  // Humidity bar
  const bar = document.getElementById('humidityBar');
  if (bar) bar.style.width = `${d.main.humidity}%`;
};

// ── Render 5-day forecast ─────────────────────────────────────────────────────
const renderForecast = (data) => {
  const unit = UNITS === 'metric' ? '°C' : '°F';
  const grid = document.getElementById('forecastGrid');
  grid.innerHTML = '';

  // Pick one entry per day (noon reading)
  const days = {};
  data.list.forEach(item => {
    const date = item.dt_txt.split(' ')[0];
    const hour = item.dt_txt.split(' ')[1];
    if (!days[date] && hour === '12:00:00') days[date] = item;
  });

  // Fallback: just take first per day if no noon slot
  if (Object.keys(days).length < 5) {
    data.list.forEach(item => {
      const date = item.dt_txt.split(' ')[0];
      if (!days[date]) days[date] = item;
    });
  }

  Object.values(days).slice(0, 5).forEach(item => {
    const day  = new Date(item.dt * 1000).toLocaleDateString('en-GB', {weekday:'short'});
    const card = document.createElement('article');
    card.className = 'forecast-card';
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      <span class="fc-day">${day}</span>
      <img class="fc-icon" src="https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png"
           alt="${item.weather[0].description}" />
      <span class="fc-temp-hi">${Math.round(item.main.temp_max)}${unit}</span>
      <span class="fc-temp-lo">${Math.round(item.main.temp_min)}${unit}</span>
      <span class="fc-desc">${item.weather[0].description}</span>
    `;
    grid.appendChild(card);
  });
};

// ── Events ────────────────────────────────────────────────────────────────────
searchForm.addEventListener('submit', e => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (city) fetchWeather(city);
});

document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    cityInput.value = btn.dataset.city;
    fetchWeather(btn.dataset.city);
  });
});

// ── Auto-load last searched city ──────────────────────────────────────────────
const lastCity = localStorage.getItem('wn_last_city');
if (lastCity && API_KEY !== 'YOUR_API_KEY_HERE') {
  cityInput.value = lastCity;
  fetchWeather(lastCity);
}
