export default async (req) => {
  try {
    const formData = await req.formData();
    const pdfFile = formData.get("pdf");

    if (!pdfFile) {
      return new Response(paginaError("No se recibió ningún archivo PDF."), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    const arrayBuffer = await pdfFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return new Response(paginaProcesamiento(base64), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  } catch (err) {
    return new Response(paginaError("Error procesando el archivo: " + err.message), {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
};

export const config = { path: "/share-target" };

function paginaError(mensaje) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, Roboto, Arial, sans-serif; background:#f2f2f2; margin:0; padding:0; }
  .msg { font-size: 20px; text-align:center; padding: 60px 20px; color:#c62828; }
</style></head>
<body><div class="msg">❌ ${mensaje}</div></body>
</html>`;
}

function paginaProcesamiento(base64Pdf) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Procesando factura...</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, Roboto, Arial, sans-serif;
    background: #f2f2f2;
    margin: 0;
    padding: 16px;
    color: #222;
  }
  .big-status {
    font-size: 22px;
    text-align: center;
    padding: 60px 16px;
  }
  pre#preview {
    white-space: pre-wrap;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    background: #111;
    color: #0f0;
    padding: 12px;
    border-radius: 8px;
    max-height: 400px;
    overflow-y: auto;
    margin-top: 16px;
    display:none;
  }
  button {
    width: 100%;
    padding: 14px;
    font-size: 16px;
    font-weight: bold;
    border: none;
    border-radius: 8px;
    background: #555;
    color: #fff;
    margin-top: 10px;
  }
</style>
</head>
<body>

<div id="status" class="big-status">Leyendo factura compartida...</div>
<pre id="preview"></pre>
<button onclick="document.getElementById('preview').style.display='block'">Ver texto que se imprimió</button>

<script>
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const base64Pdf = "${base64Pdf}";

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function limpiar(txt) { return txt ? txt.trim() : "-"; }
function buscar(regex, texto, grupo = 1) {
  const m = texto.match(regex);
  return m ? limpiar(m[grupo]) : "-";
}

function parsearFactura(texto) {
  const t = texto.replace(/\\s+/g, " ");
  return {
    emisorNombre: buscar(/Emisor:\\s*(.+?)\\s*RUC:/, t),
    emisorRuc: buscar(/RUC:\\s*([\\d\\-]+)\\s*DV:/, t),
    emisorDV: buscar(/DV:\\s*(\\d+)\\s*Direcci/, t),
    emisorDir: buscar(/Direcci[oó]n:\\s*(.+?)\\s*Tipo de Receptor/, t),
    clienteNombre: buscar(/Cliente:\\s*(.+?)\\s*RUC\\/C[eé]dula/, t),
    clienteRuc: buscar(/RUC\\/C[eé]dula\\/Pasaporte:\\s*([\\d\\-]+)\\s*DV:/, t),
    clienteDV: buscar(/DV:\\s*(\\d+)\\s*Direcci[oó]n:\\s*\\w/, t),
    clienteDir: buscar(/Direcci[oó]n:\\s*(\\w+)\\s*N[uú]mero:/, t),
    numero: buscar(/N[uú]mero:\\s*(\\d+)/, t),
    fecha: buscar(/Fecha de Emisi[oó]n:\\s*([\\d\\/]+)/, t),
    puntoFact: buscar(/Punto de Facturaci[oó]n:\\s*(\\d+)/, t),
    cufe: buscar(/CUFE:\\s*([A-Z0-9\\-]+)/, t),
    protocolo: buscar(/Protocolo de autorizaci[oó]n:\\s*([\\d]+,\\s*de\\s*[\\d\\/\\s:]+)/, t),
    valorTotal: buscar(/Valor Total\\s*([\\d.]+)/, t),
    totalNeto: buscar(/Total Neto\\s*([\\d.]+)/, t),
    montoExento: buscar(/Monto Exento ITBMS\\s*([\\d.]+)/, t),
    montoGravado: buscar(/Monto Gravado ITBMS\\s*([\\d.]+)/, t),
    itbms: buscar(/\\bITBMS\\s*([\\d.]+)\\s*Total Impuesto/, t),
    totalImpuesto: buscar(/Total Impuesto\\s*([\\d.]+)/, t),
    total: buscar(/Total Impuesto\\s*[\\d.]+\\s*Total\\s*([\\d.]+)/, t),
    efectivo: buscar(/Efectivo\\s*([\\d.]+)/, t),
    totalPagado: buscar(/TOTAL PAGADO\\s*([\\d.]+)/, t),
    vuelto: buscar(/Vuelto\\s*([\\d.]+)/, t)
  };
}

function construirRecibo(d) {
  const linea = "-".repeat(32);
  return \`
        DGI
  COMPROBANTE AUXILIAR
  FACTURA ELECTRONICA
\${linea}
EMISOR
\${d.emisorNombre}
RUC: \${d.emisorRuc}  DV: \${d.emisorDV}
\${d.emisorDir}
\${linea}
CLIENTE
\${d.clienteNombre}
RUC/Ced: \${d.clienteRuc}  DV: \${d.clienteDV}
Dir: \${d.clienteDir}
\${linea}
Numero:      \${d.numero}
Fecha:       \${d.fecha}
Punto Fact:  \${d.puntoFact}

CUFE:
\${d.cufe}

Protocolo:
\${d.protocolo}
\${linea}
TOTALES
Valor Total:      \${d.valorTotal}
Total Neto:       \${d.totalNeto}
Monto Exento:     \${d.montoExento}
Monto Gravado:    \${d.montoGravado}
ITBMS:            \${d.itbms}
Total Impuesto:   \${d.totalImpuesto}
TOTAL:            \${d.total}
\${linea}
FORMA DE PAGO
Efectivo:      \${d.efectivo}
Total Pagado:  \${d.totalPagado}
Vuelto:        \${d.vuelto}
\${linea}
   Generado desde Facturador
      Gratuito SFEP - DGI

\`;
}

function construirImagenRecibo(texto, qrContenido) {
  const width = 384;
  const fontSize = 14;
  const lineHeight = 18;
  const lines = texto.split("\\n");

  const qr = qrcode(0, "M");
  qr.addData(qrContenido);
  qr.make();
  const moduleCount = qr.getModuleCount();
  const qrPixelSize = 220;
  const cell = qrPixelSize / moduleCount;

  const topTextHeight = lines.length * lineHeight + 10;
  const qrLabelHeight = 40;
  const totalHeight = topTextHeight + qrPixelSize + qrLabelHeight + 20;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, totalHeight);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";
  ctx.font = fontSize + "px 'Courier New', monospace";

  let y = 6;
  for (const line of lines) {
    ctx.fillText(line, 4, y);
    y += lineHeight;
  }

  y += 6;
  const qrX = (width - qrPixelSize) / 2;
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(qrX + c * cell, y + r * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
  }

  y += qrPixelSize + 10;
  ctx.textAlign = "center";
  ctx.font = "12px 'Courier New', monospace";
  ctx.fillText("Escanea para verificar en la DGI", width / 2, y);

  return canvas.toDataURL("image/png");
}

function imprimirRawBT(texto, cufe) {
  const qrContenido = "https://dgi-fep.mef.gob.pa/Consultas/FacturasPorCUFE/" + cufe;
  const dataUrl = construirImagenRecibo(texto, qrContenido);
  const base64 = dataUrl.split(",")[1];
  window.location.href = "rawbt:data:image/png;base64," + base64;
}

async function procesar() {
  try {
    const buffer = base64ToArrayBuffer(base64Pdf);
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(it => it.str).join(" ") + "\\n";
    }
    const datos = parsearFactura(fullText);
    const recibo = construirRecibo(datos);
    document.getElementById("preview").textContent = recibo;
    document.getElementById("status").textContent = "🖨️ Enviando a RawBT...";
    imprimirRawBT(recibo, datos.cufe);
    setTimeout(() => {
      document.getElementById("status").textContent = "✅ Impreso. Puedes cerrar esta pantalla.";
    }, 1500);
  } catch (err) {
    document.getElementById("status").textContent = "❌ Error: " + err.message;
  }
}

procesar();
</script>

</body>
</html>`;
}
