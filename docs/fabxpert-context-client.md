# FabXpert — contextul complet al aplicației

> Document de context pentru beneficiar. Scopul lui: încărcat într-un asistent AI (Claude), îi dă acestuia tot ce trebuie să știe despre FabXpert, ca să te ajute să formulezi cereri de funcționalități clare și realiste către echipa de dezvoltare. Reflectă starea aplicației la **4 noiembrie 2026**.

---

## 1. Ce este FabXpert

FabXpert este o platformă de tip ERP pentru o firmă de confecții metalice (structuri din oțel). Inspirată de Tekla PowerFab, dar nu o clonă: obiectivul este o aplicație modernă, simplă și rapidă, construită incremental, modul cu modul, pornind de la ceea ce atelierul folosește zilnic.

**Un singur beneficiar per instanță** (single-tenant). „Companie” în aplicație înseamnă întotdeauna *client al firmei* (beneficiarul unui proiect), nu chiriaș al platformei.

Aplicația are **trei fețe**:

| Aplicație | Cine o folosește | Unde rulează |
|---|---|---|
| **Aplicația web de administrare** („FabXpert Admin”) | administratori și personalul de birou | browser, desktop și telefon |
| **Aplicația mobilă de pontaj** („FabXpert Time”) | muncitorii din producție | telefon, instalată ca PWA de pe ecranul principal |
| **API-ul** | cele două aplicații de mai sus | server, invizibil pentru utilizatori |

Limba interfeței este **româna** (cu diacritice). Codul sursă, baza de date și documentația tehnică sunt în engleză.

### 1.1 Ce face astăzi, pe scurt

- **Proiecte**: evidența lucrărilor pe client, cu cod, denumire lucrare, finisaj (RAL), greutate, termen, status, culoare, complexitate, listă de ansamble și progres fizic.
- **Pontaj**: muncitorii își loghează orele din telefon pe proiect și activitate, iar pentru activitățile de execuție spun și **ce ansamble și câte bucăți** au făcut. Adminii văd, corectează și exportă.
- **Panou** (dashboard): proiectele fixate ca pe un panou de perete, cu progres pe activități, ore logate, cine a pontat, cine nu, cine e în concediu.
- **Concedii**: cereri din telefon, aprobare din web, solduri, document Word pentru cererea de odihnă.
- **Ore suplimentare**: sold per angajat, decontare lunară, corecții manuale, ore de weekend numărate separat.
- **Contabilitate**: pontajul lunar în Excel, exact în formatul registrului contabililor.
- **Rapoarte**: productivitate, proiecte active (ore consumate vs. execuție), normative ore/tonă pe activitate, fișa fiecărui proiect.
- **Task-uri**: sarcini de birou între administratori, pe proiect, cu checklist, comentarii și notificări live.
- **Comunicare**: sondaje către echipă, notificări push („Nu uita de pontaj”).
- **Administrare**: utilizatori, roluri (funcții), activități, impersonarea unui angajat.

### 1.2 Ce NU face (încă)

Nu există: ofertare, aprovizionare, stocuri, desene și fișiere CNC, livrări, facturare, salarizare efectivă (aplicația produce doar documentele și listele aprobate), multi-firmă, integrare cu alte sisteme, funcții AI.

---

## 2. Vocabular (glosar)

| Termen în aplicație | Ce înseamnă |
|---|---|
| **Persoană** | O fișă de angajat sau colaborator (nume, contact, funcție, zile de concediu, normă zilnică). Poate exista fără cont de login. |
| **Utilizator** | Contul de login al unei persoane. Are rol **ADMIN** sau **EMPLOYEE**. Un utilizator ↔ exact o persoană. |
| **Rol (funcție)** | Funcția din atelier: Sudor, Vopsitor, Șofer, Lăcătuș mecanic, Muncitor necalificat, Administrativ, Operator CNC. Listă editabilă de admin. |
| **Activitate** | Ce se face efectiv: Debitare (inclusiv CNC intern), Asamblare, Sudare, Vopsire, Rectificare, Premontaj/Montaj, Administrativ, CNC extern. Listă editabilă, cu culoare. |
| **Activitate cu ansamble** | Activitate marcată „Ansamble” (implicit: Asamblare, Sudare, Vopsire). La pontaj pe ea, muncitorul alege ce ansamble a lucrat și câte bucăți. |
| **Companie / Client** | Beneficiarul proiectului. Același CUI poate apărea pe mai multe rânduri (client + punct de lucru). |
| **Proiect** | O lucrare, cu cod unic, aparținând unui client. |
| **Denumire lucrare** | Descrierea lucrării (ex. „Hală depozitare”), afișată lângă cod. |
| **Finisaj** | Tratamentul de suprafață, ex. „RAL 7016”, „Zincare”, „Grund AL + zincare”. Codurile RAL sunt afișate în culoarea reală. |
| **Ansamblu (marcă)** | O linie din lista de ansamble a proiectului, așa cum apare pe desen: marcă (ex. „GBAL/25”), număr de bucăți, profil, lungime, kg/bucată. |
| **Pontaj** | O înregistrare de timp: persoană, proiect, activitate, dată lucrată, durată în minute, observații, eventual ansamble + bucăți. |
| **Panou** | Pagina principală din web: dashboard + proiectele fixate. |
| **Fixat (pin)** | Un proiect fixat apare ca un card pe Panou. |
| **Gata de execuție** | Proiectul e vizibil muncitorilor în aplicația mobilă. Se setează automat când proiectul e fixat și „În producție”, dar poate fi bifat/debifat manual. |
| **Vizibil pentru** | Ce funcții văd proiectul în mobil: „Toți” sau anumite roluri. |
| **Normă zilnică** | Ziua contractuală a persoanei (implicit 9h). Ce e peste normă e timp suplimentar. |
| **Sold ore suplimentare** | Ore acumulate peste normă minus ore folosite și plătite. |
| **Recuperare („Liber”)** | Concediu plătit din soldul de ore suplimentare, în zile sau în ore. |
| **Decontare lunară** | Aprobarea orelor suplimentare ale unei luni: se plătesc sau se reportează. |
| **Office** | Conturi de birou: nu apar la „nu au pontat”. Adminii sunt automat Office. |
| **Angajat extern (colaborator)** | Colaborator extern. Exclus din pontajul contabil și din decontarea orelor suplimentare. |
| **Prezență automată** | Persoane care nu pontează (management, contabilitate): pontajul contabil le marchează prezente în fiecare zi lucrătoare fără concediu. |
| **Impersonare** | Adminul vede și operează aplicația mobilă exact ca un anumit angajat. |
| **Sondaj** | O întrebare cu opțiuni trimisă echipei, cu răspuns din telefon. |
| **Task** | Sarcină de birou între administratori, legată de un proiect. |

---

## 3. Roluri și acces

Există **două roluri**:

**ADMIN**
- Acces complet la aplicația web.
- Poate ponta în numele oricui, poate edita orice pontaj din orice zi, pe orice proiect.
- Aprobă concedii și ore suplimentare, generează documente, administrează utilizatori și liste.
- Nu poate intra în aplicația mobilă (mesaj: „Acest cont este pentru aplicația de administrare.”).

**EMPLOYEE (angajat)**
- Folosește **doar** aplicația mobilă (web îl respinge: „Acest cont este pentru aplicația mobilă.”).
- Vede doar proiectele „Gata de execuție” și care îi sunt vizibile după funcție.
- Își creează pontajele proprii; le poate edita/șterge **doar pe cele de azi**, și doar durata și observațiile (regulă de interfață; adminul corectează restul).
- Își cere concedii, își vede soldurile (concediu și ore suplimentare), răspunde la sondaje, primește notificări.

Nu există alte niveluri (ex. „șef de echipă”, „contabil”, „doar citire”). O cerere de tip „vreau ca X să vadă doar Y” înseamnă introducerea unui rol nou, ceea ce e o schimbare mai amplă.

Steaguri suplimentare pe cont (bifate de admin): **Activ**, **Office**, **Prezență automată**, **Angajat extern**, **Vede doar proiecte alocate specific** (ascunde proiectele marcate „Toți”; vede doar pe cele alocate explicit funcției lui).

Sesiunea se ține într-un cookie securizat. „Ține-mă minte” păstrează sesiunea 30 de zile (admin) sau 365 de zile (angajat); fără bifă, o zi. Dezactivarea unui cont îl deconectează imediat, inclusiv fluxurile live.

---

## 4. Aplicația mobilă de pontaj (FabXpert Time)

Aplicație web progresivă (PWA): se deschide din browser și se instalează pe ecranul principal (pe iPhone prin „Partajează → Adaugă pe ecranul principal”). Nu există în App Store / Play Store. Are nevoie de internet; nu lucrează offline și nu pune la coadă pontajele.

### 4.1 Structura

Nu are meniu cu taburi. Este un **flux liniar** („wizard”) plus câteva ecrane de listă:

1. **Autentificare**: Utilizator (e-mail), Parolă, „Ține-mă minte” (bifat implicit), „Conectare”.
2. **Pasul 1 — Alege proiectul** (ecranul de acasă)
   - Salut „Bună, {prenume}” și data în română.
   - Banner „Azi ai lucrat 7h 30m” / „Azi nu ai pontat încă” → apasă și deschide „Pontajele mele”.
   - Deasupra: notificările nedeschise și bannerul de sondaj, dacă există.
   - Lista proiectelor disponibile, carduri colorate în culoarea proiectului: cod, badge finisaj, denumire lucrare, client, buton (i) pentru notițele proiectului.
   - Lista se actualizează **live** când adminul fixează/defixează un proiect sau îi schimbă statusul.
3. **Pasul 2 — Alege activitatea**: listă cu bulină colorată; activitățile cu ansamble pe acest proiect au chip „ansamble”.
4. **Pasul 3 — Ansamble** (doar pentru activități cu ansamble și proiecte cu listă; altfel se sare direct la timp)
   - Sus: „Logare timp” fără ansamble („pentru cei care ajută la asamblare”).
   - „SAU ALEGE CE AI LUCRAT”: căutare după marcă/profil, ansamble grupate pe profil, cu chip „4/7 rămase”.
   - Ansamblele terminate la activitatea respectivă sunt ascunse sub „Vezi ansamblele finalizate (N)” și nu se pot alege.
5. **Pasul 4 — Câte bucăți ai făcut?**
   - Un card per ansamblu; **o bifă = o bucată**, cu umplere în cascadă (a 4-a bifă umple 1–4). Peste 12 bucăți rămase, contor −/+.
   - Bucățile făcute anterior apar gri. Nu se poate bifa peste cât a rămas. „Toate rămase” umple restul.
   - Un ansamblu lăsat pe 0 blochează „Continuă la timp” (trebuie bifat sau scos cu ✕).
6. **Pasul 5 — Adaugă timp**
   - Rezumat ansamble (dacă e cazul), cu „Modifică”.
   - Data (implicit azi, orice dată se poate alege).
   - Durata: −/+ pe ore, câmp text (acceptă „4h”, „2h30m”, „45m”, „4,5”), preseturi 2h/4h/6h/8h și 15m/30m/45m. Implicit **9h**, sau **7h30** dacă data e sâmbătă.
   - Observații (opțional).
   - „Salvează pontajul” → toast „Pontaj adăugat”, înapoi la pasul 1.
7. **Pontajele mele**: grupate pe zile („AZI · marți, 4 nov”), total pe zi, marcile logate ca chip-uri „GBAL/25 ×2”; doar rândurile de azi se pot deschide.
8. **Editează pontajul**: doar durata și observațiile; bucățile rămân cum au fost logate („șterge pontajul și adaugă-l din nou” dacă s-au schimbat). Ștergere cu confirmare în subsol.
9. **Concediile mele** (din meniul de avatar → „Concediu”)
   - Card „Concediu de odihnă”: zile rămase / alocate / folosite.
   - Card „Ore suplimentare”: sold cu semn, „Luna aceasta: Xh acumulate · Yh folosite · report ±Zh”.
   - Lista cererilor cu status (În așteptare / Aprobat / Respins); doar cele în așteptare se pot edita sau anula.
10. **Cerere nouă**: tip (Odihnă, Liber; sub „+”: Medical, Neplătit, Donare de sânge), „Liber” se poate cere în **zile sau ore** (ore: între 15 minute și norma zilnică, într-o singură zi), De la / Până la, numărul de zile lucrătoare calculat automat, avertisment (nu blocaj) „Depășești zilele rămase (N).”, Motiv.
11. **Sondaj**: la deschiderea aplicației, un sondaj la care nu s-a răspuns se afișează peste tot restul; după răspuns rămâne un banner cu „Vezi sau schimbă răspunsul”. Angajatul vede doar numărul de răspunsuri, nu cine ce a votat.
12. **Notificări**: la prima intrare, aplicația cere permisiunea de notificări („Îți amintim de pontaj”). Notificările apar și în aplicație ca bannere, până sunt închise.

### 4.2 Reguli vizibile pentru muncitor

- Nu există avertisment de normă sau de ore prea multe în fluxul de pontaj: aplicația **nu blochează** munca raportată.
- Singura excepție de blocaj: nu se pot bifa bucăți peste cât a rămas din lista de ansamble (în mobil). Adminul poate depăși din web, iar depășirea apare ca semnal, nu ca eroare.
- O sesiune expirată duce înapoi la ecranul de login, fără pierdere de date salvate.
- Trei teme: **Auriu** (implicit, fundal cărbune cald cu accent chihlimbar), Întunecat, Luminos. Se schimbă din antet.

---

## 5. Aplicația web de administrare (FabXpert Admin)

### 5.1 Navigare

Bară laterală (200 px, se poate restrânge la 56 px; pe telefon devine meniu glisant), cu grupuri:

| Grup | Pagină | Ce are în plus |
|---|---|---|
| Operare | **Panou** | — |
| | **Proiecte** | — |
| | **Task-uri** | badge: task-uri care cer atenție |
| | **Pontaj** | badge: aprobări de ore suplimentare în așteptare |
| | **Concedii** | badge: cereri în așteptare |
| Resurse | **Persoane**, **Companii** | — |
| Rapoarte | **Rapoarte** | — |
| Administrare | **Administrare** | — |

În josul barei: clopoțelul de notificări (task-uri), comutatorul de temă (Întunecat → Luminos → Auriu), utilizatorul curent și „Deconectare”.

### 5.2 Panou (pagina principală)

Nu e un kanban cu etape; este un **dashboard** plus un **panou de perete cu proiectele fixate**.

**Cinci carduri-metrice** (care sunt și comutatorul de vizualizare), cu filtru de perioadă (Azi, Ieri, Săpt., Luna, Interval):

| Card | Ce arată când e selectat |
|---|---|
| Proiecte în curs | proiectele fixate + tabelul proiectelor în curs + proiectele finalizate (pliate) |
| Ore logate {perioadă} | ore pe proiect, cu defalcare pe activități |
| Au pontat {perioadă} | persoane care au pontat, cu defalcare, buton „Editează pontajele” |
| În concediu {perioadă} | cine e în concediu |
| Nu au pontat {perioadă} | cine nu a pontat, pe categorii; „Trimite notificare” (push „Nu uita de pontaj”), „Impersonează utilizator”, bifă „Afișează colaboratori externi” |

Sub metrice: bannerul sondajului în curs și widgeturile „Task-urile mele” / „Proiecte cu task-uri în atenție” (apar doar când au conținut).

**Proiectele fixate** (cardurile):
- Se fixează din coloana cu pin a tabelului „Proiecte în curs”; se defixează de pe card.
- O coloană sau două (preferință salvată); în modul cu o coloană textul e mărit pentru **afișare pe un ecran de perete**.
- Se reordonează prin tragere (pe telefon: apasă lung pe cod).
- Cardul arată: dungă în culoarea proiectului, cod · denumire lucrare, client, status, finisaj, greutate (tone), complexitate C1–C4, sudură (m), termen cu zilele rămase (roșu când e întârziat), număr de ansamble (deschide lista), vizibil pentru, task-uri, **bara de progres**.
- Dreapta cardului e coloana de acțiuni: creion (editare), rapoarte (fișa proiectului), chevron (defalcare).
- Defalcarea pe activități: pentru activitățile cu ansamble, procent + bară în culoarea activității + făcut/total în tone sau bucăți + ore logate; bucățile bifate manual apar ca segment mai pal. Activitățile fără ansamble au doar bara de ore.
- Cardurile fixate arată totaluri de la începutul proiectului; filtrul de perioadă nu li se aplică.
- Proiectele fără listă de ansamble arată „total logat” în loc de progres.

**Tabelul „Proiecte în curs”**: toate proiectele nefinalizate (suspendatele rămân), sortate „În producție” întâi, apoi după data de început; filtre de căutare, status, vizibilitate, gata de execuție; comutator Tabel / Detaliat; rânduri expandabile cu defalcarea pe activități. Proiectele finalizate stau pliate dedesubt, cele mai recent modificate primele.

### 5.3 Proiecte

Lista completă, cu aceleași filtre și coloane: Cod, Nume, Finisaj, Progres, Greutate, Complexitate, Sudură, Ore estimate, Client, Început, Termen, Status, Ansamble, Task-uri, Vizibil pentru, Gata exec. Coloanele se pot ascunde, reordona, redimensiona (preferință per utilizator).

**Formularul de proiect** (panou glisant din dreapta): Cod, Nume, Denumire lucrare, Client, Status, Finisaj (recunoaște RAL), Culoare, Dată începere, Termen, Greutate (t), Complexitate (piese/t), Sudură (m liniari), Ore estimate, Vizibil pentru (roluri), Gata de execuție, Notițe, activitățile cu ansamble urmărite pe acest proiect. Se poate lipi un rând copiat din Excel.

**Statusuri de proiect** (4): În pregătire (implicit), În producție, Finalizat, Suspendat.
- Trecerea în **Finalizat** memorează data finalizării (folosită în rapoarte), **defixează** proiectul de pe Panou și recalculează calibrarea progresului.
- Un proiect fixat care intră În producție devine automat vizibil muncitorilor; în orice altă combinație devine ascuns, până îl bifează cineva manual.

**Lista de ansamble** a proiectului:
- **Import** din fișierul Excel al proiectului (export Tekla sau șablon manual; se citește foaia „ANSAMBLE”), sau prin lipire de text, sau adăugare manuală. Re-importul actualizează liniile existente după marcă, nu le dublează. Nimic nu blochează importul: liniile ciudate sunt raportate, nu respinse.
- La import, dacă registrul are foaia „Detaliere ansamble”, se calculează automat **piese/tonă** (= repere / tone) și se completează complexitatea.
- Când există listă, **greutatea proiectului = Σ bucăți × kg/buc** și câmpul devine blocat; ansamblele fără kg/buc sunt numărate și totalul e marcat ca parțial.
- „Loghează execuția”: adminul bifează manual bucăți făcute pe activitate, cu notă (ex. „subcontractat”), pentru munca ce nu a trecut prin pontaj.
- Coloane: Nr. crt., Ansamblu, Profil, Lungime, Nr. bucăți, progres pe activitate.

### 5.4 Pontaj

Patru taburi:

**Pontaj**
- Tabel pe persoană și zi (Persoană, Dată, Total durată, Total pe activități, Total pontaje, Ansamble, Detalii) cu derulare infinită, sau **Calendar** (săptămână / lună / an).
- Filtre: persoană, proiect, activitate, perioadă.
- Editarea zilei: panou cu toate pontajele acelei zile, adăugare/modificare/ștergere, inclusiv ansamble și bucăți. Selectorul de proiect arată întâi proiectele în execuție, cu „Caută în toate proiectele”.
- **Export Excel** („Pontaje”): o foaie cu cod proiect, denumire lucrare, client, nume proiect, lună, dată, ore (cu formulă de total), activitate, muncitor, observații și marcile logate („GBAL/25 x2”).
- Pontajele noi apar **live** în tabel (fără refresh) și ca notificare discretă.

**Ore suplimentare**
- Tabel per angajat: Rol, Ore sâmbătă, Ore duminică, Sâmbete lucrate, Report, Aprobate la plată, Folosite, Zile de recuperat, Sold.
- Tile-uri: Sold total, Datorii, Cu sold de plată, Corectat manual.
- Creion → **corecție manuală**: „Sold nou (ore)” (orice valoare, inclusiv negativă), iar dacă luna are ore de weekend, totalurile lunii pentru „Ore sâmbătă” și „Ore duminică” se pot suprascrie. „Revino la orele pontate” anulează corecția.

**Aprobări** (decontarea lunară)
- Lista persoanelor cu luna trecută neaprobată; pentru fiecare: report, acumulate, folosite, sold, **Păstrate (h)** (rezervă opțională, implicit 0), **De plată**.
- Aprobarea îngheață luna. O lună se poate reaproba; diferența curge în report. O modificare de pontaj în ultima lună aprobată readuce persoana la „De reaprobat”.

**Contabilitate**
- Selectorul de lună; tile-uri Total angajați, Total ore normale, Ore suplimentare aprobate, Total ore.
- Tabel per persoană (Ore normale, Ore sâmbătă, Ore duminică, Sâmbete lucrate, Ore suplimentare, Total ore, Status), cu secțiune separată „Colaboratori externi” (nu intră în document).
- „Zile lipsă”: zilele fără pontaj și fără concediu se rezolvă înainte de export: prezent (X) sau un cod de concediu (CO, CM, CFP, DS).
- **Previzualizare** 1:1 și **Exportă** → fișierul Excel „Pontaj_{lună}_{an}.xlsx”, copia fidelă a registrului contabililor (grilă de 31 de zile cu coduri, contoare, legendă colorată, coloane de plată). Exportul **închide luna**; se poate redeschide.

### 5.5 Concedii

- Taburi **Cereri** (În așteptare / Aprobate / Respinse / Toate; filtre angajat, tip; tabel sau calendar) și **Solduri** (Zile alocate, Folosite, Rămase; editarea zilelor alocate pe an).
- Acțiuni pe cerere: Aprobă, Respinge, Editează, **Exportă cererea de concediu** (document Word „Cerere concediu de odihnă”, doar pentru cereri de odihnă aprobate, cu soldul înainte/după).
- Adminul poate adăuga concedii direct („Adaugă concediu”) și poate schimba o decizie deja luată.
- Aprobarea peste sold doar avertizează, nu refuză.

**Tipuri de concediu**: Odihnă (consumă zilele alocate), Liber / recuperare (consumă soldul de ore suplimentare; în zile sau ore), Medical, Neplătit, Donare de sânge (plătit, nu afectează nimic).

**Numărarea zilelor**: zile lucrătoare între cele două date inclusiv, fără sâmbete, duminici și sărbători legale românești. Zilele de odihnă se atribuie anului în care începe cererea. Nu se acceptă cereri suprapuse.

### 5.6 Persoane și Companii

- **Persoane**: Nume, Prenume, E-mail, Telefon, Funcție; secțiune „Persoane fără cont”. Numele se afișează peste tot **Nume Prenume** (numele de familie primul).
- **Companii**: Denumire, Cod fiscal, Nr. Reg. Com., sediu, telefon, adresă de livrare, reprezentant legal, e-mail, persoană de contact și telefonul ei, culoare. Import în masă prin lipirea din Excel (10 coloane; cheia este denumirea exactă).

### 5.7 Rapoarte

Trei taburi, cu perioadă (Luna curentă / Luna trecută / Interval):

- **Productivitate**: KPI (Proiecte finalizate, Ore lucrate, Eficiență medie = estimat/lucrat, La termen, Întârziate), grafice „Ore lucrate vs. estimate” pe proiect, „Ore pe client”, „Ore pe activitate”, „La termen vs. întârziate”.
- **Proiecte active**: pentru proiectele În producție, „Ore consumate” (din estimare) față de „Execuție” (progres fizic), cu diferența între ele și zilele până la termen.
- **Normative**: ore/tonă pe activitate, din proiectele finalizate în ultimele N luni (normativ cumulat, mediană, interval), plus normativul general.
- **Fișa proiectului** (se deschide din Panou, Proiecte și Rapoarte): consum, eficiență, estimat, greutate, oameni, ore pe activitate cu progres pe ansamble, ore pe persoană, prima și ultima zi lucrată.

Notă: „Ore estimate” de pe proiect nu sunt considerate de încredere; se folosesc doar la comparația finală, niciodată ca bază pentru progres.

### 5.8 Task-uri

- Sarcini de birou **între administratori**, întotdeauna pe un proiect. Nu ajung la muncitori.
- Panou kanban cu „De făcut”, „În lucru”, „Finalizate” (prin tragere), filtre „Ale mele / Toate”, Întârziate / Astăzi / Săptămâna aceasta / Fără termen, proiect, responsabil.
- Un task are: subiect, mesaj, unul sau mai mulți destinatari (se creează câte un task pentru fiecare), termen, prioritate (Normală / Ridicată / Urgentă), checklist, comentarii, istoric al schimbărilor.
- Notificări live (clopoțel + push) la atribuire, finalizare, comentariu.
- Întârziat = termen depășit și nefinalizat; nu se stochează, se calculează.

### 5.9 Administrare

Taburi:
- **Comunicare → Sondaje**: întrebare, descriere, 2–10 opțiuni, răspuns multiplu da/nu, termen opțional; ciornă → publicat → închis; rezultate cu cine ce a votat (doar pentru admin). Audiența este fixă: toți angajații activi cu cont, fără colaboratorii externi; la publicare fiecare primește notificare.
- **Utilizatori**: patru liste (Angajați, Externi, Office, Conturi inactive); formular cu e-mail, parolă, rol, persoana legată, **normă zilnică (ore)**, bifele Activ / Office / Prezență automată / Angajat extern / Vede doar proiecte alocate specific; „Impersonează utilizator”.
- **Roluri** (funcții) și **Activități** (cu culoare și bifa „Ansamble”): liste editabile inline, cu activare/dezactivare.

**Impersonarea**: o fereastră cu o ramă de telefon care conține o **copie a aplicației mobile**, în care adminul acționează ca angajatul ales. Orice modificare în aplicația mobilă se reflectă și aici.

---

## 6. Reguli de business importante

Acestea sunt decizii luate deja și implementate. Dacă o cerere nouă le contrazice, spune-o explicit în cerere, pentru că schimbarea lor are efecte în lanț.

### 6.1 Principiu general: nu bloca, semnalează
Aplicația nu refuză munca raportată de muncitor. Validarea marchează anomalia (badge pentru admin), dar salvează. Exemple: importul salvează tot și raportează rândurile ciudate; bucăți raportate peste listă apar ca depășire, nu ca eroare; aprobarea concediului peste sold doar avertizează. Singura excepție: în aplicația mobilă nu se pot bifa bucăți peste cât a rămas.

### 6.2 Pontaj
- Un pontaj are **dată lucrată** (zi calendaristică) și **durată în minute**; nu există ore de început/sfârșit și nici cronometru.
- Pontajul este al unei **persoane**; se reține separat **cine** l-a introdus (muncitorul sau un admin în numele lui).
- Un pontaj poate avea legate ansamble cu bucăți făcute doar dacă are activitate, iar activitatea urmărește ansamble pe acel proiect.
- Crearea unui pontaj închide automat notificarea „Nu uita de pontaj” a persoanei.

### 6.3 Progresul proiectului
- Lista de ansamble nu are o coloană de progres: progresul e **derivat** din pontaje (bucăți × activitate) plus bifările manuale ale adminului. Corectarea unui pontaj vechi recalculează progresul automat.
- Fiecare bucată contează ca greutatea ei + o constantă K (kg), ca piesele mici să nu fie ignorate. Fiecare activitate cu ansamble „închide” lista o dată, cu o pondere proprie.
- K și ponderile sunt **calibrate automat din proiectele finalizate** (cu intervale de siguranță: 5–150 h/t per proiect, K între 25 și 150 kg, ponderi între 10% și 60%) și salvate; se recalculează doar când un proiect intră sau iese din Finalizat.
- O singură cifră de progres peste tot (card, tabel, fișă); rândurile pe activitate sunt în tone sau bucăți, deci totalul nu e media lor.
- O activitate cu ansamble poate fi **debifată pe un anumit proiect** (ex. Vopsire pe un proiect zincat): se pontează doar ore, iese din formula de progres, datele deja logate rămân și revin dacă e rebifată. Finisajul nu debifează nimic automat.
- Proiectele fără listă de ansamble arată doar „total logat”.

### 6.4 Complexitate
- Piese/tonă = **repere** (nu ansamble) pe tonă; clase C1 ≤ 50, C2 ≤ 150, C3 ≤ 300, C4 > 300. Se completează automat la import din foaia „Detaliere ansamble” sau manual. Nu intră în formula de progres.

### 6.5 Vizibilitatea proiectelor pentru muncitori
- Vizibil în mobil ⇔ „Gata de execuție” **și** vizibil pentru funcția angajatului („Toți” sau rolul lui; conturile cu „Vede doar proiecte alocate specific” ignoră „Toți”).
- „Gata de execuție” se recalculează automat la fixare/defixare și la schimbarea statusului (fixat + În producție = vizibil), dar bifa manuală rămâne posibilă până la următoarea astfel de schimbare.
- Angajații nu-și pot edita pontajele pe proiecte devenite ascunse; corecturile trec prin admin.

### 6.6 Ore suplimentare
- **Norma = ore pontate.** Pe o zi lucrătoare, tot ce e peste norma persoanei e plus, tot ce e sub e minus. O zi fără niciun pontaj nu e datorie (pur și simplu nu se numără). Ziua de azi nu poate crea datorie până nu se termină.
- Norma e per persoană (implicit 9h), din contract, fără istoric în timp.
- **Weekendul se numără separat** (din octombrie 2026): sâmbăta, duminica și sărbătorile legale nu au normă și nu intră în sold. Orele lor apar în coloanele „Ore sâmbătă” (sâmbete + sărbători din săptămână) și „Ore duminică”, exact cum au fost pontate, și merg la contabilitate ca atare (tariful îl aplică contabilul). 7h30 e doar durata precompletată sâmbăta în mobil. Lunile aprobate înainte de această regulă rămân pe regula veche.
- Concediul aprobat pe o zi valorează norma persoanei; o zi de „Liber” costă o zi de normă din sold; „Liber” se poate lua și în ore.
- **Decontare lunară** (confirmată cu HR, nu fereastra de 90 de zile): la final de lună se plătește tot, minus o rezervă opțională per persoană; **datoriile nu se plătesc niciodată**, se reportează. Se poate redeconta. Externii sunt excluși deocamdată.
- Sold afișat = report + acumulate luna curentă − folosite − plătite. Nu e un cumul pe viață.
- **Corecția manuală** înlocuiește tot ce era înainte de ziua ei (inclusiv luni neaprobate); zilele de la ea încolo se adună normal. Doar ultima corecție contează; istoricul se păstrează.

### 6.7 Pontajul contabil
- Reproduce **cell cu cell** registrul contabililor (inclusiv ciudățeniile lui, intenționat). Nu se „curăță”.
- Persoanele în ordine alfabetică. Externii nu intră. Persoanele cu „Prezență automată” sunt marcate prezente în fiecare zi lucrătoare fără concediu.
- Zilele lipsă se rezolvă înainte de export (X sau cod de concediu). Generarea închide luna; luna se poate redeschide.
- Aplicația nu calculează salarii și nu mișcă bani; produce documentul și lista aprobată.

### 6.8 Concedii
- Soldul de odihnă nu e un contor stocat: se calculează din zilele alocate minus cererile aprobate din anul curent.
- Zilele se numără fără weekenduri și sărbători legale; o cerere nu poate avea 0 zile lucrătoare; nu se acceptă suprapuneri.

### 6.9 Altele
- Toate ștergerile sunt **soft** (datele rămân în bază, marcate ca șterse).
- Numele se scriu „Nume Prenume” peste tot.
- Greutatea se ține în kg în bază și se afișează în **tone** cu 2 zecimale.
- Culorile proiectelor, rolurilor și RAL sunt date, nu temă: arată la fel în toate temele.

---

## 7. Notificări și comunicare

- **Notificare în aplicație**: se salvează și rămâne vizibilă până e închisă. Tipuri: memento de pontaj, sondaj nou, task atribuit / finalizat / comentat. (Tipul „anunț liber” există în structură, dar nu are încă interfață.)
- **Push** (pe telefon, și cu aplicația închisă): canal secundar, „best effort”; necesită ca angajatul să fi acceptat notificările și, pe iPhone, ca aplicația să fie instalată pe ecranul principal.
- **Nu există joburi programate**: memento-ul „Nu uita de pontaj” se trimite **manual**, de către un admin, din „Nu au pontat”, persoană cu persoană. Un memento automat la ora 17:00 ar fi o funcționalitate nouă.
- Aprobarea/respingerea concediilor și decontarea orelor **nu** trimit notificări astăzi.
- **Live în web**: pontajele noi, disponibilitatea proiectelor și task-urile se propagă instant prin fluxuri server→browser (SSE).

---

## 8. Design și limbaj vizual

### 8.1 Direcție
Calm, plat, „enterprise”, dens în date. Fără negru pur, fără alb pur, fără neon. Culoarea poartă sens:

| Culoare | Înseamnă |
|---|---|
| albastru (primar) | acțiune, brand, proiecte |
| verde | succes, finalizat, „au pontat” |
| chihlimbar / amber | atenție, În producție, concediu |
| roșu | pericol, întârziere, „nu au pontat” |
| cyan | ore |
| mov, indigo, teal | categorii secundare în grafice |

### 8.2 Teme
Trei teme, comune ambelor aplicații, definite într-un singur fișier de tokenuri (variabile CSS):
- **Întunecat** (implicit în web): fundal `#111827`, suprafețe `#1e293b`, primar albastru `#3b82f6`.
- **Luminos**: fundal `#f8fafc`, primar `#2563eb`.
- **Auriu** (implicit în mobil, paleta originală): fundal cărbune cald `#1f1e19`, accent chihlimbar `#d9a441`, text `#f0eee6`.

Tema se salvează în browser și se aplică înainte de prima randare (fără „flash”). Componentele nu folosesc culori hex; totul trece prin tokenuri: suprafețe (`bg`, `surface`, `surface-raised`, `surface-active`…), borduri, text (`primary`, `secondary`, `muted`, `disabled`), primar, seturi semantice (`success`, `warning`, `danger`, `info`, `purple`, `cyan`, fiecare cu fundal/bordură/text), culori de badge pe status, culori de grafic (`chart-1…8`), umbre.

### 8.3 Tipografie și forme
- Web: **Inter**, cu dimensiunea de bază **20 px** (toate dimensiunile sunt cu 25% mai mari decât standardul Tailwind, pentru lizibilitate în atelier). Titlu de pagină 22 px mediu, text de tabel „sm”, etichete 10–12 px, eyebrow-uri cu majuscule și spațiere largă, cifre tabulare / monospațiate.
- Mobil: fontul de sistem; monospațiat pentru mărci, durate și coduri.
- Colțuri: 6 px badge-uri, 8 px butoane și câmpuri, 12 px carduri, 14 px rânduri-opțiune în mobil, pastile rotunde complet pentru chip-uri, 20–28 px pentru foile de jos (bottom sheet).
- Densitate compactă: carduri `px-3 py-2.5`, butoane secundare `px-3 py-1.5`, primare `px-4 py-2.5`.

### 8.4 Componente și convenții (web)
- **Tabele** (`DataTable`): sortare pe server, coloane ascunse/reordonate/redimensionate per utilizator, dungă colorată la stânga, rânduri expandabile, schelete la încărcare, paginare „N rezultate · Pagina X din Y” (20 pe pagină) sau derulare infinită la pontaje.
- **Formulare**: panou glisant din dreapta (`SlideOverPanel`), validare înainte de trimitere, butoane „Adaugă” / „Salvează” + „Anulează” în subsol, toast de succes („Persoană adăugată”), eroare ca toast.
- **Ștergere**: link „Șterge X” în modul de editare → subsolul devine confirmare inline („Sigur ștergi…?”, Șterge / Anulează). Niciodată dialoguri native de browser.
- **Stări**: încărcare „Se încarcă…” + schelete; eroare ca banner roșu cu „Reîncearcă”; gol ca o cutie cu bordură punctată („Niciun proiect încă.”).
- **Filtre**: chip-uri rotunde (perioadă, status), căutare cu întârziere de 300 ms, „Împrospătare date” cu pictogramă rotitoare.
- **Comutator de vedere**: Tabel / Calendar sau Tabel / Detaliat, preferință salvată per listă.
- **Badge-uri**: status (4 culori), finisaj (RAL în culoarea reală, cu contrast calculat; zincare gri-argintiu; restul contur), complexitate (4 bare umplute până la nivel), vizibilitate (chip-uri pe rol).
- **Pictograme**: setul Tabler.
- **Loader**: o animație de cusătură de sudură („WeldingLoader”) la importul listelor de ansamble.
- **Mobil-first în web**: sub 640 px bara devine meniu glisant, acțiunile paginii urcă în antet, titlurile se ascund.

### 8.5 Componente și convenții (mobil)
- Antet fix (logo FABXPERT care resetează fluxul, temă, avatar cu meniu) + sub-antet de context (înapoi, bară colorată, cod proiect, client, activitate).
- Rânduri-opțiune înalte (≥ 66 px), cu bară colorată la stânga; ținte de atingere ≥ 44 px.
- Un singur buton principal pe ecran; acțiunea principală stă într-un **subsol fixat** care ține cont de zona sigură a telefonului.
- Un singur toast odată, deasupra subsolului (succes 2,5 s, eroare 4 s).
- Schelete animate la încărcare; animațiile respectă „reduce motion”.

---

## 9. Arhitectură tehnică (pe scurt)

Pentru a înțelege ce e ușor și ce e greu de cerut.

```
fabxpert/  (monorepo Turborepo + pnpm)
├─ apps/api      NestJS (Node 22), REST, Prisma, Zod  → Railway
├─ apps/web      Next.js 15 (App Router), React 19, Tailwind 4 → Vercel
├─ apps/mobile   Vite + React 19, PWA (vite-plugin-pwa) → Vercel (domeniu separat)
└─ packages/
   ├─ db         schema Prisma, migrări, seed-uri → Supabase (Postgres gestionat)
   └─ shared     DTO-uri, scheme Zod, calcule de business, clientul HTTP, tokenurile de culoare
```

- **Toată logica de business stă în API.** Frontend-urile sunt subțiri și vorbesc cu API-ul doar prin clientul comun din `packages/shared`.
- **Autentificare proprie** (JWT în cookie HTTP-only), nu Supabase Auth. Supabase e folosit doar ca Postgres.
- Două medii: **dezvoltare** și **producție**, fiecare cu baza, API-ul și frontend-urile lui. Fără mediu de staging. Migrările rulează automat la deploy.
- **Fără joburi programate, fără cozi, fără e-mail.** Notificările push merg prin Web Push (VAPID).
- Testare: teste end-to-end la nivel de API (reguli de autorizare și reguli între module), rulate la cerere.
- Aplicația mobilă e separată de web ca să poată fi rescrisă în React Native fără a atinge restul; impersonarea din web este o **copie** a ei, întreținută în paralel.

### 9.1 Modelul de date (entități)

Persoană · Utilizator · Rol (funcție) · Activitate · Companie · Proiect · Ansamblu de proiect · Profil de oțel (catalog) · Activitate neurmărită pe proiect · Pontaj · Pontaj–Ansamblu (bucăți făcute) · Progres manual pe ansamblu · Cerere de concediu · Decontare ore suplimentare (per persoană și lună) · Corecție de sold · Corecție ore weekend · Calibrare progres · Export contabil (luna închisă) · Prezență contabilă · Notificare · Abonament push · Sondaj / Opțiune / Vot · Task / Checklist / Comentariu / Eveniment.

Toate au id UUID, date de creare/modificare și ștergere soft.

### 9.2 Exporturi și documente existente
| Document | De unde | Format |
|---|---|---|
| Pontaje pe perioadă | Pontaj → Export Excel | `.xlsx`, foaia „Pontaje” |
| Pontaj lunar pentru contabilitate | Pontaj → Contabilitate → Exportă | `.xlsx`, formatul registrului contabililor |
| Cerere de concediu de odihnă | Concedii → rând → Exportă | `.docx` din șablon Word |
| Import listă de ansamble | Proiect → Ansamble → Import | citește `.xlsx` (Tekla / șablon) |
| Import companii | Companii → lipire din Excel | text separat prin tab |

Rapoartele din pagina „Rapoarte” sunt doar pe ecran (fără export).

---

## 10. Limitări cunoscute și idei deja discutate

**Limitări acceptate deocamdată**
- Mobil: fără offline, fără editarea pontajelor mai vechi de azi, fără limită de dată (se poate ponta și în trecut, și în viitor), totalul de azi din primele 20 de pontaje.
- „Azi” = ziua calendaristică a telefonului; schimburile de noapte peste miezul nopții nu sunt tratate special.
- Fără memento automat la o anumită oră (trimis manual de admin).
- Fără notificări la aprobarea concediilor sau la decontarea orelor.
- Document de plată pentru orele suplimentare (lista aprobată ca Excel) încă nefăcut.
- Pictogramele PWA sunt provizorii.
- Sortarea pe coloane există pe Panou și Proiecte; alte liste au ordinea implicită.
- Fără CI/CD; deploy-urile sunt manuale.

**Direcții viitoare notate în arhitectură** (nicio promisiune): producție și fluxuri de producție, piese și desene, fișiere CNC, stocuri, livrări, aprovizionare, generare de documente, integrări, aplicație nativă React Native.

---

## 11. Cum să formulezi o cerere către dezvoltator

Asistentul care citește acest document ar trebui să te ajute să produci cereri care conțin:

1. **Unde**: aplicația (web / mobil / ambele), pagina și tabul (ex. „Pontaj → Contabilitate”), rolul care o folosește.
2. **Ce vezi azi și ce vrei să vezi**: descrie comportamentul actual cu termenii din glosar și rezultatul dorit; dacă e un ecran nou, în ce listă/meniu apare și ce stări are (gol, încărcare, eroare).
3. **Regula de business**: formula sau condiția, cu un exemplu numeric („angajat cu normă 8h, 10h pontate sâmbătă → …”). Spune explicit dacă contrazice o regulă din secțiunea 6.
4. **Cazurile limită**: ce se întâmplă cu datele vechi (luni deja aprobate, proiecte finalizate), cu externii, cu „Prezență automată”, cu proiectele fără listă de ansamble.
5. **Semnal sau blocaj**: implicit aplicația semnalează, nu blochează; dacă vrei blocaj, spune și de ce.
6. **Document / export**: dacă e vorba de un fișier, atașează un model (Excel/Word) așa cum trebuie să arate; echipa reproduce formatul existent fidel.
7. **Prioritate și urgență**, și dacă înlocuiește sau completează ceva existent.

### Șabloane

**Funcționalitate nouă**
> În **[aplicația web → Pontaj → Aprobări]**, ca **[admin]**, vreau **[să văd și orele de duminică pe fiecare rând]**, ca să **[verific plata separat]**. Azi **[coloana lipsește]**. Regula: **[…]**. Exemplu: **[…]**. Cazuri speciale: **[luni deja aprobate rămân cum sunt]**. Nu blochează nimic.

**Modificare de regulă existentă**
> Regula actuală (secțiunea 6.x): **[…]**. Vreau să devină: **[…]**, începând cu **[luna / data]**. Datele de dinainte: **[rămân / se recalculează]**. Motiv: **[…]**.

**Document nou / schimbat**
> Documentul **[Pontaj lunar]** trebuie să aibă în plus **[…]**. Atașez modelul **[fișier]**. Diferențele față de ce iese azi: **[…]**.

**Problemă (bug)**
> În **[mobil → Pontajele mele]**, pe **[data]**, utilizatorul **[Nume Prenume]** a făcut **[pașii]** și a văzut **[ce]**, în loc de **[ce se aștepta]**. Capturi: **[…]**.

### Ce e, de regulă, ieftin vs. costisitor

| De regulă rapid | De regulă amplu |
|---|---|
| o coloană, un filtru, un badge, o etichetă | un rol nou de utilizator sau permisiuni fine |
| un câmp nou pe un formular existent | lucrul offline în mobil |
| un export care seamănă cu unul existent | un modul nou (stocuri, livrări, ofertare) |
| un tip nou de notificare trimisă manual | joburi programate (memento automat la o oră) sau e-mail |
| o nouă vizualizare peste date existente | schimbarea unei reguli cu efect pe lunile deja aprobate |
| un ecran în mobil (se face în dublu: mobil + impersonare) | aplicație nativă în magazinele de aplicații |

---

## 12. Convenții ale echipei de dezvoltare (bune de știut)

- Codul, numele din bază, comentariile și mesajele tehnice sunt în engleză; doar textul de pe ecran e în română, cu diacritice. Câteva nume vechi rămân în română în cod (`finisaj`, `denumireLucrare`, `angajatExtern`, `/panou`).
- Orice schimbare în aplicația mobilă se face și în copia ei din impersonare, în aceeași livrare.
- Valorile de business (norme, praguri, intervale de calibrare) stau într-un singur loc, în pachetul comun, ca să nu existe două formule pentru același lucru.
- Ce se poate calcula din date nu se stochează ca un contor (sold de concediu, progres), cu excepția lunilor decontate, care se îngheață intenționat.
- Baza de date de dezvoltare conține date de test; numele duplicate din liste nu sunt un defect.
