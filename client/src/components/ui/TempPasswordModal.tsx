import React from 'react';
import { Badge } from './Badge';

export const PasswordStatusBadge: React.FC<{
  user?: {
    mustChangePassword?: boolean;
    passwordChangedAt?: string | null;
  } | null;
}> = ({ user }) => {
  if (!user) return <Badge variant="neutral" size="sm">—</Badge>;

  const changedTitle = user.passwordChangedAt
    ? `Last changed: ${new Date(user.passwordChangedAt).toLocaleDateString()}`
    : 'Not yet changed by user';

  if (user.mustChangePassword) {
    return (
      <span title={changedTitle}>
        <Badge variant="warning" size="sm">
          Default (must change)
        </Badge>
      </span>
    );
  }
  return (
    <span title={changedTitle}>
      <Badge variant="success" size="sm">
        Set by user
      </Badge>
    </span>
  );
};
