import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DashboardComponentService } from './dashboard.service';

@Component({
  selector: 'app-dashboard',
  host: { class: 'block h-full' },
  imports: [TranslatePipe],
  templateUrl: './dashboard.html',
  providers: [DashboardComponentService],
})
export class DashboardComponent {
  private readonly service = inject(DashboardComponentService);

  /** Current user, read by the template. */
  protected readonly user = this.service.user;
}
