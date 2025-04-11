import 'bootstrap';

import { STATE } from './state';

import './main.scss';

/**
 * Loads artist data from index.json
 * @returns {Promise<*[]>}
 */
export async function loadArtistData() {
    const response = await fetch('./stats.json'),
        stats = await response.json();

    for (const data of stats.values()) {
        STATE.artistIndex.push(new ArtistData(data));
    }

    return STATE.artistIndex;
}

/**
 * Contains loaded artist data
 */
export class ArtistData {
    constructor(data) {
        this.data = data;
        this.error = false;
        this._chartListenersData = null;
        this._chartFollowersData = null;
    }

    get chartName() {
        return this.data['name'];
    }

    get chartColor() {
        if ('color' in this.data && this.data['color']) {
            return this.data['color'];
        }
        return '#000000';
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
}
