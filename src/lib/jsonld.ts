import { site } from '../config/site';
import { url } from './url';

/** schema.org: у schema.org нет типа BarberShop, ближайший — HairSalon. */
export function barbershopJsonLd(origin: URL) {
  const p = site.prices;
  const all = [...p.items.map((i) => i.price), p.promo.price];
  return {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: site.name,
    alternateName: site.nameLatin,
    description: `${site.kind} у метро ${site.address.metro}`,
    url: new URL(url(), origin).href,
    image: new URL(url('og.png'), origin).href,
    telephone: site.phone.href.replace('tel:', ''),
    priceRange: `${Math.min(...all)}–${Math.max(...all)} ₽`,
    currenciesAccepted: 'RUB',
    paymentAccepted: 'Наличные, банковская карта, СБП, QR',
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      addressCountry: 'RU',
    },
    geo: { '@type': 'GeoCoordinates', latitude: site.address.geo.lat, longitude: site.address.geo.lon },
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: site.hours.open, closes: site.hours.close,
    }],
    aggregateRating: { '@type': 'AggregateRating', ratingValue: site.rating.value, ratingCount: site.rating.votes, reviewCount: site.rating.reviews, bestRating: 5 },
    potentialAction: { '@type': 'ReserveAction', target: site.booking.href, name: 'Записаться онлайн' },
    sameAs: site.socials.map((s) => s.href).filter((h) => h.startsWith('http')),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Услуги',
      itemListElement: [
        ...p.items.map((i) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: i.name }, price: i.price, priceCurrency: 'RUB' })),
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: p.promo.name }, price: p.promo.price, priceCurrency: 'RUB', description: p.promo.note },
      ],
    },
  };
}
