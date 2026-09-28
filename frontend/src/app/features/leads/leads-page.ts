import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator';
import { LeadsPageComponentService } from './leads-page.service';

@Component({
  selector: 'app-leads-page',
  host: { class: 'block h-full' },
  imports: [ReactiveFormsModule, CurrencyPipe, TranslatePipe, ModalComponent, PaginatorComponent],
  templateUrl: './leads-page.html',
  providers: [LeadsPageComponentService],
})
export class LeadsPageComponent {
  protected readonly vm = inject(LeadsPageComponentService);
}
