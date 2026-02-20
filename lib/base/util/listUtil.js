/**
 * Merge two strings, representing lists separated by a separator,
 * ensuring that entries within both lists only appear once in the final result.
 *
 * @param {string} target
 * @param {string} source
 * @param {string} separator
 *
 * @return {string} merged list
 */
export function mergeList(target, source, separator) {
  if (!target) {
    return source;
  }

  if (!source) {
    return target;
  }

  // merge both source and target, ensuring no duplicate values
  const existing = new Set([
    ...target.split(separator),
    ...source.split(separator)
  ]);

  return Array.from(existing).join(separator);
}