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

interface BoxTreeViewNode extends BoxTreeNode {
  path_label: string;
  children: BoxTreeViewNode[];
}

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
    MatProgressBarModule,
  ],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Árbol de cajas</h1>
          <p class="page-subtitle">Jerarquía anidada con edición rápida y acceso por QR</p>
        </div>
      </header>

      <mat-card class="surface-card compact-card">
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
                <mat-option *ngFor="let node of treeOptions" [value]="node.box.id">
                  <span class="tree-option-label">
                    <span class="tree-option-level">N{{ node.level }}</span>
                    {{ node.path_label }}
                  </span>
                </mat-option>
              </mat-select>
            </mat-form-field>

            <div class="inline-actions">
              <button mat-flat-button color="primary" [disabled]="loading">Crear caja</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="surface-card compact-card">
        <mat-progress-bar *ngIf="loading" mode="indeterminate" />
        <mat-card-content>
          <div class="card-header-row">
            <div>
              <h2 class="card-title">Listado jerárquico</h2>
              <p class="card-subtitle">{{ treeOptions.length }} nodos cargados</p>
            </div>
          </div>

          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>

          <div class="box-tree-shell" *ngIf="treeRoots.length > 0; else noBoxes">
            <ul class="box-tree-branch root-branch">
              <ng-container *ngFor="let node of treeRoots; let last = last">
                <ng-container
                  *ngTemplateOutlet="treeNodeTemplate; context: { $implicit: node, depth: 0, last: last }"
                ></ng-container>
              </ng-container>
            </ul>
          </div>

          <ng-template #treeNodeTemplate let-node let-depth="depth" let-last="last">
            <li class="box-tree-node" [class.root-node]="depth === 0" [class.last-node]="last">
              <div class="box-tree-row">
                <div class="box-tree-leading">
                  <button
                    *ngIf="node.children.length > 0; else leafSpacer"
                    mat-icon-button
                    type="button"
                    class="box-toggle"
                    (click)="toggleExpanded(node.box.id)"
                    [attr.aria-label]="'Mostrar hijos de ' + node.box.name"
                  >
                    <mat-icon>{{ isExpanded(node.box.id) ? 'expand_more' : 'chevron_right' }}</mat-icon>
                  </button>
                  <ng-template #leafSpacer>
                    <span class="box-toggle-spacer"></span>
                  </ng-template>

                  <span class="box-level-pill">N{{ node.level }}</span>
                  <mat-icon class="box-node-icon">inventory_2</mat-icon>
                </div>

                <div class="box-tree-content">
                  <div class="box-tree-header">
                    <p class="item-card-title">{{ node.box.name }}</p>
                    <div class="inline-actions box-tree-actions">
                      <button mat-button type="button" [routerLink]="['/app/boxes', node.box.id]">Ver</button>
                      <button mat-button type="button" (click)="startRename(node)">Renombrar</button>
                      <button mat-button type="button" (click)="startMove(node)">Mover</button>
                      <button mat-button color="warn" type="button" (click)="deleteBox(node.box.id)">Papelera</button>
                    </div>
                  </div>

                  <div class="item-card-meta box-tree-meta">
                    <span class="inline-chip">Ruta: {{ node.path_label }}</span>
                    <span>Items: {{ node.total_items_recursive }}</span>
                    <span>Subcajas: {{ node.total_boxes_recursive }}</span>
                    <span>Código: {{ node.box.short_code }}</span>
                  </div>
                </div>
              </div>

              <div class="form-row box-tree-inline-form" *ngIf="renameBoxId === node.box.id">
                <mat-form-field class="grow">
                  <mat-label>Nuevo nombre</mat-label>
                  <input matInput [(ngModel)]="renameValue" [ngModelOptions]="{ standalone: true }" />
                </mat-form-field>
                <div class="inline-actions">
                  <button mat-stroked-button color="primary" type="button" (click)="saveRename(node.box.id)">Guardar</button>
                  <button mat-button type="button" (click)="cancelRename()">Cancelar</button>
                </div>
              </div>

              <div class="form-row box-tree-inline-form" *ngIf="moveBoxId === node.box.id">
                <mat-form-field class="grow">
                  <mat-label>Nueva caja padre</mat-label>
                  <mat-select [(ngModel)]="moveParentBoxId" [ngModelOptions]="{ standalone: true }">
                    <mat-option [value]="null">Raíz</mat-option>
                    <mat-option
                      *ngFor="let candidate of treeOptions"
                      [value]="candidate.box.id"
                      [disabled]="isMoveCandidateDisabled(node, candidate)"
                    >
                      <span class="tree-option-label">
                        <span class="tree-option-level">N{{ candidate.level }}</span>
                        {{ candidate.path_label }}
                      </span>
                    </mat-option>
                  </mat-select>
                </mat-form-field>
                <div class="inline-actions">
                  <button mat-stroked-button color="primary" type="button" (click)="saveMove(node.box.id)">Aplicar</button>
                  <button mat-button type="button" (click)="cancelMove()">Cancelar</button>
                </div>
              </div>

              <ul class="box-tree-branch" *ngIf="node.children.length > 0 && isExpanded(node.box.id)">
                <ng-container *ngFor="let child of node.children; let childLast = last">
                  <ng-container
                    *ngTemplateOutlet="treeNodeTemplate; context: { $implicit: child, depth: depth + 1, last: childLast }"
                  ></ng-container>
                </ng-container>
              </ul>
            </li>
          </ng-template>

          <ng-template #noBoxes>
            <div class="empty-state">No hay cajas todavía. Crea la primera para comenzar.</div>
          </ng-template>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class BoxesComponent implements OnInit {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();

  loading = false;
  errorMessage = '';
  treeOptions: BoxTreeViewNode[] = [];
  treeRoots: BoxTreeViewNode[] = [];

  renameBoxId: string | null = null;
  renameValue = '';
  moveBoxId: string | null = null;
  moveParentBoxId: string | null = null;

  private readonly expandedBoxIds = new Set<string>();
  private parentById = new Map<string, string | null>();

  readonly createForm = this.fb.group({
    name: ['', [Validators.maxLength(120)]],
    parentBoxId: [null as string | null],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly boxService: BoxService,
    private readonly warehouseService: WarehouseService,
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
        parent_box_id: raw.parentBoxId,
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
        },
      });
  }

  toggleExpanded(boxId: string): void {
    if (this.expandedBoxIds.has(boxId)) {
      this.expandedBoxIds.delete(boxId);
      return;
    }
    this.expandedBoxIds.add(boxId);
  }

  isExpanded(boxId: string): boolean {
    return this.expandedBoxIds.has(boxId);
  }

  startRename(node: BoxTreeViewNode): void {
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
      },
    });
  }

  startMove(node: BoxTreeViewNode): void {
    this.moveBoxId = node.box.id;
    this.moveParentBoxId = node.box.parent_box_id;
    this.renameBoxId = null;
  }

  cancelMove(): void {
    this.moveBoxId = null;
    this.moveParentBoxId = null;
  }

  isMoveCandidateDisabled(node: BoxTreeViewNode, candidate: BoxTreeViewNode): boolean {
    if (candidate.box.id === node.box.id) {
      return true;
    }
    return this.isDescendant(candidate.box.id, node.box.id);
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
      },
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
            },
          });
        }
      },
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
        const nextFlat = this.toViewNodes(nodes);
        this.treeOptions = nextFlat;
        this.parentById = new Map(nextFlat.map((node) => [node.box.id, node.box.parent_box_id]));
        this.treeRoots = this.toHierarchy(nextFlat);
        this.syncExpansion(nextFlat);
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo cargar el árbol de cajas.';
      },
    });
  }

  private toViewNodes(nodes: BoxTreeNode[]): BoxTreeViewNode[] {
    const pathByLevel: string[] = [];
    return nodes.map((node) => {
      pathByLevel[node.level] = node.box.name;
      pathByLevel.length = node.level + 1;
      return {
        ...node,
        path_label: pathByLevel.join(' > '),
        children: [],
      };
    });
  }

  private toHierarchy(flatNodes: BoxTreeViewNode[]): BoxTreeViewNode[] {
    const byId = new Map<string, BoxTreeViewNode>();
    flatNodes.forEach((node) => {
      node.children = [];
      byId.set(node.box.id, node);
    });

    const roots: BoxTreeViewNode[] = [];
    flatNodes.forEach((node) => {
      const parentId = node.box.parent_box_id;
      if (!parentId) {
        roots.push(node);
        return;
      }

      const parent = byId.get(parentId);
      if (!parent) {
        roots.push(node);
        return;
      }
      parent.children.push(node);
    });

    return roots;
  }

  private syncExpansion(flatNodes: BoxTreeViewNode[]): void {
    const expandableIds = new Set(flatNodes.filter((node) => node.children.length > 0).map((node) => node.box.id));

    for (const id of [...this.expandedBoxIds]) {
      if (!expandableIds.has(id)) {
        this.expandedBoxIds.delete(id);
      }
    }

    if (this.expandedBoxIds.size === 0) {
      flatNodes.forEach((node) => {
        if (node.children.length > 0 && node.level <= 1) {
          this.expandedBoxIds.add(node.box.id);
        }
      });
    }
  }

  private isDescendant(candidateId: string, ancestorId: string): boolean {
    let parentId = this.parentById.get(candidateId) || null;
    while (parentId) {
      if (parentId === ancestorId) {
        return true;
      }
      parentId = this.parentById.get(parentId) || null;
    }
    return false;
  }
}
