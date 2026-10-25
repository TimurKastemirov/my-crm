import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ModalComponent } from './modal';

describe('ModalComponent', () => {
  it('names the dialog by its title (and ids are unique per instance)', () => {
    TestBed.configureTestingModule({
      imports: [ModalComponent],
      providers: [provideTranslateService({ fallbackLang: 'en' })],
    });
    const render = () => {
      const fixture = TestBed.createComponent(ModalComponent);
      fixture.componentRef.setInput('open', true);
      fixture.componentRef.setInput('title', 'New role');
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };
    const first = render();
    const dialog = first.querySelector('[role="dialog"]') as HTMLElement;
    const labelledBy = dialog.getAttribute('aria-labelledby') as string;
    expect(first.querySelector(`#${labelledBy}`)?.textContent).toBe('New role');

    const second = render().querySelector('[role="dialog"]') as HTMLElement;
    expect(second.getAttribute('aria-labelledby')).not.toBe(labelledBy);
  });
});
