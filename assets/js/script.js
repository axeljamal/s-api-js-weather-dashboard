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
