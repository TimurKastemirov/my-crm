import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator';
import { LeadsPageComponentService } from './leads-page.service';

@Component({
  selector: 'app-leads-page',
  imports: [ReactiveFormsModule, ModalComponent, PaginatorComponent],
  templateUrl: './leads-page.html',
  providers: [LeadsPageComponentService],
})
export class LeadsPageComponent {
  protected readonly vm = inject(LeadsPageComponentService);
}
