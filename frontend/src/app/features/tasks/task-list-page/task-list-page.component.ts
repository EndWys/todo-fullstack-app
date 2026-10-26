import { afterNextRender, Component, ElementRef, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthSessionService } from '../../auth/auth-session.service';
import { TaskListItemComponent } from '../task-list-item/task-list-item.component';
import { TaskListDataService } from './task-list-data.service';

@Component({
  imports: [RouterLink, TaskListItemComponent],
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
  private readonly pageHeadingElement =
    viewChild<ElementRef<HTMLHeadingElement>>('pageHeadingElement');

  protected readonly authenticatedUser = this.authSession.authenticatedUser;
  protected readonly taskListLoadState = this.taskListDataService.taskListLoadState;

  constructor() {
    afterNextRender(() => this.focusPageHeading());
  }

  protected reloadTaskList(): void {
    this.focusPageHeading();
    this.taskListDataService.reloadTaskList();
  }

  private focusPageHeading(): void {
    this.pageHeadingElement()?.nativeElement.focus();
  }
}
