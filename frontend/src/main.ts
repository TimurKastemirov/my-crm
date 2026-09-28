import { registerLocaleData } from '@angular/common';
import localeEn from '@angular/common/locales/en';
import localeRu from '@angular/common/locales/ru';
import localeUk from '@angular/common/locales/uk';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Locale data for the built-in currency/date pipes (runtime language switching).
registerLocaleData(localeEn);
registerLocaleData(localeRu);
registerLocaleData(localeUk);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
