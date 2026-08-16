import { isInRange } from './validation'

describe('isInRange', () => {
  const range = { min: 1, max: 200 }

  it('accepts values inside the range, inclusive of both ends', () => {
    expect(isInRange(1, range)).toBe(true)
    expect(isInRange(200, range)).toBe(true)
    expect(isInRange(100, range)).toBe(true)
  })

  it('rejects values outside the range', () => {
    expect(isInRange(0, range)).toBe(false)
    expect(isInRange(201, range)).toBe(false)
    expect(isInRange(-5, range)).toBe(false)
  })

  it('rejects non-finite values -- a real case when an input field is cleared to empty', () => {
    expect(isInRange(NaN, range)).toBe(false)
    expect(isInRange(Infinity, range)).toBe(false)
  })
})
