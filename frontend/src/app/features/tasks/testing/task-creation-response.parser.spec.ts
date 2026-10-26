import { parseTaskCreationResponse } from '../task-create-form/task-creation-response.parser';
import { sampleTaskSummary } from './task-list.test-data';

describe('parseTaskCreationResponse', () => {
  it('copies only public fields, retaining nullable description', () => {
    expect(
      parseTaskCreationResponse({ ...sampleTaskSummary, description: null, userId: 'hidden' }),
    ).toEqual({ ...sampleTaskSummary, description: null });
    expect(
      parseTaskCreationResponse({ ...sampleTaskSummary, description: 'line\nnext' }).description,
    ).toBe('line\nnext');
  });
  it.each([
    null,
    {},
    sampleTaskSummary,
    { ...sampleTaskSummary, description: 42 },
    { ...sampleTaskSummary, description: '' },
    { ...sampleTaskSummary, description: ' padded ' },
    { ...sampleTaskSummary, description: 'a'.repeat(2001) },
    { ...sampleTaskSummary, description: null, title: 'x\ny' },
    { ...sampleTaskSummary, description: null, id: 'not-a-guid' },
    {
      ...sampleTaskSummary,
      description: null,
      isCompleted: true,
      completedAt: sampleTaskSummary.createdAt,
    },
  ])('rejects malformed creation response %#', (body) => {
    expect(() => parseTaskCreationResponse(body)).toThrow();
  });
});
