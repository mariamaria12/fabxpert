'use client';

import { usePanouDashboard } from './PanouDashboardContext';
import { PanouHoursView } from './PanouHoursView';
import { PanouProjectsView } from './PanouProjectsView';
import { PanouPeopleView } from './PanouPeopleView';
import { PanouOnLeaveView } from './PanouOnLeaveView';

export function PanouContentViews() {
  const { activeView } = usePanouDashboard();

  return (
    <>
      <div className={activeView === 'hours' ? undefined : 'hidden'}>
        <PanouHoursView />
      </div>
      <div className={activeView === 'projects' ? undefined : 'hidden'}>
        <PanouProjectsView />
      </div>
      <div className={activeView === 'people' ? undefined : 'hidden'}>
        <PanouPeopleView />
      </div>
      <div className={activeView === 'onLeave' ? undefined : 'hidden'}>
        <PanouOnLeaveView />
      </div>
    </>
  );
}
