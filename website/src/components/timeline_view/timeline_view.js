import * as owl from '@odoo/owl';

import { Chart } from 'chart.js/auto';
import 'chartjs-adapter-moment';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

import { getAllBranches } from '~/artist';

import './timeline_view.xml?owl';

/**
 * Timeline view component for displaying line charts of artists' stats over time.
 * @extends owl.Component
 */
export class TimelineView extends owl.Component {
    static props = {
        title: {type: String,
            optional: true},
        subtitle: {type: String,
            optional: true},
        dataType: {type: String}
    };
    static template = 'web.TimelineView';

    /**
     * Setup component state and lifecycle hooks.
     */
    setup() {
        super.setup();

        this.envState = owl.useState(this.env.state);
        this.localState = owl.useState({
            hiddenArtists: new Set()
        });
        this.canvasRef = owl.useRef('canvas');
        this.chart = null;

        owl.onMounted(this.onMounted.bind(this));
        owl.onWillUpdateProps(this.onWillUpdateProps.bind(this));
        owl.onPatched(this.onPatched.bind(this));
        owl.onWillUnmount(this.onWillUnmount.bind(this));
    }

    /**
     * Called when the component is mounted to the DOM.
     */
    onMounted() {
        this._createChart();
    }

    /**
     * Called before component props are updated.
     */
    onWillUpdateProps() {}

    /**
     * Called after the component has been patched (updated).
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
     * Called before the component is unmounted from the DOM.
     */
    onWillUnmount() {
        this._destroyChart();
    }

    /**
     * Get all unique branch names.
     * @returns {Set<string>}
     */
    get branches() {
        return getAllBranches();
    }

    /**
     * Get currently hidden branches from the environment state.
     * @returns {Set<string>}
     */
    get hiddenBranches() {
        return this.envState.hiddenBranches;
    }

    /**
     * Get list of artists that are currently visible based on branch filters.
     * @returns {ArtistData[]}
     */
    get visibleArtists() {
        return this.envState.artistIndex.filter(
            artistData => !artistData.isHidden(this.hiddenBranches)
        );
    }

    /**
     * Get the count of visible artists.
     * @returns {number}
     */
    get artistCount() {
        return this.visibleArtists.length;
    }

    /**
     * Create the Chart.js instance for the timeline.
     * @private
     */
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
                        title: {
                            display: !!this.props.title,
                            text: this.props.title
                        },
                        subtitle: {
                            display: !!this.props.subtitle,
                            text: this.props.subtitle
                        },
                        legend: {
                            display: false
                        },
                        decimation: {
                            enabled: true,
                            algorithm: 'lttb',
                            samples: 100,
                            threshold: 75
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
     * Update existing chart with new data.
     * @private
     */
    _updateChart() {
        this.chart.data = this._getChartData();
        this.chart.update('none');
        this.chart.resize();
    }

    /**
     * Destroy the current chart instance if it exists.
     * @private
     */
    _destroyChart() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    /**
     * Generate data structure required by Chart.js.
     * @private
     * @returns {Object} Chart.js data object
     */
    _getChartData() {
        const datasets = [];

        for (const artistData of this.visibleArtists) {
            const chartData = this.props.dataType === 'listeners'
                ? artistData.chartListenersData
                : artistData.chartFollowersData;

            datasets.push({
                label: artistData.chartName,
                data: chartData.map(p => ({ x: new Date(p.x).getTime(),
                    y: p.y })),
                borderColor: artistData.chartColor,
                fill: false,
                hidden: this.localState.hiddenArtists.has(artistData.data.id)
            });
        }

        return { datasets };
    }

    /**
     * Handle click on a branch filter button.
     * @param {Event} ev
     * @private
     */
    _onClickFilterButton(ev) {
        const branch = ev.currentTarget.dataset.branch,
            newSet = new Set(this.hiddenBranches);

        if (newSet.has(branch)) {
            newSet.delete(branch);
        }
        else {
            newSet.add(branch);
        }

        this.envState.hiddenBranches = newSet;
    }

    /**
     * Handle click on an artist in the custom legend to toggle visibility.
     * @param {Event} ev
     * @private
     */
    _onClickLegendItem(ev) {
        const artistId = ev.currentTarget.dataset.artistId,
            newSet = new Set(this.localState.hiddenArtists);

        if (newSet.has(artistId)) {
            newSet.delete(artistId);
        }
        else {
            newSet.add(artistId);
        }

        this.localState.hiddenArtists = newSet;
    }

    /**
     * Reset zoom level of the chart.
     * @private
     */
    _onResetZoom() {
        if (this.chart) {
            this.chart.resetZoom();
        }
    }
}
