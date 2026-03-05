import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../core/environment';

export type GeminiModelId =
  | 'gemini-3.1-flash-lite'
  | 'gemini-3-flash'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite';

export interface SMTPSettings {
  warehouse_id: string;
  host: string | null;
  port: number | null;
  username: string | null;
  encryption_mode: string | null;
  from_address: string | null;
  from_name: string | null;
  has_password: boolean;
  password_masked: string | null;
}

export interface LLMSettings {
  warehouse_id: string;
  provider: string;
  language: 'es' | 'en';
  model_priority: GeminiModelId[];
  auto_tags_enabled: boolean;
  auto_alias_enabled: boolean;
  has_api_key: boolean;
  api_key_value: string | null;
}

export interface LLMReprocessResponse {
  message: string;
  item_id: string;
  processed_fields: string[];
  tags: string[];
  aliases: string[];
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  constructor(private readonly http: HttpClient) {}

  getSmtpSettings(warehouseId: string): Observable<SMTPSettings> {
    const params = new HttpParams().set('warehouse_id', warehouseId);
    return this.http.get<SMTPSettings>(`${environment.apiBaseUrl}/settings/smtp`, { params });
  }

  updateSmtpSettings(
    warehouseId: string,
    payload: {
      host: string;
      port: number;
      username?: string | null;
      password?: string | null;
      encryption_mode: string;
      from_address: string;
      from_name?: string | null;
    }
  ): Observable<SMTPSettings> {
    const params = new HttpParams().set('warehouse_id', warehouseId);
    return this.http.put<SMTPSettings>(`${environment.apiBaseUrl}/settings/smtp`, payload, { params });
  }

  testSmtpSettings(warehouseId: string, toEmail: string): Observable<{ message: string }> {
    const params = new HttpParams().set('warehouse_id', warehouseId);
    return this.http.post<{ message: string }>(
      `${environment.apiBaseUrl}/settings/smtp/test`,
      { to_email: toEmail },
      { params }
    );
  }

  getLlmSettings(warehouseId: string): Observable<LLMSettings> {
    const params = new HttpParams().set('warehouse_id', warehouseId);
    return this.http.get<LLMSettings>(`${environment.apiBaseUrl}/settings/llm`, { params });
  }

  updateLlmSettings(
    warehouseId: string,
    payload: {
      provider: string;
      language: 'es' | 'en';
      model_priority: GeminiModelId[];
      api_key?: string | null;
      auto_tags_enabled: boolean;
      auto_alias_enabled: boolean;
    }
  ): Observable<LLMSettings> {
    const params = new HttpParams().set('warehouse_id', warehouseId);
    return this.http.put<LLMSettings>(`${environment.apiBaseUrl}/settings/llm`, payload, { params });
  }

  reprocessItem(
    warehouseId: string,
    itemId: string,
    fields: Array<'tags' | 'aliases'> = ['tags', 'aliases']
  ): Observable<LLMReprocessResponse> {
    const params = new HttpParams().set('warehouse_id', warehouseId);
    return this.http.post<LLMReprocessResponse>(
      `${environment.apiBaseUrl}/settings/llm/reprocess-item/${itemId}`,
      { fields },
      { params }
    );
  }
}
