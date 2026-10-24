"use client";

import { useLang } from "@/lib/lang";

const NAV = [
  { href: "#overview", en: "Overview", tr: "Özet", es: "Resumen" },
  { href: "#locks", en: "Structural locks", tr: "Yapısal kilitler", es: "Candados estructurales" },
  { href: "#play", en: "How to play", tr: "Nasıl oynanır", es: "Cómo se juega" },
  { href: "#race", en: "The USDC race", tr: "USDC yarış", es: "La carrera USDC" },
  { href: "#math", en: "Payout math", tr: "Ödeme matematiği", es: "Matemática de pago" },
  { href: "#prestige", en: "Points & rewards", tr: "Puan ve ödül", es: "Puntos y premios" },
  { href: "#membership", en: "Academy", tr: "Akademi", es: "Academia" },
  { href: "#score", en: "How scoring works", tr: "Puan nasıl yazılır", es: "Cómo se anota" },
  { href: "#academy", en: "Lesson archive", tr: "Ders arşivi", es: "Archivo de clases" },
  { href: "#roadmap", en: "What’s next", tr: "Sırada ne var", es: "Qué sigue" },
] as const;

export function DocsView() {
  const { lang } = useLang();
  const t = (en: string, tr: string, es: string) => ({ en, tr, es }[lang]);

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
            {t("How ZKCTF works", "ZKCTF nasıl çalışır", "Cómo funciona ZKCTF")}
          </h1>
          <p className="mt-5 text-[15px] leading-7 text-cream/65">
            {t(
              "ZKCTF is a weekly on-chain CTF race on Solana with Groth16 proof-of-solve: you type ZKCTF{…} in the UI; the chain only sees a proof — the flag never lands in a transaction. Entry is 5 USDC (devnet USDC while we run on Devnet). 20% of the pot goes to treasury, 80% to the first 10 full clears by a fixed table. Puzzles are generated and independently checked before publish — sharp crypto / Solidity-style levels (overflow, XOR, JWT, vault math, …). Best solver wins; we do not pretend bots cannot play. The Academy is a quality lesson archive on /learn — not the product we over-promise week to week. Mainnet ships when the community and pot are real, not on a calendar slogan.",
              "ZKCTF, Solana üzerinde haftalık zincir üstü CTF yarışı: Groth16 proof-of-solve — UI’da ZKCTF{…} yazarsın; zincir yalnız proof görür, flag tx’e yazılmaz. Giriş 5 USDC (Devnet’teyken devnet USDC). Potun %20’si treasury, %80’i sabit tabloyla ilk 10 full clear. Bulmacalar yayın öncesi üretilir ve bağımsız doğrulanır — net kripto / Solidity tarzı seviyeler (overflow, XOR, JWT, vault math…). En iyi solver kazanır; “bot yok” tiyatrosu yok. Akademi /learn’de kaliteli ders arşivi — her hafta şişirilen ana vaat değil. Mainnet, kitle ve pot olgunlaşınca gelir; takvim sloganı değil.",
              "ZKCTF es una carrera CTF semanal on-chain en Solana con Groth16 proof-of-solve: escribís ZKCTF{…} en la UI; la cadena solo ve una prueba — el flag no va en la tx. Entrada 5 USDC (USDC de devnet mientras corremos en Devnet). 20% del pozo al tesoro, 80% a los primeros 10 clears completos con tabla fija. Los puzzles se generan y se verifican de forma independiente antes de publicar — niveles claros de cripto / Solidity (overflow, XOR, JWT, vault math…). Gana el mejor solver; no fingimos que los bots no existen. La Academia es un archivo de clases de calidad en /learn — no la promesa semanal inflada. Mainnet llega cuando la comunidad y el pozo son reales, no por eslogan de calendario.",
            )}
          </p>
          <div className="mt-8 space-y-3">
            <Layer
              n="1"
              name={t("5 USDC + formula", "5 USDC + formül", "5 USDC + fórmula")}
              body={t(
                "USDC only. 20% treasury, 80% to the board. Same weights if 1 person showed up or 40. No discretionary prize.",
                "Yalnız USDC. %20 treasury, %80 sıra. 1 kişi de gelse 40 kişi de, aynı ağırlıklar. Keyfi ödül yok.",
                "Solo USDC. 20% tesoro, 80% al ranking. Las mismas pesas si vino 1 o 40. Sin premio discrecional.",
              )}
            />
            <Layer
              n="2"
              name={t("ZK proof-of-solve", "ZK proof-of-solve", "ZK proof-of-solve")}
              body={t(
                "Type ZKCTF{…} in the UI. On-chain you only post a Groth16 proof. Explorers never see the flag.",
                "UI’da ZKCTF{…} yaz. Zincire yalnız Groth16 proof gider. Explorer flag görmez.",
                "En la UI escribís ZKCTF{…}. On-chain solo va una prueba Groth16. El explorer no ve el flag.",
              )}
            />
            <Layer
              n="3"
              name={t("Academy archive", "Akademi arşivi", "Archivo Academia")}
              body={t(
                "Quality lessons on /learn (real incidents + math for security). We are not promising a fresh paid curriculum every week right now. Membership rails exist; the race is the live product. Academy never writes the Saturday board or pot.",
                "/learn’de kaliteli dersler (gerçek olaylar + güvenlik matematiği). Şu an her hafta taze ücretli müfredat vaadi yok. Üyelik altyapısı duruyor; canlı ürün yarış. Akademi Cumartesi sırasına / pota yazmaz.",
                "Clases de calidad en /learn (incidentes reales + matemática de seguridad). Ahora no prometemos currículo pago nuevo cada semana. La membresía existe; el producto en vivo es la carrera. La Academia no escribe el ranking ni el pozo del sábado.",
              )}
            />
          </div>
        </section>

        <section id="locks">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Structural locks", "Yapısal kilitler", "Candados estructurales")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "These are product rules, not slogans. Breaking them turns ZKCTF into a generic Solana CTF.",
              "Bunlar slogan değil, ürün kuralı. Bozulursa ZKCTF sıradan bir Solana CTF’e iner.",
              "Son reglas de producto, no eslóganes. Si se rompen, ZKCTF vira un CTF genérico en Solana.",
            )}
          </p>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-[15px] leading-7 text-cream/65">
            <li>
              {t(
                "A — Board + prize only after on-chain Groth16 submit (then settle / split_pot).",
                "A — Sıra + ödül yalnız on-chain Groth16 submit sonrası (sonra settle / split_pot).",
                "A — Ranking + premio solo tras submit Groth16 on-chain (luego settle / split_pot).",
              )}
            </li>
            <li>
              {t(
                "B — Flag never in transactions, events, or logs.",
                "B — Flag asla tx / event / log’da yok.",
                "B — El flag nunca va en txs, eventos ni logs.",
              )}
            </li>
            <li>
              {t(
                "C — Payout is the fixed formula only — no organizer-picked winners.",
                "C — Ödeme yalnız sabit formül — organizatör kazanan seçmez.",
                "C — El pago es solo la fórmula fija — sin ganadores elegidos a mano.",
              )}
            </li>
            <li>
              {t(
                "D — Today: one curated official set per week (no open creator marketplace yet). A later creator mode is listed under What’s next — only with quality gates.",
                "D — Bugün: haftada bir curated resmi set (açık üretici marketplace yok). Sonraki üretici modu “Sırada ne var”da — yalnız kalite eşikleriyle.",
                "D — Hoy: un set oficial curado por semana (aún sin marketplace de creadores). Un modo creador posterior está en Qué sigue — solo con umbrales de calidad.",
              )}
            </li>
            <li>
              {t(
                "E — Academy lessons and membership never credit the race board or pot.",
                "E — Akademi dersleri ve üyelik yarış sırasına / pota puan yazmaz.",
                "E — Las clases y la membresía de la Academia nunca acreditan el ranking ni el pozo.",
              )}
            </li>
            <li>
              {t(
                "F — We pitch ZK proof-of-solve + pot math — not “another Solana CTF app”.",
                "F — Pitch: ZK proof-of-solve + pot math — “başka bir Solana CTF app” değil.",
                "F — Pitch: ZK proof-of-solve + pot math — no “otra app CTF en Solana”.",
              )}
            </li>
            <li>
              {t(
                "G — No reward token and no staking cut of the weekly pot.",
                "G — Ödül tokenı yok; haftalık pottan stake kesintisi yok.",
                "G — Sin token de premio ni corte de stake del pozo semanal.",
              )}
            </li>
          </ul>
        </section>

        <section id="play">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("How to play", "Nasıl oynanır", "Cómo se juega")}
          </h2>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-[15px] leading-7 text-cream/65">
            <li>
              {t(
                "Connect a wallet and enter this week with 5 USDC. CTFs unlock in order: finish #1 before #2. Clear every CTF to be eligible for the pot.",
                "Cüzdan bağla, bu haftaya 5 USDC ile gir. CTF’ler sırayla açılır: #1 bitmeden #2 yok. Pota hak için hepsini bitir.",
                "Conectá la wallet y entrá con 5 USDC. Los CTFs se abren en orden: terminá #1 antes de #2. Completá todos para el pozo.",
              )}
            </li>
            <li>
              {t(
                "Open CTF. Only the current unlocked challenge shows its statement. Solved ones stay marked.",
                "CTF’i aç. Yalnız açık olanın metni görünür. Bitirdiklerin işaretli kalır.",
                "Abrí CTF. Solo el desafío desbloqueado muestra el enunciado. Los resueltos quedan marcados.",
              )}
            </li>
            <li>
              {t(
                "Type ZKCTF{…} and submit. Wrong answers are rejected. Right ones unlock the next CTF.",
                "ZKCTF{…} yazıp gönder. Yanlış reddedilir. Doğru sıradakini açar.",
                "Escribí ZKCTF{…} y enviá. Si está mal, se rechaza. Si está bien, abre el siguiente CTF.",
              )}
            </li>
            <li>
              {t(
                "Only full clears enter the winner list, ranked by finish time. Top 10 of those share 80% of the pot.",
                "Kazanan listesine yalnız her CTF’i bitirenler girer; bitiş zamanına göre. Onların ilk 10’u potun %80’ini paylaşır.",
                "Solo quienes completan todos entran al ranking, por hora de cierre. El top 10 de esos se lleva el 80%.",
              )}
            </li>
          </ol>
        </section>

        <section id="race">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("The USDC race", "USDC yarış", "La carrera USDC")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "Entry is 5 USDC. Fiat is not accepted on this race. CTFs unlock in order. After the window, only wallets that cleared every CTF are ranked by finish time. N = 10. 20% treasury, 80% to that board with the fixed table. If fewer than 10 full clears, only they are paid (weights renormalized). If nobody cleared the set, the whole pot goes to treasury. Solvers (including automated ones) are allowed — the race is honest about that.",
              "Giriş 5 USDC. Fiat yok. CTF’ler sırayla açılır. Pencere bitince yalnız her CTF’i bitirenler bitiş zamanına göre sıralanır. N = 10. %20 treasury, %80 bu tablo. 10’dan az full clear varsa yalnız onlar (ağırlıklar yeniden ölçeklenir). Kimse seti bitirmediyse pot treasury’e. Solver’lar (otomatik dahil) serbest — yarış buna dürüst.",
              "Entrada 5 USDC. Sin fiat. Los CTFs se abren en orden. Al cerrar, solo quienes completaron todos se ordenan por hora de cierre. N = 10. 20% tesoro, 80% con la tabla. Si hay menos de 10 clears, solo ellos (pesas reescaladas). Si nadie completó el set, todo al tesoro. Los solvers (también automáticos) están permitidos — la carrera es honesta al respecto.",
            )}
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>{t("Rank", "Sıra", "Puesto")}</th>
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
                  <td>{t("% of the 80%", "%80 içinden", "% del 80%")}</td>
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
              "Örnek: tek oyuncu, 5 USDC pot → 1 treasury, 4 o oyuncuya. Üç giriş, iki çözen, 15 USDC → 3 treasury, 12’si 25:18 ile iki kişiye.",
              "Ejemplo: un jugador, pozo 5 USDC → 1 al tesoro, 4 a esa wallet. Tres entradas, dos solvers, 15 USDC → 3 al tesoro, 12 en 25:18 entre los dos.",
            )}
          </p>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "Pitch: (1) bug-bounty pay-to-submit is often 50–100 USDC with no refund — here 5 stays in the pot. (2) Groth16 proof-of-solve — the flag never hits the chain.",
              "Pitch: (1) bug bounty pay-to-submit sıkça 50–100 USDC, iade yok — burada 5 potta kalır. (2) Groth16 proof-of-solve — flag zincire yazılmaz.",
              "Pitch: (1) el pay-to-submit de bug bounty suele ser 50–100 USDC sin reembolso — acá 5 quedan en el pozo. (2) Groth16 proof-of-solve — el flag no va on-chain.",
            )}
          </p>
        </section>

        <section id="math">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Payout math", "Ödeme matematiği", "Matemática de pago")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "This is the published USDC split — the same rules the settle step uses. It is money accounting, not a how-to for breaking the race.",
              "Bu, yayınlanan USDC bölünmesi — settle’ın kullandığı kurallar. Para muhasebesi; yarışı kırma rehberi değil.",
              "Esta es la repartición USDC publicada — las mismas reglas que usa settle. Es contabilidad de dinero, no un manual para romper la carrera.",
            )}
          </p>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-[15px] leading-7 text-cream/65">
            <li>
              {t(
                "n = number of entries. pot = 5 × n USDC.",
                "n = giriş sayısı. pot = 5 × n USDC.",
                "n = entradas. pot = 5 × n USDC.",
              )}
            </li>
            <li>
              {t(
                "20% of the pot → treasury. 80% → prize pool for the board.",
                "Potun %20’si → treasury. %80’i → sıralama ödül havuzu.",
                "20% del pozo → tesoro. 80% → pozo de premios del ranking.",
              )}
            </li>
            <li>
              {t(
                "Rank by who finished the full set first (all CTFs cleared). At most 10 wallets are paid.",
                "Sıra: bütün CTF setini ilk bitirenler. En fazla 10 cüzdan ödenir.",
                "Orden: quienes terminaron el set completo primero. Como máximo se paga a 10 wallets.",
              )}
            </li>
            <li>
              {t(
                "Prize shares for ranks 1…10 (of the 80%): 25%, 18%, 13%, 10%, 8%, 7%, 6%, 5%, 4%, 4%. If fewer than 10 solvers, those same shares are scaled so they still add to 100% of the prize pool.",
                "1…10. sıra payları (%80 içinden): %25, %18, %13, %10, %8, %7, %6, %5, %4, %4. 10’dan az çözen varsa aynı paylar ödül havuzunun %100’üne yeniden ölçeklenir.",
                "Cuotas puestos 1…10 (del 80%): 25%, 18%, 13%, 10%, 8%, 7%, 6%, 5%, 4%, 4%. Si hay menos de 10, esas cuotas se reescalan para sumar el 100% del pozo de premios.",
              )}
            </li>
            <li>
              {t(
                "If nobody solved: the whole pot goes to treasury. Integer rounding leftovers also go to treasury.",
                "Kimse çözmediyse: potun tamamı treasury’e. Yuvarlama artıkları da treasury’e.",
                "Si nadie resolvió: todo el pozo al tesoro. Los restos de redondeo también van al tesoro.",
              )}
            </li>
          </ol>
          <p className="mt-5 text-[15px] leading-7 text-cream/65">
            {t(
              "Example: 3 entries, 2 solvers → pot 15 USDC → 3 treasury, 12 prize. With two people the 25:18 pair is scaled across that 12.",
              "Örnek: 3 giriş, 2 çözen → pot 15 USDC → 3 treasury, 12 ödül. İki kişi için 25:18 çifti o 12 üzerinde ölçeklenir.",
              "Ejemplo: 3 entradas, 2 solvers → pozo 15 USDC → 3 tesoro, 12 premio. Con dos personas el par 25:18 se escala sobre esos 12.",
            )}
          </p>
          <p className="mt-4 text-sm text-cream/50">
            {t(
              "Flags stay private to you. The public board only shows that your wallet solved a CTF — not the answer.",
              "Flag yalnız sende kalır. Sıralamada cüzdanının bir CTF’i çözdüğü görünür — cevap değil.",
              "El flag queda privado. En el ranking se ve que tu wallet resolvió un CTF — no la respuesta.",
            )}
          </p>
        </section>

        <section id="prestige">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Points & rewards", "Puan ve ödül", "Puntos y premios")}
          </h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-[15px] leading-7 text-cream/65">
            <li>
              {t(
                "Each unique official solve this week adds season points on your wallet. Badges (bronze / silver / gold) mark progress.",
                "Bu hafta her benzersiz resmi solve, cüzdanına sezon puanı yazar. Rozetler (bronze / silver / gold) ilerlemeyi gösterir.",
                "Cada solve oficial único esta semana suma puntos de temporada en tu wallet. Las insignias (bronze / silver / gold) marcan el progreso.",
              )}
            </li>
            <li>
              {t(
                "Season points stay on that wallet. They are not transferable and they do not change how the weekly USDC pot is split.",
                "Sezon puanı o cüzdanda kalır. Transfer edilmez; haftalık USDC potunun bölünmesini değiştirmez.",
                "Los puntos de temporada quedan en esa wallet. No se transfieren y no cambian cómo se reparte el pozo USDC semanal.",
              )}
            </li>
            <li>
              {t(
                "Optional week Finisher badges may mint after settle. They are prestige, not a second pot formula.",
                "Settle sonrası isteğe bağlı haftalık Finisher rozetleri mintlenebilir. Prestij; ikinci bir pot formülü değil.",
                "Tras settle pueden mintearse insignias Finisher de la semana. Prestigio, no una segunda fórmula de pozo.",
              )}
            </li>
          </ul>
        </section>

        <section id="membership">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Academy", "Akademi", "Academia")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "Academy is the /learn archive: cybersecurity and math-for-security lessons built from real incidents. Right now we keep quality over cadence — we are not selling a “new paid lesson every week” promise. On-chain membership (USDC, no cards, no auto-renew) still unlocks gated archive content when seats are offered; renewing extends the seat from its current end. The Saturday race stays a separate 5 USDC entry and never mixes with Academy money.",
              "Akademi = /learn arşivi: gerçek olaylardan siber güvenlik ve güvenlik matematiği dersleri. Şu an tempo değil kalite — “her hafta yeni ücretli ders” vaadi satmıyoruz. Zincir üstü üyelik (USDC, kart yok, otomatik yenileme yok) koltuk açıldığında kapalı arşivi açar; yenileme mevcut bitişten uzatır. Cumartesi yarışı ayrı 5 USDC giriştir; Akademi parası pota karışmaz.",
              "La Academia es el archivo /learn: clases de ciberseguridad y matemática de seguridad desde incidentes reales. Ahora priorizamos calidad sobre cadencia — no vendemos “clase paga nueva cada semana”. La membresía on-chain (USDC, sin tarjetas ni auto-renovación) abre el archivo cerrado cuando haya asientos; renovar extiende desde el fin actual. La carrera del sábado es 5 USDC aparte; el dinero de Academia no se mezcla con el pozo.",
            )}
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>{t("Length", "Süre", "Duración")}</th>
                  <th>USDC</th>
                  <th>{t("Founding (−50%)", "Founding (−%50)", "Founding (−50%)")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [t("1 month", "1 ay", "1 mes"), "10", "5"],
                  [t("3 months", "3 ay", "3 meses"), "27", "13.5"],
                  [t("12 months", "12 ay", "12 meses"), "90", "45"],
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
              "Founding (koltuk kaldıysa): ilk 100 cüzdan yeniledikçe −%50, rozet ve yeni derslerde erken erişim. Founding miras ayrıcalık — bu hafta katılmanın ana sebebi değil.",
              "Founding (si quedan asientos): las primeras 100 wallets en un plan tienen −50% al renovar, insignia y acceso temprano cuando haya clases nuevas. Es un perk legado — no el motivo para entrar esta semana.",
            )}
          </p>
        </section>

        <section id="score">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("How scoring works", "Puan nasıl yazılır", "Cómo se anota")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "Production scoring: the board only moves after an on-chain Groth16 submit verifies, then the host confirms your on-chain entry progress. The flag string stays in your browser / prover — never in the transaction. USDC split is under Payout math (split_pot only).",
              "Üretim skor: sıra yalnız on-chain Groth16 submit doğrulanıp zincirdeki giriş ilerlemen onaylanınca ilerler. Flag tarayıcı / prover’da kalır — tx’de yok. USDC bölünmesi Ödeme matematiği (yalnız split_pot).",
              "Scoring en producción: el ranking solo avanza tras submit Groth16 on-chain y confirmación del PDA. El flag queda en el navegador / prover — nunca en la tx. El USDC está en Matemática de pago (solo split_pot).",
            )}
          </p>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "Wrong flag: rejected before prove. Right flag: proof built, then on-chain submit. If circuit setup is unfinished, we still tell you the flag was correct even if the board is not updated yet.",
              "Yanlış flag: prove öncesi reddedilir. Doğru flag: proof üretilir, sonra on-chain submit. Circuit kurulumu bitmediyse flag’in doğru olduğunu yine söyleriz; sıra henüz güncellenmeyebilir.",
              "Flag mal: se rechaza antes del prove. Flag bien: se arma la prueba y luego submit on-chain. Si el setup del circuit no terminó, te decimos que acertaste aunque el ranking aún no se actualice.",
            )}
          </p>
        </section>

        <section id="academy">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Lesson archive", "Ders arşivi", "Archivo de clases")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "Published lessons live under /learn in two tracks. Cybersecurity: a documented incident rebuilt step by step. Math for cybersecurity: the number theory and crypto that broke or protected a real system, with small-number exercises. When a new lesson ships, drafts are human-reviewed before publish. Lesson practice flags are checked off-chain and never affect the Saturday board or pot.",
              "Yayımlanmış dersler /learn altında iki hatta. Siber güvenlik: belgelenmiş olay adım adım. Siber güvenlik için matematik: gerçek sistemi kıran/koruyan sayılar teorisi ve kripto, küçük sayılı alıştırmalarla. Yeni ders çıkarsa taslak insan review’dan geçer. Ders pratik flag’leri zincir dışında kontrol edilir; Cumartesi sırasını / potu etkilemez.",
              "Las clases publicadas viven en /learn en dos líneas. Ciberseguridad: incidente documentado paso a paso. Matemática para ciberseguridad: teoría de números y cripto que rompieron o protegieron un sistema real, con ejercicios chicos. Si sale una clase nueva, el borrador pasa por revisión humana. Los flags de práctica se validan off-chain y nunca afectan el ranking ni el pozo del sábado.",
            )}
          </p>
        </section>

        <section id="roadmap">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("What’s next", "Sırada ne var", "Qué sigue")}
          </h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-[15px] leading-7 text-cream/65">
            <li>
              {t(
                "Now: Devnet weekly official race, advertise the puzzle quality, grow a real player base. Mainnet when the crowd and pot justify real USDC — not “next week” by default.",
                "Şimdi: Devnet haftalık resmi yarış, puzzle kalitesini reklam et, gerçek oyuncu tabanı. Mainnet kitle ve pot gerçek USDC’yi hak edince — varsayılan “önümüzdeki hafta” değil.",
                "Ahora: carrera oficial semanal en Devnet, publicidad de la calidad de puzzles, base real de jugadores. Mainnet cuando la comunidad y el pozo justifiquen USDC real — no “la semana que viene” por defecto.",
              )}
            </li>
            <li>
              {t(
                "Later (not live): creator mode — players ship CTFs through the week; attempt limits; quality gates (enough distinct attempts + at least one solve); producer share of the pot. A higher-entry (~10 USDC) lane may appear with that design. Until then lock D stays: one official curated set.",
                "Sonra (canlı değil): üretici modu — oyuncular hafta boyunca CTF koyar; deneme limiti; kalite eşiği (yeterli farklı deneme + en az bir çözülme); üreticiye pot payı. ~10 USDC’lik giriş bu tasarımla gelebilir. O zamana kadar kilit D: tek resmi curated set.",
                "Después (no en vivo): modo creador — CTFs durante la semana; límite de intentos; umbral de calidad (intentos distintos + al menos un solve); share del pozo al productor. Puede aparecer un carril ~10 USDC con ese diseño. Hasta entonces candado D: un set oficial curado.",
              )}
            </li>
            <li>
              {t(
                "Later: optional UGC lessons / video commission on /learn (marketplace-style), only after the race Keep is stable.",
                "Sonra: isteğe bağlı UGC ders / video komisyon (/learn), yalnız yarış Keep’i oturunca.",
                "Después: clases UGC / comisión de video en /learn, solo cuando el Keep de la carrera esté estable.",
              )}
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
