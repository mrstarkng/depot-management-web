export interface UserProfile {
  id: string;
  email: string;
  userName: string;
  fullName: string;
  roles: string[];
}

export interface LoginRequest {
  userName: string;
  password: string;
}

export interface AuthResponse {
  userId: string;
  token: string;
  expires: string;
  refreshToken?: string;
}

export interface RefreshTokenRequest {
  token: string;
}
