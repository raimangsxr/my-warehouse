import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { Observable } from 'rxjs';

import { Box, BoxService, BoxTreeNode } from '../services/box.service';
import { Item, ItemService } from '../services/item.service';
import { WarehouseService } from '../services/warehouse.service';

type CreateEntityType = 'item' | 'box';

@Component({
  selector: 'app-item-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule
  ],
  template: `
    <div class="app-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">{{ pageTitle }}</h1>
          <p class="page-subtitle">{{ pageSubtitle }}</p>
        </div>
      </header>

      <mat-card class="surface-card">
        <mat-progress-bar *ngIf="loading" mode="indeterminate" />
        <mat-card-content>
          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>

          <form [formGroup]="form" (ngSubmit)="save()" class="form-stack">
            <div class="inline-actions" *ngIf="!itemId">
              <mat-button-toggle-group
                [value]="createEntityType"
                (change)="setCreateEntityType($event.value)"
                aria-label="Tipo de elemento"
              >
                <mat-button-toggle value="item">Artículo</mat-button-toggle>
                <mat-button-toggle value="box">Caja</mat-button-toggle>
              </mat-button-toggle-group>
            </div>

            <div class="form-row">
              <mat-form-field class="grow">
                <mat-label>Nombre</mat-label>
                <mat-icon matPrefix>inventory</mat-icon>
                <input matInput formControlName="name" />
              </mat-form-field>

              <mat-form-field>
                <mat-label>{{ createEntityType === 'box' && !itemId ? 'Caja padre' : 'Caja' }}</mat-label>
                <mat-select formControlName="boxId">
                  <mat-option *ngIf="createEntityType === 'box' && !itemId" [value]="null">Raíz</mat-option>
                  <mat-option *ngFor="let node of boxes" [value]="node.box.id">
                    <span class="tree-option-label">
                      <span class="tree-option-level">N{{ node.level }}</span>
                      {{ boxPathLabel(node) }}
                    </span>
                  </mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <mat-form-field class="full-width">
              <mat-label>{{ createEntityType === 'box' && !itemId ? 'Descripción de la caja' : 'Descripción' }}</mat-label>
              <textarea matInput rows="3" formControlName="description"></textarea>
            </mat-form-field>

            <div class="form-row">
              <mat-form-field>
                <mat-label>Ubicación física</mat-label>
                <input matInput formControlName="physicalLocation" />
              </mat-form-field>

              <mat-form-field *ngIf="createEntityType === 'item' || itemId">
                <mat-label>URL foto</mat-label>
                <input matInput formControlName="photoUrl" />
              </mat-form-field>
            </div>

            <div class="form-row" *ngIf="createEntityType === 'item' || itemId">
              <mat-form-field>
                <mat-label>Tags (coma separada)</mat-label>
                <input matInput formControlName="tags" />
              </mat-form-field>

              <mat-form-field>
                <mat-label>Aliases (coma separada)</mat-label>
                <input matInput formControlName="aliases" />
              </mat-form-field>
            </div>

            <div class="inline-actions">
              <button mat-flat-button color="primary" [disabled]="loading || form.invalid">
                {{ loading ? 'Guardando...' : primaryActionLabel }}
              </button>
              <button mat-stroked-button type="button" [routerLink]="['/app/home']">Volver</button>
              <button mat-button color="warn" type="button" *ngIf="itemId" (click)="remove()">Borrar</button>
              <button mat-button type="button" *ngIf="itemId" (click)="restore()">Restaurar</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class ItemFormComponent implements OnInit {
  readonly selectedWarehouseId = this.warehouseService.getSelectedWarehouseId();
  itemId: string | null = null;
  createEntityType: CreateEntityType = 'item';
  loading = false;
  errorMessage = '';
  boxes: BoxTreeNode[] = [];
  private readonly boxPathById = new Map<string, string>();

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    boxId: [null as string | null, [Validators.required]],
    description: [''],
    physicalLocation: [''],
    photoUrl: [''],
    tags: [''],
    aliases: ['']
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly boxService: BoxService,
    private readonly itemService: ItemService,
    private readonly warehouseService: WarehouseService
  ) {}

  ngOnInit(): void {
    if (!this.selectedWarehouseId) {
      this.router.navigateByUrl('/warehouses');
      return;
    }

    this.itemId = this.route.snapshot.paramMap.get('id');

    if (!this.itemId) {
      const requestedType = this.route.snapshot.queryParamMap.get('type');
      if (requestedType === 'box' || requestedType === 'item') {
        this.createEntityType = requestedType;
      }
    }

    this.updateValidatorsByType();
    this.loadBoxes();

    const queryBoxId = this.route.snapshot.queryParamMap.get('boxId');
    if (queryBoxId) {
      this.form.controls.boxId.setValue(queryBoxId);
    }

    if (this.itemId) {
      this.itemService.get(this.selectedWarehouseId, this.itemId).subscribe({
        next: (item) => {
          this.form.patchValue({
            name: item.name,
            boxId: item.box_id,
            description: item.description || '',
            physicalLocation: item.physical_location || '',
            photoUrl: item.photo_url || '',
            tags: item.tags.join(', '),
            aliases: item.aliases.join(', ')
          });
          this.createEntityType = 'item';
          this.updateValidatorsByType();
        },
        error: () => {
          this.errorMessage = 'No se pudo cargar el artículo.';
        }
      });
    }
  }

  save(): void {
    if (!this.selectedWarehouseId || this.form.invalid || this.loading) {
      return;
    }

    this.loading = true;
    const raw = this.form.getRawValue();
    const itemPayload = {
      box_id: raw.boxId || '',
      name: raw.name?.trim() || '',
      description: raw.description || null,
      physical_location: raw.physicalLocation || null,
      photo_url: raw.photoUrl || null,
      tags: splitCsv(raw.tags),
      aliases: splitCsv(raw.aliases)
    };

    let request$: Observable<Item | Box>;
    if (this.itemId) {
      request$ = this.itemService.update(this.selectedWarehouseId, this.itemId, itemPayload);
    } else if (this.createEntityType === 'box') {
      request$ = this.boxService.create(this.selectedWarehouseId, {
        parent_box_id: raw.boxId || null,
        name: raw.name?.trim() || null,
        description: raw.description || null,
        physical_location: raw.physicalLocation || null
      });
    } else {
      request$ = this.itemService.create(this.selectedWarehouseId, itemPayload);
    }

    request$.subscribe({
      next: (result: Item | Box) => {
        this.loading = false;
        if (this.createEntityType === 'box' && !this.itemId && result && 'id' in result) {
          this.router.navigateByUrl(`/app/boxes/${result.id}`);
          return;
        }
        this.router.navigateByUrl('/app/home');
      },
      error: () => {
        this.loading = false;
        this.errorMessage =
          this.createEntityType === 'box' && !this.itemId
            ? 'No se pudo crear la caja.'
            : 'No se pudo guardar el artículo.';
      }
    });
  }

  remove(): void {
    if (!this.selectedWarehouseId || !this.itemId || !confirm('¿Enviar artículo a papelera?')) {
      return;
    }

    this.itemService.delete(this.selectedWarehouseId, this.itemId).subscribe({
      next: () => {
        this.router.navigateByUrl('/app/home');
      },
      error: () => {
        this.errorMessage = 'No se pudo borrar el artículo.';
      }
    });
  }

  restore(): void {
    if (!this.selectedWarehouseId || !this.itemId) {
      return;
    }

    this.itemService.restore(this.selectedWarehouseId, this.itemId).subscribe({
      next: () => {
        this.errorMessage = '';
      },
      error: () => {
        this.errorMessage = 'No se pudo restaurar el artículo.';
      }
    });
  }

  private loadBoxes(): void {
    if (!this.selectedWarehouseId) {
      return;
    }

    this.boxService.tree(this.selectedWarehouseId).subscribe({
      next: (nodes) => {
        this.boxes = nodes;
        this.boxPathById.clear();
        const pathByLevel: string[] = [];
        nodes.forEach((node) => {
          pathByLevel[node.level] = node.box.name;
          pathByLevel.length = node.level + 1;
          this.boxPathById.set(node.box.id, pathByLevel.join(' > '));
        });
        if (!this.form.controls.boxId.value && nodes.length > 0 && (this.itemId || this.createEntityType === 'item')) {
          this.form.controls.boxId.setValue(nodes[0].box.id);
        }
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar las cajas.';
      }
    });
  }

  setCreateEntityType(type: CreateEntityType): void {
    if (this.itemId || this.createEntityType === type) {
      return;
    }

    this.createEntityType = type;
    this.errorMessage = '';
    this.updateValidatorsByType();

    if (type === 'box') {
      this.form.patchValue({
        photoUrl: '',
        tags: '',
        aliases: ''
      });
      if (!this.route.snapshot.queryParamMap.get('boxId')) {
        this.form.controls.boxId.setValue(null);
      }
      return;
    }

    if (!this.form.controls.boxId.value && this.boxes.length > 0) {
      this.form.controls.boxId.setValue(this.boxes[0].box.id);
    }
  }

  boxPathLabel(node: BoxTreeNode): string {
    return this.boxPathById.get(node.box.id) || node.box.name;
  }

  get pageTitle(): string {
    if (this.itemId) {
      return 'Editar artículo';
    }
    return this.createEntityType === 'box' ? 'Nueva caja' : 'Nuevo artículo';
  }

  get pageSubtitle(): string {
    if (this.itemId) {
      return 'Actualiza metadatos, ubicación y señales de búsqueda';
    }
    return this.createEntityType === 'box'
      ? 'Crea una caja raíz o subcaja y ubícala en la jerarquía'
      : 'Completa metadatos, ubicación y señales de búsqueda';
  }

  get primaryActionLabel(): string {
    if (this.itemId) {
      return 'Guardar';
    }
    return this.createEntityType === 'box' ? 'Crear caja' : 'Crear artículo';
  }

  private updateValidatorsByType(): void {
    if (this.itemId || this.createEntityType === 'item') {
      this.form.controls.boxId.setValidators([Validators.required]);
    } else {
      this.form.controls.boxId.clearValidators();
    }
    this.form.controls.boxId.updateValueAndValidity({ emitEvent: false });
  }
}

function splitCsv(raw: string | null | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => !!part);
}
