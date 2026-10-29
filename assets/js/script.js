const API_key = "5d654dc16d705cc36258a50daf547435";
const API_base = "https://api.openweathermap.org";
const HISTORY_KEY = "city-data";
const MAX_HISTORY = 8;

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const todayWrapper = document.getElementById("today");
const forecast = document.getElementById("forecast");
const forecastTitle = document.getElementById("forecast-title");
const historyWrapper = document.getElementById("history");
const historyHead = document.getElementById("history-head");
const errorMsgCont = document.querySelector(".error-msg");
const clearHistory = document.getElementById("clear-history");

let cityData = loadHistory();

// Search form submit (also handles pressing Enter)
searchForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const city = searchInput.value.trim();
  if (city) {
    searchCity(city);
  } else {
    errorMsg("Please enter a city name.");
  }
});

// Geocode a city name, then load its weather
async function searchCity(city) {
  setLoading(true);
  try {
    const res = await fetch(
      `${API_base}/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_key}`
    );
    if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
    const results = await res.json();
    if (!results.length) {
      errorMsg(`Couldn't find "${city}". Check the spelling and try again.`);
      setLoading(false);
      return;
    }
    const place = results[0];
    const name = place.local_names?.en || place.name;
    searchInput.value = "";
    hideError();
    storeCity({ name, country: place.country, lat: place.lat, lon: place.lon });
    await getData(place.lat, place.lon);
  } catch (err) {
    console.error(err);
    errorMsg("Something went wrong fetching the weather. Please try again.");
    setLoading(false);
  }
}

// Fetch current weather and 5-day / 3-hour forecast together
async function getData(lat, lon) {
  setLoading(true);
  try {
    const query = `lat=${lat}&lon=${lon}&appid=${API_key}&units=metric`;
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`${API_base}/data/2.5/weather?${query}`),
      fetch(`${API_base}/data/2.5/forecast?${query}`),
    ]);
    if (!currentRes.ok || !forecastRes.ok) {
      throw new Error(`Weather request failed (${currentRes.status}/${forecastRes.status})`);
    }
    const current = await currentRes.json();
    const forecastData = await forecastRes.json();
    hideError();
    createTodayContent(current);
    createForecast(forecastData);
  } catch (err) {
    console.error(err);
    errorMsg("Something went wrong fetching the weather. Please try again.");
    setLoading(false);
  }
}

function errorMsg(message) {
  errorMsgCont.textContent = message;
  errorMsgCont.classList.remove("hide");
}

function hideError() {
  errorMsgCont.classList.add("hide");
}

function setLoading(isLoading) {
  todayWrapper.classList.toggle("loading", isLoading);
  forecast.classList.toggle("loading", isLoading);
}

// Create and display current weather
function createTodayContent(data) {
  const weather = data.weather[0];
  setTheme(weather);
  todayWrapper.classList.remove("loading");
  todayWrapper.innerHTML = `
    <div class="today-main">
      <div>
        <h2 class="city">${escapeHtml(data.name)}<span class="country">${data.sys.country}</span></h2>
        <p class="date">${formatLocal(data.dt, data.timezone, { weekday: "long", day: "numeric", month: "long" })}
          · ${formatLocal(data.dt, data.timezone, { hour: "2-digit", minute: "2-digit" })} local time</p>
      </div>
      <img class="today-icon" src="${getImageUrl(weather.icon, 4)}" alt="${weather.description}" />
    </div>
    <div class="today-temp">
      <span class="temp">${Math.round(data.main.temp)}°</span>
      <div>
        <p class="desc">${weather.description}</p>
        <p class="feels">Feels like ${Math.round(data.main.feels_like)}° · H ${Math.round(data.main.temp_max)}° L ${Math.round(data.main.temp_min)}°</p>
      </div>
    </div>
    <ul class="stats">
      <li class="glass-chip"><span>Humidity</span><strong>${data.main.humidity}%</strong></li>
      <li class="glass-chip"><span>Wind</span><strong>${Math.round(data.wind.speed * 3.6)} km/h</strong></li>
      <li class="glass-chip"><span>Pressure</span><strong>${data.main.pressure} hPa</strong></li>
      <li class="glass-chip"><span>Sunrise</span><strong>${formatLocal(data.sys.sunrise, data.timezone, { hour: "2-digit", minute: "2-digit" })}</strong></li>
      <li class="glass-chip"><span>Sunset</span><strong>${formatLocal(data.sys.sunset, data.timezone, { hour: "2-digit", minute: "2-digit" })}</strong></li>
    </ul>
  `;
}

// Group the 3-hourly forecast by the city's local date and show one card per day
function createForecast(data) {
  const offset = data.city.timezone;
  const todayKey = localDateKey(Date.now() / 1000, offset);
  const days = {};

  data.list.forEach((slot) => {
    const key = localDateKey(slot.dt, offset);
    if (key === todayKey) return;
    (days[key] = days[key] || []).push(slot);
  });

  forecast.classList.remove("loading");
  forecast.innerHTML = Object.values(days)
    .slice(0, 5)
    .map((slots) => createForecastData(slots, offset))
    .join("");
  forecastTitle.classList.remove("hide");
}

// One forecast card: midday conditions plus the day's high and low
function createForecastData(slots, offset) {
  const midday = slots.reduce((best, slot) =>
    Math.abs(localHour(slot.dt, offset) - 12) < Math.abs(localHour(best.dt, offset) - 12)
      ? slot
      : best
  );
  const high = Math.max(...slots.map((s) => s.main.temp_max));
  const low = Math.min(...slots.map((s) => s.main.temp_min));
  const weather = midday.weather[0];
  return `
    <article class="glass forecast-card">
      <h3>${formatLocal(midday.dt, offset, { weekday: "short" })}</h3>
      <p class="forecast-date">${formatLocal(midday.dt, offset, { day: "numeric", month: "short" })}</p>
      <img src="${getImageUrl(weather.icon)}" alt="${weather.description}" />
      <p class="forecast-temp"><strong>${Math.round(high)}°</strong> <span>${Math.round(low)}°</span></p>
      <p class="forecast-meta">${weather.main} · ${midday.main.humidity}%</p>
    </article>
  `;
}

// Url needed to display the icon for each weather
function getImageUrl(icon, size = 2) {
  return `https://openweathermap.org/img/wn/${icon}@${size}x.png`;
}

// Change the background colours to match the weather
function setTheme(weather) {
  const isNight = weather.icon.endsWith("n");
  const themes = {
    Clear: "clear",
    Clouds: "clouds",
    Rain: "rain",
    Drizzle: "rain",
    Thunderstorm: "storm",
    Snow: "snow",
  };
  const theme = isNight ? "night" : themes[weather.main] || "mist";
  document.body.dataset.theme = theme;
}

// Times from the API are UTC seconds; shift by the city's offset and format as UTC
function formatLocal(unix, offset, options) {
  return new Date((unix + offset) * 1000).toLocaleString("en-GB", {
    ...options,
    timeZone: "UTC",
  });
}

function localDateKey(unix, offset) {
  return new Date((unix + offset) * 1000).toISOString().slice(0, 10);
}

function localHour(unix, offset) {
  return new Date((unix + offset) * 1000).getUTCHours();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Load saved cities, ignoring the old format (plain names without coordinates)
function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    return saved.filter((city) => city.lat !== undefined);
  } catch {
    return [];
  }
}

// Store a city at the top of the history, without duplicates
function storeCity(city) {
  cityData = cityData.filter(
    (c) => !(c.name === city.name && c.country === city.country)
  );
  cityData.unshift(city);
  cityData = cityData.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(cityData));
  cityHistory();
}

// Show the saved cities as buttons
function cityHistory() {
  const hasHistory = cityData.length > 0;
  historyHead.classList.toggle("hide", !hasHistory);
  historyWrapper.innerHTML = cityData
    .map(
      (city, i) =>
        `<button type="button" class="history-btn glass-chip" data-index="${i}">
          ${escapeHtml(city.name)} <span>${city.country}</span>
        </button>`
    )
    .join("");
}

// One listener for all history buttons
historyWrapper.addEventListener("click", (e) => {
  const btn = e.target.closest(".history-btn");
  if (!btn) return;
  const city = cityData[btn.dataset.index];
  storeCity(city);
  getData(city.lat, city.lon);
});

// Clear only this app's history
clearHistory.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  cityData = [];
  cityHistory();
});

cityHistory();
// Show the last searched city on load
if (cityData.length) {
  getData(cityData[0].lat, cityData[0].lon);
}
