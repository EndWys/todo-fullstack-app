import {
  DEFAULT_TASK_PAGE_SIZE,
  FIRST_TASK_PAGE,
  SUPPORTED_TASK_PAGE_SIZES,
} from '../task-list-pagination.constants';

describe('Task list pagination contract', () => {
  it('keeps the agreed defaults and supported sizes', () => {
    expect(FIRST_TASK_PAGE).toBe(1);
    expect(DEFAULT_TASK_PAGE_SIZE).toBe(20);
    expect(SUPPORTED_TASK_PAGE_SIZES).toEqual([10, 20, 50]);
  });
});
