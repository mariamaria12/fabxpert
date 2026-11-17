'use client';

import { InfoDialogButton, InfoSection } from '@/components/InfoDialogButton';

/** How a person's overtime balance is worked out, next to the "Ore suplimentare" title. */
export function OvertimeRulesInfo({ approvalStatus }: { approvalStatus?: string | null }) {
  return (
    <InfoDialogButton title="Cum se calculează orele suplimentare">
      <InfoSection
        title="Ce arată ecranul"
        items={[
          'Soldul fiecărei persoane peste norma zilnică, în luna aleasă.',
          'Soldul acoperă doar luna afișată plus reportul din luna dinainte — orele mai vechi au fost deja plătite sau recuperate.',
          ...(approvalStatus ? [approvalStatus] : []),
        ]}
      />
      <InfoSection
        title="Norma zilnică"
        items={[
          'Fiecare angajat are norma zilnică din contract, setată în Admin, în formularul utilizatorului. Fără normă setată, ziua are numărul de ore standard agreat.',
          'Colaboratorii externi și persoanele cu prezență automată nu au ore suplimentare.',
        ]}
      />
      <InfoSection
        title="Zilele lucrătoare"
        items={[
          'Orele pontate peste normă se adaugă la sold, iar cele sub normă se scad. Cu norma de 9 ore, 10 ore pontate înseamnă +1h, iar 8 ore înseamnă −1h.',
          'O zi fără niciun pontaj nu se scade din sold.',
          'Concediul aprobat acoperă ziua, așa că nu se scade din sold.',
          'Ziua în curs nu scade soldul: până se termină, contează doar orele care trec de normă.',
        ]}
      />
      <InfoSection
        title="Sâmbăta, duminica și sărbătorile legale"
        items={[
          'Orele pontate în aceste zile nu intră în sold: nu se adaugă, nu se scad și nu se pot lua ca recuperare.',
          'Se numără separat, exact cum au fost pontate: „Ore sâmbătă” adună sâmbetele și sărbătorile legale din timpul săptămânii, iar „Ore duminică” adună duminicile, inclusiv când sunt sărbătoare legală.',
          '„Sâmbete lucrate” arată câte sâmbete și sărbători legale au avut pontaj.',
          'Lunile aprobate înainte de această regulă rămân cum au fost aprobate: acolo sâmbăta peste 7,5 ore și duminica au intrat în sold, iar coloanele de ore rămân goale.',
          'Sărbătorile legale: 1–2 ianuarie, 6–7 ianuarie, 24 ianuarie, Vinerea Mare, Paștele și Rusaliile (duminica și lunea), 1 mai, 1 iunie, 15 august, 30 noiembrie, 1 decembrie, 25–26 decembrie.',
        ]}
      />
      <InfoSection
        title="Soldul"
        items={[
          'Soldul lunii: reportul din luna trecută, plus orele suplimentare ale lunii, minus recuperările luate și orele deja aprobate la plată.',
          'O zi de recuperare consumă din sold o zi din norma persoanei; recuperarea pe ore consumă orele cerute. „Zile de recuperat” arată câte zile întregi acoperă soldul.',
          'În luna curentă, creionul de pe rând setează manual soldul, înlocuind tot ce era înainte, și orele de weekend. În lunile trecute corectează doar orele de weekend.',
          'La final de lună, soldul se aprobă pentru plată în tab-ul „Aprobări”.',
        ]}
      />
    </InfoDialogButton>
  );
}

/** What approving a month does, next to the "Aprobări ore suplimentare" title. */
export function OvertimeApprovalsInfo() {
  return (
    <InfoDialogButton title="Cum funcționează aprobarea">
      <InfoSection
        title="Ce aprobi"
        items={[
          'Pentru fiecare persoană, soldul lunii: reportul din luna trecută, plus orele suplimentare ale lunii, minus recuperările luate.',
          'Orele lucrate sâmbăta, duminica și de sărbători legale, separat de sold. Se aprobă odată cu linia persoanei, așa cum au fost pontate. Cine are doar astfel de ore apare și el pe listă, începând cu octombrie 2026.',
          'O lună se poate aproba din ultima ei săptămână sau oricând după ce s-a încheiat.',
        ]}
      />
      <InfoSection
        title="Ce face aprobarea"
        items={[
          'Se plătește tot soldul, mai puțin orele pe care le păstrezi pentru recuperare, în coloana „Păstrate”. „Reportează tot” nu plătește nimic.',
          'Datoriile nu se plătesc: trec întregi în luna următoare.',
          'Cifrele lunii se îngheață. Doar orele suplimentare aprobate ajung în documentul pentru contabilitate. Orele de sâmbătă și duminică apar acolo așa cum au fost pontate, chiar și neaprobate — linia rămâne însă „În pregătire” până le aprobi. Aplicația nu face plăți, doar pregătește lista.',
        ]}
      />
      <InfoSection
        title="După aprobare"
        items={[
          'Dacă după aprobare se pontează sau se corectează ore în luna aprobată, persoana reapare la „În așteptare”, marcată „De reaprobat” — la fel și dacă i se schimbă orele de sâmbătă sau duminică. Reaprobarea plătește diferența, iar orele păstrate rămân aceleași.',
          'Dacă aprobi înainte de sfârșitul lunii, reaprobă după ultima zi, ca să intre la plată și orele din zilele rămase.',
          'Orele nereaprobate nu se pierd: trec în luna următoare și se aprobă odată cu ea.',
        ]}
      />
      <InfoSection
        title="Dacă nu aprobi"
        items={[
          'Soldul trece automat în luna următoare și se plătește când aprobi o lună de după ea.',
          'Până atunci orele nu ajung în contabilitate și se recalculează din pontaje, deci o corectură la un pontaj vechi schimbă soldul.',
          'O corecție manuală a soldului, cu creionul din „Ore suplimentare”, înlocuiește tot ce era înainte, inclusiv orele neaprobate.',
        ]}
      />
    </InfoDialogButton>
  );
}

/** What the accounting pontaj holds and how it is exported, next to its title. */
export function AccountingTimesheetInfo() {
  return (
    <InfoDialogButton title="Cum funcționează pontajul pentru contabilitate">
      <InfoSection
        title="Ce arată ecranul"
        items={[
          'Ultimul pas al fluxului: orele lunii pe fiecare persoană, cu orele suplimentare aprobate incluse.',
          'Personalul office nu apare pe pontaj.',
          'Persoanele cu „prezență automată” (conducere, contabilitate) nu pontează: apar prezente în fiecare zi lucrătoare fără concediu aprobat.',
          'Colaboratorii externi au lista lor, mai jos. Nu intră în documentul pentru contabilitate și nu sunt numărați nici în totaluri, nici la zilele fără pontaj — nu au un număr fix de zile.',
        ]}
      />
      <InfoSection
        title="Orele"
        items={[
          'Orele normale sunt orele pontate fără cele peste program.',
          'Orele suplimentare sunt doar cele aprobate pentru plată în tab-ul „Aprobări”.',
          'Orele de sâmbătă, de sărbători legale și de duminică se numără separat, așa cum au fost pontate, chiar și neaprobate.',
        ]}
      />
      <InfoSection
        title="Statusul liniei"
        items={[
          '„În pregătire”: persoana mai are ore suplimentare sau ore de weekend de aprobat.',
          '„Gata pentru export”: tot ce era de aprobat în lună a fost aprobat.',
          '„Exportat”: luna a fost descărcată pentru contabilitate.',
        ]}
      />
      <InfoSection
        title="Documentul"
        items={[
          'O zi cu pontaj sau cu recuperare aprobată e X, concediile apar cu codul lor (CO, CM, CFP), iar sâmbetele lucrate se numără separat.',
          '„Vizualizează pontaj” arată documentul exact așa cum va fi exportat.',
          '„Exportă” descarcă documentul și marchează luna ca exportată — reversibil.',
          'Zilele lucrătoare fără pontaj trebuie lămurite înainte de export.',
        ]}
      />
    </InfoDialogButton>
  );
}
