export interface Range {
  min: number
  max: number
}

export function isInRange(value: number, range: Range): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max
}
