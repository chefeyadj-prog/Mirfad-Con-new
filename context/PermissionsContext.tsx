
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';

interface PermissionConfig {
    show: boolean;
    features: Record<string, boolean>;
}

interface PermissionsContextType {
    permissions: Record<string, PermissionConfig> | null;
    hasPageAccess: (pageKey: string) => boolean;
    hasFeature: (pageKey: string, featureKey: string) => boolean;
    isLoading: boolean;
    refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [permissions, setPermissions] = useState<Record<string, PermissionConfig> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPermissions = async () => {
        if (!user) {
            setPermissions(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('role_permissions')
                .select('permissions')
                .eq('role', user.role)
                .maybeSingle();

            if (data && data.permissions) {
                setPermissions(data.permissions);
            } else {
                // If no permissions found, default to null (will be handled by fallback logic)
                setPermissions(null);
            }
        } catch (err) {
            console.error("Error loading permissions:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
    }, [user]);

    const hasPageAccess = (pageKey: string) => {
        if (user?.role === 'it') return true; // IT always has access
        if (!permissions) return true; // Default fallback while loading or if not set
        return permissions[pageKey]?.show !== false;
    };

    const hasFeature = (pageKey: string, featureKey: string) => {
        if (user?.role === 'it') return true;
        if (!permissions || !permissions[pageKey]) return true;
        return permissions[pageKey].features?.[featureKey] !== false;
    };

    return (
        <PermissionsContext.Provider value={{ permissions, hasPageAccess, hasFeature, isLoading, refreshPermissions: fetchPermissions }}>
            {children}
        </PermissionsContext.Provider>
    );
};

export const usePermissions = () => {
    const context = useContext(PermissionsContext);
    if (context === undefined) throw new Error('usePermissions must be used within a PermissionsProvider');
    return context;
};
