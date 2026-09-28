import { Component, input, output } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';

/**
 * Responsive modal: full-width bottom-sheet on phones, centered card on sm+.
 * Focus is trapped via CDK cdkTrapFocus (WCAG AA requirement). Presentational — no service.
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
