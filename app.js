var apiInput = document.getElementById("apiKeyInput");
var locationInput = document.getElementById("locationInput");
var weatherForm = document.getElementById("weatherForm");
var refreshButton = document.getElementById("refreshButton");
var geoButton = document.getElementById("geoButton");
var statusText = document.getElementById("status");
var currentWeather = document.getElementById("currentWeather");
var hourlySection = document.getElementById("hourlySection");
var hourGrid = document.getElementById("hourGrid");

var lastLocation = "";
var pastHours = [];
var futureHours = [];
var currentTab = "past";

var savedApiKey = localStorage.getItem("weatherApiKey");
if (savedApiKey) {
  apiInput.value = savedApiKey;
}

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
      var lat = position.coords.latitude.toFixed(4);
      var lon = position.coords.longitude.toFixed(4);
      var location = lat + "," + lon;

      locationInput.value = location;
      getWeather(location);
    },
    function () {
      showMessage("Could not get your location.", true);
    }
  );
}

function getWeather(location) {
  var apiKey = apiInput.value.trim();
  location = location.trim();

  if (location === "") {
    showMessage("Please enter a location.", true);
    return;
  }

  if (apiKey === "") {
    showMessage("Please enter your Visual Crossing API key.", true);
    return;
  }

  localStorage.setItem("weatherApiKey", apiKey);
  lastLocation = location;
  showMessage("Loading weather...");

  var today = new Date();
  var startDate = getDateString(addDays(today, -2));
  var endDate = getDateString(addDays(today, 2));
  var url =
    "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/" +
    encodeURIComponent(location) +
    "/" +
    startDate +
    "/" +
    endDate +
    "?unitGroup=metric&include=current,hours,days&contentType=json&key=" +
    encodeURIComponent(apiKey);

  fetch(url)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Something went wrong. Check the location or API key.");
      }
      return response.json();
    })
    .then(function (data) {
      showCurrentWeather(data);
      showMessage("Weather loaded.");
    })
    .catch(function (error) {
      showMessage(error.message, true);
    });
}

function showCurrentWeather(data) {
  var current = data.currentConditions;

  if (!current) {
    current = {};
  }

  document.getElementById("resolvedAddress").textContent = data.resolvedAddress || data.address || lastLocation;
  document.getElementById("conditionText").textContent = current.conditions || "Weather";
  document.getElementById("summaryText").textContent = data.description || "Current weather details";
  document.getElementById("temperature").textContent = roundValue(current.temp) + " C";
  document.getElementById("windSpeed").textContent = roundValue(current.windspeed) + " km/h";
  document.getElementById("rainChance").textContent = roundValue(current.precipprob) + "%";
  document.getElementById("updatedAt").textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  setWeatherClass(current.conditions || "");
  splitHours(data.days);

  currentWeather.hidden = false;
  hourlySection.hidden = false;

  if (currentTab === "past") {
    showHours(pastHours);
  } else {
    showHours(futureHours);
  }
}

function splitHours(days) {
  var now = new Date();
  var allHours = [];
  pastHours = [];
  futureHours = [];

  for (var i = 0; i < days.length; i++) {
    var day = days[i];

    for (var j = 0; j < day.hours.length; j++) {
      var hour = day.hours[j];
      hour.fullDate = new Date(hour.datetimeEpoch * 1000);
      allHours.push(hour);
    }
  }

  for (var k = 0; k < allHours.length; k++) {
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

  for (var i = 0; i < hours.length; i++) {
    var hour = hours[i];
    var card = document.createElement("div");
    card.className = "hour-card";

    card.innerHTML =
      "<p class='hour-time'>" +
      hour.fullDate.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) +
      "</p>" +
      "<p class='hour-temp'>" +
      roundValue(hour.temp) +
      " C</p>" +
      "<p>" +
      (hour.conditions || "Weather") +
      "</p>" +
      "<p class='hour-meta'>Wind: " +
      roundValue(hour.windspeed) +
      " km/h<br>Rain: " +
      roundValue(hour.precipprob) +
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
  var text = conditions.toLowerCase();
  currentWeather.className = "current-weather";

  if (text.indexOf("rain") !== -1 || text.indexOf("storm") !== -1) {
    currentWeather.classList.add("rainy");
  } else if (text.indexOf("cloud") !== -1 || text.indexOf("overcast") !== -1) {
    currentWeather.classList.add("cloudy");
  } else {
    currentWeather.classList.add("clear");
  }
}

function showMessage(message, isError) {
  statusText.textContent = message;

  if (isError) {
    statusText.classList.add("error");
  } else {
    statusText.classList.remove("error");
  }
}

function addDays(date, days) {
  var newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

function getDateString(date) {
  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, "0");
  var day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function roundValue(value) {
  if (value === undefined || value === null || isNaN(value)) {
    return "--";
  }

  return Math.round(value);
}

if (savedApiKey) {
  showMessage("You can search for a city or use your current location.");
} else {
  showMessage("Enter your API key and search for a city.");
}
