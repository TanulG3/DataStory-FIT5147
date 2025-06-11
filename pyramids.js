// Dimensions and layout settings
const marginPyramids = { top: 50, right: 100, bottom: 80, left: 100 };
const widthPyramids = 500 - marginPyramids.left - marginPyramids.right;
const heightPyramids = 750 - marginPyramids.top - marginPyramids.bottom;


// Categorizing transport modes
const transportCategories = {
  car: ['car, as driver', 'car, as passenger', 'taxi/ride-share service'],
  public: ['train', 'bus', 'tram/light rail']
};

// State tracking
let currentMode = 'absolute';
let viewMode = 'split'; // split | total
let maleData = [], femaleData = [], personsData = [];

// Load and parse Excel file
loadExcelFile('https://raw.githubusercontent.com/TanulG3/DataStory-FIT5147/refs/heads/main/Transport%20data%20summary%20-%20first%20and%20second%20release.xlsx').then(data => {
  maleData = parseMaleData(data);
  femaleData = parseFemaleData(data);
  personsData = parsePersonsData(data);

  createPyramid('#pyramid-male', 'Male', maleData);
  createPyramid('#pyramid-female', 'Female', femaleData);
});

// Toggle Percentage / Absolute View
document.getElementById('toggleModeButton').addEventListener('click', () => {
  currentMode = currentMode === 'absolute' ? 'percentage' : 'absolute';
  document.getElementById('toggleModeButton').innerText = currentMode === 'absolute' 
    ? 'Switch to Percentage View' 
    : 'Switch to Absolute View';
  updatePyramids();
});

// Toggle Gender / Persons View
document.getElementById('toggleGenderButton').addEventListener('click', () => {
  viewMode = viewMode === 'split' ? 'total' : 'split';
  document.getElementById('toggleGenderButton').innerText = viewMode === 'split' 
    ? 'Switch to Total View' 
    : 'Switch to Split Gender View';
  updatePyramids();
});

// Redraw pyramids based on current view and mode
function updatePyramids() {
  // Clear all three containers
  d3.selectAll('#pyramid-male > *, #pyramid-female > *, #pyramid-persons > *').remove();

  // Extra step: also clear HTML if switching to total view
  if (viewMode === 'split') {
    document.getElementById('pyramid-male').style.display = 'block';
    document.getElementById('pyramid-female').style.display = 'block';
    document.getElementById('pyramid-persons').style.display = 'none';
    
    // Recreate Male Pyramid + Description
    createPyramid('#pyramid-male', 'Male', maleData);
    addDescription('pyramid-male', 'Male Transport Usage Patterns (2021 only)', `
      Among males, car usage is predominant across all age groups, with the 25–34 years and 35–44 years brackets showing the highest car patronage. 
      Public transport usage, although significantly lower than car usage, is more stable across the younger age groups, particularly 15–24 years.
      A sharp decline in car and public transport usage is visible after 55 years, reflecting potential changes in mobility needs or preferences with aging.
      Notably, males have car usage distributed between ‘car as driver’ and ‘car as passenger’ categories, alongside significant taxi and ride-share services among the younger groups.
    `);

    // Recreate Female Pyramid + Description
    createPyramid('#pyramid-female', 'Female', femaleData);
    addDescription('pyramid-female', 'Female Transport Usage Patterns (2021 only)', `
      Female transport usage patterns show a different distribution compared to males. 
      The 15–24 years group has a strong presence of car passengers and public transport users. 
      Interestingly, the dataset for females does not include the ‘car as driver’ category, highlighting a potential disparity in driving habits between genders.
      Public transport usage among females is notably high in the 25–34 years and 35–44 years groups, suggesting a strong dependency on accessible transit options for working-age populations. 
      Car passenger and ride-share service use is higher among younger females compared to older groups.
    `);
  } else {
    document.getElementById('pyramid-male').style.display = 'none';
    document.getElementById('pyramid-female').style.display = 'none';
    document.getElementById('pyramid-persons').style.display = 'block';
    
    createPyramid('#pyramid-persons', 'Persons', personsData, true); // Centered
    
    addDescription('pyramid-persons', 'Overall Transport Usage Patterns (2021 only)', `
      The overall transport usage patterns reflect combined trends of males and females across age groups.
      Car usage is dominant, with a strong showing in the working-age population (25–54 years),
      while public transport usage shows steady but comparatively lower patronage across all age brackets.
      <br><br>
      The data indicates that younger (15–24 years) and mid-age (25–44 years) individuals are more likely to utilize public transport, 
      whereas older groups (55 years and above) show a decline in both car and public transport usage, 
      suggesting reduced mobility or a preference for alternative transport means.
    `);
  }
}

// Helper function to add description below the pyramid
function addDescription(containerId, title, paragraph) {
  const container = document.getElementById(containerId);
  
  const descDiv = document.createElement('div');
  descDiv.className = 'pyramid-description'; // (You can style this in your CSS)

  descDiv.innerHTML = `
    <h3>${title}</h3>
    <p>${paragraph}</p>
  `;

  container.appendChild(descDiv);
}

// Reads Excel data into JSON
function loadExcelFile(url) {
  return fetch(url)
    .then(response => response.arrayBuffer())
    .then(ab => {
      const workbook = XLSX.read(ab, { type: 'array' });
      const sheetName = workbook.SheetNames[4];
      const sheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(sheet, { header: 1 });
    });
}

// Parses male data block
function parseMaleData(rawData) {
  const ageGroups = [
    '15-24 years', '25-34 years', '35-44 years',
    '45-54 years', '55-64 years', '65-74 years', '75 years and over'
  ];
  const maleModes = [
    'train', 'bus', 'ferry', 'tram/light rail', 'taxi/ride-share service',
    'car, as driver', 'car, as passenger', 'truck', 'motorbike/scooter',
    'bicycle', 'other mode', 'walked only', 'worked at home',
    'did not go to work', 'not stated'
  ];

  const males = [];
  for (const row of rawData) {
    if (!row || row.length < 8) continue;
    let [mode, ...counts] = row;
    if (typeof mode === 'string') {
      mode = mode.trim().toLowerCase();
      if (mode === 'total') break;
      if (maleModes.includes(mode)) {
        const relevantCounts = counts.slice(0, 7);
        ageGroups.forEach((age, i) => {
          if (!isNaN(relevantCounts[i])) {
            males.push({ Gender: 'Male', Mode: mode, Age: age, Count: +relevantCounts[i] });
          }
        });
      }
    }
  }
  return males;
}

// Parses female data block
function parseFemaleData(rawData) {
  const ageGroups = [
    '15-24 years', '25-34 years', '35-44 years',
    '45-54 years', '55-64 years', '65-74 years', '75 years and over'
  ];
  const femaleModes = [
    'train', 'bus', 'ferry', 'tram/light rail', 'taxi/ride-share service',
    'car, as passenger', 'truck', 'motorbike/scooter',
    'bicycle', 'other mode', 'walked only', 'worked at home'
  ];

  const females = [];
  let foundMaleTotal = false;
  let parsingFemale = false;

  for (const row of rawData) {
    if (!row || row.length < 8) continue;
    let [mode, ...counts] = row;
    if (typeof mode === 'string') {
      mode = mode.trim().toLowerCase();
      if (mode === 'total' && !foundMaleTotal) {
        foundMaleTotal = true; continue;
      }
      if (foundMaleTotal && mode === 'train') parsingFemale = true;
      if (parsingFemale) {
        if (mode === 'total') break;
        if (femaleModes.includes(mode)) {
          const relevantCounts = counts.slice(0, 7);
          ageGroups.forEach((age, i) => {
            if (!isNaN(relevantCounts[i])) {
              females.push({ Gender: 'Female', Mode: mode, Age: age, Count: +relevantCounts[i] });
            }
          });
        }
      }
    }
  }
  return females;
}

// Parses persons (total) data block
function parsePersonsData(rawData) {
  const ageGroups = [
    '15-24 years', '25-34 years', '35-44 years',
    '45-54 years', '55-64 years', '65-74 years', '75 years and over'
  ];
  const personsModes = [
    'train', 'bus', 'ferry', 'tram/light rail', 'taxi/ride-share service',
    'car, as driver', 'car, as passenger', 'truck', 'motorbike/scooter',
    'bicycle', 'other mode', 'walked only', 'worked at home',
    'did not go to work', 'not stated'
  ];

  const persons = [];
  let totalCounter = 0;
  let parsingPersons = false;

  for (const row of rawData) {
    if (!row || row.length < 8) continue;
    let [mode, ...counts] = row;
    if (typeof mode === 'string') {
      mode = mode.trim().toLowerCase();

      if (mode === 'total') {
        totalCounter++;
        if (totalCounter === 2) {
          parsingPersons = true; // After second total we start persons
          continue;
        } else if (totalCounter === 3) {
          break; // After third total, persons block ends
        }
      }

      if (parsingPersons && personsModes.includes(mode)) {
        const relevantCounts = counts.slice(0, 7);
        ageGroups.forEach((age, i) => {
          if (!isNaN(relevantCounts[i])) {
            persons.push({ Gender: 'Persons', Mode: mode, Age: age, Count: +relevantCounts[i] });
          }
        });
      }
    }
  }
  return persons;
}

// Core chart drawing function
function createPyramid(containerId, gender, data, center = false) {
  const svg = d3.select(containerId)
    .append("svg")
    .attr("width", widthPyramids * 2 + marginPyramids.left + marginPyramids.right + (center ? 300 : 100)) // bigger if center
    .attr("height", heightPyramids + marginPyramids.top + marginPyramids.bottom)
    .append("g")
    .attr("transform", `translate(${marginPyramids.left},${marginPyramids.top})`);

  const filteredData = data.filter(d => d.Gender === gender);
  const ageGroups = [...new Set(filteredData.map(d => d.Age))].sort();

  const dataset = [];
  ageGroups.forEach(age => {
    const ageData = filteredData.filter(d => d.Age === age);
    const carModes = ageData.filter(d => transportCategories.car.includes(d.Mode));
    const publicModes = ageData.filter(d => transportCategories.public.includes(d.Mode));

    const carBreakdown = carModes.reduce((acc, d) => {
      acc[d.Mode] = (acc[d.Mode] || 0) + d.Count;
      return acc;
    }, {});

    const publicBreakdown = publicModes.reduce((acc, d) => {
      acc[d.Mode] = (acc[d.Mode] || 0) + d.Count;
      return acc;
    }, {});

    const carTotal = d3.sum(carModes, d => d.Count);
    const publicTotal = d3.sum(publicModes, d => d.Count);

    dataset.push({ age: age, car: carTotal, carBreakdown: carBreakdown, public: publicTotal, publicBreakdown: publicBreakdown });
  });

  // Handle percentages if needed
  let xMax = d3.max(dataset, d => Math.max(d.car, d.public));
  if (currentMode === 'percentage') {
    xMax = 100;
    dataset.forEach(d => {
      const total = d.car + d.public;
      d.carPerc = total ? (d.car / total) * 100 : 0;
      d.publicPerc = total ? (d.public / total) * 100 : 0;
    });
  }

  // Scales
  const x = d3.scaleLinear().domain([0, xMax]).range([0, widthPyramids]).nice();
  const y = d3.scaleBand().domain(ageGroups).range([0, heightPyramids]).padding(0.1);

  // Tooltip
  const tooltip = d3.select("body").append("div").attr("class", "tooltip-pyramid")
    .style("position", "absolute").style("background", "#fff").style("padding", "8px 12px")
    .style("border", "1px solid #ccc").style("border-radius", "8px").style("pointer-events", "none").style("opacity", 0);

  // Car bars (left)
  svg.append("g")
    .selectAll("rect.left")
    .data(dataset)
    .enter().append("rect")
    .attr("x", d => widthPyramids - x(currentMode === 'percentage' ? d.carPerc : d.car))
    .attr("y", d => y(d.age))
    .attr("width", d => x(currentMode === 'percentage' ? d.carPerc : d.car))
    .attr("height", y.bandwidth())
    .attr("fill", "#1f77b4")
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html(buildTooltipContent(d, 'car')).style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px");
    }).on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));

  // Public bars (right)
  svg.append("g")
    .selectAll("rect.right")
    .data(dataset)
    .enter().append("rect")
    .attr("x", widthPyramids + marginPyramids.right)
    .attr("y", d => y(d.age))
    .attr("width", d => x(currentMode === 'percentage' ? d.publicPerc : d.public))
    .attr("height", y.bandwidth())
    .attr("fill", "#9467bd")
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip.html(buildTooltipContent(d, 'public')).style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px");
    }).on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));

  // Age axis in the middle
  svg.append("g")
    .attr("transform", `translate(${widthPyramids + marginPyramids.right / 2 + 10},0)`)
    .call(d3.axisLeft(y))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").remove())
    .selectAll("text")
    .text(d => d === "75 years and over" ? "75 years +" : d)
    .style("text-anchor", "middle").style("font-size", "14px").style("font-weight", "bold");

  // Title
  svg.append("text")
    .attr("x", (widthPyramids * 2 + marginPyramids.left + marginPyramids.right) / 2)
    .attr("y", -20)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .text(`${gender} Population Pyramid`);
}

// Title
function buildTooltipContent(d, type) {
  const breakdown = type === 'car' ? d.carBreakdown : d.publicBreakdown;
  const total = type === 'car' ? (currentMode === 'percentage' ? d.carPerc.toFixed(1) + '%' : d.car) :
                                 (currentMode === 'percentage' ? d.publicPerc.toFixed(1) + '%' : d.public);
  let html = `<strong>Age:</strong> ${d.age}<br>`;
  html += `<strong>${type === 'car' ? 'Car' : 'Public'} Users:</strong> ${total}<br>`;
  for (const [mode, count] of Object.entries(breakdown)) {
    html += `<ul style="margin: 2px 0; padding-left: 20px;"><li>${mode}: ${count}</li></ul>`;
  }
  return html;
}
