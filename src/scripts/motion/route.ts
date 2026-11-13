import { gsap, $$ } from './core';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Маршрут: жёлтая точка-«свет» идёт от метро к двери и оставляет за собой пунктир —
 * каждая точка проявляется ровно в момент, когда «свет» её проходит. У двери точка мягко тает.
 * Две схемы (десктоп горизонтальная, мобайл вертикальная) — анимируется та, что видна.
 * Без JS / reduced motion — статичный пунктир (path в разметке).
 */
export function route() {
  const svg = $$<SVGSVGElement>('[data-route-svg]').find((s) => s.getBoundingClientRect().width > 0);
  if (!svg || svg.dataset.routeInit) return;
  const path = svg.querySelector<SVGPathElement>('.route__path');
  const walker = svg.querySelector<SVGCircleElement>('[data-route-walker]');
  if (!path || !walker) return;
  svg.dataset.routeInit = '1';

  const step = parseFloat(path.getAttribute('stroke-dasharray')?.split(' ')[1] ?? '18') + 1;
  const r = parseFloat(path.getAttribute('stroke-width') ?? '7') / 2 + 0.1;
  const L = path.getTotalLength();
  const dots: { at: number; el: SVGCircleElement; shown: boolean }[] = [];
  for (let d = 0; d <= L; d += step) {
    const pt = path.getPointAtLength(d);
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1)); c.setAttribute('r', String(r));
    c.setAttribute('fill', 'var(--ink)'); c.style.opacity = '0';
    svg.insertBefore(c, walker);
    dots.push({ at: d, el: c, shown: false });
  }
  path.style.opacity = '0';

  const start = path.getPointAtLength(0);
  gsap.set(walker, { attr: { cx: start.x, cy: start.y }, opacity: 0, scale: 0.3, transformOrigin: '50% 50%' });

  const state = { p: 0 };
  const tl = gsap.timeline({ paused: true });
  tl.to(walker, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' })
    .to(state, {
      p: 1, duration: 3.2, ease: 'sine.inOut',
      onUpdate: () => {
        const len = state.p * L;
        const pt = path.getPointAtLength(len);
        walker.setAttribute('cx', pt.x.toFixed(1)); walker.setAttribute('cy', pt.y.toFixed(1));
        for (const d of dots) {
          if (!d.shown && d.at <= len) {
            d.shown = true;
            gsap.fromTo(d.el, { opacity: 0, attr: { r: r * 0.25 } }, { opacity: 1, attr: { r }, duration: 0.35, ease: 'power2.out' });
          }
        }
      },
    }, '-=0.15')
    // дошла до двери — точка мягко тает
    .to(walker, { opacity: 0, scale: 0.6, duration: 0.9, ease: 'power2.out' }, '-=0.05');

  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { tl.play(); io.disconnect(); }
  }, { threshold: 0.5 });
  io.observe(svg);
}
