const locationInput = document.getElementById("locationInput");
const citySuggestions = document.getElementById("citySuggestions");
const weatherForm = document.getElementById("weatherForm");
const refreshButton = document.getElementById("refreshButton");
const geoButton = document.getElementById("geoButton");
const statusText = document.getElementById("status");
const currentWeather = document.getElementById("currentWeather");
const dailySection = document.getElementById("dailySection");
const dayGrid = document.getElementById("dayGrid");

let lastSearch = "";
let pastDays = [];
let futureDays = [];
let allDays = [];
let currentTab = "past";

const popularCities = [
  "New York",
  "London",
  "Tokyo",
  "Paris",
  "Berlin",
  "Moscow",
  "Istanbul",
  "Almaty",
  "Dubai",
  "Madrid",
  "Rome",
  "Seoul",
  "Toronto",
  "Los Angeles",
  "Amsterdam",
  "Tashkent",
  "Astana",
  "Baku",
];

locationInput.addEventListener("focus", function () {
  showCitySuggestions();
});

locationInput.addEventListener("input", function () {
  showCitySuggestions();
});

document.addEventListener("click", function (event) {
  if (!event.target.closest(".search-control")) {
    hideCitySuggestions();
  }
});

weatherForm.addEventListener("submit", function (event) {
  event.preventDefault();
  hideCitySuggestions();
  getWeather(locationInput.value);
});

refreshButton.addEventListener("click", function () {
  if (lastSearch !== "") {
    getWeather(lastSearch);
  } else {
    showMessage("Please search for a location first.", true);
  }
});

geoButton.addEventListener("click", function () {
  getUserLocation();
});

document.getElementById("pastTab").addEventListener("click", function () {
  currentTab = "past";
  changeTabs();
  showDays(pastDays);
});

document.getElementById("futureTab").addEventListener("click", function () {
  currentTab = "future";
  changeTabs();
  showDays(futureDays);
});

function getUserLocation() {
  if (!navigator.geolocation) {
    showMessage("Geolocation is not supported in this browser.", true);
    return;
  }

  showMessage("Getting your location...");

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const lat = position.coords.latitude.toFixed(4);
      const lon = position.coords.longitude.toFixed(4);
      const location = lat + "," + lon;

      locationInput.value = location;
      lastSearch = location;
      getWeatherByCoords(lat, lon, "Your location");
    },
    function () {
      showMessage("Could not get your location.", true);
    }
  );
}

function getWeather(location) {
  location = location.trim();

  if (location === "") {
    showMessage("Please enter a location.", true);
    return;
  }

  lastSearch = location;
  showMessage("Loading weather...");

  if (isCoords(location)) {
    const parts = location.split(",");
    getWeatherByCoords(parts[0].trim(), parts[1].trim(), location);
    return;
  }

  const geoUrl = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(location) + "&count=1&language=en&format=json";

  fetch(geoUrl)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Could not find this location.");
      }
      return response.json();
    })
    .then(function (geoData) {
      if (!geoData.results || geoData.results.length === 0) {
        throw new Error("City was not found.");
      }

      const place = geoData.results[0];
      const name = place.name + ", " + place.country;
      getWeatherByCoords(place.latitude, place.longitude, name);
    })
    .catch(function (error) {
      showMessage(error.message, true);
    });
}

function getWeatherByCoords(lat, lon, placeName) {
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon) +
    "&current=temperature_2m,wind_speed_10m,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max" +
    "&hourly=temperature_2m,wind_speed_10m,precipitation_probability,weather_code" +
    "&timezone=auto&past_days=7&forecast_days=8";

  fetch(url)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Could not load weather.");
      }
      return response.json();
    })
    .then(function (data) {
      showCurrentWeather(data, placeName);
      showMessage("Weather loaded.");
    })
    .catch(function (error) {
      showMessage(error.message, true);
    });
}

function showCurrentWeather(data, placeName) {
  const current = data.current;
  splitDays(data.daily, data.hourly, current.time);

  const todayWeather = findTodayWeather(current.time);
  const weatherName = getWeatherName(current.weather_code);

  document.getElementById("resolvedAddress").textContent = placeName;
  document.getElementById("conditionText").textContent = weatherName;
  document.getElementById("summaryText").textContent = "Current weather and 7 day outlook";
  document.getElementById("temperature").textContent = formatTemp(current.temperature_2m);
  document.getElementById("windSpeed").textContent = roundValue(current.wind_speed_10m) + " km/h";
  document.getElementById("rainChance").textContent = roundValue(todayWeather.precipitation) + "%";
  document.getElementById("updatedAt").textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  setWeatherClass(weatherName);

  currentWeather.hidden = false;
  dailySection.hidden = false;

  if (currentTab === "past") {
    showDays(pastDays);
  } else {
    showDays(futureDays);
  }
}

function splitDays(daily, hourly, currentTime) {
  const todayKey = getDateKey(new Date(currentTime));
  allDays = [];
  pastDays = [];
  futureDays = [];

  for (let i = 0; i < daily.time.length; i++) {
    const day = {
      fullDate: new Date(daily.time[i]),
      maxTemp: daily.temperature_2m_max[i],
      minTemp: daily.temperature_2m_min[i],
      windspeed: daily.wind_speed_10m_max[i],
      precipitation: daily.precipitation_probability_max[i],
      weather: getWeatherName(daily.weather_code[i]),
      hours: [],
    };

    allDays.push(day);
  }

  for (let j = 0; j < hourly.time.length; j++) {
    const hourDate = new Date(hourly.time[j]);
    const hourDayKey = getDateKey(hourDate);

    for (let d = 0; d < allDays.length; d++) {
      if (getDateKey(allDays[d].fullDate) === hourDayKey) {
        allDays[d].hours.push({
          fullDate: hourDate,
          temp: hourly.temperature_2m[j],
          windspeed: hourly.wind_speed_10m[j],
          precipitation: hourly.precipitation_probability[j],
          weather: getWeatherName(hourly.weather_code[j]),
        });
      }
    }
  }

  for (let k = 0; k < allDays.length; k++) {
    const dayKey = getDateKey(allDays[k].fullDate);

    if (dayKey < todayKey) {
      pastDays.push(allDays[k]);
    }

    if (dayKey > todayKey) {
      futureDays.push(allDays[k]);
    }
  }

  pastDays = pastDays.slice(-7);
  futureDays = futureDays.slice(0, 7);
}

function showDays(days) {
  dayGrid.innerHTML = "";

  if (days.length === 0) {
    dayGrid.innerHTML = "<p>No daily weather found.</p>";
    return;
  }

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const row = document.createElement("div");
    const card = document.createElement("div");
    const title = document.createElement("button");
    const hourlyBox = document.createElement("div");

    row.className = "day-row";
    card.className = "day-card";
    title.className = "day-title";
    title.type = "button";
    title.textContent = getDayTitle(day.fullDate);
    hourlyBox.className = "day-hourly";
    hourlyBox.hidden = true;
    hourlyBox.innerHTML = getHourlyHtml(day);

    function toggleHourly() {
      const shouldOpen = hourlyBox.hidden;
      closeAllHourlyRows();

      if (shouldOpen) {
        hourlyBox.hidden = false;
        row.classList.add("is-open");
      }
    }

    title.addEventListener("click", toggleHourly);
    card.addEventListener("click", toggleHourly);

    card.innerHTML =
      "<div class='day-card-main'>" +
      "<span class='small-icon " +
      getIconClass(day.weather) +
      "'></span>" +
      "<div>" +
      "<p class='day-weather'>" +
      day.weather +
      "</p>" +
      "<p class='day-temp'>" +
      formatTemp(getAverageTemp(day)) +
      " <span>avg</span>" +
      "</p>" +
      "<p class='day-minmax'>min " +
      formatTemp(day.minTemp) +
      " / max " +
      formatTemp(day.maxTemp) +
      "</p>" +
      "</div>" +
      "</div>" +
      "<div class='day-stats'>" +
      "<span>" +
      roundValue(day.precipitation) +
      "% rain</span>" +
      "<span>" +
      roundValue(day.windspeed) +
      " km/h wind</span>" +
      "</div>";

    row.appendChild(title);
    row.appendChild(card);
    row.appendChild(hourlyBox);
    dayGrid.appendChild(row);
  }
}

function showCitySuggestions() {
  const text = locationInput.value.toLowerCase();
  let matchedCities = [];

  for (let i = 0; i < popularCities.length; i++) {
    const city = popularCities[i];

    if (city.toLowerCase().indexOf(text) !== -1) {
      matchedCities.push(city);
    }
  }

  citySuggestions.innerHTML = "";

  if (matchedCities.length === 0) {
    citySuggestions.hidden = true;
    return;
  }

  for (let j = 0; j < matchedCities.length; j++) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = matchedCities[j];

    button.addEventListener("click", function () {
      locationInput.value = this.textContent;
      hideCitySuggestions();
      getWeather(this.textContent);
    });

    citySuggestions.appendChild(button);
  }

  citySuggestions.hidden = false;
}

function hideCitySuggestions() {
  citySuggestions.hidden = true;
}

function closeAllHourlyRows() {
  const rows = document.querySelectorAll(".day-row");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const hourly = row.querySelector(".day-hourly");

    if (hourly) {
      hourly.hidden = true;
      row.classList.remove("is-open");
    }
  }
}

function getHourlyHtml(day) {
  let html = "";

  if (day.hours.length === 0) {
    return "<p>No hourly weather found for this day.</p>";
  }

  for (let i = 0; i < day.hours.length; i++) {
    const hour = day.hours[i];

    html +=
      "<div class='hour-mini-card'>" +
      "<div class='hour-mini-top'>" +
      "<span>" +
      getTimeText(hour.fullDate) +
      "</span>" +
      "<span class='small-icon " +
      getIconClass(hour.weather) +
      "'></span>" +
      "</div>" +
      "<strong>" +
      formatTemp(hour.temp) +
      "</strong>" +
      "<p>" +
      hour.weather +
      "</p>" +
      "<small>" +
      roundValue(hour.precipitation) +
      "% rain / " +
      roundValue(hour.windspeed) +
      " km/h</small>" +
      "</div>";
  }

  return html;
}

function changeTabs() {
  document.getElementById("pastTab").classList.remove("is-active");
  document.getElementById("futureTab").classList.remove("is-active");

  if (currentTab === "past") {
    document.getElementById("pastTab").classList.add("is-active");
  } else {
    document.getElementById("futureTab").classList.add("is-active");
  }
}

function setWeatherClass(conditions) {
  const text = conditions.toLowerCase();
  currentWeather.className = "current-weather";

  if (text.indexOf("rain") !== -1 || text.indexOf("storm") !== -1) {
    currentWeather.classList.add("rainy");
  } else if (text.indexOf("cloud") !== -1 || text.indexOf("overcast") !== -1) {
    currentWeather.classList.add("cloudy");
  } else {
    currentWeather.classList.add("clear");
  }
}

function findTodayWeather(currentTime) {
  const todayKey = getDateKey(new Date(currentTime));

  for (let i = 0; i < allDays.length; i++) {
    if (getDateKey(allDays[i].fullDate) === todayKey) {
      return allDays[i];
    }
  }

  return {};
}

function getWeatherName(code) {
  if (code === 0) {
    return "Sunny";
  }

  if (code === 1 || code === 2 || code === 3) {
    return "Cloudy";
  }

  if (code === 45 || code === 48) {
    return "Foggy";
  }

  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return "Raining";
  }

  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return "Snowing";
  }

  if (code >= 95) {
    return "Storm";
  }

  return "Weather";
}

function getIconClass(weather) {
  const text = weather.toLowerCase();

  if (text.indexOf("rain") !== -1) {
    return "rain-icon";
  }

  if (text.indexOf("snow") !== -1) {
    return "snow-icon";
  }

  if (text.indexOf("cloud") !== -1 || text.indexOf("fog") !== -1) {
    return "cloud-icon";
  }

  if (text.indexOf("storm") !== -1) {
    return "storm-icon";
  }

  return "sun-icon";
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function getTimeText(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDayTitle(date) {
  return date.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function getAverageTemp(day) {
  return (Number(day.maxTemp) + Number(day.minTemp)) / 2;
}

function isCoords(text) {
  const parts = text.split(",");

  if (parts.length !== 2) {
    return false;
  }

  return !isNaN(parts[0].trim()) && !isNaN(parts[1].trim());
}

function showMessage(message, isError) {
  statusText.textContent = message;

  if (isError) {
    statusText.classList.add("error");
  } else {
    statusText.classList.remove("error");
  }
}

function roundValue(value) {
  if (value === undefined || value === null || isNaN(value)) {
    return "--";
  }

  return Math.round(value);
}

function formatTemp(value) {
  return roundValue(value) + "\u00B0C";
}

showMessage("Search for a city or use your current location.");
getUserLocation();
