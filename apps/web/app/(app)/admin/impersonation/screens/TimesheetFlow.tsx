import { assemblyRemainingForActivity } from '@fabxpert/shared';
import type {
  ActivityDto,
  LeaveRequestDto,
  MeResponse,
  ProjectAssemblyDto,
  ProjectOptionDto,
  TimesheetDto,
} from '@fabxpert/shared';
import { useCallback, useState } from 'react';
import { ActivitySelect } from './ActivitySelect';
import { AppHeader } from './AppHeader';
import { AssemblyQuantities } from './AssemblyQuantities';
import { AssemblySelect } from './AssemblySelect';
import { ContextSubHeader } from './ContextSubHeader';
import { LeaveRequestForm } from './LeaveRequestForm';
import { MyLeaveRequests } from './MyLeaveRequests';
import { MyTimesheets } from './MyTimesheets';
import { ProjectSelect } from './ProjectSelect';
import { TimeEntry } from './TimeEntry';
import { TimesheetEdit } from './TimesheetEdit';
import { useProjectAssemblies } from '../hooks/useProjectAssemblies';
import type { FlowStep } from '../types/flow';
import { countWithNoun, type AssemblySelection } from '../utils/assemblyUtils';

interface TimesheetFlowProps {
  user: MeResponse;
  onLogout: () => void;
}

export function TimesheetFlow({ user, onLogout }: TimesheetFlowProps) {
  const [step, setStep] = useState<FlowStep>('selectProject');
  const [selectedProject, setSelectedProject] = useState<ProjectOptionDto | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityDto | null>(null);
  const [assemblySelection, setAssemblySelection] = useState<AssemblySelection[]>([]);
  /** False once the picker reports the project has no assembly list at all. */
  const [projectHasAssemblyList, setProjectHasAssemblyList] = useState(true);
  const [editingTimesheet, setEditingTimesheet] = useState<TimesheetDto | null>(null);
  const [editingLeaveRequest, setEditingLeaveRequest] = useState<LeaveRequestDto | null>(null);
  const [leaveListRefreshToken, setLeaveListRefreshToken] = useState(0);
  const projectAssemblies = useProjectAssemblies(selectedProject?.id ?? null);

  const resetToProjectSelect = useCallback(() => {
    setStep('selectProject');
    setSelectedProject(null);
    setSelectedActivity(null);
    setAssemblySelection([]);
    setProjectHasAssemblyList(true);
    setEditingTimesheet(null);
    setEditingLeaveRequest(null);
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
    setAssemblySelection([]);
    setProjectHasAssemblyList(true);
    setStep('selectActivity');
  }

  /**
   * Activities that track assemblies ask what was worked on before the time.
   * A project whose list is already known to be empty skips straight to the
   * time screen, so the picker never flashes on its way past.
   */
  function handleActivityChosen(activity: ActivityDto) {
    setSelectedActivity(activity);
    setAssemblySelection([]);

    const hasList = !projectAssemblies.isLoaded || projectAssemblies.assemblies.length > 0;
    setProjectHasAssemblyList(hasList);
    setStep(activity.tracksAssemblies && hasList ? 'selectAssemblies' : 'timeEntry');
  }

  function handleBackFromActivity() {
    setSelectedProject(null);
    setSelectedActivity(null);
    setStep('selectProject');
  }

  function handleToggleAssembly(assembly: ProjectAssemblyDto) {
    setAssemblySelection((current) =>
      current.some((entry) => entry.assembly.id === assembly.id)
        ? current.filter((entry) => entry.assembly.id !== assembly.id)
        : [...current, { assembly, quantity: 1 }],
    );
  }

  /** Never more pieces than the list still has open for this activity. */
  function handleChangeAssemblyQuantity(assemblyId: string, quantity: number) {
    setAssemblySelection((current) =>
      current.map((entry) => {
        if (entry.assembly.id !== assemblyId || !selectedActivity) {
          return entry;
        }

        const capacity = assemblyRemainingForActivity(entry.assembly, selectedActivity.id);

        return { ...entry, quantity: Math.min(Math.max(0, quantity), capacity) };
      }),
    );
  }

  /** Dropping the last card leaves nothing to count — back to the list. */
  function handleRemoveAssembly(assemblyId: string) {
    const remaining = assemblySelection.filter((entry) => entry.assembly.id !== assemblyId);
    setAssemblySelection(remaining);

    if (remaining.length === 0) {
      setStep('selectAssemblies');
    }
  }

  function handleSkipAssemblies() {
    setAssemblySelection([]);
    setStep('timeEntry');
  }

  /**
   * Nothing to pick from — the project never got a list. The flow stays what it
   * was before assemblies existed: project, activity, time.
   */
  const handleEmptyAssemblyList = useCallback(() => {
    setProjectHasAssemblyList(false);
    setStep('timeEntry');
  }, []);

  function handleBackFromAssemblies() {
    setSelectedActivity(null);
    setAssemblySelection([]);
    setStep('selectActivity');
  }

  function handleBackFromQuantities() {
    setStep('selectAssemblies');
  }

  function handleBackFromTimeEntry() {
    if (selectedActivity?.tracksAssemblies && projectHasAssemblyList) {
      setStep(assemblySelection.length > 0 ? 'assemblyQuantities' : 'selectAssemblies');
      return;
    }

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

  function handleOpenLeave() {
    setEditingLeaveRequest(null);
    setStep('myLeaveRequests');
  }

  function handleBackFromLeave() {
    resetToProjectSelect();
  }

  function handleOpenCreateLeave() {
    setEditingLeaveRequest(null);
    setStep('leaveRequestForm');
  }

  function handleEditLeave(request: LeaveRequestDto) {
    setEditingLeaveRequest(request);
    setStep('leaveRequestForm');
  }

  function handleBackFromLeaveForm() {
    setEditingLeaveRequest(null);
    setStep('myLeaveRequests');
  }

  function handleLeaveFormSaved() {
    setLeaveListRefreshToken((token) => token + 1);
    setEditingLeaveRequest(null);
    setStep('myLeaveRequests');
  }

  const showFlowSubHeader =
    step === 'selectActivity' ||
    step === 'selectAssemblies' ||
    step === 'assemblyQuantities' ||
    step === 'timeEntry' ||
    step === 'editTimesheet';

  const editProject =
    step === 'editTimesheet' && editingTimesheet ? editingTimesheet.project : null;

  /** The activity line under the project, with the picked marks counted on it. */
  const flowActivityLabel =
    !selectedActivity || step === 'selectActivity'
      ? undefined
      : step === 'assemblyQuantities' && assemblySelection.length > 0
        ? `${selectedActivity.name} · ${countWithNoun(
            assemblySelection.length,
            'ansamblu',
            'ansamble',
          )}`
        : selectedActivity.name;

  function handleFlowBack() {
    if (step === 'selectActivity') {
      handleBackFromActivity();
    } else if (step === 'selectAssemblies') {
      handleBackFromAssemblies();
    } else if (step === 'assemblyQuantities') {
      handleBackFromQuantities();
    } else if (step === 'timeEntry') {
      handleBackFromTimeEntry();
    }
  }

  return (
    <div className="timesheet-app">
      <AppHeader
        user={user}
        onLogout={onLogout}
        onWordmarkPress={handleWordmarkPress}
        onOpenLeave={handleOpenLeave}
        screenTitle={
          step === 'myTimesheets'
            ? 'Pontajele mele'
            : step === 'myLeaveRequests'
              ? 'Concediile mele'
              : step === 'leaveRequestForm'
                ? editingLeaveRequest
                  ? 'Editează cererea'
                  : 'Cerere nouă'
                : undefined
        }
        onScreenBack={
          step === 'myTimesheets'
            ? handleBackFromMyTimesheets
            : step === 'myLeaveRequests'
              ? handleBackFromLeave
              : step === 'leaveRequestForm'
                ? handleBackFromLeaveForm
                : undefined
        }
      />

      {showFlowSubHeader && step === 'editTimesheet' && editProject ? (
        <ContextSubHeader
          projectCode={editProject.code}
          companyName={editProject.company.name}
          projectColor={editProject.color}
          activityName={editingTimesheet?.activity?.name}
          showBack
          onBack={handleBackFromEdit}
        />
      ) : null}

      {showFlowSubHeader && step !== 'editTimesheet' && selectedProject ? (
        <ContextSubHeader
          projectCode={selectedProject.code}
          companyName={selectedProject.company.name}
          projectColor={selectedProject.color}
          activityName={flowActivityLabel}
          showBack
          onBack={handleFlowBack}
        />
      ) : null}

      <main className="timesheet-main">
        {step === 'selectProject' ? (
          <ProjectSelect
            user={user}
            onChoose={handleProjectChosen}
            onOpenMyTimesheets={handleOpenMyTimesheets}
          />
        ) : null}

        {step === 'selectActivity' && selectedProject ? (
          <ActivitySelect onChoose={handleActivityChosen} />
        ) : null}

        {step === 'selectAssemblies' && selectedProject && selectedActivity ? (
          <AssemblySelect
            activity={selectedActivity}
            assemblies={projectAssemblies.assemblies}
            isLoading={projectAssemblies.isLoading}
            error={projectAssemblies.error}
            onRetry={projectAssemblies.reload}
            selection={assemblySelection}
            onToggle={handleToggleAssembly}
            onSkip={handleSkipAssemblies}
            onEmptyList={handleEmptyAssemblyList}
            onContinue={() => setStep('assemblyQuantities')}
          />
        ) : null}

        {step === 'assemblyQuantities' && selectedActivity ? (
          <AssemblyQuantities
            activity={selectedActivity}
            selection={assemblySelection}
            onChangeQuantity={handleChangeAssemblyQuantity}
            onRemove={handleRemoveAssembly}
            onAddMore={() => setStep('selectAssemblies')}
            onContinue={() => setStep('timeEntry')}
          />
        ) : null}

        {step === 'timeEntry' && selectedProject && selectedActivity ? (
          <TimeEntry
            project={selectedProject}
            activity={selectedActivity}
            assemblies={assemblySelection}
            onEditAssemblies={() => setStep('assemblyQuantities')}
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

        {step === 'myLeaveRequests' ? (
          <MyLeaveRequests
            refreshToken={leaveListRefreshToken}
            onCreateNew={handleOpenCreateLeave}
            onEditRequest={handleEditLeave}
          />
        ) : null}

        {step === 'leaveRequestForm' ? (
          <LeaveRequestForm
            editingRequest={editingLeaveRequest}
            onSaved={handleLeaveFormSaved}
            onCancel={handleBackFromLeaveForm}
          />
        ) : null}
      </main>
    </div>
  );
}
