/**
 * Returns a string formatted using given values.
 * If the value is an object, its keys will replace `%(key)s` expressions.
 * If the values are a set of strings, they will replace `%s` expressions.
 * If no value is given, the string will not be formatted.
 *
 * @param {string} s
 * @param {any[]} values
 * @returns {string}
 */
export function sprintf(s, ...values) {
    if (values.length === 1 && Object.prototype.toString.call(values[0]) === '[object Object]') {
        const valuesDict = values[0];

        s = s.replace(/%\(([^)]+)\)s/g, (match, value) => valuesDict[value]);
    }
    else if (values.length > 0) {
        s = s.replace(/%s/g, () => values.shift());
    }
    return s;
}
