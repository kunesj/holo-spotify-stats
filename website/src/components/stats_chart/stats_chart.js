import * as owl from '@odoo/owl';

import { Chart } from 'chart.js/auto';
import 'chartjs-adapter-moment';

import './stats_chart.xml?owl';

export class StatsChart extends owl.Component {
    static props = {
        title: {type: String,
            optional: true},
        subtitle: {type: String,
            optional: true},
        dataType: {type: String},
        chartType: {type: String}
    };
    static defaultProps = {
    };
    static template = 'web.StatsChart';

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

    onWillUpdateProps() {
        this._destroyChart();
    }

    onPatched() {
        if (!this.chart) {
            this._createChart();
        }
    }

    onWillUnmount() {
        this._destroyChart();
    }

    get branches() {
        const branches = new Set();

        for (const artistData of this.envState.artistIndex) {
            const gens = artistData.data['generations'];

            if (!gens || gens.length === 0) {
                branches.add('Other');
            }
            else {
                for (const gen of gens) {
                    branches.add(gen[0]);
                }
            }
        }

        branches.delete('INoNaKa Music');  // not relevant
        return branches;
    }

    get hiddenBranches() {
        return this.envState.hiddenBranches;
    }

    _createChart() {
        this._destroyChart();

        let minHeight = '5rem', 
            maxHeight;

        if (this.props.chartType === 'rank') {
            this.chart = this._createRankChart();
            minHeight = maxHeight = `${3 + 1.5 * Math.max(this.chart.data.datasets[0].data.length, 1)}rem`;
        }
        else if (this.props.chartType === 'timeline') {
            this.chart = this._createTimelineChart();
        }

        // Height of container must be specified when using maintainAspectRatio=false, otherwise chart throws error.
        this.canvasRef.el.parentElement.style.minHeight = minHeight;

        if (maxHeight) {
            this.canvasRef.el.parentElement.style.maxHeight = maxHeight;
        }
        else {
            this.canvasRef.el.parentElement.style.removeProperty('max-height');
        }
        this.chart.resize();
    }

    _destroyChart() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    _getArtistHidden(artistData) {
        const gens = artistData.data['generations'];

        if (!gens || gens.length === 0) {
            return this.hiddenBranches.has('Other');
        }

        for (const gen of gens) {
            if (!this.hiddenBranches.has(gen[0])) {
                return false;
            }
        }

        return true;
    }

    _createRankChart() {
        const data = this._getRankChartData();

        return new Chart(
            this.canvasRef.el,
            {
                type: 'bar',
                data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,  // expand vertically
                    animation: false, // disable all animations
                    plugins: {
                        title: {
                            display: !!this.props.title,
                            text: `${this.props.title} [${data.datasets[0].label}]`
                        },
                        subtitle: {
                            display: !!this.props.subtitle,
                            text: this.props.subtitle
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
    }

    _getRankChartData() {
        let values = [],
            datasetLabel;

        for (const artistData of this.envState.artistIndex) {
            let timelineData, lastPoint;

            if (this._getArtistHidden(artistData)) {
                continue;
            }

            switch (this.props.dataType) {
                case 'listeners':
                    timelineData = artistData.chartListenersData;
                    break;
                case 'followers':
                    timelineData = artistData.chartFollowersData;
                    break;
                default:
                    throw new Error(`Invalid dataType: ${this.props.dataType}`);
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

    _createTimelineChart() {
        return new Chart(
            this.canvasRef.el,
            {
                type: 'line',
                data: this._getTimelineChartData(),
                options: {
                    responsive: true,
                    animation: false, // disable all animations
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
                            display: true,
                            position: 'bottom'
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
    }

    _getTimelineChartData() {
        const artistIndex = this.envState.artistIndex.filter(artistData => {
            return !this._getArtistHidden(artistData);
        });

        return {
            datasets: artistIndex.map(artistData => {
                let chartData;

                switch (this.props.dataType) {
                    case 'listeners':
                        chartData = artistData.chartListenersData;
                        break;
                    case 'followers':
                        chartData = artistData.chartFollowersData;
                        break;
                    default:
                        throw new Error(`Invalid dataType: ${this.props.dataType}`);
                }

                return {
                    label: artistData.chartName,
                    data: chartData,
                    borderColor: artistData.chartColor,
                    hidden: this._getArtistHidden(artistData),
                    fill: false
                };
            })
        };
    }

    _onClickFilterButton(ev) {
        const branch = ev.currentTarget.dataset.branch;

        if (this.hiddenBranches.has(branch)) {
            this.hiddenBranches.delete(branch);
        }
        else {
            this.hiddenBranches.add(branch);
        }

        this._createChart();
    }
}
