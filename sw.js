const CACHE_NAME = "factura-rawbt-share-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Intercepta el POST que Android manda cuando el usuario comparte el PDF
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === "POST" && url.pathname.endsWith("/share-target/")) {
    event.respondWith(handleShareTarget(event));
  }
});

async function handleShareTarget(event) {
  try {
    const formData = await event.request.formData();
    const pdfFile = formData.get("pdf");

    if (pdfFile) {
      const cache = await caches.open(CACHE_NAME);
      // Guardamos el PDF compartido con una clave fija que la app leerá al abrir
      await cache.put(
        "/shared-pdf",
        new Response(pdfFile, {
          headers: { "Content-Type": "application/pdf" }
        })
      );
    }

    // Redirige a la app con una bandera para que sepa que debe autoprocesar
    const base = url.pathname.replace(/share-target\/$/, "");
    return Response.redirect(base + "index.html?shared=1", 303);
  } catch (err) {
    const base = url.pathname.replace(/share-target\/$/, "");
    return Response.redirect(base + "index.html?shared=error", 303);
  }
}
