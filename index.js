const artistIndex = [],
    chartRegistry = [];

/**
 * Converts HSV colors to RGB colors
 * @param {float} h
 * @param {float} s
 * @param {float} v
 * @returns {number[]}
 */
function hsvToRgb(h, s, v) {
  let r, g, b;

  const i = Math.floor(h * 6),
      f = h * 6 - i,
      p = v * (1 - s),
      q = v * (1 - f * s),
      t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return [ r * 255, g * 255, b * 255 ];
}

/**
 * Loads artist data from index.json
 * @returns {Promise<*[]>}
 */
async function loadArtistIndex() {
    const response = await fetch('./index.json'),
        paths = await response.json();

    for (const [index, path] of paths.entries()) {
        const [r, g, b] = hsvToRgb(index / paths.length, 1.0, 0.95),
            chartColor = `rgb(${r}, ${g}, ${b})`;

        artistIndex.push(new ArtistData(path, chartColor));
    }

    return artistIndex;
}

/**
 * Contains loaded artist data
 */
class ArtistData {
    static UNLOADED_NAME = '???';
    static ERROR_NAME = '<error>';

    constructor (dataPath, chartColor) {
        this.dataPath = dataPath;
        this.chartColor = chartColor;
        this.error = false;
        this._data = null;
        this._chartListenersData = null;
        this._chartFollowersData = null;
        this._chartTop10PlayCountSumData = null;
        this._chartTop10PlayCountMaxData = null;
    }

    async getData() {
        if (!this._data) {
            const response = await fetch(this.dataPath);

            this._data = await response.json();
            this.error = false;
        }
        return this._data;
    }

    get chartName() {
        if (this._data) {
            return this._data['name'];
        }
        else if (this.error) {
            return ArtistData.ERROR_NAME;
        }
        else {
            return ArtistData.UNLOADED_NAME;
        }
    }

    get chartListenersData() {
        if (this._chartListenersData) {
            return this._chartListenersData;
        }
        else if (this._data) {
            const data = [];

            for (const [key, value] of Object.entries(this._data['stats'])) {
                if ('monthlyListeners' in value) {
                    data.push({
                        x: key,
                        y: value['monthlyListeners']
                    });
                }
            }

            this._chartListenersData = data;
            return this._chartListenersData;
        }
        else {
            return [];
        }
    }

    get chartFollowersData() {
        if (this._chartFollowersData) {
            return this._chartFollowersData;
        }
        else if (this._data) {
            const data = [];

            for (const [key, value] of Object.entries(this._data['stats'])) {
                if ('followers' in value) {
                    data.push({
                        x: key,
                        y: value['followers']
                    });
                }
            }

            this._chartFollowersData = data;
            return this._chartFollowersData;
        }
        else {
            return [];
        }
    }

    get chartTop10PlayCountSumData() {
        if (this._chartTop10PlayCountSumData) {
            return this._chartTop10PlayCountSumData;
        }
        else if (this._data) {
            const data = [];

            for (const [key, value] of Object.entries(this._data['stats'])) {
                if ('top_tracks_playcount' in value) {
                    data.push({
                        x: key,
                        y: value['top_tracks_playcount'].reduce((pv, cv) => pv + cv, 0)
                    });
                }
            }

            this._chartTop10PlayCountSumData = data;
            return this._chartTop10PlayCountSumData;
        }
        else {
            return [];
        }
    }

    get chartTop10PlayCountMaxData() {
        if (this._chartTop10PlayCountMaxData) {
            return this._chartTop10PlayCountMaxData;
        }
        else if (this._data) {
            const data = [];

            for (const [key, value] of Object.entries(this._data['stats'])) {
                if ('top_tracks_playcount' in value) {
                    data.push({
                        x: key,
                        y: Math.max(...value['top_tracks_playcount'], 0)
                    });
                }
            }

            this._chartTop10PlayCountMaxData = data;
            return this._chartTop10PlayCountMaxData;
        }
        else {
            return [];
        }
    }
}

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
                fill: false,
            }
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
                        text: chartSubtitle,
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
                    },
                },
                interaction: {
                    intersect: false,
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
            },
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
    let values = [], datasetLabel;

    for (const artistData of artistIndex) {
        let timelineData, lastPoint;

        switch (dataType) {
            case 'listeners':
                timelineData = artistData.chartListenersData;
                break;
            case 'followers':
                timelineData = artistData.chartFollowersData;
                break
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
            })
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
            fill: false,
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
                            text: chartSubtitle,
                        },
                        legend: {
                            display: false,
                        },
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
                },
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
(async function() {
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
})();
