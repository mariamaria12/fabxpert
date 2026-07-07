'use client';

import {
  createActivity,
  createActivitySchema,
  createEmployeeRole,
  createEmployeeRoleSchema,
  deleteActivity,
  deleteEmployeeRole,
  listActivities,
  listEmployeeRoles,
  updateActivity,
  updateActivitySchema,
  updateEmployeeRole,
  updateEmployeeRoleSchema,
  type ActivityDto,
  type CreateActivityInput,
  type CreateEmployeeRoleInput,
  type EmployeeRoleDto,
  type UpdateActivityInput,
  type UpdateEmployeeRoleInput,
} from '@fabxpert/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ADMIN_TAB_ITEMS,
  DEFAULT_ADMIN_TAB,
  parseAdminTab,
  type AdminTab,
} from './adminTabs';
import { UsersTab } from './UsersTab';
import { LookupManager } from '@/components/LookupManager';
import { getRolePaletteColor } from '@/components/roleColors';

const ROLE_COPY = {
  addLabel: 'Adaugă rol',
  namePlaceholder: 'Nume rol',
  activeLabel: 'Activ',
  saveLabel: 'Salvează',
  cancelLabel: 'Anulează',
  formatDeleteConfirm: (name: string) => `Ștergi rolul „${name}"?`,
  deleteYes: 'Da',
  deleteNo: 'Nu',
  createdToast: 'Rol adăugat',
  updatedToast: 'Rol actualizat',
  deletedToast: 'Rol șters',
  duplicateNameError: 'Există deja un rol cu acest nume.',
  nameRequiredError: 'Numele este obligatoriu.',
} as const;

const ACTIVITY_COPY = {
  addLabel: 'Adaugă activitate',
  namePlaceholder: 'Nume activitate',
  activeLabel: 'Activ',
  saveLabel: 'Salvează',
  cancelLabel: 'Anulează',
  formatDeleteConfirm: (name: string) => `Ștergi activitatea „${name}"?`,
  deleteYes: 'Da',
  deleteNo: 'Nu',
  createdToast: 'Activitate adăugată',
  updatedToast: 'Activitate actualizată',
  deletedToast: 'Activitate ștearsă',
  duplicateNameError: 'Există deja o activitate cu acest nume.',
  nameRequiredError: 'Numele este obligatoriu.',
} as const;

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseAdminTab(searchParams.get('tab'));
  const [activatedTabs, setActivatedTabs] = useState<Set<AdminTab>>(
    () => new Set([activeTab]),
  );

  useEffect(() => {
    setActivatedTabs((current) => {
      if (current.has(activeTab)) {
        return current;
      }
      const next = new Set(current);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const setActiveTab = useCallback(
    (tab: AdminTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === DEFAULT_ADMIN_TAB) {
        params.delete('tab');
      } else {
        params.set('tab', tab);
      }
      const query = params.toString();
      router.replace(query ? `/admin?${query}` : '/admin');
    },
    [router, searchParams],
  );

  return (
    <div className="flex h-full flex-col">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
          FABXPERT · ADMIN
        </p>
        <h1 className="mt-1 text-[22px] font-medium text-text-primary">Administrare</h1>
      </div>

      <div
        role="tablist"
        aria-label="Secțiuni administrare"
        className="mt-6 flex flex-wrap gap-1 border-b border-border-subtle pb-px"
      >
        {ADMIN_TAB_ITEMS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-t-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:bg-surface-raised hover:text-text-secondary'
              }`}
            >
              <i className={`ti ${tab.icon} text-base`} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 min-h-0 flex-1">
        {activatedTabs.has('users') && (
          <div hidden={activeTab !== 'users'}>
            <UsersTab active={activeTab === 'users'} />
          </div>
        )}

        {activatedTabs.has('roles') && (
          <div hidden={activeTab !== 'roles'}>
            <LookupManager<EmployeeRoleDto, CreateEmployeeRoleInput, UpdateEmployeeRoleInput>
              active={activeTab === 'roles'}
              hasColor={false}
              listItems={listEmployeeRoles}
              createItem={createEmployeeRole}
              updateItem={updateEmployeeRole}
              deleteItem={deleteEmployeeRole}
              createSchema={createEmployeeRoleSchema}
              updateSchema={updateEmployeeRoleSchema}
              buildCreateInput={(values) => ({
                name: values.name.trim(),
                isActive: values.isActive,
              })}
              buildUpdateInput={(values) => ({
                name: values.name.trim(),
                isActive: values.isActive,
              })}
              copy={ROLE_COPY}
              getDotColor={(_item, stableIndex) => getRolePaletteColor(stableIndex)}
            />
          </div>
        )}

        {activatedTabs.has('activities') && (
          <div hidden={activeTab !== 'activities'}>
            <LookupManager<ActivityDto, CreateActivityInput, UpdateActivityInput>
              active={activeTab === 'activities'}
              hasColor
              listItems={listActivities}
              createItem={createActivity}
              updateItem={updateActivity}
              deleteItem={deleteActivity}
              createSchema={createActivitySchema}
              updateSchema={updateActivitySchema}
              buildCreateInput={(values) => ({
                name: values.name.trim(),
                isActive: values.isActive,
                ...(values.color ? { color: values.color } : {}),
              })}
              buildUpdateInput={(values) => ({
                name: values.name.trim(),
                isActive: values.isActive,
                ...(values.color ? { color: values.color } : {}),
              })}
              copy={ACTIVITY_COPY}
              getDotColor={(item) => item.color ?? 'var(--color-border-subtle)'}
            />
          </div>
        )}
      </div>
    </div>
  );
}
