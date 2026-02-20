/**
 * Merge two strings, representing listes separated by a separator,
 * ensuring that entries within both lists only appear once in the final result.
 *
 * Optionally, the result can be sorted (alphabetically).
 *
 * @param {string} target
 * @param {string} source
 * @param {string} separator
 * @param {boolean} sort
 *
 * @return {string} merged list
 */
export function mergeList(target, source, separator, sort = false) {
  if (!target) {
    return source;
  }

  if (!source) {
    return target;
  }

  const tokens = [ ...new Set([
    ...target.split(separator),
    ...source.split(separator)
  ]) ].filter(Boolean);

  if (sort) {
    tokens.sort();
  }

  return tokens.join(separator);
}
