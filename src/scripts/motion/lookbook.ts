import { gsap, $ } from './core';

/** Лукбук: на десктопе вертикальный скролл двигает ленту вбок (pin). На мобайле — нативный свайп. */
export function lookbook() {
  const sec = $('.lookbook');
  const track = $('[data-lookbook]');
  if (!sec || !track) return;
  track.classList.add('is-pinned');
  const dist = () => track.scrollWidth - window.innerWidth;
  gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 },
  });
  return () => track.classList.remove('is-pinned');
}
