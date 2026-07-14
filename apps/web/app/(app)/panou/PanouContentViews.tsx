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
      {activeView === 'hours' && <PanouHoursView />}
      {activeView === 'projects' && <PanouProjectsView />}
      {activeView === 'people' && <PanouPeopleView />}
      {activeView === 'onLeave' && <PanouOnLeaveView />}
    </>
  );
}
