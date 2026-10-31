# numerador-facturas-mcp

<!-- mcp-name: io.github.nuncaeslupus/numerador-facturas -->

Servidor [MCP](https://modelcontextprotocol.io) para que un LLM numere facturas PDF en lote:
estampa `F-0001`, `F-0002`… en todas las páginas de cada factura y escribe copias numeradas.

Es el mismo código que la [web](https://nuncaeslupus.github.io/numerador-facturas/), sin UI.

**Privado y sin red.** Se ejecuta en tu equipo como proceso local. El LLM le pasa rutas, no el
contenido de los PDFs, y solo recibe la lista de archivos generados. No necesita cuenta ni
conexión, y los originales no se modifican. Si le pides al LLM que lea una factura, ese
contenido sí pasa por tu proveedor de LLM.

## Instalar

**Claude Desktop:** descarga
[`numerador-facturas.mcpb`](https://nuncaeslupus.github.io/numerador-facturas/numerador-facturas.mcpb)
y ábrelo.

**Claude Code:**

```bash
claude mcp add --scope user numerador-facturas -- npx -y numerador-facturas-mcp
```

**Otros clientes MCP:**

```json
{
  "mcpServers": {
    "numerador-facturas": { "command": "npx", "args": ["-y", "numerador-facturas-mcp"] }
  }
}
```

Requiere Node 20 o superior. El servidor no tiene dependencias en tiempo de ejecución y no hace
peticiones de red. `npx` sí consulta npm al arrancar para buscar versiones nuevas, sin enviar
nada de tus facturas; si no quieres ni eso, usa el `.mcpb`.

## Usar

Pídelo con normalidad: «numera las facturas de esta carpeta desde la F-0500».

La herramienta `number_invoices` acepta las mismas opciones que la web (plantilla, inicio o
fin, orden, posición, fuente, recuadro, PDF unido, ZIP), más `dry_run` para ver la numeración
sin escribir nada.

A diferencia de la web, si un archivo está protegido, o detecta que está dañado o incompleto, no
numera ninguno, para no dejar huecos en la serie. La comprobación mira la estructura del PDF: un
daño dentro del contenido de una página puede pasar sin detectarse. Tampoco sobrescribe archivos
existentes, y si falla al escribir borra lo que haya escrito. Rechaza una posición que caiga fuera
de alguna página, pero no comprueba que el número quepa entero. Las copias de un PDF protegido
salen sin contraseña.

## Publicar

La versión vive en `package.json`, `manifest.json` y `server.json`, y un test exige que coincidan.
La primera vez, desde `mcp/` y con sesión en npm:

```bash
npm publish --access public
```

Después configura en npm el trusted publisher (repositorio `nuncaeslupus/numerador-facturas`,
workflow `release-mcp.yml`). Las siguientes versiones salen al empujar un tag `mcp-vX.Y.Z`, que
publica en npm y en el registro de MCP. La primera no llega al registro por sí sola: empuja
también su tag, con la publicación en npm ya hecha. Publica en npm antes de fusionar a `main`:
la web anuncia este nombre de paquete, y hasta entonces cualquiera podría registrarlo.

## Licencia

MIT
