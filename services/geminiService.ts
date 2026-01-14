
import { GoogleGenAI, Type } from "@google/genai";

const getClient = () => {
  // Vite exposes only variables that start with VITE_
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (!key) {
    console.warn("Gemini API Key is missing. Set VITE_GEMINI_API_KEY in .env / Vercel.");
    return null;
  }

  return new GoogleGenAI({ apiKey: key });
};

export const generateReportAnalysis = async (dataContext: string): Promise<string> => {
  const client = getClient();
  if (!client) return "عذراً، مفتاح API غير متوفر لتحليل البيانات. يرجى التأكد من إعداد المتغيرات البيئية بشكل صحيح.";

  try {
    const prompt = `
      بصفتك مستشاراً مالياً خبيراً، قم بتحليل البيانات المالية التالية لنظام محاسبي (نظام مِرفاد).
      
      البيانات بتنسيق JSON:
      ${dataContext}

      المطلوب إعداد تقرير استراتيجي مفصل يتضمن:
      1. **ملخص تنفيذي**: نظرة شاملة على الصحة المالية للمنشأة.
      2. **تحليل الأداء المالي**: تقييم المبيعات، هوامش الربح، والمشتريات.
      3. **تحليل المخزون**: تحديد المنتجات الأكثر مبيعاً، الراكدة، والنواقص.
      4. **التوصيات والاستراتيجيات**: خطوات عملية لتحسين الربحية، تقليل الهدر، وزيادة كفاءة التشغيل.
      
      التعليمات:
      - اكتب باللغة العربية المهنية والسلسة.
      - استخدم تنسيقاً واضحاً مع نقاط وعناوين.
      - ركز على تقديم قيمة حقيقية لمدير المنشأة.
    `;

    const response = await client.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
    });

    return response.text || "لم يتم استلام رد من النظام الذكي.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "حدث خطأ أثناء تحليل البيانات بواسطة الذكاء الاصطناعي.";
  }
};

export interface ExtractedInvoiceData {
  invoiceNumber?: string;
  date?: string;
  supplierName?: string;
  taxNumber?: string;
  currency?: string;
  items?: {
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface ImageDataInput {
  base64: string;
  mimeType: string;
}

export const analyzeInvoiceImage = async (images: ImageDataInput[]): Promise<ExtractedInvoiceData | null> => {
  const client = getClient();
  if (!client || images.length === 0) return null;

  try {
    const prompt = `
      Role: Expert Data Entry Specialist for Saudi Accounting System (ZATCA compliant).
      Task: Extract data from the provided invoice image(s) into strict JSON.
      Note: There might be multiple pages of the same invoice. Process them as a single document.

      **PRIORITY 1: INVOICE NUMBER (رقم الفاتورة)**
      - You MUST extract the Invoice Number.
      - Look for: "Invoice No", "Inv No", "رقم الفاتورة", "فاتورة رقم", "الرقم التسلسلي".
      - Exclude VAT Numbers (starting with 3) and Phone Numbers.
      - Clean the value (remove "No.", "#").

      **PRIORITY 2: SUPPLIER & DATES**
      - **Supplier Name**: Extract the full name. **CRITICAL: PREFER ARABIC NAME** if available. If both English and Arabic are present, return the Arabic one.
      - **Date**: Format YYYY-MM-DD.
      - **Tax Number**: 15 digits (starts with 3).

      **PRIORITY 3: LINE ITEMS**
      - **Description**: Extract the item name/description. **CRITICAL: PREFER ARABIC TEXT** for description if available.
      - Quantity: Number.
      - **Unit Price**: Price BEFORE Tax. If "Inclusive of VAT" (شامل الضريبة), divide price by 1.15.

      **Output**: Return ONLY the JSON object conforming to the schema.
    `;

    // Construct content parts (images + prompt)
    const parts: any[] = images.map(img => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64
      }
    }));
    
    parts.push({ text: prompt });

    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: parts
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            invoiceNumber: { type: Type.STRING, description: "Unique invoice identifier" },
            date: { type: Type.STRING, description: "YYYY-MM-DD" },
            supplierName: { type: Type.STRING, description: "Supplier Name in Arabic if possible" },
            taxNumber: { type: Type.STRING, description: "VAT Number (15 digits)" },
            currency: { type: Type.STRING, description: "Currency (e.g., SAR)" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: "Item description in Arabic if possible" },
                  quantity: { type: Type.NUMBER },
                  unitPrice: { type: Type.NUMBER, description: "Price before tax" }
                }
              }
            }
          }
        }
      }
    });

    let jsonText = response.text;
    if (!jsonText) return null;

    try {
      // Clean Markdown code blocks if present
      jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonText) as ExtractedInvoiceData;
    } catch (parseError) {
      console.error("JSON Parse Error in Gemini Analysis:", parseError, jsonText);
      return null;
    }

  } catch (error) {
    console.error("Gemini Invoice Analysis Error:", error);
    return null;
  }
};
