const API_key = "5d654dc16d705cc36258a50daf547435";
const searchButton = document.getElementById("search-button");
const searchInput = document.getElementById("search-input");
const todayWrapper = document.getElementById("today");
let todayContent = document.createElement("div");
const forecast = document.getElementById("forecast");

// add event listener for search button input and to fetch the date
searchButton.addEventListener("click", function (e) {
  e.preventDefault();
  todayWrapper.innerHTML = "";
  forecast.innerHTML = "";
  clearItem();
  let city = searchInput.value.trim();
  if (city) {
    getCity(city);
    searchInput.value = "";
    storeCity(city);
  } else {
    errorMsg();
  }
});

// Geocoding for latitute and longitude from city name
async function getCity(city) {
  let res = await fetch(
    `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_key}`
  );
  if (res.status === 200) {
    errorMsgCont.classList.add("hide");
    let data = await res.json();
    let lon = data[0].lon;
    let lat = data[0].lat;
    getData(lat, lon);
    cityHistory();
  } else {
    errorMsg();
  }
}
function errorMsg() {
  errorMsgCont.classList.remove("hide");
}

//  Fetching data from weather api
async function getData(lat, lon) {
  let res = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_key}&units=metric`
  );
  let data = await res.json();
  createTodayContent(data);
  createForecast(data);
}

// Create and display current weather forecast
function createTodayContent(data) {
  todayWrapper.innerHTML += `
  <div class="d-flex align-items-center ">
    <h2>${data.city.name} (${data.city.country})</h2>
    <img 
        src=${getImageUrl(data.list[0].weather[0].icon)}
        alt="${data.list[0].weather[0].description}"></img>
  </div>
    <h4 class="mb-4">${dayjs().format("dddd D MMM YYYY")}</h4>
    <p>Temperature: ${Math.floor(data.list[0].main.temp)}&degc</p>
    <p>Humidity: ${data.list[0].main.humidity}%</p>
    <p>Wind Speed: ${Math.floor(data.list[0].wind.speed)} KPH</p>
  `;
  todayWrapper.appendChild(todayContent);
}

// Create and display 5-day forecasts
function createForecast(data) {
  let lastDayTime = timeOfDay(data.list);
  let today = dayjs().format("DD");
  for (var i = 0; i < data.list.length; i++) {
    let day = data.list[i];
    let futureDay = dayjs(day.dt_txt).format("DD");
    let dayTime = dayjs(day.dt_txt).format("HH:mm");
    let fixedTime = "12:00";
    if (futureDay > today) {
      if (futureDay == +today + 1) {
        if (dayTime === fixedTime) {
          createForecastData(day);
        }
      }
      if (futureDay == +today + 2) {
        if (dayTime === fixedTime) {
          createForecastData(day);
        }
      }
      if (futureDay == +today + 3) {
        if (dayTime === fixedTime) {
          createForecastData(day);
        }
      }
      if (futureDay == +today + 4) {
        if (dayTime === fixedTime) {
          createForecastData(day);
        }
      }
      if (futureDay == +today + 5) {
        if (dayTime == lastDayTime) {
          createForecastData(day);
        }
      }
    }
  }
}

// Reset divs that contain data to show new-selected city
function clearItem() {
  todayContent.innerHTML = "";
}

// Url need to display the icons for each weather 
function getImageUrl(icon) {
  return `http://openweathermap.org/img/wn/${icon}@2x.png`;
}

// Store data into the local storage
function storeCity(city) {
  let newCity = {
    name: city,
  };
  cityData.push(newCity);
  localStorage.setItem("city-data", JSON.stringify(cityData));
}

// fetches the stored dat from local storage and displays in the
// history section if data exists
function cityHistory() {
  let cityHistory = JSON.parse(localStorage.getItem("city-data")) || [];
  if (cityHistory.length > 0) {
    clearHistory.classList.remove("hide");
    historyWrapper.innerHTML = "";
    forecast.innerHTML = "";
    historyWrapper.innerHTML += cityHistory
      .map(
        (cityName) =>
          `<button id="cityBtn" data-id="${
            cityName.name
          }" class="btn btn-secondary mt-2 mb-2">${upperCase(
            cityName.name
          )}</button>`
      )
      .join("");

    for (let i = 0; i < cityBtn.length; i++) {
      let eachBtn = cityBtn[i];
      let dataId = eachBtn.dataset.id;
      eachBtn.addEventListener("click", () => {
        clearItem();
        getCity(dataId);
      });
    }
  }
}
cityHistory();

// Convert first character of city to uppercase in history
function upperCase(city) {
  let firstChar = city.charAt(0).toUpperCase();
  let remWord = city.slice(1);
  return firstChar + remWord;
}
// Create and display 5 day forecast
function createForecastData(day) {
  forecast.innerHTML += `
  <div class="col-lg-2 forecastCard">
    <div class="d-flex flex-column align-items-center ">
    <img
        src=${getImageUrl(day.weather[0].icon)}
        alt="${day.weather[0].description}"></img> 
    <h5 class="mb-4">${dayjs(day.dt_txt).format("ddd D MMM")}</h5>
    <p>Temperature: ${Math.floor(day.main.temp)}&degc</p>
    <p>Humidity: ${day.main.humidity}%</p>
    </div>
  </div>
  `;
}
// Clear the contents of the history
clearHistory.addEventListener("click", () => {
  window.localStorage.clear("city-data");
  cityData = [];
  historyWrapper.innerHTML = "";
  clearHistory.classList.add("hide");
});

// Getting the latest available weather data of choosen day to display in forecast
function timeOfDay(day) {
  let lastDay = day[day.length - 1];
  let lastTime = dayjs(lastDay.dt_txt).format("HH:mm");
  return lastTime;
}

