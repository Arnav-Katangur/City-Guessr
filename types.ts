export enum GameState {
  MENU = 'MENU',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  RESULT = 'RESULT',
  ERROR = 'ERROR',
  MAP = 'MAP',
}

export interface CityData {
  cityName: string;
  country: string;
  distractors: string[]; // 3 incorrect cities
  funFact: string;
  lat: number;
  lng: number;
}

export interface Question extends CityData {
  imageUrl: string; // Base64 data URI or URL
  options: string[];
  imageCredit?: {
    name: string;
    url: string;
  };
}

export interface CityStats {
  city: string;
  country: string;
  lat: number;
  lng: number;
  correct: number;
  wrong: number;
}