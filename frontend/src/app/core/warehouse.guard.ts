import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { WarehouseService } from '../services/warehouse.service';

export const warehouseSelectedGuard: CanActivateFn = async () => {
  const warehouseService = inject(WarehouseService);
  const router = inject(Router);
  const notificationService = inject(NotificationService);

  const selectedId = warehouseService.getSelectedWarehouseId();
  if (!selectedId) {
    return router.parseUrl('/app');
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
  return router.parseUrl('/app');
};

export const warehouseEntryGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const warehouseService = inject(WarehouseService);
  const router = inject(Router);
  const notificationService = inject(NotificationService);

  try {
    const [user, warehouses] = await Promise.all([
      firstValueFrom(authService.me()),
      firstValueFrom(warehouseService.list()),
    ]);
    if (warehouses.length === 0) {
      warehouseService.clearSelectedWarehouseId();
      return router.parseUrl('/app/warehouses');
    }

    const validDefault = warehouses.find((warehouse) => warehouse.id === user.default_warehouse_id);
    if (validDefault) {
      warehouseService.setSelectedWarehouseId(validDefault.id);
      return router.parseUrl('/app/home');
    }

    const fallback = [...warehouses].sort((left, right) => {
      const byDate = (left.membership_created_at ?? left.created_at).localeCompare(
        right.membership_created_at ?? right.created_at
      );
      return byDate || left.id.localeCompare(right.id);
    })[0];
    warehouseService.setSelectedWarehouseId(fallback.id);
    try {
      await firstValueFrom(authService.setDefaultWarehouse(fallback.id));
    } catch {
      notificationService.error('No se pudo guardar el warehouse predeterminado, pero puedes seguir trabajando.');
    }
    if (user.default_warehouse_id) {
      notificationService.info('Tu warehouse predeterminado ya no estaba disponible y se ha actualizado.');
    }
    return router.parseUrl('/app/home');
  } catch {
    const selectedId = warehouseService.getSelectedWarehouseId();
    return router.parseUrl(selectedId ? '/app/home' : '/app/warehouses');
  }
};
