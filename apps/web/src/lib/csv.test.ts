import { describe, expect, it } from 'vitest'

import { buildCsv } from './csv'

describe('buildCsv', () => {
  it('writes the header row and follows the column order given', () => {
    const csv = buildCsv(['b', 'a'], [{ a: 1, b: 2 }])

    expect(csv).toBe('b,a\r\n2,1')
  })

  it('quotes cells containing a comma, a quote, or a line break', () => {
    const csv = buildCsv(
      ['name', 'notes'],
      [
        { name: 'Berg, Petra', notes: 'said "sharp"' },
        { name: 'Lind', notes: 'two\nlines' },
      ],
    )

    expect(csv.split('\r\n')).toEqual([
      'name,notes',
      '"Berg, Petra","said ""sharp"""',
      'Lind,"two\nlines"',
    ])
  })

  it('writes empty cells for null and undefined rather than the words', () => {
    const csv = buildCsv(['a', 'b'], [{ a: null, b: undefined }])

    expect(csv).toBe('a,b\r\n,')
  })
})
