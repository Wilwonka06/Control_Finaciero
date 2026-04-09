import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const analyzeFinances = async (transactions: Transaction[], goals: any[], query: string) => {
  if (!process.env.GEMINI_API_KEY) {
    return "La API Key de Gemini no está configurada. Por favor, configúrala en los ajustes del proyecto.";
  }

  const systemPrompt = `
    Eres un asistente financiero experto llamado "Finanzas Pro AI". 
    Tu objetivo es ayudar al usuario a gestionar su dinero, entender sus gastos y alcanzar sus metas de ahorro.
    
    Datos actuales del usuario:
    - Transacciones recientes: ${JSON.stringify(transactions.slice(0, 50))}
    - Metas de ahorro: ${JSON.stringify(goals)}
    
    Instrucciones de respuesta:
    1. Sé conciso, profesional y motivador.
    2. Si el usuario te saluda (ej. "hola"), responde amablemente, preséntate y ofrece ayuda con sus finanzas.
    3. Si el usuario hace una pregunta general, responde basándote en los datos si es posible, o da consejos financieros generales.
    4. Si detectas problemas en los gastos, sugiérele formas de ahorrar.
    5. Responde siempre en español.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: query }] }],
      config: {
        systemInstruction: systemPrompt,
      },
    });
    
    if (!response.text) {
      throw new Error("Empty response from Gemini");
    }

    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Lo siento, tuve un problema al conectar con mi cerebro de IA. Por favor, intenta de nuevo en unos momentos.";
  }
};

export const parseExcelData = async (base64Data: string, mimeType: string): Promise<Partial<Transaction>[]> => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("La API Key de Gemini no está configurada.");
  }

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
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Data, mimeType } }
        ]
      },
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

    if (!response.text) {
      throw new Error("Empty response from Gemini during parsing");
    }

    return JSON.parse(response.text.trim() || "[]");
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    throw new Error("No pude procesar el archivo. Asegúrate de que sea un formato válido y que la IA esté disponible.");
  }
};
