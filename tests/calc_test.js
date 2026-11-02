// Unit tests for the MoneyBias calculation module. Expected values were computed separately in Python.
// Run: node calc_test.js moneybias.html
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const block = src.slice(src.indexOf('/* CALC-START'), src.indexOf('/* CALC-END */'));
const MBC = new Function(block + '; return MBC;')();
let pass = 0, fail = 0;
const near = (a, b, tol = 0.01) => a != null && Math.abs(a - b) <= tol;
function t(name, cond, got){ if (cond){ pass++; } else { fail++; console.log('FAIL', name, '→ got', JSON.stringify(got)); } }
const section = s => console.log('\n# ' + s);

section('Indian currency formatting');
t('₹1,00,000', MBC.inr(100000) === '₹1,00,000', MBC.inr(100000));
t('₹12,50,000', MBC.inr(1250000) === '₹12,50,000', MBC.inr(1250000));
t('₹1,50,00,000', MBC.inr(15000000) === '₹1,50,00,000', MBC.inr(15000000));
t('₹999 and ₹0', MBC.inr(999) === '₹999' && MBC.inr(0) === '₹0');
t('negative', MBC.inr(-5000) === '−₹5,000', MBC.inr(-5000));
t('NaN and Infinity show a dash, never NaN', MBC.inr(NaN) === '—' && MBC.inr(Infinity) === '—');
t('two decimals', MBC.inr(1234.5, 2) === '₹1,234.50', MBC.inr(1234.5, 2));
t('rounds to nearest rupee', MBC.inr(1063.44) === '₹1,063' && MBC.inr(1063.5) === '₹1,064');

section('Input validation');
t('empty required', MBC.parseAmount('', {label:'Price'}).error === 'Price is needed.');
t('empty optional', MBC.parseAmount('', {required:false}).error === null);
t('negative rejected', /negative/.test(MBC.parseAmount('-5').error));
t('text rejected', /number/.test(MBC.parseAmount('abc').error));
t('commas and ₹ accepted', MBC.parseAmount('₹1,00,000').value === 100000);
t('zero rejected unless allowed', MBC.parseAmount('0').error && MBC.parseAmount('0', {allowZero:true}).value === 0);
t('huge rejected', /too large/.test(MBC.parseAmount('1e20').error));

section('Should I buy this?');
t('days: ₹2,999 of ₹25,000/month = 3.5988 days', near(MBC.daysOfMoney(2999, 25000), 3.5988, 1e-4));
t('days: no income → null (no divide by zero)', MBC.daysOfMoney(100, 0) === null && MBC.daysOfMoney(0, 100) === null);
t('FV ₹1,000 at 8% for 10 years = 2158.925', near(MBC.futureValue(1000, 8, 10), 2158.925, 1e-3));
t('FV ₹2,999 at 8%: 10y 6474.62, 5y 4406.51', near(MBC.futureValue(2999, 8, 10), 6474.62) && near(MBC.futureValue(2999, 8, 5), 4406.51));
t('FV at 0% unchanged', MBC.futureValue(1000, 0, 10) === 1000);
t('FV negative return allowed (−5% for 2y = 902.5)', near(MBC.futureValue(1000, -5, 2), 902.5));
t('FV at −100% rejected', MBC.futureValue(1000, -100, 1) === null);
const d = MBC.discount(7999, 2999);
t('discount ₹5,000 = 62.508%', d.valid && d.amount === 5000 && near(d.percent, 62.508, 1e-3), d);
t('MRP equal → invalid "equal"', MBC.discount(2999, 2999).reason === 'equal');
t('MRP lower → invalid "lower"', MBC.discount(1999, 2999).reason === 'lower');
t('no MRP → "missing"', MBC.discount(0, 2999).reason === 'missing');

section('EMI formula and schedule');
t('EMI ₹1,00,000 at 12% for 12 months = 8884.88', near(MBC.emi(100000, 12, 12), 8884.8789, 1e-3));
t('EMI ₹60,000 at 15% for 12 months = 5415.50', near(MBC.emi(60000, 15, 12), 5415.4987, 1e-3));
t('EMI at 0% = principal ÷ months', MBC.emi(60000, 0, 12) === 5000);
t('EMI invalid months → null', MBC.emi(1000, 10, 0) === null);
const am = MBC.amortise(60000, 15, 12);
t('schedule: month 1 interest = 60,000 × 1.25% = 750', near(am.rows[0].interest, 750, 1e-9));
t('schedule: month 1 principal = EMI − 750', near(am.rows[0].principal, 5415.4987 - 750, 1e-3));
t('schedule: principal parts add up to the loan', near(am.rows.reduce((s, r) => s + r.principal, 0), 60000, 1e-6));
t('schedule: ends at exactly 0', am.rows[11].balance === 0);
t('schedule: total interest = EMI × 12 − principal', near(am.totalInterest, 5415.4987 * 12 - 60000, 0.01));

section('"No-cost" EMI');
const nc = MBC.noCostEmi({price:60000, months:12, annualRatePct:15, fee:199});
t('typical: principal financed 55,396.56', near(nc.principal, 55396.5598));
t('typical: EMI = ₹5,000 (EMIs add up to the price)', near(nc.emi, 5000, 1e-6));
t('typical: bank interest 4,603.44 = seller discount', near(nc.interest, 4603.4402) && near(nc.sellerDiscount, 4603.4402));
t('typical: GST on interest 828.62', near(nc.gstOnInterest, 828.6192, 1e-3));
t('typical: fee 199 + GST 35.82', nc.fee === 199 && near(nc.feeGst, 35.82));
t('typical: total paid 61,063.44 → ₹1,063.44 extra', near(nc.totalPaid, 61063.44) && near(nc.extraCost, 1063.44));
const ne = MBC.noCostEmi({price:60000, months:12, annualRatePct:15, discountMode:'entered', discountAmount:3000, fee:199});
t('entered ₹3,000 discount: EMI 5144.72, interest 4736.69', near(ne.emi, 5144.7238) && near(ne.interest, 4736.6856));
t('entered ₹3,000: interest not covered = 1736.69', near(ne.interestNotCovered, 1736.6856));
t('entered ₹3,000: total paid 62,824.11', near(ne.totalPaid, 62824.1091));
const nb = MBC.noCostEmi({price:60000, months:12, annualRatePct:15, discountMode:'entered', discountAmount:8000, fee:199});
t('discount larger than costs → cheaper than upfront (−2,666.18)', near(nb.extraCost, -2666.1795));
const nz = MBC.noCostEmi({price:60000, months:12, annualRatePct:0, fee:199});
t('0% interest: only the fee with GST (234.82)', near(nz.interest, 0) && near(nz.extraCost, 234.82));
const nu = MBC.noCostEmi({price:60000, months:12, annualRatePct:15, fee:0, upfrontPrice:57000});
t('compare against a lower pay-upfront price', near(nu.extraCost, 60000 + 828.6192 - 57000));
t('invalid inputs → null', MBC.noCostEmi({price:0, months:12, annualRatePct:15}) === null && MBC.noCostEmi({price:1000, months:0, annualRatePct:15}) === null);

section('Credit card repayment');
const rule5 = {type:'percent', percent:5, floor:200};
const c = MBC.cardRepayment({balance:50000, monthlyRatePct:3.75, plan:'minimum', rule:rule5});
const R = c.rows;
t('statement 1 has no interest', R[0].statement === 50000 && R[0].interest === 0);
t('month 1: minimum 2,500, left 47,500', R[0].minDue === 2500 && R[0].left === 47500);
t('month 2: interest 1,781.25 + GST 320.625 → statement 49,601.875', near(R[1].interest, 1781.25, 1e-9) && near(R[1].gst, 320.625, 1e-9) && near(R[1].statement, 49601.875, 1e-6));
t('month 2: minimum = ⌈5% of 49,601.875⌉ = 2,481', R[1].minDue === 2481);
t('month 3: interest on ₹47,120.875 = 1,767.03 + GST 318.07; minimum ⌈5% of 49,205.97⌉ = 2,461', near(R[2].interest, 1767.03281, 1e-4) && near(R[2].gst, 318.06591, 1e-4) && R[2].minDue === 2461, R[2]);
t('cleared: total paid = bill + interest + GST', c.status === 'cleared' && near(c.totalPaid, 50000 + c.totalInterest + c.totalGst, 1e-6));
t('balance never grows on the minimum', R.every((r, i) => i === 0 || r.statement < R[i - 1].statement));
// independent re-implementation
function ref(balance, rp, gst, plan, pay, pctMin, floor){
  let S = balance, months = 0, I = 0, G = 0, P = 0;
  while (true){ months++; let mad = S <= floor ? S : Math.max(Math.ceil(S * pctMin / 100), floor); mad = Math.min(mad, S);
    let p = plan === 'minimum' ? mad : Math.min(S, Math.max(pay, mad)); P += p; const L = S - p; if (L <= 0.005) break;
    const i = L * rp / 100, g = gst ? i * .18 : 0; I += i; G += g; S = L + i + g; if (months > 2000) return null; }
  return {months, I, G, P};
}
for (const [b, rp, g, plan, pay] of [[50000,3.75,true,'minimum',0],[50000,3.75,true,'fixed',5000],[12000,3.5,false,'fixed',1000],[200000,3.6,true,'fixed',10000],[777,2.5,true,'minimum',0]]){
  const a = MBC.cardRepayment({balance:b, monthlyRatePct:rp, gst:g, plan, payment:pay, rule:rule5}), e = ref(b, rp, g, plan, pay, 5, 200);
  t(`matches independent simulation: ₹${b} at ${rp}% ${plan}${pay ? ' ₹' + pay : ''} (${a.months} months)`, a.months === e.months && near(a.totalInterest, e.I, 1e-6) && near(a.totalGst, e.G, 1e-6) && near(a.totalPaid, e.P, 1e-6), [a.months, e.months]);
}
const full = MBC.cardRepayment({balance:50000, monthlyRatePct:3.75, plan:'fixed', payment:50000, rule:rule5});
t('paying the full bill: 1 month, zero interest', full.months === 1 && full.totalCost === 0);
const over = MBC.cardRepayment({balance:5000, monthlyRatePct:3.75, plan:'fixed', payment:1e6, rule:rule5});
t('payment larger than the bill is capped at the bill', over.totalPaid === 5000 && over.months === 1);
const zero = MBC.cardRepayment({balance:1000, monthlyRatePct:0, plan:'minimum', rule:rule5});
t('0% interest: ₹1,000 at ₹200 minimum = 5 months, no interest', zero.months === 5 && zero.totalCost === 0);
const stuck = MBC.cardRepayment({balance:10000, monthlyRatePct:3.75, plan:'minimum', rule:{type:'fixed', amount:300}});
t('₹300 a month on ₹10,000 at 3.75% + GST never reduces → warning', stuck.status === 'not-reducing' && stuck.months === null);
const k = 1 + .03 * 1.18, payEq = 10000 - 10000 / k;
const equal = MBC.cardRepayment({balance:10000, monthlyRatePct:3, plan:'minimum', rule:{type:'fixed', amount:payEq}});
t('payment equal to interest + GST → flagged as not reducing', equal.status === 'not-reducing');
const longOne = MBC.cardRepayment({balance:50000, monthlyRatePct:3.75, plan:'minimum', rule:rule5, maxMonths:12});
t('very long repayments stop at the cap and say so', longOne.status === 'too-long' && longOne.months === null);
const low = MBC.cardRepayment({balance:50000, monthlyRatePct:3.75, plan:'fixed', payment:100, rule:rule5});
t('payment below the minimum is flagged and the minimum used', low.belowMin && low.rows[0].payment === 2500);
const h = MBC.cardRepayment({balance:50000, monthlyRatePct:3.75, plan:'minimum', rule:{type:'hdfc'}});
t('HDFC method: first minimum = 5% of 50,000 = 2,500', h.rows[0].minDue === 2500);
t('HDFC method month 2: GST 320.625 + 5% of (1,781.25 + 47,500) rounded to nearest ₹10 (2,460) = 2,780.625', near(h.rows[1].minDue, 2780.625, 1e-9), h.rows[1]);
t('invalid balance → null', MBC.cardRepayment({balance:-5, monthlyRatePct:3}) === null && MBC.cardRepayment({balance:0, monthlyRatePct:3}) === null);
const big = MBC.cardRepayment({balance:5e7, monthlyRatePct:3.75, plan:'fixed', payment:5e6, rule:rule5});
t('large balance (₹5 crore) stays finite', big.status === 'cleared' && isFinite(big.totalPaid));
const tiny = MBC.cardRepayment({balance:1, monthlyRatePct:3.75, plan:'minimum', rule:rule5});
t('₹1 balance clears in one month', tiny.months === 1);

section('Lifestyle inflation');
const L1 = MBC.lifestyle({incomeNow:30000, incomeNew:45000, expNow:24000, expNew:39000});
t('brief example: savings stay ₹6,000; 100% of the raise spent', L1.savingsNow === 6000 && L1.savingsNew === 6000 && L1.shareOfRiseSpent === 100 && L1.savingsChange === 0 && L1.fiveYear === 0);
t('brief example: saving half the raise = ₹4,50,000 over 5 years', L1.halfRiseFiveYear === 450000);
const L2 = MBC.lifestyle({incomeNow:30000, incomeNew:45000, expNow:24000, expNew:30000});
t('₹6,000 more spending: 40% of raise, +₹9,000/month, ₹1,08,000/yr, ₹5,40,000/5yr', L2.shareOfRiseSpent === 40 && L2.savingsChange === 9000 && L2.yearly === 108000 && L2.fiveYear === 540000);
const L3 = MBC.lifestyle({incomeNow:30000, incomeNew:30000, expNow:24000, expNew:26000});
t('no raise → share is not computed (no divide by zero)', L3.shareOfRiseSpent === null && L3.savingsChange === -2000);
t('expenses above income → negative savings shown', MBC.lifestyle({incomeNow:20000, incomeNew:25000, expNow:22000, expNew:26000}).savingsNew === -1000);
t('negative inputs → null', MBC.lifestyle({incomeNow:-1, incomeNew:1, expNow:1, expNew:1}) === null);

section('Inflation');
const f = MBC.inflation({amount:1000, ratePct:6, years:10});
t('₹1,000 at 6% for 10 years costs 1,790.85', near(f.futureCost, 1790.8477, 1e-3));
t("today's ₹1,000 buys what 558.39 buys now", near(f.purchasingPower, 558.3948, 1e-3));
t('purchasing power lost 44.16%', near(f.powerLostPct, 44.1605, 1e-3));
t('chart series ends at the same numbers', f.series.length === 11 && near(f.series[10].cost, f.futureCost, 1e-9) && near(f.series[10].power, f.purchasingPower, 1e-9));
t('0 years → no change', MBC.inflation({amount:1000, ratePct:6, years:0}).futureCost === 1000);
t('0% inflation → no loss', MBC.inflation({amount:1000, ratePct:0, years:20}).powerLostPct === 0);
t('invalid → null', MBC.inflation({amount:0, ratePct:6, years:5}) === null);

section('Real discount');
const rd = MBC.realDiscount({listed:4999, selling:1999, extra:99, others:[1899, 2100]});
t('advertised ₹3,000 off = 60.01%', rd.advertised.amount === 3000 && near(rd.advertised.percent, 60.012, 1e-3));
t('final price includes extra charges (₹2,098)', rd.finalPrice === 2098);
t('effective discount after charges 58.03%', near(rd.effective.percent, 58.0316, 1e-3));
t('cheapest other ₹1,899 → this deal ₹199 more', rd.cheapestOther === 1899 && rd.vsCheapest === 199 && rd.isCheapest === false);
t('listed price lower than selling → flagged', MBC.realDiscount({listed:1000, selling:1200}).listedProblem === 'lower');
t('no comparisons → no comparison claimed', MBC.realDiscount({listed:2000, selling:1500}).cheapestOther === undefined);
t('invalid selling price → null', MBC.realDiscount({listed:2000, selling:0}) === null);


section('Credit card: HDFC formula cases, payment split, final payment');
t('HDFC case 2 (interest > 5%): GST 180 + interest 1,000 + ₹500 = 1,680', MBC.minimumDue({type:'hdfc'}, 11180, 1000, 180, 10000) === 1680);
t('HDFC ₹200 floor: 5% of ₹2,000 = ₹100 → ₹200', MBC.minimumDue({type:'hdfc'}, 2000, 0, 0, 2000) === 200);
t('HDFC statement ≤ ₹200 is due in full', MBC.minimumDue({type:'hdfc'}, 150, 0, 0, 150) === 150);
t('percent rule: 5% of ₹49,601.875 rounded up = 2,481', MBC.minimumDue({type:'percent', percent:5, floor:200}, 49601.875) === 2481);
t('fixed rule never exceeds the statement', MBC.minimumDue({type:'fixed', amount:5000}, 1200) === 1200);
const sp = MBC.cardRepayment({balance:50000, monthlyRatePct:3.75, plan:'fixed', payment:5000, rule:rule5});
t('every payment splits into interest+GST and debt reduction', sp.rows.every(r => r.payment == null || Math.abs(r.toCharges + r.toPrincipal - r.payment) < 1e-9));
t('month 1 (no interest yet): all ₹5,000 reduces the debt', sp.rows[0].toCharges === 0 && sp.rows[0].toPrincipal === 5000);
t('month 2: ₹2,101.875 to interest+GST (1,668.75 + 300.375)… ', near(sp.rows[1].toCharges, 45000 * .0375 * 1.18, 1e-9) && near(sp.rows[1].toPrincipal, 5000 - 45000 * .0375 * 1.18, 1e-9), sp.rows[1]);
t('debt reductions add up to the original balance', near(sp.rows.reduce((s, r) => s + (r.toPrincipal || 0), 0), 50000, 1e-6));
t('carried + interest + GST = statement on every row', sp.rows.every(r => Math.abs(r.carried + r.interest + r.gst - r.statement) < 1e-6 || r.month === 1));
t('final payment is a smaller, partial payment that clears exactly', sp.rows[sp.rows.length - 1].payment < 5000 && sp.rows[sp.rows.length - 1].left === 0, sp.rows[sp.rows.length - 1]);
t('interest-only payment row carries a warning row with no payment', stuck.rows[stuck.rows.length - 1].payment === null);

section('Should I buy this? recommendation');
const A = (o) => Object.assign({list:'yes', mrp:'yes', crowd:'no', free:'no', later:'yes', afford:'yes'}, o);
t('all clear → buying may be reasonable', MBC.buyDecision(A({}), {discountValid:true, shareOfMonth:.1}).rec === 'buy');
t("can't pay in full → reconsider (affordability)", MBC.buyDecision(A({afford:'no'})).rec === 'reconsider');
t('price feels fair only because of MRP → compare', MBC.buyDecision(A({mrp:'no'}), {discountValid:true}).rec === 'compare');
t('MRP answer "no" but no real discount → not sent to compare', MBC.buyDecision(A({mrp:'no'}), {discountValid:false}).rec === 'wait24' || MBC.buyDecision(A({mrp:'no'}), {discountValid:false}).rec === 'wait30');
t('won\'t want it in 30 days → wait 30 days', MBC.buyDecision(A({later:'no'})).rec === 'wait30');
t('a single "Not sure" → wait 24 hours', MBC.buyDecision(A({crowd:'unsure'})).rec === 'wait24');
t('two flags → wait 30 days', MBC.buyDecision(A({list:'no', crowd:'yes'})).rec === 'wait30');
t('three flags → reconsider', MBC.buyDecision(A({list:'no', crowd:'yes', free:'yes'})).rec === 'reconsider');
t('clear but ≥ half a month\'s money → compare', MBC.buyDecision(A({}), {shareOfMonth:.6}).rec === 'compare');
t('unanswered questions → no recommendation yet', MBC.buyDecision({list:'yes'}).rec === null && MBC.buyDecision({list:'yes'}).answered === 1);
t('flags list the exact questions that raised them', JSON.stringify(MBC.buyDecision(A({list:'no', later:'unsure'})).flags) === JSON.stringify([{id:'list', weight:1}, {id:'later', weight:.5}]));
t('missing optional MRP → no discount shown', MBC.discount(null, 2999).valid === false);

section('Lifestyle: actual savings kept separate');
const LA = MBC.lifestyle({incomeNow:30000, incomeNew:45000, expNow:24000, expNew:30000, actualSavingsNow:4000});
t('surplus still 6,000 → 15,000 (income − expenses)', LA.savingsNow === 6000 && LA.savingsNew === 15000);
t('actual saving shown separately: 4,000, gap −2,000', LA.actual.now === 4000 && LA.actual.gapNow === -2000);
t('actual after raise if the gap stays: 4,000 + 9,000 = 13,000', LA.actual.newIfGapStays === 13000);
t('no actual entered → actual is null', MBC.lifestyle({incomeNow:1, incomeNew:2, expNow:1, expNew:1}).actual === null);
t('negative actual savings → invalid', MBC.lifestyle({incomeNow:1, incomeNew:2, expNow:1, expNew:1, actualSavingsNow:-5}) === null);
const L4 = MBC.lifestyle({incomeNow:30000, incomeNew:45000, expNow:24000, expNew:20000});
t('expenses fall → more than 100% of the raise saved, share negative', L4.shareOfRiseSpent < 0 && L4.savingsChange === 19000);

section('Discount, EMI schedule and inflation extras');
const dc = MBC.realDiscount({listed:1000, selling:950, extra:100});
t('charges larger than the discount → flagged, effective −5%', dc.chargesCancelDiscount === true && near(dc.effective.percent, -5, 1e-9));
t('zero charges → final = selling price', MBC.realDiscount({listed:1000, selling:800}).finalPrice === 800);
const es = MBC.noCostEmi({price:60000, months:12, annualRatePct:15, fee:199});
t('EMI schedule payments add up to total EMIs', near(es.schedule.reduce((s, r) => s + r.payment, 0), es.totalEmis, 1e-6));
t('EMI schedule interest adds up to total interest', near(es.schedule.reduce((s, r) => s + r.interest, 0), es.interest, 1e-9));
t('seller discount + financed = price (no double counting)', near(es.sellerDiscount + es.principal, 60000, 1e-9));
t('total paid = EMIs + GST + fee + fee GST', near(es.totalPaid, es.totalEmis + es.gstOnInterest + es.fee + es.feeGst, 1e-9));
t('inflation custom 7 years at 5%: cost 1,407.10', near(MBC.inflation({amount:1000, ratePct:5, years:7}).futureCost, 1407.1004, 1e-3));
t('purchasing power × future cost factor = amount', near(MBC.inflation({amount:2500, ratePct:7, years:13}).purchasingPower * Math.pow(1.07, 13), 2500, 1e-9));
t('very small amount ₹1 at 6% for 20 years = 3.21', near(MBC.inflation({amount:1, ratePct:6, years:20}).futureCost, 3.2071, 1e-4));
t('large amount ₹1,50,00,000 formats with Indian grouping', MBC.inr(MBC.inflation({amount:15000000, ratePct:0, years:5}).futureCost) === '₹1,50,00,000');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
