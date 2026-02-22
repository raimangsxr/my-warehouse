import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';

import { BoxService, BoxTreeNode } from '../services/box.service';
import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-boxes',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatListModule
  ],
  template: `
    <div class="page-wide">
      <mat-card>
        <mat-card-title>Árbol de cajas</mat-card-title>
        <mat-card-content>
          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
          <form [formGroup]="createForm" (ngSubmit)="createBox()" class="row gap" style="margin-bottom: 16px">
            <mat-form-field class="grow">
              <mat-label>Nombre de caja (opcional)</mat-label>
              <input matInput formControlName="name" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Caja padre</mat-label>
              <mat-select formControlName="parentBoxId">
                <mat-option [value]="null">Raíz</mat-option>
                <mat-option *ngFor="let node of tree" [value]="node.box.id">{{ node.box.name }}</mat-option>
              </mat-select>
            </mat-form-field>
            <button mat-flat-button color="primary" [disabled]="loading">Crear</button>
          </form>

          <mat-list>
            <mat-list-item *ngFor="let node of tree" [style.paddingLeft.px]="node.level * 24 + 8">
              <div class="grow row gap center-y">
                <strong>{{ node.box.name }}</strong>
                <span class="muted">Items: {{ node.total_items_recursive }}</span>
                <span class="muted">Subcajas: {{ node.total_boxes_recursive }}</span>
                <span class="muted">{{ node.box.short_code }}</span>
              </div>
              <button mat-button [routerLink]="['/app/boxes', node.box.id]">Ver</button>
              <button mat-button (click)="promptRename(node.box.id, node.box.name)">Renombrar</button>
              <button mat-button (click)="promptMove(node.box.id)">Mover</button>
              <button mat-button color="warn" (click)="deleteBox(node.box.id)">Papelera</button>
            </mat-list-item>
          </mat-list>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class BoxesComponent implements OnInit {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();

  loading = false;
  errorMessage = '';
  tree: BoxTreeNode[] = [];

  readonly createForm = this.fb.group({
    name: ['', [Validators.maxLength(120)]],
    parentBoxId: [null as string | null]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly boxService: BoxService,
    private readonly warehouseService: WarehouseService
  ) {}

  ngOnInit(): void {
    this.loadTree();
  }

  createBox(): void {
    if (!this.selectedWarehouseId || this.loading) {
      return;
    }
    this.loading = true;

    const raw = this.createForm.getRawValue();
    this.boxService
      .create(this.selectedWarehouseId, {
        name: raw.name?.trim() || null,
        parent_box_id: raw.parentBoxId
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.createForm.reset({ name: '', parentBoxId: null });
          this.loadTree();
        },
        error: () => {
          this.loading = false;
          this.errorMessage = 'No se pudo crear la caja.';
        }
      });
  }

  promptRename(boxId: string, currentName: string): void {
    if (!this.selectedWarehouseId) {
      return;
    }
    const name = prompt('Nuevo nombre de caja', currentName);
    if (!name || !name.trim()) {
      return;
    }

    this.boxService.update(this.selectedWarehouseId, boxId, { name: name.trim() }).subscribe({
      next: () => this.loadTree(),
      error: () => {
        this.errorMessage = 'No se pudo actualizar la caja.';
      }
    });
  }

  promptMove(boxId: string): void {
    if (!this.selectedWarehouseId) {
      return;
    }
    const parentRaw = prompt('Nuevo parent_box_id (vacío para raíz)');
    const newParent = parentRaw && parentRaw.trim() ? parentRaw.trim() : null;

    this.boxService.move(this.selectedWarehouseId, boxId, newParent).subscribe({
      next: () => this.loadTree(),
      error: () => {
        this.errorMessage = 'No se pudo mover la caja. Verifica que no se cree un ciclo.';
      }
    });
  }

  deleteBox(boxId: string): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    this.boxService.delete(this.selectedWarehouseId, boxId, false).subscribe({
      next: () => this.loadTree(),
      error: () => {
        if (confirm('La caja tiene contenido. ¿Borrar de forma recursiva (force)?')) {
          this.boxService.delete(this.selectedWarehouseId!, boxId, true).subscribe({
            next: () => this.loadTree(),
            error: () => {
              this.errorMessage = 'No se pudo enviar la caja a papelera.';
            }
          });
        }
      }
    });
  }

  private loadTree(): void {
    if (!this.selectedWarehouseId) {
      this.errorMessage = 'Selecciona un warehouse.';
      return;
    }

    this.boxService.tree(this.selectedWarehouseId).subscribe({
      next: (nodes) => {
        this.tree = nodes;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar el árbol de cajas.';
      }
    });
  }
}
