import { addPinpoint, clearPinpoints } from "./pshirke1_map_story.js"

function plot_chart1(svg, width, height){
        const projection = d3.geoMercator()
            .center([35, 31])
            .scale(1000)
            .translate([width / 2, height / 2]);
            
        const path = d3.geoPath()
            .projection(projection);
            
        const graticule = d3.geoGraticule();
        
        svg.append("path")
            .datum({type: "Sphere"})
            .attr("class", "sphere")
            .attr("d", path);
            
        svg.append("path")
            .datum(graticule)
            .attr("class", "graticule")
            .attr("d", path);
            
        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);
            
        d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
            .then(function(data) {
                const countries = topojson.feature(data, data.objects.countries);
                
                svg.selectAll("path.country")
                    .data(countries.features)
                    .enter()
                    .append("path")
                    .attr("class", "country")
                    .attr("d", path)
                    .on("mouseover", function(event, d) {
                        tooltip.transition()
                            .duration(200)
                            .style("opacity", .9);
                        tooltip.html(d.properties.name)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 28) + "px");
                    })
                    .on("mouseout", function() {
                        tooltip.transition()
                            .duration(500)
                            .style("opacity", 0);
                    })
                    .on("click", function(event, d) {
                        console.log(event, d);
                        const country = d.properties.name;
                    });
                    
                function addConflictPoints(conflictData) {
                    svg.selectAll("circle")
                        .data(conflictData)
                        .enter()
                        .append("circle")
                        .attr("cx", d => projection([d.longitude, d.latitude])[0])
                        .attr("cy", d => projection([d.longitude, d.latitude])[1])
                        .attr("r", 3)
                        .attr("fill", "red")
                        .attr("opacity", 0.6)
                        .on("mouseover", function(event, d) {
                            tooltip.transition()
                                .duration(200)
                                .style("opacity", .9);
                            tooltip.html(`Event: ${d.event_type}<br/>Location: ${d.location}`)
                                .style("left", (event.pageX + 10) + "px")
                                .style("top", (event.pageY - 28) + "px");
                        })
                        .on("mouseout", function() {
                            tooltip.transition()
                                .duration(500)
                                .style("opacity", 0);
                        });
                }
            });
}

function removeZeroRowsAndColumns(matrix) {
    const validRows = matrix.filter(row => row.some(value => value !== 0));
    
    const colsToKeep = validRows[0].map((_, colIndex) => 
        validRows.some(row => row[colIndex] !== 0)
    );
    
    return validRows.map(row => 
        row.filter((_, colIndex) => colsToKeep[colIndex])
    );
}

function buildRelationshipMatrix(data) {
    const allActors = new Set();
    data.forEach(d => {
        if (d.actor1) {
            allActors.add(d.actor1);
        }
        if (d.actor2) {
            allActors.add(d.actor2);
        }
    });
    const actorsArray = Array.from(allActors);
    
    const matrix = Array(actorsArray.length).fill(0)
        .map(() => Array(actorsArray.length).fill(0));

    const latitudes = Array(actorsArray.length).fill(0)
    .map(() => Array(actorsArray.length).fill(0));

    const longitudes = Array(actorsArray.length).fill(0)
    .map(() => Array(actorsArray.length).fill(0));

    data.forEach(d => {
        if (d.actor1 && d.actor2) {
            const source = actorsArray.indexOf(d.actor1);
            const target = actorsArray.indexOf(d.actor2);
            matrix[source][target] += 1;
            matrix[target][source] += 1;
            latitudes[target][source] = d.latitude;
            latitudes[source][target] = d.latitude;
            longitudes[target][source] = d.longitude;
            longitudes[source][target] = d.longitude;
        }
    });
    
    return {
        matrix: matrix,
        actors: actorsArray,
        latitudes: latitudes,
        longitudes: longitudes
    };
}

export function createChordDiagram(data) {
    const colors = d3.scaleOrdinal()
      .range(["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854",
        "#ffd92f", "#e5c494", "#b3b3b3", "#7fc97f", "#beaed4"]);
  
    const chartWidth = 680;
    const chartHeight = 750;
  
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const width = chartWidth + margin.left + margin.right;
    const height = chartHeight + margin.top + margin.bottom;
    const innerRadius = Math.min(width, height) * 0.24;
    const outerRadius = innerRadius * 1;
  
    let { matrix, actors, latitudes, longitudes } = buildRelationshipMatrix(data);
    console.log("matrix:", matrix, "actors:", actors);
  
    const svg = d3.select("#attackChart")
      .html("")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("border", "1px solid black");
  
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left + width / 2}, ${margin.top + height / 2})`);
  
    const chord = d3.chord()
      .padAngle(0.05)
      .sortSubgroups(d3.descending);
  
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background-color", "white")
      .style("padding", "5px")
      .style("border", "1px solid black")
      .style("border-radius", "5px")
      .style("pointer-events", "none")
      .style("opacity", 0);
  
    const chords = chord(matrix);
  
    const group = g.append("g")
      .selectAll("g")
      .data(chords.groups)
      .join("g");
  
    group.append("path")
      .attr("fill", d => colors(d.index))
      .attr("d", d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
      )
      .on("mouseover", function(event, d) {
        const totalInteractions = matrix[d.index].reduce((a, b) => a + b, 0);
        tooltip.transition()
          .duration(200)
          .style("opacity", 0.9);
        tooltip.html(`${actors[d.index]}<br/>Total Interactions: ${totalInteractions}`)
          .style("left", (event.pageX + 5) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        tooltip.transition()
          .duration(500)
          .style("opacity", 0);
      });
  
    group.append("text")
      .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
      .attr("dy", ".35em")
      .attr("transform", d => `
        rotate(${(d.angle * 180 / Math.PI - 90)})
        translate(${outerRadius + 10})
        ${d.angle > Math.PI ? "rotate(180)" : ""}
      `)
      .attr("text-anchor", d => d.angle > Math.PI ? "end" : null)
      .text((d, i) => actors[i])
      .style("font-size", "10px")
      .style("font-family", "Arial");
  
    const ribbons = g.append("g")
      .attr("fill-opacity", 0.75)
      .selectAll("path")
      .data(chords)
      .join("path")
      .attr("d", d3.ribbon().radius(innerRadius))
      .attr("fill", d => colors(d.source.index))
      .attr("stroke", "#000")
      .attr("stroke-opacity", 0.2);
  
    ribbons.on("mouseover", function(event, d) {
      ribbons.style("opacity", 0.2);
  
      d3.select(this)
        .style("opacity", 1)
        .style("stroke-width", 2);
  
      const sourceActor = actors[d.source.index];
      const targetActor = actors[d.target.index];
      const interactionCount = matrix[d.source.index][d.target.index];
  
      tooltip.transition()
        .duration(200)
        .style("opacity", 0.9);
  
      tooltip.html(
        `${sourceActor} ↔ ${targetActor}<br/>` +
        `Interactions: ${interactionCount}`
      )
        .style("left", (event.pageX + 5) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", (event.pageX + 5) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      ribbons.style("opacity", 1)
        .style("stroke-width", 1);
  
      tooltip.transition()
        .duration(500)
        .style("opacity", 0);
    })
    .on("click", function(event, d) {
      console.log("Hey", d);
      const pinpointData = data.filter((x) => {
        return (x.actor1 === actors[d.source.index] && x.actor2 === actors[d.target.index]) ||
          (x.actor2 === actors[d.source.index] && x.actor1 === actors[d.target.index]);
      });
  
      console.log(pinpointData, actors[d.source.index], actors[d.target.index]);
      clearPinpoints();
      pinpointData.forEach((entry) => {
        addPinpoint(entry.longitude, entry.latitude, "");
      });
    });
  
    return svg.node();
}