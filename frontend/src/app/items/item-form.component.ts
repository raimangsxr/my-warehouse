import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { BoxService, BoxTreeNode } from '../services/box.service';
import { ItemService } from '../services/item.service';
import { WarehouseService } from '../services/warehouse.service';

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
    MatButtonModule
  ],
  template: `
    <div class="page">
      <mat-card>
        <mat-card-title>{{ itemId ? 'Editar artículo' : 'Nuevo artículo' }}</mat-card-title>
        <mat-card-content>
          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
          <form [formGroup]="form" (ngSubmit)="save()">
            <mat-form-field class="full-width">
              <mat-label>Nombre</mat-label>
              <input matInput formControlName="name" />
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>Caja</mat-label>
              <mat-select formControlName="boxId">
                <mat-option *ngFor="let node of boxes" [value]="node.box.id">{{ node.box.name }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>Descripción</mat-label>
              <textarea matInput rows="3" formControlName="description"></textarea>
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>Ubicación física</mat-label>
              <input matInput formControlName="physicalLocation" />
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>URL foto</mat-label>
              <input matInput formControlName="photoUrl" />
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>Tags (coma separada)</mat-label>
              <input matInput formControlName="tags" />
            </mat-form-field>
            <mat-form-field class="full-width">
              <mat-label>Aliases (coma separada)</mat-label>
              <input matInput formControlName="aliases" />
            </mat-form-field>

            <div class="row gap">
              <button mat-flat-button color="primary" [disabled]="loading || form.invalid">
                {{ loading ? 'Guardando...' : 'Guardar' }}
              </button>
              <button mat-button type="button" [routerLink]="['/app/home']">Volver</button>
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
  loading = false;
  errorMessage = '';
  boxes: BoxTreeNode[] = [];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    boxId: ['', [Validators.required]],
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
    const payload = {
      box_id: raw.boxId,
      name: raw.name.trim(),
      description: raw.description || null,
      physical_location: raw.physicalLocation || null,
      photo_url: raw.photoUrl || null,
      tags: splitCsv(raw.tags),
      aliases: splitCsv(raw.aliases)
    };

    const request$ = this.itemId
      ? this.itemService.update(this.selectedWarehouseId, this.itemId, payload)
      : this.itemService.create(this.selectedWarehouseId, payload);

    request$.subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl('/app/home');
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo guardar el artículo.';
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
        if (!this.form.controls.boxId.value && nodes.length > 0) {
          this.form.controls.boxId.setValue(nodes[0].box.id);
        }
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar las cajas.';
      }
    });
  }
}

function splitCsv(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => !!part);
}
