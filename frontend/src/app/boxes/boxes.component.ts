import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';

import { BoxService, BoxTreeNode } from '../services/box.service';
import { WarehouseService } from '../services/warehouse.service';

@Component({
  selector: 'app-boxes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule
  ],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Árbol de cajas</h1>
          <p class="page-subtitle">Estructura jerárquica con edición rápida y acceso por QR</p>
        </div>
      </header>

      <mat-card class="surface-card">
        <mat-card-content>
          <h2 class="card-title">Nueva caja</h2>
          <p class="card-subtitle">Crea cajas raíz o subcajas dentro del árbol</p>

          <form [formGroup]="createForm" (ngSubmit)="createBox()" class="form-row" style="margin-top: 8px">
            <mat-form-field class="grow">
              <mat-label>Nombre de caja (opcional)</mat-label>
              <mat-icon matPrefix>inventory_2</mat-icon>
              <input matInput formControlName="name" />
            </mat-form-field>

            <mat-form-field>
              <mat-label>Caja padre</mat-label>
              <mat-select formControlName="parentBoxId">
                <mat-option [value]="null">Raíz</mat-option>
                <mat-option *ngFor="let node of tree" [value]="node.box.id">{{ node.box.name }}</mat-option>
              </mat-select>
            </mat-form-field>

            <div class="inline-actions">
              <button mat-flat-button color="primary" [disabled]="loading">Crear caja</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card">
        <mat-progress-bar *ngIf="loading" mode="indeterminate" />
        <mat-card-content>
          <div class="card-header-row">
            <div>
              <h2 class="card-title">Listado jerárquico</h2>
              <p class="card-subtitle">{{ tree.length }} nodos cargados</p>
            </div>
          </div>

          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>

          <div class="list-grid" *ngIf="tree.length > 0; else noBoxes">
            <article class="item-card box-node-card" *ngFor="let node of tree" [style.marginLeft.px]="node.level * 10">
              <div class="list-row">
                <mat-icon>inventory_2</mat-icon>
                <div class="grow">
                  <p class="item-card-title">{{ node.box.name }}</p>
                  <div class="item-card-meta">
                    <span>Items: {{ node.total_items_recursive }}</span>
                    <span>Subcajas: {{ node.total_boxes_recursive }}</span>
                    <span>Código: {{ node.box.short_code }}</span>
                  </div>
                </div>
                <div class="inline-actions">
                  <button mat-button type="button" [routerLink]="['/app/boxes', node.box.id]">Ver</button>
                  <button mat-button type="button" (click)="startRename(node)">Renombrar</button>
                  <button mat-button type="button" (click)="startMove(node)">Mover</button>
                  <button mat-button color="warn" type="button" (click)="deleteBox(node.box.id)">Papelera</button>
                </div>
              </div>

              <div class="form-row" *ngIf="renameBoxId === node.box.id">
                <mat-form-field class="grow">
                  <mat-label>Nuevo nombre</mat-label>
                  <input matInput [(ngModel)]="renameValue" [ngModelOptions]="{standalone: true}" />
                </mat-form-field>
                <div class="inline-actions">
                  <button mat-stroked-button color="primary" type="button" (click)="saveRename(node.box.id)">Guardar</button>
                  <button mat-button type="button" (click)="cancelRename()">Cancelar</button>
                </div>
              </div>

              <div class="form-row" *ngIf="moveBoxId === node.box.id">
                <mat-form-field class="grow">
                  <mat-label>Nueva caja padre</mat-label>
                  <mat-select [(ngModel)]="moveParentBoxId" [ngModelOptions]="{standalone: true}">
                    <mat-option [value]="null">Raíz</mat-option>
                    <mat-option
                      *ngFor="let candidate of tree"
                      [value]="candidate.box.id"
                      [disabled]="candidate.box.id === node.box.id"
                    >
                      {{ candidate.box.name }}
                    </mat-option>
                  </mat-select>
                </mat-form-field>
                <div class="inline-actions">
                  <button mat-stroked-button color="primary" type="button" (click)="saveMove(node.box.id)">Aplicar</button>
                  <button mat-button type="button" (click)="cancelMove()">Cancelar</button>
                </div>
              </div>
            </article>
          </div>

          <ng-template #noBoxes>
            <div class="empty-state">No hay cajas todavía. Crea la primera para comenzar.</div>
          </ng-template>
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

  renameBoxId: string | null = null;
  renameValue = '';
  moveBoxId: string | null = null;
  moveParentBoxId: string | null = null;

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

  startRename(node: BoxTreeNode): void {
    this.renameBoxId = node.box.id;
    this.renameValue = node.box.name;
    this.moveBoxId = null;
  }

  cancelRename(): void {
    this.renameBoxId = null;
    this.renameValue = '';
  }

  saveRename(boxId: string): void {
    if (!this.selectedWarehouseId || !this.renameValue.trim()) {
      return;
    }

    this.boxService.update(this.selectedWarehouseId, boxId, { name: this.renameValue.trim() }).subscribe({
      next: () => {
        this.cancelRename();
        this.loadTree();
      },
      error: () => {
        this.errorMessage = 'No se pudo actualizar la caja.';
      }
    });
  }

  startMove(node: BoxTreeNode): void {
    this.moveBoxId = node.box.id;
    this.moveParentBoxId = node.box.parent_box_id;
    this.renameBoxId = null;
  }

  cancelMove(): void {
    this.moveBoxId = null;
    this.moveParentBoxId = null;
  }

  saveMove(boxId: string): void {
    if (!this.selectedWarehouseId || this.moveBoxId !== boxId) {
      return;
    }

    this.boxService.move(this.selectedWarehouseId, boxId, this.moveParentBoxId).subscribe({
      next: () => {
        this.cancelMove();
        this.loadTree();
      },
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

    this.loading = true;
    this.boxService.tree(this.selectedWarehouseId).subscribe({
      next: (nodes) => {
        this.loading = false;
        this.tree = nodes;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo cargar el árbol de cajas.';
      }
    });
  }
}
