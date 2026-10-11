# Agente de IA de WhatsApp — PolosJ2

## Estado actual

Primer prototipo técnico en la rama `feature/whatsapp-ai-agent`. No está desplegado en producción y no modifica el comportamiento de la tienda hasta que se revise y despliegue.

El endpoint `/api/whatsapp-agent` incluye:
- Verificación del webhook de Meta por GET.
- Validación de firma `X-Hub-Signature-256` para los POST.
- Respuesta a mensajes de texto, botones y respuestas interactivas.
- Generación de una respuesta con la API de OpenAI y envío por WhatsApp Cloud API.
- No registra el contenido de los mensajes ni los teléfonos en logs.

## Variables de entorno necesarias en Vercel

Configurar únicamente en **Preview** al principio; nunca poner secretos en el código ni en GitHub.

- `WHATSAPP_VERIFY_TOKEN`: cadena secreta creada por nosotros para verificar el webhook.
- `META_APP_SECRET`: App Secret de la aplicación de Meta; se usa para validar la firma de cada POST.
- `WHATSAPP_ACCESS_TOKEN`: token de acceso de WhatsApp Cloud API.
- `WHATSAPP_PHONE_NUMBER_ID`: ID del número de WhatsApp de Cloud API, no el número telefónico visible.
- `OPENAI_API_KEY`: clave secreta de OpenAI.
- `OPENAI_MODEL`: opcional; modelo disponible en la cuenta de OpenAI, por ejemplo `gpt-4.1-mini`.
- `WHATSAPP_GRAPH_VERSION`: opcional; versión de Graph API habilitada para la app de Meta (el código tiene un valor predeterminado que debe confirmarse al configurar Meta).

## URL del webhook

Una vez desplegado el Preview, registrar en Meta la URL de ese despliegue terminada en `/api/whatsapp-agent` y el mismo `WHATSAPP_VERIFY_TOKEN`. Suscribirse al campo `messages`.

## Limitaciones deliberadas de este primer paso

Este prototipo aún **no** guarda historial ni pedidos en una base de datos, no valida inventario o precios en vivo, no genera códigos de descuento, no crea guías de envío y no realiza seguimientos automáticos. No debe anunciarse a clientes hasta completar esos módulos y probarlo con un número de prueba.

## Siguiente etapa

1. Confirmar si el número de WhatsApp actual está en la WhatsApp Business Platform/Cloud API y si puede conectarse sin interrumpir WhatsApp Business.
2. Añadir almacenamiento persistente de conversaciones, pedidos, catálogo y códigos de descuento.
3. Integrar reglas de pedido y confirmación humana antes de crear una orden.
4. Implementar seguimientos con consentimiento y dentro de las ventanas/políticas vigentes de WhatsApp.
5. Probar en Preview con un número autorizado; después, revisar y desplegar.
