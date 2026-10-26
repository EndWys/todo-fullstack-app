import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { TaskPriority, TaskSummary } from '../task-list.models';

const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};

@Component({
  imports: [DatePipe],
  selector: 'app-task-list-item',
  styles: `
    :host {
      display: block;
    }
    h2 {
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
  `,
  templateUrl: './task-list-item.component.html',
})
export class TaskListItemComponent {
  readonly taskSummary = input.required<TaskSummary>();
  protected readonly priorityDisplayLabel = computed(
    () => TASK_PRIORITY_LABELS[this.taskSummary().priority],
  );
}
