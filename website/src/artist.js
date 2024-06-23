import 'bootstrap';

import { hsvToRgb } from './utils';

import './main.scss';

export const artistIndex = [];

/**
 * Loads artist data from index.json
 * @returns {Promise<*[]>}
 */
export async function loadArtistIndex() {
    const response = await fetch('./index.json'),
        paths = await response.json();

    for (const [index, path] of paths.entries()) {
        const [r, g, b] = hsvToRgb(index / paths.length, 1.0, 0.95),
            chartColor = `rgb(${r}, ${g}, ${b})`;

        artistIndex.push(new ArtistData(path, chartColor));
    }

    return artistIndex;
}

/**
 * Contains loaded artist data
 */
export class ArtistData {
    static UNLOADED_NAME = '???';
    static ERROR_NAME = '<error>';

    constructor(dataPath, chartColor) {
        this.dataPath = dataPath;
        this.chartColor = chartColor;
        this.error = false;
        this._data = null;
        this._chartListenersData = null;
        this._chartFollowersData = null;
        this._chartTop10PlayCountSumData = null;
        this._chartTop10PlayCountMaxData = null;
    }

    async getData() {
        if (!this._data) {
            const response = await fetch(this.dataPath);

            this._data = await response.json();
            this.error = false;
        }
        return this._data;
    }

    get chartName() {
        if (this._data) {
            return this._data['name'];
        }
        else if (this.error) {
            return ArtistData.ERROR_NAME;
        }
        else {
            return ArtistData.UNLOADED_NAME;
        }
    }

    get chartListenersData() {
        if (this._chartListenersData) {
            return this._chartListenersData;
        }
        else if (this._data) {
            const data = [];

            for (const [key, value] of Object.entries(this._data['stats'])) {
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
        else {
            return [];
        }
    }

    get chartFollowersData() {
        if (this._chartFollowersData) {
            return this._chartFollowersData;
        }
        else if (this._data) {
            const data = [];

            for (const [key, value] of Object.entries(this._data['stats'])) {
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
        else {
            return [];
        }
    }

    get chartTop10PlayCountSumData() {
        if (this._chartTop10PlayCountSumData) {
            return this._chartTop10PlayCountSumData;
        }
        else if (this._data) {
            const data = [];

            for (const [key, value] of Object.entries(this._data['stats'])) {
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
        else {
            return [];
        }
    }

    get chartTop10PlayCountMaxData() {
        if (this._chartTop10PlayCountMaxData) {
            return this._chartTop10PlayCountMaxData;
        }
        else if (this._data) {
            const data = [];

            for (const [key, value] of Object.entries(this._data['stats'])) {
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
        else {
            return [];
        }
    }
}
