let gdp_data = [];
let gdp_svg;
let gdp_width;
let gdp_height;
let gdp_margin;
let selectedCountries;
let years;
let validData;
let key_index_rn=0;

document.addEventListener('DOMContentLoaded', function () {
    initializeDataAndVisualization()
});

function initializeDataAndVisualization() {
    Promise.all([
        loadGDPData(),
        loadWeaponRevenueData()
    ])
    .then(([gdpData, revenueData]) => {
        validData = revenueData;
        filtered_gdp_data = filterGDPDataFunction()
        createWeaponRevenueStreamChart(filtered_gdp_data);
    })
    .catch(error => {
        console.error("Error loading data:", error);
    });
}

function loadGDPData() {
    return new Promise((resolve, reject) => {
        d3.csv('csv/world_gdp_data.csv')
            .then(function (data) {
                gdp_data = data;
                resolve(data);
            })
            .catch(error => {
                console.error('Error loading GDP data:', error);
                reject(error);
            });
    });
}

function loadWeaponRevenueData() {
    const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
    
    return Promise.all(years.map(year => loadWeaponYearlyRevenueData(year)))
        .then(results => {
            const validData = results.filter(data => data !== null);
            return validData;
        })
        .catch(error => {
            console.error("Error loading revenue data:", error);
            throw error;
        });
}

function filterGDPDataFunction() {
    const selectedCountries = [
        "US", "China", "Japan", "UK", "Netherlands", 
        "France", "Italy", "Russia", "Ireland", "Israel", "Germany"
    ];

    const filteredData = gdp_data.filter(row => selectedCountries.includes(row['country_name']));

    const filtered_gdp_data = filteredData.map(data => {
        const filteredYears = Object.entries(data)
            .filter(([key, value]) => {
                const year = parseInt(key); // Ensure key is treated as a number
                return year >= 2010 && year <= 2024;
            })
            .map(([year, value]) => ({ year: parseInt(year), growth: parseFloat(value) }));

        return {
            country: data['country_name'],
            growthData: filteredYears,
        };
    });

    return filtered_gdp_data;
}

function loadWeaponYearlyRevenueData(year) {
    const filePath = `csv/companies_data/${year}.csv`;

    return d3.text(filePath).then(text => {
        const rows = d3.csvParseRows(text);

        const dataRows = rows.slice(1);

        const companyByCountry = {};
        const countryTotalRevenue = {};

        dataRows.forEach(row => {
            const company = row[2];  
            const country = row[4]; 
            const revenueString = row[8]; 

            let revenue = parseFloat(revenueString.replace(/[^0-9.-]+/g, ""));

            if (isNaN(revenue)) {
                return;
            }

            if (country) {
                if (!companyByCountry[country]) {
                    companyByCountry[country] = [];
                    countryTotalRevenue[country] = 0;
                }
                companyByCountry[country].push({ company, revenue });
                countryTotalRevenue[country] += revenue;
            }
        });

        // Sort countries by total revenue
        const countries = Object.keys(countryTotalRevenue)
            .sort((a, b) => countryTotalRevenue[b] - countryTotalRevenue[a]);

        return {
            year,
            countries,
            companyByCountry,
            countryTotalRevenue
        };
    }).catch(error => {
        console.error(`Error loading data for year ${year}:`, error);
        return null;
    });
}

function createWeaponRevenueStreamChart(filtered_gdp_data) {
    // SVG setup
    const gdp_margin = {top: 50, right: 150, bottom: 100, left: 80};
    const gdp_width = 800 - gdp_margin.left - gdp_margin.right;
    const gdp_height = 500 - gdp_margin.top - gdp_margin.bottom;

    // Create SVG
    const gdp_svg = d3.select('#gdpChart')
        .append('svg')
        .attr('width', gdp_width + gdp_margin.left + gdp_margin.right)
        .attr('height', gdp_height + gdp_margin.top + gdp_margin.bottom)
        .append('g')
        .attr('transform', `translate(${gdp_margin.left},${gdp_margin.top})`);

    // Prepare data
    function prepareStreamChartData() {
        const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
        const selectedCountries = [
            "US", "China", "Japan", "UK", "Netherlands", 
            "France", "Italy", "Russia", "Israel", "Germany"
        ];

        return selectedCountries.map(country => ({
            country: country,
            values: years.map(year => ({
                year: year,
                revenue: findRevenueForCountryAndYear(country, year),
                gdp: findGDPGrowthForCountry(country, year)
            }))
        }));
    }

    function findRevenueForCountryAndYear(country, year) {
        if (!validData || validData.length === 0) return 0;
        
        const yearData = validData.find(data => data.year === year);
        return yearData?.countryTotalRevenue?.[country] || 0;
    }

    function findGDPGrowthForCountry(country, year) {
        const countryData = filtered_gdp_data.find(row => row.country === country);
        const yearData = countryData?.growthData.find(data => data.year === year);
        return yearData?.growth || 0;
    }

    // Dara prep for stream
    const streamData = prepareStreamChartData();
    
    const formattedData = streamData.reduce((acc, countryData) => {
        countryData.values.forEach(({ year, revenue, gdp }) => {
            if (!acc[year]) acc[year] = { year };
            
            acc[year][countryData.country] = revenue;
            acc[year][`${countryData.country}_gdp`] = gdp;
        });
        return acc;
    }, {});

    console.log("formatted data", formattedData)

    const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
    const selectedCountries = [
        "US", "China", "Japan", "UK", "Netherlands", 
        "France", "Italy", "Russia", "Israel", "Germany"
    ];

    // Color palette
    const color = d3.scaleOrdinal()
        .domain(selectedCountries)
        .range([
            "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", 
            "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"
        ]);

    // X Axis
    const x = d3.scaleLinear()
        .domain([d3.min(years), d3.max(years)])
        .range([0, gdp_width]);
    
    gdp_svg.append("g")
        .attr("transform", `translate(0, ${gdp_height+20})`)
        .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")))
        .append("text")
        .attr("x", gdp_width / 2)
        .attr("y", 35)
        .attr("fill", "black")
        .style("font-size", "12px")
        .text("Year");

    // Y Axis
    const maxRevenue = d3.max(Object.values(formattedData), d => 
        selectedCountries.reduce((sum, key) => sum + (d[key] || 0), 0)
    );

    const y = d3.scaleLinear()
        .domain([0, maxRevenue * 1.1])
        .range([gdp_height, 0]);

    gdp_svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d3.format(".2s")))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -50)
        .attr("x", -gdp_height / 2)
        .attr("fill", "black")
        .style("font-size", "12px")
        .text("Total Weapon Revenue (USD)");

    // Stacked Area Generator
    const area = d3.area()
        .x(d => x(d.data.year))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]));

    // Stack the data
    const stackedData = d3.stack()
        .keys(selectedCountries)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone)
        (Object.values(formattedData));

    // Create tooltip
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "gdp-tooltip")
        .style("position", "absolute")
        .style("background-color", "rgba(255,255,255,0.9)")
        .style("border", "1px solid #999")
        .style("border-radius", "5px")
        .style("padding", "10px")
        .style("box-shadow", "0 2px 5px rgba(0,0,0,0.2)")
        .style("opacity", 0);

    // Render stream paths
    gdp_svg.selectAll("mylayers")
        .data(stackedData)
        .join("path")
        .attr("class", "stream-path")
        .style("fill", d => color(d.key))
        .style("opacity", 0.7)
        .attr("d", area)
        .on("mousemove", function(event, d) {
            // Find the specific year and data point under the mouse
            const [mouseX] = d3.pointer(event);
            const year = Math.round(x.invert(mouseX));
            
            // Find the specific country data for this year
            const countryData = d.filter((dataPoint, index) => {
                return dataPoint.data.year === year;
            })[0];

            if (!countryData) return;

            // Highlight and show tooltip
            d3.selectAll(".stream-path")
                .style("opacity", 0.2);
            d3.select(this)
                .style("opacity", 1);

            const country = d.key;
            const revenue = countryData.data[country];
            const gdp = countryData.data[`${country}_gdp`];
            
            tooltip.transition()
                .duration(200)
                .style("opacity", 0.9);
            
            tooltip.html(`
                <strong>${country}</strong><br/>
                Year: ${year}<br/>
                Revenue: $${revenue ? revenue.toLocaleString() : 'N/A'}<br/>
                GDP Change: ${gdp ? gdp.toFixed(2) : 'N/A'}%
            `)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.selectAll(".stream-path")
                .style("opacity", 0.7);

            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // Add legend
    const legend = gdp_svg.selectAll(".legend")
        .data(selectedCountries)
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", (d, i) => `translate(${gdp_width + 20}, ${i * 20})`);

    legend.append("rect")
        .attr("x", 0)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", color)
        .style("stroke", "#999")
        .style("stroke-width", "1px");

    legend.append("text")
        .attr("x", 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("font-size", "12px")
        .text(d => d);

    // Title
    gdp_svg.append("text")
        .attr("x", (gdp_width / 2))
        .attr("y", 0 - (gdp_margin.top / 2))
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text("Weapon Revenue Stream by Country (2015-2024)");
}

const style = document.createElement('style');
style.innerHTML = `
    .tooltip {
        pointer-events: none;
        font-family: Arial, sans-serif;
        font-size: 12px;
    }
`;
document.head.appendChild(style);