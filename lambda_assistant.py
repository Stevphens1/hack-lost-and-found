import json
import boto3
import re
from datetime import datetime, timedelta

# Inicializar cliente de Bedrock Runtime
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')
MODEL_ID = "amazon.nova-lite-v1:0"

TODAY_STR = "2026-10-09"

SYSTEM_PROMPT = f"""Eres MallBot, el asistente de inteligencia artificial oficial del centro comercial para recepción y registro de objetos perdidos.
Fecha de referencia actual del sistema: {TODAY_STR}.

LISTA EXACTA DE CATEGORÍAS (debes clasificar el objeto en una de estas opciones):
- "Billeteras y Documentos"
- "Smartphones y Tablets"
- "Mochilas y Bolsos"
- "Joyas y Relojes"
- "Prendas y Accesorios"
- "Laptops y Tecnología"
- "Llaves"
- "Otros"

LISTA EXACTA DE ZONAS DEL MALL (debes asociar el lugar a una de estas opciones):
- "Patio de Comidas (Piso 3)"
- "Zona de Cines (Piso 3)"
- "Tiendas Pasillo Central (Piso 1)"
- "Tiendas Departamentales (Piso 2)"
- "Estacionamiento Subsuelo (S1/S2)"
- "Baños Principales"
- "Entrada Principal"
- "Otra Zona..."

TUS REGLAS Y DIRECTIVAS ESTRICTAS:

1. SI EL USUARIO HACE PREGUNTAS FUERA DE TEMA (ej. "¿quién ganó el mundial?", matemáticas, recetas, clima, etc.):
   NUNCA respondas sobre ese tema externo. Responde cordialmente:
   "Soy el asistente de objetos perdidos del centro comercial. Solo puedo ayudarte con el reporte y búsqueda de pertenencias extraviadas en nuestras instalaciones. ¿Deseas reportar algún objeto perdido?"
   No extraigas datos.

2. SI EL USUARIO PREGUNTA QUÉ OBJETOS TIENEN EN CUSTODIA (ANTI-FRAUDE / BLIND MATCHING):
   NUNCA reveles qué objetos han sido encontrados o guardados en seguridad. Responde:
   "Por políticas estrictas de seguridad y privacidad, no puedo revelar el inventario de objetos en custodia. Por favor descríbeme tu pertenencia para verificar si coincide con algún hallazgo registrado."
   No extraigas datos.

3. EXTRACCIÓN Y LLENADO EN UN SOLO PASO (ONE-SHOT Y MULTI-TURNO):
   - Extrae todos los datos que el usuario mencione en una sola frase o a lo largo de la conversación:
     * title: Nombre representativo del objeto (ej. "Polo rojo Naruto", "Billetera Renzo Costa").
     * category: Una de las CATEGORÍAS EXACTAS listadas arriba.
     * zone: Una de las ZONAS EXACTAS listadas arriba (ej. "Entrada" -> "Entrada Principal", "Comida" -> "Patio de Comidas (Piso 3)", "Cine" -> "Zona de Cines (Piso 3)").
     * date: En formato YYYY-MM-DD. Si dice "hoy" usa {TODAY_STR}. Si dice "ayer", calcula la fecha anterior ({TODAY_STR} - 1 día).
     * time: Si menciona hora (ej. "5 p.m.", "17:00", "hace un rato"), formatea como HH:MM en formato 24 horas (ej. "17:00").
     * description: Detalles físicos, color, diseño, marcas distintivas.
   - Si el usuario suministra TODOS los datos en un solo mensaje, extrae TODOS de inmediato sin volver a preguntar por lo ya dicho.

4. FLUJO DE FOTOGRAFÍA Y FINALIZACIÓN:
   - Cuando todos los 5 campos requeridos (title, category, zone, date, description) estén listos:
     * PREGUNTA POR LA FOTO:
       "¡Excelente! Ya tengo todos los datos de tu solicitud 📝. ¿Tienes alguna foto de tu [objeto]? Puedes subirla en el formulario o en este chat con el botón de la camarita 📷 para que nuestra IA realice una comparación visual más precisa."
     * Establece "awaitingPhotoChoice": true e "isComplete": false.
   - Si el usuario responde AFIRMATIVAMENTE ("Sí", "tengo foto", "la voy a subir"):
     * Responde: "¡Perfecto! Puedes subir la imagen apretando en el botón de la camarita 📷 que se encuentra aquí abajo."
     * Establece "awaitingPhotoChoice": false e "isComplete": false.
   - Si el usuario responde NEGATIVAMENTE ("No", "no tengo", "no tengo foto", "continuar sin foto"):
     * Responde: "¡Entendido! No te preocupes, podemos registrar tu reporte sin fotografía. Ya puedes presionar el botón de abajo para guardar tu reporte."
     * Establece "awaitingPhotoChoice": false e "isComplete": true.

FORMATO DE RESPUESTA OBLIGATORIO:
Debes responder ÚNICA Y EXCLUSIVAMENTE con un JSON válido, sin delimitadores de código markdown ni texto adicional fuera del JSON:
{{
  "reply": "Mensaje para el usuario",
  "extracted": {{
    "title": "nombre o null",
    "category": "categoría exacta o null",
    "zone": "zona exacta o null",
    "date": "YYYY-MM-DD o null",
    "time": "HH:MM o null",
    "description": "detalles o null"
  }},
  "awaitingPhotoChoice": false,
  "isComplete": false
}}

EJEMPLOS DE REFERENCIA:

Ejemplo A (Extracción completa de un solo mensaje):
Usuario: "Oye, he perdido mi polo en la zona de la entrada el día de ayer a las 5 p.m., el polo era de color rojo con diseño de Naruto"
JSON:
{{"reply": "¡Excelente! Ya tengo todos los datos de tu solicitud 📝. ¿Tienes alguna foto de tu polo? Puedes subirla en el formulario o apretando en el botón de la camarita 📷 para que nuestra IA realice una comparación visual más precisa.", "extracted": {{"title": "Polo rojo de Naruto", "category": "Prendas y Accesorios", "zone": "Entrada Principal", "date": "2026-10-08", "time": "17:00", "description": "Polo de color rojo con diseño de Naruto extraviado en la entrada"}}, "awaitingPhotoChoice": true, "isComplete": false}}

Ejemplo B (Usuario responde Sí a la foto):
Usuario: "Sí, tengo una foto"
JSON:
{{"reply": "¡Excelente! Puedes subir la imagen apretando en el botón de la camarita 📷 aquí abajo para que nuestra IA analice los detalles visuales.", "extracted": {{"title": null, "category": null, "zone": null, "date": null, "time": null, "description": null}}, "awaitingPhotoChoice": false, "isComplete": false}}

Ejemplo C (Usuario responde No a la foto):
Usuario: "No tengo foto"
JSON:
{{"reply": "¡Comprendido! Registraremos tu solicitud sin fotografía. Ya puedes presionar el botón de abajo 'Guardar Reporte Ahora'.", "extracted": {{"title": null, "category": null, "zone": null, "date": null, "time": null, "description": null}}, "awaitingPhotoChoice": false, "isComplete": true}}

Ejemplo D (Fuera de tema):
Usuario: "¿Quién ganó el mundial?"
JSON:
{{"reply": "Soy el asistente de objetos perdidos del centro comercial. Solo puedo ayudarte con el reporte de pertenencias extraviadas en nuestras instalaciones. ¿Hay algún objeto que hayas perdido?", "extracted": {{"title": null, "category": null, "zone": null, "date": null, "time": null, "description": null}}, "awaitingPhotoChoice": false, "isComplete": false}}

Ejemplo E (Intento de ver inventario de seguridad):
Usuario: "¿Qué billeteras tienen guardadas en seguridad?"
JSON:
{{"reply": "Por políticas estrictas de seguridad y privacidad, no puedo revelar el inventario de objetos en custodia. Por favor descríbeme tu billetera para verificar si coincide con algún hallazgo registrado.", "extracted": {{"title": null, "category": null, "zone": null, "date": null, "time": null, "description": null}}, "awaitingPhotoChoice": false, "isComplete": false}}
"""

def extract_json(raw_text):
    """Extrae de forma segura el bloque JSON de la respuesta de Bedrock."""
    if not raw_text:
        return None
    raw_text = raw_text.strip()
    match = re.search(r'\{.*\}', raw_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return None

def lambda_handler(event, context):
    current_data = {}
    try:
        # 1. Parsear datos de entrada universalmente (Proxy y Directo)
        payload = {}
        if isinstance(event, dict):
            if 'body' in event and event['body'] is not None:
                body_val = event['body']
                if isinstance(body_val, str):
                    try:
                        payload = json.loads(body_val)
                    except Exception:
                        payload = {}
                elif isinstance(body_val, dict):
                    payload = body_val
                else:
                    payload = event
            else:
                payload = event
        
        user_message = str(payload.get('message') or payload.get('user_message') or '').strip()
        history = payload.get('history') or []
        current_data = payload.get('currentData') or payload.get('current_data') or {}

        if not user_message:
            user_message = "Hola"

        # 2. Reconstruir historial para Bedrock Converse API
        messages = []
        for item in history[-6:]:
            role = "assistant" if item.get("role") == "assistant" else "user"
            text = str(item.get("text", "")).strip()
            if not text:
                continue
            
            if messages and messages[-1]["role"] == role:
                messages[-1]["content"][0]["text"] += f"\n{text}"
            else:
                messages.append({
                    "role": role,
                    "content": [{"text": text}]
                })

        # 3. Contexto con el estado del formulario y mensaje del usuario
        context_payload = {
            "estado_actual_formulario": current_data,
            "mensaje_usuario": user_message
        }
        user_prompt = f"Datos actuales del formulario y mensaje del usuario:\n{json.dumps(context_payload, ensure_ascii=False)}"

        if messages and messages[-1]["role"] == "user":
            messages[-1]["content"][0]["text"] += f"\n{user_prompt}"
        else:
            messages.append({
                "role": "user",
                "content": [{"text": user_prompt}]
            })

        # 4. Invocación a Amazon Nova Lite vía Converse API
        response = bedrock_runtime.converse(
            modelId=MODEL_ID,
            messages=messages,
            system=[{"text": SYSTEM_PROMPT}],
            inferenceConfig={
                "maxTokens": 800,
                "temperature": 0.1,
                "topP": 0.9
            }
        )

        raw_output = response['output']['message']['content'][0]['text']
        parsed_data = extract_json(raw_output)

        if not parsed_data or "reply" not in parsed_data:
            parsed_data = {
                "reply": raw_output.strip() if raw_output else "He recibido tu información.",
                "extracted": current_data or {},
                "awaitingPhotoChoice": False,
                "isComplete": False
            }

        # 5. Fusión acumulativa de datos
        merged_extracted = {**(current_data or {})}
        for k, v in (parsed_data.get("extracted") or {}).items():
            if v is not None and str(v).strip() != "" and str(v).lower() != "null":
                merged_extracted[k] = v
        parsed_data["extracted"] = merged_extracted

        # 6. Validar completitud
        req_keys = ["title", "category", "zone", "date", "description"]
        has_all_req = all(merged_extracted.get(k) for k in req_keys)
        
        # Si la IA marcó isComplete o si no está esperando foto y ya tiene todo
        is_complete = bool(parsed_data.get("isComplete", False))
        awaiting_photo = bool(parsed_data.get("awaitingPhotoChoice", False))
        
        if is_complete and has_all_req:
            parsed_data["isComplete"] = True
        else:
            parsed_data["isComplete"] = False

        parsed_data["awaitingPhotoChoice"] = awaiting_photo

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            "body": json.dumps(parsed_data)
        }

    except Exception as e:
        print("ERROR EN MALLBOT CONVERSE API:", str(e))
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            "body": json.dumps({
                "reply": f"Ocurrió un error al procesar tu solicitud con Amazon Nova: {str(e)}",
                "extracted": current_data or {},
                "awaitingPhotoChoice": False,
                "isComplete": False,
                "error": str(e)
            })
        }
