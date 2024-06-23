import 'bootstrap';

import { hsvToRgb } from './utils/color';
import { STATE } from './state';

import './main.scss';

/**
 * Loads artist data from index.json
 * @returns {Promise<*[]>}
 */
export async function loadArtistData() {
    const response = await fetch('./stats.json'),
        stats = await response.json();

    for (const [index, data] of stats.entries()) {
        const [r, g, b] = hsvToRgb(index / stats.length, 1.0, 0.95),
            chartColor = `rgb(${r}, ${g}, ${b})`;

        STATE.artistIndex.push(new ArtistData(data, chartColor));
    }

    return STATE.artistIndex;
}

/**
 * Contains loaded artist data
 */
export class ArtistData {
    constructor(data, chartColor) {
        this.data = data;
        this.chartColor = chartColor;
        this.error = false;
        this._chartListenersData = null;
        this._chartFollowersData = null;
        this._chartTop10PlayCountSumData = null;
        this._chartTop10PlayCountMaxData = null;
    }

    get chartName() {
        return this.data['name'];
    }

    get chartListenersData() {
        if (this._chartListenersData) {
            return this._chartListenersData;
        }

        const data = [];

        for (const [key, value] of Object.entries(this.data['stats'])) {
            if ('monthlyListeners' in value) {
                data.push({
                    x: key,
                    y: value['monthlyListeners']
                });
            }
        }

        this._chartListenersData = data;
        return this._chartListenersData;
    }

    get chartFollowersData() {
        if (this._chartFollowersData) {
            return this._chartFollowersData;
        }

        const data = [];

        for (const [key, value] of Object.entries(this.data['stats'])) {
            if ('followers' in value) {
                data.push({
                    x: key,
                    y: value['followers']
                });
            }
        }

        this._chartFollowersData = data;
        return this._chartFollowersData;
    }

    get chartTop10PlayCountSumData() {
        if (this._chartTop10PlayCountSumData) {
            return this._chartTop10PlayCountSumData;
        }

        const data = [];

        for (const [key, value] of Object.entries(this.data['stats'])) {
            if ('top_tracks_playcount' in value) {
                data.push({
                    x: key,
                    y: value['top_tracks_playcount'].reduce((pv, cv) => pv + cv, 0)
                });
            }
        }

        this._chartTop10PlayCountSumData = data;
        return this._chartTop10PlayCountSumData;
    }

    get chartTop10PlayCountMaxData() {
        if (this._chartTop10PlayCountMaxData) {
            return this._chartTop10PlayCountMaxData;
        }

        const data = [];

        for (const [key, value] of Object.entries(this.data['stats'])) {
            if ('top_tracks_playcount' in value) {
                data.push({
                    x: key,
                    y: Math.max(...value['top_tracks_playcount'], 0)
                });
            }
        }

        this._chartTop10PlayCountMaxData = data;
        return this._chartTop10PlayCountMaxData;
    }
}
