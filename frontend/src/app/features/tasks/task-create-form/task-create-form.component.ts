import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField, submit, validate, ValidationError } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { TaskCreationService } from './task-creation.service';
import {
  DEFAULT_TASK_PRIORITY,
  TASK_DESCRIPTION_MAX_CODE_POINTS,
  TASK_PRIORITY_OPTIONS,
  TASK_TITLE_MAX_CODE_POINTS,
} from './task-creation.constants';
import type {
  TaskCreationFormValue,
  TaskCreationFailure,
  TaskCreationFieldError,
} from './task-creation.models';
import {
  validateTaskDescription,
  validateTaskTitle,
  validateTaskPriority,
} from './task-creation.validator';
import { parseTaskCreationError } from './task-creation-error.parser';

@Component({
  imports: [FormField],
  providers: [TaskCreationService],
  selector: 'app-task-create-form',
  templateUrl: './task-create-form.component.html',
})
export class TaskCreateFormComponent {
  private readonly taskCreationService = inject(TaskCreationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly componentInjector = inject(Injector);

  private readonly titleInputElement = viewChild<ElementRef<HTMLInputElement>>('titleInputElement');
  private readonly descriptionInputElement =
    viewChild<ElementRef<HTMLTextAreaElement>>('descriptionInputElement');
  private readonly priorityInputElement =
    viewChild<ElementRef<HTMLSelectElement>>('priorityInputElement');
  private readonly creationFeedbackElement =
    viewChild<ElementRef<HTMLDivElement>>('creationFeedbackElement');

  private readonly taskCreationFormModel = signal<TaskCreationFormValue>(
    this.createEmptyFormValue(),
  );
  private readonly successMessageSignal = signal('');
  private readonly hasUnconfirmedCreationSignal = signal(false);

  readonly taskCreated = output<void>();
  readonly taskListRefreshRequested = output<void>();

  protected readonly successMessage = this.successMessageSignal.asReadonly();
  protected readonly hasUnconfirmedCreation = this.hasUnconfirmedCreationSignal.asReadonly();

  protected readonly titleMaxCodePoints = TASK_TITLE_MAX_CODE_POINTS;
  protected readonly descriptionMaxCodePoints = TASK_DESCRIPTION_MAX_CODE_POINTS;
  protected readonly priorityOptions = TASK_PRIORITY_OPTIONS;

  protected readonly taskCreationForm = form(this.taskCreationFormModel, (schemaPath) => {
    validate(schemaPath.title, ({ value }) => validateTaskTitle(value()));
    validate(schemaPath.description, ({ value }) => validateTaskDescription(value()));
    validate(schemaPath.priority, ({ value }) => validateTaskPriority(value()));
  });

  protected shouldShowFieldErrors(field: keyof TaskCreationFormValue): boolean {
    const fieldState = this.taskCreationForm[field]();

    return fieldState.touched() && fieldState.invalid();
  }

  protected getFieldDescriptionIds(field: keyof TaskCreationFormValue): string | null {
    let hintId: string | null = null;

    if (field !== 'priority') {
      hintId = `task-${field}-help`;
    }

    if (!this.shouldShowFieldErrors(field)) {
      return hintId;
    }

    const errorsId = `task-${field}-errors`;

    if (hintId === null) {
      return errorsId;
    }

    return `${hintId} ${errorsId}`;
  }

  protected clearCreationSuccess(): void {
    this.successMessageSignal.set('');
  }

  protected resetCreationForm(): void {
    if (this.taskCreationForm().submitting()) {
      return;
    }

    this.taskCreationForm().reset(this.createEmptyFormValue());
    this.successMessageSignal.set('');
    this.hasUnconfirmedCreationSignal.set(false);

    this.titleInputElement()?.nativeElement.focus();
  }

  protected refreshTaskList(): void {
    this.taskListRefreshRequested.emit();
  }

  protected async submitTaskCreation(submitEvent: Event): Promise<void> {
    submitEvent.preventDefault();

    if (this.taskCreationForm().submitting()) {
      return;
    }

    this.prepareCreationFeedback();

    const isTaskCreated = await submit(this.taskCreationForm, async () =>
      this.executeTaskCreation(),
    );

    if (this.destroyRef.destroyed) {
      return;
    }

    if (isTaskCreated) {
      this.completeTaskCreation();
      return;
    }

    this.focusCreationErrorAfterRender();
  }

  private prepareCreationFeedback(): void {
    this.clearCreationSuccess();
    this.hasUnconfirmedCreationSignal.set(false);
  }

  private async executeTaskCreation(): Promise<ValidationError.WithOptionalFieldTree[] | undefined> {
    try {
      const creationRequest = this.taskCreationService
        .createTask({ ...this.taskCreationFormModel() })
        .pipe(takeUntilDestroyed(this.destroyRef));

      await firstValueFrom(creationRequest);

      return undefined;
    } catch (requestError: unknown) {
      if (this.destroyRef.destroyed) {
        return undefined;
      }

      const creationFailure = parseTaskCreationError(requestError);

      return this.mapCreationFailureToFormErrors(creationFailure);
    }
  }

  private completeTaskCreation(): void {
    this.taskCreationForm().reset(this.createEmptyFormValue());
    this.successMessageSignal.set('Task created.');

    this.taskCreated.emit();
  }

  private focusCreationErrorAfterRender(): void {
    afterNextRender(() => this.focusCreationError(), { injector: this.componentInjector });
  }

  private focusCreationError(): void {
    const focusTarget = this.getCreationErrorFocusTarget();

    focusTarget?.nativeElement.focus();
  }

  private getCreationErrorFocusTarget(): ElementRef<HTMLElement> | undefined {
    if (this.taskCreationForm.title().invalid()) {
      return this.titleInputElement();
    }

    if (this.taskCreationForm.description().invalid()) {
      return this.descriptionInputElement();
    }

    if (this.taskCreationForm.priority().invalid()) {
      return this.priorityInputElement();
    }

    return this.creationFeedbackElement();
  }

  private createEmptyFormValue(): TaskCreationFormValue {
    return { title: '', description: '', priority: DEFAULT_TASK_PRIORITY };
  }

  private mapCreationFailureToFormErrors(
    failure: TaskCreationFailure,
  ): ValidationError.WithOptionalFieldTree[] {
    if (failure.kind === 'validation') {
      return this.mapFieldErrorsToFormErrors(failure.errors);
    }

    this.hasUnconfirmedCreationSignal.set(failure.kind === 'unconfirmed');

    return [{ kind: 'request', message: this.getCreationFailureMessage(failure) }];
  }

  private mapFieldErrorsToFormErrors(
    fieldErrors: readonly TaskCreationFieldError[],
  ): ValidationError.WithOptionalFieldTree[] {
    const formErrors: ValidationError.WithOptionalFieldTree[] = [];

    for (const fieldError of fieldErrors) {
      formErrors.push({
        fieldTree: this.taskCreationForm[fieldError.field],
        kind: 'server',
        message: fieldError.message,
      });
    }

    return formErrors;
  }

  private getCreationFailureMessage(
    failure: Exclude<TaskCreationFailure, { kind: 'validation' }>,
  ): string {
    switch (failure.kind) {
      case 'csrf':
        return 'Security verification failed. Please try again.';
      case 'session':
        return 'Your session is no longer available. Please sign in again.';
      default:
        return 'Task creation could not be confirmed. Refresh the list before trying again: the task may already have been saved.';
    }
  }
}
