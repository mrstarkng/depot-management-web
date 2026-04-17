export type DepotRole = 'Manager' | 'YardPlanner' | 'GateOperator' | 'OrderClerk';

export interface UserListItem {
  id: string;
  userName: string;
  email: string;
  fullName: string;
  role: DepotRole;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface UserDetail extends UserListItem {
  createdAt?: string;
}

export interface UpdateUserRequest {
  fullName: string;
  email: string;
}

export interface ChangeRoleRequest {
  role: DepotRole;
}

export interface ResetPasswordRequest {
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface RegisterUserRequest {
  userName: string;
  email: string;
  fullName: string;
  password: string;
  role: DepotRole;
}
