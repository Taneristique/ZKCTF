"use client";

import { useLang } from "@/lib/lang";

const NAV = [
  { href: "#overview", en: "Overview", es: "Resumen" },
  { href: "#locks", en: "Structural locks", es: "Candados estructurales" },
  { href: "#play", en: "How to play", es: "Cómo se juega" },
  { href: "#race", en: "The USDC race", es: "La carrera USDC" },
  { href: "#math", en: "Payout math", es: "Matemática de pago" },
  { href: "#prestige", en: "Points & rewards", es: "Puntos y premios" },
  { href: "#membership", en: "Academy", es: "Academia" },
  { href: "#score", en: "How scoring works", es: "Cómo se anota" },
  { href: "#academy", en: "Lesson archive", es: "Archivo de clases" },
  { href: "#roadmap", en: "What’s next", es: "Qué sigue" },
] as const;

export function DocsView() {
  const { lang } = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);

  return (
    <div className="docs-view lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-12">
      <aside className="mb-10 lg:mb-0">
        <nav className="flex gap-2 overflow-x-auto pb-1 text-sm lg:sticky lg:top-24 lg:block lg:overflow-visible lg:pb-0">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex shrink-0 rounded-full border border-cream/10 px-3 py-1.5 text-cream/65 hover:border-cream/25 hover:text-cream lg:mb-2 lg:block lg:border-0 lg:px-0 lg:py-1"
            >
              {item[lang]}
            </a>
          ))}
        </nav>
      </aside>

      <article className="min-w-0 max-w-2xl space-y-16 sm:space-y-20">
        <section id="overview">
          <p className="text-xs uppercase tracking-[0.2em] text-teal">Docs</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("How ZKCTF works", "Cómo funciona ZKCTF")}
          </h1>
          <p className="mt-5 text-[15px] leading-7 text-cream/65">
            {t(
              "Test your bot. Prove it. Win. ZKCTF is a weekly on-chain CTF race on Solana: bring a human brain, a script, or an agent — best solver wins. Entry 5 USDC (devnet USDC on Devnet). Top 10 full clears share 80% of the pot by a fixed table; 20% treasury. You type ZKCTF{…} in the UI; Groth16 posts only a proof — the flag never touches the chain. Your public key is the edge: board, prestige, and payouts bind to the wallet, not to a leaked flag. Puzzles are generated and independently checked before publish (overflow, XOR, JWT, vault math, …). No PoH theater. Academy on /learn is a quality archive — the live product is the race. Mainnet when the crowd and pot are real.",
              "Probá tu bot. Probalo. Ganá. ZKCTF es una carrera CTF semanal on-chain en Solana: cerebro humano, script o agente — gana el mejor solver. Entrada 5 USDC (USDC de devnet en Devnet). El top 10 de clears completos reparte el 80% del pozo con tabla fija; 20% tesoro. Escribís ZKCTF{…} en la UI; Groth16 solo publica una prueba — el flag no toca la cadena. Tu public key es la ventaja: ranking, prestigio y pagos van a la wallet, no a un flag filtrado. Puzzles generados y verificados antes de publicar (overflow, XOR, JWT, vault math…). Sin teatro PoH. La Academia en /learn es archivo de calidad — el producto en vivo es la carrera. Mainnet cuando la comunidad y el pozo sean reales.")}
          </p>
          <div className="mt-8 space-y-3">
            <Layer
              n="1"
              name={t("Bot / solver welcome", "Bot / solver bienvenido")}
              body={t(
                "Automate if you want. We don’t ban solvers to fake “fair humans only.” Speed and correctness win; the board is public keys.",
                "Automatizá si querés. No baneamos solvers para fingir “solo humanos justos”. Ganan velocidad y corrección; el ranking son public keys.")}
            />
            <Layer
              n="2"
              name={t("5 USDC + Groth16", "5 USDC + Groth16")}
              body={t(
                "USDC entry. 20% treasury, 80% top 10. Type the flag in the UI; on-chain only a Groth16 proof. Explorers never see ZKCTF{…}.",
                "Entrada USDC. 20% tesoro, 80% top 10. El flag en la UI; on-chain solo prueba Groth16. El explorer no ve ZKCTF{…}.")}
            />
            <Layer
              n="3"
              name={t("Academy archive", "Archivo Academia")}
              body={t(
                "Quality lessons on /learn. Not a weekly paid-curriculum promise. Race is the live product. Academy never writes the board or pot.",
                "Clases de calidad en /learn. No es promesa de currículo pago semanal. El producto en vivo es la carrera. La Academia no escribe ranking ni pozo.")}
            />
          </div>
        </section>

        <section id="locks">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Structural locks", "Candados estructurales")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "These are product rules, not slogans. Breaking them turns ZKCTF into a generic Solana CTF.",
              "Son reglas de producto, no eslóganes. Si se rompen, ZKCTF vira un CTF genérico en Solana.")}
          </p>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-[15px] leading-7 text-cream/65">
            <li>
              {t(
                "A — Board + prize only after on-chain Groth16 submit (then settle / split_pot).",
                "A — Ranking + premio solo tras submit Groth16 on-chain (luego settle / split_pot).")}
            </li>
            <li>
              {t(
                "B — Flag never in transactions, events, or logs.",
                "B — El flag nunca va en txs, eventos ni logs.")}
            </li>
            <li>
              {t(
                "C — Payout is the fixed formula only — no organizer-picked winners.",
                "C — El pago es solo la fórmula fija — sin ganadores elegidos a mano.")}
            </li>
            <li>
              {t(
                "D — Today: one curated official set per week (no open creator marketplace yet). A later creator mode is listed under What’s next — only with quality gates.",
                "D — Hoy: un set oficial curado por semana (aún sin marketplace de creadores). Un modo creador posterior está en Qué sigue — solo con umbrales de calidad.")}
            </li>
            <li>
              {t(
                "E — Academy lessons and membership never credit the race board or pot.",
                "E — Las clases y la membresía de la Academia nunca acreditan el ranking ni el pozo.")}
            </li>
            <li>
              {t(
                "F — We pitch ZK proof-of-solve + pot math — not “another Solana CTF app”.",
                "F — Pitch: ZK proof-of-solve + pot math — no “otra app CTF en Solana”.")}
            </li>
            <li>
              {t(
                "G — No reward token and no staking cut of the weekly pot.",
                "G — Sin token de premio ni corte de stake del pozo semanal.")}
            </li>
          </ul>
        </section>

        <section id="play">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("How to play", "Cómo se juega")}
          </h2>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-[15px] leading-7 text-cream/65">
            <li>
              {t(
                "Connect a wallet and enter this week with 5 USDC. CTFs unlock in order: finish #1 before #2. Clear every CTF to be eligible for the pot.",
                "Conectá la wallet y entrá con 5 USDC. Los CTFs se abren en orden: terminá #1 antes de #2. Completá todos para el pozo.")}
            </li>
            <li>
              {t(
                "Open CTF. Only the current unlocked challenge shows its statement. Solved ones stay marked.",
                "Abrí CTF. Solo el desafío desbloqueado muestra el enunciado. Los resueltos quedan marcados.")}
            </li>
            <li>
              {t(
                "Type ZKCTF{…} and submit. Wrong answers are rejected. Right ones unlock the next CTF.",
                "Escribí ZKCTF{…} y enviá. Si está mal, se rechaza. Si está bien, abre el siguiente CTF.")}
            </li>
            <li>
              {t(
                "Only full clears enter the winner list, ranked by finish time. Top 10 of those share 80% of the pot.",
                "Solo quienes completan todos entran al ranking, por hora de cierre. El top 10 de esos se lleva el 80%.")}
            </li>
          </ol>
        </section>

        <section id="race">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("The USDC race", "La carrera USDC")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "This week’s race is a live bot test: humans, scripts, and agents all welcome. Entry is 5 USDC (no fiat). CTFs unlock in order. After the window, only wallets that cleared every CTF are ranked by finish time. N = 10. 20% treasury, 80% to that board with the fixed table. If fewer than 10 full clears, only they are paid (weights renormalized). If nobody cleared the set, the whole pot goes to treasury. Best solver wins — we do not run PoH to pretend otherwise.",
              "La carrera de esta semana es un test de bots en vivo: humanos, scripts y agentes bienvenidos. Entrada 5 USDC (sin fiat). Los CTFs se abren en orden. Al cerrar, solo quienes completaron todos se ordenan por hora de cierre. N = 10. 20% tesoro, 80% con la tabla. Si hay menos de 10 clears, solo ellos (pesas reescaladas). Si nadie completó el set, todo al tesoro. Gana el mejor solver — no usamos PoH para fingir otra cosa.")}
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>{t("Rank", "Puesto")}</th>
                  <th>1</th>
                  <th>2</th>
                  <th>3</th>
                  <th>4</th>
                  <th>5</th>
                  <th>6</th>
                  <th>7</th>
                  <th>8</th>
                  <th>9</th>
                  <th>10</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t("% of the 80%", "% del 80%")}</td>
                  <td>25</td>
                  <td>18</td>
                  <td>13</td>
                  <td>10</td>
                  <td>8</td>
                  <td>7</td>
                  <td>6</td>
                  <td>5</td>
                  <td>4</td>
                  <td>4</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-cream/50">
            {t(
              "Example: one player, 5 USDC pot → 1 USDC treasury, 4 USDC to that player. Three players, two solvers, 15 USDC pot → 3 USDC treasury, 12 USDC split 25:18 between the two.",
              "Ejemplo: un jugador, pozo 5 USDC → 1 al tesoro, 4 a esa wallet. Tres entradas, dos solvers, 15 USDC → 3 al tesoro, 12 en 25:18 entre los dos.")}
          </p>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "Pitch: (1) bug-bounty pay-to-submit is often 50–100 USDC with no refund — here 5 stays in the pot. (2) Groth16 proof-of-solve — the flag never hits the chain.",
              "Pitch: (1) el pay-to-submit de bug bounty suele ser 50–100 USDC sin reembolso — acá 5 quedan en el pozo. (2) Groth16 proof-of-solve — el flag no va on-chain.")}
          </p>
        </section>

        <section id="math">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Payout math", "Matemática de pago")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "This is the published USDC split — the same rules the settle step uses. It is money accounting, not a how-to for breaking the race.",
              "Esta es la repartición USDC publicada — las mismas reglas que usa settle. Es contabilidad de dinero, no un manual para romper la carrera.")}
          </p>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-[15px] leading-7 text-cream/65">
            <li>
              {t(
                "n = number of entries. pot = 5 × n USDC.",
                "n = entradas. pot = 5 × n USDC.")}
            </li>
            <li>
              {t(
                "20% of the pot → treasury. 80% → prize pool for the board.",
                "20% del pozo → tesoro. 80% → pozo de premios del ranking.")}
            </li>
            <li>
              {t(
                "Rank by who finished the full set first (all CTFs cleared). At most 10 wallets are paid.",
                "Orden: quienes terminaron el set completo primero. Como máximo se paga a 10 wallets.")}
            </li>
            <li>
              {t(
                "Prize shares for ranks 1…10 (of the 80%): 25%, 18%, 13%, 10%, 8%, 7%, 6%, 5%, 4%, 4%. If fewer than 10 solvers, those same shares are scaled so they still add to 100% of the prize pool.",
                "Cuotas puestos 1…10 (del 80%): 25%, 18%, 13%, 10%, 8%, 7%, 6%, 5%, 4%, 4%. Si hay menos de 10, esas cuotas se reescalan para sumar el 100% del pozo de premios.")}
            </li>
            <li>
              {t(
                "If nobody solved: the whole pot goes to treasury. Integer rounding leftovers also go to treasury.",
                "Si nadie resolvió: todo el pozo al tesoro. Los restos de redondeo también van al tesoro.")}
            </li>
          </ol>
          <p className="mt-5 text-[15px] leading-7 text-cream/65">
            {t(
              "Example: 3 entries, 2 solvers → pot 15 USDC → 3 treasury, 12 prize. With two people the 25:18 pair is scaled across that 12.",
              "Ejemplo: 3 entradas, 2 solvers → pozo 15 USDC → 3 tesoro, 12 premio. Con dos personas el par 25:18 se escala sobre esos 12.")}
          </p>
          <p className="mt-4 text-sm text-cream/50">
            {t(
              "Flags stay private to you. The public board only shows that your wallet solved a CTF — not the answer.",
              "El flag queda privado. En el ranking se ve que tu wallet resolvió un CTF — no la respuesta.")}
          </p>
        </section>

        <section id="prestige">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Points & rewards", "Puntos y premios")}
          </h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-[15px] leading-7 text-cream/65">
            <li>
              {t(
                "Each unique official solve this week adds season points on your wallet. Badges (bronze / silver / gold) mark progress.",
                "Cada solve oficial único esta semana suma puntos de temporada en tu wallet. Las insignias (bronze / silver / gold) marcan el progreso.")}
            </li>
            <li>
              {t(
                "Season points stay on that wallet. They are not transferable and they do not change how the weekly USDC pot is split.",
                "Los puntos de temporada quedan en esa wallet. No se transfieren y no cambian cómo se reparte el pozo USDC semanal.")}
            </li>
            <li>
              {t(
                "Optional week Finisher badges may mint after settle. They are prestige, not a second pot formula.",
                "Tras settle pueden mintearse insignias Finisher de la semana. Prestigio, no una segunda fórmula de pozo.")}
            </li>
          </ul>
        </section>

        <section id="membership">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Academy", "Academia")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "Academy is the /learn archive: cybersecurity and math-for-security lessons built from real incidents. Right now we keep quality over cadence — we are not selling a “new paid lesson every week” promise. On-chain membership (USDC, no cards, no auto-renew) still unlocks gated archive content when seats are offered; renewing extends the seat from its current end. The Saturday race stays a separate 5 USDC entry and never mixes with Academy money.",
              "La Academia es el archivo /learn: clases de ciberseguridad y matemática de seguridad desde incidentes reales. Ahora priorizamos calidad sobre cadencia — no vendemos “clase paga nueva cada semana”. La membresía on-chain (USDC, sin tarjetas ni auto-renovación) abre el archivo cerrado cuando haya asientos; renovar extiende desde el fin actual. La carrera del sábado es 5 USDC aparte; el dinero de Academia no se mezcla con el pozo.")}
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>{t("Length", "Duración")}</th>
                  <th>USDC</th>
                  <th>{t("Founding (−50%)", "Founding (−50%)")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [t("1 month", "1 mes"), "10", "5"],
                  [t("3 months", "3 meses"), "27", "13.5"],
                  [t("12 months", "12 meses"), "90", "45"],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((c, i) => (
                      <td key={`${row[0]}-${i}`}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "Founding (if seats remain): first 100 wallets on a plan get −50% while they renew, a badge, and early lesson access when new lessons ship. Treat Founding as a legacy perk — not the reason to join this week.",
              "Founding (si quedan asientos): las primeras 100 wallets en un plan tienen −50% al renovar, insignia y acceso temprano cuando haya clases nuevas. Es un perk legado — no el motivo para entrar esta semana.")}
          </p>
        </section>

        <section id="score">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("How scoring works", "Cómo se anota")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "Production scoring: the board only moves after an on-chain Groth16 submit verifies, then the host confirms your on-chain entry progress. The flag string stays in your browser / prover — never in the transaction. USDC split is under Payout math (split_pot only).",
              "Scoring en producción: el ranking solo avanza tras submit Groth16 on-chain y confirmación del PDA. El flag queda en el navegador / prover — nunca en la tx. El USDC está en Matemática de pago (solo split_pot).")}
          </p>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "Wrong flag: rejected before prove. Right flag: proof built, then on-chain submit. If circuit setup is unfinished, we still tell you the flag was correct even if the board is not updated yet.",
              "Flag mal: se rechaza antes del prove. Flag bien: se arma la prueba y luego submit on-chain. Si el setup del circuit no terminó, te decimos que acertaste aunque el ranking aún no se actualice.")}
          </p>
        </section>

        <section id="academy">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Lesson archive", "Archivo de clases")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "Published lessons live under /learn in two tracks. Cybersecurity: a documented incident rebuilt step by step. Math for cybersecurity: the number theory and crypto that broke or protected a real system, with small-number exercises. When a new lesson ships, drafts are human-reviewed before publish. Lesson practice flags are checked off-chain and never affect the Saturday board or pot.",
              "Las clases publicadas viven en /learn en dos líneas. Ciberseguridad: incidente documentado paso a paso. Matemática para ciberseguridad: teoría de números y cripto que rompieron o protegieron un sistema real, con ejercicios chicos. Si sale una clase nueva, el borrador pasa por revisión humana. Los flags de práctica se validan off-chain y nunca afectan el ranking ni el pozo del sábado.")}
          </p>
        </section>

        <section id="roadmap">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("What’s next", "Qué sigue")}
          </h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-[15px] leading-7 text-cream/65">
            <li>
              {t(
                "Now: Devnet weekly official race, advertise the puzzle quality, grow a real player base. Mainnet when the crowd and pot justify real USDC — not “next week” by default.",
                "Ahora: carrera oficial semanal en Devnet, publicidad de la calidad de puzzles, base real de jugadores. Mainnet cuando la comunidad y el pozo justifiquen USDC real — no “la semana que viene” por defecto.")}
            </li>
            <li>
              {t(
                "Later (not live): creator mode — players ship CTFs through the week; attempt limits; quality gates (enough distinct attempts + at least one solve); producer share of the pot. A higher-entry (~10 USDC) lane may appear with that design. Until then lock D stays: one official curated set.",
                "Después (no en vivo): modo creador — CTFs durante la semana; límite de intentos; umbral de calidad (intentos distintos + al menos un solve); share del pozo al productor. Puede aparecer un carril ~10 USDC con ese diseño. Hasta entonces candado D: un set oficial curado.")}
            </li>
            <li>
              {t(
                "Later: optional UGC lessons / video commission on /learn (marketplace-style), only after the race Keep is stable.",
                "Después: clases UGC / comisión de video en /learn, solo cuando el Keep de la carrera esté estable.")}
            </li>
          </ul>
        </section>
      </article>
    </div>
  );
}

function Layer({ n, name, body }: { n: string; name: string; body: string }) {
  return (
    <div className="flex gap-4 rounded-[1.6rem] border border-cream/10 bg-cream/[0.03] p-5 sm:p-6">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-teal text-xs font-medium text-cream">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-medium">{name}</p>
        <p className="mt-1.5 text-sm leading-6 text-cream/55">{body}</p>
      </div>
    </div>
  );
}
