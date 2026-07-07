import type { ActivityDto, MeResponse, ProjectOptionDto, TimesheetDto } from '@fabxpert/shared';
import { useCallback, useState } from 'react';
import { ActivitySelect } from './ActivitySelect';
import { AppHeader } from './AppHeader';
import { ContextSubHeader } from './ContextSubHeader';
import { MyTimesheets } from './MyTimesheets';
import { ProjectSelect } from './ProjectSelect';
import { TimeEntry } from './TimeEntry';
import { TimesheetEdit } from './TimesheetEdit';
import type { FlowStep } from '../types/flow';

interface TimesheetFlowProps {
  user: MeResponse;
  onLogout: () => void;
}

export function TimesheetFlow({ user, onLogout }: TimesheetFlowProps) {
  const [step, setStep] = useState<FlowStep>('selectProject');
  const [selectedProject, setSelectedProject] = useState<ProjectOptionDto | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityDto | null>(null);
  const [editingTimesheet, setEditingTimesheet] = useState<TimesheetDto | null>(null);

  const resetToProjectSelect = useCallback(() => {
    setStep('selectProject');
    setSelectedProject(null);
    setSelectedActivity(null);
    setEditingTimesheet(null);
  }, []);

  const handleWordmarkPress = useCallback(() => {
    if (step === 'selectProject') {
      return;
    }
    resetToProjectSelect();
  }, [step, resetToProjectSelect]);

  function handleProjectChosen(project: ProjectOptionDto) {
    setSelectedProject(project);
    setSelectedActivity(null);
    setStep('selectActivity');
  }

  function handleActivityChosen(activity: ActivityDto) {
    setSelectedActivity(activity);
    setStep('timeEntry');
  }

  function handleBackFromActivity() {
    setSelectedProject(null);
    setSelectedActivity(null);
    setStep('selectProject');
  }

  function handleBackFromTimeEntry() {
    setSelectedActivity(null);
    setStep('selectActivity');
  }

  function handleOpenMyTimesheets() {
    setEditingTimesheet(null);
    setStep('myTimesheets');
  }

  function handleBackFromMyTimesheets() {
    resetToProjectSelect();
  }

  function handleEditEntry(entry: TimesheetDto) {
    setEditingTimesheet(entry);
    setStep('editTimesheet');
  }

  function handleBackFromEdit() {
    setEditingTimesheet(null);
    setStep('myTimesheets');
  }

  const showFlowSubHeader =
    step === 'selectActivity' || step === 'timeEntry' || step === 'editTimesheet';

  const editProject =
    step === 'editTimesheet' && editingTimesheet ? editingTimesheet.project : null;

  return (
    <div className="timesheet-app">
      <AppHeader
        user={user}
        onLogout={onLogout}
        onWordmarkPress={handleWordmarkPress}
        screenTitle={step === 'myTimesheets' ? 'Pontajele mele' : undefined}
        onScreenBack={step === 'myTimesheets' ? handleBackFromMyTimesheets : undefined}
      />

      {showFlowSubHeader && step === 'editTimesheet' && editProject ? (
        <ContextSubHeader
          projectName={editProject.name}
          projectColor={editProject.color}
          activityName={editingTimesheet?.activity?.name}
          showBack
          onBack={handleBackFromEdit}
        />
      ) : null}

      {showFlowSubHeader && step !== 'editTimesheet' && selectedProject ? (
        <ContextSubHeader
          projectName={selectedProject.name}
          projectColor={selectedProject.color}
          activityName={step === 'timeEntry' ? selectedActivity?.name : undefined}
          showBack
          onBack={() => {
            if (step === 'selectActivity') {
              handleBackFromActivity();
            } else if (step === 'timeEntry') {
              handleBackFromTimeEntry();
            }
          }}
        />
      ) : null}

      <main className="timesheet-main">
        {step === 'selectProject' ? (
          <ProjectSelect
            onChoose={handleProjectChosen}
            onOpenMyTimesheets={handleOpenMyTimesheets}
          />
        ) : null}

        {step === 'selectActivity' && selectedProject ? (
          <ActivitySelect onChoose={handleActivityChosen} />
        ) : null}

        {step === 'timeEntry' && selectedProject && selectedActivity ? (
          <TimeEntry
            project={selectedProject}
            activity={selectedActivity}
            onSaved={resetToProjectSelect}
          />
        ) : null}

        {step === 'myTimesheets' ? (
          <MyTimesheets onEditEntry={handleEditEntry} />
        ) : null}

        {step === 'editTimesheet' && editingTimesheet ? (
          <TimesheetEdit
            timesheet={editingTimesheet}
            onSaved={handleBackFromEdit}
            onCancel={handleBackFromEdit}
          />
        ) : null}
      </main>
    </div>
  );
}
