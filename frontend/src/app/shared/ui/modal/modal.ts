import { Component, input, output } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';

/**
 * Адаптивная модалка: на телефоне — bottom-sheet во всю ширину, на sm+ — карточка по центру.
 * Фокус запирается через CDK cdkTrapFocus (требование WCAG AA). Презентационная — без сервиса.
 */
@Component({
  selector: 'app-modal',
  imports: [A11yModule],
  templateUrl: './modal.html',
})
export class ModalComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly close = output<void>();
}
