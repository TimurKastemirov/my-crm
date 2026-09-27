import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-paginator',
  templateUrl: './paginator.html',
})
export class PaginatorComponent {
  readonly page = input(1);
  readonly total = input(0);
  readonly hasNext = input(false);
  readonly pageChange = output<number>();
}
