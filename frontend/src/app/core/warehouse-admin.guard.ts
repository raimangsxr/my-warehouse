import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { NotificationService } from '../services/notification.service';
import { WarehouseService } from '../services/warehouse.service';

export const warehouseAdministratorGuard: CanActivateFn = async () => {
  const warehouseService = inject(WarehouseService);
  const router = inject(Router);
  const notificationService = inject(NotificationService);
  const selectedId = warehouseService.getSelectedWarehouseId();

  if (!selectedId) {
    return router.parseUrl('/app/warehouses');
  }

  try {
    const warehouses = await firstValueFrom(warehouseService.list());
    const selected = warehouses.find((warehouse) => warehouse.id === selectedId);
    if (selected?.role === 'administrator') {
      return true;
    }
  } catch {
    if (warehouseService.isSelectedWarehouseAdministrator()) {
      return true;
    }
  }

  notificationService.error('Necesitas el rol Administrador para acceder a esta sección.');
  return router.parseUrl('/app/home');
};
