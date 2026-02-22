import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';

import { ActivityEvent, WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatListModule],
  template: `
    <div class="page-wide">
      <mat-card>
        <mat-card-title>Actividad</mat-card-title>
        <mat-card-content>
          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
          <mat-list>
            <mat-list-item *ngFor="let event of events">
              <div class="grow">
                <strong>{{ event.event_type }}</strong>
                <div class="muted">
                  {{ event.created_at | date:'short' }} | actor: {{ event.actor_user_id }}
                </div>
              </div>
            </mat-list-item>
          </mat-list>
          <div class="muted" *ngIf="events.length === 0">Sin actividad reciente.</div>
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
