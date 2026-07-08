import { Box } from '../app/services/box.service';
import { IntakeBatch, IntakeDraft } from '../app/services/intake.service';
import { Item } from '../app/services/item.service';
import { Warehouse } from '../app/services/warehouse.service';

export const testWarehouse = (overrides: Partial<Warehouse> = {}): Warehouse => ({
  id: 'wh-test',
  name: 'Test Warehouse',
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides
});

export const testItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'item-test',
  warehouse_id: 'wh-test',
  box_id: 'box-test',
  name: 'Test Item',
  description: null,
  photo_url: null,
  physical_location: null,
  tags: [],
  aliases: [],
  version: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  stock: 3,
  is_favorite: false,
  box_path: ['Root'],
  box_is_inbound: false,
  ...overrides
});

export const testBox = (overrides: Partial<Box> = {}): Box => ({
  id: 'box-test',
  warehouse_id: 'wh-test',
  parent_box_id: null,
  name: 'Root',
  description: null,
  physical_location: null,
  short_code: 'R1',
  qr_token: 'qr-test',
  is_inbound: false,
  version: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  ...overrides
});

export const testIntakeBatch = (overrides: Partial<IntakeBatch> = {}): IntakeBatch => ({
  id: 'batch-test',
  warehouse_id: 'wh-test',
  target_box_id: 'box-test',
  target_box_name: 'Root',
  created_by: 'user-1',
  name: 'Test Batch',
  status: 'drafting',
  total_count: 1,
  processed_count: 0,
  committed_count: 0,
  started_at: null,
  finished_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  status_counts: {
    uploaded: 1,
    processing: 0,
    ready: 0,
    review: 0,
    error: 0,
    rejected: 0,
    committed: 0
  },
  ...overrides
});

export const testIntakeDraft = (overrides: Partial<IntakeDraft> = {}): IntakeDraft => ({
  id: 'draft-test',
  warehouse_id: 'wh-test',
  batch_id: 'batch-test',
  photo_url: 'https://example.com/photo.jpg',
  status: 'ready',
  position: 0,
  name: 'Draft Item',
  description: 'A test draft',
  tags: ['tools'],
  aliases: [],
  confidence: 0.85,
  warnings: [],
  llm_used: true,
  error_message: null,
  processing_attempts: 1,
  quantity: 1,
  committed_quantity: 0,
  created_item_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides
});
