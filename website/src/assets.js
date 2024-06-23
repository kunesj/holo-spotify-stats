// Init global template variable, just in case it was not added by vite plugin
if (!window.__OWL_TEMPLATES__) {
    window.__OWL_TEMPLATES__ = new DOMParser().parseFromString('<owltemplate/>', 'text/xml');
}

/**
 * Container DOM containing all the owl templates that have been loaded by vite plugin.
 * This can be imported by the modules in order to use it when loading the application and the components.
 */
export const templates = window.__OWL_TEMPLATES__;
