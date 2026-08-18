/*
  vehicle.js - VexarDrive Vehicle Health Dashboard

  Page layout from top to bottom:
    1. KPI cards         - four fleet-wide numbers
    2. Spotlight row     - worst vehicle (red) and best vehicle (green)
    3. Category groups   - Urgent, Monitor, Healthy, each collapsible with a table inside

  Flow:
    Load JSON -> fill KPI cards -> fill spotlight -> build category groups
    Search bar filters all three groups live as you type.
*/

let allVehicles = [];

document.addEventListener("DOMContentLoaded", () => {
  fetch("data/vehicle_scores.json")
    .then(r => {
      if (!r.ok) throw new Error("Could not load vehicle_scores.json");
      return r.json();
    })
    .then(data => {
      allVehicles = data.vehicles;  // sorted worst first by the Python script
      fillVehKPIs(data.fleet_summary);
      fillVehSpotlight(allVehicles);
      renderVehCategories(allVehicles);
      setupVehSearch();
    })
    .catch(err => {
      document.getElementById("veh-categories-container").innerHTML = `
        <div class="loading-msg">
          Could not load data. Run process_data.py first.<br>
          <small style="color:#999">${err.message}</small>
        </div>`;
    });
});

/* Fill the four KPI cards at the top */
function fillVehKPIs(s) {
  document.getElementById("kpi-avg-health").textContent    = s.avg_health_score + "/100";
  document.getElementById("kpi-urgent-count").textContent  = s.urgent_count;
  document.getElementById("kpi-monitor-count").textContent = s.monitor_count;
  document.getElementById("kpi-veh-split-sub").innerHTML =
    `<span class="highlight">${s.healthy_count} Healthy</span> &nbsp;·&nbsp;
     <span class="warn">${s.monitor_count} Monitor</span> &nbsp;·&nbsp;
     <span class="danger">${s.urgent_count} Urgent</span>`;
  document.getElementById("kpi-health-sub").innerHTML = "Out of 30 fleet vehicles";
}

/*
  Fill the two spotlight cards (worst and best vehicle).
  allVehicles is sorted worst first so index 0 is worst, last index is best.
*/
function fillVehSpotlight(vehicles) {
  fillOneVehSpotlight("worst", vehicles[0]);
  fillOneVehSpotlight("best",  vehicles[vehicles.length - 1]);
}

function fillOneVehSpotlight(side, v) {
  document.getElementById(`veh-${side}-name`).textContent  = v.vehicle_id + " - " + v.make + " " + v.model;
  document.getElementById(`veh-${side}-score`).textContent = v.health_score + " / 100";
  document.getElementById(`veh-${side}-bar`).style.width   = v.health_score + "%";

  const serviceFlag = v.days_since_service > 90
    ? `${v.days_since_service}d (overdue)` : `${v.days_since_service}d ago`;

  document.getElementById(`veh-${side}-stats`).innerHTML = `
    <div class="sp-stat">
      <span class="sp-stat-label">Year</span>
      <span class="sp-stat-value">${v.manufacture_year}</span>
    </div>
    <div class="sp-stat">
      <span class="sp-stat-label">Age</span>
      <span class="sp-stat-value">${v.vehicle_age_years} yrs</span>
    </div>
    <div class="sp-stat">
      <span class="sp-stat-label">Odometer</span>
      <span class="sp-stat-value">${v.odometer_km.toLocaleString()} km</span>
    </div>
    <div class="sp-stat">
      <span class="sp-stat-label">Last Service</span>
      <span class="sp-stat-value">${serviceFlag}</span>
    </div>
    <div class="sp-stat">
      <span class="sp-stat-label">Anomaly Rate</span>
      <span class="sp-stat-value">${v.anomaly_rate_pct}%</span>
    </div>
    <div class="sp-stat">
      <span class="sp-stat-label">Trips This Week</span>
      <span class="sp-stat-value">${v.trip_count}</span>
    </div>`;
}

/*
  Build the three collapsible category groups: Urgent, Monitor, Healthy.
  Urgent is shown first since it is the most important.
  Healthy starts collapsed since those vehicles need no action.
*/
function renderVehCategories(vehicles) {
  const container = document.getElementById("veh-categories-container");

  const groups = [
    { key: "URGENT",  cssClass: "urgent",  label: "Urgent - Inspect Right Away",  icon: "ri-alarm-warning-line",   open: true  },
    { key: "MONITOR", cssClass: "monitor", label: "Monitor - Service Soon",        icon: "ri-eye-line",             open: true  },
    { key: "HEALTHY", cssClass: "healthy", label: "Healthy",                       icon: "ri-checkbox-circle-line", open: false },
  ];

  container.innerHTML = groups.map(g => {
    const groupVehicles = vehicles.filter(v => v.status === g.key);
    return buildVehCategorySection(g, groupVehicles);
  }).join("");

  document.querySelectorAll(".veh-cat-header").forEach(header => {
    header.addEventListener("click", () => {
      header.closest(".veh-cat-section").classList.toggle("collapsed");
    });
  });
}

/* Build one full category section: header + table */
function buildVehCategorySection(group, vehicles) {
  const rows = vehicles.map(v => buildVehTableRow(v)).join("");

  const tableBody = rows || `
    <tr><td colspan="9" style="text-align:center;color:var(--grey-text);padding:20px">
      No vehicles match the current search.
    </td></tr>`;

  const collapsedClass = group.open ? "" : "collapsed";

  return `
    <div class="veh-cat-section cat-section ${group.cssClass} ${collapsedClass}" data-group="${group.key}">

      <div class="veh-cat-header cat-header">
        <div class="cat-header-left">
          <i class="${group.icon}"></i>
          <span class="cat-label">${group.label}</span>
          <span class="cat-count veh-cat-count" id="veh-count-${group.cssClass}">
            ${vehicles.length} vehicle${vehicles.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div class="cat-chevron"><i class="ri-arrow-down-s-line"></i></div>
      </div>

      <div class="cat-body">
        <table class="driver-table">
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Year</th>
              <th>Odometer</th>
              <th>Health Score</th>
              <th>Last Service</th>
              <th>Age</th>
              <th>Trips This Week</th>
            </tr>
          </thead>
          <tbody id="veh-tbody-${group.cssClass}">
            ${tableBody}
          </tbody>
        </table>
      </div>

    </div>`;
}

/* Build one table row for a single vehicle */
function buildVehTableRow(v) {
  const barColour = v.health_score >= 70 ? "var(--healthy-color)"
                  : v.health_score >= 45 ? "var(--monitor-color)"
                  : "var(--risk-color)";

  // Flag last service cell red if over 90 days
  const serviceClass = v.days_since_service > 90 ? "cell-warn" : "";

  return `
    <tr data-name="${v.vehicle_id.toLowerCase()} ${v.make.toLowerCase()} ${v.model.toLowerCase()}">
      <td>
        <div class="row-name">${v.vehicle_id} - ${v.make} ${v.model}</div>
        <div class="row-exp">${v.manufacture_year} model</div>
      </td>
      <td>${v.manufacture_year}</td>
      <td>${v.odometer_km.toLocaleString()} km</td>
      <td>
        <div class="row-score-wrap">
          <span class="row-score-num">${v.health_score}</span>
          <div class="row-bar-bg">
            <div class="row-bar-fill" style="width:${v.health_score}%; background:${barColour}"></div>
          </div>
        </div>
      </td>
      <td class="${serviceClass}">${v.days_since_service} days ago</td>
      <td>${v.vehicle_age_years} yrs</td>
      <td>${v.trip_count}</td>
    </tr>`;
}

/* Search bar filters all three tables at the same time */
function setupVehSearch() {
  document.getElementById("veh-search-input").addEventListener("input", e => {
    const query = e.target.value.toLowerCase().trim();

    document.querySelectorAll(".veh-cat-section").forEach(section => {
      const groupKey = section.dataset.group;
      const cssClass = section.classList[2];

      const groupVehicles = allVehicles.filter(v => v.status === groupKey);
      const matched = query
        ? groupVehicles.filter(v =>
            (v.vehicle_id + " " + v.make + " " + v.model).toLowerCase().includes(query)
          )
        : groupVehicles;

      const tbody = document.getElementById("veh-tbody-" + cssClass);
      if (!tbody) return;

      tbody.innerHTML = matched.length
        ? matched.map(v => buildVehTableRow(v)).join("")
        : `<tr><td colspan="9" style="text-align:center;color:var(--grey-text);padding:20px">
             No vehicles match "${query}".
           </td></tr>`;

      const countEl = document.getElementById("veh-count-" + cssClass);
      if (countEl) countEl.textContent = matched.length + " vehicle" + (matched.length !== 1 ? "s" : "");
    });
  });
}
