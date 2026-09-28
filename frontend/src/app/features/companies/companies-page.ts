import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator';
import { CompaniesPageComponentService } from './companies-page.service';

@Component({
  selector: 'app-companies-page',
  host: { class: 'block h-full' },
  imports: [ReactiveFormsModule, ModalComponent, PaginatorComponent],
  templateUrl: './companies-page.html',
  providers: [CompaniesPageComponentService],
})
export class CompaniesPageComponent {
  protected readonly vm = inject(CompaniesPageComponentService);
}
