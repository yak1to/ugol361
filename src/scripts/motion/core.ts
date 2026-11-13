import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

// Кривые проекта. Заходы — expo/power4.out, «щелчки» — back с перелётом, микро — power2.
export const EASE = { in: 'expo.out', strong: 'power4.out', snap: 'back.out(2.2)', move: 'power3.inOut' } as const;

export const MQ = {
  desktop: '(min-width: 761px) and (prefers-reduced-motion: no-preference)',
  mobile: '(max-width: 760px) and (prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
  fine: '(hover: hover) and (pointer: fine)',
};

export const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s);
export const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T>(s)];

let lenis: Lenis | null = null;
export function smoothScroll() {
  if (matchMedia(MQ.reduce).matches) return null;
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  // якоря через Lenis, чтобы не дёргалось
  $$<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')!;
      if (id.length < 2) return;
      e.preventDefault();
      lenis!.scrollTo(id, { offset: 0, duration: 1.2 });
    }),
  );
  return lenis;
}
export const getLenis = () => lenis;
export { gsap, ScrollTrigger, SplitText };
