import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const analyzeFinances = async (transactions: Transaction[], goals: any[], query: string) => {
  if (!process.env.GEMINI_API_KEY) {
    return "La API Key de Gemini no está configurada. Por favor, configúrala en los ajustes del proyecto.";
  }

  const systemPrompt = `
    Eres un asistente financiero experto y versátil llamado "Finanzas Pro AI". 
    Tu objetivo es ayudar al usuario a gestionar su dinero, entender sus gastos y alcanzar sus metas de ahorro, pero también puedes conversar sobre temas financieros más amplios, economía, inversiones y planificación de vida.
    
    Datos actuales del usuario:
    - Transacciones recientes: ${JSON.stringify(transactions.slice(0, 50))}
    - Metas de ahorro: ${JSON.stringify(goals)}
    
    Instrucciones de respuesta:
    1. Sé profesional, motivador y abierto a preguntas complejas.
    2. Si el usuario te saluda, responde amablemente y ofrece ayuda.
    3. Usa los datos del usuario para dar respuestas personalizadas cuando sea relevante.
    4. Si el usuario pregunta sobre algo fuera de finanzas, intenta relacionarlo con el impacto financiero si es posible, pero mantente flexible.
    5. Responde siempre en español.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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

export const predictFinances = async (transactions: Transaction[], goals: any[]) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("La API Key de Gemini no está configurada.");
  }

  const prompt = `
    Basado en el historial de transacciones y metas del usuario, realiza un análisis predictivo para el próximo mes.
    
    Datos:
    - Transacciones: ${JSON.stringify(transactions.slice(0, 100))}
    - Metas: ${JSON.stringify(goals)}
    
    Por favor proporciona:
    1. Una estimación de gastos totales para el próximo mes.
    2. Categorías donde es probable que gaste más.
    3. Una recomendación específica para alcanzar sus metas más rápido.
    4. Un "puntaje de salud financiera" del 1 al 100.
    
    Responde de forma estructurada y amigable en español.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "Eres un analista financiero predictivo de alto nivel.",
      },
    });
    
    return response.text;
  } catch (error) {
    console.error("Gemini Prediction Error:", error);
    throw new Error("No pude generar el análisis predictivo en este momento.");
  }
};

export const parseExcelData = async (csvText: string): Promise<Partial<Transaction>[]> => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("La API Key de Gemini no está configurada.");
  }

  const prompt = `
    Analiza los siguientes datos financieros en formato CSV y extrae una lista de transacciones.
    Para cada transacción necesito:
    - description (string)
    - amount (number, positivo)
    - type (string: "income" o "expense")
    - category (string, intenta categorizar si no está explícito)
    - date (string en formato YYYY-MM-DD)

    Datos CSV:
    ${csvText}

    Responde ÚNICAMENTE con un array JSON válido.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: {
        parts: [
          { text: prompt }
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
