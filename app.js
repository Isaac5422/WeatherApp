const locationInput = document.getElementById("locationInput");
const weatherForm = document.getElementById("weatherForm");
const refreshButton = document.getElementById("refreshButton");
const geoButton = document.getElementById("geoButton");
const statusText = document.getElementById("status");
const currentWeather = document.getElementById("currentWeather");
const hourlySection = document.getElementById("hourlySection");
const hourGrid = document.getElementById("hourGrid");

let lastLocation = "";
let pastHours = [];
let futureHours = [];
let currentTab = "past";

weatherForm.addEventListener("submit", function (event) {
  event.preventDefault();
  getWeather(locationInput.value);
});

refreshButton.addEventListener("click", function () {
  if (lastLocation !== "") {
    getWeather(lastLocation);
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
  showHours(pastHours);
});

document.getElementById("futureTab").addEventListener("click", function () {
  currentTab = "future";
  changeTabs();
  showHours(futureHours);
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

  lastLocation = location;
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
  lastLocation = placeName;

  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=" +
    encodeURIComponent(lat) +
    "&longitude=" +
    encodeURIComponent(lon) +
    "&current=temperature_2m,wind_speed_10m,weather_code" +
    "&hourly=temperature_2m,wind_speed_10m,precipitation_probability,weather_code" +
    "&timezone=auto&past_days=1&forecast_days=2";

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
  splitHours(data.hourly, current.time);

  const nearestHour = findNearestHour();
  const weatherName = getWeatherName(current.weather_code);

  document.getElementById("resolvedAddress").textContent = placeName;
  document.getElementById("conditionText").textContent = weatherName;
  document.getElementById("summaryText").textContent = "Current weather and hourly forecast";
  document.getElementById("temperature").textContent = roundValue(current.temperature_2m) + " C";
  document.getElementById("windSpeed").textContent = roundValue(current.wind_speed_10m) + " km/h";
  document.getElementById("rainChance").textContent = roundValue(nearestHour.precipitation) + "%";
  document.getElementById("updatedAt").textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  setWeatherClass(weatherName);

  currentWeather.hidden = false;
  hourlySection.hidden = false;

  if (currentTab === "past") {
    showHours(pastHours);
  } else {
    showHours(futureHours);
  }
}

function splitHours(hourly, currentTime) {
  const now = new Date(currentTime);
  const allHours = [];
  pastHours = [];
  futureHours = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const hour = {
      fullDate: new Date(hourly.time[i]),
      temp: hourly.temperature_2m[i],
      windspeed: hourly.wind_speed_10m[i],
      precipitation: hourly.precipitation_probability[i],
      weather: getWeatherName(hourly.weather_code[i]),
    };

    allHours.push(hour);
  }

  for (let k = 0; k < allHours.length; k++) {
    if (allHours[k].fullDate <= now) {
      pastHours.push(allHours[k]);
    } else {
      futureHours.push(allHours[k]);
    }
  }

  pastHours = pastHours.slice(-24);
  futureHours = futureHours.slice(0, 24);
}

function showHours(hours) {
  hourGrid.innerHTML = "";

  if (hours.length === 0) {
    hourGrid.innerHTML = "<p>No hourly weather found.</p>";
    return;
  }

  for (let i = 0; i < hours.length; i++) {
    const hour = hours[i];
    const card = document.createElement("div");
    card.className = "hour-card";

    card.innerHTML =
      "<p class='hour-time'>" +
      hour.fullDate.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) +
      "</p>" +
      "<p class='hour-temp'>" +
      roundValue(hour.temp) +
      " C</p>" +
      "<p>" +
      hour.weather +
      "</p>" +
      "<p class='hour-meta'>Wind: " +
      roundValue(hour.windspeed) +
      " km/h<br>Rain: " +
      roundValue(hour.precipitation) +
      "%</p>";

    hourGrid.appendChild(card);
  }
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

function findNearestHour() {
  const allHours = pastHours.concat(futureHours);
  let nearestHour = allHours[0] || {};
  const now = new Date().getTime();

  for (let i = 0; i < allHours.length; i++) {
    const currentDiff = Math.abs(allHours[i].fullDate.getTime() - now);
    const nearestDiff = Math.abs(nearestHour.fullDate.getTime() - now);

    if (currentDiff < nearestDiff) {
      nearestHour = allHours[i];
    }
  }

  return nearestHour;
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

showMessage("Search for a city or use your current location.");
getUserLocation();
