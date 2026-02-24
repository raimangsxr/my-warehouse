import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { Box, BoxItem, BoxService } from '../services/box.service';
import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-box-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule
  ],
  template: `
    <div class="app-page" *ngIf="box">
      <header class="page-header">
        <div>
          <h1 class="page-title">{{ box.name }}</h1>
          <p class="page-subtitle">Detalle recursivo de contenido y rutas navegables</p>
        </div>
        <button mat-flat-button color="primary" [routerLink]="['/app/items/new']" [queryParams]="{ boxId: box.id }">
          <mat-icon>add</mat-icon>
          Nuevo elemento
        </button>
      </header>

      <mat-card class="surface-card">
        <mat-card-content>
          <div class="inline-actions">
            <span class="inline-chip">Código: {{ box.short_code }}</span>
            <span class="inline-chip">Token QR: {{ box.qr_token }}</span>
          </div>

          <form [formGroup]="searchForm" (ngSubmit)="loadItems()" class="form-row" style="margin-top: 10px">
            <mat-form-field class="grow">
              <mat-label>Buscar dentro de esta caja</mat-label>
              <mat-icon matPrefix>search</mat-icon>
              <input matInput formControlName="q" />
            </mat-form-field>
            <div class="inline-actions">
              <button mat-flat-button color="primary" type="submit">Buscar</button>
              <button mat-stroked-button type="button" (click)="searchForm.reset({ q: '' }); loadItems()">Limpiar</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-card-content>
          <h2 class="card-title">Artículos en subárbol</h2>
          <p class="card-subtitle">Resultados: {{ items.length }}</p>

          <div class="list-grid" *ngIf="items.length > 0; else noItems" style="margin-top: 10px">
            <article class="item-card" *ngFor="let item of items">
              <div class="list-row">
                <mat-icon>inventory</mat-icon>
                <div class="grow">
                  <p class="item-card-title">{{ item.name }}</p>
                  <div class="item-card-meta">
                    <span class="inline-chip">Stock: {{ item.stock }}</span>
                  </div>
                </div>
                <button mat-button type="button" [routerLink]="['/app/items', item.id]">Editar</button>
              </div>

              <div class="status-line">
                <ng-container *ngFor="let segment of item.box_path; let idx = index">
                  <a [routerLink]="['/app/boxes', item.box_path_ids[idx]]">{{ segment }}</a>
                  <span *ngIf="idx < item.box_path.length - 1"> &gt; </span>
                </ng-container>
              </div>
            </article>
          </div>

          <ng-template #noItems>
            <div class="empty-state">No hay artículos para mostrar en esta caja.</div>
          </ng-template>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class BoxDetailComponent implements OnInit {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();

  box: Box | null = null;
  items: BoxItem[] = [];

  readonly searchForm = this.fb.nonNullable.group({
    q: ''
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly boxService: BoxService,
    private readonly warehouseService: WarehouseService
  ) {}

  ngOnInit(): void {
    const boxId = this.route.snapshot.paramMap.get('id');
    if (!this.selectedWarehouseId || !boxId) {
      return;
    }

    this.boxService.get(this.selectedWarehouseId, boxId).subscribe({
      next: (box) => {
        this.box = box;
        this.loadItems();
      }
    });
  }

  loadItems(): void {
    if (!this.selectedWarehouseId || !this.box) {
      return;
    }
    const q = this.searchForm.controls.q.value.trim();
    this.boxService.listRecursiveItems(this.selectedWarehouseId, this.box.id, q).subscribe({
      next: (items) => {
        this.items = items;
      }
    });
  }
}
