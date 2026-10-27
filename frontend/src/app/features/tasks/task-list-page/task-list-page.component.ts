import { afterNextRender, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthSessionService } from '../../auth/auth-session.service';
import { TaskListItemComponent } from '../task-list-item/task-list-item.component';
import { TaskListDataService } from './task-list-data.service';
import { TaskCreateFormComponent } from '../task-create-form/task-create-form.component';
import { TaskListPaginationComponent } from '../task-list-pagination/task-list-pagination.component';
import { parseTaskListPagination } from './task-list-pagination.parser';
import type {
  TaskListPagination,
  TaskListPaginationState,
  TaskPageSize,
} from '../task-list.models';
import {
  DEFAULT_TASK_PAGE_SIZE,
  FIRST_TASK_PAGE,
  MAX_TASK_LIST_INT32,
} from '../task-list-pagination.constants';

const TASK_PAGE_NAVIGATION_ERROR_MESSAGE = 'The page could not be changed. Please try again.';

@Component({
  imports: [
    RouterLink,
    TaskListItemComponent,
    TaskCreateFormComponent,
    TaskListPaginationComponent,
  ],
  providers: [TaskListDataService],
  selector: 'app-task-list-page',
  styles: `
    :host {
      display: block;
    }
  `,
  templateUrl: './task-list-page.component.html',
})
export class TaskListPageComponent {
  private readonly authSession = inject(AuthSessionService);
  private readonly taskListDataService = inject(TaskListDataService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly paginationStateSignal = signal(
    parseTaskListPagination(this.activatedRoute.snapshot.queryParamMap),
  );
  private readonly navigationErrorSignal = signal<string | undefined>(undefined);

  private readonly pageHeadingElement =
    viewChild<ElementRef<HTMLHeadingElement>>('pageHeadingElement');

  protected readonly authenticatedUser = this.authSession.authenticatedUser;
  protected readonly taskListLoadState = this.taskListDataService.taskListLoadState;
  protected readonly firstTaskPage = FIRST_TASK_PAGE;
  protected readonly paginationState = this.paginationStateSignal.asReadonly();
  protected readonly navigationError = this.navigationErrorSignal.asReadonly();

  constructor() {
    this.activatedRoute.queryParamMap
      .pipe(map(parseTaskListPagination), takeUntilDestroyed())
      .subscribe((state) => this.applyRoutePagination(state));

    afterNextRender(() => this.focusPageHeading());
  }

  protected reloadTaskList(): void {
    this.focusPageHeading();
    this.taskListDataService.reloadTaskList();
  }

  protected async refreshTaskListAfterCreation(): Promise<void> {
    const state = this.paginationState();
    if (state.status === 'valid' && state.pagination.page === FIRST_TASK_PAGE) {
      this.refreshCurrentTaskPage();
      return;
    }

    let pageSize: TaskPageSize = DEFAULT_TASK_PAGE_SIZE;
    if (state.status === 'valid') {
      pageSize = state.pagination.pageSize;
    }

    await this.navigateToPagination({ page: FIRST_TASK_PAGE, pageSize });
  }

  protected refreshCurrentTaskPage(): void {
    this.taskListDataService.refreshCurrentPage();
    this.focusPageHeading();
  }

  protected async changeTaskPage(page: number): Promise<void> {
    const state = this.paginationState();
    if (state.status !== 'valid') {
      return;
    }

    if (!Number.isInteger(page)) {
      return;
    }

    if (page < FIRST_TASK_PAGE || page > MAX_TASK_LIST_INT32) {
      return;
    }

    await this.navigateToPagination({ page, pageSize: state.pagination.pageSize });
  }

  protected async changeTaskPageSize(pageSize: TaskPageSize): Promise<void> {
    await this.navigateToPagination({ page: FIRST_TASK_PAGE, pageSize });
  }

  protected async resetTaskPagination(): Promise<void> {
    await this.navigateToPagination(
      { page: FIRST_TASK_PAGE, pageSize: DEFAULT_TASK_PAGE_SIZE },
      true,
    );
  }

  private applyRoutePagination(state: TaskListPaginationState): void {
    this.paginationStateSignal.set(state);

    if (state.status === 'invalid') {
      this.taskListDataService.setPagination(undefined);
      return;
    }

    this.taskListDataService.setPagination(state.pagination);
  }

  private async navigateToPagination(
    pagination: TaskListPagination,
    replaceUrl = false,
  ): Promise<void> {
    this.navigationErrorSignal.set(undefined);

    try {
      const navigated = await this.router.navigate([], {
        relativeTo: this.activatedRoute,
        queryParams: { page: pagination.page, pageSize: pagination.pageSize },
        replaceUrl,
      });

      if (!navigated) {
        this.navigationErrorSignal.set(TASK_PAGE_NAVIGATION_ERROR_MESSAGE);
        return;
      }

      this.focusPageHeading();
    } catch {
      this.navigationErrorSignal.set(TASK_PAGE_NAVIGATION_ERROR_MESSAGE);
    }
  }

  private focusPageHeading(): void {
    this.pageHeadingElement()?.nativeElement.focus();
  }
}
