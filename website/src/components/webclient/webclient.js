import * as owl from '@odoo/owl';

import { StatsChart } from '../stats_chart/stats_chart';

import './webclient.xml?owl';
import {loadArtistData} from '~/artist.js';

export class WebClient extends owl.Component {
    static components = { StatsChart };
    static template = 'web.WebClient';
    static props = {};
    static defaultProps = {};

    setup() {
        super.setup();
        this.envState = owl.useState(this.env.state);
        this.state = owl.useState({
            page: 'listeners:rank'
        });

        owl.onWillStart(this.onWillStart.bind(this));
        owl.useExternalListener(window, 'click', this.onGlobalClick, { capture: true });
        owl.onError(this.onError.bind(this));
    }

    async onWillStart() {
        await loadArtistData();
    }

    /**
     * All component errors must be caught, because OWL 2 destroys the whole App otherwise.
     * @param {*} err
     */
    onError(err) {
        console.error('Catching uncaught OWL error:', {err});
    }

    /**
     * @param {MouseEvent} ev
     */
    onGlobalClick(ev) {
        // When a ctrl-click occurs inside an <a href/> element we let the browser do the default behavior and
        // we do not want any other listener to execute.
        if (
            ev.ctrlKey &&
            ((ev.target instanceof HTMLAnchorElement && ev.target.href) ||
                (ev.target instanceof HTMLElement && ev.target.closest('a[href]:not([href=\'\'])')))
        ) {
            ev.stopImmediatePropagation();
        }
    }

    get chartDataType() {
        return this.state.page.split(':')[0];
    }

    get chartChartType() {
        return this.state.page.split(':')[1];
    }

    get chartTitle() {
        let titleLeft = '', 
            titleRight = '';

        if (this.chartDataType === 'listeners') {
            titleLeft = 'Monthly Listeners';
        }
        else if (this.chartDataType === 'followers') {
            titleLeft = 'Followers';
        }

        if (this.chartChartType === 'rank') {
            titleRight = 'Rank';
        }
        else if (this.chartChartType === 'timeline') {
            titleRight = 'Timeline';
        }

        return `${titleLeft} - ${titleRight}`;
    }

    get chartSubtitle() {
        if (this.chartDataType === 'listeners') {
            return 'Count of unique users that have listened to at least one song within 28-day window.';
        }
        return '';
    }

    _onPageClick(ev) {
        this.state.page = ev.currentTarget.dataset.page;
    }
}
