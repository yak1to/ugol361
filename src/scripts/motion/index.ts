import { gsap, ScrollTrigger, SplitText, MQ, smoothScroll } from './core';
import { intro, ornamentParallax } from './intro';
import { windows, manifesto } from './windows';
import { lookbook } from './lookbook';
import { degreeCounter, ratingCount, promoSlap } from './counter';
import { marquee } from './marquee';
import { magnetic, cursor } from './pointer';
import { route } from './route';

/**
 * Порядок как в PLAN.md: Lenis+ScrollTrigger → прелоадер → хиро → дверь → окна → лукбук →
 * прайс → счётчик → магнит/курсор → маршрут. Тяжёлое — только на десктопе;
 * prefers-reduced-motion — мгновенные финальные состояния.
 */
export function initMotion() {
  smoothScroll();
  intro();
  degreeCounter(); // это состояние, а не движение — работает всегда

  const mm = gsap.matchMedia();
  mm.add({ desktop: MQ.desktop, mobile: MQ.mobile }, (ctx) => {
    const { desktop } = ctx.conditions as { desktop: boolean };
    ornamentParallax();
    windows();
    manifesto(SplitText);
    if (desktop) lookbook();
    promoSlap();
    marquee();
    ratingCount();
    route();
  });
  mm.add(`${MQ.desktop} and ${MQ.fine}`, () => {
    const a = magnetic();
    const b = cursor();
    return () => { a(); b(); };
  });

  // картинки догружаются — пересчитать позиции пинов
  window.addEventListener('load', () => ScrollTrigger.refresh());
}
