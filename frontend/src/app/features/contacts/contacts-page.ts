import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator';
import { ContactsPageComponentService } from './contacts-page.service';

@Component({
  selector: 'app-contacts-page',
  imports: [ReactiveFormsModule, ModalComponent, PaginatorComponent],
  templateUrl: './contacts-page.html',
  providers: [ContactsPageComponentService],
})
export class ContactsPageComponent {
  protected readonly vm = inject(ContactsPageComponentService);
}
