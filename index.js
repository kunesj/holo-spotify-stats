const artistIndex = [];

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

class ArtistData {
    static hueMin = 0.0;
    static hueMax = 1.0;
    static hueStep = (ArtistData.hueMax - ArtistData.hueMin) / 20;
    static hueMap = {};

    static saturationMin = 0.4;
    static saturationMax = 1.0;
    static saturationStep = (ArtistData.saturationMax - ArtistData.saturationMin) / 6;
    static saturationMaps = {};

    constructor (path) {
        this.path = path;
        this.error = false;
        this._data = null;
        this._chartData = null;
        this._chartColor = null
    }

    async getData() {
        if (!this._data) {
            const response = await fetch(this.path);

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
            return '<error>';
        }
        else {
            return '???';
        }
    }

    get chartColor() {
        if (this._chartColor) {
            return this._chartColor;
        }
        else if (this._data) {
            const hueKey = `${this._data['branch']};${this._data['generation']}`,
                saturationKey = `${this._data['name']}`;

            if (!(hueKey in ArtistData.hueMap)) {
                let newHue = ArtistData.hueMin + ArtistData.hueStep * Object.keys(ArtistData.hueMap).length;

                while (newHue > ArtistData.hueMax) {
                    newHue -= ArtistData.hueMax - ArtistData.hueMin;
                }

                ArtistData.hueMap[hueKey] = newHue;
            }

            if (!(hueKey in ArtistData.saturationMaps)) {
                ArtistData.saturationMaps[hueKey] = {};
            }


            if (!(saturationKey in ArtistData.saturationMaps[hueKey])) {
                let newSaturation = (
                    ArtistData.saturationMin
                    + ArtistData.saturationStep * Object.keys(ArtistData.saturationMaps[hueKey]).length
                );

                while (newSaturation > ArtistData.saturationMax) {
                    newSaturation -= ArtistData.saturationMax - ArtistData.saturationMin;
                }

                ArtistData.saturationMaps[hueKey][saturationKey] = newSaturation;
            }

            const [r, g, b] = hsvToRgb(
                ArtistData.hueMap[hueKey], ArtistData.saturationMaps[hueKey][saturationKey], 0.9
            );

            this._chartColor = `rgb(${r}, ${g}, ${b})`;
            return this._chartColor;
        }
        else {
            return 'rgb(0, 0, 0)';
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
                hidden: false,
                fill: false,
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
                    legend: {
                        display: true,
                        labels: {
                            filter: function(item, chart) {
                                // Don't show datasets that are not ready in legend
                                return item.text !== '???';
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
}

(async function() {
    await loadArtistIndex();

    const chart = initChart();

    for (const artistData of artistIndex) {
        try {
            await artistData.getData();
        }
        catch (e) {
            console.error('Could not fetch:', artistData.path);
            artistData.error = true;
        }
        chart.update();
    }
})();
