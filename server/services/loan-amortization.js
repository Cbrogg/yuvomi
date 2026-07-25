/**
 * Modul: Darlehens-Amortisation (Annuitätendarlehen nach deutschem Muster, #569)
 * Zweck: Aus Kreditsumme, Sollzins und Anfangstilgung die konstante Monatsrate und
 *        daraus den vollständigen Tilgungsplan (Zins-/Tilgungsanteil, Restschuld,
 *        Laufzeit) berechnen. Optional wechselt der Zins nach der Zinsbindung auf
 *        einen Prognose-Anschlusszins (fixed_then_variable).
 *
 * Modell (bewusst als Prognose):
 *   - Monatsrate A = Kreditsumme × (Sollzins% + Anfangstilgung%) / 100 / 12, konstant.
 *   - Je Monat: Zinsanteil = Restschuld × Monatszins; Tilgung = A − Zinsanteil.
 *   - Nach der Zinsbindung bleibt die Rate A gleich, es rechnet aber der
 *     Prognose-Anschlusszins weiter (mehr Zins-, weniger Tilgungsanteil → längere
 *     Restlaufzeit). Reale variable Zinsen schwanken monatlich; hier ein
 *     angenommener Wert, daher „Prognose".
 *   - Die Laufzeit ergibt sich aus der Tilgung (kein manuelles Ratenlimit).
 *
 * Rein synchron, ohne Seiteneffekte/DB — netzfrei testbar (test:budget-loans-amortization).
 */

// Sicherheitskappe: 50 Jahre. Verhindert Endlosschleifen bei Eingaben, deren Rate
// die Tilgung nie abschließt; solche Fälle werden als nicht tilgend gemeldet.
export const MAX_LOAN_MONTHS = 600;

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * @param {object} params
 * @param {number} params.principal            Kreditsumme in Euro (> 0)
 * @param {number} params.fixedRate            Sollzins p.a. in % (>= 0), Phase 1
 * @param {number} params.initialRepaymentRate Anfangstilgung p.a. in % (> 0)
 * @param {'fixed'|'fixed_then_variable'} params.interestMode
 * @param {number|null} [params.fixedPeriodMonths] Zinsbindung in Monaten (nur fixed_then_variable)
 * @param {number|null} [params.followupRate]      Prognose-Anschlusszins p.a. in % (nur fixed_then_variable)
 * @returns {{ ok: true, monthlyPayment: number, totalMonths: number, totalInterest: number,
 *             totalRepayment: number, remainingAfterBinding: number,
 *             schedule: Array<{ n: number, rate: number, interest: number, principal: number, balance: number, phase: 1|2 }> }
 *           | { ok: false, reason: 'not_amortizing' | 'too_long' }}
 */
export function computeLoanSchedule({
  principal,
  fixedRate,
  initialRepaymentRate,
  interestMode,
  fixedPeriodMonths = null,
  followupRate = null,
}) {
  const P = Number(principal);
  const rf = Number(fixedRate);
  const rt = Number(initialRepaymentRate);
  const variable = interestMode === 'fixed_then_variable';
  const rv = variable ? Number(followupRate) : rf;
  const bindingMonths = variable && Number.isFinite(Number(fixedPeriodMonths))
    ? Number(fixedPeriodMonths)
    : null;

  // Konstante Monatsrate (auf Cent gerundet, wie real belastet).
  const monthly = round2((P * (rf + rt)) / 100 / 12);

  let balance = P;
  let totalInterest = 0;
  let remainingAfterBinding = 0;
  const schedule = [];

  for (let n = 1; n <= MAX_LOAN_MONTHS && balance > 0.005; n++) {
    const inFixed = !bindingMonths || n <= bindingMonths;
    const rate = inFixed ? rf : rv;
    const interest = balance * (rate / 100 / 12);
    let principalPart = monthly - interest;
    // Rate deckt den Zins nicht → das Darlehen tilgt nicht (z. B. Anschlusszins zu hoch).
    if (principalPart <= 0) return { ok: false, reason: 'not_amortizing' };
    if (principalPart > balance) principalPart = balance; // letzte (Teil-)Rate

    balance -= principalPart;
    totalInterest += interest;
    schedule.push({
      n,
      rate,
      interest: round2(interest),
      principal: round2(principalPart),
      balance: round2(Math.max(0, balance)),
      phase: inFixed ? 1 : 2,
    });
    if (bindingMonths && n === bindingMonths) remainingAfterBinding = round2(Math.max(0, balance));
  }

  if (balance > 0.005) return { ok: false, reason: 'too_long' };

  return {
    ok: true,
    monthlyPayment: monthly,
    totalMonths: schedule.length,
    totalInterest: round2(totalInterest),
    totalRepayment: round2(P + totalInterest),
    remainingAfterBinding,
    schedule,
  };
}
