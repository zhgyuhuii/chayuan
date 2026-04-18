<div align="center">

<img src="public/images/ai-assistant.svg" alt="Chayuan AI" width="120" height="120" />

# Chayuan AI Document Assistant — Vollständiges Handbuch

**[简体中文](README.md#简体中文完整说明)** · **[English](README.en.md)** · **[日本語](README.ja.md)** · **[Русский](README.ru.md)** · **[Español](README.es.md)** · **[Français](README.fr.md)** · **[README.md](README.md)**

</div>

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
