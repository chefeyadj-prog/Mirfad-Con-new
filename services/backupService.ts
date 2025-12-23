
import { supabase } from './supabaseClient';
import { User } from '../types';

// الجداول التي يتم تضمينها في النسخة الاحتياطية
const CORE_TABLES = [
  'dailyClosings', 
  'purchases', 
  'products', 
  'suppliers', 
  'employees', 
  'salaryTransactions', 
  'general_expenses',
  'custody'
];

/**
 * إنشاء نسخة احتياطية شاملة للنظام
 */
export const createSystemBackup = async (user: User | null, description: string) => {
  try {
    const snapshot: Record<string, any> = {};

    // جلب البيانات من كافة الجداول المحددة
    for (const table of CORE_TABLES) {
      const { data, error } = await supabase.from(table).select('*');
      if (!error) {
        snapshot[table] = data;
      }
    }

    const backupEntry = {
      id: `BK-${Date.now()}`,
      created_at: new Date().toISOString(),
      created_by: user?.name || 'النظام التلقائي',
      description: description,
      snapshot: snapshot
    };

    const { error } = await supabase.from('backups').insert(backupEntry);
    if (error) throw error;
    
    return { success: true, id: backupEntry.id };
  } catch (err) {
    console.error("Backup failed:", err);
    return { success: false, error: err };
  }
};

/**
 * استعادة النظام إلى نسخة سابقة
 * ملاحظة: هذه العملية لا تحذف سجل النسخ الاحتياطية نفسه
 */
export const restoreFromBackup = async (backupId: string) => {
  try {
    const { data: backup, error: fetchErr } = await supabase
      .from('backups')
      .select('snapshot')
      .eq('id', backupId)
      .single();

    if (fetchErr || !backup) throw new Error("تعذر العثور على النسخة");

    const snapshot = backup.snapshot;

    // مسح الجداول الحالية وإعادة ملئها ببيانات النسخة
    for (const table of CORE_TABLES) {
      if (snapshot[table]) {
        // حذف البيانات الحالية (باستخدام شرط دائم التحقق لضمان الحذف الشامل)
        await supabase.from(table).delete().neq('id', 'dummy_non_existent_id_123');
        
        // إدراج بيانات النسخة إذا كانت موجودة
        if (snapshot[table].length > 0) {
          await supabase.from(table).insert(snapshot[table]);
        }
      }
    }

    return { success: true };
  } catch (err) {
    console.error("Restore failed:", err);
    return { success: false, error: err };
  }
};
