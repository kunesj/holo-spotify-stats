import * as owl from '@odoo/owl';

import { RankView } from '../rank_view/rank_view';
import { TimelineView } from '../timeline_view/timeline_view';
import { CompareView } from '../compare_view/compare_view';
import { ArtistDetailView } from '../artist_detail/artist_detail';

import './webclient.xml?owl';
import { loadArtistData } from '~/artist';

export class WebClient extends owl.Component {
    static components = { RankView,
        TimelineView,
        CompareView,
        ArtistDetailView };
    static template = 'web.WebClient';
    static props = {};
    static defaultProps = {};

    setup() {
        super.setup();
        this.envState = owl.useState(this.env.state);
        this.state = owl.useState({
            page: 'listeners:rank',
            searchText: '',
            showSearchDropdown: false,
            searchFocusedIndex: -1
        });

        owl.onWillStart(this.onWillStart.bind(this));
        owl.useExternalListener(window, 'click', this.onGlobalClick, { capture: true });
        owl.useExternalListener(window, 'hashchange', this._onHashChange.bind(this));
        owl.onError(this.onError.bind(this));
    }

    async onWillStart() {
        await loadArtistData();
        this._applyHash();
    }

    /**
     * All component errors must be caught, because OWL 2 destroys the whole App otherwise.
     * @param {*} err
     */
    onError(err) {
        console.error('Catching uncaught OWL error:', { err });
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

    // --- URL Routing ---

    _applyHash() {
        const hash = window.location.hash.slice(1);

        if (!hash) {
            return;
        }

        const parts = hash.split('/');

        if (parts[0] === 'artist' && parts[1]) {
            this.envState.selectedArtistId = parts[1];
            this.state.page = 'none:artist-detail';
            return;
        }

        if (parts[0] === 'compare') {
            this.envState.selectedArtistId = null;
            this.state.page = 'none:compare';
            return;
        }

        if ((parts[0] === 'rank' || parts[0] === 'timeline') &&
            (parts[1] === 'listeners' || parts[1] === 'followers')) {
            this.envState.selectedArtistId = null;
            this.state.page = `${parts[1]}:${parts[0]}`;
        }
    }

    _onHashChange() {
        this._applyHash();
    }

    // --- Computed ---

    get chartDataType() {
        const parts = this.state.page.split(':');

        return parts.length > 1 ? parts[0] : '';
    }

    get chartChartType() {
        const parts = this.state.page.split(':');

        return parts.length > 1 ? parts[1] : parts[0];
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

        if (!titleLeft && !titleRight) {
            return '';
        }

        return `${titleLeft} - ${titleRight}`;
    }

    get chartSubtitle() {
        if (this.chartDataType === 'listeners') {
            return 'Count of unique users that have listened to at least one song within 28-day window.';
        }
        return '';
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

    // --- Navigation ---

    /**
     * @param {MouseEvent} ev
     */
    _onPageClick(ev) {
        const page = ev.currentTarget.dataset.page,
            parts = page.split(':');

        this.envState.selectedArtistId = null;

        if (parts.length > 1) {
            window.location.hash = `#${parts[1]}/${parts[0]}`;
        }
        else {
            window.location.hash = `#${page}`;
        }
    }

    // --- Search ---

    _onSearchInput(ev) {
        this.state.searchText = ev.currentTarget.value;
        this.state.showSearchDropdown = true;
        this.state.searchFocusedIndex = -1;
    }

    _onSearchBlur() {
        setTimeout(() => {
            this.state.showSearchDropdown = false;
        }, 200);
    }

    _onSearchKeydown(ev) {
        const results = this.searchResults;

        if (ev.key === 'ArrowDown') {
            ev.preventDefault();
            this.state.searchFocusedIndex = Math.min(this.state.searchFocusedIndex + 1, results.length - 1);
        }
        else if (ev.key === 'ArrowUp') {
            ev.preventDefault();
            this.state.searchFocusedIndex = Math.max(this.state.searchFocusedIndex - 1, 0);
        }
        else if (ev.key === 'Enter' && this.state.searchFocusedIndex >= 0) {
            ev.preventDefault();
            this._navigateToArtist(results[this.state.searchFocusedIndex]);
        }
        else if (ev.key === 'Escape') {
            this.state.showSearchDropdown = false;
        }
    }

    _onClickSearchResult(ev) {
        const id = ev.currentTarget.dataset.artistId,
            artist = this.envState.artistIndex.find(a => a.data.id === id);

        this._navigateToArtist(artist);
    }

    _navigateToArtist(artistData) {
        if (!artistData) {
            return;
        }

        this.envState.selectedArtistId = artistData.data.id;
        this.state.page = 'none:artist-detail';
        this.state.searchText = '';
        this.state.showSearchDropdown = false;
        window.location.hash = `#artist/${artistData.data.id}`;
    }
}
