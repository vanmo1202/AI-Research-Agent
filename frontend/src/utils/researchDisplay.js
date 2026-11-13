export function describeResearchValue(value) {
  return typeof value === 'string'
    ? value
    : value?.description || value?.question || value?.text || value?.claim || JSON.stringify(value);
}
