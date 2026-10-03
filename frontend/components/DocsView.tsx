"use client";

import { useLang } from "@/lib/lang";

const NAV = [
  { href: "#overview", en: "Overview", tr: "Özet", es: "Resumen" },
  { href: "#locks", en: "Structural locks", tr: "Yapısal kilitler", es: "Candados estructurales" },
  { href: "#play", en: "How to play", tr: "Nasıl oynanır", es: "Cómo se juega" },
  { href: "#race", en: "The USDC race", tr: "USDC yarış", es: "La carrera USDC" },
  { href: "#math", en: "Payout math", tr: "Ödeme matematiği", es: "Matemática de pago" },
  { href: "#prestige", en: "Points & rewards", tr: "Puan ve ödül", es: "Puntos y premios" },
  { href: "#membership", en: "Academy membership", tr: "Akademi üyeliği", es: "Membresía Academia" },
  { href: "#score", en: "How scoring works", tr: "Puan nasıl yazılır", es: "Cómo se anota" },
  { href: "#academy", en: "Weekly lessons", tr: "Haftalık dersler", es: "Clases semanales" },
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
              "ZKCTF builds profitable on-chain capture-the-flag puzzles on Groth16 and tackles a real problem in cybersecurity education: good training is expensive and rarely based on real incidents. Two parts. The Academy publishes AI-assisted, human-reviewed lessons every week — cybersecurity and math for cybersecurity — each built on a reproduced real-life hack, for a few USDC a month. The Saturday race (18:00 Istanbul / 12:00 Buenos Aires) costs 5 USDC: 20% treasury, 80% to the top 10 by fixed formula, and Groth16 proves you solved without the flag landing on-chain.",
              "ZKCTF, Groth16 ile kazandıran zincir üstü CTF bulmacaları kurar ve siber güvenlik eğitimindeki gerçek bir sorunu hedefler: iyi eğitim pahalı ve nadiren gerçek olaylara dayanır. İki parça var. Akademi her hafta yapay zekâ destekli, insan editörden geçmiş dersler yayınlar — siber güvenlik ve siber güvenlik için matematik — her biri yeniden kurgulanmış gerçek bir hack, ayda birkaç USDC. Cumartesi yarışı (18:00 İstanbul / 12:00 Buenos Aires) 5 USDC: %20 treasury, %80 sabit formülle ilk 10; Groth16 çözdüğünü kanıtlar, flag zincire yazılmaz.",
              "ZKCTF construye puzzles CTF on-chain que pagan, sobre Groth16, y ataca un problema real de la educación en ciberseguridad: la buena formación es cara y rara vez se basa en incidentes reales. Dos partes. La Academia publica cada semana clases asistidas por IA y revisadas por una persona — ciberseguridad y matemática para ciberseguridad — cada una un hack real reconstruido, por unos pocos USDC al mes. La carrera del sábado (18:00 Estambul / 12:00 Buenos Aires) cuesta 5 USDC: 20% tesoro, 80% al top 10 con fórmula fija, y Groth16 prueba que resolviste sin que el flag vaya on-chain.",
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
              name={t("Weekly Academy", "Haftalık Akademi", "Academia semanal")}
              body={t(
                "Real hacks rebuilt as lessons, plus the math behind them. AI drafts, a human editor publishes. Membership in USDC. Never writes the Saturday board or pot.",
                "Dersler halinde yeniden kurulan gerçek hack’ler ve arkasındaki matematik. Taslak yapay zekâdan, yayın insan editörden. Üyelik USDC ile. Cumartesi sıralamasına / pota yazılmaz.",
                "Hacks reales reconstruidos como clases, más la matemática detrás. La IA hace el borrador, una persona publica. Membresía en USDC. No escribe el ranking ni el pozo del sábado.",
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
                "D — One curated official set per week. No player-created challenge marketplace.",
                "D — Haftada bir curated resmi set. Oyuncu UGC challenge marketplace yok.",
                "D — Un set oficial curado por semana. Sin marketplace UGC de desafíos.",
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
              "Entry is 5 USDC. Fiat is not accepted on this race. CTFs unlock in order. After the window, only wallets that cleared every CTF are ranked by finish time. N = 10. 20% treasury, 80% to that board with the fixed table. If fewer than 10 full clears, only they are paid (weights renormalized). If nobody cleared the set, the whole pot goes to treasury.",
              "Giriş 5 USDC. Fiat yok. CTF’ler sırayla açılır. Pencere bitince yalnız her CTF’i bitirenler bitiş zamanına göre sıralanır. N = 10. %20 treasury, %80 bu tablo. 10’dan az full clear varsa yalnız onlar (ağırlıklar yeniden ölçeklenir). Kimse seti bitirmediyse pot treasury’e.",
              "Entrada 5 USDC. Sin fiat. Los CTFs se abren en orden. Al cerrar, solo quienes completaron todos se ordenan por hora de cierre. N = 10. 20% tesoro, 80% con la tabla. Si hay menos de 10 clears, solo ellos (pesas reescaladas). Si nadie completó el set, todo al tesoro.",
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
                "Later, if the product is proven: optional seasonal USDC airdrops from treasury may appear — separate from the weekly formula above.",
                "İleride ürün kanıtlanırsa: treasury’den isteğe bağlı sezonluk USDC airdrop olabilir — yukarıdaki haftalık formülden ayrı.",
                "Más adelante, si el producto se prueba: pueden aparecer airdrops USDC estacionales desde el tesoro — aparte de la fórmula semanal de arriba.",
              )}
            </li>
          </ul>
        </section>

        <section id="membership">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Academy membership", "Akademi üyeliği", "Membresía Academia")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "One plan, paid in USDC on Solana. There is no card processor and no auto-renew. Checkout is a single transaction your wallet signs: the USDC transfer to the treasury and your on-chain membership seat (co-signed by the ZKCTF authority) succeed or fail together. Renewing extends the seat from its current end date. Membership opens every weekly lesson and the archive; the Saturday race is a separate 5 USDC entry.",
              "Tek plan, Solana üzerinde USDC ile. Kart işlemcisi ve otomatik yenileme yok. Ödeme, cüzdanının imzaladığı tek bir işlem: treasury’ye USDC transferi ve zincirdeki üyelik koltuğun (ZKCTF authority ortak imzalı) birlikte gerçekleşir ya da hiçbiri olmaz. Yenileme koltuğu mevcut bitiş tarihinden uzatır. Üyelik her haftalık dersi ve arşivi açar; Cumartesi yarışı ayrı bir 5 USDC giriş.",
              "Un solo plan, pagado en USDC en Solana. Sin procesador de tarjetas ni renovación automática. El checkout es una sola transacción que firma tu wallet: la transferencia USDC al tesoro y tu asiento de membresía on-chain (co-firmado por la autoridad de ZKCTF) se confirman juntos o no se confirma ninguno. Renovar extiende el asiento desde su fecha de fin. La membresía abre cada clase semanal y el archivo; la carrera del sábado es una entrada aparte de 5 USDC.",
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
              "Founding member perk: the first 100 wallets to buy any plan become Founding members. They pay 50% less for as long as they renew (the discount is stored on-chain in the seat), carry a Founding badge, and see every new lesson 24 hours before everyone else.",
              "Founding üye ayrıcalığı: herhangi bir planı alan ilk 100 cüzdan Founding üye olur. Yeniledikleri sürece %50 daha az öderler (indirim zincirdeki koltukta saklanır), Founding rozeti taşırlar ve her yeni dersi herkesten 24 saat önce görürler.",
              "Beneficio Founding: las primeras 100 wallets que compren cualquier plan son miembros Founding. Pagan 50% menos mientras renueven (el descuento queda guardado on-chain en el asiento), llevan insignia Founding y ven cada clase nueva 24 horas antes que el resto.",
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
            {t("Weekly lessons", "Haftalık dersler", "Clases semanales")}
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "Every week we publish new lessons in two tracks. Cybersecurity: a real, documented incident rebuilt step by step — the system, the exact flaw, the fix, and the bug class — with a simplified reproduction to analyse. Math for cybersecurity: the number theory, algebra and cryptography that broke or protected a real system, taught from first principles with small-number exercises.",
              "Her hafta iki alanda yeni dersler yayınlarız. Siber güvenlik: belgelenmiş gerçek bir olay adım adım yeniden kurulur — sistem, tam açık, düzeltme ve hata sınıfı — üstüne incelenecek sadeleştirilmiş bir yeniden üretim. Siber güvenlik için matematik: gerçek bir sistemi kıran ya da koruyan sayılar teorisi, cebir ve kriptografi, temelden ve küçük sayılı alıştırmalarla.",
              "Cada semana publicamos clases nuevas en dos líneas. Ciberseguridad: un incidente real y documentado reconstruido paso a paso — el sistema, la falla exacta, el fix y la clase de bug — con una reproducción simplificada para analizar. Matemática para ciberseguridad: la teoría de números, el álgebra y la criptografía que rompieron o protegieron un sistema real, desde cero y con ejercicios de números chicos.",
            )}
          </p>
          <p className="mt-4 text-[15px] leading-7 text-cream/65">
            {t(
              "How a lesson is made: an AI model writes the first draft; a human editor fact-checks the case and its sources, solves the exercise, rewrites what is wrong, and signs the lesson before it is published. Each lesson ends with a practice flag. Lesson flags are checked off-chain and never affect the Saturday board or pot.",
              "Bir ders nasıl yapılır: ilk taslağı bir yapay zekâ modeli yazar; insan editör olayı ve kaynaklarını doğrular, alıştırmayı çözer, yanlışları yeniden yazar ve yayından önce dersi imzalar. Her ders bir pratik flag ile biter. Ders flag’leri zincir dışında kontrol edilir; Cumartesi sıralamasını ve potu asla etkilemez.",
              "Cómo se hace una clase: un modelo de IA escribe el primer borrador; una persona verifica el caso y sus fuentes, resuelve el ejercicio, reescribe lo que está mal y firma la clase antes de publicarla. Cada clase termina con un flag de práctica. Los flags de clase se validan off-chain y nunca afectan el ranking ni el pozo del sábado.",
            )}
          </p>
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

