import * as owl from '@odoo/owl';

import { WebClient } from '~/components/webclient/webclient';
import { sprintf } from '~/utils/string';
import { templates } from '~/assets';
import { STATE } from '~/state';

/**
 * Starts services and WebClient
 *
 * @param {Element} mountTarget
 * @param {Boolean} debug
 * @returns {Promise<[owl.App, Object]>}
 */
export async function startWebClient(mountTarget, debug = false) {
    await owl.whenReady();

    const env = {
        bus: new owl.EventBus(),
        services: {},
        _t: (term, ...values) => sprintf(term, ...values),
        _lt: (term, ...values) => sprintf(term, ...values),
        debug,
        state: STATE
    };

    owl.Component.env = env;

    const app = new owl.App(WebClient, {
        name: 'HoloSpotifyStats',
        props: {},
        env,
        templates,
        dev: env.debug,
        test: true,
        warnIfNoStaticProps: true,
        translatableAttributes: ['data-tooltip'],
        translateFn: env._t
    });

    await app.mount(mountTarget);
    return [app, env];
}
