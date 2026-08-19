export interface AuthContext {
  userId: string;
  deviceId?: string;
  jti: string;
}

export interface DeviceContext {
  userId: string;
  deviceId: string;
  keyId: string;
}
