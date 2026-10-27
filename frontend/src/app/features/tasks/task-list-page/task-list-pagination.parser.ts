import type { ParamMap } from '@angular/router';
import type { TaskListPaginationState, TaskPageSize } from '../task-list.models';
import {
  DEFAULT_TASK_PAGE_SIZE,
  FIRST_TASK_PAGE,
  MAX_TASK_LIST_INT32,
  SUPPORTED_TASK_PAGE_SIZES,
} from '../task-list-pagination.constants';

const PAGINATION_PARAMETER_NAMES: readonly string[] = ['page', 'pageSize'];
const DECIMAL_INTEGER_PATTERN = /^[0-9]+$/;

export function parseTaskListPagination(parameters: ParamMap): TaskListPaginationState {
  if (parameters.keys.some((name) => !PAGINATION_PARAMETER_NAMES.includes(name))) {
    return { status: 'invalid', message: 'The tasks URL contains unsupported parameters.' };
  }

  const page = readPageNumber(parameters.getAll('page'));
  if (page === undefined) {
    return { status: 'invalid', message: 'Page must be a positive whole number within Int32.' };
  }

  const pageSize = readPageSize(parameters.getAll('pageSize'));
  if (pageSize === undefined) {
    return { status: 'invalid', message: 'Page size must be one of the supported sizes.' };
  }

  return { status: 'valid', pagination: { page, pageSize } };
}

function readPageNumber(values: readonly string[]): number | undefined {
  if (values.length === 0) {
    return FIRST_TASK_PAGE;
  }

  if (values.length !== 1) {
    return undefined;
  }

  const page = readDecimalInteger(values[0]);
  if (page === undefined || page < FIRST_TASK_PAGE) {
    return undefined;
  }

  return page;
}

function readPageSize(values: readonly string[]): TaskPageSize | undefined {
  if (values.length === 0) {
    return DEFAULT_TASK_PAGE_SIZE;
  }

  if (values.length !== 1) {
    return undefined;
  }

  const requestedPageSize = readDecimalInteger(values[0]);
  for (const pageSize of SUPPORTED_TASK_PAGE_SIZES) {
    if (requestedPageSize === pageSize) {
      return pageSize;
    }
  }

  return undefined;
}

function readDecimalInteger(value: string): number | undefined {
  if (!DECIMAL_INTEGER_PATTERN.test(value)) {
    return undefined;
  }

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue)) {
    return undefined;
  }

  if (parsedValue > MAX_TASK_LIST_INT32) {
    return undefined;
  }

  return parsedValue;
}
