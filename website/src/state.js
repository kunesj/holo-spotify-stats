import * as owl from '@odoo/owl';

export const STATE = owl.reactive({
    artistIndex: [],
    hiddenBranches: new Set([
        // Not relevant + is subset of "Hololive JP"
        // - is completely removed from UI in stats_chart.js
        'INoNaKa Music',
        // Don't show group projects by default. Most people care only about the talent channels.
        'Other',
        // Don't show non-holo channels by default
        'Independent'
    ])
});
