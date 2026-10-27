import { Component, computed, input, output } from '@angular/core';
import type { TaskListPagination, TaskPageSize } from '../task-list.models';
import { FIRST_TASK_PAGE, SUPPORTED_TASK_PAGE_SIZES } from '../task-list-pagination.constants';

@Component({
  selector: 'app-task-list-pagination',
  templateUrl: './task-list-pagination.component.html',
})
export class TaskListPaginationComponent {
  readonly pagination = input.required<TaskListPagination>();
  readonly totalCount = input.required<number>();
  readonly disabled = input(false);

  readonly pageRequested = output<number>();
  readonly pageSizeRequested = output<TaskPageSize>();

  protected readonly pageSizeOptions = SUPPORTED_TASK_PAGE_SIZES;
  protected readonly firstPage = FIRST_TASK_PAGE;
  protected readonly totalPages = computed(() =>
    Math.ceil(this.totalCount() / this.pagination().pageSize),
  );
  protected readonly lastAvailablePage = computed(() =>
    Math.max(FIRST_TASK_PAGE, this.totalPages()),
  );
  protected readonly isPreviousDisabled = computed(
    () => this.disabled() || this.pagination().page <= FIRST_TASK_PAGE,
  );
  protected readonly isNextDisabled = computed(
    () => this.disabled() || this.pagination().page >= this.lastAvailablePage(),
  );
  protected readonly isLastDisabled = computed(
    () => this.disabled() || this.pagination().page === this.lastAvailablePage(),
  );

  protected requestPreviousPage(): void {
    const previousPage = Math.min(this.pagination().page - 1, this.lastAvailablePage());
    this.requestPage(previousPage);
  }

  protected requestPage(page: number): void {
    if (this.disabled()) {
      return;
    }

    if (page < FIRST_TASK_PAGE || page > this.lastAvailablePage()) {
      return;
    }

    if (page === this.pagination().page) {
      return;
    }

    this.pageRequested.emit(page);
  }

  protected requestPageSize(value: string): void {
    if (this.disabled()) {
      return;
    }

    const requestedSize = Number(value);
    if (requestedSize === this.pagination().pageSize) {
      return;
    }

    for (const pageSize of SUPPORTED_TASK_PAGE_SIZES) {
      if (requestedSize === pageSize) {
        this.pageSizeRequested.emit(pageSize);
        return;
      }
    }
  }
}
