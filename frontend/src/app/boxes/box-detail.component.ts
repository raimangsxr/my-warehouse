import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';

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
    MatListModule
  ],
  template: `
    <div class="page-wide" *ngIf="box">
      <mat-card>
        <mat-card-title>{{ box.name }}</mat-card-title>
        <mat-card-subtitle>QR: {{ box.short_code }} | token: {{ box.qr_token }}</mat-card-subtitle>
        <mat-card-content>
          <form [formGroup]="searchForm" (ngSubmit)="loadItems()" class="row gap">
            <mat-form-field class="grow">
              <mat-label>Buscar en esta caja</mat-label>
              <input matInput formControlName="q" />
            </mat-form-field>
            <button mat-flat-button color="primary">Buscar</button>
            <button mat-stroked-button type="button" [routerLink]="['/app/items/new']" [queryParams]="{ boxId: box.id }">
              Nuevo artículo
            </button>
          </form>

          <mat-list>
            <mat-list-item *ngFor="let item of items">
              <div class="grow">
                <div class="row gap center-y">
                  <strong>{{ item.name }}</strong>
                  <span class="muted">Stock: {{ item.stock }}</span>
                </div>
                <div class="muted">{{ item.box_path.join(' > ') }}</div>
              </div>
              <button mat-button [routerLink]="['/app/items', item.id]">Editar</button>
            </mat-list-item>
          </mat-list>

          <div *ngIf="items.length === 0" class="muted" style="margin-top: 8px">No hay artículos para mostrar.</div>
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
