import { describe, expect, it } from 'vitest'
import { marathonDomainFromLocation } from './marathon-domain'

describe('marathonDomainFromLocation — gallery routes', () => {
  it('resolves the domain from a local gallery path', () => {
    const domain = marathonDomainFromLocation({
      host: 'localhost:3002',
      href: 'http://localhost:3002/gallery/sthlm2025',
      pathname: '/gallery/sthlm2025',
    })
    expect(domain).toBe('sthlm2025')
  })

  it('resolves the domain from a nested local gallery topic path', () => {
    const domain = marathonDomainFromLocation({
      host: 'localhost:3002',
      href: 'http://localhost:3002/gallery/sthlmbycamera/2',
      pathname: '/gallery/sthlmbycamera/2',
    })
    expect(domain).toBe('sthlmbycamera')
  })

  it('resolves the domain from a *.localhost gallery subdomain', () => {
    const domain = marathonDomainFromLocation({
      host: 'sthlm2025.localhost:3002',
      href: 'http://sthlm2025.localhost:3002/gallery',
      pathname: '/gallery',
    })
    expect(domain).toBe('sthlm2025')
  })
})
