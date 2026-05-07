import * as owl from '@odoo/owl';

import { Chart } from 'chart.js/auto';
import 'chartjs-adapter-moment';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

import './compare_view.xml?owl';

export class CompareView extends owl.Component {
    static props = {};
    static template = 'web.CompareView';

    setup() {
        super.setup();

        this.envState = owl.useState(this.env.state);
        this.canvasRef = owl.useRef('canvas');
        this.chart = null;
        this.state = owl.useState({
            searchText: '',
            selectedIds: [],
            showDropdown: false,
            focusedIndex: -1
        });

        owl.onMounted(this.onMounted.bind(this));
        owl.onPatched(this.onPatched.bind(this));
        owl.onWillUnmount(this.onWillUnmount.bind(this));
    }

    onMounted() {
        this._createChart();
    }

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

    get searchResults() {
        if (!this.state.searchText) {
            return [];
        }

        const q = this.state.searchText.toLowerCase();

        return this.envState.artistIndex
            .filter(a => a.chartName.toLowerCase().includes(q))
            .slice(0, 20);
    }

    get selectedArtists() {
        return this.state.selectedIds
            .map(id => this.envState.artistIndex.find(a => a.data.id === id))
            .filter(Boolean);
    }

    get chartDataType() {
        return 'listeners';
    }

    _createChart() {
        this._destroyChart();

        this.chart = new Chart(
            this.canvasRef.el,
            {
                type: 'line',
                data: this._getChartData(),
                options: {
                    responsive: true,
                    animation: false,
                    parsing: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom'
                        },
                        zoom: {
                            zoom: {
                                wheel: {
                                    enabled: true
                                },
                                pinch: {
                                    enabled: true
                                },
                                mode: 'x'
                            },
                            pan: {
                                enabled: true,
                                mode: 'x'
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

        this.chart.resize();
    }

    _updateChart() {
        const oldDatasets = this.chart.data.datasets || [],
            newData = this._getChartData();

        for (const newDs of newData.datasets) {
            const oldIndex = oldDatasets.findIndex(ds => ds.label === newDs.label);

            if (oldIndex !== -1) {
                newDs.hidden = !this.chart.isDatasetVisible(oldIndex);
            }
        }

        this.chart.data = newData;
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
        const datasets = [];

        for (const artistData of this.selectedArtists) {
            datasets.push({
                label: artistData.chartName,
                data: artistData.chartListenersData.map(p => ({ x: new Date(p.x).getTime(),
                    y: p.y })),
                borderColor: artistData.chartColor,
                fill: false
            });
        }

        return { datasets };
    }

    _onSearchInput(ev) {
        this.state.searchText = ev.currentTarget.value;
        this.state.showDropdown = true;
        this.state.focusedIndex = -1;
    }

    _onSearchBlur() {
        // Delay so click on dropdown item fires first
        setTimeout(() => {
            this.state.showDropdown = false;
        }, 200);
    }

    _onSearchKeydown(ev) {
        const results = this.searchResults;

        if (ev.key === 'ArrowDown') {
            ev.preventDefault();
            this.state.focusedIndex = Math.min(this.state.focusedIndex + 1, results.length - 1);
        }
        else if (ev.key === 'ArrowUp') {
            ev.preventDefault();
            this.state.focusedIndex = Math.max(this.state.focusedIndex - 1, 0);
        }
        else if (ev.key === 'Enter' && this.state.focusedIndex >= 0) {
            ev.preventDefault();
            this._selectArtist(results[this.state.focusedIndex]);
        }
        else if (ev.key === 'Escape') {
            this.state.showDropdown = false;
        }
    }

    _selectArtist(artistData) {
        if (!artistData) {
            return;
        }

        if (this.state.selectedIds.length >= 5) {
            return;
        }

        if (this.state.selectedIds.includes(artistData.data.id)) {
            return;
        }

        this.state.selectedIds.push(artistData.data.id);
        this.state.searchText = '';
        this.state.showDropdown = false;
    }

    _onClickResult(ev) {
        const id = ev.currentTarget.dataset.artistId,
            artistData = this.envState.artistIndex.find(a => a.data.id === id);

        this._selectArtist(artistData);
    }

    _removeArtist(ev) {
        const id = ev.currentTarget.dataset.artistId,
            idx = this.state.selectedIds.indexOf(id);

        if (idx >= 0) {
            this.state.selectedIds.splice(idx, 1);
        }
    }

    _onResetZoom() {
        if (this.chart) {
            this.chart.resetZoom();
        }
    }
}
