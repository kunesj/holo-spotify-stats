// imports: global dependencies, styles, models, components
import 'bootstrap';

// IMPORTANT: This must be the only style import in JS! Otherwise, every import duplicates all @use/@forward
import './main.scss';

import { Chart } from 'chart.js/auto';
import 'chartjs-adapter-moment';

import { artistIndex, loadArtistIndex, ArtistData } from './artist.js';

const chartRegistry = [];

/**
 * @param {String} dataType
 * @returns {Object}
 */
function getTimelineChartData(dataType) {
    return {
        datasets: artistIndex.map(artistData => {
            let chartData;

            switch (dataType) {
                case 'listeners':
                    chartData = artistData.chartListenersData;
                    break;
                case 'followers':
                    chartData = artistData.chartFollowersData;
                    break;
                case 'top10-play-count-sum':
                    chartData = artistData.chartTop10PlayCountSumData;
                    break;
                case 'top10-play-count-max':
                    chartData = artistData.chartTop10PlayCountMaxData;
                    break;
                default:
                    throw new Error(`Invalid dataType: ${dataType}`);
            }

            return {
                label: artistData.chartName,
                data: chartData,
                borderColor: artistData.chartColor,
                hidden: false,
                fill: false
            };
        })
    };
}

/**
 * @param {String} elementId
 * @param {String} chartTitle
 * @param {String} chartSubtitle
 * @param {String} dataType
 * @returns {Chart}
 */
function initTimelineChart(elementId, chartTitle, chartSubtitle, dataType) {
    const chart = new Chart(
        document.getElementById(elementId),
        {
            type: 'line',
            data: getTimelineChartData(dataType),
            options: {
                responsive: true,
                animation: false, // disable all animations
                plugins: {
                    title: {
                        display: !!chartTitle,
                        text: chartTitle
                    },
                    subtitle: {
                        display: !!chartSubtitle,
                        text: chartSubtitle
                    },
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            filter: function(item, chart) {
                                // Don't show datasets that are not ready in legend
                                return item.text !== ArtistData.UNLOADED_NAME;
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            parser: 'YYYY-MM-DD'
                        }
                    },
                    y: {
                        min: 0
                    }
                }
            }
        }
    );

    function updateChart() {
        chart.data = getTimelineChartData(dataType);
        chart.update();
    }

    chartRegistry.push([chart, updateChart]);
    return chart;
}

/**
 * @param {String} dataType
 * @returns {Object}
 */
function getRankChartData(dataType) {
    let values = [], 
        datasetLabel;

    for (const artistData of artistIndex) {
        let timelineData, lastPoint;

        switch (dataType) {
            case 'listeners':
                timelineData = artistData.chartListenersData;
                break;
            case 'followers':
                timelineData = artistData.chartFollowersData;
                break;
            case 'top10-play-count-sum':
                timelineData = artistData.chartTop10PlayCountSumData;
                break;
            case 'top10-play-count-max':
                timelineData = artistData.chartTop10PlayCountMaxData;
                break;
            default:
                throw new Error(`Invalid dataType: ${dataType}`);
        }

        // IMPORTANT: We assume that last stats were fetched at the same date for every artist!
        // This will have to be improved if any Spotify channel is deleted in the future.
        if (timelineData.length > 0) {
            lastPoint = timelineData[timelineData.length - 1];

            if (datasetLabel && datasetLabel !== lastPoint.x) {
                throw new Error('lastPoint date mismatch!');
            }
            datasetLabel = lastPoint.x;

            values.push({
                label: artistData.chartName,
                value: lastPoint.y,
                color: artistData.chartColor
            });
        }
    }

    values.sort((a, b) => a.value - b.value);
    values.reverse();

    return {
        labels: values.map(x => x.label),
        datasets: [{
            label: datasetLabel || '????-??-??',
            data: values.map(x => x.value),
            backgroundColor: values.map(x => x.color),
            hidden: false,
            fill: false
        }]
    };
}

/**
 *
 * @param {String} elementId
 * @param {String} chartTitle
 * @param {String} chartSubtitle
 * @param {String} dataType
 * @returns {Chart}
 */
function initCurrentRankChart(elementId, chartTitle, chartSubtitle, dataType) {
    const canvasElement = document.getElementById(elementId);

    // Height of container must be specified when using maintainAspectRatio=false, otherwise chart throws error.
    canvasElement.parentElement.style.minHeight = '5rem';

    const data = getRankChartData(dataType),
        chart = new Chart(
            canvasElement,
            {
                type: 'bar',
                data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,  // expand vertically
                    animation: false, // disable all animations
                    plugins: {
                        title: {
                            display: !!chartTitle,
                            text: chartTitle
                        },
                        subtitle: {
                            display: !!chartSubtitle,
                            text: chartSubtitle
                        },
                        legend: {
                            display: false
                        }
                    },
                    indexAxis: 'y',
                    elements: {
                        bar: {
                            borderWidth: 1,
                            borderColor: 'rgb(0,0,0)'
                        }
                    },
                    scales: {
                        x: {
                            min: 0
                        },
                        y: {}
                    }
                }
            }
        );

    function updateChart() {
        chart.data = getRankChartData(dataType);
        chart.options.plugins.title.text = `${chartTitle} [${chart.data.datasets[0].label}]`;
        canvasElement.parentElement.style.minHeight = `${3 + 1.5 * Math.max(chart.data.datasets[0].data.length, 1)}rem`;
        chart.update();
    }

    chartRegistry.push([chart, updateChart]);
    return chart;
}

/**
 * Updates data of all charts and updates them
 */
function updateCharts() {
    for (const [chart, updateChart] of chartRegistry) {
        updateChart();
    }
}

/**
 * Main
 */
window.addEventListener('load', async() => {
    await loadArtistIndex();

    const listenersSubtitle = 'Count of unique users that have listened to at least one song within 28-day window.';

    initCurrentRankChart('listeners-rank-graph', 'Monthly Listeners - Rank', listenersSubtitle, 'listeners');
    initTimelineChart('listeners-timeline-graph', 'Monthly Listeners - Timeline', listenersSubtitle, 'listeners');

    initCurrentRankChart('followers-rank-graph', 'Followers - Rank', '', 'followers');
    initTimelineChart('followers-timeline-graph', 'Followers - Timeline', '', 'followers');

    const top10PlayCountSumSubtitle = 'Total play count of 10 most popular songs.';

    initCurrentRankChart('top10-play-count-sum-rank-graph', 'Top10 Play Count [SUM] - Rank', top10PlayCountSumSubtitle, 'top10-play-count-sum');
    initTimelineChart('top10-play-count-sum-timeline-graph', 'Top10 Play Count [SUM] - Timeline', top10PlayCountSumSubtitle, 'top10-play-count-sum');

    const top10PlayCountMaxSubtitle = 'Play count of most popular song.';

    initCurrentRankChart('top10-play-count-max-rank-graph', 'Top10 Play Count [MAX] - Rank', top10PlayCountMaxSubtitle, 'top10-play-count-max');
    initTimelineChart('top10-play-count-max-timeline-graph', 'Top10 Play Count [MAX] - Timeline', top10PlayCountMaxSubtitle, 'top10-play-count-max');

    // start fetching all artist data

    const getDataPromisses = [];
    
    for (const artistData of artistIndex) {
        getDataPromisses.push([artistData, artistData.getData()]);
    }

    // wait until everything is fetched and update the graph
    
    for (const [artistData, getDataPromise] of getDataPromisses) {
        // wait for data to be fetched

        try {
            await getDataPromise;
        }
        catch (e) {
            console.error('Could not fetch:', artistData.dataPath);
            artistData.error = true;
        }

        // update graphs

        updateCharts();
    }
});
