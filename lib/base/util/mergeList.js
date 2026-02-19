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
