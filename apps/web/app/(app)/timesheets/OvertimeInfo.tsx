'use client';

import { InfoDialogButton, InfoSection } from '@/components/InfoDialogButton';

/** How a person's overtime balance is worked out, next to the "Ore suplimentare" title. */
export function OvertimeRulesInfo() {
  return (
    <InfoDialogButton title="Cum se calculează orele suplimentare">
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
        title="Sâmbăta"
        items={[
          'O sâmbătă lucrată se plătește separat, ca zi de 7,5 ore, oricare ar fi norma.',
          'La ore suplimentare intră doar ce trece de 7,5 ore: 9 ore sâmbătă înseamnă +1h 30m. O sâmbătă mai scurtă nu se scade din sold.',
        ]}
      />
      <InfoSection
        title="Duminica și sărbătorile legale"
        items={[
          'Toate orele pontate duminica sunt ore suplimentare.',
          'La fel într-o sărbătoare legală care cade în timpul săptămânii: e zi liberă, deci toate orele pontate sunt suplimentare. O sărbătoare care cade sâmbăta urmează regula de sâmbătă.',
          'Sărbătorile legale: 1–2 ianuarie, 6–7 ianuarie, 24 ianuarie, Vinerea Mare, Paștele și Rusaliile (duminica și lunea), 1 mai, 1 iunie, 15 august, 30 noiembrie, 1 decembrie, 25–26 decembrie.',
        ]}
      />
      <InfoSection
        title="Soldul"
        items={[
          'Soldul lunii: reportul din luna trecută, plus orele suplimentare ale lunii, minus recuperările luate și orele deja aprobate la plată.',
          'O zi de recuperare consumă din sold o zi din norma persoanei; recuperarea pe ore consumă orele cerute. „Zile de recuperat” arată câte zile întregi acoperă soldul.',
          'Creionul de pe rând setează soldul manual și înlocuiește tot ce era înainte.',
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
          'O lună se poate aproba din ultima ei săptămână sau oricând după ce s-a încheiat.',
        ]}
      />
      <InfoSection
        title="Ce face aprobarea"
        items={[
          'Se plătește tot soldul, mai puțin orele pe care le păstrezi pentru recuperare, în coloana „Păstrate”. „Reportează tot” nu plătește nimic.',
          'Datoriile nu se plătesc: trec întregi în luna următoare.',
          'Cifrele lunii se îngheață. Doar orele aprobate ajung în documentul pentru contabilitate; aplicația nu face plăți, doar pregătește lista.',
        ]}
      />
      <InfoSection
        title="După aprobare"
        items={[
          'Dacă după aprobare se pontează sau se corectează ore în luna aprobată, persoana reapare la „În așteptare”, marcată „De reaprobat”. Reaprobarea plătește diferența, iar orele păstrate rămân aceleași.',
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
