import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TaskListPaginationComponent } from '../task-list-pagination/task-list-pagination.component';

describe('TaskListPaginationComponent', () => {
  let componentFixture: ComponentFixture<TaskListPaginationComponent>;
  let hostElement: HTMLElement;

  beforeEach(async () => {
    componentFixture = TestBed.createComponent(TaskListPaginationComponent);
    componentFixture.componentRef.setInput('pagination', { page: 2, pageSize: 20 });
    componentFixture.componentRef.setInput('totalCount', 61);
    hostElement = componentFixture.nativeElement;
    await componentFixture.whenStable();
  });

  function getButton(label: string): HTMLButtonElement {
    const button = Array.from(hostElement.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!button) throw new Error(`Missing pagination button: ${label}`);
    return button;
  }

  it('renders labelled controls, current page and all supported sizes', () => {
    expect(hostElement.querySelector('nav')?.getAttribute('aria-label')).toBe(
      'Task list pagination',
    );
    expect(hostElement.querySelector('[aria-current="page"]')?.textContent).toContain(
      'Page 2 of 4',
    );
    expect(hostElement.querySelector('label')?.htmlFor).toBe('task-page-size');
    expect(
      Array.from(hostElement.querySelectorAll('option')).map((option) => option.value),
    ).toEqual(['10', '20', '50']);
    expect(hostElement.querySelector('select')?.value).toBe('20');
  });

  it.each([
    ['First', 1],
    ['Previous', 1],
    ['Next', 3],
    ['Last', 4],
  ] as const)('emits page %s without loading or changing its inputs', (label, expectedPage) => {
    const pageRequested = vi.fn();
    componentFixture.componentInstance.pageRequested.subscribe(pageRequested);
    getButton(label).click();
    expect(pageRequested).toHaveBeenCalledExactlyOnceWith(expectedPage);
    expect(componentFixture.componentInstance.pagination()).toEqual({ page: 2, pageSize: 20 });
  });

  it('disables navigation at the first and last pages', async () => {
    componentFixture.componentRef.setInput('pagination', { page: 1, pageSize: 20 });
    await componentFixture.whenStable();
    expect(getButton('First').disabled).toBe(true);
    expect(getButton('Previous').disabled).toBe(true);
    expect(getButton('Next').disabled).toBe(false);

    componentFixture.componentRef.setInput('pagination', { page: 4, pageSize: 20 });
    await componentFixture.whenStable();
    expect(getButton('Next').disabled).toBe(true);
    expect(getButton('Last').disabled).toBe(true);
    expect(getButton('Previous').disabled).toBe(false);
  });

  it('avoids page 1 of 0 and retains size selection for an empty list', async () => {
    componentFixture.componentRef.setInput('pagination', { page: 1, pageSize: 20 });
    componentFixture.componentRef.setInput('totalCount', 0);
    await componentFixture.whenStable();
    expect(hostElement.textContent).not.toContain('Page 1 of 0');
    expect(
      Array.from(hostElement.querySelectorAll('button')).every((button) => button.disabled),
    ).toBe(true);
    expect(hostElement.querySelector('select')?.disabled).toBe(false);
  });

  it('can return from an out-of-range page even when the list is empty', async () => {
    componentFixture.componentRef.setInput('pagination', { page: 99, pageSize: 20 });
    componentFixture.componentRef.setInput('totalCount', 0);
    await componentFixture.whenStable();
    const pageRequested = vi.fn();
    componentFixture.componentInstance.pageRequested.subscribe(pageRequested);
    getButton('Last').click();
    expect(pageRequested).toHaveBeenCalledExactlyOnceWith(1);
    expect(hostElement.textContent).not.toContain('Page 99 of 0');
  });

  it('emits only a changed supported page size', () => {
    const pageSizeRequested = vi.fn();
    componentFixture.componentInstance.pageSizeRequested.subscribe(pageSizeRequested);
    const select = hostElement.querySelector('select')!;
    select.dispatchEvent(new Event('change'));
    expect(pageSizeRequested).not.toHaveBeenCalled();
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    expect(pageSizeRequested).toHaveBeenCalledExactlyOnceWith(50);
  });

  it('disables every control when requested', async () => {
    componentFixture.componentRef.setInput('disabled', true);
    await componentFixture.whenStable();
    expect(hostElement.querySelector('select')?.disabled).toBe(true);
    expect(
      Array.from(hostElement.querySelectorAll('button')).every((button) => button.disabled),
    ).toBe(true);
  });
});
