import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly baseUrl = '/api';

  constructor(private readonly http: HttpClient) {}

  get<T>(path: string) {
    return this.http.get<T>(`${this.baseUrl}${path}`, { withCredentials: true });
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, { withCredentials: true });
  }

  patch<T>(path: string, body: unknown) {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, { withCredentials: true });
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${this.baseUrl}${path}`, { withCredentials: true });
  }
}
