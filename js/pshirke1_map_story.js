// map_visualization.js
import { createChordDiagram } from './attackChart.js';

let middleEast_data = [];
let svg;
let width;
let height;
let projection;
let path;
let tooltip;
let eventColors;
let radiusScale;
let zoomBehavior;

// Initialize the visualization when the document loads
document.addEventListener('DOMContentLoaded', function () {
    initializeVisualization();
    console.log("initial visualization completed")
    loadData();
    console.log("Data is loaded");
    
});

// Initialize the basic visualization setup
export function initializeVisualization() {
    // Set dimensions
    width = 825;
    height = 550;
    // svg = svgInput;
    
    svg = d3.select("#main-chart") // Selects the existing SVG
    .attr("width", width)           // Optionally adjusts width
    .attr("height", height);        // Optionally adjusts height
    
    // Create projection
    projection = d3.geoMercator()
        .center([40, 28]) // Centered roughly on the Middle East
        .scale(850)
        .translate([width / 2, height / 2]);
    
    // Create path generator
    path = d3.geoPath()
        .projection(projection);
    
    // Create tooltip
    tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    
    // Define color scale for event types
    eventColors = {
        'Explosions/Remote violence': '#ff4444',
        'Battles': '#ffaa00',
        'Violence against civilians': '#cc44cc',
        'Protests': '#44aa44',
        'Riots': '#000000',
        'Strategic developments': '#4444ff'
    };
}

// Load all necessary data
export function loadData() {
    Promise.all([
        d3.csv('csv/MiddleEast_2015-2024_Sep27_sampled.csv'),
        d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
    ]).then(function (values) {
        middleEast_data = values[0];
        const worldData = values[1];
        
        // Convert string years to numbers in the dataset
        middleEast_data.forEach(d => {
            d.year = +d.year;
            d.fatalities = +d.fatalities;
            d.latitude = +d.latitude;
            d.longitude = +d.longitude;
        });
        
        // Process and visualize the data
        processData(middleEast_data);
        createMap(worldData);
        createControls();
        createLegend();
        updateVisualization(); // Initial visualization
        addZoom()
        createFatalitiesLineChart(middleEast_data)
        // loadYearlyData(2015);  // Initial bar graph load for the year 2022
    }).catch(function(error) {
        console.error("Error loading data:", error);
    });
}


// Add zoom functionality with improved controls
function addZoom() {
    // Create a zoom behavior
    // console.log("add zoom is called");
    
    zoomBehavior = d3.zoom()
        .scaleExtent([1, 8]) // Limit zoom between 1x and 8x
        .filter(event => {
            // Prevent zoom on touch and wheel events
            // Only allow programmatic zooming via buttons
            return event.type === 'wheel' ? false : 
                   event.type === 'touchstart' ? false :
                   event.type === 'touchmove' ? false :
                   event.type === 'touchend' ? false :
                   true;
        })
        .on("zoom", zoomed);

    // Add zoom buttons (same as previous implementation)
    const zoomControls = d3.select("#main-chart")
        .append("div")
        .attr("class", "zoom-controls")
        .style("position", "absolute")
        .style("top", "10px")
        .style("right", "10px")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "5px");

    // Zoom In button
    zoomControls.append("button")
        .attr("class", "btn btn-outline-secondary btn-sm")
        .text("+")
        .on("click", () => zoom(1.5));

    // Zoom Out button
    zoomControls.append("button")
        .attr("class", "btn btn-outline-secondary btn-sm")
        .text("-")
        .on("click", () => zoom(0.667));

    // Reset Zoom button
    zoomControls.append("button")
        .attr("class", "btn btn-outline-secondary btn-sm")
        .text("Reset")
        .on("click", resetZoom);

    console.log(zoomControls)

    // Apply zoom to the SVG
    svg.call(zoomBehavior)
        // Prevent default touch behaviors
        .on("touchstart", preventDefault)
        .on("touchmove", preventDefault)
        .on("touchend", preventDefault);
}

// Prevent default touch behavior
function preventDefault(event) {
    event.preventDefault();
}


// Zoom function
function zoom(zoomFactor) {
    const currentTransform = svg.node().__zoom || d3.zoomIdentity;
    
    const newScale = currentTransform.k * zoomFactor;
    const centerX = width / 2;
    const centerY = height / 2;
    
    svg.transition()
        .duration(350)
        .call(
            zoomBehavior.transform,
            d3.zoomIdentity
                .translate(centerX, centerY)
                .scale(newScale)
                .translate(-centerX, -centerY)
        );
}

// Reset zoom to original view
function resetZoom() {
    // Ensure zoomBehavior is defined before using it
    if (zoomBehavior) {
        svg.transition()
            .duration(350)
            .call(zoomBehavior.transform, d3.zoomIdentity);
    }
}

// Zoomed event handler
function zoomed(event) {
    // Update all map elements with the zoom transform
    svg.selectAll("path.country")
        .attr("transform", event.transform);

    svg.selectAll("text.country-label")
        .attr("transform", d => {
            const [x, y] = path.centroid(d);
            const transformedPoint = event.transform.apply([x, y]);
            return `translate(${transformedPoint[0]}, ${transformedPoint[1]})`;
        });

    svg.selectAll("circle")
        .attr("transform", event.transform)
        .attr("r", d => radiusScale(d.fatalities) / event.transform.k);

    // Add transformation for pinpoints
    svg.selectAll(".pinpoint")
        .attr("transform", d => {
            // If d exists (for existing data-bound elements), use its coordinates
            if (d && d.longitude && d.latitude) {
                const [x, y] = projection([d.longitude, d.latitude]);
                const transformedPoint = event.transform.apply([x, y]);
                return `translate(${transformedPoint[0]}, ${transformedPoint[1]}) scale(1/${event.transform.k})`;
            }
            // For dynamically added pinpoints
            return event.transform;
        });

    // Transform pinpoint labels similarly
    svg.selectAll(".pinpoint-label")
        .attr("transform", d => {
            if (d && d.longitude && d.latitude) {
                const [x, y] = projection([d.longitude, d.latitude]);
                const transformedPoint = event.transform.apply([x, y]);
                return `translate(${transformedPoint[0]}, ${transformedPoint[1]}) scale(1/${event.transform.k})`;
            }
            return event.transform;
        });
}

// Process the loaded data
function processData(data) {
    // Create radius scale based on fatalities
    radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(data, d => d.fatalities)])
        .range([3, 15]);
}

// Create the base map
function createMap(worldData) {
    // Create graticules
    const graticule = d3.geoGraticule();
    
    // Add sphere background
    svg.append("path")
        .datum({type: "Sphere"})
        .attr("class", "sphere")
        .attr("d", path)
        .style("fill", "#A5D6F7");  // Light blue color for water
    
    // Add graticules
    svg.append("path")
        .datum(graticule)
        .attr("class", "graticule")
        .attr("d", path)
        .style("fill", "none")
        .style("stroke", "#ddd")
        .style("stroke-width", "0.5px");
    
    // Draw countries
    const countries = topojson.feature(worldData, worldData.objects.countries);
    svg.selectAll("path.country")
        .data(countries.features)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", path)
        .style("fill", "#eee")
        .style("stroke", "#D2691E")
        .style("stroke-width", "0.5px")
        .on("mouseover", handleCountryHover)
        .on("mouseout", handleMouseOut);
    
    // Add country names
    svg.selectAll("text.country-label")
        .data(countries.features)
        .enter()
        .append("text")
        .attr("class", "country-label")
        .attr("transform", function(d) {
            // Calculate centroid for each country
            const [x, y] = path.centroid(d);
            return `translate(${x}, ${y})`;
        })
        .attr("dy", "0.35em") // Center text vertically
        .style("font-size", "8px") // Adjust font size as needed
        .style("fill", "#333") // Adjust text color as needed
        .text(function(d) {
            return d.properties.name;
        });
}

	
// Function to remove existing pinpoints and labels
export function clearPinpoints() {
    svg.selectAll(".pinpoint").remove();
    svg.selectAll(".pinpoint-label").remove();
}

export function addPinpoint(longitude, latitude, label) {
    // Ensure the function is being called and coordinates are valid
    if (!longitude || !latitude) {
        console.warn("Invalid coordinates for pinpoint:", longitude, latitude);
        return;
    }

    // Convert geographic coordinates to screen coordinates
    const [x, y] = projection([longitude, latitude]);

    // Add the pinpoint as a triangle with the coordinate data
    svg.append("g")
        .attr("class", "pinpoint")
        .datum({longitude, latitude}) // Store the original coordinates
        .attr("transform", `translate(${x}, ${y})`)
        .call(g => {
            // Create a triangle pinpoint
            g.append("path")
                .attr("d", "M 0 0 L -7 15 L 7 15 Z")
                .style("fill", "red")
                .style("stroke", "black")
                .style("stroke-width", "1px");
        });

    // Add a label near the pinpoint if provided
    if (label) {
        svg.append("text")
            .attr("class", "pinpoint-label")
            .datum({longitude, latitude}) // Store the original coordinates
            .attr("x", x + 10)
            .attr("y", y + 25)
            .style("font-size", "10px")
            .style("fill", "#000")
            .style("text-anchor", "start")
            .text(label);
    }
}


// Create control elements with improved timeline and multiple event selection
function createControls() {
    const controlsContainer = d3.select("#timeline")
        .append("div")
        .attr("class", "row align-items-center");

    // Create timeline section (left column)
    const timelineCol = controlsContainer.append("div")
        .attr("class", "col-md-6 mb-3 mb-md-0");

    // Get unique years and sort them
    const years = Array.from(new Set(middleEast_data.map(d => d.year)))
        .sort((a, b) => a - b);

    // Create year label with selected year display
    const yearLabel = timelineCol.append("div")
        .attr("class", "form-label d-flex justify-content-between align-items-center");

    yearLabel.append("span")
        .text("Select Year:");

    yearLabel.append("span")
        .attr("id", "yearValue")
        .attr("class", "badge bg-primary")
        .text(years[0]);

    // Create timeline slider
    const timelineSlider = timelineCol.append("input")
        .attr("type", "range")
        .attr("class", "form-range")
        .attr("id", "yearSlider")
        .attr("min", d3.min(years))
        .attr("max", d3.max(years))
        .attr("step", 1)
        .attr("value", years[0]);

    // Add slider event listener
    timelineSlider.on("input", function() {
        const year = +this.value;
        d3.select("#yearValue").text(year);
        updateVisualization();
        loadYearlyData(year); // Load the data for the selected year in the bar graph
    });

    // Create event types section (right column)
    const eventCol = controlsContainer.append("div")
        .attr("class", "col-md-6");

    // Create event type selection header with buttons
    const eventHeader = eventCol.append("div")
        .attr("class", "d-flex justify-content-between align-items-center mb-2");

    eventHeader.append("label")
        .attr("class", "form-label mb-0")
        .text("Select Event Types");

    const buttonGroup = eventHeader.append("div")
        .attr("class", "btn-group btn-group-sm");

    buttonGroup.append("button")
        .attr("class", "btn btn-outline-secondary btn-sm")
        .text("Select All")
        .on("click", () => {
            checkboxContainer.selectAll("input[type='checkbox']")
                .property("checked", true)
                .each(function() {
                    this.dispatchEvent(new Event('change'));
                });
            updateVisualization();
        });

    buttonGroup.append("button")
        .attr("class", "btn btn-outline-secondary btn-sm")
        .text("Clear All")
        .on("click", () => {
            checkboxContainer.selectAll("input[type='checkbox']")
                .property("checked", false)
                .each(function() {
                    this.dispatchEvent(new Event('change'));
                });
            updateVisualization();
        });

    // Create checkbox container with fixed height
    const checkboxContainer = eventCol.append("div")
        .attr("class", "event-checkboxes");

    // Add event type checkboxes
    const eventTypes = Array.from(new Set(middleEast_data.map(d => d.event_type)));

    eventTypes.forEach(eventType => {
        const checkboxWrapper = checkboxContainer.append("div")
            .attr("class", "form-check");

        const checkbox = checkboxWrapper.append("input")
            .attr("class", "form-check-input")
            .attr("type", "checkbox")
            .attr("id", `event-${eventType.replace(/[^a-zA-Z0-9]/g, '-')}`)
            .attr("value", eventType)
            .property("checked", true);

        checkboxWrapper.append("label")
            .attr("class", "form-check-label")
            .attr("for", `event-${eventType.replace(/[^a-zA-Z0-9]/g, '-')}`)
            .html(`<span class="color-dot" style="background: ${eventColors[eventType]}"></span> ${eventType}`);

        // Add change event listener to each checkbox
        checkbox.on("change", () => {
            updateVisualization();
        });
    });

    // Add necessary CSS
    const style = document.createElement('style');
    style.textContent = `
        .timeline-container {
            padding: 0 15px;
        }
        .event-checkboxes {
            height: 120px;
            overflow-y: auto;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 8px;
            background: white;
        }
        .color-dot {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 6px;
        }
        .form-check {
            margin-bottom: 6px;
            white-space: nowrap;
        }
        .form-check:last-child {
            margin-bottom: 0;
        }
        .form-check-label {
            display: flex;
            align-items: center;
            font-size: 0.9rem;
        }
        #timeline {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
    `;
    document.head.appendChild(style);
}

function createLegend() {
    const legend = d3.select("#main-chart")
        .append("div")
        .attr("class", "legend");

    // Get currently selected event types
    const selectedEventTypes = Array.from(document.querySelectorAll('.event-checkboxes input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);

    // Add legend only for selected event types
    selectedEventTypes.forEach(type => {
        const legendItem = legend.append("div")
            .style("margin", "5px");

        legendItem.append("span")
            .style("display", "inline-block")
            .style("width", "12px")
            .style("height", "12px")
            .style("background", eventColors[type])
            .style("margin-right", "5px");

        legendItem.append("span")
            .text(type);
    });

    // Add fatalities legend
    legend.append("div")
        .style("margin-top", "10px")
        .text("Circle size: Number of fatalities");
}

function handleCountryHover(event, d) {
    tooltip.transition()
        .duration(200)
        .style("opacity", .9);
    
    tooltip.html(d.properties.name)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px")
        .style("position", "absolute");

    // Add mousemove event to follow the cursor
    d3.select(this).on("mousemove", function(moveEvent) {
        tooltip
            .style("left", (moveEvent.pageX + 10) + "px")
            .style("top", (moveEvent.pageY - 28) + "px");
    });
}

// Handle mouse out events
function handleMouseOut() {
    tooltip.interrupt(); // Stop any ongoing transitions

    tooltip.transition()
        .duration(500)
        .style("opacity", 0);
}

// Update the visualization based on new filters
function updateVisualization() {
    console.log("getting called good sign");
    
    const selectedYear = +d3.select("#yearSlider").property("value");
    const selectedEventTypes = Array.from(document.querySelectorAll('.event-checkboxes input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);

    // Remove existing legend
    d3.select(".legend").remove();

    // // Recreate legend with selected event types
    createLegend();
    // Filter data based on selections
    let filteredData = middleEast_data.filter(d => 
        d.year === selectedYear && 
        selectedEventTypes.includes(d.event_type)
    );
    // console.log("selectedYear", selectedYear, "inside updateVisualization() the filteredData, middleEast_data are:", filteredData, middleEast_data);
    
    // Update circles with a transition
    const circles = svg.selectAll("circle")
        .data(filteredData, d => d.event_id_cnty);

    // Remove old circles
    circles.exit()
        .transition()
        .duration(300)
        .attr("r", 0)
        .remove();

    // Add new circles
    const circlesEnter = circles.enter()
        .append("circle")
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", 0)
        .attr("fill", d => eventColors[d.event_type])
        .attr("opacity", 0.6);

    // Add event listeners to new circles
    circlesEnter
        .on("mouseover", handleEventHover)
        .on("mouseout", handleMouseOut)
        .style("cursor", "pointer");

    // Update all circles
    const allCircles = circles.merge(circlesEnter);

    allCircles.transition()
        .duration(300)
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", d => radiusScale(d.fatalities))
        .attr("fill", d => eventColors[d.event_type]);

    // Ensure event listeners are set on all circles
    allCircles
        .on("mouseover", handleEventHover)
        .on("mouseout", handleMouseOut)
        .style("cursor", "pointer");
    
    createChordDiagram(filteredData.slice(0,400));
}

// Handle event hover (for the map events)
function handleEventHover(event, d) {
    tooltip.interrupt();

    tooltip.transition()
        .duration(200)
        .style("opacity", 0.9);

    const [x, y] = d3.pointer(event);

    tooltip.html(`
        <strong>${d.event_type}</strong><br/>
        Location: ${d.location}<br/>
        Date: ${d.event_date}<br/>
        Fatalities: ${d.fatalities}<br/>
        ${d.notes || ''}
    `)
    .style("left", (event.pageX + 10) + "px")
    .style("top", (event.pageY - 28) + "px")
    .style("background", "white")
    .style("padding", "10px")
    .style("border", "1px solid #ddd")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("position", "absolute")
    .style("z-index", "1000");
}


function createFatalitiesLineChart(data) {
    // Clear any existing chart
    d3.select("#lineChart").selectAll("*").remove();

    // Set the dimensions and margins of the graph
    const margin = {top: 50, right: 100, bottom: 50, left: 80};
    const width = 600 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Prepare the data: aggregate by year
    const yearlyData = d3.groups(data, d => d.year)
        .map(([year, events]) => {
            // Group events by event type
            const eventTypeGroups = d3.group(events, d => d.event_type);
            
            return {
                year,
                totalFatalities: d3.sum(events, d => +d.fatalities),
                totalEvents: events.length,
                eventTypes: Object.fromEntries(
                    Array.from(eventTypeGroups, 
                        ([type, typeEvents]) => [type, typeEvents.length]
                    )
                )
            };
        })
        .sort((a, b) => d3.ascending(a.year, b.year));

    // Create the SVG container
    const svg = d3.select("#lineChart")
        .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
        .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

    // Color scale for different lines
    const color = d3.scaleOrdinal()
        .domain(['Fatalities', 'Total Events', ...Object.keys(yearlyData[0].eventTypes)])
        .range([
            'red', 
            'black', 
            'steelblue', 
            'green', 
            'purple', 
            'orange', 
            'brown'
        ]);

    // Prepare data for multiple lines
    const dataLines = [
        {
            name: 'Fatalities',
            values: yearlyData.map(d => ({ year: d.year, value: d.totalFatalities }))
        },
        {
            name: 'Total Events',
            values: yearlyData.map(d => ({ year: d.year, value: d.totalEvents }))
        },
        ...Object.keys(yearlyData[0].eventTypes).map(type => ({
            name: type,
            values: yearlyData.map(d => ({ 
                year: d.year, 
                value: d.eventTypes[type] || 0 
            }))
        }))
    ];

    // Create scales
    const x = d3.scaleLinear()
        .domain(d3.extent(yearlyData, d => d.year))
        .range([0, width]);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(dataLines, line => d3.max(line.values, d => d.value))])
        .range([height, 0]);

    // Create X axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    // Create Y axis
    svg.append("g")
        .call(d3.axisLeft(y));

    // Create line generator
    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.value));

    // Add lines
    const lines = svg.selectAll(".line")
        .data(dataLines)
        .enter().append("g");

    lines.append("path")
        .attr("class", "line")
        .attr("d", d => line(d.values))
        .style("stroke", d => color(d.name))
        .style("fill", "none")
        .style("stroke-width", 2);

    // Add data points
    lines.selectAll(".dot")
        .data(d => d.values.map(point => ({...point, name: d.name})))
        .enter().append("circle")
            .attr("class", "dot")
            .attr("cx", d => x(d.year))
            .attr("cy", d => y(d.value))
            .attr("r", 4)
            .style("fill", d => color(d.name));

    // Add title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("Conflict Metrics by Year");

    // Add X axis label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .text("Year");

    // Add Y axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -50)
        .attr("text-anchor", "middle")
        .text("Count");

    // Add legend
    const legend = svg.selectAll(".legend")
        .data(dataLines)
        .enter().append("g")
            .attr("class", "legend")
            .attr("transform", (d, i) => `translate(${width -180},${i * 20})`);

    legend.append("rect")
        .attr("x", 0)
        .attr("width", 10)
        .attr("height", 10)
        .style("fill", d => color(d.name));

    legend.append("text")
        .attr("x", 20)
        .attr("y", 9)
        .text(d => d.name)
        .style("font-size", "12px");
}
