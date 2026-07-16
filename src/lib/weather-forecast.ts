type WeatherForecast = {
  available: boolean;
  location?: string;
  date?: string;
  condition?: string;
  weather_code?: number;
  temperature_max?: number;
  temperature_min?: number;
  precipitation_probability?: number;
  precipitation_sum?: number;
  wind_speed_max?: number;
  error?: string;
};

function weatherLabel(code: number) {
  if (code === 0) return 'Céu limpo';
  if ([1, 2].includes(code)) return 'Poucas nuvens';
  if (code === 3) return 'Nublado';
  if ([45, 48].includes(code)) return 'Neblina';
  if (code >= 51 && code <= 67) return 'Chuva';
  if (code >= 80 && code <= 82) return 'Pancadas de chuva';
  if (code >= 95) return 'Temporal';
  return 'Tempo variável';
}

export async function fetchWeatherForecast(city: string, state?: string | null, beach?: string | null): Promise<WeatherForecast> {
  try {
    const query = [city, state, 'Brasil'].filter(Boolean).join(', ');
    const geocodeUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geocodeUrl.searchParams.set('name', query);
    geocodeUrl.searchParams.set('count', '1');
    geocodeUrl.searchParams.set('language', 'pt');
    geocodeUrl.searchParams.set('countryCode', 'BR');
    const geocodeResponse = await fetch(geocodeUrl, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    if (!geocodeResponse.ok) return { available: false, error: 'Localização não encontrada.' };
    const geocode = await geocodeResponse.json();
    const place = geocode.results?.[0];
    if (!place) return { available: false, error: 'Localização não encontrada.' };

    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
    forecastUrl.searchParams.set('latitude', String(place.latitude));
    forecastUrl.searchParams.set('longitude', String(place.longitude));
    forecastUrl.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max');
    forecastUrl.searchParams.set('timezone', 'America/Sao_Paulo');
    forecastUrl.searchParams.set('forecast_days', '3');
    const forecastResponse = await fetch(forecastUrl, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8000) });
    if (!forecastResponse.ok) return { available: false, error: 'Previsão indisponível.' };
    const forecast = await forecastResponse.json();
    const index = Math.min(1, Math.max(0, (forecast.daily?.time || []).length - 1));
    const code = Number(forecast.daily?.weather_code?.[index] ?? -1);
    return {
      available: true,
      location: [beach, place.name, place.admin1].filter(Boolean).join(' · '),
      date: forecast.daily?.time?.[index],
      condition: weatherLabel(code),
      weather_code: code,
      temperature_max: Number(forecast.daily?.temperature_2m_max?.[index] || 0),
      temperature_min: Number(forecast.daily?.temperature_2m_min?.[index] || 0),
      precipitation_probability: Number(forecast.daily?.precipitation_probability_max?.[index] || 0),
      precipitation_sum: Number(forecast.daily?.precipitation_sum?.[index] || 0),
      wind_speed_max: Number(forecast.daily?.wind_speed_10m_max?.[index] || 0),
    };
  } catch (error) {
    console.warn('Weather forecast unavailable:', error);
    return { available: false, error: 'Não foi possível consultar o clima agora.' };
  }
}
