import { gsap, ScrollTrigger, $ } from './core';

/** Бегущая строка удобств: едет постоянно, скролл вниз/вверх меняет направление и ускоряет. */
export function marquee() {
  const track = $('[data-marquee]');
  if (!track) return;
  const loop = gsap.to(track, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
  let dir = 1;
  ScrollTrigger.create({
    trigger: track, start: 'top bottom', end: 'bottom top',
    onUpdate: (st) => {
      const d = st.direction;
      if (d !== dir) { dir = d; gsap.to(loop, { timeScale: d, duration: 0.4, overwrite: true }); }
      const boost = Math.min(Math.abs(st.getVelocity()) / 600, 3);
      gsap.to(loop, { timeScale: dir * (1 + boost), duration: 0.2, overwrite: true, onComplete: () => { gsap.to(loop, { timeScale: dir, duration: 0.8 }); } });
    },
    onToggle: (st) => (st.isActive ? loop.play() : loop.pause()),
  });
}
