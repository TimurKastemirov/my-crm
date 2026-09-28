import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CdkDrag, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { DealsBoardComponentService } from './deals-board.service';

@Component({
  selector: 'app-deals-board',
  host: { class: 'flex h-full flex-col' },
  imports: [ReactiveFormsModule, CdkDropListGroup, CdkDropList, CdkDrag, ModalComponent],
  templateUrl: './deals-board.html',
  providers: [DealsBoardComponentService],
})
export class DealsBoardComponent {
  protected readonly vm = inject(DealsBoardComponentService);
}
