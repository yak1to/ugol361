import { gsap, ScrollTrigger, $, $$ } from './core';

/** Скролл = градусы. 000° → 361°, на финише щелчок и жёлтый цвет. */
export function degreeCounter() {
  const boxes = $$('[data-degree-counter].deg-fixed, [data-degree-counter].mbar__deg');
  if (!boxes.length) return;
  let last = -1;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (st) => {
      const v = Math.round(st.progress * 361);
      if (v === last) return;
      last = v;
      for (const box of boxes) {
        const num = $('.deg__num', box);
        if (num) num.textContent = String(v).padStart(3, '0');
        box.classList.toggle('is-full', v >= 361);
      }
    },
  });
}

/** «5.0» на отзывах набирается от нуля, когда секция входит в кадр. */
export function ratingCount() {
  $$('[data-count-to]').forEach((el) => {
    const to = parseFloat(el.dataset.countTo!);
    const o = { v: 0 };
    el.textContent = '0.0';
    gsap.to(o, {
      v: to, duration: 1.4, ease: 'expo.out',
      onUpdate: () => (el.textContent = o.v.toFixed(1)),
      scrollTrigger: { trigger: el, start: 'top 75%', once: true },
    });
  });
}

/** Промо-стикер «шлёпают» на вывеску: перелёт масштаба и поворота. */
export function promoSlap() {
  $$('.promo').forEach((el) => {
    gsap.from(el, {
      scale: 1.25, rotation: -14, opacity: 0, duration: 0.55, ease: 'back.out(2.4)',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });
}
