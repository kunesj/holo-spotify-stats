const fileRegex = /\.xml\?owl$/,

    registerTemplatesJS = `
function registerTemplates(value) {
    if (!value) {
        return;
    }

    // Init container DOM containing all the owl templates that have been loaded.

    if (!window.__OWL_TEMPLATES__) {
        window.__OWL_TEMPLATES__ = new DOMParser().parseFromString('<owltemplate/>', 'text/xml'); 
    }
    
    // parse template string

    const doc = new DOMParser().parseFromString(value, 'text/xml');

    if (doc.querySelector('parsererror')) {
        // The generated error XML is non-standard so we log the full content to
        // ensure that the relevant info is actually logged.
        throw new Error(doc.querySelector('parsererror').textContent.trim());
    }
   
    // add to global templates

    for (const element of doc.querySelectorAll('templates > [t-name]')) {
        window.__OWL_TEMPLATES__.documentElement.appendChild(element);
    }
   
    // refresh templates of all apps

    // eslint-disable-next-line no-undef
    const apps = __OWL_DEVTOOLS__.apps;
    for (/** @type {owl.App} */ const app of apps) {
        app.addTemplates(window.__OWL_TEMPLATES__);
    }
}
`;

function compileXmlToJS(xml) {
    const xmlJson = JSON.stringify(xml)
        // escape line separator
        .replace(/\u2028/g, '\\u2028')
        // escape paragraph separator
        .replace(/\u2029/g, '\\u2029');

    return `   
    ${registerTemplatesJS}

    const xml = ${xmlJson};
    
    registerTemplates(xml);    
    export default xml;
    `.trim();
}

export default function OwlXmlLoader() {
    return {
        name: 'owl-xml-loader',
        transform(src, id) {
            if (fileRegex.test(id)) {
                return {
                    code: compileXmlToJS(src),
                    map: null // provide source map if available
                };
            }
        }
    };
}
