import { parseTaskListResponse } from '../task-list-page/task-list-response.parser';
import {
  sampleTaskSummary,
  createTaskListHttpResponseTestData,
  createTaskListPageTestData,
} from './task-list.test-data';

describe('Tasks page response', () => {
  it('rejects client page data used in place of an HTTP response', () => {
    expect(() => parseTaskListResponse(createTaskListPageTestData())).toThrow();
  });

  it('copies only the public fields and retains server order, UTC dates and nullable fields', () => {
    const secondTaskSummary = {
      ...sampleTaskSummary,
      id: '22222222-2222-2222-2222-222222222222',
      priority: 'high',
      isCompleted: true,
      completedAt: '2026-10-22T13:00:00Z',
    };
    const responseBody = {
      ...createTaskListHttpResponseTestData(),
      items: [
        { ...sampleTaskSummary, userId: 'private', description: 'private' },
        secondTaskSummary,
      ],
    };
    const parsedPageData = parseTaskListResponse(responseBody);
    expect(parsedPageData.tasks).toEqual([sampleTaskSummary, secondTaskSummary]);
    expect(parsedPageData.tasks).not.toBe(responseBody.items);
    expect(parsedPageData.tasks[0]).not.toBe(responseBody.items[0]);
    expect(Object.keys(parsedPageData.tasks[0])).toHaveLength(6);
  });

  it('accepts empty pages and does not invent snapshot consistency between count and items', () => {
    expect(parseTaskListResponse(createTaskListHttpResponseTestData([])).tasks).toEqual([]);
    expect(
      parseTaskListResponse({ ...createTaskListHttpResponseTestData([]), page: 2, totalCount: 40 })
        .totalCount,
    ).toBe(40);
    expect(
      parseTaskListResponse(createTaskListHttpResponseTestData([sampleTaskSummary], 0)).tasks,
    ).toHaveLength(1);
  });

  it.each([
    null,
    [],
    {},
    { items: null },
    ...[
      { items: {} },
      { totalCount: -1 },
      { totalCount: 1.5 },
      { totalCount: '1' },
      { totalCount: 2_147_483_648 },
      { page: 0 },
      { page: 1.5 },
      { page: '1' },
      { pageSize: 15 },
      { pageSize: '20' },
      { items: Array.from({ length: 21 }, () => sampleTaskSummary) },
    ].map((invalidFieldOverrides) => ({
      ...createTaskListHttpResponseTestData(),
      ...invalidFieldOverrides,
    })),
  ])('rejects a malformed envelope %#', (responseBody) => {
    expect(() => parseTaskListResponse(responseBody)).toThrow();
  });

  it.each([
    { id: 'not-a-guid' },
    { id: '00000000-0000-0000-0000-000000000000' },
    { title: 123 },
    { priority: 1 },
    { priority: 'High' },
    { priority: 'urgent' },
    { isCompleted: 'false' },
    { createdAt: null },
    { createdAt: '2026-10-22' },
    { createdAt: 'bad date' },
    { createdAt: '2026-10-22T12:00:00+02:00' },
    { completedAt: undefined },
    { isCompleted: true, completedAt: null },
    { completedAt: '2026-10-22T13:00:00Z' },
    { isCompleted: true, completedAt: 'bad date' },
  ])('rejects malformed task fields %#', (invalidFieldOverrides) => {
    expect(() =>
      parseTaskListResponse({
        ...createTaskListHttpResponseTestData(),
        items: [{ ...sampleTaskSummary, ...invalidFieldOverrides }],
      }),
    ).toThrow();
  });

  it('rejects duplicate ids that would break keyed list rendering', () => {
    expect(() =>
      parseTaskListResponse(
        createTaskListHttpResponseTestData([sampleTaskSummary, sampleTaskSummary]),
      ),
    ).toThrow();
  });
});

describe('Task list response pagination', () => {
  it.each([10, 20, 50])('accepts the supported response page size %s', (pageSize) => {
    const parsedPageData = parseTaskListResponse({ items: [], totalCount: 0, page: 1, pageSize });

    expect(parsedPageData.pageSize).toBe(pageSize);
    expect(parsedPageData.tasks).toEqual([]);
  });

  it.each([0, 15, 21, '20', null])('rejects the unsupported response page size %s', (pageSize) => {
    expect(() => parseTaskListResponse({ items: [], totalCount: 0, page: 1, pageSize })).toThrow();
  });
});
