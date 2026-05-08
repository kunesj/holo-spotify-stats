import * as owl from '@odoo/owl';

import { Chart } from 'chart.js/auto';
import 'chartjs-adapter-moment';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

import './artist_detail.xml?owl';

/**
 * View component displaying details for a single artist, including a line chart
 * of their monthly listeners over time and their statistics.
 * @extends owl.Component
 */
export class ArtistDetailView extends owl.Component {
    static props = {};
    static template = 'web.ArtistDetailView';

    /**
     * Initializes the component, sets up reactive state, references, and lifecycle hooks.
     */
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

    /**
     * Called when the component is mounted to the DOM.
     * Creates the initial Chart.js instance.
     */
    onMounted() {
        this._createChart();
    }

    /**
     * Called before the component's props are updated.
     */
    onWillUpdateProps() {}

    /**
     * Called after the component's DOM has been updated (patched).
     * Updates the chart data or creates it if it does not exist.
     */
    onPatched() {
        if (!this.chart) {
            this._createChart();
        }
        else {
            this._updateChart();
        }
    }

    /**
     * Called before the component is removed from the DOM.
     * Cleans up the chart instance to prevent memory leaks.
     */
    onWillUnmount() {
        this._destroyChart();
    }

    /**
     * Retrieves the currently selected artist from the global state.
     * @returns {Object|null} The selected artist's data wrapper, or null if no artist is selected.
     */
    get artist() {
        if (!this.envState.selectedArtistId) {
            return null;
        }
        return this.envState.artistIndex.find(
            a => a.data.id === this.envState.selectedArtistId
        );
    }

    /**
     * Retrieves the branch and generation affiliations of the selected artist.
     * @returns {Array<Array<string>>} An array of [branch, generation] tuples.
     */
    get generations() {
        if (!this.artist) {
            return [];
        }
        const gens = this.artist.data.generations;

        return gens || [];
    }

    /**
     * Retrieves the global rank of the selected artist based on monthly listeners.
     * @returns {number} The artist's rank by listeners.
     */
    get listenerRank() {
        if (!this.artist) {
            return 0;
        }
        return this.artist.getRank('listeners');
    }

    /**
     * Retrieves the global rank of the selected artist based on followers.
     * @returns {number} The artist's rank by followers.
     */
    get followerRank() {
        if (!this.artist) {
            return 0;
        }
        return this.artist.getRank('followers');
    }

    /**
     * Returns a specific color code for a given branch name.
     * @param {string} branch - The name of the branch (e.g., 'Hololive JP').
     * @returns {string} The hex color code associated with the branch.
     */
    getBranchColor(branch) {
        const colors = {
            'Hololive JP': '#0369A1',
            'Hololive EN': '#4338CA',
            'Hololive ID': '#BE123C',
            'DEV_IS': '#27272A',
            'Holostars JP': '#C2410C',
            'Holostars EN': '#0F766E',
            'Independent': '#475569',
            'Other': '#A21CAF'
        };

        return colors[branch] || '#6c757d';
    }

    /**
     * Creates and initializes the Chart.js line chart instance on the canvas.
     * Destroy any existing chart before creating a new one.
     * @private
     */
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
                    parsing: false,
                    plugins: {
                        legend: {
                            display: false
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

    /**
     * Updates the data of the existing chart instance without recreating it.
     * @private
     */
    _updateChart() {
        if (!this.artist) {
            return;
        }

        this.chart.data = this._getChartData();
        this.chart.update('none');
        this.chart.resize();
    }

    /**
     * Destroys the existing chart instance to clean up resources.
     * @private
     */
    _destroyChart() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    /**
     * Formats and returns the data structure required by Chart.js.
     * @returns {Object} Chart.js data object containing the dataset.
     * @private
     */
    _getChartData() {
        if (!this.artist) {
            return { datasets: [] };
        }

        return {
            datasets: [
                {
                    label: this.artist.chartName,
                    data: this.artist.chartListenersData.map(p => ({ x: new Date(p.x).getTime(),
                        y: p.y })),
                    borderColor: this.artist.chartColor,
                    backgroundColor: this.artist.chartColor + '20',
                    fill: true
                }
            ]
        };
    }

    /**
     * Handles the click event for the back button, navigating to the previous page.
     * @private
     */
    _onClickBack() {
        window.history.back();
    }

    /**
     * Resets the zoom level of the chart to its initial state.
     * @private
     */
    _onResetZoom() {
        if (this.chart) {
            this.chart.resetZoom();
        }
    }
}
