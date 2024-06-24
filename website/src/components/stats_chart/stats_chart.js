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
        // Height of container must be specified when using maintainAspectRatio=false, otherwise chart throws error.
        if (!this.canvasRef.el.parentElement.style.minHeight) {
            this.canvasRef.el.parentElement.style.minHeight = '5rem';
        }

        this._createChart();
    }

    onWillUpdateProps() {
        this._destroyChart();
    }

    onPatched() {
        if (this.chart) {
            this._updateChart();
        }
        else {
            this._createChart();
        }
    }

    onWillUnmount() {
        this._destroyChart();
    }

    _createChart() {
        this._destroyChart();

        if (this.props.chartType === 'rank') {
            this.chart = this._createRankChart();
        }
        else if (this.props.chartType === 'timeline') {
            this.chart = this._createTimelineChart();
        }

        // apply style changes etc.
        this._updateChart();
    }

    _updateChart() {
        let oldData = this.chart.data,
            oldTitle = this.chart.options.plugins.title.text,
            oldMinHeight = this.canvasRef.el.parentElement.style.minHeight;

        if (this.props.chartType === 'rank') {
            this.chart.data = this._getRankChartData();
        }
        else if (this.props.chartType === 'timeline') {
            this.chart.data = this._getTimelineChartData();
        }

        if (this.props.chartType === 'rank') {
            this.chart.options.plugins.title.text = `${this.props.title} [${this.chart.data.datasets[0].label}]`;
        }

        if (this.props.chartType === 'rank') {
            this.canvasRef.el.parentElement.style.minHeight = `${3 + 1.5 * Math.max(this.chart.data.datasets[0].data.length, 1)}rem`;
        }
        else {
            this.canvasRef.el.parentElement.style.minHeight = '5rem';
        }

        if (
            JSON.stringify(this.chart.data) !== JSON.stringify(oldData)
            || this.chart.options.plugins.title.text !== oldTitle
            || this.canvasRef.el.parentElement.style.minHeight !== oldMinHeight
        ) {
            this.chart.update(undefined);
        }
    }

    _destroyChart() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    _createRankChart() {
        return new Chart(
            this.canvasRef.el,
            {
                type: 'bar',
                data: this._getRankChartData(),
                options: {
                    responsive: true,
                    maintainAspectRatio: false,  // expand vertically
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
                            position: 'bottom',
                            labels: {
                                filter: function(item, chart) {
                                    // Filter later
                                    return true;
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
    }

    _getTimelineChartData() {
        return {
            datasets: this.envState.artistIndex.map(artistData => {
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
                    hidden: false,
                    fill: false
                };
            })
        };
    }
}
