// imports: global dependencies, styles, models, components
import 'bootstrap';

// IMPORTANT: This must be the only style import in JS! Otherwise, every import duplicates all @use/@forward
import './main.scss';

// start

import { startWebClient } from '~/boot';

window.addEventListener('load', async() => {
    const debug = Boolean((new URLSearchParams(window.location.search)).get('debug'));

    try {
        await startWebClient(
            document.body,
            debug
        );
    }
    catch (e) {
        console.error('startWebClient error:', e);
        throw e;
    }
});
