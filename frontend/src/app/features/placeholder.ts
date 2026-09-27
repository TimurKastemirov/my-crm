import { Component } from '@angular/core';

/** Временная заглушка раздела до реализации экрана (Фаза 1, следующий шаг). */
@Component({
  selector: 'app-placeholder',
  template: `
    <div class="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p class="text-sm font-medium text-slate-600">Раздел в разработке</p>
      <p class="mt-1 text-xs text-slate-400">Экран будет добавлен на следующем шаге Фазы 1.</p>
    </div>
  `,
})
export class Placeholder {}
