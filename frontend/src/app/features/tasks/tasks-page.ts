import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator';
import { TasksPageComponentService } from './tasks-page.service';

@Component({
  selector: 'app-tasks-page',
  host: { class: 'block h-full' },
  imports: [ReactiveFormsModule, DatePipe, TranslatePipe, ModalComponent, PaginatorComponent],
  templateUrl: './tasks-page.html',
  providers: [TasksPageComponentService],
})
export class TasksPageComponent {
  protected readonly vm = inject(TasksPageComponentService);
}
