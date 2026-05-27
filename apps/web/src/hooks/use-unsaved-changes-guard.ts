'use client'

import { useEffect } from 'react'

type UseUnsavedChangesGuardOptions = {
  enabled: boolean
  message?: string
}

function isInternalNavigationLink(anchor: HTMLAnchorElement): boolean {
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) {
    return false
  }

  const href = anchor.getAttribute('href')
  if (!href || href.startsWith('#')) {
    return false
  }

  let url: URL
  try {
    url = new URL(anchor.href)
  } catch {
    return false
  }

  if (url.origin !== window.location.origin) {
    return false
  }

  return !(
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash === window.location.hash
  )
}

export function useUnsavedChangesGuard({
  enabled,
  message = 'You have unsaved changes. Leave anyway?',
}: UseUnsavedChangesGuardOptions) {
  useEffect(() => {
    if (!enabled) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    function handleDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (!isInternalNavigationLink(anchor)) return

      if (!window.confirm(message)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => document.removeEventListener('click', handleDocumentClick, true)
  }, [enabled, message])

  useEffect(() => {
    if (!enabled) return

    function handlePopState() {
      window.history.go(1)
      if (window.confirm(message)) {
        window.history.go(-1)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [enabled, message])
}
