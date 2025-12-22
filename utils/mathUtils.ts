
/**
 * يقوم بتقريب الرقم إلى منزلتين عشريتين بدقة عالية
 * يعالج مشاكل الفاصلة العائمة في جافاسكريبت
 * Round a number to 2 decimal places with high precision
 */
export const round = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * حساب قيمة الضريبة (15%)
 */
export const calculateTax = (amount: number, rate: number = 0.15): number => {
  return round(amount * rate);
};

/**
 * استخراج المبلغ الصافي قبل الضريبة من المبلغ الإجمالي
 * Net = Gross / 1.15
 */
export const calculateNetFromGross = (gross: number, rate: number = 0.15): number => {
  return round(gross / (1 + rate));
};
