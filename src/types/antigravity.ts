/**
 * Antigravity 账号管理的 TypeScript 类型定义。
 * 与 Rust 端 models/antigravity.rs 的 camelCase 序列化结构一一对应。
 */

export interface AntigravityAccount {
  id: string;
  email: string;
  name?: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiryTimestamp: number;
  oauthClientKey?: string;
  projectId?: string;
  subscriptionTier?: string;
  customLabel?: string;
  isActive: boolean;
  disabled: boolean;
  disabledReason?: string;
  quota?: AntigravityQuotaData;
  deviceProfile?: AntigravityDeviceProfile;
  createdAt: number;
  lastUsed: number;
  orderIndex: number;
}

export interface AntigravityQuotaData {
  models: AntigravityModelQuota[];
  lastUpdated: number;
  isForbidden: boolean;
  forbiddenReason?: string;
  subscriptionTier?: string;
}

export interface AntigravityModelQuota {
  name: string;
  percentage: number;
  resetTime: string;
  displayName?: string;
  supportsImages?: boolean;
  supportsThinking?: boolean;
  thinkingBudget?: number;
  recommended?: boolean;
  maxTokens?: number;
  maxOutputTokens?: number;
}

export interface AntigravityDeviceProfile {
  machineId: string;
  macMachineId: string;
  devDeviceId: string;
  sqmId: string;
}

export interface RefreshStats {
  total: number;
  success: number;
  failed: number;
  details: string[];
}

export interface ImportResult {
  imported: AntigravityAccount[];
  skipped: string[];
  errors: string[];
}

export interface AgOperationLog {
  id: number;
  accountId: string;
  accountEmail: string;
  operation: string;
  detail?: string;
  createdAt: number;
}

export interface TokenStatus {
  isValid: boolean;
  expiresInSeconds: number;
  lastRefreshed: number;
  refreshCount: number;
}
