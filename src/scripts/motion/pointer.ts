import { gsap, $, $$ } from './core';

/** Магнитные кнопки: тянутся к курсору в радиусе, отпускают с лёгкой пружиной. */
export function magnetic() {
  const cleanups: (() => void)[] = [];
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const reach = Math.max(r.width, r.height) * 0.9;
      if (Math.hypot(dx, dy) > reach) { xTo(0); yTo(0); return; }
      xTo(dx * 0.3); yTo(dy * 0.35);
    };
    const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
    window.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave);
    cleanups.push(() => { window.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); gsap.set(el, { x: 0, y: 0 }); });
  });
  return () => cleanups.forEach((f) => f());
}

/** Курсор-«свет»: жёлтая точка, над лукбуком раскрывается в круг «смотреть». */
export function cursor() {
  const dot = document.createElement('div');
  dot.className = 'cursor'; dot.setAttribute('aria-hidden', 'true');
  dot.innerHTML = '<span class="cursor__dot"><span class="cursor__label">смотреть</span></span>';
  document.body.append(dot);
  gsap.set(dot, { xPercent: -50, yPercent: -50, opacity: 0 });
  const xTo = gsap.quickTo(dot, 'x', { duration: 0.18, ease: 'power3.out' });
  const yTo = gsap.quickTo(dot, 'y', { duration: 0.18, ease: 'power3.out' });
  const move = (e: PointerEvent) => { xTo(e.clientX); yTo(e.clientY); };
  window.addEventListener('pointermove', move, { passive: true });
  const show = () => gsap.to(dot, { opacity: 1, duration: 0.2 });
  const hide = () => gsap.to(dot, { opacity: 0, duration: 0.2 });
  document.documentElement.addEventListener('pointerenter', show);
  document.documentElement.addEventListener('pointerleave', hide);

  const zones: [string, string][] = [['[data-lookbook]', 'is-view'], ['a, button', 'is-link']];
  const over = (e: Event) => {
    const t = e.target as Element;
    for (const [sel, cls] of zones) dot.classList.toggle(cls, !!t.closest?.(sel));
  };
  document.addEventListener('pointerover', over);
  document.body.classList.add('has-cursor');
  return () => {
    window.removeEventListener('pointermove', move);
    document.removeEventListener('pointerover', over);
    document.body.classList.remove('has-cursor');
    dot.remove();
  };
}
