# ZKCTF Kurtarma Planı (v1)

Tarih: 2026-10-24  
Çerçeve: **DadPublicKeysAreBeneficial** (Dream → Description → Promise → Keep → Benefits)  
Amaç: Ekonomik “mucize kurtarma” değil; **dürüst, dar, tutulabilir** forma çekmek. Yan gelir / BusDev ana planı ayrı kalır.

---

## 0. Teşhis (bugüne kadar ki veri)

### Mevcut ürün (README / protocol / STRUCTURAL_LOCKS)
| Parça | Bugün |
| --- | --- |
| Cumartesi yarışı | 5 USDC, 24s, %20 hazine / %80 ilk 10, Groth16, flag zincire gitmez |
| Academy `/learn` | Haftalık AI taslak + insan review JSON; 10/27/90 USDC üyelik; Founding %50 |
| Gift | 3 Finisher → 1 ay Academy (bir kez) |
| NFT | Soulbound hafta rozeti |
| Kilit D | Haftada **tek resmi** set; **UGC challenge yok** |
| Host | Railway vb. remote; AI key opsiyonel (hikâye); bot settle/mint/generate |

### Neden kırıldı (DadPublicKeys)
| Basamak | Sorun |
| --- | --- |
| Dream | “Adil insan yarışı + ucuz eğitim” — bot/AI ve doygun Solana CTF ile çelişir |
| Description | Şişman (race + Academy + gift + NFT + Founding) |
| Promise | “İnsan kazansın / PoH / anti-bot” tutulamaz veya kitleyi soğutur |
| Keep | Tek kurucu + remote sırlar + haftalık bot + ders üretim maliyeti |
| Benefits | Açık pot + churn; gelir beklentisi yaşam maliyetiyle uyumsuz |

### Optimizasyon ilkesi
- Promise’i **bot düşmanı olmaktan çıkar**; solver + üretici diline çek.
- Kapsamı **küçült**; tek kişi Keep edebilsin.
- Remote’u **hacklenmiş varsay** (Railway dersi): gereksiz API key yok; varsa rate limit + rotate + minimum scope.
- `/learn` UGC komisyon = **Faz 2**, yarış omurgasını boğmasın.
- Ana para yolu hâlâ: **ödeyen GTM / blacklist kuralı** — ZKCTF yan / pilot.

---

## 1. Yeni vaat (Promise — one liner)

> **Cumartesi:** En iyi agent/solver kazanır (kurallar açık, ZK ile kanıt).  
> **Haftalık (opsiyonel dar):** Yaratıcı CTF — çözen + kaliteli üretici pay alır; istatistik şeffaf.  
> Eski vaat (“herkes adil, insan kazansın”) **resmen bırakılır**.

Dağıtım cümlesi: *“Agent yarışı + (dar) yaratıcı CTF. İstatistik açık, çözüm ZK ile.”*

---

## 2. Optimize protokol (mevcut → kurtarma)

### 2.1 On-chain omurga — **koru** (değiştirme)
Tutulacak kilitler:
- **A/B:** Ödeme / board yalnız Groth16 `submit`; flag zincirde yok
- **C:** `split_pot` sabit formül (istediğin ince ayar ayrı PR; keyfi ödül ix yok)
- **E:** Academy asla pot/board yazmaz
- **G:** Pot’tan reward token / stake kesme yok
- **H:** Pseudonym ≠ ödeme otoritesi

Ertele / dondur:
- **I:** Yeni NFT özellikleri yok; mevcut mint opsiyonel
- **J:** Gift dondur veya “pilot bitince değerlendir”
- Founding kampanyası büyütme yok

### 2.2 Race ekonomisi — **sadeleştir**
| Parametre | Öneri |
| --- | --- |
| Giriş | 5–10 USDC **veya** ücretsiz izle + ücretli katıl |
| Deneme | CTF başına **3–5** submit hakkı (spam ↓) |
| Anti-sybil | PoH **yok**; gerekirse yalnız **girişte** hafif captcha |
| Pot | %20 treasury / %80 top-N kalabilir; N=10 veya pilotta N=5 |
| Zorluk | Basit–orta puzzle; Damn Vulnerable DeFi kompleksi **yok** |
| Zincir | Önce **mevcut Solana yolu** (devnet kabul); “Base’e taşı” ancak Keep oturunca |

### 2.3 Cumartesi Agent / Solver Yarışı
- Ayda **1** (tek kişide haftalık agent + haftalık CTF = ölüm)
- Kurallar sayfada sabit: bot/agent serbest; en iyi solver kazanır
- ZK proof zorunlu (kopya flag yok)

### 2.4 Haftalık yaratıcı CTF (UGC) — **kilit D’yi bilinçli gevşet**
STRUCTURAL_LOCKS **D** kurtarma fazında şöyle revize:

| Kural | Detay |
| --- | --- |
| Kim üretir | Kayıtlı cüzdan; ön onay veya “pending” kuyruğu |
| Üretici pay | Haftalık potun **%10**’u üreticilere (basit oransal) |
| Kalite eşiği | En az **5 farklı** katılımcı denemiş **ve** en az **1 çözülme** → pay yoksa spam puanı yok |
| Self-farm | Kendi CTF’sine kasıtlı deneme **puan sayılmaz** / sıkı limit |
| İstatistik | Denedi / çözdü / süre — herkese açık |
| Ops | Tek kişiysen: **önce yalnız resmi haftalık set**; UGC’yi 4–6 hafta pilot sonrası aç |

### 2.5 `/learn` — **durur, maliyet kesilir; UGC komisyon Faz 2**
| Şimdi | Kurtarma |
| --- | --- |
| Sen aylık abonelik / ağır AI ders maliyeti | **Kes:** yeni ücretli dış abonelik yok; AI key remote’ta yok veya çok kısıtlı |
| Mevcut published JSON | **Kalır** (sayfa aynı görünür) |
| 10/27/90 üyelik | Pilot süresince **satışı dondur veya “legacy only”**; yeni vaat yarışta |
| GnosisLand-tarzı video + fee | **Faz 2:** tek % komisyon, net üreticiye ekranda, uygunsuz → ban; yield/DeFi katmanı **yok** |

Learn Promise (Faz 2 one-liner): *“Video koyarsın, izleyen öder, protokol sabit % alır; kural ihlali = yayın yasağı.”*

### 2.6 Güvenlik (Railway sonrası)
- Remote’taki her secret **compromised varsay**
- `ANTHROPIC_*` / genel “ZKCTF API” public remote’ta **koymama** tercihi; zorunluysa: ayrı key, rate limit, allowlist, rotate
- Firewall ≠ güven; en az ayrıcalık
- Ops: [OPS.md](OPS.md) — keypair/ATA public README’ye yok

---

## 3. Fazlar

### Faz 0 — Freeze (≈1 hafta) — “maliyet kes + assume-breach”
Ne yapılır:
- “İnsan adil kazansın” copy’sini durdur; yeni Promise one-liner koy
- Yeni Academy AI draft / ücretli dış abonelik **yok** (maliyet kes)
- Remote secret rotate; Anthropic/ZKCTF API key remote’ta yok veya kısıtlı (assume-breach)
- UGC CTF / Learn video / yeni NFT **başlatma**

Ne yapılmaz: Yeni yarış formatı kodlamak zorunda değilsin; önce vaat + güvenlik.

### Faz 1 — Davetli pilot (4–6 hafta) — **tek yarış türü = haftalık resmi CTF (varsayılan)**

**Hayır — Faz 1 “sadece Cumartesi” değil.**

| | Faz 1’de |
| --- | --- |
| **Ana / tek canlı tür** | **Haftalık resmi CTF** (bugünkü Cumartesi 24s yarışının dar hali: davetli, 5 USDC veya sponsor pot, basit–orta puzzle, deneme limiti, açık istatistik) |
| **Cumartesi “Agent / Solver” özel formatı** | Faz 1’de **yok** veya en fazla **ayda 1 deneme** — varsayılan değil |
| **Yaratıcı UGC CTF** | Faz 1’de **kapalı** (sadece kalite kurallarını tasarla; canlı açma) |
| **`/learn` UGC video** | Faz 1’de **kapalı**; mevcut JSON dersler read-only kalabilir |

Neden haftalık resmi, neden Cumartesi agent değil:  
Tek kurucuda “her Cumartesi agent + her hafta CTF” Keep’i kırar. Mevcut omurga zaten **haftalık/Cumartesi resmi race**; pilot bunu **davetli + dürüst vaat** ile sürdürür. Agent günü = Faz 2 süsü.

Faz 1 checklist:
- 10–20 davetli (LATAM / tanıdık / Superteam)
- Pot: sen veya küçük sponsor; gelir hedefi başarı kriteri **değil** ($0–500 normal)
- Başarı: ≈**8–15** tekrar aktif cüzdan (üretici UGC henüz zorunlu değil)
- Her yarış sonu: kısa özet (kazanan + istatistik)
- Aynı anda ikinci yarış türü açma

### Faz 2 — Açık dar + üretici CTF + Learn UGC (pilot Keep’ten sonra)
- **Üretici programı (şimdi değil):** hafta boyunca oyuncu CTF üretir; “en çok / en kaliteli üreten” pay alır; **deneme sınırı**; kalite eşiği (yeterli farklı deneme + ≥1 çözülme); self-farm yok. Giriş **~10 USDC** bu tasarımla (veya resmi 5 USDC + ayrı üretici ligi) — Docs’ta “Sırada ne var / What’s next”.
- `/learn` video komisyon (GnosisLand fee sade): örn. brüt **%15 protokol / %85 üretici** (optimize sayı PR’da netleşir)
- Custom CTF hizmeti = **yan kanal**, ana ürün değil
- Cumartesi agent = ayda 1

### Faz 3 — Bilinçli büyütme veya dondur
- Benefits yoksa (tekrar yok, üretici yok): **dondur / hobi** — ikinci ZKCTF ego’su yok
- Benefits varsa: ince ücretli katılım + komisyon; yine BusDev ana gelir ayrı

---

## 4. Gelir ve dağıtım gerçekçiliği

| Kanal | Rol |
| --- | --- |
| Race pot / treasury | Sembolik; yaşam maliyeti değil |
| Learn komisyon | Faz 2; cold start zor |
| Custom CTF / GTM yardımı | Asıl nakit adayı (Colosseum ekipleri, blacklist kuralı) |
| Beklenti (ilk aylar) | **$0–500**; başarı = tekrar katılım + tutulmuş Promise |

Ana mesajda “ucuz Academy + Founding + gift + NFT” yığını **yok**.

---

## 5. Operasyonel altın kurallar (tek kurucu)

1. Aynı anda **tek** canlı yarış türü.
2. UGC açmadan önce istatistik + deneme limiti.
3. Self-farm ve spam CTF’ye pay yok.
4. Remote AI/API overuse yok.
5. Ödeme yoksa hizmet yok (senin BusDev kuralın ZKCTF custom işlerinde de geçerli).
6. STRUCTURAL_LOCKS güncellemesi: bu dosya kurtarma ile **D (ve gerekirse I/J)** için resmi sapma kaydı; A/B/C/E/G dokunulmaz.

---

## 6. Başarı / bırakma kriterleri

**Devam (Faz 2’ye geç):**  
Pilot sonunda ≥8 haftalık aktif cüzdan **veya** ≥3 kalite eşiğini geçen üretici CTF + sen Keep’i sürdürebildin.

**Dondur:**  
Bot/AI tekeli şikayeti bitmedi çünkü vaat yine “adil insan”; veya remote yangını / maliyet Keep’i aşıyor; veya 6 hafta sıfır tekrar.

**Asla:**  
Bunu Argentina / askerlik / tek gelir “kurtarma” sanmak. Kurtarılan şey **dürüst protokol + öğrenilmiş merdiven**.

---

## 7. Özet tablo

| | Eski | Kurtarma |
| --- | --- | --- |
| Promise | İnsan adil kazansın | Solver + (dar) üretici |
| Bot | Düşman / PoH hayali | Cumartesi kuralı: serbest |
| Kapsam | Race+Academy+NFT+gift | Race dar; Learn dondur→UGC sonra |
| UGC CTF | Yasak (kilit D) | Eşikli %10 pay (Faz 1.5–2) |
| Learn para | Sen abonelik/AI maliyet | Kes; komisyon Faz 2 |
| Remote | Key’ler host’ta | Assume breach |
| Gelir hayali | Yüksek | $0–500 + GTM yan |

---

## 8. Sonraki somut işler (kod değil, sıra)

1. Site / Docs copy → yeni Promise one-liner.  
2. STRUCTURAL_LOCKS.md’ye “Rescue amendment” paragrafı.  
3. Deneme limiti + public stats (Faz 1).  
4. Secret rotate + AI key politikası (OPS).  
5. Davetli 10–20 liste + ilk pilot tarihi.  
6. UGC CTF ve Learn video **ayrı ticket**; yarış stabil olmadan birleştirme.

Bu plan optimize protokolü “yeni zincir / yeni model” diye şişirmez: **mevcut Groth16 + pot matematiğini korur**, vaadi ve operasyon kapsamını dürüstleştirir.
