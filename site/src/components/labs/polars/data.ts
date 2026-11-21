// The 8-row order table and the 4-row customer table that every Polars lesson uses (subjects/polars/code/plab.py).
// The labs compute groups, joins and filters from these rows in the browser; verify_labs.mts checks that the results
// are the numbers that exercises 02 to 05 assert.

export interface Order {
  id: number;
  customer: string;
  region: string | null;
  product: string;
  qty: number | null;
  price: number;
}

export const ORDERS: Order[] = [
  { id: 1, customer: 'Ann', region: 'north', product: 'pen', qty: 2, price: 1.5 },
  { id: 2, customer: 'Bob', region: 'south', product: 'ink', qty: 1, price: 8.0 },
  { id: 3, customer: 'Ann', region: 'north', product: 'pen', qty: 5, price: 1.5 },
  { id: 4, customer: 'Cat', region: 'east', product: 'book', qty: 1, price: 12.0 },
  { id: 5, customer: 'Bob', region: 'south', product: 'pen', qty: 3, price: 1.5 },
  { id: 6, customer: 'Ann', region: 'north', product: 'book', qty: 2, price: 12.0 },
  { id: 7, customer: 'Dan', region: null, product: 'ink', qty: 4, price: 8.0 },
  { id: 8, customer: 'Cat', region: 'east', product: 'pen', qty: null, price: 1.5 },
];

export const CUSTOMERS = [
  { customer: 'Ann', tier: 'gold' },
  { customer: 'Bob', tier: 'silver' },
  { customer: 'Cat', tier: 'silver' },
  { customer: 'Eve', tier: 'gold' },
];

export const total = (o: Order): number | null => (o.qty === null ? null : o.qty * o.price);

export const fmt = (v: number | null | string, d = 1): string => (v === null ? 'null' : typeof v === 'number' ? (Number.isInteger(v) && d === 0 ? String(v) : v.toFixed(d)) : v);

// ---- group_by ----
export function groupBy(rows: Order[]) {
  const order: string[] = [];
  const map = new Map<string, Order[]>();
  for (const r of rows) {
    if (!map.has(r.customer)) {
      map.set(r.customer, []);
      order.push(r.customer);
    }
    map.get(r.customer)!.push(r);
  }
  return order.map((c) => {
    const rs = map.get(c)!;
    const spent = rs.reduce((s, r) => s + (total(r) ?? 0), 0);
    return { customer: c, rows: rs, orders: rs.length, spent };
  });
}

// ---- joins on `customer` (orders on the left, customers on the right) ----
export type How = 'inner' | 'left' | 'right' | 'full' | 'semi' | 'anti';

export interface JoinRow {
  left: Order | null;
  right: { customer: string; tier: string } | null;
}

export function join(how: How): JoinRow[] {
  const out: JoinRow[] = [];
  const matched = new Set<string>();
  for (const o of ORDERS) {
    const c = CUSTOMERS.find((x) => x.customer === o.customer) ?? null;
    if (c) matched.add(c.customer);
    if (how === 'semi') {
      if (c) out.push({ left: o, right: null });
    } else if (how === 'anti') {
      if (!c) out.push({ left: o, right: null });
    } else if (how === 'inner' || how === 'right') {
      if (c) out.push({ left: o, right: c });
    } else {
      out.push({ left: o, right: c });
    }
  }
  if (how === 'right' || how === 'full') {
    for (const c of CUSTOMERS) if (!matched.has(c.customer)) out.push({ left: null, right: c });
  }
  return out;
}

// ---- three-valued comparison on qty ----
export type Test = 'gt2' | 'eq2' | 'ne2' | 'ne_missing' | 'is_null';
export type Tri = true | false | null;

export function testQty(test: Test, qty: number | null): Tri {
  switch (test) {
    case 'gt2': return qty === null ? null : qty > 2;
    case 'eq2': return qty === null ? null : qty === 2;
    case 'ne2': return qty === null ? null : qty !== 2;
    case 'ne_missing': return qty === null ? true : qty !== 2;
    case 'is_null': return qty === null;
  }
}
