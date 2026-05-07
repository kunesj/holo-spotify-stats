import * as owl from '@odoo/owl';

import { Chart } from 'chart.js/auto';

import { getAllBranches } from '~/artist';

import './rank_view.xml?owl';

export class RankView extends owl.Component {
    static props = {
        title: {type: String,
            optional: true},
        subtitle: {type: String,
            optional: true},
        dataType: {type: String}
    };
    static template = 'web.RankView';

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

    get branches() {
        return getAllBranches();
    }

    get hiddenBranches() {
        return this.envState.hiddenBranches;
    }

    _createChart() {
        this._destroyChart();

        const data = this._getChartData(),
            barCount = data.datasets[0].data.length;

        this.chart = new Chart(
            this.canvasRef.el,
            {
                type: 'bar',
                data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
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
                    },
                    onClick: (_event, elements) => {
                        if (elements.length > 0) {
                            const label = this.chart.data.labels[elements[0].index],
                                artist = this.envState.artistIndex.find(a => a.chartName === label);

                            if (artist) {
                                window.location.hash = '#artist/' + artist.data.id;
                            }
                        }
                    }
                }
            }
        );

        const containerHeight = `${3 + 1.5 * Math.max(barCount, 1)}rem`;

        this.canvasRef.el.parentElement.style.minHeight = containerHeight;
        this.canvasRef.el.parentElement.style.maxHeight = containerHeight;
        this.chart.resize();
    }

    _updateChart() {
        const data = this._getChartData(),
            barCount = data.datasets[0].data.length;

        this.chart.data.labels = data.labels;
        this.chart.data.datasets = data.datasets;
        const containerHeight = `${3 + 1.5 * Math.max(barCount, 1)}rem`;

        this.canvasRef.el.parentElement.style.minHeight = containerHeight;
        this.canvasRef.el.parentElement.style.maxHeight = containerHeight;
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
        const values = [];
        let datasetLabel;

        for (const artistData of this.envState.artistIndex) {
            let lastPoint;

            if (artistData.isHidden(this.hiddenBranches)) {
                continue;
            }

            const timelineData = this.props.dataType === 'listeners'
                ? artistData.chartListenersData
                : artistData.chartFollowersData;

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
}
