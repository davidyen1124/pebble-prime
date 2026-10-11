// GSAP, and the one question every animation asks first.
import gsap from 'gsap'

export { gsap }
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
