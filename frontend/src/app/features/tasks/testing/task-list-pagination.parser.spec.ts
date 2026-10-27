import { convertToParamMap } from '@angular/router';
import { parseTaskListPagination } from '../task-list-page/task-list-pagination.parser';

describe('parseTaskListPagination', () => {
  it('uses defaults only for absent parameters', () => {
    expect(parseTaskListPagination(convertToParamMap({}))).toEqual({
      status: 'valid',
      pagination: { page: 1, pageSize: 20 },
    });
    expect(parseTaskListPagination(convertToParamMap({ page: '3' }))).toEqual({
      status: 'valid',
      pagination: { page: 3, pageSize: 20 },
    });
    expect(parseTaskListPagination(convertToParamMap({ pageSize: '50' }))).toEqual({
      status: 'valid',
      pagination: { page: 1, pageSize: 50 },
    });
  });

  it.each(['10', '20', '50'])('accepts supported size %s and the Int32 page boundary', (size) => {
    expect(
      parseTaskListPagination(convertToParamMap({ page: '2147483647', pageSize: size })),
    ).toEqual({ status: 'valid', pagination: { page: 2147483647, pageSize: Number(size) } });
  });

  it.each([
    '',
    '0',
    '-1',
    '1.5',
    '2tasks',
    '1e2',
    ' 2 ',
    '+2',
    'NaN',
    'Infinity',
    '2147483648',
    '9'.repeat(400),
    '٢',
  ])('rejects invalid page %j', (page) => {
    expect(parseTaskListPagination(convertToParamMap({ page })).status).toBe('invalid');
  });

  it.each(['', '0', '-10', '15', '20.5', '20tasks', '2e1', ' 20 ', '2147483648'])(
    'rejects invalid size %j',
    (pageSize) => {
      expect(parseTaskListPagination(convertToParamMap({ pageSize })).status).toBe('invalid');
    },
  );

  it.each([
    { page: ['1', '2'] },
    { pageSize: ['20', '20'] },
    { userId: 'other' },
    { q: 'test' },
    { pages: '2' },
    { Page: '2' },
  ])('rejects duplicates or unsupported parameters %j', (parameters) => {
    expect(parseTaskListPagination(convertToParamMap(parameters)).status).toBe('invalid');
  });

  it('accepts leading zeros without truncating invalid numeric suffixes', () => {
    expect(parseTaskListPagination(convertToParamMap({ page: '002', pageSize: '010' }))).toEqual({
      status: 'valid',
      pagination: { page: 2, pageSize: 10 },
    });
  });
});
