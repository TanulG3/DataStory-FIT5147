const widthSB = document.getElementById("sunburstChart").clientWidth;
const heightSB = document.getElementById("sunburstChart").clientHeight;
const radius = Math.min(widthSB, heightSB) / 2;

const svgSB = d3.select("#sunburstChart")
  .attr("viewBox", `${-radius} ${-radius} ${2 * radius} ${2 * radius}`)
  .append("g");

// Color scale
const colorSB = d3.scaleOrdinal()
  .domain(["Summer", "Autumn", "Winter", "Spring"])
  .range(["#FDB813", "#E07A5F", "#82A3C9", "#81B29A"]);

// Tooltip
const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip-sunburst")
  .style("opacity", 0)
  .style("position", "absolute")
  .style("padding", "8px")
  .style("background", "#fff")
  .style("border", "1px solid #ccc")
  .style("border-radius", "8px")
  .style("font-size", "12px")
  .style("pointer-events", "none");

// Reset Button initially hidden
const resetButton = d3.select("#resetButton")
  .style("display", "none");

d3.csv("https://raw.githubusercontent.com/TanulG3/DataStory-FIT5147/refs/heads/main/monthly_average_patronage_by_day_type_and_by_mode.csv").then(data => {
  function monthToSeason(month) {
    if ([12, 1, 2].includes(+month)) return "Summer";
    if ([3, 4, 5].includes(+month)) return "Autumn";
    if ([6, 7, 8].includes(+month)) return "Winter";
    return "Spring";
  }

  data.forEach(d => {
    d.Pax_daily = +d.Pax_daily;
    d.Season = monthToSeason(d.Month);
  });

  // Filter MetroTrain, MetroBus, Tram
  data = data.filter(d =>
    d.Mode === 'MetroTrain' ||
    d.Mode === 'MetroBus' ||
    d.Mode === 'Tram'
  );

  const hierarchyData = d3.rollup(
    data,
    v => d3.sum(v, d => d.Pax_daily),
    d => d.Season,
    d => d.Day_type,
    d => d.Mode
  );

  function rollupToHierarchy(rollup) {
    return {
      name: "Patronage",
      children: Array.from(rollup, ([key, value]) =>
        value instanceof Map
          ? { name: key, children: rollupToHierarchy(value).children }
          : { name: key, value: value }
      )
    };
  }

  const root = d3.hierarchy(rollupToHierarchy(hierarchyData))
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);

  root.each(d => d.current = d);

  const partition = d3.partition()
    .size([2 * Math.PI, radius]);

  partition(root);

  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .innerRadius(d => d.y0)
    .outerRadius(d => d.y1);

  const g = svgSB.append("g");

  const path = g.selectAll("path")
    .data(root.descendants())
    .join("path")
    .attr("d", arc)
    .attr("fill", d => {
  if (d.depth === 0) return "#EAEAEA";   // Neutral grey center
  while (d.depth > 1) d = d.parent;
  return colorSB(d.data.name);
})

    .attr("stroke", "#fff")
    .on("mouseover", function(event, d) {
        tooltip.style("opacity", 1);
        const ancestors = d.ancestors().reverse().slice(1);
        const pathStr = ancestors.map(a => a.data.name).join(" → ");

        // Calculate percentage of parent
        const parentValue = d.parent ? d.parent.value : d.value;  // root node
        const percentage = parentValue ? (d.value / parentValue) * 100 : 100;
        
        tooltip.html(`
            <strong>Path:</strong> ${pathStr}<br>
            <strong>Patronage:</strong> ${d.value.toLocaleString()}<br>
            <strong>Percentage:</strong> ${percentage.toFixed(1)}%
        `);
        })
    .on("mousemove", function(event) {
      tooltip.style("left", (event.pageX + 10) + "px")
             .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0);
    })
    .on("click", clicked);

  const label = g.selectAll("text")
    .data(root.descendants().filter(d => d.depth > 0)) 
    .join("text")
    .attr("dy", "0.35em")
    .attr("fill-opacity", d => +labelVisible(d))
    .attr("transform", d => labelTransform(d))
    .text(d => {
      if (d.depth === 1) return d.data.name;
      if (d.depth === 2) {
        if (d.data.name === 'Normal Weekday') return 'N-Weekday';
        if (d.data.name === 'School Holiday Weekday') return 'SH-Weekday';
        return d.data.name;
      }
      if (d.depth === 3) {
        if (d.data.name.includes('MetroTrain')) return 'M-Train';
        if (d.data.name.includes('MetroBus')) return 'M-Bus';
        if (d.data.name.includes('Tram')) return 'Tram';
        return d.data.name.length > 7 ? d.data.name.slice(0, 7) : d.data.name;
      }
      return d.data.name;
    })
    .style("font-size", d => d.depth === 1 ? "18px" : d.depth === 2 ? "12px" : "9px")  // Initial
    .style("font-weight", d => d.depth === 1 ? "bold" : "normal")
    .style("text-anchor", "middle");

function clicked(event, p) {
  const isRoot = (p === root);

  resetButton.style("display", isRoot ? "none" : "inline-block");

  root.each(d => d.target = {
    x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
    x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
    y0: Math.max(0, d.y0 - p.y0),
    y1: Math.max(0, d.y1 - p.y0)
  });

  const t = g.transition().duration(750);

  path.transition(t)
    .tween("data", d => {
      const i = d3.interpolate(d.current, d.target);
      return t => d.current = i(t);
    })
    .attrTween("d", d => () => arc(d.current));

  g.selectAll("text").remove();

  t.end().then(() => {
    g.selectAll("text")
      .data(p.descendants().filter(d => labelVisible(d.current)))  // <---- only subtree!
      .join("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("transform", d => labelTransform(d.current))
      .text(d => {
        if (d.depth === 1) return d.data.name;
        if (d.depth === 2) {
          if (d.data.name === 'Normal Weekday') return 'N-Weekday';
          if (d.data.name === 'School Holiday Weekday') return 'SH-Weekday';
          return d.data.name;
        }
        if (d.depth === 3) {
          if (d.data.name.includes('MetroTrain')) return 'M-Train';
          if (d.data.name.includes('MetroBus')) return 'M-Bus';
          if (d.data.name.includes('Tram')) return 'Tram';
          return d.data.name.length > 7 ? d.data.name.slice(0, 7) : d.data.name;
        }
        return d.data.name;
      })
      .style("font-size", d => {
    if (d.depth === 1) {
      if (!p || p.depth === 0) return "24px";  // Reset or Root Zoom: Big Seasons
      return "28px";                          // Zoomed into Season
    } else if (d.depth === 2) {
      if (!p || p.depth === 0) return "12px";  // Normal View
      return p.depth === 1 ? "14px" : "18px";  // Zoomed-in makes it bigger
    } else if (d.depth === 3) {
      if (!p || p.depth === 0) return "10px";  // Normal View small
      return p.depth === 2 ? "14px" : "20px";  // Mode bigger when deep zoom
    }
  })
  .style("font-weight", d => {
    if (d.depth === 1 && (!p || p.depth <= 1)) return "bold";  // Season Bold always
    if (d.depth === 2 && p && p.depth >= 1) return "bold";     // Day-type Bold only when zoomed
    return "normal";
  });
  });
}



  function labelVisible(d) {
    const angle = d.x1 - d.x0;
    if (d.depth === 1 && angle < 0.2) return false;
    if (d.depth === 2 && angle < 0.05) return false;
    if (d.depth === 3 && angle < 0.02) return false;
    return d.y1 <= radius && d.y0 >= 0;
  }

  function labelTransform(d) {
    const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
    const y = (d.y0 + d.y1) / 2;
     if ((d.x1 - d.x0) > (Math.PI * 1.5)) {
    return `translate(0, ${y-20})`;  // <- shift *below* the center
  }
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }

  resetButton.on("click", () => clicked(null, root));
});
