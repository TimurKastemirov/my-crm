import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** Thin wrapper over HttpClient with the base prefix /api/v1. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1';

  get<T>(url: string, params?: Record<string, string | number | undefined>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          httpParams = httpParams.set(key, String(value));
        }
      }
    }
    return this.http.get<T>(`${this.base}${url}`, { params: httpParams });
  }

  post<T>(url: string, body?: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}${url}`, body ?? {});
  }

  patch<T>(url: string, body?: unknown): Observable<T> {
    return this.http.patch<T>(`${this.base}${url}`, body ?? {});
  }

  delete<T>(url: string): Observable<T> {
    return this.http.delete<T>(`${this.base}${url}`);
  }
}
