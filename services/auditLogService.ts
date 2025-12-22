
import { supabase } from './supabaseClient';
import { User } from '../types';

export const logAction = async (
  user: User | null,
  action: 'create' | 'update' | 'delete' | 'login',
  resource: string,
  details: string
) => {
  if (!user) {
      console.warn("Attempted to log action without user context");
      return;
  }

  const logEntry = {
    user_id: user.id,
    user_name: user.name,
    user_role: user.role,
    action,
    resource,
    details,
    timestamp: new Date().toISOString()
  };

  try {
    const { error } = await supabase.from('audit_logs').insert(logEntry);
    if (error) {
        console.error('Failed to write audit log:', error.message);
    }
  } catch (err) {
    console.error('Error logging action:', err);
  }
};
