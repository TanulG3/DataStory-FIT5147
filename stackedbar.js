const marginBar = { top: 60, right: 30, bottom: 50, left: 200 },
      widthBar = 1000 - marginBar.left - marginBar.right,
      heightBar = 600 - marginBar.top - marginBar.bottom;

const svgBar = d3.select("#stackedBarChart")
  .attr("width", widthBar + marginBar.left + marginBar.right)
  .attr("height", heightBar + marginBar.top + marginBar.bottom)
  .append("g")
  .attr("transform", `translate(${marginBar.left},${marginBar.top})`);

let absoluteData = [], percentageData = [], isPercentageView = false;
let yBar, xBar, colorBar, stackedGroups, groups, subgroups;
let excludedModesBar = new Set();


async function loadBarData() {
  const file = await fetch('https://raw.githubusercontent.com/TanulG3/DataStory-FIT5147/refs/heads/main/Transport%20data%20summary%20-%20first%20and%20second%20release.xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const sheetName = workbook.SheetNames[5]; // Table 5
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  const headerRow1 = jsonData[8];
  const headerRow2 = jsonData[9];

  const headers = headerRow2.map((h2, i) => {
    const h1 = headerRow1[i];
    return (h1 ? h1.trim() + ' ' : '') + (h2 ? h2.trim() : '');
  });

  const modeNames = [
    "Train", 
    "Bus",
    "Tram/light rail",
    "Car, as driver",
    "Car, as passenger"
  ];

  const vehicleHeaders = headers.slice(1, 6); // No, One, Two, Three, Four or more

  const dataRows = jsonData.slice(10, 24); // Rows with data

  const filteredData = dataRows.filter(row => modeNames.includes(row[0]));

  absoluteData = vehicleHeaders.map((vehicle, i) => {
    const row = { vehicles: vehicle };
    modeNames.forEach(mode => {
      row[mode] = +filteredData.find(d => d[0] === mode)[i + 1];
    });
    return row;
  });

  // Percentage data
  percentageData = absoluteData.map(d => {
    const total = modeNames.reduce((sum, mode) => sum + d[mode], 0);
    const newRow = { vehicles: d.vehicles };
    modeNames.forEach(mode => {
      newRow[mode] = total > 0 ? d[mode] / total : 0;
    });
    return newRow;
  });

  subgroups = modeNames;
  groups = absoluteData.map(d => d.vehicles);

  colorBar = d3.scaleOrdinal()
    .domain(subgroups)
    .range(d3.schemeCategory10);

  drawBars();
  drawLegend();
  generateModeCheckboxes();
}

function generateModeCheckboxes() {
  const container = d3.select("#stackedModeCheckboxes");
  container.html(''); // Clear old

  subgroups.forEach(mode => {
    const label = container.append('label').style('margin-right', '10px');

    label.append('input')
      .attr('type', 'checkbox')
      .attr('value', mode)
      .on('change', function() {
        if (this.checked) {
          excludedModesBar.add(this.value);
        } else {
          excludedModesBar.delete(this.value);
        }
        drawBars();
      });

    label.append('span')
      .text(` ${mode}`);
  });
}

function drawLegend() {
  const legendContainer = d3.select("#stackedLegendList");
  legendContainer.html(''); // clear old

  subgroups.forEach(mode => {
    legendContainer.append('li')
      .style('color', colorBar(mode))  // Legend color matches chart
      .text(mode);
  });
}

function recalculatePercentages() {
  return absoluteData.map(d => {
    const includedKeys = subgroups.filter(m => !excludedModesBar.has(m));
    const total = includedKeys.reduce((sum, mode) => sum + d[mode], 0);
    const newRow = { vehicles: d.vehicles };
    includedKeys.forEach(mode => {
      newRow[mode] = total > 0 ? d[mode] / total : 0;
    });
    return newRow;
  });
}

function recalculateAbsoluteData() {
  return absoluteData.map(d => {
    const includedKeys = subgroups.filter(m => !excludedModesBar.has(m));
    const newRow = { vehicles: d.vehicles };
    includedKeys.forEach(mode => {
      newRow[mode] = d[mode];  // Just copy values
    });
    return newRow;
  });
}


function drawBars() {
  svgBar.selectAll("*").remove(); // clear

  const data = (isPercentageView ? recalculatePercentages() : recalculateAbsoluteData());

  const stack = d3.stack().keys(subgroups.filter(d => !excludedModesBar.has(d)));

  stackedGroups = stack(data);

  yBar = d3.scaleBand()
    .domain(groups)
    .range([0, heightBar])
    .padding(0.3);

  xBar = d3.scaleLinear()
    xBar.domain([
  0,
  isPercentageView
    ? 1
    : d3.max(data, d => 
        subgroups.filter(k => !excludedModesBar.has(k)).reduce((sum, k) => sum + (d[k] || 0), 0)
      )
])
    .nice()
    .range([0, widthBar]);

  // Axis
  svgBar.append("g")
    .call(d3.axisLeft(yBar).tickSize(0))
    .selectAll("text")
    .style("font-size", "14px");

  svgBar.append("g")
    .attr("transform", `translate(0,${heightBar})`)
    .call(d3.axisBottom(xBar).ticks(5).tickFormat(isPercentageView ? d3.format(".0%") : d3.format(".2s")))
    .selectAll("text")
    .style("font-size", "14px");

  // Tooltip
  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  tooltip.append("div")
    .attr("class", "speech-bubble");

  // Bars
  svgBar.append("g")
    .selectAll("g")
    .data(stackedGroups)
    .join("g")
    .attr("fill", d => colorBar(d.key))  // <--- Updated here too
    .selectAll("rect")
    .data(d => d)
    .join("rect")
      .attr("y", d => yBar(d.data.vehicles))
      .attr("x", d => xBar(d[0]))
      .attr("height", yBar.bandwidth())
      .attr("width", d => xBar(d[1]) - xBar(d[0]))
      .on("mouseover", function(event, d) {
        const subgroupName = d3.select(this.parentNode).datum().key;
        tooltip.transition()
          .duration(200)
          .style("opacity", 0.9);
        tooltip.select(".speech-bubble").html(
          `<strong>Mode:</strong> ${subgroupName}<br/>
           <strong>${isPercentageView ? 'Percentage' : 'Patronage'}:</strong> ${
             isPercentageView ? (d.data[subgroupName] * 100).toFixed(1) + '%' : d.data[subgroupName].toLocaleString()
          }`
        );
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX -100) + "px")
          .style("top", (event.pageY - 70) + "px");
      })
      .on("mouseout", function() {
        tooltip.transition()
          .duration(500)
          .style("opacity", 0);
      });

  // Axis Labels
  svgBar.append("text")
    .attr("text-anchor", "end")
    .attr("x", widthBar)
    .attr("y", heightBar + 40)
    .text(isPercentageView ? "Percentage" : "Patronage Amount")
    .style("font-size", "20px")
    .style("font-weight", "bold");

  svgBar.append("text")
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-90)")
    .attr("y", -marginBar.left + 20)
    .attr("x", -marginBar.top)
    .text("Number of Vehicles")
    .style("font-size", "20px")
    .style("font-weight", "bold");
}

d3.select("#stackedToggleView").on("click", function() {
  isPercentageView = !isPercentageView;
  drawBars();
  d3.select(this).text(isPercentageView ? "Switch to Absolute View" : "Switch to Percentage View");
});


loadBarData();