import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { NotificationService } from '../services/notification.service';
import { WarehouseService } from '../services/warehouse.service';

export const warehouseSelectedGuard: CanActivateFn = async () => {
  const warehouseService = inject(WarehouseService);
  const router = inject(Router);
  const notificationService = inject(NotificationService);

  const selectedId = warehouseService.getSelectedWarehouseId();
  if (!selectedId) {
    return router.parseUrl('/warehouses');
  }

  try {
    const warehouses = await firstValueFrom(warehouseService.list());
    const stillExists = warehouses.some((warehouse) => warehouse.id === selectedId);
    if (stillExists) {
      return true;
    }
  } catch {
    return true;
  }

  warehouseService.clearSelectedWarehouseId();
  notificationService.error('Este almacén ya no está disponible.');
  return router.parseUrl('/warehouses');
};
