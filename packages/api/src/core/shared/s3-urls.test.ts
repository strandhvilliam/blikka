import { describe, expect, it } from 'vitest'

import {
  buildPathStyleS3Url,
  buildVirtualHostedS3Url,
  encodeS3ObjectKeyForUrl,
} from './s3-urls'

describe('encodeS3ObjectKeyForUrl', () => {
  it('encodes each path segment', () => {
    expect(encodeS3ObjectKeyForUrl('demo/REF 123/02/photo name.jpg')).toBe(
      'demo/REF%20123/02/photo%20name.jpg',
    )
  })

  it('leaves simple keys unchanged', () => {
    expect(encodeS3ObjectKeyForUrl('demo/REF123/02/photo.jpg')).toBe('demo/REF123/02/photo.jpg')
  })
})

describe('buildVirtualHostedS3Url', () => {
  it('returns undefined when key is missing', () => {
    expect(buildVirtualHostedS3Url('my-bucket', null)).toBeUndefined()
    expect(buildVirtualHostedS3Url('my-bucket', undefined)).toBeUndefined()
    expect(buildVirtualHostedS3Url('my-bucket', '')).toBeUndefined()
  })

  it('builds a virtual-hosted URL with encoded key segments', () => {
    expect(buildVirtualHostedS3Url('my-bucket', 'demo/REF 123/photo.jpg')).toBe(
      'https://my-bucket.s3.eu-north-1.amazonaws.com/demo/REF%20123/photo.jpg',
    )
  })
})

describe('buildPathStyleS3Url', () => {
  it('returns undefined when key is missing', () => {
    expect(buildPathStyleS3Url('my-bucket', null)).toBeUndefined()
  })

  it('builds a path-style URL without encoding the key', () => {
    expect(buildPathStyleS3Url('my-bucket', 'demo/REF123/photo.jpg')).toBe(
      'https://s3.eu-north-1.amazonaws.com/my-bucket/demo/REF123/photo.jpg',
    )
  })
})
