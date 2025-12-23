
import { supabase } from './supabaseClient';
import { User } from '../types';
import { createSystemBackup } from './backupService';

export const logAction = async (
  user: User | null,
  action: 'create' | 'update' | 'delete' | 'login',
  resource: string,
  details: string
) => {
  if (!user) return;

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
    
    // تشغيل النسخ الاحتياطي التلقائي فوراً بعد أي تعديل أو حذف أو إضافة
    if (action !== 'login' && !error) {
       // يتم استدعاؤه بشكل غير متزامن لضمان سرعة واجهة المستخدم
       createSystemBackup(user, `نسخة تلقائية (بعد ${action} في ${resource})`);
    }

    if (error) console.error('AuditLog Error:', error.message);
  } catch (err) {
    console.error('AuditLog Catch Error:', err);
  }
};
