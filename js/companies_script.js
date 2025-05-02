let svgBar;
let margin;
let widthBar;
let heightBar;
let mainG;
let xScale;
let yScale;
let colorScale;

document.addEventListener('DOMContentLoaded', function () {
    initializeBarGraph();
});

function initializeBarGraph() {
    svgBar = d3.select("#chart")
        .attr("width", 900)
        .attr("height", 500);

    margin = { top: 60, right: 50, bottom: 80, left: 120 };
    widthBar = 900 - margin.left - margin.right;
    heightBar = 500 - margin.top - margin.bottom;

    mainG = svgBar.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    xScale = d3.scaleBand().range([0, widthBar]).padding(0.3);
    yScale = d3.scaleLinear().range([heightBar, 0]);
    colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    loadYearlyData(2015);
    d3.select("#yearSlider").on("input", function () {
        const year = +this.value;
        loadYearlyData(year);
    });
}

function loadYearlyData(year) {
    mainG.selectAll("*").remove();
    svgBar.selectAll(".chart-title").remove();

    const filePath = `csv/companies_data/${year}.csv`;

    d3.text(filePath).then(text => {
        const rows = d3.csvParseRows(text);
        const companyByCountry = {};
        const countryTotalRevenue = {};

        rows.forEach(row => {
            const company = row[2];
            const country = row[4];
            const revenueString = row[8];

            const revenue = parseFloat(revenueString.replace(/[^0-9.-]+/g, ""));

            if (isNaN(revenue)) {
                return;
            }

            if (country && country !== "Country") {
                if (!companyByCountry[country]) {
                    companyByCountry[country] = [];
                    countryTotalRevenue[country] = 0;
                }
                companyByCountry[country].push({ company, revenue });
                countryTotalRevenue[country] += revenue;
            }
        });

        const countries = Object.keys(countryTotalRevenue)
            .sort((a, b) => countryTotalRevenue[b] - countryTotalRevenue[a]);

        const maxRevenue = Math.max(
            ...Object.values(companyByCountry)
                .map(countryData =>
                    countryData.reduce((sum, d) => sum + d.revenue, 0)
                )
        );

        xScale.domain(countries);
        yScale.domain([0, maxRevenue]);

        createStackedBarChart(companyByCountry, countries, maxRevenue, year);

    }).catch(error => {
        console.error('Error loading or parsing data:', error);
    });
}

function createStackedBarChart(companyByCountry, countries, maxRevenue, year) {
    countries.forEach(country => {
        const countryData = companyByCountry[country].sort((a, b) => b.revenue - a.revenue);
        const group = mainG.append("g")
            .attr("class", "bar-group")
            .attr("transform", `translate(${xScale(country)}, 0)`);

        let yOffset = heightBar;
        countryData.forEach((d, index) => {
            const barHeight = heightBar - yScale(d.revenue);
            yOffset -= barHeight;

            group.append("rect")
                .attr("x", 0)
                .attr("y", yOffset)
                .attr("width", xScale.bandwidth())
                .attr("height", barHeight)
                .attr("fill", colorScale(index))
                .attr("stroke", "white")
                .attr("stroke-width", "1px")
                .style("cursor", "pointer")
                .on("click", () => {
                    animateToDonut(country, countryData, group, year);
                })
                .append("title")
                .text(`Company: ${d.company}\nRevenue: ${d3.format(",.0f")(d.revenue)} million US$`);
        });
    });

    mainG.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${heightBar})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .attr("transform", "rotate(-30)")
        .style("text-anchor", "end")
        .style("font-size", "12px")
        .style("font-family", "Helvetica, Arial, sans-serif")
        .style("fill", "#333")
        .attr("dx", "-.8em")
        .attr("dy", ".15em");

    mainG.append("g")
        .attr("class", "axis")
        .call(
            d3.axisLeft(yScale)
                .tickFormat(d => d3.format(",.0f")(d))
                .ticks(10)
        )
        .selectAll("text")
        .style("font-size", "12px")
        .style("font-family", "Helvetica, Arial, sans-serif")
        .style("fill", "#333");

    mainG.selectAll(".axis path, .axis line")
        .style("stroke", "#ccc");

    mainG.append("text")
        .attr("class", "x-axis-title")
        .attr("x", widthBar / 2)
        .attr("y", heightBar + 80)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-family", "Helvetica, Arial, sans-serif")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text("Countries");

    mainG.append("text")
        .attr("class", "y-axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -heightBar / 2)
        .attr("y", -80)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-family", "Helvetica, Arial, sans-serif")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text("Revenue (Million US$)");

    svgBar.append("text")
        .attr("class", "chart-title")
        .attr("x", widthBar / 2 + margin.left)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "24px")
        .style("font-family", "Helvetica, Arial, sans-serif")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text(`Arms Revenue by Company and Country (${year})`);
}

function animateToDonut(country, companies, barGroup, year) {
    mainG.selectAll(".pie-group").remove();
    mainG.selectAll(".overlay").remove();
    mainG.selectAll(".back-button").remove();
    mainG.selectAll(".legend-group").remove();

    const totalRevenue = d3.sum(companies, d => d.revenue);
    const pieData = companies.map(d => ({
        label: d.company,
        value: d.revenue,
        percentage: (d.revenue / totalRevenue) * 100
    })).filter(d => d.percentage > 1);

    const centerX = widthBar / 2;
    const centerY = heightBar / 2;
    const radius = Math.min(widthBar, heightBar) / 4;

    const pie = d3.pie()
        .value(d => d.value)
        .sort((a, b) => b.value - a.value);

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);

    mainG.append("rect")
        .attr("class", "overlay")
        .attr("width", widthBar)
        .attr("height", heightBar)
        .attr("fill", "#f9f9f9")
        .style("opacity", 0)
        .transition()
        .duration(500)
        .style("opacity", 0.8);

    const pieG = mainG.append("g")
        .attr("class", "pie-group")
        .attr("transform", `translate(${centerX},${centerY})`);

    const barGroupBox = barGroup.node().getBBox();
    const startX = barGroupBox.x + xScale.bandwidth() / 2;
    const startY = barGroupBox.y + barGroupBox.height / 2;

    const segments = pieG.selectAll("path")
        .data(pie(pieData))
        .enter()
        .append("path")
        .attr("fill", (d, i) => colorScale(i))
        .attr("stroke", "black")
        .attr("stroke-width", "1px")
        .attr("transform", `translate(${startX - centerX},${startY - centerY})`)
        .attr("d", arc)
        .style("opacity", 0);

    segments.transition()
        .duration(1000)
        .delay((d, i) => i * 100)
        .style("opacity", 1)
        .attr("transform", "translate(0,0)")
        .attrTween("d", function(d) {
            const interpolate = d3.interpolate(
                { startAngle: 0, endAngle: 0 },
                { startAngle: d.startAngle, endAngle: d.endAngle }
            );
            return t => arc(interpolate(t));
        });

    setTimeout(() => {
        const labelArc = d3.arc()
            .innerRadius(radius * 0.6)
            .outerRadius(radius * 0.6);

        pieG.selectAll(".label")
            .data(pie(pieData))
            .enter()
            .append("text")
            .attr("class", "label")
            .attr("transform", d => `translate(${labelArc.centroid(d)})`)
            .attr("text-anchor", "middle")
            .style("font-size", "8px")
            .style("font-family", "Helvetica, Arial, sans-serif")
            .style("fill", "#333")
            .style("opacity", 0)
            .each(function(d) {
                const percentage = d.data.percentage.toFixed(1);
                if (percentage > 3) {
                    const text = d3.select(this);
                    text.text(`${percentage}%`)
                        .style("font-size", "10px");
                }
            })
            .transition()
            .duration(500)
            .style("opacity", 1);

        const legendG = mainG.append("g")
            .attr("class", "legend-group")
            .attr("transform", `translate(${centerX + radius + 50}, ${centerY - radius-100})`);

        const legendItemHeight = 20;

        const legend = legendG.selectAll(".legend-item")
            .data(pieData)
            .enter()
            .append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * legendItemHeight})`);

        legend.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 18)
            .attr("height", 18)
            .attr("fill", (d, i) => colorScale(i));

        legend.append("text")
            .attr("x", 24)
            .attr("y", 9)
            .attr("dy", "0.35em")
            .style("font-size", "12px")
            .style("font-family", "Helvetica, Arial, sans-serif")
            .style("fill", "#333")
            .text(d => d.label.slice(0, 25));

        legend.on("mouseover", function (event, d) {
            const index = pieData.findIndex(item => item.label === d.label);
            segments
                .filter((_, i) => i === index)
                .transition()
                .duration(200)
                .attr("transform", "scale(1.1)");
        })
        .on("mouseout", function (event, d) {
            const index = pieData.findIndex(item => item.label === d.label);
            segments
                .filter((_, i) => i === index)
                .transition()
                .duration(200)
                .attr("transform", "scale(1)");
        });

        mainG.append("text")
            .attr("class", "back-button")
            .attr("x", centerX - 70)
            .attr("y", centerY - radius - 20)
            .style("cursor", "pointer")
            .style("font-size", "16px")
            .style("font-family", "Helvetica, Arial, sans-serif")
            .style("font-weight", "bold")
            .style("fill", "#007BFF")
            .text("← Back to Chart")
            .style("opacity", 0)
            .on("click", () => {
                pieG.selectAll("*")
                    .transition()
                    .duration(500)
                    .style("opacity", 0)
                    .remove();

                mainG.select(".overlay")
                    .transition()
                    .duration(500)
                    .style("opacity", 0)
                    .remove();

                legendG.selectAll("*")
                    .transition()
                    .duration(500)
                    .style("opacity", 0)
                    .remove();

                mainG.select(".back-button")
                    .transition()
                    .duration(500)
                    .style("opacity", 0)
                    .remove();

                loadYearlyData(year);
            })
            .transition()
            .duration(500)
            .style("opacity", 1);
    }, 1500);

    svgBar.select(".chart-title")
        .text(`Arms Revenue Distribution in ${country} (${year})`);
}
