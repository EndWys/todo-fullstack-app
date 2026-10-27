import type { ComponentFixture } from '@angular/core/testing';

export async function enterAuthFormFieldValue<TComponent>(
  componentFixture: ComponentFixture<TComponent>,
  hostElement: HTMLElement,
  fieldId: string,
  fieldValue: string,
): Promise<HTMLInputElement> {
  const inputElement = hostElement.querySelector<HTMLInputElement>(`#${fieldId}`)!;
  inputElement.value = fieldValue;
  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  await componentFixture.whenStable();
  return inputElement;
}
