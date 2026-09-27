import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RegisterComponentService } from './register.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  providers: [RegisterComponentService],
})
export class RegisterComponent {
  protected readonly vm = inject(RegisterComponentService);
}
