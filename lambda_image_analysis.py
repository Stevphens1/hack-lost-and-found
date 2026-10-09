"""
=============================================================================
Lost & Found Portal - Visual Matchmaking Engine using Amazon Bedrock Nova Lite
Model: amazon.nova-lite-v1:0 (Multimodal Vision + Text Analysis)
AWS Region: us-east-1
=============================================================================
"""

import json
import re
import base64
from datetime import datetime, timezone

import boto3

REGION = "us-east-1"
BUCKET = "lost-found-fotos"
MODEL_ID = "amazon.nova-lite-v1:0"

s3 = boto3.client("s3", region_name=REGION)
bedrock = boto3.client("bedrock-runtime", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)

items_table = dynamodb.Table("LostFoundItems")
matches_table = dynamodb.Table("LostFoundMatches")


def now():
    return datetime.now(timezone.utc).isoformat()


def load_image(key):
    if (
        not isinstance(key, str)
        or not key.startswith("items/")
        or ".." in key
        or "\\" in key
    ):
        raise ValueError("Clave S3 no permitida")

    obj = s3.get_object(Bucket=BUCKET, Key=key)

    content_type = (
        obj.get("ContentType", "")
        .split(";")[0]
        .lower()
    )

    formats = {
        "image/jpeg": "jpeg",
        "image/png": "png"
    }

    if content_type not in formats:
        raise ValueError("Solo se permiten JPEG y PNG")

    content_length = obj.get("ContentLength", 0)

    if content_length > 4 * 1024 * 1024:
        raise ValueError("Imagen demasiado grande")

    data = obj["Body"].read()

    if len(data) > 4 * 1024 * 1024:
        raise ValueError("Imagen demasiado grande")

    return {
        "image": {
            "format": formats[content_type],
            "source": {
                "bytes": base64.b64encode(data).decode("utf-8")
            }
        }
    }


def classify_similarity(text):
    clean = re.sub(r"\*+", "", text.upper())

    patterns = [
        r"CLASIFICACI[ÓO]N DE SIMILITUD VISUAL\s*:\s*(ALTA|MEDIA|BAJA)",
        r"SIMILITUD VISUAL\s*:\s*(ALTA|MEDIA|BAJA)",
        r"SIMILITUD\s*:\s*(ALTA|MEDIA|BAJA)"
    ]

    for pattern in patterns:
        found = re.search(pattern, clean)
        if found:
            return found.group(1)

    return "NO_DETERMINADA"


def analyze_photos(lost_key, found_key):
    prompt = (
        "Eres un asistente especializado en identificar objetos "
        "perdidos y encontrados en centros comerciales. "
        "Imagen 1: objeto PERDIDO. "
        "Imagen 2: objeto ENCONTRADO. "

        "Identifica primero el tipo de objeto de cada imagen. "
        "Si son tipos diferentes, clasifica la similitud como BAJA. "

        "Compara color, forma, marca, material, accesorios "
        "y caracteristicas distintivas visibles. "

        "Si aparece un mouse informatico, llamalo "
        "'mouse de computadora', nunca 'rata'. "

        "No inventes marcas, materiales ni detalles. "
        "No afirmes que son el mismo objeto. "
        "La validacion final corresponde a Seguridad. "

        "Responde en espanol con estas secciones: "
        "OBJETO 1, OBJETO 2, SIMILITUDES, DIFERENCIAS, "
        "SIMILITUD VISUAL y CONCLUSION. "

        "En SIMILITUD VISUAL escribe exactamente "
        "ALTA, MEDIA o BAJA."
    )

    content = [
        {"text": "IMAGEN 1: OBJETO PERDIDO"},
        load_image(lost_key),
        {"text": "IMAGEN 2: OBJETO ENCONTRADO"},
        load_image(found_key),
        {"text": prompt}
    ]

    payload = {
        "schemaVersion": "messages-v1",
        "messages": [
            {
                "role": "user",
                "content": content
            }
        ],
        "inferenceConfig": {
            "maxTokens": 650,
            "temperature": 0.1
        }
    }

    result = bedrock.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(payload)
    )

    data = json.loads(result["body"].read())

    parts = (
        data.get("output", {})
        .get("message", {})
        .get("content", [])
    )

    analysis = "\n".join(
        p.get("text", "")
        for p in parts
        if "text" in p
    ).strip()

    if not analysis:
        raise RuntimeError("Nova devolvio una respuesta vacia")

    return {
        "visualStatus": "COMPLETED",
        "visualSimilarity": classify_similarity(analysis),
        "visualAnalysis": analysis,
        "visualModel": MODEL_ID,
        "visualAnalyzedAt": now()
    }


def save_analysis(match_id, result):
    # 1. Obtener el match actual para ver el score que tiene
    match = matches_table.get_item(
        Key={"matchID": match_id}
    ).get("Item")
    
    if not match:
        return
        
    score_actual = int(match.get("matchScore", 0))
    
    # 2. La Penalización: si la similitud es BAJA, castigamos el score
    if result.get("visualSimilarity") == "BAJA":
        score_actual = score_actual - 60
        if score_actual < 0:
            score_actual = 0
            
    # 3. Guardar todo incluyendo el nuevo matchScore
    matches_table.update_item(
        Key={"matchID": match_id},
        UpdateExpression=(
            "SET visualStatus = :status, "
            "visualSimilarity = :similarity, "
            "visualAnalysis = :analysis, "
            "visualModel = :model, "
            "visualAnalyzedAt = :date, "
            "matchScore = :score"
        ),
        ExpressionAttributeValues={
            ":status": result["visualStatus"],
            ":similarity": result["visualSimilarity"],
            ":analysis": result["visualAnalysis"],
            ":model": result["visualModel"],
            ":date": result["visualAnalyzedAt"],
            ":score": score_actual
        },
        ConditionExpression="attribute_exists(matchID)"
    )


def process_match(match_id):
    match = matches_table.get_item(
        Key={"matchID": match_id}
    ).get("Item")

    if not match:
        raise ValueError("Match no encontrado")

    lost = items_table.get_item(
        Key={"itemID": match["lostItemID"]}
    ).get("Item")

    found = items_table.get_item(
        Key={"itemID": match["foundItemID"]}
    ).get("Item")

    if not lost or not found:
        raise ValueError("Objetos del match no encontrados")

    lost_key = lost.get("photoKey")
    found_key = found.get("photoKey")

    if not lost_key or not found_key:
        result = {
            "visualStatus": "NOT_AVAILABLE",
            "visualSimilarity": "NO_EVALUADA",
            "visualAnalysis": "Falta una o ambas fotografias.",
            "visualModel": MODEL_ID,
            "visualAnalyzedAt": now()
        }

        save_analysis(match_id, result)
        return result

    try:
        result = analyze_photos(lost_key, found_key)

    except Exception as error:
        print("NOVA_ERROR:", str(error))

        result = {
            "visualStatus": "ERROR",
            "visualSimilarity": "NO_EVALUADA",
            "visualAnalysis": "No se pudo completar el analisis visual.",
            "visualModel": MODEL_ID,
            "visualAnalyzedAt": now()
        }

    save_analysis(match_id, result)

    print(
        "VISUAL_MATCH_SAVED:",
        match_id,
        result["visualStatus"],
        result["visualSimilarity"]
    )

    return result


def lambda_handler(event, context):
    try:
        # Integracion automatica desde la Lambda principal
        if event.get("matchID"):
            match_id = event["matchID"]
            result = process_match(match_id)

            return {
                "statusCode": 200,
                "body": json.dumps({
                    "matchID": match_id,
                    **result
                }, ensure_ascii=False)
            }

        # Pruebas manuales
        body = event.get("body", event)

        if isinstance(body, str):
            body = json.loads(body)

        lost_key = body.get("lostPhotoKey")
        found_key = body.get("foundPhotoKey")

        if lost_key and found_key:
            result = analyze_photos(lost_key, found_key)

            return {
                "statusCode": 200,
                "body": json.dumps(
                    result,
                    ensure_ascii=False
                )
            }

        if body.get("photoKey"):
            key = body["photoKey"]

            payload = {
                "schemaVersion": "messages-v1",
                "messages": [{
                    "role": "user",
                    "content": [
                        load_image(key),
                        {
                            "text": (
                                "Describe este objeto perdido o encontrado. "
                                "Identifica tipo, color, marca visible "
                                "y caracteristicas distintivas. "
                                "No inventes detalles. "
                                "Responde en espanol."
                            )
                        }
                    ]
                }],
                "inferenceConfig": {
                    "maxTokens": 350,
                    "temperature": 0.1
                }
            }

            output = bedrock.invoke_model(
                modelId=MODEL_ID,
                body=json.dumps(payload),
                contentType="application/json",
                accept="application/json"
            )

            data = json.loads(output["body"].read())

            text = "\n".join(
                p.get("text", "")
                for p in data.get("output", {})
                    .get("message", {})
                    .get("content", [])
                if "text" in p
            )

            return {
                "statusCode": 200,
                "body": json.dumps({
                    "visualDescription": text,
                    "model": MODEL_ID
                }, ensure_ascii=False)
            }

        return {
            "statusCode": 400,
            "body": json.dumps({
                "message": "Indica matchID o photoKey"
            })
        }

    except Exception as error:
        print("IMAGE_ANALYSIS_ERROR:", str(error))

        return {
            "statusCode": 500,
            "body": json.dumps({
                "message": "Error de analisis",
                "detail": str(error)
            })
        }
