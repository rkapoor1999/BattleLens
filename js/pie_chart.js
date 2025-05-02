let pieChartSVG;
let pieChartWidth;
let pieChartHeight;
let pieChartRadius;
let unCountries;
let unColors;
let unCountryColors;
let otherColors;

const countryNameMap = {
    'USA': 'United States',
    'US': 'United States',
    'United States of America': 'United States',
    'U.S.A.': 'United States',
    'U.S.': 'United States',
    'UK': 'United Kingdom',
    'U.K.': 'United Kingdom',
    'Britain': 'United Kingdom',
    'Great Britain': 'United Kingdom',
    'Russian Federation': 'Russia',
    'Russia Federation': 'Russia',
    'RUS': 'Russia',
    'China, People\'s Republic of': 'China',
};

document.addEventListener('DOMContentLoaded', function () {
    function waitForYearSlider() {
        if (document.getElementById('yearSlider')) {
            initializePieChart();

            const initialYear = +d3.select("#yearSlider").property("value") || 2022;
            loadPieChartData(initialYear);

            d3.select("#yearSlider").on("input.pieChart", function () {
                const year = +this.value;
                loadPieChartData(year);
            });
        } else {
            setTimeout(waitForYearSlider, 100);
        }
    }

    waitForYearSlider();
});

function initializePieChart() {
    const margin = { top: 20, right: 40, bottom: 20, left: 40 };

    pieChartWidth = 430 - margin.left - margin.right;
    pieChartHeight = 300 - margin.top - margin.bottom;
    pieChartRadius = Math.min(pieChartWidth, pieChartHeight) / 2 - 50;

    pieChartSVG = d3.select("#pie-chart")
        .attr("width", pieChartWidth + margin.left + margin.right)
        .attr("height", pieChartHeight + margin.top + margin.bottom)
        .attr("viewBox", `0 0 ${pieChartWidth + margin.left + margin.right} ${pieChartHeight + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${pieChartWidth / 2 - margin.left}, ${pieChartHeight / 2 + margin.top})`);

    unCountries = ['China', 'France', 'Russia', 'United Kingdom', 'United States'];

    unColors = [
        "#E41A1C",
        "#377EB8",
        "#4DAF4A",
        "#984EA3",
        "#FF7F00"
    ];

    unCountryColors = {};
    unCountries.forEach((country, i) => {
        unCountryColors[country] = unColors[i];
    });

    otherColors = d3.scaleOrdinal(d3.schemeCategory10);
}

function loadPieChartData(year) {
    pieChartSVG.selectAll("*").remove();

    const filePath = `csv/companies_data/${year}.csv`;
    console.log(`Loading data from ${filePath}`);

    d3.text(filePath).then(text => {
        const rows = d3.csvParseRows(text);
        console.log(`Parsed ${rows.length} rows from ${filePath}`);

        const countryRevenue = {};

        rows.forEach(row => {
            const company = row[2];
            let country = row[4];

            if (country && country.trim() !== '' && country !== 'Country') {
                country = country.trim();
                country = countryNameMap[country] || country;
            } else {
                return;
            }

            const revenueString = row[8];

            const revenue = parseFloat(revenueString.replace(/[^0-9.-]+/g, ""));

            if (isNaN(revenue)) {
                console.warn(`Invalid revenue value: ${revenueString} for company: ${company}, country: ${country}`);
                return;
            }

            countryRevenue[country] = (countryRevenue[country] || 0) + revenue;
        });

        const unData = [];
        const otherData = [];

        Object.entries(countryRevenue).forEach(([country, value]) => {
            if (unCountries.includes(country)) {
                unData.push({ country, value });
            } else {
                otherData.push({ country, value });
            }
        });

        unData.sort((a, b) => b.value - a.value);
        otherData.sort((a, b) => b.value - a.value);

        const pieData = [...unData, ...otherData];

        const otherCountries = otherData.map(d => d.country);
        otherColors.domain(otherCountries);

        createPieChart(pieData, unData, otherData, year);
    }).catch(error => {
        console.error('Error loading or parsing data:', error);
    });
}

function createPieChart(pieData, unData, otherData, year) {
    const pie = d3.pie()
        .value(d => d.value)
        .sort((a, b) => {
            const aIsUN = unCountries.includes(a.country);
            const bIsUN = unCountries.includes(b.country);
            if (aIsUN && !bIsUN) return -1;
            if (!aIsUN && bIsUN) return 1;
            return b.value - a.value;
        });

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(pieChartRadius);

    const arcs = pieChartSVG.selectAll(".arc")
        .data(pie(pieData))
        .enter()
        .append("g")
        .attr("class", "arc");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", (d) => {
            if (unCountries.includes(d.data.country)) {
                return unCountryColors[d.data.country];
            } else {
                return otherColors(d.data.country);
            }
        })
        .style("opacity", (d) => {
            if (unCountries.includes(d.data.country)) {
                return 1.0;
            } else {
                return 0.6;
            }
        })
        .style("stroke", "black")
        .style("stroke-width", "1px")
        .on("mouseover", function () {
            d3.select(this)
                .style("opacity", 0.8);
        })
        .on("mouseout", function (event, d) {
            d3.select(this)
                .style("opacity", unCountries.includes(d.data.country) ? 1.0 : 0.6);
        })
        .append("title")
        .text(d => `${d.data.country}: ${d3.format(",.0f")(d.data.value)} million US$`);

    addSeparatorLine(pieData, unData.length);

    addPieChartBorder();

    const titleOffsetX = 50;

    pieChartSVG.append("text")
        .attr("class", "title")
        .attr("y", -pieChartHeight / 2 + 20)
        .attr("x", pieChartWidth * 0.15 + titleOffsetX)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text(`Arms Company Revenues by Country (${year})`);

    createLegends(unData, otherData);
}

function addSeparatorLine(pieData, unDataLength) {
    const pie = d3.pie()
        .value(d => d.value)
        .sort((a, b) => {
            const aIsUN = unCountries.includes(a.country);
            const bIsUN = unCountries.includes(b.country);
            if (aIsUN && !bIsUN) return -1;
            if (!aIsUN && bIsUN) return 1;
            return b.value - a.value;
        });

    const pieSlices = pie(pieData);

    const lastUNSlice = pieSlices[unDataLength - 1];
    const separatorAngle = lastUNSlice.endAngle;

    const x1 = 0;
    const y1 = 0;
    const x2 = pieChartRadius * Math.cos(separatorAngle - Math.PI / 2);
    const y2 = pieChartRadius * Math.sin(separatorAngle - Math.PI / 2);

    pieChartSVG.append("line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("stroke", "black")
        .attr("stroke-width", 4);
}

function addPieChartBorder() {
    pieChartSVG.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", pieChartRadius)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 2);
}

function createLegends(unData, otherData) {
    const legendXStart = pieChartWidth * 0.15;

    const legendRectSize = 5;
    const legendSpacing = 8;
    const legendFontSize = "6px";
    const legendTitleFontSize = "7px";

    const unLegend = pieChartSVG.append("g")
        .attr("class", "un-legend")
        .attr("transform", `translate(${legendXStart + 50}, ${-pieChartRadius})`);

    unLegend.append("rect")
        .attr("x", -10)
        .attr("y", -25)
        .attr("width", 120)
        .attr("height", (unData.length * legendSpacing) + 30)
        .attr("fill", "#f0f0f0")
        .attr("stroke", "black")
        .attr("stroke-width", "1px");

    unLegend.append("text")
        .attr("x", 0)
        .attr("y", -5)
        .style("font-size", legendTitleFontSize)
        .style("font-weight", "bold")
        .text("Permanent UN Members");

    const unLegendItems = unLegend.selectAll(".legend-item")
        .data(unData)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * legendSpacing})`);

    unLegendItems.append("rect")
        .attr("width", legendRectSize)
        .attr("height", legendRectSize)
        .attr("fill", d => unCountryColors[d.country])
        .style("stroke", "black")
        .style("stroke-width", "0.5px")
        .style("opacity", 1.0);

    unLegendItems.append("text")
        .attr("x", legendRectSize + 5)
        .attr("y", legendRectSize - 2)
        .style("font-size", legendFontSize)
        .text(d => `${d.country}: ${d3.format(",.0f")(d.value)}M US$`);

    const otherLegend = pieChartSVG.append("g")
        .attr("class", "other-legend")
        .attr("transform", `translate(${legendXStart + 50}, ${-pieChartRadius + (unData.length * legendSpacing) + 30})`);

    otherLegend.append("rect")
        .attr("x", -10)
        .attr("y", -25)
        .attr("width", 120)
        .attr("height", (otherData.length * legendSpacing) + 30)
        .attr("fill", "#f0f0f0")
        .attr("stroke", "black")
        .attr("stroke-width", "1px");

    otherLegend.append("text")
        .attr("x", 0)
        .attr("y", -5)
        .style("font-size", legendTitleFontSize)
        .style("font-weight", "bold")
        .text("Other Countries");

    const otherLegendItems = otherLegend.selectAll(".legend-item")
        .data(otherData)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * legendSpacing})`);

    otherLegendItems.append("rect")
        .attr("width", legendRectSize)
        .attr("height", legendRectSize)
        .attr("fill", d => otherColors(d.country))
        .style("stroke", "black")
        .style("stroke-width", "0.5px")
        .style("opacity", 0.6);

    otherLegendItems.append("text")
        .attr("x", legendRectSize + 5)
        .attr("y", legendRectSize - 2)
        .style("font-size", legendFontSize)
        .text(d => `${d.country}: ${d3.format(",.0f")(d.value)}M US$`);
}
