import { describe, it, expect } from 'vitest'

import { chunkItems } from './chunk-items'

describe('chunkItems', () => {
  it('splits items into fixed-size chunks', () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})
