# Icon-Integration – Anweisung für Claude Code

## Ausgangslage
Das App-Icon liegt als PNG vor (1024×1024, RGBA).
Dateiname: `tagbuch-icon.png`
Farben: Navy #0F1B2D (Hintergrund), Gold #C9A84C (Icon)

## Aufgaben

### 1. Dateien platzieren
```
app/assets/icon.png              ← das Original-PNG (1024×1024)
app/assets/adaptive-icon.png     ← dasselbe PNG als Vordergrund
app/assets/splash.png            ← dasselbe PNG, zentriert auf weißem/dunklem BG
```

### 2. app.json anpassen
```json
{
  "expo": {
    "name": "taGbuch",
    "slug": "tagbuch",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0F1B2D"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0F1B2D"
      },
      "package": "de.tagbuch.app"
    }
  }
}
```

### 3. Theme-Farben aus dem Icon ableiten
Primärfarbe:   `#0F1B2D`  (Navy, Hintergrund)
Akzentfarbe:   `#C9A84C`  (Gold, Icon-Elemente)
Text hell:     `#FFFFFF`
Text gedimmt:  `#8A9BB0`

Diese Farben als Constants in `/constants/Colors.ts` anlegen und durchgehend verwenden.

### 4. Splash Screen
- Hintergrund: `#0F1B2D`
- Icon zentriert, `resizeMode: contain`
- Kein Schriftzug auf dem Splash nötig

### Hinweis
Das PNG hat bereits den gerundeten Hintergrund eingebettet.
Für den Android Adaptive Icon den Hintergrund auf `#0F1B2D` setzen,
damit das System-Cropping sauber funktioniert.
