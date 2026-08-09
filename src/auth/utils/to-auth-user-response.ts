import { AccountStatus, RoleName } from '../../generated/prisma/client';

export function toAuthUserResponse(user: {
  id: number;
  employeeNumber: string;
  name: string;
  email: string;
  accountStatus: AccountStatus;
  profilePictureUrl: string | null;
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
  };
}
