import { STATE } from './state';

/**
 * Loads artist data from stats.json
 * @returns {Promise<ArtistData[]>}
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
 * Get an artist by their Spotify ID
 * @param {string} id
 * @returns {ArtistData|undefined}
 */
export function getArtistById(id) {
    return STATE.artistIndex.find(a => a.data.id === id);
}

/**
 * Get all artists belonging to a branch
 * @param {string} branch
 * @returns {ArtistData[]}
 */
export function getArtistsByBranch(branch) {
    return STATE.artistIndex.filter(a => {
        const gens = a.data.generations;

        if (!gens || gens.length === 0) {
            return branch === 'Other';
        }
        return gens.some(g => g[0] === branch);
    });
}

/**
 * Get all unique branch names from the artist index, sorted.
 * @returns {Set<string>}
 */
export function getAllBranches() {
    const branches = new Set();

    for (const artistData of STATE.artistIndex) {
        const gens = artistData.data.generations;

        if (!gens || gens.length === 0) {
            branches.add('Other');
        }
        else {
            for (const gen of gens) {
                branches.add(gen[0]);
            }
        }
    }

    branches.delete('INoNaKa Music');
    return new Set([...branches].sort());
}

/**
 * @type {number}
 * @private
 */
let _uidCounter = 0;

/**
 * Contains loaded artist data
 */
export class ArtistData {
    /**
     * @param {Object} data Raw artist data from JSON
     */
    constructor(data) {
        this.data = data;
        this._uid = _uidCounter++;
        this.error = false;
        this._chartListenersData = null;
        this._chartFollowersData = null;
    }

    /**
     * Get the name of the artist for chart labels.
     * @returns {string}
     */
    get chartName() {
        return this.data['name'];
    }

    /**
     * Get the color of the artist for charts.
     * @returns {string}
     */
    get chartColor() {
        if ('color' in this.data && this.data['color']) {
            return this.data['color'];
        }
        return '#000000';
    }

    /**
     * Get formatted listeners data for charts.
     * @returns {Array<{x: string, y: number}>}
     */
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

    /**
     * Get formatted followers data for charts.
     * @returns {Array<{x: string, y: number}>}
     */
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

    /**
     * Get current value for a data type (last data point).
     * @param {'listeners'|'followers'} dataType
     * @returns {number}
     */
    getCurrentValue(dataType) {
        const data = dataType === 'listeners' ? this.chartListenersData : this.chartFollowersData;

        if (data.length === 0) {
            return 0;
        }
        return data[data.length - 1].y;
    }

    /**
     * Compute rank among all artists for a given data type (1 = highest).
     * @param {'listeners'|'followers'} dataType
     * @returns {number}
     */
    getRank(dataType) {
        const values = STATE.artistIndex.map(a => ({
            id: a.data.id,
            value: a.getCurrentValue(dataType)
        }));

        values.sort((a, b) => b.value - a.value);
        return values.findIndex(v => v.id === this.data.id) + 1;
    }

    /**
     * Returns true if ALL the artist's generations are in the hidden set.
     * @param {Set<string>} hiddenBranches
     * @returns {boolean}
     */
    isHidden(hiddenBranches) {
        const gens = this.data.generations;

        if (!gens || gens.length === 0) {
            return hiddenBranches.has('Other');
        }

        for (const gen of gens) {
            if (!hiddenBranches.has(gen[0])) {
                return false;
            }
        }

        return true;
    }
}
