<div align="center">

<img src="public/images/ai-assistant.svg" alt="Chayuan AI" width="120" height="120" />

# Chayuan AI Document Assistant — Manual completo

**[简体中文](README.md#简体中文完整说明)** · **[English](README.en.md)** · **[日本語](README.ja.md)** · **[Русский](README.ru.md)** · **[Deutsch](README.de.md)** · **[Français](README.fr.md)** · **[README.md](README.md)**

</div>

---

## Novedades en v3.0 — Integración RAG de bases de conocimiento remotas

Consumo directo de bases de conocimiento corporativas / de equipo / personales dentro del editor WPS: la pregunta dispara recuperación automática, ensamblaje de contexto y respuesta con citas, además de descarga del adjunto original con un clic.

- **Doble modo de autenticación** (JWT usuario / HMAC aplicación), credenciales cifradas con AES-GCM
- **Pipeline de recuperación multi-fuente** (`services/kb`): reescritura → búsqueda por lotes → deduplicación → re-ranking → prompt con citas
- **Barra de citas con descarga del original**, las fuentes documento / estructurada / vectorial / office se diferencian visualmente
- **Auto-recuperación ante vínculos obsoletos**: si una KB es eliminada o se revocan permisos, la caché se limpia silenciosamente — sin alertas rojas "search_batch HTTP 403"
- **Reversión con un flag**: `kbRemoteIntegration` desactiva toda la pipeline RAG al instante

Notas de versión completas: [RELEASE_NOTES_v3.0.md](RELEASE_NOTES_v3.0.md)

---

## 🤖 Agente documental (MCP) — agentes de IA externos leen y escriben sus documentos WPS

Chayuan incluye un **servicio local de agente documental MCP (Model Context Protocol)** que expone **26 herramientas** para leer, localizar, reemplazar, comentar, revisar y recuperar información de bases de conocimiento (KB) sobre sus documentos WPS mediante un endpoint **MCP Streamable HTTP** estándar. Cualquier agente compatible con MCP — **Claude Code, OpenAI Codex, Cursor, Hermes, OpenClaw, Cline** — puede apuntar a una sola URL y trabajar directamente dentro de su documento WPS: abrirlo, leer el cuerpo, marcar erratas como comentarios, reemplazar texto por lotes y revisar varios documentos de forma cruzada.

- **Sin autenticación:** escucha únicamente en `127.0.0.1`; el *localhost* es la frontera de confianza. Para conectarse basta con una URL (sin token, comando ni stdio).
- **Totalmente offline:** el *sidecar* se ejecuta junto con WPS; los documentos y las claves nunca salen de su máquina — ideal para despliegues offline, de intranet o aislados (*air-gapped*).
- **Inicio automático al instalar:** los instaladores registran un autostart a nivel de sistema operativo (Windows `HKCU\…\Run` / macOS LaunchAgent / Linux systemd --user); no requiere Node.js.
- Las **26 herramientas** cubren estado del documento / lanzamiento / apertura / metadatos / lectura de párrafos y fragmentos / localización / reemplazo / inserción / comentarios / escritura por lotes / nuevo / guardar / desclasificar y restaurar / recuperación KB / revisión ortográfica y gramatical (como comentarios o correcciones directas en el texto) / búsqueda y exportación del asistente. Lista completa: [docs/mcp-connection.md](docs/mcp-connection.md).

### Conexión en una línea (válida para cualquier agente MCP)

Endpoint: `http://127.0.0.1:62588/mcp`  ·  Salud: `GET http://127.0.0.1:62588/healthz` (se espera `online`).

### Claude Code
```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```
o `.mcp.json`:
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
Cree un servicio MCP de tipo **HTTP / Streamable HTTP** que apunte a `http://127.0.0.1:62588/mcp` (sin token, comando ni stdio).

### Claude Desktop / otros clientes con configuración JSON
```json
{ "mcpServers": { "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" } } }
```

### Verificación con MCP Inspector
```bash
npx @modelcontextprotocol/inspector   # pick Streamable HTTP, paste the URL, Connect
```

> **Solución de problemas:** si un cliente no puede conectarse, asegúrese de que WPS esté abierto y de que el complemento Chayuan esté cargado (`GET /healthz` devuelve `online`). El servidor se vincula a `127.0.0.1:62588`; las máquinas remotas necesitan un proxy local o un `CHAYUAN_MCP_PORT` personalizado. Guía completa: [docs/mcp-connection.md](docs/mcp-connection.md).

---

## 1. Derechos de autor y licencia

**Nombre del software:** Chayuan AI Document Assistant (nombre de producto en chino **察元 AI 文档助手**, paquete npm **`chayuan`**). Código bajo **[Apache License 2.0](LICENSE)**. Se permite el uso comercial si se cumple la licencia. Los contratos adicionales prevalecen donde apliquen.

**Titular:** Beijing Zhilingniao Technology Center. **Sitio:** [https://aidooo.com](https://aidooo.com).

---

## 2. Regla especial: no cambie la marca «察元» en la interfaz

Sin autorización escrita, no sustituya ni oculte las cadenas fijas de marca **察元** y relacionadas en **cuadros de diálogo, cinta (Ribbon), menús contextuales, panel de tareas ni página Acerca de** (p. ej. **察元 AI**, **察元 AI 文档助手**, **关于察元**, **添加到察元 AI 助手**, textos de tipo de archivo **察元模板** / **察元规则** / **察元文档**). Las compilaciones redistribuidas con la UI oficial deben conservar esas indicaciones o contar con un acuerdo aparte.

---

## 3. Uso comercial

Permitido en el marco de Apache 2.0 y la sección 2; excepciones por contrato separado.

---

## 4. Descripción general

Complemento para **WPS Writer** (**Vue 3 + Vite**): chat de IA, resumen, análisis, traducción, multimodal, seguridad y desclasificación, procesamiento por lotes de documento/tablas/imágenes, formularios, plantillas/reglas, tareas y orquestación, con escritura en el documento (**insertar / reemplazar / comentario / comentario vinculado / anexar**). **Prioridad offline/intranet** con **Ollama** y API **compatibles con OpenAI**.

---

## 4.1 Versión 2.0.0: gran refactorización y estabilidad

**Versión actual: `3.0.13`.** Lo que sigue es el registro histórico de la versión `2.0.0`, conservado como referencia: esta versión resumió y actualizó el trabajo descrito en los Markdown de planificación y ejecución — plan v2, P0-P6, workflow W1-W7, rediseño del sistema de tareas, cierre de brechas de ejecución y diseño de formularios de asistentes.

- Los asistentes con parámetros muestran un formulario antes de ejecutarse: idioma de destino para traducción; relación de aspecto, duración y estilo de voz para imagen, vídeo y audio.
- La selección de modelos es segura por tipo: el chat solo muestra modelos conversacionales; los ajustes agrupan y filtran por tipo de modelo.
- El despliegue offline/intranet sigue siendo prioritario con Ollama, LM Studio, Xinference, OneAPI, New API y endpoints compatibles con OpenAI.
- Se refuerzan la estabilidad de tareas, reintentos, propagación de parámetros y escritura en documentos.

La comparación competitiva completa con **60 dimensiones** está en el README principal: [README.md § 4.2](README.md#42-60-项竞品能力对比察元-200-vs-常见办公-ai--文档-ai-工具).

---

## 5. Capturas de pantalla

| Asistente y chat | Tareas y revisión | Ajustes y modelos |
|:---:|:---:|:---:|
| ![Principal](public/images/about/screen-1.png) | ![Tareas](public/images/about/screen-2.png) | ![Ajustes](public/images/about/screen-3.png) |

<p align="center"><sub>Más UI</sub><br /><img src="public/images/about/screen-4.png" alt="Captura" width="720" /></p>

---

## 6–7. Funciones y asistentes integrados

Consulte la lista detallada en **[README.en.md](README.en.md)** o el manual completo en chino **[README.md](README.md#简体中文完整说明)**. Los asistentes personalizados permiten informes, anotaciones y flujos de edición adaptados a su organización.

---

## 8–9. Modelos y compilación

`npm install` · `npm run dev` · `npm run build` · `npm run build:wps` · depuración con **`wpsjs debug`**.

---

## 10. Donaciones

[aidooo.com](https://aidooo.com); respete los [Términos de GitHub](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).

---

<div align="center">

Chayuan · Vue 3 + Vite · Apache-2.0 · **no modifique la marca «察元» en diálogos y menús sin autorización** · **uso comercial permitido** salvo excepciones contractuales

</div>
