import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-paginator',
  imports: [TranslatePipe],
  templateUrl: './paginator.html',
})
export class PaginatorComponent {
  readonly page = input(1);
  readonly total = input(0);
  readonly hasNext = input(false);
  readonly pageChange = output<number>();
}
