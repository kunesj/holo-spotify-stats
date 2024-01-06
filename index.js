const artistIndex = [];

class ArtistData {
    constructor (path) {
        this.path = path;
        this._data = null;
        this._chartData = null;
    }

    async getData() {
        if (!this._data) {
            const response = await fetch(this.path);

            this._data = await response.json();
        }
        return this._data;
    }

    get chartName() {
        if (this._data) {
            return this._data['name'];
        }
        else {
            return '???';
        }
    }

    get chartColor() {
        if (this._data) {
            switch (this._data['branch'] && this._data['branch'].toLowerCase()) {
                case 'jp':
                    return '#cc0000';
                case 'id':
                    return '#cc00cc';
                case 'en':
                    return '#00cc00';
                case 'dev_is':
                    return '#00cccc';
                case null:
                    return '#cccccc';
                default:
                    return '#000000';
            }
        }
        else {
            return '#000000';
        }
    }

    get chartData() {
        if (this._chartData) {
            return this._chartData;
        }
        else if (this._data) {
            const _chartData = [];

            for (const [key, value] of Object.entries(this._data['stats'])) {
                if ('monthlyListeners' in value) {
                    _chartData.push({
                        x: key,
                        y: value['monthlyListeners']
                    });
                }
            }

            this._chartData = _chartData;
            return this._chartData;
        }
        else {
            return [];
        }
    }
}

async function loadArtistIndex() {
    const response = await fetch('./index.json');

    for (const path of await response.json()) {
        artistIndex.push(new ArtistData(path));
    }

    return artistIndex;
}

function initChart() {
    const data = {
        // labels: dataIndex.map(x => '???'),
        datasets: artistIndex.map(artistData => {
            return {
                get label() {
                    return artistData.chartName;
                },
                get data() {
                    return artistData.chartData;
                },
                get borderColor() {
                    return artistData.chartColor;
                },
                fill: false
            }
        })
    };

    return new Chart(
        document.getElementById('graph'),
        {
            type: 'line',
            data,
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Hololive Spotify - Monthly Listeners'
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
                    }
                }
            },
        }
    );
}

(async function() {
    await loadArtistIndex();

    const chart = initChart();

    for (const artistData of artistIndex) {
        await artistData.getData();
        chart.update();
    }
})();
