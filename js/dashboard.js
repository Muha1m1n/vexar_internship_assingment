/*
  dashboard.js - VexarDrive Driver Safety Dashboard

  Page layout from top to bottom:
    1. KPI cards        - four fleet-wide numbers
    2. Spotlight row    - best driver (green) and worst driver (red) side by side
    3. Category groups  - Safe, Monitor, High Risk, each collapsible with a table inside

  Flow:
    Load JSON -> fill KPI cards -> fill spotlight -> build category groups
    Search bar filters all three groups live as you type.
*/

let allDrivers = [];

document.addEventListener("DOMContentLoaded", () => {
  fetch("data/driver_scores.json")
    .then(r => {
      if (!r.ok) throw new Error("Could not load driver_scores.json");
      return r.json();
    })
    .then(data => {
      allDrivers = data.drivers;  // sorted safest first by the Python script
      fillKPICards(data.fleet_summary);
      fillSpotlight(allDrivers);
      renderCategories(allDrivers);
      setupSearch();
    })
    .catch(err => {
      document.getElementById("categories-container").innerHTML = `
        <div class="loading-msg">
          Could not load data. Run process_data.py first.<br>
          <small style="color:#999">${err.message}</small>
        </div>`;
    });
});

/* Fill the four KPI cards at the top */
function fillKPICards(s) {
  document.getElementById("kpi-avg-safety").textContent = s.avg_safety_score + "/100";
  document.getElementById("kpi-incidents").textContent  = s.total_incidents.toLocaleString();
  document.getElementById("kpi-highrisk").textContent   = s.high_risk_count;
  document.getElementById("kpi-split-sub").innerHTML =
    `<span class="highlight">${s.safe_count} Safe</span> &nbsp;·&nbsp;
     <span class="warn">${s.monitor_count} Monitor</span> &nbsp;·&nbsp;
     <span class="danger">${s.high_risk_count} High Risk</span>`;
}

/*
  Fill the two spotlight cards (best and worst driver).
  allDrivers is sorted safest first so index 0 is best, last index is worst.
*/
function fillSpotlight(drivers) {
  fillOneSpotlight("best",  drivers[0]);
  fillOneSpotlight("worst", drivers[drivers.length - 1]);
}

function fillOneSpotlight(side, d) {
  document.getElementById(`${side}-name`).textContent  = d.name;
  document.getElementById(`${side}-score`).textContent = d.safety_score + " / 100";
  document.getElementById(`${side}-bar`).style.width   = d.safety_score + "%";

  document.getElementById(`${side}-stats`).innerHTML = `
    <div class="sp-stat">
      <span class="sp-stat-label">Trips</span>
      <span class="sp-stat-value">${d.total_trips}</span>
    </div>
    <div class="sp-stat">
      <span class="sp-stat-label">Distance</span>
      <span class="sp-stat-value">${d.total_distance} km</span>
    </div>
    <div class="sp-stat">
      <span class="sp-stat-label">Harsh Events</span>
      <span class="sp-stat-value">${d.n_brakes + d.n_accels + d.n_corners}</span>
    </div>
    <div class="sp-stat">
      <span class="sp-stat-label">Speeding Mins</span>
      <span class="sp-stat-value">${d.n_speeding}</span>
    </div>
    <div class="sp-stat">
      <span class="sp-stat-label">Experience</span>
      <span class="sp-stat-value">${d.experience_years} yrs</span>
    </div>
    <div class="sp-stat">
      <span class="sp-stat-label">Hub</span>
      <span class="sp-stat-value">${d.home_hub}</span>
    </div>`;
}

/*
  Build the three collapsible category groups: Safe, Monitor, High Risk.
  Each group has a header with a count badge and a table of drivers inside.
*/
function renderCategories(drivers) {
  const container = document.getElementById("categories-container");

  const groups = [
    { key: "SAFE",      cssClass: "safe",      label: "Safe Drivers",  icon: "ri-shield-check-line",  open: true  },
    { key: "MONITOR",   cssClass: "monitor",   label: "Monitor",       icon: "ri-eye-line",            open: true  },
    { key: "HIGH RISK", cssClass: "high-risk", label: "High Risk",     icon: "ri-alarm-warning-line",  open: true  },
  ];

  container.innerHTML = groups.map(g => {
    const groupDrivers = drivers.filter(d => d.status === g.key);
    return buildCategorySection(g, groupDrivers);
  }).join("");

  document.querySelectorAll(".cat-header").forEach(header => {
    header.addEventListener("click", () => {
      header.closest(".cat-section").classList.toggle("collapsed");
    });
  });
}

/* Build one full category section: header + table */
function buildCategorySection(group, drivers) {
  const rows = drivers.map(d => buildTableRow(d)).join("");

  const tableBody = rows || `
    <tr><td colspan="8" style="text-align:center;color:var(--grey-text);padding:20px">
      No drivers match the current search.
    </td></tr>`;

  const collapsedClass = group.open ? "" : "collapsed";

  return `
    <div class="cat-section ${group.cssClass} ${collapsedClass}" data-group="${group.key}">

      <div class="cat-header">
        <div class="cat-header-left">
          <i class="${group.icon}"></i>
          <span class="cat-label">${group.label}</span>
          <span class="cat-count" id="count-${group.cssClass}">${drivers.length} drivers</span>
        </div>
        <div class="cat-chevron"><i class="ri-arrow-down-s-line"></i></div>
      </div>

      <div class="cat-body">
        <table class="driver-table">
          <thead>
            <tr>
              <th>Driver</th>
              <th>Hub</th>
              <th>Safety Score</th>
              <th>Trips</th>
              <th>Distance</th>
              <th>Harsh Brakes</th>
              <th>Hard Corners</th>
              <th>Speeding</th>
            </tr>
          </thead>
          <tbody id="tbody-${group.cssClass}">
            ${tableBody}
          </tbody>
        </table>
      </div>

    </div>`;
}

/* Build one table row for a single driver */
function buildTableRow(d) {
  const barColour = d.safety_score >= 75 ? "var(--safe-color)"
                  : d.safety_score >= 50 ? "var(--monitor-color)"
                  : "var(--risk-color)";

  return `
    <tr data-name="${d.name.toLowerCase()}">
      <td>
        <div class="row-name">${d.name}</div>
        <div class="row-exp">${d.experience_years} yrs exp · ${d.age}yo</div>
      </td>
      <td class="row-hub">${d.home_hub}</td>
      <td>
        <div class="row-score-wrap">
          <span class="row-score-num">${d.safety_score}</span>
          <div class="row-bar-bg">
            <div class="row-bar-fill" style="width:${d.safety_score}%; background:${barColour}"></div>
          </div>
        </div>
      </td>
      <td>${d.total_trips}</td>
      <td>${d.total_distance} km</td>
      <td class="${d.n_brakes > 5 ? "cell-warn" : ""}">${d.n_brakes}</td>
      <td class="${d.n_corners > 10 ? "cell-warn" : ""}">${d.n_corners}</td>
      <td class="${d.n_speeding > 5 ? "cell-warn" : ""}">${d.n_speeding} min</td>
    </tr>`;
}

/* Search bar filters all three tables at the same time */
function setupSearch() {
  document.getElementById("search-input").addEventListener("input", e => {
    const query = e.target.value.toLowerCase().trim();

    document.querySelectorAll(".cat-section").forEach(section => {
      const groupKey = section.dataset.group;
      const cssClass = section.classList[1];

      const groupDrivers = allDrivers.filter(d => d.status === groupKey);
      const matched = query
        ? groupDrivers.filter(d => d.name.toLowerCase().includes(query))
        : groupDrivers;

      const tbody = document.getElementById("tbody-" + cssClass);
      if (!tbody) return;

      tbody.innerHTML = matched.length
        ? matched.map(d => buildTableRow(d)).join("")
        : `<tr><td colspan="8" style="text-align:center;color:var(--grey-text);padding:20px">
             No drivers match "${query}".
           </td></tr>`;

      const countEl = section.querySelector(".cat-count");
      if (countEl) countEl.textContent = matched.length + " driver" + (matched.length !== 1 ? "s" : "");
    });
  });
}
