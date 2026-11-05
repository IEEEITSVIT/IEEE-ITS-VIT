import { useEffect } from 'react'

/*
 * Shared page scroll lock. The preloader, mobile menu, popups and lightbox can overlap,
 * so each one takes a lock instead of writing body.style.overflow directly; the page
 * scrolls again only once every lock has been released.
 */
let locks = 0

/** Locks page scrolling and returns a function that releases this lock (safe to call twice). */
export function lockScroll() {
    if (locks++ === 0) document.body.style.overflow = 'hidden'
    let released = false
    return () => {
        if (released) return
        released = true
        if (--locks === 0) document.body.style.overflow = ''
    }
}

/** Holds a scroll lock while `active` is true. */
export function useScrollLock(active) {
    useEffect(() => (active ? lockScroll() : undefined), [active])
}
