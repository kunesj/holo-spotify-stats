import { readFile, writeFile, mkdir } from 'fs/promises';
import globby from 'globby';
import path from 'path';

/**
 * Vite plugin to build the consolidated stats.json file from individual artist JSONs.
 * @param {Object} options Plugin options
 * @param {string} options.srcDir Source directory containing JSON files
 * @param {string} options.destFile Destination file path for stats.json
 * @returns {import('vite').Plugin}
 */
export default function BuildStats(options = {}) {
    const {
        srcDir,
        destFile,
        ...restPluginOptions
    } = options;

    if (!srcDir) {
        throw new Error('srcDir must be set!');
    }

    if (!destFile) {
        throw new Error('destFile must be set!');
    }

    return {
        name: 'build-stats',
        buildEnd: async() => {
            const matchedPaths = await globby(`${srcDir}/**/*.json`, {
                    expandDirectories: false,
                    onlyFiles: true
                }),
                stats = [];

            console.info(`Collecting ${matchedPaths.length} stats...`);
            for (const matchedPath of matchedPaths) {
                stats.push(JSON.parse(await readFile(matchedPath, 'utf8')));
            }

            console.info(`Writing stats to ${destFile}`);
            await mkdir(path.dirname(destFile), { recursive: true });
            await writeFile(destFile, JSON.stringify(stats), {encoding: 'utf-8'});
        }
    };
}
