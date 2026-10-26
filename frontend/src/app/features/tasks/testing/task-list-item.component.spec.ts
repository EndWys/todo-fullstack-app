import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskListItemComponent } from '../task-list-item/task-list-item.component';
import { sampleTaskSummary } from './task-list.test-data';

describe('TaskListItemComponent', () => {
  let componentFixture: ComponentFixture<TaskListItemComponent>;
  let hostElement: HTMLElement;
  beforeEach(() => {
    componentFixture = TestBed.createComponent(TaskListItemComponent);
    componentFixture.componentRef.setInput('taskSummary', sampleTaskSummary);
    hostElement = componentFixture.nativeElement;
  });

  it('renders an active task as text with a semantic time and no unimplemented actions', async () => {
    await componentFixture.whenStable();
    expect(hostElement.querySelector('h2')?.textContent).toBe(sampleTaskSummary.title);
    expect(hostElement.textContent).toContain('Active');
    expect(hostElement.textContent).toContain('Priority: Normal');
    expect(hostElement.querySelector('time')?.getAttribute('datetime')).toBe(
      sampleTaskSummary.createdAt,
    );
    expect(hostElement.querySelectorAll('time')).toHaveLength(1);
    expect(hostElement.querySelector('button, input')).toBeNull();
  });

  it.each(['low', 'normal', 'high'])('reacts to the %s priority input', async (priority) => {
    componentFixture.componentRef.setInput('taskSummary', { ...sampleTaskSummary, priority });
    await componentFixture.whenStable();
    expect(hostElement.textContent).toContain(
      `Priority: ${priority[0].toUpperCase()}${priority.slice(1)}`,
    );
  });

  it('updates completion text and dates without mutating its input', async () => {
    await componentFixture.whenStable();
    const completedTaskSummary = Object.freeze({
      ...sampleTaskSummary,
      isCompleted: true,
      completedAt: '2026-10-22T13:00:00Z',
    });
    componentFixture.componentRef.setInput('taskSummary', completedTaskSummary);
    await componentFixture.whenStable();
    expect(
      hostElement.querySelector('h2')?.classList.contains('text-decoration-line-through'),
    ).toBe(true);
    expect(hostElement.textContent).toContain('Completed');
    expect(hostElement.querySelectorAll('time')).toHaveLength(2);
    expect(completedTaskSummary.title).toBe(sampleTaskSummary.title);
  });

  it('does not interpret task titles as HTML', async () => {
    componentFixture.componentRef.setInput('taskSummary', {
      ...sampleTaskSummary,
      title: '<img src=x onerror=alert(1)>',
    });
    await componentFixture.whenStable();
    expect(hostElement.querySelector('img')).toBeNull();
    expect(hostElement.querySelector('h2')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
