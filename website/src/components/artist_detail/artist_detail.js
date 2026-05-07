import * as owl from '@odoo/owl';

import { Chart } from 'chart.js/auto';
import 'chartjs-adapter-moment';

import './artist_detail.xml?owl';

export class ArtistDetailView extends owl.Component {
    static props = {};
    static template = 'web.ArtistDetailView';

    setup() {
        super.setup();

        this.envState = owl.useState(this.env.state);
        this.canvasRef = owl.useRef('canvas');
        this.chart = null;

        owl.onMounted(this.onMounted.bind(this));
        owl.onWillUpdateProps(this.onWillUpdateProps.bind(this));
        owl.onPatched(this.onPatched.bind(this));
        owl.onWillUnmount(this.onWillUnmount.bind(this));
    }

    onMounted() {
        this._createChart();
    }

    onWillUpdateProps() {}

    onPatched() {
        if (!this.chart) {
            this._createChart();
        }
        else {
            this._updateChart();
        }
    }

    onWillUnmount() {
        this._destroyChart();
    }

    get artist() {
        if (!this.envState.selectedArtistId) {
            return null;
        }
        return this.envState.artistIndex.find(
            a => a.data.id === this.envState.selectedArtistId
        );
    }

    get generations() {
        if (!this.artist) {
            return [];
        }
        const gens = this.artist.data.generations;

        return gens || [];
    }

    get listenerRank() {
        if (!this.artist) {
            return 0;
        }
        return this.artist.getRank('listeners');
    }

    get followerRank() {
        if (!this.artist) {
            return 0;
        }
        return this.artist.getRank('followers');
    }

    _createChart() {
        this._destroyChart();

        if (!this.artist) {
            return;
        }

        this.chart = new Chart(
            this.canvasRef.el,
            {
                type: 'line',
                data: this._getChartData(),
                options: {
                    responsive: true,
                    animation: false,
                    plugins: {
                        legend: {
                            display: false
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

        this.chart.resize();
    }

    _updateChart() {
        if (!this.artist) {
            return;
        }

        this.chart.data = this._getChartData();
        this.chart.update('none');
        this.chart.resize();
    }

    _destroyChart() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    _getChartData() {
        if (!this.artist) {
            return { datasets: [] };
        }

        return {
            datasets: [
                {
                    label: this.artist.chartName,
                    data: this.artist.chartListenersData,
                    borderColor: this.artist.chartColor,
                    backgroundColor: this.artist.chartColor + '20',
                    fill: true
                }
            ]
        };
    }

    _onClickBack() {
        window.history.back();
    }
}
