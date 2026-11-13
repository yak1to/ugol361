import { gsap, SplitText, EASE, $, $$, getLenis } from './core';

/** Прелоадер: «361» прокручивается на 361°, щелчок, шторка вверх. Потом хиро собирается по буквам. */
export function intro() {
  const html = document.documentElement;
  const pre = $('[data-preloader]');
  const hero = $('.hero');
  if (!hero) return;
  const letters = $$('.hero__logo .lg-u, .hero__logo .lg-g, .hero__logo .lg-dial, .hero__logo .lg-l', hero);
  const line = $('.hero__line', hero);
  const bits = $$('.hero__bar, .hero__cta', hero);

  if (!html.classList.contains('intro') || !pre) {
    pre?.remove();
    return;
  }
  getLenis()?.stop();

  const split = line ? new SplitText(line, { type: 'lines', mask: 'lines', aria: 'none' }) : null;
  gsap.set(letters, { yPercent: 0, y: 420 }); // SVG-единицы: буквы ниже нижнего края логотипа
  gsap.set(split?.lines ?? [], { yPercent: 105 });
  gsap.set(bits, { opacity: 0 });
  // буквы вылезают из-под «пола» логотипа
  $('.hero__logo svg', hero)?.setAttribute('style', 'overflow:hidden');

  const dial = $('.lg-dial', pre);
  const tl = gsap.timeline({
    defaults: { ease: EASE.in },
    onComplete: () => { pre.remove(); getLenis()?.start(); split?.revert(); $('.hero__logo svg', hero)?.removeAttribute('style'); },
  });
  tl.fromTo(dial, { rotation: 0, svgOrigin: '475 199' }, { rotation: 361, svgOrigin: '475 199', duration: 0.75, ease: 'back.out(1.6)' })
    // щелчок: циферблат дёргается на 1° назад, как защёлка
    .to(dial, { rotation: 360, duration: 0.08, ease: 'power2.out' })
    .to(pre, { yPercent: -100, duration: 0.45, ease: 'expo.inOut' }, '+=0.05')
    .to(letters, { y: 0, duration: 1.0, stagger: 0.07, ease: EASE.strong }, '-=0.2')
    .to(split?.lines ?? [], { yPercent: 0, duration: 0.8, stagger: 0.08 }, '-=0.7')
    .to(bits, { opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.6');
}

/** Орнамент на фасаде едет медленнее текста — бордовая стена «глубже» логотипа. */
export function ornamentParallax() {
  $$('.hero__ornament, .fcta__ornament').forEach((el) => {
    gsap.fromTo(el, { yPercent: -6 }, {
      yPercent: 6, ease: 'none',
      scrollTrigger: { trigger: el.parentElement!, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}
