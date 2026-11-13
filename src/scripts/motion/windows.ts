import { gsap, ScrollTrigger, $, $$ } from './core';

/** Окна на стене загораются по очереди, как вечерний город на их мурале. */
export function windows() {
  const all = $$('[data-window]');
  all.forEach((w) => w.classList.remove('is-lit'));
  ScrollTrigger.batch(all, {
    start: 'top 80%',
    onEnter: (batch) => batch.forEach((w, i) => gsap.delayedCall(i * 0.18 + Math.random() * 0.12, () => w.classList.add('is-lit'))),
    once: true,
  });
}

/** Манифест: слова проявляются по скроллу. Только opacity, без blur — дёшево для GPU. */
export function manifesto(split: typeof import('gsap/SplitText').SplitText) {
  const el = $('[data-manifesto]');
  if (!el) return;
  const s = new split(el.querySelectorAll('.manifesto__line'), { type: 'words', aria: 'none' });
  gsap.fromTo(s.words, { opacity: 0.12 }, {
    opacity: 1, ease: 'none', stagger: 0.1,
    scrollTrigger: { trigger: el, start: 'top 75%', end: 'bottom 45%', scrub: true },
  });
}
