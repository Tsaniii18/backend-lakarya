import { AccountStatus, RoleName } from '../../generated/prisma/client';

export function toUserResponse(user: {
  id: number;
  employeeNumber: string;
  name: string;
  email: string;
  accountStatus: AccountStatus;
  profilePictureUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  department: { id: number; name: string };
  role: { name: RoleName };
}) {
  return {
    id: user.id,
    employeeNumber: user.employeeNumber,
    name: user.name,
    email: user.email,
    accountStatus: user.accountStatus,
    profilePictureUrl: user.profilePictureUrl,
    department: user.department,
    role: user.role.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
