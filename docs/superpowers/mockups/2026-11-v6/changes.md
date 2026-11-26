# Gain Train mockup v6 – ändringar

v6 svarar på expertgranskningen (E) och flödesgranskningen (F) från 18 november. Ramarna finns i `mockup.html`; varje ram har en etikett med de fynd den svarar på.

Etiketter: **F-P1.1** är fynd 1 i flödesgranskningens prioriterade lista (P1–P3, numrerade 1–36). **F-S3.6** är steg 6 i flöde 3. **E-P1** till **E-P11** är expertens förslag. **E-A**, **E-B** och **E-C** är punkterna i expertens träningsdel (A muskelmappning, B volym, C progression). **E-§4** är en punkt under expertens kategori 4 som inte står i ett förslag.

Status: *Med i v6*, *Delvis*, *Tas inte* (ägarens beslut) eller *Senare / i data* (ändras i koden, ingen skärm).

## Runda 8: ägarens kommentarer på mockupen (26 november)

Ägarens 16 kommentarer på mockup.html. Ändrade ramar har en fylld etikett "Ägaren r8: …". Byggkällorna gick förlorade, så ändringarna är gjorda direkt i den byggda `mockup.html` och kontrollerade med `check8.cjs`.

| Nr | Ram | Kommentar | Ändring | Ramar |
|---|---|---|---|---|
| R8-1 | A2 | Se till att pilen pekar åt rätt håll från vart man drog passet. | Brickan sitter på den sida passet kom ifrån och pilen pekar åt det håll det flyttades: tisdagens pass kom från måndag, så brickan sitter i vänster hörn med pilen åt höger; ett pass som flyttats bakåt får brickan till höger med pilen åt vänster. Förklaringen säger "Flyttat hit från mån". | A2,A2d |
| R8-2 | A2 | Ta bort siffran i ikonen; kortet säger redan hur många övningar. | Siffran i passikonerna (Benpass, Tryckpass) är borta. | A2,A2d |
| R8-3 | B2 | Det räcker med att skriva "Förra" här. | Övningshuvudet säger inte längre "förra 3" (antalet set förra gången); föregående resultat står bara under kolumnrubriken "Förra". Gäller alla passramar. | B2,B1,B3 |
| R8-4 | B9 | Ta inte bort befintliga animationer på knapparna när passet är klart. | Appens animationer är med: Avsluta är en kontur medan set är okryssade och fylls med appens långsamma accentgradient (finish-shift, 4 s, still vid reducerad rörelse) när alla är ikryssade; dockans "Avsluta pass" har raden "Alla N set klara · tid"; Släng får röd kontur och etiketten tonar in på 120 ms vid andra trycket; knapparnas färger tonar med rörelsetokens. | B9,B10 |
| R8-5 | B12 | Med RIR påslaget ska RIR vara en egen ruta, precis som kg och reps. | Setraden får en fjärde ruta RIR (kolumnen RIR, "–" tills den är ifylld); ett tryck på den öppnar plattan i RIR-läget. Undertexten "RIR 2" under Förra är borta. | B12 |
| R8-6 | B12 | Använd en dragbar slider som i Hevy. | De sex knapparna är ersatta av ett dragbart reglage 0 (max) till 5+ (lätt) med en 44 px tumme, steg vid varje heltal och en mening per värde med motsvarande RPE. Dra, tryck på spåret eller använd piltangenter, Home och End (role="slider", aria-valuetext). Tummen glider med --gt-dur-quick och --gt-ease-out och står still vid reducerad rörelse. | B12 |
| R8-7 | B13 | Meddelandet ska försvinna när man gjort ett val. | Efter "Sänk till 20 × 8" eller "Behåll målet" fälls raden ihop (row-out, collapse). Sänk visar en toast med Ångra i 5 s; Ångra ställer tillbaka målet och raden. | B13 |
| R8-8 | C1 | En prick mitt i rutan för i dag i stället för en ram. | I dag är en 4 px prick i accent mitt i rutan (i ink på en gjord dag), också i förklaringen. | C1 |
| R8-9 | D1 | Anatomiskt korrekta namn, och alla separata muskler som syns i kartan. | Utfällningen listar exakt kartans 24 muskler, fördelade på grupperna, med anatomiska svenska namn (Stora bröstmuskeln, Främre/Mellersta/Bakre deltamuskeln, Breda ryggmuskeln, Romboiderna och kappmuskelns mittdel, Kappmuskelns övre del, Ryggresarna (ländrygg), Mellersta sätesmuskeln, Fyrhövdade lårmuskeln, Bakre lårmusklerna, Flundremuskeln, Främre skenbensmuskeln, Höftböjarna (iliopsoas) m.fl.). Muskler som inte bedöms står i grått. | D1,F3 |
| R8-10 | D2 | Jämförelsen är svår att läsa; strukturera bättre. | Två rutor sida vid sida, Nu (tis 17: 4 × 80 kg × 6, ≈ 96 kg 1RM) och Förra (tor 12: 4 × 82,5 kg × 5, ≈ 96), och skillnaden som tre korta brickor: +1 rep, −2,5 kg, 1RM lika. | D2 |
| R8-11 | D3 | Ta bort den nedersta vadmuskeln framifrån och gör en tydligare separation för vadbenet. | Formen soleusF är borttagen; tibialis och calfF är omritade så skenbenet syns som ett glapp på cirka 3 enheter mellan dem. | D3,D3b,H3 |
| R8-12 | D3b | Höftböjaren ska ha rätt anatomisk form i relation till musklerna runt om. | hipFlexors är ett smalt band från under ljumsklinjen (de sneda bukmusklernas nedre kant) snett inåt och nedåt mellan rFem och adductors, ritat sist, i stället för en kil. | D3b,H3 |
| R8-13 | E4 | Muskelkartan ska följa med när man scrollar ner. | Kartan står kvar överst i sin kolumn medan musklerna rullar (sticky), i Enkel och Avancerad. | E4,E3 |
| R8-14 | F1 | Inte så stor marginal mellan raderna. | Periodens kalender har 2 px mellan raderna (var 3), och förklaringen, texten under och varningsrutans länkar står tätare (länkarna behåller 44 px). | F1 |
| R8-15 | F2 | Prick för i dag, som C1. | I dag är en prick mitt i rutan, här inne i planerat-ringen eftersom Benpass är planerat i dag; förklaringen visar pricken. | F2 |
| R8-16 | F3 | Minska marginalerna mellan textraderna. | Coachrutans rader står tätt (länkarna behåller 44 px men deras ytor överlappar marginalen), och gruppradernas värde och "0 av 3 inom" har tätare radavstånd. | F3,F3d |

### Kontroll runda 8

Runda 8, mätt med check8.cjs (nytt skript, eftersom verify3.cjs och byggkällorna gick förlorade): Playwright i Chromium och WebKit, 390 och 1100 px breda fönster, ljust och mörkt sidtema (8 körningar): 200 av 200 kontroller godkända, 25 per körning, varav 19 för de 16 kommentarerna. 0 av 1 201 interaktiva element under 44 × 44 px (också efter interaktion), 0 av 2 456 textelement utanför 12/13/15/17/20/28 och 400/600/700, inga konsolfel och ingen sidledsrullning. Alla 497 synliga kontroller i de 15 LIVE-ramarna ändrar något, i båda motorerna. Kontrollerna som testade det runda 8 ändrade är ersatta: RIR som undertext (nu egen ruta och reglage som dras, stegas med tangenter och står still vid reducerad rörelse), i dag som ring (nu prick), trötthetsraden efter ett val (nu borta, Ångra i toast) och muskelnamnen i utfällningen (nu kartans 24 muskler med anatomiska namn).

## Runda 7: ägarens kommentarer (25 november)

Ägarens 29 kommentarer på sammanfattningen "Ändringar per sida". De går före tidigare granskningsförslag. Varje ändrad ram har en fylld etikett "Ägaren: …". Nya ramar: B12, B13, D3b, E2s, E2r, E6b.

| Nr | Sida, ram | Kommentar | Ändring | Ramar |
|---|---|---|---|---|
| Ä1 | Träna, A2 | Flyttat-pilen ser för liten och smal ut; visa på ett annat sätt eller med en annan ikon. | Flyttat är appens hörnbricka (samma form som antalsbrickan i kalendern): en 20 px rund bricka i ink med en pil i 3 px linje i dagens hörn. Förklaringen under remsan visar samma bricka, "Flyttat hit". | A2,A2d |
| Ä2 | Passet, B1 | Fälten fylls med målet, men sent i passet efter mycket volym för samma muskel orkar man inte målet. Kan appen förstå det och hantera det snyggt? | Ny ram B13: när en huvudmuskel har minst 3 hårda set fler före övningen än förra gången står en lugn rad under rubriken ("Framsida lår har redan fått 6 hårda set i dag …") med "Sänk till 20 × 8" (ett viktsteg, med Ångra, räknas inte som missat mål) eller "Behåll målet". Inget ändras av sig självt; läget (Av, Föreslå, Automatiskt) står i Inställningar → Coach. Forskningssvaret står nedan. | B13,G1 |
| Ä3 | Passet, B2 | Set är lätta att skapa igen, så ingen Ångra behövs när ett set raderas. | Svep raderar setet direkt och raden fälls ihop, utan ångra-plats. "Lägg till set" ger det tillbaka med ett tryck. Ångra finns kvar där mer går förlorat (slänga pass, coachåtgärder). | B2,H5 |
| Ä4 | Passet, B1 | Vilotimern ska vara av från start. | Vilotimern är av från start i Inställningar, och en ny användares pass visar "Vila av" (B9 läge 1). Demoanvändaren har slagit på vilan för Benpass övningar i passet, så B1, B3 och B8 visar den. | G1,B8,B9,B1 |
| Ä5 | Passet, B4–B7 | Coach i passet: testa, men inte påtvingat för den som inte vill; lätt att stänga av eller diskret. | Coachen har en egen grupp i Inställningar: "Tips i passet" (uppvärmning och drop i setbladet) och "Trött muskel sent i passet" (Av, Föreslå, Automatiskt). I passet är coachen en rad i ink-2 utan färgad ruta, med "Behåll målet" som stänger den. | G1,B13 |
| Ä6 | Passet, B4 | Se hur Hevy har hanterat RIR/RPE och hur de designat ett tangentbord för effort; föreslå en egen lösning. | Ny ram B12: med "Fråga efter RIR" på får plattan ett tredje läge efter kg och Reps. Sex stora knappar 0 (max), 1, 2, 3, 4, 5+ (lätt), en rad som förklarar valet och visar motsvarande RPE, "Hoppa över" och "Klar". Setraden visar "RIR 2" under Förra. Forskningssvaret om Hevy står nedan. | B12,B4,G1 |
| Ä7 | Passet, B5 | Fler drop kräver i dag setbladet; när första dropen är lagd ska det finnas en snabb knapp för fler. | När en övning har en drop får foten en knapp "+ Drop" bredvid "Lägg till set". Ett tryck lägger nästa drop med −20 % avrundat till steget (50 → 40 kg) och öppnar plattan på reps. På plattan blir "Som förra passet" "−20 %" för drop. | B5 |
| Ä8 | Passet, B8 | Håll tidsvalen på en rad. | Tiderna 1:00–5:00 är ett segment på en rad; "Egen tid" är en rad under. | B8 |
| Ä9 | Passet, B9 läge 2 | Avsluta med rekord är lite svårläst och ordigt. | Avslutet är en fråga, en rekordrad ("Nytt rekord · Knäböj 100 kg × 6", förra bästa under), tre tal, en rad om okryssade set, anteckningen och knapparna. Musklerna är borta ur avslutet (också i B10). | B9,B10 |
| Ä10 | Passet, B9 belöning | Veckoraden behöver inte synas här; ha i stället en direkt knapp till schemat. | Belöningen har ingen veckorad. I stället en knapp "Visa schemat Styrkeblock" (går till F2) ovanför Klar; en ny användare utan schema ser bara Klar. | B9 |
| Ä11 | Passet, B11 | Sätt ordningsnumret som övningen valts i i check-cirkeln. | Valda övningar har sitt nummer (1, 2, 3 …) i check-cirkeln i den ordning de valdes, och läggs till i passet i den ordningen; avmarkeras en flyttar de efter upp. | B11 |
| Ä12 | Kalender, C1 | Att pricka specifika dagar i den här vyn är för svårt. | Ett tryck på en enskild dag gör inget. Håll in 0,55 s och dra: i samma kolumn en vecka, i samma rad en veckodag över flera veckor ("Måndagar, 26 okt – 16 nov · 3 pass · 4 veckor"), annars en period. Listan visar bara valet; "Rensa val" går tillbaka. Ett pass i listan öppnas med ett tryck. | C1 |
| Ä13 | Kalender, C1 | Ta inte bort dag- och veckomarkeringar; behåll den komprimerade kalendern som den är i appen. | Kartan är appens komprimerade kalender: 12 px rutor, 3 px mellanrum, en kolumn per vecka, veckodagarnas bokstäver till vänster, månaderna överst, gjort grönt, i dag accentring, planerat en ring, varannan månad en svag ton. Den rullar i sidled och börjar på den senaste veckan. | C1 |
| Ä14 | Framsteg, D1 | Visa inte svagaste muskeln på gruppraden, summera gruppen; behåll utfällningen. | Gruppraden visar gruppens summa (huvudmusklernas hårda set, Axlar 12,5), stapeln mot 10–20 per muskel och "0 av 3 inom". Ingen muskel nämns på raden. Utfällningen visar varje muskel. | D1,F3 |
| Ä15 | Framsteg, D1 | Håll utfällningen kompakt. | En 28 px rad per muskel med tunn stapel och värde och plan på samma rad (var 40 px). | D1,F3 |
| Ä16 | Framsteg, D4 | För mycket text, strukturera bättre. | Varje mål: stapeln, tre tal för uppskattat 1RM (Start, Nu, Mål) med lyftet under, en rad med takt mot vad som krävs och trolig nivå som intervall. Förklaringen ligger bakom ⓘ. | D4 |
| Ä17 | Övningssidan, D2 | Senaste passen kan flyttas till Historik-fliken. | Översikt har inte längre passlistan; den finns under Historik, och en rad längst ned leder dit. I stället en liten kurva över uppskattat 1RM. | D2 |
| Ä18 | Övningssidan, D3 | Förenkla framsidan lite så den ser mer utfylld ut men fortfarande anatomiskt korrekt. | Lårens, vadens och underarmens former är 5–10 % större så mellanrummen blir linjer; magen är tre par och nedre delen med tunna linjer; underbenets fyra smala former är tre. Inga id ändras. | D3,H3 |
| Ä19 | Övningssidan, D3 | Borde gluteus medius sitta tätare mot gluteus maximus? | Ja. Medius ligger direkt ovanför och lateralt om maximus och delvis under den. Formen gluteMed går nu in under gluteMax, så de skiljs av en 1,4 px linje i stället för en svart kil. | D3,H3 |
| Ä20 | Övningssidan, D3 | Kartan saknar höftböjare och kanske andra relevanta muskler. | Höftböjare (iliopsoas, nytt id hipFlexors) läggs till som delmuskel: syns i röd skala, bedöms inte. Raka lårmuskeln ingår redan i framsida lår. Rotatorkuffen, lilla sätesmuskeln, främre sågmuskeln och nacken läggs inte till (skäl i D3b). Mappningen som behövs i appen står nedan. | D3b,H3 |
| Ä21 | Bibliotek, E2 | Man ska kunna dela schema; mottagaren kan gå med och följa schemat med den som delat, eller starta det själv från valfri startpunkt. | Varje schema har en dela-knapp (E2s: vad som delas och inte, "Låt andra följa med dig", Dela länk). Mottagaren (E2r) ser schemat i den komprimerade kalendern och väljer "Följ med Erik" (samma vecka, ser när den andra har kört dagens pass) eller "Starta själv" från vald vecka och dag. | E2,E2s,E2r |
| Ä22 | Bibliotek, E6 | Ett + i stället för "Spara". | Varje program har ett runt + (44 px) som blir ✓ när det är tillagt. | E6 |
| Ä23 | Bibliotek, E6 | Skapa bra vetenskapsbaserade standardpass i olika kategorier. | Fem program i kategorier (Helkropp, Över/under, Tryck/drag/ben, Styrka, Hemma) med övningar, set och repintervall; E6b visar ett program med hårda set per muskel och vecka räknat med volymkortets modell. Listan står nedan. | E6,E6b |
| Ä24 | Egen övning, E3 | Maskinikonen är bra men låspinnen behövs inte. | Maskinens glyf är skenor och viktstapel, utan det utdragna stiftet. | E3,H4 |
| Ä25 | Egen övning, E3 | Muskelkartan i väljaren blir för liten att trycka på; gör den större, låt man vända den, och lägg valen bredvid figuren. | Figuren visar en sida åt gången i 138 × 327 px (ungefär dubbelt så stora muskler), "Fram / Bak" vänder den, och grupperna med Ingen/Lite/Mycket står i en kolumn bredvid. Samma i avancerat läge (E4). | E3,E4 |
| Ä26 | Schema, F1 | Visa hela schemaperioden med samma element som den komprimerade kalendern. | Under "Din vecka" står hela perioden (21 dec – 14 feb) som komprimerad kalender: planerade pass som ringar, deloadveckan i deload-tonen. | F1 |
| Ä27 | Schema, F2 | Här kan du också visa den komprimerade kalendervyn. | Fasbalken och veckoremsan är ersatta av perioden i den komprimerade kalendern med "v. 1", "nu" och "deload" under och en förklaring bredvid. De 13 gröna rutorna är de 13 passen i Kalender. | F2 |
| Ä28 | Schema, F3 | För mycket mellanrum mellan raderna, komprimera. | En 44 px rad per grupp utan undertextrad (var 48 px plus en rad), 28 px per muskel i utfällningen, kortare text under. | F3,F3d |
| Ä29 | Inställningar, G1 | Gruppera relaterade inställningar: vilotimer, ljud och vibration hör ihop, men inte RIR och viktenhet. | Grupperna är Utseende, Vilotimer (brytaren och under den Ljud och Vibrera, som bara visas när timern är på), Loggning (Viktenhet, Fråga efter RIR), Coach och Allmänt. | G1 |

### Svar: trötthet sent i passet

Träningsvetenskapen löser det med autoreglering: en övning senare i passet ger färre reps (Simão m.fl. 2012), så målet ska vara ett intervall med reps kvar i tanken och lasten justeras efter hur seten faktiskt går (RIR-baserad RPE, Zourdos m.fl. 2016; Helms m.fl. 2016). Hevy och Strong visar förra värdena utan att justera för trötthet i passet, RP Hypertrophy justerar veckan efter pump, ömhet och arbetsbörda, JuggernautAI justerar nästa set efter RPE, och Fitbod räknar trötthet per muskel från senaste träningen.

- **Ordningen spelar roll.** En övning som görs senare i passet ger färre reps och mindre volym än samma övning först, oavsett muskelns storlek. Rådet är att ordna efter vad som är viktigast för målet (Simão m.fl. 2012).
- **Trötthet mellan set.** Med samma vikt och kort vila sjunker reps från set till set. Därför är ett fast mål från förra passet bara rätt om passet ser ut som förra gången.
- **Autoreglering.** RIR-baserad RPE (0 = inga reps kvar, 2 = två kvar) låter lasten följa dagsformen; Helms m.fl. beskriver hur lasten justeras från set till set.
- **Appar.** Hevy visar förra värdena i kolumnen PREVIOUS och har RPE som valfri loggning; Strong visar förra värdena (ingen officiell beskrivning av trötthetsanpassning hittad). RP Hypertrophy frågar efter pump, ömhet och arbetsbörda och bygger om veckan. JuggernautAI justerar nästa set i realtid från RPE på toppsetet. Fitbod ger varje muskel en återhämtningsprocent från tidigare pass och väljer övningar och vikter efter den.
- **Vår lösning (B13).** Appen vet redan hur många hårda set varje muskel fått före en övning i dag och förra gången. Är skillnaden minst 3 set visas en lugn rad med "Sänk till …" (ett viktsteg) eller "Behåll målet". Inget ändras av sig självt, ett sänkt mål räknas inte som missat i progressionen, och läget Av/Föreslå/Automatiskt står i Inställningar. Med RIR på kan nästa set få ett lägre mål om förra setet gick till RIR 0 under intervallet.

Källor:
- [Simão m.fl. 2012, Exercise order in resistance training, Sports Medicine 42(3)](https://pubmed.ncbi.nlm.nih.gov/22292516/)
- [Zourdos m.fl. 2016, RIR-baserad RPE-skala, J Strength Cond Res 30(1)](https://openrepository.aut.ac.nz/items/efef3b25-6701-4fb5-bb82-55fcd2a26027)
- [Helms m.fl. 2016, Application of the RIR-based RPE scale, Strength Cond J 38(4)](https://ro.ecu.edu.au/ecuworkspost2013/2114)
- [Hevy: kolumnen PREVIOUS](https://www.hevyapp.com/features/track-exercises/)
- [RP Hypertrophy: anpassning efter pump, ömhet och arbetsbörda](https://rpstrength.com/rphypeapp)
- [JuggernautAI: RPE och RIR](https://help.jtsstrength.com/en/articles/2-all-about-rpe-and-rir)
- [JuggernautAI: hur programmet anpassas](https://help.jtsstrength.com/en/articles/3-how-juggernautai-is-individualized-to-you)
- [Fitbod: Muscle Recovery](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery)

### Svar: Hevys inmatning av ansträngning (RPE/RIR)

Hevy har RPE som valfri loggning: slås på i inställningarna, ger en RPE-kolumn längst till höger i setraden, och ett tryck öppnar bladet "Log Set RPE" med en skala 6–10 i halva steg där varje värde har en mening ("RPE 8: kunde ha gjort 2 reps till"); fältet kan lämnas tomt och RPE kan inte sättas som mål i en rutin. Vi behåller idén (ett tryck, en mening per värde, valfritt) men lägger RIR 0–5+ i vår platta som ett tredje läge efter kg och Reps, så setraden från v5 står kvar.

- **Påslag.** RPE slås på i Hevys inställningar (Settings → Workouts → RPE tracking).
- **Var.** En RPE-kolumn längst till höger i varje set; ett tryck öppnar bladet "Log Set RPE".
- **Skala.** 6 till 10 med halva steg. Varje värde har en mening: RPE 6 = 4+ reps kvar, 7 = 3, 7,5 = 2–3, 8 = 2, 8,5 = 1–2, 9 = 1, 9,5 = kanske 1, 10 = inga.
- **Valfritt.** Fältet kan lämnas tomt för vissa set; RPE kan inte sättas som mål i en rutin.
- **Vår lösning (B12).** RIR i stället för RPE, eftersom "hur många reps hade du kvar?" är lättare att svara på mitt i ett pass och volymkortet redan räknar med RIR. Sex stora knappar (0 max, 1, 2, 3, 4, 5+ lätt) i plattans rutnät, en förklarande rad med motsvarande RPE, "Hoppa över" och "Klar". Läget kommer efter Reps bara när "Fråga efter RIR" är på; setraden visar "RIR 2" under Förra.

Hevys sidor gick inte att öppna direkt från den här miljön; uppgifterna kommer från sökresultatens utdrag ur Hevys hjälpcenter och funktionssidor.

Källor:
- [Hevy hjälpcenter: What is RPE?](https://help.hevyapp.com/hc/en-us/articles/34490600233111)
- [Hevy: How to calculate RPE (skalan med meningar)](https://www.hevyapp.com/features/how-to-calculate-rpe/)
- [Hevy: RPE scale](https://www.hevyapp.com/rpe-scale/)
- [Zourdos m.fl. 2016, RIR-baserad RPE-skala](https://openrepository.aut.ac.nz/items/efef3b25-6701-4fb5-bb82-55fcd2a26027)

### Höftböjare: mappning som behövs i appen

- `src/data/muscles.ts`: Lägg "hipFlexors" sist i MUSCLES (id ändras aldrig, så sist) och hipFlexors: "Legs" i MUSCLE_GROUP.
- `src/i18n/sv.ts, en.ts`: "muscleName.hipFlexors": "Höftböjare" / "Hip flexors", och latin "iliopsoas" där latinet står.
- `src/data/exercise-muscles.ts`: Hanging Leg Raise och Leg Raise: hipFlexors 1, abs 1 (var bara mage). Sit Up, Mountain Climber och V-up: hipFlexors 0,5. Dead Bug oförändrad.
- `src/lib/muscle-figure.ts`: ICON_ZONES.thighs får hipFlexors; VIEW_SIDE hipFlexors: 1 (framifrån).
- `src/data/muscle-sets.ts`: Delmuskel: visas i kartan, bedöms aldrig mot 10–20 (som tibialis).
- `src/components/muscles/detailed-geometry.ts`: FIGURES.m och FIGURES.f: formen hipFlexors (ritas sist i front), gluteMed omritad, framsidans former enligt H3. Tester: tests/exercise-muscles.test.ts och kartans snapshot.

### Standardprogrammen (E6)

**Helkropp A/B** (Helkropp · Nybörjare · 3 dagar, A B A och sedan B A B). Hela kroppen två gånger i veckan; de flesta huvudmuskler får 5–13 hårda set i veckan, nog de första månaderna. Flerledsövningar först, 1–3 reps kvar i tanken, dubbel progression. Hårda set per huvudmuskel i veckan: 2,25–12,75.

- Helkropp A: Knäböj 3 × 5–8, Bänkpress 3 × 6–10, Sittande rodd med kabel 3 × 8–12, Rumänsk marklyft 2 × 8–10, Sidolyft 2 × 12–15
- Helkropp B: Benpress 3 × 8–12, Bänkpress med hantlar 2 × 8–12, Axelpress 3 × 6–10, Latsdrag 3 × 8–12, Höftlyft 2 × 8–12, Bicepscurl 2 × 10–15, Tricepsnedtryck med kabel 2 × 10–15, Stående vadpress 2 × 10–15

**Över/under 4 dagar** (Över/under · Van · 4 dagar: mån, tis, tor, fre). Varje muskel två gånger i veckan och de flesta huvudmuskler 10–18 hårda set, tunga flerled (5–8 reps) först och lättare isolering (10–20) sist. Hårda set per huvudmuskel i veckan: 6,5–17,5.

- Överkropp A: Bänkpress 5 × 5–8, Framåtböjd rodd 4 × 6–10, Axelpress 3 × 6–10, Sidolyft 3 × 12–20, Latsdrag 3 × 8–12, Bicepscurl 2 × 10–15, Tricepsnedtryck med kabel 2 × 10–15
- Underkropp A: Knäböj 4 × 5–8, Rumänsk marklyft 3 × 6–10, Bulgarisk utfallsböj 3 × 8–12, Liggande lårcurl 2 × 10–15, Stående vadpress 4 × 10–15
- Överkropp B: Lutande bänkpress med hantlar 3 × 8–12, Bänkpress med hantlar 4 × 8–12, Chins 3 × 6–10, Sittande rodd med kabel 3 × 10–12, Sidolyft 4 × 12–20, Omvända flyes med hantlar 3 × 12–20, Bicepscurl 2 × 10–15, Tricepsnedtryck med kabel 2 × 10–15
- Underkropp B: Marklyft 3 × 3–5, Benpress 3 × 10–15, Höftlyft 3 × 8–12, Liggande lårcurl 3 × 10–15, Stående vadpress 4 × 10–15, Hängande benlyft 3 × 8–15

**Tryck/drag/ben** (Tryck/drag/ben · Van · 6 dagar, eller 3 dagar med halva volymen). Tryck, drag och ben två varv i veckan: 10–16 hårda set per huvudmuskel. Kör ett varv (3 dagar) om tiden inte räcker; då halveras volymen. Hårda set per huvudmuskel i veckan: 10–16.

- Tryck: Bänkpress 4 × 6–8, Lutande bänkpress med hantlar 3 × 8–12, Axelpress 2 × 8–10, Sidolyft 4 × 12–20, Tricepsnedtryck med kabel 3 × 10–15
- Drag: Chins 3 × 6–10, Framåtböjd rodd 3 × 8–10, Sittande rodd med kabel 2 × 10–12, Omvända flyes med hantlar 3 × 12–20, Bicepscurl 3 × 10–15
- Ben: Knäböj 3 × 5–8, Rumänsk marklyft 3 × 8–10, Benpress 2 × 10–15, Liggande lårcurl 2 × 10–15, Stående vadpress 4 × 10–15

**Grundstyrka 3 dagar** (Styrka · Van · 3 dagar, A B A och sedan B A B). Knäböj, bänkpress, axelpress och marklyft i 3–5 reps med längre vila (3–5 min). Fokus är styrka; mindre muskler får avsiktligt lite volym. Hårda set per huvudmuskel i veckan: 0–16,5.

- Styrka A: Knäböj 5 × 3–5, Bänkpress 5 × 3–5, Framåtböjd rodd 4 × 5–8, Tricepsnedtryck med kabel 2 × 8–12
- Styrka B: Knäböj 3 × 5–8, Axelpress 5 × 3–5, Marklyft 3 × 3–5, Chins 3 × 5–8

**Hemma med hantlar** (Hemma · Nybörjare–van · 3 dagar, A B A och sedan B A B). Bara hantlar och kroppsvikt, utan vader. Hela kroppen två gånger i veckan; reps upp till 15–20 när hantlarna blir för lätta. Hårda set per huvudmuskel i veckan: 0–15.

- Hemma A: Bulgarisk utfallsböj 4 × 8–12, Bänkpress med hantlar 3 × 8–12, Enarmsrodd med hantel 3 × 8–12, Sittande axelpress med hantlar 2 × 8–12, Sidolyft 2 × 12–20
- Hemma B: Rumänsk marklyft med hantlar 3 × 8–12, Armhävningar 3 × 8–20, Enarmsrodd med hantel 3 × 10–15, Höftlyft 3 × 10–15, Bicepscurl 2 × 10–15

Källor:
- [Schoenfeld, Ogborn & Krieger 2017, dose-response mellan veckovolym och muskeltillväxt, J Sports Sci](https://researchgate.net/profile/Brad-Schoenfeld/publication/305455324_Dose-response_relationship_between_weekly_resistance_training_volume_and_increases_in_muscle_mass_A_systematic_review_and_meta-analysis/links/59dc0269458515e9ab4527d6/Dose-response-relationship-between-weekly-resistance-training-volume-and-increases-in-muscle-mass-A-systematic-review-and-meta-analysis.pdf)
- [Schoenfeld, Ogborn & Krieger 2016, frekvens och muskeltillväxt, Sports Medicine](https://pubmed.ncbi.nlm.nih.gov/27102172/)
- [Schoenfeld m.fl. 2019, frekvens med samma volym](https://pubmed.ncbi.nlm.nih.gov/30236847/)
- [Simão m.fl. 2012, övningsordning](https://pubmed.ncbi.nlm.nih.gov/22292516/)

### Kontroll runda 7

Runda 7, mätt med `build/verify3.cjs`: Playwright i Chromium och WebKit, 390 och 1100 px breda fönster, ljust och mörkt sidtema (8 körningar): 1 208 av 1 208 kontroller godkända (151 per körning, varav 42 nya för ägarens kommentarer). 0 av 1 197 interaktiva element under 44 × 44 px i verklig storlek, 0 av 2 446 textelement utanför 12/13/15/17/20/28 och 400/600/700. Alla 494 synliga kontroller i de 15 LIVE-ramarna ändrar något, i båda motorerna (nya LIVE-ramar: B5, B12, B13, E6). Kontroller som testade det ägaren tagit bort är omskrivna: Ångra efter svep (nu: ingen ångra-rad, och Lägg till set ger setet tillbaka), dagbladet från årskartan (nu: ett tryck på en dag gör inget, håll och dra väljer en veckodag), veckoremsan i F2 (nu: den komprimerade kalendern stämmer med A2 och historiken) och muskelraderna i avslutet. Inga konsolfel och ingen sidledsrullning.

## Flödesgranskningen

| Fynd | Problem | Ändring i v6 | Ramar | Status |
|---|---|---|---|---|
| F-P1.1 | Svep raderar ett set utan ångra | Ångra-plats i 5 s där raden låg; Ångra växer tillbaka raden | B2 | Med i v6 |
| F-P1.2 | Avsluta utan bockade set slänger passet i tysthet | Ett blad frågar: fortsätt, spara övningarna som rutin eller släng (två tryck, med Ångra) | B9 | Med i v6 |
| F-P1.3 | Ny svensk användare får engelska | Språket följer telefonen och sparas inte som val; raden heter Språk · Language | A1, G1 | Med i v6 |
| F-P2.4 | Övningsnamnen är engelska | Svenska namn med det engelska som sökbar undertext | B11, E1, D2 | Med i v6 |
| F-P2.5 | Svag belöning, Rekord 0 | Rekordrutan bara när det finns rekord; kort bekräftelse, Första passet sparat! | B9, B10 | Med i v6 |
| F-P2.6 | Scheman saknas i Bibliotek | Fliken Scheman i Bibliotek | E2, F2 | Med i v6 |
| F-P2.7 | Röd lättare på ett repsrekord | Jämför på uppskattat 1RM: +1 rep vid −2,5 kg i grönt, = förra i neutralt | D2 | Med i v6 |
| F-P2.8 | Progression mot planen med Ingen plan på varje rad | Utveckling sedan start, och Lyft som står still med förslag | F4 | Med i v6 |
| F-P2.9 | Ikonen Kabel sätter ingen utrustning | Riktigt val av utrustning som styr filter, viktsteg och ikon | E3, E1 | Med i v6 |
| F-P2.10 | Dubbletter av inbyggda övningar utan varning | Rad under namnfältet: finns redan, Öppna den | E3 | Med i v6 |
| F-P2.11 | Ingen anteckning per övning | Anteckning i övningens meny, visas under rubriken i passet | B7, B3 | Med i v6 |
| F-P2.12 | Vilotimern av som förval, brytaren heter På | På som förval (2:30 / 1:30), brytaren heter Använd vilotimer, segment för vad tiden gäller | B8, G1 | Med i v6 |
| F-P2.13 | Drop-setet öppnar inte sifferplattan | Lägg till drop öppnar plattan på dropens reps | B5, B4 | Med i v6 |
| F-P2.14 | Kartan rullar bort i Avancerad | Kartan klistrad överst (170 px) och tryckbar | E3, E4 | Med i v6 |
| F-P2.15 | Samma period ställs in på tre sätt | En rad, 8 veckor · 30 nov – 24 jan, som öppnar kalendern | F1 | Med i v6 |
| F-P2.16 | Motsägelsefull dialog, ”Pass” pågår redan | Du har ett pass igång, med namn och antal set; samma namn på Hem | A3 | Med i v6 |
| F-P2.17 | Utkastknappar innan något är ifyllt | Inga knappar; utkastet sparas när bladet stängs; namnfältet har fokus | E5 | Med i v6 |
| F-P3.18 | Bocka och Samma som förra | Klar ✓ och Som förra passet | B1 | Med i v6 |
| F-P3.19 | 1,5 t bredvid Tid | Volym i kg (1 460 kg) | B9, B10 | Med i v6 |
| F-P3.20 | RIR läses baklänges, förra gången 5 | 2 reps kvar i tanken; förra gången 5 set | B4, B1 | Med i v6 |
| F-P3.21 | Fälten fylls med förra, inte målet | Fälten fylls med målet | B1 | Med i v6 |
| F-P3.22 | Mål under 44 px | Vilochip, dagknappar, Redigera, diagramchips, målrad 44 px; årskartan öppnar närmaste dag | A2, B1, C1, D4, F2 | Med i v6 |
| F-P3.23 | Svart huvud och händer försvinner i mörkt | Ljusare kartpanel och tunn kontur i mörkt; figuren är kvar svart | D3, F3d, H3 | Med i v6 |
| F-P3.24 | Valt – ritas blått på varje rad | Ingen har ett neutralt valt-läge | E3, H1 | Med i v6 |
| F-P3.25 | Bröst i gruppen Bröst | Bröstmuskel, Stora sätesmuskeln, latin som undertext | E4, H2 | Med i v6 |
| F-P3.26 | Hantel som förvald ikon | Inte taget: hantel är ägarens förval för egna övningar. Utrustningen är nu ett riktigt val | E3 | Tas inte |
| F-P3.27 | Kvar till 10 set kortar listan i tysthet | Alla grupper visas, sorterade | F3 | Med i v6 |
| F-P3.28 | Schemat följs inte | Före schemat / Efter schemat, räknat per vecka | F2 | Med i v6 |
| F-P3.29 | Tema i ett blad, ingen väg tillbaka till systemet | Dag/natt-brytaren direkt i raden och Följ telefonen igen. Ingen vanlig brytare: dag/natt-brytaren är en identitetsdel | G1 | Delvis |
| F-P3.30 | Missad dag ser ut som kommande | Streckad ram för missad, blå för planerad, förklaring under remsan | A2 | Med i v6 |
| F-P3.31 | Sidan rullar och svag dämpning i mörkt | Sidan låst bakom blad, dämpning 58 % i mörkt | B9, B10 | Med i v6 |
| F-P3.32 | Tips för tidigt och över innehåll | Svep-tipset efter tre ifyllda set, kart-tipset efter första trycket och under kartan | B2, C1 | Med i v6 |
| F-P3.33 | Första trycket på låst set ger inget | Skakning och en rad redan på första trycket; namnet säger Låst | B2 | Med i v6 |
| F-P3.34 | Tomt pass två gånger på Hem | En gång | A1 | Med i v6 |
| F-P3.35 | Kommande pass överst i historiken | Gjort är förvalt, Planerat är egen flik | C1 | Med i v6 |
| F-P3.36 | Två tidsfönster på Framsteg | Muskelkortet säger den här veckan, nyckeltalen 4 mot 4 veckor | D1 | Med i v6 |
| F-S1.3 | Rubriken glider bort i väljaren, fokusringen klipps, Bodyweight Squat före Squat | Rubriken står kvar, ringen ryms, exakt träff först | B11 | Med i v6 |
| F-S1.7 | Vilochip 60 × 32, en tid för en övning gäller alla, +15 s är hela tiden | Chip 44 px, segmentet Gäller, +15 s egen knapp | B1, B8 | Med i v6 |
| F-S3.3 | Nya rutinövningar får 1 set | 3 set | E5 | Med i v6 |
| F-S3.5 | Brödsmulan Bibliotek leder inte till scheman | Scheman finns i Bibliotek | E2, F2 | Med i v6 |
| F-S3.6 | Platshållaren ser ifylld ut, dagtypen Drag har en stjärna, två valt-stilar | t.ex. Vinterblock i ink-3, blockfigur bakifrån, samma segment | F1 | Med i v6 |
| F-S5.1 | Tryck på Legs day öppnade ett planerat pass | Historiken börjar med gjorda pass | C1 | Med i v6 |
| F-S6 | Språk/Language-raden byter namn | Språk · Language | A1, G1 | Med i v6 |

## Expertgranskningen

| Fynd | Problem | Ändring i v6 | Ramar | Status |
|---|---|---|---|---|
| E-P1 | Två volymmodeller på samma kort | Grupper räknas från musklerna; åtgärdsrad överst; liten karta; grupper fälls ut till huvudmuskler; samma stapel på Framsteg och schemastatus | F3, F3d, D1 | Med i v6 |
| E-P2 | Ingen planerad volym i planredigeraren | Kortet Planerad vecka med varning och åtgärd; planerad volym som kontur bakom gjord | F1, F3 | Med i v6 |
| E-P3 | Muskelkartan bryter Quiet: blå skala, ingen svart figur | Delvis: mindre och sekundär placering (kompakt rad, 200 px), ljusare panel och kontur i mörkt, steg 1 och 2 längre isär. Blå skala och ljus figur tas inte (ägarens beslut) | D2, D3, F3, H3 | Delvis |
| E-P4 | Mål och steg följer inte utrustningen, dockan visar förra | Steg från utrustningen i plattan och målen, Viktsteg per övning, dockan visar Mål, +1 rep i stället för lättare | B1, B3, B7, D2 | Med i v6 |
| E-P5 | Fyra till fem valt-uttryck, två blå rader | Ett valt-läge (mjuk accent + 1,5 px linje); nästa set blå, fält som ändras bara ring, setbladets rad neutral | H1, B3, B4 | Med i v6 |
| E-P6 | Övningsredigeraren är en lång rullning med tre sanningar | Namn, utrustning, muskler; kategori och Tränar även härleds; klistrad, tryckbar karta; Ingen i stället för – | E3, E4 | Med i v6 |
| E-P7 | Följsamhet per datum, ingen platåupptäckt, grön fasbalk | Veckomatchning med ↷, Före schemat, Lyft som står still, förflutna veckor neutrala | F2, F4 | Med i v6 |
| E-P8 | Storlekar och vikter utanför skalan, långa titlar, latinska namn | Bara 12/13/15/17/20/28 och 400/600/700; långa titlar 20 px två rader; svenska muskelnamn; etiketter i linje | H2, C1, D3, E4 | Med i v6 |
| E-P9 | Avataren läses som en robot, tvetydiga glyfer, etiketter saknas | Nya glyfer för kabel och maskin, etiketter på alla flikar, mer kontrast i mörka avatarer. Halvfiguren tas inte (ägarens beslut) | H4, E1, E1d, A1 | Delvis |
| E-P10 | Historik och schemastatus är långa | Äldre veckor fälls ihop; fas och följsamhet i ett kort; Nästa pass högre upp; periodrad | C1, F2, F1 | Med i v6 |
| E-P11 | Inga coachinslag i passet | Vila efter övningstyp, uppvärmningstrappa med skivor, muskelsummering i avslutet | B6, B8, B9, B10 | Med i v6 |
| E-A1 | Pull Up saknar brachialis | Data: brachialis 0,5 som Pulldown | — | Senare / i data |
| E-A2 | Smal bänk utan bröst som huvudmuskel | Data: chest 1, triceps 1 | — | Senare / i data |
| E-A3 | Hyperextension som ländryggsövning | Data: glutes 1, hamstrings 1, lowerBack 0,5 | — | Senare / i data |
| E-A4 | Benlyft saknar höftböjare | Data: quads 0,5 konsekvent (ny muskel hipFlexors skjuts upp) | — | Senare / i data |
| E-A5 | Face Pull: mellersta trapezius saknas | Övre rygg döps till Mellersta rygg och tar mellersta trapezius | E4, H2 | Med i v6 |
| E-A6 | Standing Calf Raise | Behålls | — | Tas inte |
| E-A7 | Rowing Machine saknar baksida lår | Data: hamstrings 0,5 | — | Senare / i data |
| E-A8 | Främre skenben tränas av ingen övning | Ritas grått men tas aldrig med i Släpar | H3, F3 | Med i v6 |
| E-A9 | Hip Thrust quads 0,5 generöst | Data: quads tas bort | — | Senare / i data |
| E-A10 | Dumbbell Pullover | Behålls | — | Tas inte |
| E-A (RDL) | RDL-familjen i två grupper | RDL, Stiff Leg och Dumbbell RDL i Ben | D3 | Med i v6 |
| E-B1 | Riktmärket gäller per muskel, inte grupp | Bedömning per huvudmuskel; gruppen visar den svagaste | D1, F3 | Med i v6 |
| E-B2 | Delmuskler under riktmärket för alltid | Delmuskler syns men bedöms inte | F3, H3 | Med i v6 |
| E-B3 | Ansträngning räknas inte | Set med RIR 5 eller mer räknas som ett halvt (behöver provas) | F3 | Delvis |
| E-B4 | Över 20 som varning | Neutral information | D1 | Med i v6 |
| E-B5 | Veckan hittills ser blek ut | Planerad volym som kontur bakom gjord | F3 | Med i v6 |
| E-C1 | Målsteget alltid 2,5 kg | Steg från utrustningen; Viktsteg per övning | B1, B7 | Med i v6 |
| E-C2 | Vilodockan visar förra resultatet | Dockan visar Mål | B1, B3 | Med i v6 |
| E-C3 | Ingen platåupptäckt | Lyft som står still | F4 | Med i v6 |
| E-C4 | Vilan av som förval | 2:30 flerled, 1:30 isolering | B8, B1 | Med i v6 |
| E-C5 | Följsamheten räknar exakta datum | Veckomatchning | F2 | Med i v6 |
| E-C6 | Ingen deload förvalt för långa faser | 5 + 1 förvalt för faser på 6 veckor eller mer | F1 | Med i v6 |
| E-C7 | Planredigeraren visar ingen planerad volym | Planerad vecka | F1 | Med i v6 |
| E-C8 | Lättare i rött mot e1RM-lika set | +1 rep vid −2,5 kg, = förra | D2 | Med i v6 |
| E-C9 | Målkortet blandar 5RM och e1RM | Målet i egen skala, 1RM i förklarande rad | D4 | Med i v6 |
| E-C10 | Ingen uppvärmningstrappa eller skivkalkylator | Uppvärmningstrappa med skivor per sida | B6 | Med i v6 |
| E-§1 | e1RM ser ut som riktiga lyft | Normal vikt, ink-2, märket uppsk. | D2, H2 | Med i v6 |
| E-§2 | Släng passet väger lika mycket som Spara | Röd textknapp | B9, B10 | Med i v6 |
| E-§4 | Grönt betyder tre saker, grumliga avatarer i mörkt, svarta chips | Grönt bara för gjort, blå staplar, nya mörka mixar, ett valt-läge | H1, D1, A2d, E1d | Med i v6 |
| E-§5 | Bottennavigationen visar bara aktiv etikett | Etikett under alla fyra | H4, A1 | Med i v6 |
| E-§6 | Rekorddatum skiljer vid oavgjort, Schema-listans kort, datumformat, etiketter indragna | Tidigaste datum vid oavgjort, plannamn 15/600, datum som text, etiketter i linje | D2, E2, F1, H2 | Med i v6 |
| E-§7 | Mål ≈ 117 oförklarat, Upptäck tom, vilobladets På | Förklarande rad, Upptäck med exempel, Använd vilotimer | D4, E6, B8 | Med i v6 |
| E-§3 | Redigeraren har tre sätt att säga samma sak | Bara muskler; kategori härleds | E3 | Med i v6 |

## Förslag som inte tas, på grund av ägarens beslut

| Förslag | Vad | Varför inte | I stället |
|---|---|---|---|
| E-P3 | Blå accentskala i stället för rött, ingen svart figur, muskler i surface-2 med kontur | Ägaren har bestämt att den stora kartan behåller den röda skalan och den anatomiska figuren (svart figur, grå otränade muskler). | Kartan blir mindre och sekundär (kompakt rad på övningssidan, 200 px på schemastatus, öppnas i stort med ett tryck). Mörkt läge får ljusare panel och en tunn kontur. Värmestegen 1 och 2 dras isär inom den röda skalan. Domen står i listan, inte i färgen. |
| E-P1 | Liten karta i neutral ton på volymkortet | Samma beslut: röd skala. | Storleken tas (200 px), tonen inte. |
| E-B (karta) | Delmuskler i en neutral skala på kartan | Samma beslut: den röda skalan gäller hela kartan. | Delmusklerna ritas i den röda skalan men bedöms aldrig som brist. |
| E-P9 | Halvfigur (bara överkropp eller ben) i 40 px-avatarer | Ägaren har bestämt blockfiguren i en vy, fram eller bak efter huvudmusklerna. | Mer kontrast mellan huvudmuskel och resten i mörkt läge och en tunn ring i tonen. Avatarerna är 44 px med 30 px figur. |
| F-P3.26 | Kropp som förvald ikon för egna övningar | Ägaren har bestämt utrustningsglyfer för egna övningar med hantel som förval. | Utrustningen blir ett riktigt val som styr filter, viktsteg och ikon, så hanteln är sällan fel länge. |
| F-P3.29 | Tema som en vanlig brytare | Dag/natt-brytaren är en av appens identitetsdelar och står kvar. | Dag/natt-brytaren flyttar in i listraden (ett tryck, inget blad) och Följ telefonen igen läggs till. |
| E-§4 (tränaren) | Röd skala läses som skada | Samma beslut: röd skala. | Legenden säger set per vecka och domen (under, inom, över) står i listan med bock för inom. |

## Skjuts upp

- **Mappningsfel i exercise-muscles.ts (E-A1–A4, A7, A9).** Data i koden, ingen skärm. Listat i changes.md.
- **Ny muskel för höftböjare och rotatorkuff.** Kräver en ny zon på kartan och i ikonen. Tills vidare quads 0,5 på benlyft.
- **Superset.** Inte del av någon granskning nu, fanns som lucka redan i v5.
- **Svenska namn för hela katalogen.** Mockupen visar mönstret för ett tjugotal övningar. Resten är ett innehållsjobb med alias som redan finns för sökningen.
- **RIR-vikt i volymen (E-B3).** Med i texten på volymkortet, men regeln bör provas mot riktiga veckor innan den byggs.
- **Datumformat på riktig enhet (E-§6).** Planredigeraren visar datum som text, så native-fältets format spelar mindre roll. Bör ändå kontrolleras på iPhone.

## Nya och ändrade tokens

| Token | Värde | Varför |
|---|---|---|
| `--gt-sel-bg`, `--gt-sel-line`, `--gt-sel-ink` | accent-soft, accent, accent | Ett valt-läge (E-P5) |
| `--gt-map-panel` (mörkt) | #2f3746 (var #232a3b) | Den svarta figuren syns (F-P3.23) |
| `--gt-map-halo` | transparent / #6f7a8d i mörkt | Tunn kontur runt figuren i mörkt |
| `--gt-heat-1` … `--gt-heat-5` | #fde3df, #f4978c, #ea6658, #d63a2f, #9a1f17 | Steg 1 och 2 går att skilja åt, fortfarande röd skala |
| `--gt-scrim` (mörkt) | 0,58 svart (var cirka 0,38) | Sidan bakom ser inte aktiv ut (F-P3.31) |
| `--gt-dur-dock-in`, `--gt-dur-dock-out`, `--gt-dur-settle`, `--gt-ease-swipe` | 240, 200, 320 ms, EASE.swipe | Namn på siffror som redan står i rörelsetabellen |
| Avatarmix i mörkt | huvudmuskel tonen + 18 % vitt, kropp 22 %, otränat 10 %, hjälp 55 % | Huvudmuskeln syns, kontrast 8,1:1 mot otränat (E-§4, runda 2) |
| Brytare | appens .switch: ink-3 av, accent på | Grönt betyder bara gjort (runda 2) |
| Dagcell planerat | inset 2 px line-control (var done) | Grönt betyder bara gjort (runda 2) |

## Runda 2: den oberoende granskningen

Alla 41 buggar och alla punkter under "För att nå 9" i `score1.md`. Etiketterna R1–R41 och R-<kategori> <punkt> står på ramarna.

| Punkt | Problem | Ändring | Ramar |
|---|---|---|---|
| R1 | Årskartan i C1 gör inget | Tryck öppnar närmaste dag med pass i dagbladet, ‹ › stegar, tipset om dra visas efter första trycket | C1 |
| R2 | 26 okt – 1 nov fälls ut till ett pass | Veckorna ritas från demodatan och fälls ut till alla sina pass (4) | C1 |
| R3 | D2:s flikar byter inte innehåll | Översikt, Historik och Rekord har egna paneler | D2 |
| R4 | Karttryck i F3 och F3d gör inget | Kartan är en knapp som öppnar veckans karta och alla muskler i ett blad | F3, F3d |
| R5 | Släng lämnar användaren i det slängda passet | Släng går till Träna med raden Passet slängt · Ångra | B9 |
| R6 | Spara som rutin lämnar passet igång | Spara som rutin och avsluta: går till Träna med Rutinen sparad · passet avslutat · Ångra | B9 |
| R7 | Hårdkodad veckorad efter första passet | Raden räknas från passets set och veckan före passet | B9 |
| R8 | E3 startar med Kabel och muskler satta | Startar tomt med hantel och inga muskler | E3 |
| R9 | Radtitlar försvinner vid temabyte i WebKit | Färg animeras bara på telefonen och ärvs; övergångsklassen sätts en bildruta före temaklassen. Uppmätt: text och yta tonar samtidigt i WebKit | G1 |
| R10 | Sidtitlar 38 px på dator | Presentationens regel gäller bara .cv-head h1; alla telefontitlar mäts till 28 px | A1, A2, H2 |
| R11 | Plattans rubrik bryter set / 1 | Rubriken är övningens namn, Set 1 · Förra … på egen rad | B1 |
| R12 | E4 visar en halvt avklippt rad | Den klistrade kartan har en linje under, och stillbilden står på en radgräns | E4 |
| R13 | Mina ensam på andra raden | Filtren är en rad som rullar i sidled | E1, B11 |
| R14 | Genomskinlig flikrad | Flikraden är helt ogenomskinlig | alla, H4 |
| R15 | Mån 16 Missat i A2 men flyttat i F2 | Samma veckoremsa från samma data i A2 och F2 (kontrolleras) | A2, F2 |
| R16 | Benpass senast 13 nov mot 17 nov | Benpass senast fre 13 nov i A2 och kalendern | A2, C1 |
| R17 | Benpass 3 övningar mot 2 | 3 övningar och 9 set i A2, B1 och F2 | A2, B1 |
| R18 | Knäböj 3/5, 4/3, 3/3 set | 3 arbetsset enligt rutinen, förra gången 3 set, i B1–B5 | B1, B2, B3 |
| R19 | Bästa 90 × 5 och ≈ 96 | Bästa 82,5 kg × 5 (≈ 96) på både D2 och D4 | D2, D4 |
| R20 | D2 jämför med ett Benpass-datum | Jämför med tor 12 nov, ett Tryckpass | D2, C1 |
| R21 | 1 rekord mot 2 rekord, 4:e passet | Samma rekordantal i avslut och belöning, 2:a passet räknat från veckan | B9 |
| R22 | Baksida lår 1,5 mot 0 | Baksida lår 0 i D1, F3, B9 och B10, räknat från samma data (kontrolleras) | B9, B10, D1, F3 |
| R23 | Bröst & Ben 0 av 2 mot 0 av 3 | 0 av 3 set på Hem och i passet | A3, B9 |
| R24 | 14 pass mot 13 i historiken | 13 gjorda · 10 planerade, samma summa som kalenderns schemaveckor (kontrolleras) | F2, C1 |
| R25 | Fredag är sista passet | Åtgärden gäller dagens Benpass | F3 |
| R26 | Sorteringen stämmer inte | Sorterade efter planerat i veckan, lägst först, och texten säger det | F3, D1 |
| R27 | 6 grupper mot 7 | Sju grupper i båda, samma funktion | D1, F3 |
| R28 | Legenden slutar på 10–14 i F1 | Samma legend upp till 20+ | F1, F3 |
| R29 | ≈ 96,3 mot ≈ 96 | ≈ 96 kg överallt | D2 |
| R30 | 183 tryckytor under 44 px | 0 av 830 interaktiva element under 44 px, mätt i båda motorerna | alla |
| R31 | Grönt för Aktivt, Före schemat, I fas, +2, +1 rep | Accent för status och positiva förändringar med pil; grönt bara gjort och inom | E2, F2, D4, D1, D2, H1 |
| R32 | Underskott i rött | Underskott i ink, rött bara på kartan och för destruktiva handlingar | F1, F3, H1, H3 |
| R33 | 24/500, 34/700 och 38 px | Plattan 20/600, vilotiden 28/700, titlarna 28 px; 0 textelement utanför skalan | B1, B3, H2 |
| R34 | Långa namn: sidtitlar mot övningar | Regeln gäller övningsnamn, sidtitlar står i 28 px, och H2 säger det | D3, H2 |
| R35 | Historik mot appens Kalender; odokumenterade dagceller | Fliken heter Kalender (sv.ts); dagcellen och datumbrickan följer appen och ändringarna står i H1 | C1, A2, H1 |
| R36 | Gröna brytare | Appens blå .switch på hela rader | B8, G1 |
| R37 | Engelska och omvända namn | Namnregel i H2; Benpass, Tryckpass, Styrkeblock, Tryck / Drag / Ben, Lutande bänkpress med hantlar, Stående vadpress, Liggande lårcurl | H2, B11, E1, E6 |
| R38 | Undertexten blandar språk | Konsekvent latin | E4, H2 |
| R39 | Raka citattecken | Skapa ”…” | B11 |
| R40 | 14 pass av 11 planerade | 13 gjorda · 10 planerade | F2 |
| R41 | Reps bara på ena sidan av pilen | 90 kg × 5 → 100 kg × 5 | F4 |
| R-Hier 1 | Periodväljaren i rubriken styr bara nedre kortet | Väljaren sitter i kortet Nyckeltal | D1 |
| R-Hier 3 | Dubbelring på i dag | En accentring, planerat i dag som punkt | A2, F2, H1 |
| R-Hier 4 | Utrustningen tar 260 px före musklerna | En rad som rullar i sidled; kartan syns direkt | E3 |
| R-Luft 3 | Raderna glider in under kartan utan kant | Linje under den klistrade kartan | E3, E4 |
| R-Luft 4 | Tryckbar karta med 6 px zoner | Kartan är en förhandsvisning, trycket en genväg, raderna vägen | E3 |
| R-Färg 3 | Mörka avatarer dunkla | Huvudmuskeln +18 % vitt, kroppen 22 %, otränat 10 %; kontrasten mäts i H4 (7,1:1 → 8,1:1 för benavataren) | H4, A2d, E1d |
| R-Ikon 1 | Kettlebell som hänglås, kabel som nyckel, maskin som dörr | Omritade: rund kula med brett handtag, trissa med vikt och handtag, viktmagasin med stift | H4, E1, E3 |
| R-Ikon 2 | Benövningar ser likadana ut | Vyn följer huvudmusklerna; fyra benövningar sida vid sida i H4 | H4, E1 |
| R-Ikon 3 | Muskelfiguren som dekor i A1 | Lucide-glyfer för Kom igång-raderna | A1 |
| R-Ikon 4 | Ikonen bland utrustningsvalen | Förhandsvisningen står vid namnfältet | E3 |
| R-Kons 2 | Inga kontroller av samma värde i flera ramar | verify2.cjs jämför 12 värden mellan ramar | — |
| R-Tydl 4 | Kryptisk etikett på årskartan | Ett pass per ruta, Tryck för att öppna dagen; aria-etiketten rättad | C1 |
| R-Tydl 5 | Förslagschippen ser ut som filter | Verb och mål på varje förslag, bekräftelse med Ångra | F4 |
| R-Coach 1 | Fel dag och för lite i åtgärden | I dag: 3 set rumänsk marklyft och 3 set liggande lårcurl i Benpass | F3 |
| R-Coach 2 | Det aktiva schemat varnas inte | Schemastatus har samma varning som planredigeraren | F2 |
| R-Coach 3 | Deload 5 + 1 för 8 veckor | Förval efter längd: 6 → 5 + 1, 8 → 7 + 1, 12 → 5 + 1 två gånger | F1, F2 |
| R-Coach 4 | Drop på skivstångsknäböj | Drop-exemplet är stående vadpress i maskin | B4, B5 |
| R-Coach 5 | Knäböj går från 5 till 3 set | 3 arbetsset enligt rutinen, förra gången 3 | B1 |
| R-Coach 6 | Utfallsböj vilar 1:30 | 2:00 för flerled på ett ben, med förklaring i vilobladet | B1, B8 |
| R-Coach 7 | Pallof i Enkel blir en annan modell | En modell; Använd dess muskler ger sneda magmuskler huvudmuskel; Enkel visar Blandat | E3, E4 |
| R-Tydl 7 | Viktsteg utan 0,5 och 4 | 0,5, 1, 1,25, 2, 2,5, 4, 5 och förval efter utrustning | B7 |

## Runda 3: den andra oberoende granskningen

Alla 17 buggar, de mindre punkterna, tränarens fynd och alla punkter under "vad som ger 9" i `score2.md`. Etiketterna R3-<n> och R3-<kategori> står på ramarna.

| Punkt | Problem | Ändring | Ramar |
|---|---|---|---|
| R3-1 | Play-ikonen syns inte (1,1:1) | Ikonklasserna heter ic-s/ic-xs och krockar inte med .s; rutinens knapp är sekundär med blå ikon, mätt ≥ 3:1 | A2, A2d |
| R3-2 | A–Ö inte sorterad i Bibliotek | Sorterad med svensk ordning, kontrolleras | E1, E1d |
| R3-3 | Filterchippen filtrerar inte | Chippen filtrerar, också med sökningen; Mina visar egna övningar | B11 |
| R3-4 | Coachknappen gör inget | Varje coachåtgärd bekräftar med Ångra, som i F4 | F3, F3d |
| R3-5 | ↑ hårdkodad | ↑ räknas i passet från förra resultatet med Epley | B1–B4, B9 |
| R3-6 | Vecka 47 och vecka 4 på samma skärm | "Den här veckan" i korten, schemats vecka bara där schemat är ämnet; kontrolleras | A2, D1, F3 |
| R3-7 | B2 visar 1 av 3 set | Hela Benpass, 1 av 9 set | B2 |
| R3-8 | Vilotider skiljer mellan B8 och G1 | Samma tre nivåer i båda, B8 upp till 5:00 och Egen | B8, G1 |
| R3-9 | ↑ för ett oförändrat 1RM | "+1 rep vid −2,5 kg · 1RM lika" i ink-2, ↑ bara när 1RM ökar | D2 |
| R3-10 | "I fas" utan stöd | Takten räknas från start: 1,8 kg i veckan ger ≈ 108 kg till 3 jan; "Efter takten" och "Ambitiöst mål" | D4 |
| R3-11 | Startvärdet skiljer D4/F4 | 75 × 6 ≈ 90 och 95 × 5 ≈ 111 i båda | D4, F4 |
| R3-12 | Dagens pass saknas i Planerat | Planerat · 4 börjar med dagens Benpass | C1 |
| R3-13 | Fel antal över årskartan | Rubriken räknar kartans pass (73); Styrkeblock 13 pass på egen rad | C1 |
| R3-14 | Grön pokal i belöningen | Bärnstensfärgad pokal överallt, flaggan för första passet i accent | B9, B10 |
| R3-15 | 1800 kg och 6 252 kg | En formatterare, smalt mellanrum från 1 000 | B9, B10 |
| R3-16 | Bocka och kryssa | Kryssa överallt, som i sv.ts | B2, B9 |
| R3-17 | Sparad rutin syns inte på Hem | Rutinen står under Dina rutiner, och profilikonen finns | B9 |
| R3-Mindre | Svep klipps av skärmen, Hoppa över toppjusterad, ~45 / min, uppsk. två gånger | Raden klipps vid kortet, knappen centrerad och fyllnaden svagare, nowrap, uppsk. bara där Uppskattat inte står | B2, B3, E6, D2 |
| R3-Typo | Tre rader i övningshuvudet, D2:s metarad, talformat | En metarad, "Bench Press · skivstång", smalt mellanrum | B1, D2 |
| R3-Hier | Två primära knappar, två veckonummer, två blå ringar | Sekundär rutinknapp, en veckoreferens, nästa-raden tonas ned när ett annat fält ändras | A2, B3 |
| R3-Luft | Högt övningshuvud, långt volymkort, docka täcker | En metarad, fyra grupper och Visa alla 7, coachrutan en rad per åtgärd, utfyllnad som dockan | B1, F3 |
| R3-Färg | Kropp mot cirkel i mörkt | Mörkare cirkel och ljusare kropp: kropp 4,0:1, otränat 3,1:1, huvudmuskel mot otränat 2,7:1 (lägsta över nio toner, mätt i H4) | H4, A2d, E1d |
| R3-Ikon 1 | Blockfigur med utrustningsmärke för egna övningar | Tas inte: ägaren har bestämt utrustningsglyfen med hantel som förval. Samordnat inom regeln: samma cirkel, ton och linjevikt | H4, E1 |
| R3-Ikon 3 | Benövningar lika | Figuren 34 px (var 30); vyregeln förklarad; utrustningen i undertexten som andra signal | H4 |
| R3-Ikon 4 | Hanteln = Träna-ikonen | Fliken har appens Lucide-hantel på snedden, glyfen är rak | H4, alla flikar |
| R3-Tydl | Gruppraden döljer gjord träning, bandet oförklarat, "Före schemat" | "triceps 8 · biceps 0" och två fyllnader, mikrolegend, följsamhet per vecka | D1, F3, F2 |
| R3-Coach | Orealistiska mål, 1 kg-steg för hantlar, vila till 3:00, extrapass som följsamhet | Ambitiöst-flagga över ≈ 1 % i veckan, dubbel progression, vila till 5:00, 3 av 3 veckor + 3 extrapass | D4, F4, B8, F2 |
| R3-Kons | Döda kontroller i LIVE-ramar | Alla 220 kontroller i de elva LIVE-ramarna ändrar något, mätt i Chromium och WebKit | alla LIVE |

## Runda 4: den tredje oberoende granskningen

Alla 20 numrerade punkter och alla punkter under "det som för varje kategori till 9" i `score3.md`. Etiketterna R4-<n> och R4-<kategori> står på ramarna.

| Punkt | Problem | Ändring | Ramar |
|---|---|---|---|
| R4-1 | Väljaren: "Min · kabel · kabel" | Samma undertext som Bibliotek: "kabel · Bål · egen" | B11, E1 |
| R4-2 | D2 markerar Framsteg men ← går till Bibliotek | Flikraden markerar Bibliotek | D2 |
| R4-3 | G1 ← går till A1 | ← går till A2, samma användare som Träna-fliken | G1 |
| R4-4 | Sidtiteln hoppar 12 px mellan flikar | Rubrikraden har fast höjd; titlarna står på samma linje (kontrolleras) | A, C1, D1, E1, E6 |
| R4-5 | Använt förslag står kvar | Blir en rad "✓ Tillagt …", ritar om grupperna med den nya planen, Ångra ställer tillbaka | F3, F3d, F4 |
| R4-6 | Två eller tre blå ringar | Nästa-raden tonas ned (.dim) när ett annat fält ändras; plattans segment visar valet med fyllning (kontrolleras) | B1, B3, B5 |
| R4-7 | ↑ grön mot H1 | ↑ i accent överallt, regeln skriven i H1 (kontrolleras) | B1–B10, H1 |
| R4-8 | Setbadgen gör inget i B1 | Badgen är en knapp som öppnar setbladet | B1, B2, B9 |
| R4-9 | "Ingen höftextension" är fel | "Höftfällning (baksida lår)"; knäböj och utfallsböj tränar sätet men inte baksida lår | F1, F2, F3 |
| R4-10 | Deload under ett lyft | Deload på schemanivå (vecka 8); lyftet får +1 rep i stället | F4 |
| R4-11 | Tre progressionsmodeller | Dubbel progression för allt, steget efter utrustning, samma text i B7 och F4 | B7, F4 |
| R4-12 | Prognosen bygger på en takt som kallas orealistisk | Intervall från 1 % i veckan till den egna takten, "om den håller", samma uppställning och länk på båda målen | D4 |
| R4-13 | Gångna veckor och deload nästan samma grå | Deload är en ihålig kontur | F2, H1 |
| R4-14 | "bakre axel / 0" och "ej / bedömd" | Svagaste först, ellips, fast sifferkolumn (kontrolleras) | D1, F3 |
| R4-15 | A3: "Avsluta och spara först" med 0 set | "Spara som rutin och avsluta", som i B9 | A3 |
| R4-16 | 48 min för 3 set | 18 min i läge 2 | B9 |
| R4-17 | Vikten följer inte till nästa set | Lyft vikt och mål följer med till kommande set | B1 |
| R4-18 | Följsamhet i % för Sommarbas | "11 av 12 veckor fullföljda" | E2 |
| R4-19 | Versal och gemen i avslutsbladet | Gemener i båda raderna | B9, B10 |
| R4-20 | Drop-badgen "Drop" | ↓ som i appen (kontrolleras) | B5 |
| R4-Typo | Upprepad jämförelse i D2, E6-meta, "i kabel", singular/plural | En mening över listan, kort meta, "med kabel", "Raka magmuskler" | D2, E6, H2, E4 |
| R4-Hier | Fyra lager före svaret i F3, definitionen i F2 | Coachruta → grupper → kartrad, förklaringen i kartbladet, definitionen bakom ⓘ | F3, F2 |
| R4-Luft | Fyra "0 av 10" i D1, vilochip klipps | Hopfälld rad för grupper utan träning och plan, vilotider i två rader | D1, F3, B8 |
| R4-Färg | Platshållare 3,1:1 | Platshållare i ink-2 (AA) | E1, E3, F1 |
| R4-Ikon | Knäböjsvarianter lika, kabel som torn, Drop som ord | Utrustningen först i undertexten, kabelglyfen omritad för 22 px, ↓ | B11, E1, H4, B5 |
| R4-Tydl | Fyra saker i stapeln, Bröst 5,5 utan förklaring, utfallsböjens volym, tom stång | Stapeln = svagaste + planerat, notis om övre bröst, "kg per hand" och två hantlar i volymen, första gången tom stång | D1, F3, B1, B10, B9 |
| R4-Tabbar | Kalenderrad under flikraden | Skrollytan slutar vid flikraden, så ingen rad ligger under den | alla med flikrad |

## Runda 5: den fjärde oberoende granskningen

De sex verkliga buggarna, de tretton mindre punkterna, tränarens tre anmärkningar och alla punkter under "För att nå 9" i `score4.md`, plus två rättelser ägaren redan byggt i appen (plattan står fast vid rullning, Viktenhet per övning under "kg ⌄"). Etiketterna R5-<n>, R5-<kategori> och App står på ramarna.

| Punkt | Problem | Ändring | Ramar |
|---|---|---|---|
| R5-1 | Volymkortet fäller ihop tränade och planerade grupper | Bara grupper där varje huvudmuskel har 0 gjort och 0 planerat fälls ihop; Ben visar "framsida lår plan 6" (kontrolleras) | D1, D1d, F3, F3d |
| R5-2 | Kartbladet läser inte den nya planen | Bladet läser samma plan som grupperna, med använda åtgärder (kontrolleras) | F3, F3d |
| R5-3 | Två progressionsregler | En modell i övningens meny (repintervall och steg), schemats förval och rutinens val i den ordningen, knappen i F4 borttagen, Mål med intervall i platta och docka (kontrolleras) | B1, B7, F4 |
| R5-4 | RIR-regeln utan data | Raden säger att RIR räknas bara när det är ifyllt (Fråga efter RIR är av) (kontrolleras) | F3, G1 |
| R5-5 | Siffror på kortkanten | Grid med minmax(0,1fr), högerkolumnen innanför marginalen (mätt i alla fyra ramarna) | D1, D1d, F3, F3d |
| R5-6 | Sökningen i Kalender gör inget | Fältet får fokus och filtrerar listan; "Inga pass matchar" utan träff (kontrolleras) | C1 |
| R5-7 | 1800 kg mot 6 252 kg | En formatterare med smalt mellanrum från 1 000 (kontrolleras efter alla flöden) | B9, B10 |
| R5-8 | Tre ordningar i undertexten | utrustning · engelskt namn överallt (kontrolleras) | D2, D3, E1, B11 |
| R5-9 | Namnregeln bryts | Regeln tillåter etablerade gymnamn som grundövning; varianter med adjektiv före och annat redskap sist med "med": Axelpress, Lutande bänkpress med hantlar, Framåtböjd rodd, Sittande rodd med kabel, Sving med kettlebell (kontrolleras) | H2, B11, E1, F4 |
| R5-10 | Två namn på veckosummeringen, olika muskelurval | "Veckan hittills, av 10" i båda bladen, bara bedömda huvudmuskler | B9, B10 |
| R5-11 | Två "nu" för bänkpress | 82,5 kg × 5 i både D4 och F4 (kontrolleras) | D4, F4 |
| R5-12 | Olika filterchip | Samma chip i väljaren och Bibliotek (kontrolleras) | B11, E1 |
| R5-13 | Senast använda saknar Stående vadpress | Dagens Benpass och senaste Tryckpass (kontrolleras) | B11 |
| R5-14 | Pallofpress med hantel | "Använd dess muskler" väljer också kabel (kontrolleras) | E3 |
| R5-15 | Två blå konturer med plattan öppen | Raden tonas ned även när det är nästa set som ändras (kontrolleras) | B1 |
| R5-16 | Låsraden flyttar raderna | Beskedet är en toast i botten; raderna står still (mätt) | B2 |
| R5-17 | Antalet set uppdateras inte | Övningshuvudet räknar seten live (kontrolleras) | B2 |
| R5-18 | Ordglapp: marklyft, legend 1–4, ljudraden | "rumänsk marklyft", legend under 5 / 5–9,5 …, "Ljud när vilan är slut" i G1 | F3, F1, G1 |
| R5-19 | H4: 34 px och 70 % | 34 px = 77 % av cirkeln, glyfen 24 px = 55 % | H4 |
| R5-Coach | Drop före sista setet, svagt platåförslag, uppvärmning på set 3 | Drop efter set 3, "Ta ned 10 % och bygg upp" eller variant, uppvärmning bara före första arbetssetet (kontrolleras) | B5, F4, B4 |
| R5-Typo | 600 på sekundärtext | Gruppetiketter, kolumnrubriker och datumrader i 400 (kontrolleras) | alla |
| R5-Luft | D2:s tomma nedre halva | Senast och mål överst, kartraden och tre senaste pass under | D2 |
| R5-Ikon | Kabel som nyckel, maskin som streckkod, kroppsvikt som streckgubbe | Omritade i en byggstil: trissa på balk med kabel till handtag, två plattor och stift, figur i samma linjevikt | H4, E1, E3 |
| R5-Mindre | Dockans skarv, råa tider i nyckelbilder | Tunn kant på fyllningen; nya tokens för 360/160/600/420/240 ms | B3, H5 |
| App: platta | Sifferplattan ska stå kvar i skärmens nederkant vid rullning | Plattan ligger fast i telefonens botten medan listan rullar (som i appen nu) | B1 |
| App: viktenhet | "kg ⌄" ska gälla bara övningen | Bladet Viktenhet: "Gäller bara {namn}. Standardenheten för alla övningar väljer du i Inställningar."; Inställningar är standarden (kontrolleras) | B1, G1 |

## Runda 6: den femte oberoende granskningen

De två verkliga felen och de nio mindre punkterna i `score5.md`. Etiketterna R6-<n> står på ramarna.

| Punkt | Problem | Ändring | Ramar |
|---|---|---|---|
| R6-1 | Belöningens Klar lämnar användaren i passet | Klar avslutar passet och går till Träna ("Passet sparat i Kalender"), som Släng och Spara som rutin (kontrolleras) | B9 |
| R6-2 | −10 % ger 36 kg som inte går att lasta | Procentförslag avrundas till övningens steg: 40 kg → 35 kg (kontrolleras) | F4 |
| R6-3 | Två namn på veckosummeringen | "Veckan hittills, av 10" i avslutsbladet och belöningen (kontrolleras i B9 och B10) | B9, B10 |
| R6-4 | Ben-undertexten visar 0 för en planerad muskel | Den svagaste muskeln visar sin plan: "vadmuskel 0 plan 4,5" (kontrolleras) | F3 |
| R6-5 | Platshållaren bryter namnregeln | "t.ex. Knästående pallofpress" (kontrolleras) | E3 |
| R6-6 | Tema-raden svarar inte | Hela raden är en brytare, som de andra (kontrolleras) | G1 |
| R6-7 | Vilotexten säger emot förvalet | "Förval: flerled med skivstång 2:30 (3:00 eller mer om du går ned mot 3–5 reps)" (kontrolleras) | B8 |
| R6-8 | Veckorubrikerna ofiltrerade vid sökning | Rubrikerna räknar bara träffarna (kontrolleras) | C1 |
| R6-9 | Dockans fyllning går genom texten | Tiden kvar är en 3 px stapel i dockans överkant (kontrolleras) | B3, B1 |
| R6-10 | Viktstegstexten juridisk, ±2,5 oförklarat | En kort mening om vad ±2,5 betyder och när vikten går upp (kontrolleras) | B7 |
| R6-11 | ~55 min mot historiken | Passets tid är snittet av historiken (~48 min för Benpass) (kontrolleras) | A2, F2 |

## Kontroll

Runda 6, mätt med `build/verify3.cjs`: Playwright i Chromium och WebKit, 390 och 1100 px breda fönster, ljust och mörkt sidtema (8 körningar): 944 av 944 kontroller godkända. 0 av 1 016 interaktiva element under 44 × 44 px i verklig storlek, 0 av 2 037 textelement utanför 12/13/15/17/20/28 och 400/600/700. Alla 261 synliga kontroller i de elva LIVE-ramarna ändrar något, i båda motorerna. Nya kontroller för de elva punkterna: belöningens Klar går till Träna, procentförslag avrundade till steget (35 kg), samma veckoetikett i B9 och B10, Ben visar den svagaste muskelns plan, platshållaren, Tema som hel rad, vilotexten, viktstegstexten, dockans stapel, veckorubrikerna vid sökning och passets tid mot historiken. Inga konsolfel och ingen sidledsrullning.

### Runda 5

Runda 5, mätt med `build/verify3.cjs`: Playwright i Chromium och WebKit, 390 och 1100 px breda fönster, ljust och mörkt sidtema (8 körningar): 848 av 848 kontroller godkända. 0 av 1 016 interaktiva element under 44 × 44 px i verklig storlek, 0 av 2 032 textelement utanför 12/13/15/17/20/28 och 400/600/700. Alla 261 synliga kontroller i de elva LIVE-ramarna ändrar något, i båda motorerna (nya: kolumnrubrikerna kg och Reps, sökningen i Kalender). En ny kontroll per rättad punkt: volymkortet fäller bara ihop helt tomma grupper, kartbladet läser den nya planen, volymraderna ligger innanför kortet, sökningen får fokus och filtrerar, ett talformat, en undertextordning, namnregeln, samma filterchip, senast använda, Använd dess muskler väljer kabel, plattan ger en ring, låsbeskedet flyttar inget, antalet set räknas live, ljudraden och RIR-regeln, F4 utan andra progressionsknapp och med samma bänkpress som D4, drop efter sista setet, uppvärmning bara före set 1, sekundärtext i 400, repintervall i övningshuvudet och Viktenhet per övning. Inga konsolfel och ingen sidledsrullning.

### Runda 4

Runda 4, mätt med `build/verify3.cjs`: Playwright i Chromium och WebKit, 390 och 1100 px breda fönster, ljust och mörkt sidtema (8 körningar): 696 av 696 kontroller godkända. 0 av 940 interaktiva element under 44 × 44 px i verklig storlek (telefonerna i skala 1 också vid 390 px), 0 av 1 962 textelement utanför 12/13/15/17/20/28 och 400/600/700. Alla 239 synliga kontroller i de elva LIVE-ramarna ändrar något, i båda motorerna (fler än i runda 3: setbadgen, coachåtgärderna och de hopfällda grupperna). Nya kontroller i runda 4: en blå ring åt gången i B3 och B5, ↑ i accent, ↓ för drop, samma undertext för egna övningar i väljaren och Bibliotek, D2:s flikrad och G1:s ←, sidtitlarna på samma linje, ingen undertext i gruppraderna bryts, ingen "höftextension", samma uppställning på båda målen, använd coachåtgärd blir en klar-rad och ritar om planen, vikten följer med till nästa set. Ingen rad ligger under flikraden: skrollytan slutar vid den. Inga konsolfel och ingen sidledsrullning.

### Runda 3

Runda 3, mätt med `build/verify3.cjs`: Playwright i Chromium och WebKit, 390 och 1100 px breda fönster, ljust och mörkt sidtema (8 körningar): 616 av 616 kontroller godkända. Telefonerna renderas i skala 1 också i ett 390 px-fönster (ramarna går kant i kant utan ram), och tryckytorna mäts i sin verkliga storlek: 0 av 854 interaktiva element under 44 × 44 px i varje körning. 0 av 1 982 textelement utanför 12/13/15/17/20/28 och 400/600/700. Kontrollen av LIVE-ramarna trycker på varje synlig kontroll överst i varje LIVE-ram (220 stycken) efter en ny sidladdning och jämför ramen och sidans läge före och efter: alla 220 ändrar något, i både Chromium och WebKit. Nya jämförelser mellan ramar: en veckoreferens per skärm, ett primärt val på Träna, play-ikonens kontrast, A–Ö sorterad, startvärden D4 = F4, vilonivåer G1 = B8, kryssa i stället för bocka, 1RM lika utan pil, gruppraden med starkaste och svagaste, coachåtgärden med Ångra, filterchippen. Inga konsolfel och ingen sidledsrullning.

### Runda 2

Runda 2, mätt med `build/verify2.cjs`: Playwright i Chromium och WebKit, 390 och 1100 px breda fönster, ljust och mörkt sidtema (8 körningar): 480 av 480 kontroller godkända. I varje körning: 0 av 830 interaktiva element under 44 × 44 px och 0 av 1 921 textelement utanför 12/13/15/17/20/28 och 400/600/700 (DOM-mätning i alla telefonramar och tavlor). 12 kontroller jämför samma värde i flera ramar (Benpass övningar, Knäböjs set, veckoremsan A2 = F2, gjorda pass F2 = kalendern, volymraderna D1 = F3, baksida lår i D1, F3 och B10, bänkpressrekordet D2 = D4, flikens namn, telefontitlarna 28 px, inga engelska demonamn, inga röda underskott, blå brytare). Inga konsolfel och ingen sidledsrullning före eller efter interaktion. Temabytet i G1 är uppmätt bildruta för bildruta i WebKit: text och yta tonar samtidigt.
