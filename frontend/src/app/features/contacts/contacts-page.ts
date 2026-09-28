import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator';
import { ContactsPageComponentService } from './contacts-page.service';

@Component({
  selector: 'app-contacts-page',
  host: { class: 'block h-full' },
  imports: [ReactiveFormsModule, ModalComponent, PaginatorComponent, TranslatePipe],
  templateUrl: './contacts-page.html',
  providers: [ContactsPageComponentService],
})
export class ContactsPageComponent {
  protected readonly vm = inject(ContactsPageComponentService);
}
