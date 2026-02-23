import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { ActivityEvent, WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Actividad</h1>
          <p class="page-subtitle">Eventos recientes del warehouse actual</p>
        </div>
      </header>

      <mat-card class="surface-card">
        <mat-card-content>
          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>

          <div class="list-grid" *ngIf="events.length > 0; else noActivity">
            <article class="item-card" *ngFor="let event of events">
              <div class="list-row">
                <mat-icon>history</mat-icon>
                <div class="grow">
                  <p class="item-card-title">{{ event.event_type }}</p>
                  <div class="item-card-meta">
                    <span>{{ event.created_at | date:'short' }}</span>
                    <span>actor: {{ event.actor_user_id }}</span>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <ng-template #noActivity>
            <div class="empty-state">Sin actividad reciente.</div>
          </ng-template>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class ActivityComponent implements OnInit {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();

  errorMessage = '';
  events: ActivityEvent[] = [];

  constructor(private readonly warehouseService: WarehouseService) {}

  ngOnInit(): void {
    if (!this.selectedWarehouseId) {
      this.errorMessage = 'Selecciona un warehouse.';
      return;
    }

    this.warehouseService.activity(this.selectedWarehouseId).subscribe({
      next: (events) => {
        this.events = events;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar la actividad.';
      }
    });
  }
}
