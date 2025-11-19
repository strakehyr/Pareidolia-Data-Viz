import { GoogleGenAI } from "@google/genai";
import { DataPoint, SeriesConfig } from "../types";

// Safe initialization
const getAIClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
};

export const generateDataInsights = async (
    data: DataPoint[], 
    xAxisCol: string, 
    series: SeriesConfig[]
): Promise<string> => {
    const ai = getAIClient();
    if (!ai) {
        return "API Key not found. Please set process.env.API_KEY to use AI insights.";
    }

    // Prepare a summary of the data to avoid token limits
    // Take first 5, middle 5, last 5 rows, and some basic stats
    const sampleSize = 5;
    const head = data.slice(0, sampleSize);
    const tail = data.slice(-sampleSize);
    
    const yColumns = series.map(s => s.columnName);
    
    const summaryContext = `
    Dataset Summary:
    Total Rows: ${data.length}
    X-Axis Column: ${xAxisCol}
    Y-Axis Columns (Series): ${yColumns.join(', ')}
    
    Data Sample (Head):
    ${JSON.stringify(head)}

    Data Sample (Tail):
    ${JSON.stringify(tail)}
    `;

    const prompt = `
    You are a senior data analyst. Analyze the provided dataset summary (JSON samples from head and tail of a time-series or sequential dataset).
    
    1. Identify any obvious trends (increasing, decreasing, seasonality) based on the samples.
    2. Point out any potential data quality issues (nulls, zeroes, abrupt jumps) if visible.
    3. Suggest what kind of specific analysis might be useful for this data.
    
    Keep the response concise, professional, and formatted in Markdown.
    Do not output JSON. Output readable text.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Context: ${summaryContext}\n\nTask: ${prompt}`,
            config: {
                temperature: 0.2,
            }
        });

        return response.text || "No insights generated.";
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Failed to generate insights. Please try again later.";
    }
};