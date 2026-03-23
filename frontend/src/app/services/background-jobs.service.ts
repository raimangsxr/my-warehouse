import { Injectable, Signal, signal } from '@angular/core';

export interface BackgroundJob {
  id: string;
  type: 'reorganization' | string;
  label: string;
  status: 'running' | 'completed' | 'error';
  warehouseId: string;
}

@Injectable({ providedIn: 'root' })
export class BackgroundJobsService {
  private readonly _activeJobs = signal<BackgroundJob[]>([]);

  readonly activeJobs: Signal<BackgroundJob[]> = this._activeJobs.asReadonly();

  registerJob(job: BackgroundJob): void {
    const current = this._activeJobs();
    if (current.some((j) => j.id === job.id)) {
      return;
    }
    this._activeJobs.set([...current, job]);
  }

  unregisterJob(jobId: string): void {
    this._activeJobs.update((jobs) => jobs.filter((j) => j.id !== jobId));
  }

  updateJobStatus(jobId: string, status: BackgroundJob['status']): void {
    this._activeJobs.update((jobs) =>
      jobs.map((j) => (j.id === jobId ? { ...j, status } : j))
    );
  }
}
