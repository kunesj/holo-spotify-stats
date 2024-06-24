import * as owl from '@odoo/owl';

export const STATE = owl.reactive({
    artistIndex: [],
    hiddenBranches: new Set([
        'INoNaKa Music'  // not relevant
    ])
});
