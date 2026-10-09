import json
import boto3
import re

# Inicializar cliente de Bedrock Runtime
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')
MODEL_ID = "amazon.nova-lite-v1:0"

SYSTEM_PROMPT = """Eres MallBot, el asistente de inteligencia artificial especializado EXCLUSIVAMENTE en la recepción de objetos perdidos del Centro Comercial.

TUS 3 REGLAS DE SEGURIDAD Y COMPORTAMIENTO (GUARDRAILS INQUEBRANTABLES):
1. PRIVACIDAD TOTAL (ANTI-FRAUDE / BLIND MATCHING):
   - NUNCA reveles ni des pistas sobre qué objetos están registrados, encontrados o en custodia por el personal de seguridad.
   - Si el usuario pregunta qué objetos hay guardados o si tienen un objeto específico en custodia, responde amablemente: "Por políticas estrictas de seguridad y privacidad del centro comercial, no puedo divulgar el inventario de objetos en custodia. Por favor descríbeme tu objeto extraviado para que el sistema realice la búsqueda."

2. DELIMITACIÓN DE TEMA (OFF-TOPIC):
   - Si el usuario pregunta sobre cosas no relacionadas a objetos perdidos o al centro comercial (por ejemplo: fútbol, deportes, recetas, política, tareas, quién ganó el mundial, etc.), declina amablemente y reorienta la conversación: "Soy el asistente oficial de objetos perdidos del centro comercial y solo puedo ayudarte a reportar o consultar pertenencias extraviadas. ¿Hay algún objeto que hayas perdido?"

3. RECOPILACIÓN DE DATOS Y SUGERENCIA DE FOTO:
   - Debes recopilar de forma natural los 5 campos obligatorios:
     a) title: Nombre o título claro (ej. "Peluche de Pikachu", "Billetera Renzo Costa", "Reloj Casio").
     b) category: Una de ["Billeteras / Documentos", "Smartphones / Tablets", "Mochilas / Bolsos", "Joyería / Relojes", "Prendas de Vestir", "Laptops / Tecnología", "Llaves", "Otros"].
     c) zone: Zona o tienda del mall donde se perdió (ej. "Patio de Comidas", "Cineplanet", "Zara", "Estacionamiento", "Baños").
     d) date: Fecha aproximada en formato YYYY-MM-DD.
     e) description: Color, señas particulares, raspaduras o contenido.
   - Si el usuario ya te dio algunos datos, NO los vuelvas a preguntar. Confirma lo que ya sabes y pregunta ÚNICAMENTE por los datos faltantes.
   - Una vez que los 5 campos estén completos, confirma todos los datos y pide al usuario que suba una foto si cuenta con ella: "¡Excelente! Ya tengo todos los datos de tu reporte 📝. 📷 ¿Cuentas con alguna fotografía de tu objeto? Puedes adjuntarla en el recuadro para que nuestro motor de IA (Amazon Bedrock Nova Lite) realice un contraste visual de alta precisión contra los hallazgos de seguridad." y marca isComplete: true.

FORMATO DE SALIDA ESTRICTO:
Debes responder SIEMPRE Y EXCLUSIVAMENTE un objeto JSON válido (sin explicaciones adicionales ni bloques de código markdown) con esta estructura:
{
  "reply": "Tu mensaje conversacional al usuario aplicando las reglas anteriores",
  "extracted": {
    "title": "...",
    "category": "...",
    "zone": "...",
    "date": "...",
    "description": "..."
  },
  "isComplete": false
}
"""

def extract_json(raw_text):
    """Extrae de forma segura el bloque JSON de la respuesta."""
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
        # 1. Parsear request body
        body = json.loads(event.get('body', '{}')) if isinstance(event.get('body'), str) else event.get('body', {})
        user_message = body.get('message', '').strip()
        history = body.get('history', [])
        current_data = body.get('currentData', {}) or {}

        if not user_message:
            user_message = "Hola, necesito reportar un objeto perdido."

        # 2. Construir historial de mensajes alternados para Bedrock Converse API
        messages = []
        for item in history[-6:]:
            role = "assistant" if item.get("role") == "assistant" else "user"
            text = str(item.get("text", "")).strip()
            if not text:
                continue
            
            # Formato estricto para Converse API: {"role": role, "content": [{"text": text}]}
            if messages and messages[-1]["role"] == role:
                messages[-1]["content"][0]["text"] += f"\n{text}"
            else:
                messages.append({
                    "role": role,
                    "content": [{"text": text}]
                })

        # 3. Adjuntar contexto actual de los campos del formulario
        state_context = f"[Estado actual del formulario: {json.dumps(current_data, ensure_ascii=False)}]\nMensaje del usuario: {user_message}"
        if messages and messages[-1]["role"] == "user":
            messages[-1]["content"][0]["text"] += f"\n{state_context}"
        else:
            messages.append({
                "role": "user",
                "content": [{"text": state_context}]
            })

        # 4. Invocación nativa con Converse API (soporte estándar para Amazon Nova Lite)
        response = bedrock_runtime.converse(
            modelId=MODEL_ID,
            messages=messages,
            system=[{"text": SYSTEM_PROMPT}],
            inferenceConfig={
                "maxTokens": 800,
                "temperature": 0.2,
                "topP": 0.9
            }
        )

        raw_output = response['output']['message']['content'][0]['text']
        parsed_data = extract_json(raw_output)

        if not parsed_data or "extracted" not in parsed_data:
            parsed_data = {
                "reply": raw_output.strip(),
                "extracted": current_data or {},
                "isComplete": False
            }

        # 5. Fusión acumulativa de datos para no sobreescribir campos válidos
        merged_extracted = {**(current_data or {})}
        for k, v in (parsed_data.get("extracted") or {}).items():
            if v is not None and str(v).strip() != "" and str(v).lower() != "null":
                merged_extracted[k] = v
        parsed_data["extracted"] = merged_extracted

        # 6. Validar si ya se completaron los 5 campos requeridos
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
        print("ERROR CRÍTICO EN MALLBOT CONVERSE API:", str(e))
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            "body": json.dumps({
                "reply": f"Lo siento, ocurrió un error procesando tu mensaje con Amazon Nova Lite: {str(e)}",
                "extracted": current_data or {},
                "isComplete": False,
                "error": str(e)
            })
        }
