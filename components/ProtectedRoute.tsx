
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]; // Legacy support
  permissionKey?: string;   // New dynamic permission key
  children?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, permissionKey, children }) => {
  const { user, isAuthenticated } = useAuth();
  const { hasPageAccess, isLoading } = usePermissions();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Wait for permissions to load before making a decision
  if (isLoading) return null; 

  // Check by Permission Key (Dynamic)
  if (permissionKey) {
      if (!hasPageAccess(permissionKey)) {
          return <Navigate to="/" replace />;
      }
  }

  // Check by Legacy Roles (Backwards compatibility)
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />; 
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
