import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LoginComponentService } from './login.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  providers: [LoginComponentService],
})
export class LoginComponent {
  protected readonly vm = inject(LoginComponentService);
}
