import { Component, inject } from '@angular/core';
import { DashboardComponentService } from './dashboard.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  providers: [DashboardComponentService],
})
export class DashboardComponent {
  protected readonly vm = inject(DashboardComponentService);
}
