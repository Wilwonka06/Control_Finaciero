import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const analyzeFinances = async (transactions: Transaction[], goals: any[], query: string) => {
  const context = `
    Eres un asistente financiero experto llamado "Finanzas Pro AI". 
    Datos actuales del usuario:
    - Transacciones: ${JSON.stringify(transactions.slice(0, 50))}
    - Metas: ${JSON.stringify(goals)}
    
    Responde de forma concisa, profesional y motivadora. Ayuda al usuario a entender sus gastos, ahorrar más y alcanzar sus metas.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: "user", parts: [{ text: context + "\n\nPregunta del usuario: " + query }] }
      ]
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Lo siento, tuve un problema analizando tus finanzas. Intenta de nuevo más tarde.";
  }
};

export const parseExcelData = async (base64Data: string, mimeType: string): Promise<Partial<Transaction>[]> => {
  const prompt = `
    Analiza este archivo financiero y extrae una lista de transacciones.
    Para cada transacción necesito:
    - description (string)
    - amount (number, positivo)
    - type (string: "income" o "expense")
    - category (string, intenta categorizar si no está explícito)
    - date (string en formato YYYY-MM-DD)

    Responde ÚNICAMENTE con un array JSON válido.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ["income", "expense"] },
              category: { type: Type.STRING },
              date: { type: Type.STRING }
            },
            required: ["description", "amount", "type", "category", "date"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    throw new Error("No pude procesar el archivo. Asegúrate de que sea un formato válido.");
  }
};
