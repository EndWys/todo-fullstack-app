import {
  createTaskListHttpResponseTestData,
  createTaskListPageTestData,
  sampleTaskSummary,
} from './task-list.test-data';

describe('Task list test data boundaries', () => {
  it('creates an HTTP response with items and no client-only tasks field', () => {
    const responseBody = createTaskListHttpResponseTestData([sampleTaskSummary], 41);

    expect(responseBody).toEqual({
      items: [sampleTaskSummary],
      totalCount: 41,
      page: 1,
      pageSize: 20,
    });
    expect(responseBody).not.toHaveProperty('tasks');
  });

  it('creates client page data with tasks and no HTTP-only items field', () => {
    const pageData = createTaskListPageTestData([]);

    expect(pageData).toEqual({ tasks: [], totalCount: 0, page: 1, pageSize: 20 });
    expect(pageData).not.toHaveProperty('items');
  });
});
