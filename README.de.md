<div align="center">

<img src="public/images/ai-assistant.svg" alt="Chayuan AI" width="120" height="120" />

# Chayuan AI Document Assistant — Vollständiges Handbuch

**[简体中文](README.md#简体中文完整说明)** · **[English](README.en.md)** · **[日本語](README.ja.md)** · **[Русский](README.ru.md)** · **[Español](README.es.md)** · **[Français](README.fr.md)** · **[README.md](README.md)**

</div>

---

## Neu in v3.0 — RAG-Integration mit Remote-Wissensdatenbank

Direkte Nutzung von Unternehmens- / Team- / persönlichen Wissensdatenbanken im WPS-Editor: Frage → automatischer Abruf → Kontextzusammenstellung → Antwort mit Zitaten und Ein-Klick-Download des Originaldokuments.

- **Duale Authentifizierung** (JWT-Benutzer / HMAC-Anwendung), Anmeldedaten mit AES-GCM verschlüsselt
- **Multi-Source-Retrieval-Pipeline** (`services/kb`): Umformulierung → Batch-Suche → Deduplizierung → Re-Ranking → Prompt mit Zitaten
- **Zitate-Leiste mit Original-Download**, Dokument- / strukturierte / Vektor- / Office-Quellen werden klar unterschieden
- **Selbstheilung bei veralteten Bindungen**: gelöschte KBs oder entzogene Rechte leeren den Cache stillschweigend — keine roten "search_batch HTTP 403"-Toasts mehr
- **Ein-Schalter-Rollback**: `kbRemoteIntegration`-Flag deaktiviert die gesamte RAG-Pipeline auf einen Schlag

Vollständige Versionshinweise: [RELEASE_NOTES_v3.0.md](RELEASE_NOTES_v3.0.md)

---

## 🤖 Dokumenten-Agent (MCP) — externe KI-Agenten können Ihre WPS-Dokumente lesen & schreiben

Chayuan liefert einen **lokalen MCP-Dokumenten-Agenten-Service (Model Context Protocol)**, der **26 Werkzeuge** zum Lesen, Lokalisieren, Ersetzen, Kommentieren, Korrekturlesen und für die Wissensdatenbank-Recherche über Ihre WPS-Dokumente als Standard-**Streamable-HTTP-MCP**-Endpunkt bereitstellt. Jeder MCP-fähige Agent — **Claude Code, OpenAI Codex, Cursor, Hermes, OpenClaw, Cline** — kann eine einzige URL ansteuern und direkt innerhalb Ihres WPS-Dokuments arbeiten: es öffnen, den Haupttext lesen, Tippfehler als Kommentare markieren, Text stapelweise ersetzen, mehrere Dokumente querprüfen.

- **Keine Authentifizierung:** lauscht ausschließlich auf `127.0.0.1` — der Localhost ist die Vertrauensgrenze; für die Verbindung genügt eine URL (kein Token / Befehl / stdio).
- **Vollständig offline:** der Sidecar wird zusammen mit WPS mitgeliefert; Dokumente und Schlüssel verlassen nie Ihren Rechner — geeignet für Offline-/Intranet-/Air-Gap-Einsätze.
- **Automatischer Start bei der Installation:** die Installer registrieren einen Autostart auf Betriebssystemebene (Windows `HKCU\…\Run` / macOS LaunchAgent / Linux systemd --user); kein Node.js erforderlich.
- **26 Werkzeuge** decken Dokumentstatus / Start / Öffnen / Metadaten / Absatz- + Chunk-Lesungen / Lokalisieren / Ersetzen / Einfügen / Kommentare / stapelweises Zurückschreiben / Neu / Speichern / Entstufen & Wiederherstellen / KB-Recherche / Rechtschreib- & Grammatikprüfung (als Kommentare oder direkte Textkorrekturen) / Assistentensuche & -export ab. Vollständige Liste: [docs/mcp-connection.md](docs/mcp-connection.md).

### Einzeilige Verbindung (funktioniert für jeden MCP-Agenten)

Endpunkt: `http://127.0.0.1:62588/mcp`  ·  Healthcheck: `GET http://127.0.0.1:62588/healthz` (erwartet `online`).

### Claude Code
```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```
oder `.mcp.json`:
```json
{ "mcpServers": { "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" } } }
```

### OpenAI Codex (codex CLI) — `~/.codex/config.toml`
```toml
[mcp_servers.chayuan-wps-mcp]
url = "http://127.0.0.1:62588/mcp"
```

### Cursor — `.cursor/mcp.json`
```json
{ "mcpServers": { "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" } } }
```

### Hermes / OpenClaw
Erstellen Sie einen MCP-Service vom Typ **HTTP / Streamable HTTP**, der auf `http://127.0.0.1:62588/mcp` zeigt (kein Token / Befehl / stdio).

### Claude Desktop / andere JSON-Konfigurations-Clients
```json
{ "mcpServers": { "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" } } }
```

### Verifizieren mit dem MCP Inspector
```bash
npx @modelcontextprotocol/inspector   # pick Streamable HTTP, paste the URL, Connect
```

> **Fehlerbehebung:** Wenn ein Client keine Verbindung herstellen kann, stellen Sie sicher, dass WPS geöffnet und das Chayuan-Add-in geladen ist (`GET /healthz` liefert `online`). Der Server bindet `127.0.0.1:62588`; entfernte Rechner benötigen einen lokalen Proxy oder einen benutzerdefinierten `CHAYUAN_MCP_PORT`. Vollständige Anleitung: [docs/mcp-connection.md](docs/mcp-connection.md).

---

## 1. Urheberrecht und Lizenz

**Softwarename:** Chayuan AI Document Assistant (chinesischer Produktname **察元 AI 文档助手**, npm-Paket **`chayuan`**). Lizenz: **[Apache License 2.0](LICENSE)**. Bei Einhaltung der Lizenz sind Nutzung, Änderung, Weitergabe und **kommerzielle Nutzung** erlaubt. Separate Verträge gehen vor.

**Rechteinhaber:** Beijing Zhilingniao Technology Center. **Website:** [https://aidooo.com](https://aidooo.com).

---

## 2. Markenhinweis: „察元“ in der Benutzeroberfläche

**Ohne schriftliche Genehmigung** dürfen feste chinesische Markenzeichenketten wie **察元**, **察元 AI**, **察元 AI 文档助手**, Menüeinträge wie **关于察元**, **添加到察元 AI 助手** sowie zugehörige Dateitypbeschreibungen in **Dialogen, Ribbon, Kontextmenü, Aufgabenbereich und Info-Seite** nicht so ersetzt oder entfernt werden, dass die Herkunft täuscht. Interne Codeänderungen unter Apache 2.0 bleiben möglich; **öffentlich verteilte Builds** mit offiziellem UI müssen diese Kennzeichnung beibehalten oder einer gesonderten Vereinbarung folgen.

---

## 3. Kommerzielle Nutzung

Unter Apache 2.0 und Einhaltung von Abschnitt 2 grundsätzlich erlaubt; Ausnahmen durch Zusatzverträge.

---

## 4. Überblick

Add-in für **WPS Writer** (**Vue 3 + Vite**): KI-Chat, Zusammenfassung, Textanalyse, Übersetzung, Multimodalität, Sicherheit/Entstufung, Stapelverarbeitung, Formulare, Vorlagen/Regeln, Aufgabenlisten—mit **Einfügen/Ersetzen/Kommentar/verknüpfter Kommentar/Anhängen**. **Offline/Intranet zuerst** über **Ollama** und **OpenAI-kompatible** Endpunkte.

---

## 4.1 Version 2.0.0: große Refaktorierung und Stabilität

> **Hinweis:** Die aktuelle Version ist **`3.0.13`**. Der folgende Abschnitt ist das historische Changelog des v2.0-Release und wird als Dokumentation beibehalten.

Dieses Release fasst die Ergebnisse der Markdown-Planungsdateien zusammen: v2-Evolution, P0-P6, Workflow W1-W7, neues Task-System, Laufzeit-Lücken, Assistant-Formularlayout und Projektstatus.

- Assistenten mit Parametern fragen vor der Ausführung Werte ab, z. B. Zielsprache bei Übersetzung oder Seitenverhältnis/Dauer/Stimme für Bild, Video und Audio.
- Die Modellauswahl ist typisiert: Chat-Dialog nur Chat-Modelle; Einstellungen filtern nach Modelltyp; Modelllisten werden gruppiert.
- Offline-/Intranet-Betrieb über Ollama, LM Studio, Xinference, OneAPI, New API und OpenAI-kompatible Gateways bleibt zentral.
- Verbesserungen an Stabilität, Aufgabenfortschritt, Retry, Parameterweitergabe und Dokument-Write-back.

Die vollständige Konkurrenzanalyse mit **60 Vergleichspunkten** steht im Hauptdokument: [README.md § 4.2](README.md#42-60-项竞品能力对比察元-200-vs-常见办公-ai--文档-ai-工具).

---

## 5. Screenshots

| Assistent & Chat | Aufgaben & Prüfung | Einstellungen & Modelle |
|:---:|:---:|:---:|
| ![Haupt](public/images/about/screen-1.png) | ![Tasks](public/images/about/screen-2.png) | ![Settings](public/images/about/screen-3.png) |

<p align="center"><sub>Weitere UI</sub><br /><img src="public/images/about/screen-4.png" alt="Screenshot" width="720" /></p>

---

## 6. Funktionsübersicht

Über **Chayuan AI Assistant**, **Textanalyse**, **Übersetzung**, **Multimodal**, **Intelligente Assistenten**, **Sicherheit**, Stapelwerkzeuge für **Dokument/Tabellen/Bilder**, **Chayuan AI Review** (Formulare, Audit, Vorlagen, Regeln), **Einstellungen**, Kontextmenü **Zu Chayuan AI Assistant hinzufügen**.

**Erweiterung:** benutzerdefinierte Assistenten, Aufgabenorchestrierung, Berichtsmodus.

---

## 7. Eingebaute Assistenten (Kurz)

Rechtschreibprüfung (JSON), Zusammenfassung, Übersetzung, Text→Bild/Audio/Video; Umschreiben, erweitern, kürzen; Kommentar-/Hyperlink-Erklärung; Korrektur; Stichworte; Absatznummerierung; „KI-Spuren“-Check; Geheimhaltungsprüfung; Schlüsselwort-Extraktion für Entstufung; Formularfelder; Dokumentenaudit; stilistische Hilfen; Maßnahmen/Risiken; Terminologie; Titel; Struktur; Sitzungsprotokoll; Behörden-/Policy-Stil. Details in `src/utils/assistantRegistry.js`.

---

## 8. Modelle & Build

Konfiguration in den Einstellungen. `npm install`, `npm run dev`, `npm run build`, `npm run build:wps`. WPS-Debugging: **`wpsjs debug`**.

---

## 9. Spenden

[aidooo.com](https://aidooo.com); [GitHub-Nutzungsbedingungen](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) beachten.

---

<div align="center">

Chayuan · Vue 3 + Vite · Apache-2.0 · **Markenstrings „察元“ in Dialogen, Ribbon und Menüs nicht ohne Genehmigung ändern** · **Kommerzielle Nutzung unter Apache 2.0 möglich**

</div>
