# Ägarens beslut inför implementationen (26 nov)

Mockupen (`mockup.html`) med `changes.md` (rundorna 1–8) och ägarens kommentarer är förlagan. Följande gäller utöver den:

1. **Dela schema (E2) byggs inte nu.** Kräver serverändring; eget steg senare. Delning av pass som i dag.
2. **Trötthetsförslaget (B13):** förval "Föreslå" i Inställningar → Coach (Av / Föreslå / Automatiskt).
3. **RIR:** "Fråga efter RIR" är av från start (som i dag). RIR-rutan i setraden och slidern syns bara när den är på.
4. **Vilotimern:** av från start för nya användare; den som redan har en vilotid sparad behåller den.
5. **RIR-plattan (B12):** "Gör denna popup samma storlek som tangentbordet som används i vikt och reps" – RIR-läget har exakt samma höjd som sifferplattan för kg och reps, så inget hoppar när man byter fält.
6. Mockupen ändras inte mer; detta implementeras fullt ut i appen.

## Ny funktion: Sport (ägarens idé, 26 nov)

Ägarens ord: "ibland hoppar jag över pass men gör en sport istället, tex alpin skidåkning. Det kan vara lite svårt att säga exakt hur den träningen tar på olika muskler osv så istället ska man kunna skapa eller välja en sport och sen välja att bara rapportera tex tid eller för skidåkning utför kan det vara tid och tränar benmuskler och längdskidåkning skulle kunna vara precis som ett löppass, tid, distans osv. Lägg till så man kan lägga till pass i kategorin sport och sen själv välja vad som ska ingå i den träningsmässigt. Skapa några standard sporter som redan finns i appen."

Beslut för implementationen (egna antaganden, ägaren kan ändra):
- En sport är en övning i kategorin **Sport** som loggas som ett konditionsset (`measure: "cardio"`): man väljer vilka fält som ingår (tid alltid; distans, kalorier, puls, höjdmeter m.m. där appens konditionsfält redan finns) och vilka muskler den tränar (samma muskelväljare, Enkel/Avancerad). Ingen serverändring: kategorin är en fri sträng och konditionsset valideras redan.
- Egna sporter skapas som egna övningar med kategorin Sport; ikon: en sportglyf eller hjärtat.
- Standardsporter i katalogen, med rimliga fält och muskler: Alpin skidåkning (tid; ben, säte, core), Längdskidåkning (tid, distans; helkropp), Fotboll, Innebandy, Padel, Tennis, Simning (tid, distans), Klättring/bouldering (tid; rygg, underarmar, biceps), Vandring (tid, distans), Golf, Yoga (tid).
- Snabbt flöde: "Logga sport" från Träna (och från en planerad dag: "Gjorde en sport i stället"), som skapar ett pass med den sporten och visas i Kalender och Historik som tränad dag. En planerad dag där man loggat sport räknas som genomförd träning ("annan träning") i schemats följsamhet.
- Sportens muskler visas på kartan som tränade, men räknas inte som hårda set i volymkortet (set per muskel), eftersom belastningen inte går att mäta i set.
