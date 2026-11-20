export const GTIN = '8056262721391';
// Source: the Nov 19 Catalog configs worksheet's direct public-listing review.
// Its collection time was recorded to the minute; this is a dated price, not inventory.
export const THURSDAY_CATALOG_CSV = 'merchant,item_id,gtin,price_usd,source,observed_at,observed_precision,source_kind\n'
  + 'target,94901810,8056262721391,379.99,https://www.target.com/p/-/A-94901810,2026-11-19T21:40:00-08:00,minute,dated public listing snapshot\n';
export const PRODUCT = 'Ray-Ban Meta Wayfarer Gen 2 · Matte black · Clear nonprescription · Regular 50–22';
export const BRIEFS = {
  pickup: 'I’m leaving San Francisco Saturday morning. Find the regular matte-black Ray-Ban Meta Wayfarer Gen 2 with clear, nonprescription lenses for Friday-evening pickup near 94123. Check Best Buy, Target, and Ray-Ban. Tell me where you’d get them and what I’d pay.',
  quick: 'I’m comparing prices on Ray-Ban Meta Wayfarer Gen 2 glasses in matte black, regular size, with clear nonprescription lenses. What are the advertised prices at Best Buy, Target, and Ray-Ban near 94123? Please include the exact listings and identify the lowest price or a tie.'
};
export const MERCHANTS = [
  {id:'bestbuy', seller:'Best Buy', idField:'sku', item:'6642579', model:'0RW4012_601SSB50', link:'https://www.bestbuy.com/product/x/BCKFSGRX3H', storeId:'187', store:'1717 Harrison St, San Francisco', storeLink:'https://stores.bestbuy.com/ca/san-francisco/1717-harrison-st-187.html'},
  {id:'target', seller:'Target', idField:'tcin', item:'94901810', link:'https://www.target.com/p/-/A-94901810', storeId:'2768', store:'2675 Geary Blvd, San Francisco', storeLink:'https://www.target.com/sl/san-francisco-west--target-store/2768'},
  {id:'rayban', seller:'Ray-Ban', idField:'gtin', item:GTIN, link:'https://www.ray-ban.com/usa/electronics/RW4012ray-ban%20meta%20gen%202%20wayfarer-black/8056262721391'}
];
// First-party observations made during the event. Capture time stays fixed across runs.
export const CAPTURES = {
  bestbuy:{observedAt:'2026-11-20T11:16:00-08:00', price:284, evidence:'SKU 6642579, model 0RW4012_601SSB50. Advertised item price $284.'},
  target:{observedAt:'2026-11-20T11:16:00-08:00', price:284.99, evidence:'TCIN 94901810 and UPC 8056262721391, regular, clear lenses. Item $284.99. General In Stock.'},
  rayban:{observedAt:'2026-11-20T11:18:00-08:00', price:284.25, artifact:'ray-ban-item-price.jpg', evidence:'The exact manufacturer listing showed RW4012 601SSB 50–22 at $284.25.'}
};
export const LOCAL_CAPTURE = {
  id:'bb-187-20261120-111743', merchant:'bestbuy', gtin:GTIN, sku:'6642579', storeId:'187', postalSearch:'94123',
  source:MERCHANTS[0].link, storeSource:MERCHANTS[0].storeLink, mode:'dated merchant browser capture',
  observedAt:'2026-11-20T11:17:43-08:00', serviceDate:'2026-11-20', artifact:'best-buy-sf-pickup.jpg',
  readyEstimate:'1 hour', closesAt:'2026-11-20T21:00:00-08:00',
  evidence:'Exact-item store selector returned same-day availability and an estimated one-hour preparation time at 1717 Harrison St. Store closes at 9 p.m.'
};
export const CART_CAPTURE = {
  gtin:GTIN, sku:'6642579', storeId:'187', quantity:1,
  observedAt:'2026-11-20T11:19:53-08:00', mode:'dated merchant cart quote',
  source:'https://www.bestbuy.com/cart', artifact:'best-buy-cart-quote.jpg',
  item:284, pickupFee:0, taxEstimate:24.50, recyclingFee:4.26, quotedTotal:312.76
};
export const RAYBAN_PICKUP = {
  gtin:GTIN, level:'unavailable', mode:'dated merchant browser capture',
  observedAt:'2026-11-20T11:18:00-08:00', source:MERCHANTS[2].link, artifact:'ray-ban-sf-pickup.jpg',
  reason:'The exact-product store selector reported pickup unavailable within 50 miles of ZIP 94123.'
};
