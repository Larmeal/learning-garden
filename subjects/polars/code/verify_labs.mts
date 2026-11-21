// Checks that the browser code of the Polars labs (site/src/components/labs/polars/data.ts) gives the numbers that
// exercises 02 to 05 assert. Run from the repo root: node subjects/polars/code/verify_labs.mts (Node 22.18 or newer).
import { CUSTOMERS, ORDERS, groupBy, join, testQty, total, type How, type Test } from '../../../site/src/components/labs/polars/data.ts';

let fails = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  if (!ok) fails++;
};

// exercise 02: filter(qty * price > 10) keeps orders 4, 6, 7
eq('filter total > 10', ORDERS.filter((o) => (total(o) ?? 0) > 10).map((o) => o.id), [4, 6, 7]);
eq('row 8 total is null', total(ORDERS[7]), null);

// exercise 04: spent per customer
eq('spent per customer', groupBy(ORDERS).map((g) => [g.customer, g.spent]), [['Ann', 34.5], ['Bob', 12.5], ['Cat', 12], ['Dan', 32]]);
eq('orders per customer', groupBy(ORDERS).map((g) => g.orders), [3, 2, 2, 1]);

// exercise 05: join row counts
const want: Record<How, number> = { inner: 7, left: 8, right: 8, full: 9, semi: 7, anti: 1 };
for (const h of Object.keys(want) as How[]) eq(`join ${h}`, join(h).length, want[h]);
eq('anti is order 7', join('anti').map((r) => r.left?.id), [7]);
eq('customers', CUSTOMERS.length, 4);

// exercise 03: comparisons with null
const kept = (t: Test) => ORDERS.filter((o) => testQty(t, o.qty) === true).length;
eq('qty > 2 keeps 3', kept('gt2'), 3);
eq('ne_missing(2) keeps 6', kept('ne_missing'), 6);
eq('is_null keeps 1', kept('is_null'), 1);
eq('qty != 2 keeps 5 (null row dropped)', kept('ne2'), 5);

console.log(fails ? `${fails} failed` : 'all labs agree with the exercises');
process.exit(fails ? 1 : 0);
