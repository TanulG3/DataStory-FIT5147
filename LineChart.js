const margin = { top: 100, right: 100, bottom: 70, left: 90 };
const legendWidth = 120;
const legendHeight = 100;
const modes = ["Metropolitan train", "Metropolitan tram", "Metropolitan bus"];

const containerWidth = document.getElementById("chart-container").clientWidth;
const chartWidth = containerWidth * 0.75;

const svgElement = d3.select("#lineChart")
  .attr("width", chartWidth)
  .attr("height", 600);

const svg = svgElement.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const width = chartWidth - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const parseDate = d3.timeParse("%Y-%m");

const color = d3.scaleOrdinal()
  .domain(modes)
  .range(["#1f77b4", "#ff7f0e", "#2ca02c"]);

const iconMapping = {
  "Metropolitan train": "icons/train.png",
  "Metropolitan tram": "icons/tram.png",
  "Metropolitan bus": "icons/bus.png"
};

let allData = [];
let nested = [];
let x, y;
let staticIcons = {};

let selectedYearRange = [];
let selectedMonthRange = [1, 12];

let excludedModes = new Set();  // Set to track excluded modes

d3.csv("monthly_public_transport_patronage_by_mode.csv").then(data => {
  allData = data.map(d => {
    const date = parseDate(`${d.Year}-${String(d.Month).padStart(2, '0')}`);
    return modes.map(mode => ({
      Date: date,
      Mode: mode,
      Patronage: +d[mode].replace(/,/g, "")
    }));
  }).flat();

  nested = d3.groups(allData, d => d.Mode);

  x = d3.scaleTime()
    .domain(d3.extent(allData, d => d.Date))
    .range([0, width]);

  y = d3.scaleLinear()
    .domain([0, d3.max(allData, d => d.Patronage)]).nice()
    .range([height, 0]);

  const minDate = d3.min(allData, d => d.Date);
  const maxDate = d3.max(allData, d => d.Date);

  drawChart(nested, minDate, maxDate);

  setupSlider();
});

function getYOffset(mode) {
  return mode.includes('tram') ? 0 : -15;
}

function updateChart() {
  const filtered = allData.filter(d => {
    const year = d.Date.getFullYear();
    const month = d.Date.getMonth() + 1;
    return (
      year >= selectedYearRange[0] && year <= selectedYearRange[1] &&
      month >= selectedMonthRange[0] && month <= selectedMonthRange[1]
    );
  });

  const nestedFiltered = d3.groups(filtered, d => d.Mode);

  const minDate = d3.min(filtered, d => d.Date);
  const maxDate = d3.max(filtered, d => d.Date);

  drawChart(nestedFiltered, minDate, maxDate);
}

function drawChart(nestedData, minDate, maxDate) {
  svg.selectAll("*").remove();
  d3.select("#legend-container").selectAll("*").remove(); 

  const x = d3.scaleTime()
    .domain([minDate, maxDate])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(nestedData.flatMap(d => d[1].map(p => p.Patronage)))]).nice()
    .range([height, 0]);

  const line = d3.line()
    .defined(d => {
      const month = d.Date.getMonth() + 1;
      return month >= selectedMonthRange[0] && month <= selectedMonthRange[1];
    })
    .x(d => x(d.Date))
    .y(d => y(d.Patronage))
    .curve(d3.curveMonotoneX);   

// Add COVID-19 Lockdown Period Background
const covidStart = new Date(2020, 2, 1); // March 2020
const covidEnd = new Date(2021, 11, 31); // December 2021

// Draw a light gray rectangle
svg.append("rect")
  .attr("x", x(covidStart))
  .attr("y", 0)
  .attr("width", x(covidEnd) - x(covidStart))
  .attr("height", height)
  .attr("fill", "#eeeeee") // light gray
  .attr("opacity", 0.5);

// Add label
svg.append("text")
  .attr("x", (x(covidStart) + x(covidEnd)) / 2) // center between start and end
  .attr("y", 20) // near top
  .attr("text-anchor", "middle")
  .style("font-size", "12px")
  .style("font-weight", "bold")
  .style("fill", "black")
  .text("Covid-19 Lockdown period (March 2020 to December 2021)");


  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -60)
    .attr("text-anchor", "middle")
    .style("font-size", "20px")
    .style("font-weight", "bold")
    .text("Monthly Patronage Trends for Metropolitan Public Transport (Train, Tram, Bus)");

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(d3.timeMonth.every(3)).tickFormat(d3.timeFormat("%b %Y")))
    .selectAll("text")
      .attr("transform", "rotate(45)")
      .style("text-anchor", "start");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 60)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Date (Month-Year)");

  svg.append("g").call(d3.axisLeft(y));

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -70)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Public Transport Patronage");

  const tooltip = d3.select("#chart-container").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  staticIcons = {};

  nestedData.forEach(([mode, points]) => {
    if (excludedModes.has(mode)) return; // Skip excluded modes

    svg.append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", color(mode))
      .attr("stroke-width", 2)
      .attr("d", line);

    const lastPoint = points[points.length - 1];
    if (lastPoint) {
      staticIcons[mode] = svg.append("image")
        .attr("xlink:href", iconMapping[mode])
        .attr("x", x(lastPoint.Date) + 5)
        .attr("y", y(lastPoint.Patronage) + getYOffset(mode))
        .attr("width", 24)
        .attr("height", 24);

    svg.append("text")
      .attr("class", `label-${mode.replace(/\s+/g, '-')}`)
      .attr("x", x(lastPoint.Date) + 35) // offset a bit right from icon
      .attr("y", y(lastPoint.Patronage) + getYOffset(mode)+ (!mode.includes('tram') ? 15 : 15)) // vertically aligned
      .text(capitalize(mode.replace("Metropolitan ", "")))
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("alignment-baseline", "middle")
      .style("fill", color(mode));
    }

    svg.selectAll(`.circle-${mode.replace(/\s+/g, '-')}`)
      .data(points)
      .enter()
      .append("circle")
      .attr("class", `circle-${mode.replace(/\s+/g, '-')}`)
      .attr("cx", d => x(d.Date))
      .attr("cy", d => y(d.Patronage))
      .attr("r", 4)
      .attr("fill", color(mode))
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .on("mouseover", function(event, d) {
        svg.selectAll("path").style("opacity", 0.2);
        svg.selectAll("circle").style("opacity", 0.2);

        d3.select(this).style("opacity", 1);

        staticIcons[d.Mode]
          .transition()
          .duration(300)
          .attr("x", x(d.Date) - 10)
          .attr("y", y(d.Patronage) - 25);

        tooltip
          .style("left", (event.pageX - 95) + "px")
          .style("top", (event.pageY - 115) + "px")
          .style("opacity", 1)
          .html(`
            <div class="speech-bubble">
              <strong>${d.Mode.replace("Metropolitan ", "")}</strong><br>
              <strong>Date:</strong> ${d3.timeFormat("%B %Y")(d.Date)}<br>
              <strong>Patronage:</strong> ${d3.format(",")(d.Patronage)}
            </div>
          `);
      })
      .on("mouseout", function(event, d) {
        svg.selectAll("path").style("opacity", 1);
        svg.selectAll("circle").style("opacity", 1);

        const lastPoint = nestedData.find(([m]) => m === d.Mode)[1].slice(-1)[0];
        staticIcons[d.Mode]
          .transition()
          .duration(300)
          .attr("x", x(lastPoint.Date) + 5)
          .attr("y", y(lastPoint.Patronage) + getYOffset(d.Mode));

        tooltip.style("opacity", 0);
      });
  });

  const legendSvg = d3.select("#legend-container")
  .append("svg")
  .attr("width", 180)      // Bigger Width
  .attr("height", 180);    // Bigger Height

const legend = legendSvg.append("g")
  .attr("transform", "translate(20,20)")
  .attr("class", "legend-box");

legend.append("rect")
  .attr("width", 140)       // Wider
  .attr("height", 140)      // Taller
  .attr("fill", "white")
  .attr("stroke", "black")
  .attr("stroke-width", 2)
  .attr("rx", 12)           // More rounded
  .attr("ry", 12)
  .style("opacity", 0.9);

legend.append("text")
  .attr("x", 70)             // Center of 140 width
  .attr("y", 25)
  .attr("text-anchor", "middle")
  .text("Legend")
  .style("font-weight", "bold")
  .style("font-size", "20px");   // Bigger Legend Title

modes.forEach((mode, i) => {
  const group = legend.append("g")
    .attr("transform", `translate(10, ${50 + i * 30})`);   // More vertical spacing

  group.append("line")
    .attr("x1", 0)
    .attr("y1", 5)
    .attr("x2", 30)       // Longer line
    .attr("y2", 5)
    .attr("stroke", color(mode))
    .attr("stroke-width", 4);

  group.append("text")
    .attr("x", 40)
    .attr("y", 10)
    .text(capitalize(mode.replace("Metropolitan ", "")))
    .style("font-size", "16px")
    .style("font-weight", "bold");
});

}

function setupSlider() {
  const years = Array.from(new Set(allData.map(d => d.Date.getFullYear()))).sort();
  const minYear = d3.min(years);
  const maxYear = d3.max(years);
  selectedYearRange = [minYear, maxYear];

  const yearSlider = document.getElementById('yearSlider');
  noUiSlider.create(yearSlider, {
    start: [minYear, maxYear],
    connect: true,
    step: 1,
    range: { min: minYear, max: maxYear },
    pips: { mode: 'values', values: years, density: 5, stepped: true }
  });

  yearSlider.noUiSlider.on('update', (values) => {
    selectedYearRange = values.map(v => +v);
    updateChart();
  });

  const monthSlider = document.getElementById('monthSlider');
  noUiSlider.create(monthSlider, {
    start: [1, 12],
    connect: true,
    step: 1,
    range: { min: 1, max: 12 },
    pips: {
      mode: 'steps',
      values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      density: 12,
      stepped: true,
      format: {
        to: value => monthName(value),
        from: value => Number(value)
      }
    }
  });

  monthSlider.noUiSlider.on('update', (values) => {
    selectedMonthRange = values.map(v => +v);
    updateChart();
  });

  setupModeCheckboxes();
}

function setupModeCheckboxes() {
  const container = document.getElementById('modeCheckboxes');
  container.innerHTML = ''; // Clear if redrawing
  modes.forEach(mode => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.marginTop = '5px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = mode;

    checkbox.addEventListener('change', function() {
      if (this.checked) {
        excludedModes.add(this.value);
      } else {
        excludedModes.delete(this.value);
      }
      updateChart();
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + capitalize(mode.replace('Metropolitan ', '')))); 
    container.appendChild(label);
  });
}


function monthName(monthNumber) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[monthNumber - 1];
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
