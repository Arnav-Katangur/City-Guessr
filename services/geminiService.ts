import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CityData, Question } from "../types";

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });
const UNSPLASH_ACCESS_KEY = "oRApllpqrojcc5afa7rhatQiBvy5xbqrWHw4Qwrh3No";

const cityDataSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cityName: {
      type: Type.STRING,
      description: "The name of the national capital city.",
    },
    country: {
      type: Type.STRING,
      description: "The country where the city is the capital.",
    },
    distractors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 other capital cities from the same region or continent.",
    },
    funFact: {
      type: Type.STRING,
      description: "A short, interesting fact about this city.",
    },
    lat: {
      type: Type.NUMBER,
      description: "Latitude of the city.",
    },
    lng: {
      type: Type.NUMBER,
      description: "Longitude of the city.",
    },
  },
  required: ["cityName", "country", "distractors", "funFact", "lat", "lng"],
};

async function getUnsplashImage(city: string): Promise<{ url: string; credit: { name: string; url: string } }> {
  try {
    const query = `${city} skyline`;
    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`Unsplash API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      url: data.urls.regular,
      credit: {
        name: data.user.name,
        url: data.user.links.html,
      }
    };
  } catch (error) {
    console.error("Failed to fetch Unsplash image", error);
    throw error;
  }
}

export const generateQuestionData = async (excludeCities: string[] = [], useRealImage: boolean = false): Promise<Question> => {
  const ai = getAiClient();

  // 1. Generate City Data
  // Prompt explicitly asks for capital cities from random countries globally.
  const textPrompt = `Select a national capital city from a sovereign country.
  Pick randomly from any continent (Africa, Asia, Europe, North America, South America, Oceania) to ensure global coverage.
  Do NOT use these cities: ${excludeCities.join(', ')}.
  Provide the city name, country, coordinates, incorrect options (must be other capital cities), and a fun fact.`;

  const textResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: textPrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: cityDataSchema,
    },
  });

  const rawJson = textResponse.text;
  if (!rawJson) throw new Error("Failed to generate city data.");
  
  const cityData: CityData = JSON.parse(rawJson);

  let imageUrl = "";
  let imageCredit;

  if (useRealImage) {
      // 2a. Fetch from Unsplash API
      const unsplashData = await getUnsplashImage(cityData.cityName + " skyline");
      imageUrl = unsplashData.url;
      imageCredit = unsplashData.credit;
  } else {
      // 2b. Generate Image for the City via AI
      const imagePrompt = `A photorealistic, high-quality, wide-angle daytime skyline view of ${cityData.cityName}, ${cityData.country}. Buildings in skyline.`;

      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: imagePrompt }
          ]
        },
        config: {
            imageConfig: {
                aspectRatio: "16:9",
            }
        }
      });

      // Extract image from response parts
      if (imageResponse.candidates && imageResponse.candidates[0].content.parts) {
          for (const part of imageResponse.candidates[0].content.parts) {
              if (part.inlineData && part.inlineData.data) {
                  imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                  break;
              }
          }
      }
      
      if (!imageUrl) throw new Error("Failed to generate AI image.");
  }

  // Shuffle options for Multiple Choice
  const options = [...cityData.distractors, cityData.cityName];
  // Fisher-Yates shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    ...cityData,
    imageUrl,
    imageCredit,
    options,
  };
};