import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { BackgroundJob, BackgroundJobsService } from '../services/background-jobs.service';

@Component({
  selector: 'app-background-jobs-indicator',
  standalone: true,
  imports: [
    CommonModule,
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  styles: [`
    .jobs-panel {
      min-width: 280px;
      max-width: 360px;
    }
    .jobs-panel-header {
      padding: 12px 16px 8px;
      font-size: 13px;
      font-weight: 500;
      color: var(--mat-sys-on-surface-variant, #666);
    }
    .job-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
    }
    .job-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }
    .job-icon.running { color: var(--mat-sys-primary, #1976d2); }
    .job-icon.completed { color: var(--mat-sys-tertiary, #388e3c); }
    .job-icon.error { color: var(--mat-sys-error, #d32f2f); }
    .job-label {
      flex: 1;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .job-status-text {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant, #666);
      flex-shrink: 0;
    }
    .spin {
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .no-jobs {
      padding: 12px 16px;
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant, #666);
    }
  `],
  template: `
    <button
      mat-icon-button
      [matMenuTriggerFor]="jobsMenu"
      [matTooltip]="tooltip()"
      aria-label="Operaciones en progreso"
      type="button"
    >
      <mat-icon
        [matBadge]="badgeCount()"
        [matBadgeHidden]="badgeCount() === 0"
        matBadgeColor="warn"
        matBadgeSize="small"
      >pending_actions</mat-icon>
    </button>

    <mat-menu #jobsMenu="matMenu" class="jobs-panel">
      <div class="jobs-panel-header" (click)="$event.stopPropagation()">
        Operaciones en progreso
      </div>
      @if (jobs().length === 0) {
        <div class="no-jobs" (click)="$event.stopPropagation()">
          No hay operaciones activas.
        </div>
      } @else {
        @for (job of jobs(); track job.id) {
          <div class="job-item" (click)="$event.stopPropagation()">
            <mat-icon class="job-icon" [class]="job.status" [class.spin]="job.status === 'running'">
              {{ iconFor(job) }}
            </mat-icon>
            <span class="job-label" [matTooltip]="job.label">{{ job.label }}</span>
            <span class="job-status-text">{{ labelFor(job) }}</span>
          </div>
        }
      }
    </mat-menu>
  `,
})
export class BackgroundJobsIndicatorComponent {
  private readonly bgJobs = inject(BackgroundJobsService);

  readonly jobs = this.bgJobs.activeJobs;

  badgeCount(): number {
    return this.jobs().filter((j) => j.status === 'running').length;
  }

  tooltip(): string {
    const running = this.badgeCount();
    if (running === 0) return 'Sin operaciones activas';
    return running === 1 ? '1 operación en progreso' : `${running} operaciones en progreso`;
  }

  iconFor(job: BackgroundJob): string {
    switch (job.status) {
      case 'running': return 'sync';
      case 'completed': return 'check_circle';
      case 'error': return 'error';
    }
  }

  labelFor(job: BackgroundJob): string {
    switch (job.status) {
      case 'running': return 'En progreso';
      case 'completed': return 'Completado';
      case 'error': return 'Error';
    }
  }
}
