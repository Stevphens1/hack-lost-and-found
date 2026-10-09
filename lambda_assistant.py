import json
import boto3
import re
from datetime import datetime

# Inicializar cliente de Bedrock Runtime
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')
MODEL_ID = "amazon.nova-lite-v1:0"

TODAY_STR = "2026-10-09"

SYSTEM_PROMPT = f"""Eres MallBot, el asistente de inteligencia artificial para el centro comercial encargado de registrar objetos perdidos.
Fecha de referencia actual: {TODAY_STR}.

CATEGORÍAS PERMITIDAS (debes elegir exactamente una):
- "Billeteras / Documentos"
- "Smartphones / Tablets"
- "Mochilas / Bolsos"
- "Joyería / Relojes"
- "Prendas de Vestir"
- "Laptops / Tecnología"
- "Llaves"
- "Otros"

TUS REGLAS OBLIGATORIAS:
1. SI EL USUARIO HACE PREGUNTAS FUERA DE TEMA (ej. "¿quién ganó el mundial?", tareas, clima, etc.):
   No respondas sobre ese tema. Responde cordialmente: "Soy el asistente de objetos perdidos del mall. Solo puedo ayudarte con el reporte de pertenencias extraviadas. ¿Deseas registrar algún objeto?"
   No extraigas datos.

2. SI EL USUARIO PREGUNTA QUÉ OBJETOS TIENEN EN CUSTODIA (ANTI-FRAUDE / BLIND MATCHING):
   NUNCA digas qué objetos hay guardados. Responde: "Por políticas estrictas de seguridad y privacidad, no puedo revelar el inventario de objetos en custodia. Por favor descríbeme tu pertenencia para buscar si coincide con algún reporte."
   No extraigas datos.

3. EXTRACCIÓN DE DATOS DE FORMA INTELIGENTE:
   - Si el usuario dice un objeto (ej. "Reloj", "Billetera", "iPhone", "Peluche de Pikachu"), extráelo de inmediato en 'title', clasifícalo en su 'category' adecuada (ej. "Reloj" -> "Joyería / Relojes", "Peluche" -> "Otros"), y en tu 'reply' di que ya lo anotaste y pregunta por los campos que AÚN FALTAN (ej. "¿En qué tienda o zona del mall lo perdiste y en qué fecha aproximada?").
   - NUNCA vuelvas a preguntar por datos que ya están en el formulario o que el usuario ya mencionó.
   - Si ya se tienen los 5 campos (title, category, zone, date, description):
     * Marca "isComplete": true.
     * En tu 'reply', confirma los 5 datos y agrega: "¡Excelente! Ya tengo todos los datos de tu reporte 📝. 📷 ¿Tienes alguna foto de tu objeto? Puedes subirla en el formulario para que nuestra IA realice una comparación visual de alta precisión contra los hallazgos de seguridad."

FORMATO DE RESPUESTA OBLIGATORIO:
Debes responder ÚNICA Y EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional antes o después, con este formato exacto:
{{
  "reply": "Texto que leerá el usuario",
  "extracted": {{
    "title": "nombre o null",
    "category": "categoría válida o null",
    "zone": "zona o null",
    "date": "YYYY-MM-DD o null",
    "description": "detalles o null"
  }},
  "isComplete": false
}}

EJEMPLOS DE COMPORTAMIENTO ESPERADO:

Ejemplo 1 (Fuera de tema):
Usuario: "¿Quién ganó el mundial?"
JSON:
{{"reply": "Soy el asistente oficial de objetos perdidos del centro comercial. Solo puedo ayudarte a registrar y buscar pertenencias extraviadas en nuestras instalaciones. ¿Hay algún objeto que hayas perdido?", "extracted": {{"title": null, "category": null, "zone": null, "date": null, "description": null}}, "isComplete": false}}

Ejemplo 2 (Intento de ver inventario):
Usuario: "¿Qué billeteras tienen guardadas en seguridad?"
JSON:
{{"reply": "Por políticas de seguridad y privacidad del centro comercial, no puedo divulgar el inventario de objetos en custodia. Por favor descríbeme tu billetera para verificar si coincide con algún hallazgo registrado.", "extracted": {{"title": null, "category": null, "zone": null, "date": null, "description": null}}, "isComplete": false}}

Ejemplo 3 (Usuario da solo el objeto):
Usuario: "Reloj" (o "Perdí un reloj")
JSON:
{{"reply": "¡Entendido, un reloj! ⌚ Ya lo tengo anotado. ¿Recuerdas en qué tienda o zona del centro comercial lo extraviaste y en qué fecha aproximada?", "extracted": {{"title": "Reloj", "category": "Joyería / Relojes", "zone": null, "date": null, "description": "Reloj extraviado"}}, "isComplete": false}}

Ejemplo 4 (Usuario da zona y fecha):
Usuario: "En el patio de comidas hoy"
JSON:
{{"reply": "Perfecto, anotado en Patio de Comidas hoy. ¿Podrías darme una breve descripción física (color, marca, modelo o detalles) para identificarlo mejor?", "extracted": {{"title": "Reloj", "category": "Joyería / Relojes", "zone": "Patio de Comidas (Piso 2)", "date": "2026-10-09", "description": "Reloj extraviado"}}, "isComplete": false}}

Ejemplo 5 (Completo):
Usuario: "Es plateado marca Casio con correa metálica"
JSON:
{{"reply": "¡Excelente! Ya registré todos los datos de tu reloj Casio plateado 📝. 📷 ¿Tienes alguna foto de tu reloj? Puedes subirla en el formulario para que nuestra IA realice una comparación visual contra los objetos hallados por seguridad.", "extracted": {{"title": "Reloj Casio", "category": "Joyería / Relojes", "zone": "Patio de Comidas (Piso 2)", "date": "2026-10-09", "description": "Plateado marca Casio con correa metálica"}}, "isComplete": true}}
"""

def extract_json(raw_text):
    """Extrae de forma segura el bloque JSON de la respuesta de Bedrock."""
    if not raw_text:
        return None
    raw_text = raw_text.strip()
    # Buscar el primer bloque delimitado por { y }
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
        # 1. Parsear datos de entrada de forma universal (Proxy y Non-Proxy)
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
        user_prompt = f"Datos actuales del formulario y mensaje:\n{json.dumps(context_payload, ensure_ascii=False)}"

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
            # Fallback en caso de que devuelva texto sin envoltorio JSON
            parsed_data = {
                "reply": raw_output.strip() if raw_output else "Entendido, estoy procesando tu reporte.",
                "extracted": current_data or {},
                "isComplete": False
            }

        # 5. Fusión acumulativa de datos
        merged_extracted = {**(current_data or {})}
        for k, v in (parsed_data.get("extracted") or {}).items():
            if v is not None and str(v).strip() != "" and str(v).lower() != "null":
                merged_extracted[k] = v
        parsed_data["extracted"] = merged_extracted

        # 6. Validar completitud de los 5 campos
        req_keys = ["title", "category", "zone", "date", "description"]
        if all(merged_extracted.get(k) for k in req_keys):
            parsed_data["isComplete"] = True

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
                "isComplete": False,
                "error": str(e)
            })
        }
