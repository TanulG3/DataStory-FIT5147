// radars.js

async function loadExcelFile(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  return workbook;
}

function parseIncomeData(workbook) {
  const incomeSheet = workbook.Sheets[workbook.SheetNames[6]];
  const jsonData = XLSX.utils.sheet_to_json(incomeSheet, { header: 1, defval: null });

  const headerRowIndex = 9;
  const dataStartRowIndex = 10;
  const dataEndRowIndex = 24;

  const headers = jsonData[headerRowIndex];
  
  const normalizedHeaders = headers.map(h => h ? h.replace(/\s+/g, ' ').trim() : '');

  const selectedModes = [
    'driver',
    'passenger',
    'Train',
    'Bus',
    'Ferry',
    'light rail',
    'service'
  ];

  const selectedIndexes = selectedModes.map(mode => 
    normalizedHeaders.findIndex(header => header.toLowerCase().includes(mode.toLowerCase()))
  );

  const incomeRanges = [];
  const rawValues = {};  // <-- store raw counts

  selectedModes.forEach(mode => {
    rawValues[mode] = [];
  });

  for (let i = dataStartRowIndex; i <= dataEndRowIndex; i++) {
    const row = jsonData[i];
    if (!row) continue;

    const incomeRange = row[0];
    if (!incomeRange) continue;

    incomeRanges.push(incomeRange);

    selectedModes.forEach((mode, idx) => {
      const colIndex = selectedIndexes[idx];
      const value = row[colIndex] !== null ? +row[colIndex] : 0;
      rawValues[mode].push(value);
    });
  }

  return { incomeRanges, rawValues, allModes: selectedModes };
}

function computeModeData(rawValues, activeModes) {
  const modeData = {};
  const numIncomeRanges = rawValues[activeModes[0]].length;

  for (let mode of activeModes) {
    modeData[mode] = [];
  }

  for (let i = 0; i < numIncomeRanges; i++) {
    let total = 0;
    activeModes.forEach(mode => {
      total += rawValues[mode][i];
    });

    activeModes.forEach(mode => {
      const value = rawValues[mode][i];
      const proportion = total === 0 ? 0 : (value / total);
      modeData[mode].push(proportion);
    });
  }

  return modeData;
}




function createIncomeRadar(containerId, incomeRanges, modeData, activeModes) {
  
  const width = 800;
  const height = 700;
  const margin = 80;
  const radius = Math.min(width, height) / 2 - margin;

  const svg = d3.select(containerId)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const chartGroup = svg.append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  const angleSlice = (2 * Math.PI) / incomeRanges.length;

  const maxValue = 1; // because proportions are 0 to 1

  const rScale = d3.scaleLinear()
    .range([0, radius])
    .domain([0, maxValue]);

  // Draw grid circles
  const levels = 5;
  for (let level = 0; level < levels; level++) {
    const r = radius * ((level + 1) / levels);
    chartGroup.append("circle")
      .attr("r", r)
      .attr("fill", "none")
      .attr("stroke", "#CDCDCD")
      .attr("stroke-opacity", 0.5);
  }


  // Draw radial gridlines
  incomeRanges.forEach((range, i) => {
    const angle = i * angleSlice;
    const x = rScale(maxValue) * Math.sin(angle);
    const y = -rScale(maxValue) * Math.cos(angle);

    chartGroup.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", x)
      .attr("y2", y)
      .attr("stroke", "#CDCDCD")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.5);
  });

  // Draw axis labels
  incomeRanges.forEach((range, i) => {
    const angle = i * angleSlice;
    const x = rScale(maxValue * 1.15) * Math.sin(angle);  // 1.15 → push further out
    const y = -rScale(maxValue * 1.15) * Math.cos(angle);

    chartGroup.append("text")
      .attr("x", x)
      .attr("y", y)
      .text(range)
      .style("font-size", "13px")
      .style("font-weight", "bold")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em");
  });

  const radarLine = d3.lineRadial()
    .radius(d => rScale(d))
    .angle((d, i) => i * angleSlice)
    .curve(d3.curveLinearClosed);

    const fixedColors = {
        'Train': '#1f77b4',         // blue
        'Bus': '#2ca02c',           // green
        'Ferry': '#9467bd',         // violet
        'light rail': '#ff7f0e',    // orange
        'service': '#8c564b',       // brownish (Taxi/ride-share service)
        'driver': '#ff6666',        // light red
        'passenger': '#ab7ac7'      // purple
      };

  const color = d => fixedColors[d]; 
  // Tooltip div (hidden initially)
  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  tooltip.append("div")
    .attr("class", "speech-bubble");


  // Draw each mode
  activeModes.forEach((mode, idx) => {
    const values = modeData[mode];

    chartGroup.append("path")
      .datum(values)
      .attr("d", radarLine)
      .attr("fill", "none")
      .attr("stroke", color(mode))
      .attr("stroke-width", 2)
      .attr("opacity", 0.8);

   chartGroup.selectAll(`.radar-point-${idx}`)
      .data(values)
      .enter()
      .append("circle")
      .attr("cx", (d, i) => rScale(d) * Math.sin(i * angleSlice))
      .attr("cy", (d, i) => -rScale(d) * Math.cos(i * angleSlice))
      .attr("r", 3)
      .attr("fill", color(mode))
      .on("mouseover", function(event, d, i) {
          tooltip.transition()
            .duration(200)
            .style("opacity", 1);
          tooltip.select(".speech-bubble").html(
            `<strong>Mode:</strong> ${mode}<br/>
            <strong>Proportion:</strong> ${(d * 100).toFixed(1)}%`
          );
      })

      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX-100) + "px")
          .style("top", (event.pageY- 60) + "px");
      })
      .on("mouseout", function() {
        tooltip.transition()
          .duration(500)
          .style("opacity", 0);
      })
      .each(function(d, i) { 
        // Store datum index for tooltip
        d3.select(this).datumIndex = i;
      });
  });

  d3.select("#radar-legend-container").html("");
  // Legend container
  const legend = d3.select("#radar-legend-container")
    .append("svg")
    .attr("width", 200) // Legend width
    .attr("height", 50 + activeModes.length * 25 + 40)

  // Legend title
  legend.append("text")
    .attr("x", 0)
    .attr("y", 20)
    .text("Legend")
    .style("font-size", "24px")
    .style("font-weight", "bold")
    .attr("text-anchor", "start");

  const prettyLabels = {
  'driver': 'Car, as driver',
  'passenger': 'Car, as passenger',
  'Train': 'Train',
  'Bus': 'Bus',
  'Ferry': 'Ferry',
  'light rail': 'Tram',
  'service': 'Taxi/ E-hailing'
};

  // Legend items
  activeModes.forEach((mode, i) => {
    const legendRow = legend.append("g")
      .attr("transform", `translate(0, ${40 + i * 25})`);

    legendRow.append("rect")
      .attr("width", 16)
      .attr("height", 16)
      .attr("fill", color(mode));

    legendRow.append("text")
      .attr("x", 24)
      .attr("y", 12)
      .text(prettyLabels[mode])
      .style("font-size", "14px")
      .attr("text-anchor", "start")
      .style("font-weight", "bold")
      .attr("alignment-baseline", "middle");
  });
  const zoom = d3.zoom()
  .scaleExtent([1, 5])
  .on('zoom', (event) => {
    chartGroup.attr('transform', event.transform);
  });

svg.call(zoom);

d3.select('#zoom-in').on('click', function() {
  svg.transition().call(zoom.scaleBy, 1.2);
});

d3.select('#zoom-out').on('click', function() {
  svg.transition().call(zoom.scaleBy, 0.8);
});

}


let isCarsExcluded = false;
let rawValues, incomeRanges, allModes;

loadExcelFile('Transport data summary - first and second release.xlsx')
  .then(workbook => {
    const parsedData = parseIncomeData(workbook);
    incomeRanges = parsedData.incomeRanges;
    rawValues = parsedData.rawValues;
    allModes = parsedData.allModes;

    const initialModeData = computeModeData(rawValues, allModes);
    createIncomeRadar('#income-radar', incomeRanges, initialModeData, allModes);
  });

d3.select('#toggle-car-filter').on('click', function() {
  isCarsExcluded = !isCarsExcluded;
  
  d3.select("#income-radar svg").remove();  

  const activeModes = isCarsExcluded ? allModes.filter(m => m !== 'driver' && m !== 'passenger' && m !== 'service') : allModes;
  const updatedModeData = computeModeData(rawValues, activeModes);

  createIncomeRadar('#income-radar', incomeRanges, updatedModeData, activeModes);

  d3.select(this).text(isCarsExcluded ? "Include Cars" : "Exclude Cars");
});

