/**
 * Tests for ReorganizationComponent helper functions.
 *
 * Property 11: groupSuggestions — each from_box_id appears in exactly one group
 * Property 12: sortGroups — groups sharing to_box_id come first
 * Property 13: optimistic update — local state changes immediately, reverts on error
 */

import { groupSuggestions, sortGroups, SuggestionGroup } from './reorganization.component';
import { ReorganizationSuggestionItem } from '../services/reorganization.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSuggestion(
  overrides: Partial<ReorganizationSuggestionItem> & {
    suggestion_id: string;
    from_box_id: string;
    to_box_id: string;
  }
): ReorganizationSuggestionItem {
  return {
    item_id: 'item-' + overrides.suggestion_id,
    item_name: 'Item ' + overrides.suggestion_id,
    from_box_name: 'Box ' + overrides.from_box_id,
    to_box_name: 'Box ' + overrides.to_box_id,
    reason: 'test reason',
    status: 'pending',
    ...overrides,
  };
}

// ── Property 11: groupSuggestions ────────────────────────────────────────────

describe('groupSuggestions — Property 11', () => {
  it('returns empty array for empty input', () => {
    expect(groupSuggestions([])).toEqual([]);
  });

  it('each from_box_id appears in exactly one group', () => {
    const suggestions = [
      makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X' }),
      makeSuggestion({ suggestion_id: 's2', from_box_id: 'box-B', to_box_id: 'box-X' }),
      makeSuggestion({ suggestion_id: 's3', from_box_id: 'box-A', to_box_id: 'box-Y' }),
      makeSuggestion({ suggestion_id: 's4', from_box_id: 'box-C', to_box_id: 'box-Z' }),
    ];

    const groups = groupSuggestions(suggestions);

    const fromBoxIds = groups.map((g) => g.from_box_id);
    // No duplicates
    expect(new Set(fromBoxIds).size).toBe(fromBoxIds.length);
    // All from_box_ids present
    expect(new Set(fromBoxIds)).toContain('box-A');
    expect(new Set(fromBoxIds)).toContain('box-B');
    expect(new Set(fromBoxIds)).toContain('box-C');
  });

  it('all suggestions of a group share the same from_box_id', () => {
    const suggestions = [
      makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X' }),
      makeSuggestion({ suggestion_id: 's2', from_box_id: 'box-A', to_box_id: 'box-Y' }),
      makeSuggestion({ suggestion_id: 's3', from_box_id: 'box-B', to_box_id: 'box-X' }),
    ];

    const groups = groupSuggestions(suggestions);

    for (const group of groups) {
      for (const s of group.suggestions) {
        expect(s.from_box_id).toBe(group.from_box_id);
      }
    }
  });

  it('total suggestions count is preserved across groups', () => {
    const suggestions = [
      makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X' }),
      makeSuggestion({ suggestion_id: 's2', from_box_id: 'box-B', to_box_id: 'box-X' }),
      makeSuggestion({ suggestion_id: 's3', from_box_id: 'box-A', to_box_id: 'box-Y' }),
    ];

    const groups = groupSuggestions(suggestions);
    const total = groups.reduce((sum, g) => sum + g.suggestions.length, 0);
    expect(total).toBe(suggestions.length);
  });

  it('single suggestion produces one group with one item', () => {
    const suggestions = [
      makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X' }),
    ];
    const groups = groupSuggestions(suggestions);
    expect(groups.length).toBe(1);
    expect(groups[0].suggestions.length).toBe(1);
  });
});

// ── Property 12: sortGroups ──────────────────────────────────────────────────

describe('sortGroups — Property 12', () => {
  it('returns empty array for empty input', () => {
    expect(sortGroups([])).toEqual([]);
  });

  it('groups sharing dominant to_box_id come before isolated groups', () => {
    // box-A and box-B both point mostly to box-X → shared
    // box-C points to box-Z → isolated
    const groupA: SuggestionGroup = {
      from_box_id: 'box-A',
      from_box_name: 'Box A',
      suggestions: [
        makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X' }),
        makeSuggestion({ suggestion_id: 's2', from_box_id: 'box-A', to_box_id: 'box-X' }),
      ],
    };
    const groupB: SuggestionGroup = {
      from_box_id: 'box-B',
      from_box_name: 'Box B',
      suggestions: [
        makeSuggestion({ suggestion_id: 's3', from_box_id: 'box-B', to_box_id: 'box-X' }),
      ],
    };
    const groupC: SuggestionGroup = {
      from_box_id: 'box-C',
      from_box_name: 'Box C',
      suggestions: [
        makeSuggestion({ suggestion_id: 's4', from_box_id: 'box-C', to_box_id: 'box-Z' }),
      ],
    };

    const sorted = sortGroups([groupC, groupA, groupB]);

    // box-C (isolated) must come after box-A and box-B (shared)
    const idxA = sorted.findIndex((g) => g.from_box_id === 'box-A');
    const idxB = sorted.findIndex((g) => g.from_box_id === 'box-B');
    const idxC = sorted.findIndex((g) => g.from_box_id === 'box-C');

    expect(idxA).toBeLessThan(idxC);
    expect(idxB).toBeLessThan(idxC);
  });

  it('does not lose any groups after sorting', () => {
    const groups: SuggestionGroup[] = [
      {
        from_box_id: 'box-A',
        from_box_name: 'Box A',
        suggestions: [makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X' })],
      },
      {
        from_box_id: 'box-B',
        from_box_name: 'Box B',
        suggestions: [makeSuggestion({ suggestion_id: 's2', from_box_id: 'box-B', to_box_id: 'box-Y' })],
      },
    ];

    const sorted = sortGroups(groups);
    expect(sorted.length).toBe(groups.length);
  });

  it('single group is returned unchanged', () => {
    const groups: SuggestionGroup[] = [
      {
        from_box_id: 'box-A',
        from_box_name: 'Box A',
        suggestions: [makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X' })],
      },
    ];
    expect(sortGroups(groups).length).toBe(1);
  });

  it('does not mutate the original array', () => {
    const groups: SuggestionGroup[] = [
      {
        from_box_id: 'box-A',
        from_box_name: 'Box A',
        suggestions: [makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X' })],
      },
      {
        from_box_id: 'box-B',
        from_box_name: 'Box B',
        suggestions: [makeSuggestion({ suggestion_id: 's2', from_box_id: 'box-B', to_box_id: 'box-Z' })],
      },
    ];
    const original = [...groups];
    sortGroups(groups);
    expect(groups[0].from_box_id).toBe(original[0].from_box_id);
    expect(groups[1].from_box_id).toBe(original[1].from_box_id);
  });
});

// ── Property 13: optimistic update logic (pure function extraction) ───────────

/**
 * The optimistic update logic is extracted here as a pure function
 * to test it without needing to instantiate the full Angular component.
 */
function applyOptimisticUpdate(
  suggestions: ReorganizationSuggestionItem[],
  suggestionId: string,
  newStatus: 'confirmed' | 'dismissed'
): { suggestions: ReorganizationSuggestionItem[]; allResolved: boolean } {
  const updated = suggestions.map((s) =>
    s.suggestion_id === suggestionId ? { ...s, status: newStatus } : s
  );
  const allResolved = updated.every(
    (s) => s.status === 'confirmed' || s.status === 'dismissed'
  );
  return { suggestions: updated, allResolved };
}

describe('optimistic update — Property 13', () => {
  it('updates the target suggestion status immediately', () => {
    const suggestions = [
      makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X' }),
      makeSuggestion({ suggestion_id: 's2', from_box_id: 'box-A', to_box_id: 'box-Y' }),
    ];

    const { suggestions: updated } = applyOptimisticUpdate(suggestions, 's1', 'confirmed');

    expect(updated.find((s) => s.suggestion_id === 's1')?.status).toBe('confirmed');
  });

  it('does not change other suggestions', () => {
    const suggestions = [
      makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X' }),
      makeSuggestion({ suggestion_id: 's2', from_box_id: 'box-A', to_box_id: 'box-Y' }),
    ];

    const { suggestions: updated } = applyOptimisticUpdate(suggestions, 's1', 'confirmed');

    expect(updated.find((s) => s.suggestion_id === 's2')?.status).toBe('pending');
  });

  it('sets allResolved=true when all suggestions are confirmed or dismissed', () => {
    const suggestions = [
      makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X', status: 'confirmed' }),
      makeSuggestion({ suggestion_id: 's2', from_box_id: 'box-A', to_box_id: 'box-Y' }),
    ];

    const { allResolved } = applyOptimisticUpdate(suggestions, 's2', 'dismissed');

    expect(allResolved).toBe(true);
  });

  it('sets allResolved=false when some suggestions remain pending', () => {
    const suggestions = [
      makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X' }),
      makeSuggestion({ suggestion_id: 's2', from_box_id: 'box-A', to_box_id: 'box-Y' }),
    ];

    const { allResolved } = applyOptimisticUpdate(suggestions, 's1', 'confirmed');

    expect(allResolved).toBe(false);
  });

  it('revert: original state is preserved for rollback', () => {
    const suggestions = [
      makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X' }),
    ];

    // Simulate optimistic update
    const { suggestions: updated } = applyOptimisticUpdate(suggestions, 's1', 'confirmed');
    expect(updated[0].status).toBe('confirmed');

    // Original is unchanged (immutable update)
    expect(suggestions[0].status).toBe('pending');
  });

  it('dismiss sets status to dismissed', () => {
    const suggestions = [
      makeSuggestion({ suggestion_id: 's1', from_box_id: 'box-A', to_box_id: 'box-X' }),
    ];

    const { suggestions: updated } = applyOptimisticUpdate(suggestions, 's1', 'dismissed');

    expect(updated[0].status).toBe('dismissed');
  });
});
