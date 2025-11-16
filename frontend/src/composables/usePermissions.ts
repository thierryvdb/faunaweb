import { computed } from 'vue';
import { ApiService } from '@/services/api';

/**
 * Composable para verificar permissões do usuário
 * Usa as permissões armazenadas no localStorage do usuário logado
 */
export function usePermissions() {
  // Reactive permissions object
  const permissions = computed(() => ApiService.getUserPermissions());

  // Helper methods
  const canCreate = computed(() => permissions.value.can_create);
  const canRead = computed(() => permissions.value.can_read);
  const canUpdate = computed(() => permissions.value.can_update);
  const canDelete = computed(() => permissions.value.can_delete);
  const canAccessReports = computed(() => permissions.value.can_access_reports);

  // Role checks
  const isAdmin = computed(() => ApiService.isAdmin());
  const isViewer = computed(() => ApiService.isViewer());

  // Check specific permission
  const hasPermission = (permission: 'can_create' | 'can_read' | 'can_update' | 'can_delete' | 'can_access_reports') => {
    return computed(() => permissions.value[permission] === true);
  };

  return {
    permissions,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canAccessReports,
    isAdmin,
    isViewer,
    hasPermission
  };
}
