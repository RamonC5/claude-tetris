---
name: weather
description: Consulta la temperatura y el estado del clima actual para una ubicación (por defecto Mérida, Badajoz, España). Úsala cuando el usuario pida el clima, la temperatura o el pronóstico de un lugar, o invoque /weather.
---

# Weather — consulta de clima local

Da la temperatura y el estado del clima actual para una ubicación, usando búsqueda web.

## Uso

- `/weather` — usa la ubicación por defecto: **Mérida, Badajoz, España**.
- `/weather <lugar>` — usa el lugar indicado en `args` en su lugar.

## Pasos

1. Determina la ubicación: si el usuario pasó `args`, úsala; si no, usa "Mérida, Badajoz, España".
2. Usa la herramienta WebSearch con una consulta tipo `temperatura clima actual <ubicación> ahora`.
3. Extrae de los resultados: temperatura actual (o rango mañana/tarde/noche si no hay dato puntual), estado del cielo (soleado, nublado, lluvia, etc.) y viento si está disponible.
4. Responde en 2-3 líneas como máximo, en español, con el dato más reciente disponible. Si la búsqueda solo trae previsión y no un dato en tiempo real exacto, acláralo brevemente.
5. Incluye las fuentes usadas como enlaces markdown al final, tal como exige la herramienta WebSearch.
