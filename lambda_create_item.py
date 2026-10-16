
import json
import uuid
import re
import os
import random
from urllib.parse import urlparse, unquote
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Attr

REGION = "us-east-1"
PHOTO_BUCKET = "lost-found-fotos"
MATCH_THRESHOLD = 60

NOVA_FUNCTION = "lost-found-image-analysis"


dynamodb = boto3.resource("dynamodb", region_name=REGION)
items_table = dynamodb.Table("LostFoundItems")
matches_table = dynamodb.Table("LostFoundMatches")

s3 = boto3.client("s3", region_name=REGION)
sns = boto3.client("sns", region_name=REGION)
lambda_client = boto3.client("lambda", region_name=REGION)


# ============================================================
# UTILIDADES
# ============================================================

def now():
    return datetime.now(timezone.utc).isoformat()


def response(status, data):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers":
                "Content-Type,Authorization",
            "Access-Control-Allow-Methods":
                "OPTIONS,GET,POST,PATCH"
        },
        "body": json.dumps(
            data,
            default=str,
            ensure_ascii=False
        )
    }


def get_body(event):
    body = event.get("body") or {}

    if isinstance(body, str):
        return json.loads(body) if body else {}

    return body


def get_claims(event):
    return (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
    )


def get_groups(claims):
    raw = claims.get("cognito:groups", "")

    if isinstance(raw, list):
        groups = raw
    else:
        groups = [
            g.strip().strip("'\"")
            for g in str(raw)
            .replace("[", "")
            .replace("]", "")
            .split(",")
            if g.strip()
        ]

    return [str(g).upper() for g in groups]


def scan_all(table, **kwargs):
    items = []
    params = dict(kwargs)

    while True:
        result = table.scan(**params)
        items.extend(result.get("Items", []))

        if not result.get("LastEvaluatedKey"):
            break

        params["ExclusiveStartKey"] = result["LastEvaluatedKey"]

    return items


def normalize(value):
    text = str(value or "").lower()
    text = re.sub(
        r"[^a-záéíóúñü0-9 ]",
        " ",
        text
    )
    return " ".join(text.split())


def words(value):
    ignored = {
        "de", "la", "el", "los", "las",
        "un", "una", "y", "en", "con",
        "del", "por"
    }

    return {
        w
        for w in normalize(value).split()
        if len(w) >= 3 and w not in ignored
    }


def parse_date(value):
    try:
        return datetime.strptime(
            str(value), "%Y-%m-%d"
        ).date()
    except Exception:
        return None

def generate_pickup_code():
    # Excluimos O, 0, I, 1 para evitar confusiones visuales
    caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    codigo = "".join(random.choices(caracteres, k=6))
    return f"LF-{codigo}"


# ============================================================
# FOTOGRAFIAS
# ============================================================

def extract_photo_key(value):
    if not isinstance(value, str) or not value:
        return None

    value = value.strip()

    if value.startswith("items/"):
        key = value

    elif value.startswith("https://"):
        parsed = urlparse(value)

        hosts = {
            f"{PHOTO_BUCKET}.s3.amazonaws.com",
            f"{PHOTO_BUCKET}.s3.{REGION}.amazonaws.com"
        }

        if parsed.hostname not in hosts:
            return None

        key = unquote(parsed.path.lstrip("/"))

    else:
        return None

    if (
        not key.startswith("items/")
        or ".." in key
        or "\\" in key
        or len(key) > 1024
    ):
        return None

    return key


def get_photo_key(item):
    return extract_photo_key(
        item.get("photoKey")
        or item.get("imageUrl")
    )


def enrich_photo(item):
    result = dict(item)
    key = get_photo_key(result)

    if not key:
        result["imageUrl"] = None
        return result

    result["photoKey"] = key

    try:
        result["imageUrl"] = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": PHOTO_BUCKET,
                "Key": key
            },
            ExpiresIn=900
        )
    except Exception as error:
        print("PHOTO_READ_ERROR:", str(error))
        result["imageUrl"] = None

    return result


def generate_upload_url(event):
    body = get_body(event)

    file_type = str(
        body.get("fileType", "")
    ).lower()

    formats = {
        "image/jpeg": ".jpg",
        "image/png": ".png"
    }

    if file_type not in formats:
        return response(
            400,
            {"message": "Solo JPG y PNG"}
        )

    key = (
        "items/"
        + uuid.uuid4().hex
        + formats[file_type]
    )

    url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": PHOTO_BUCKET,
            "Key": key,
            "ContentType": file_type
        },
        ExpiresIn=300
    )

    return response(
        200,
        {
            "uploadUrl": url,
            "photoKey": key,
            "imageUrl": (
                f"https://{PHOTO_BUCKET}.s3.amazonaws.com/{key}"
            )
        }
    )


# ============================================================
# SCORE TRADICIONAL
# ============================================================

def calculate_match_score(new_item, old_item):
    score = 0
    criteria = []

    if (
        new_item.get("category")
        and new_item.get("category") == old_item.get("category")
    ):
        score += 30
        criteria.append("CATEGORY")

    nz = normalize(new_item.get("zone"))
    oz = normalize(old_item.get("zone"))

    if nz and oz:
        if (
            nz in oz
            or oz in nz
            or words(nz).intersection(words(oz))
        ):
            score += 30
            criteria.append("ZONE")

    nd = parse_date(new_item.get("date"))
    od = parse_date(old_item.get("date"))

    if nd and od and abs((nd - od).days) <= 3:
        score += 20
        criteria.append("DATE")

    nt = (
        str(new_item.get("title", ""))
        + " "
        + str(new_item.get("description", ""))
    )

    ot = (
        str(old_item.get("title", ""))
        + " "
        + str(old_item.get("description", ""))
    )

    if words(nt).intersection(words(ot)):
        score += 20
        criteria.append("TEXT")

    return score, criteria


# ============================================================
# NOVA - INVOCACION ASINCRONA
# ============================================================

def start_visual_analysis(match_id):
    """
    No espera a Bedrock.
    La Lambda de Nova actualiza DynamoDB.
    """

    try:
        result = lambda_client.invoke(
            FunctionName=NOVA_FUNCTION,
            InvocationType="Event",
            Payload=json.dumps({
                "matchID": match_id
            }).encode("utf-8")
        )

        if result.get("StatusCode") != 202:
            raise RuntimeError(
                "No se pudo encolar el analisis"
            )

        print("NOVA_QUEUED:", match_id)

    except Exception as error:
        print("NOVA_INVOKE_ERROR:", str(error))

        try:
            matches_table.update_item(
                Key={"matchID": match_id},
                UpdateExpression=(
                    "SET visualStatus = :status"
                ),
                ExpressionAttributeValues={
                    ":status": "ERROR"
                }
            )
        except Exception as save_error:
            print(
                "NOVA_STATUS_ERROR:",
                str(save_error)
            )


# ============================================================
# CREAR COINCIDENCIAS
# ============================================================

def match_exists(lost_id, found_id):
    matches = scan_all(
        matches_table,
        FilterExpression=(
            Attr("lostItemID").eq(lost_id)
            & Attr("foundItemID").eq(found_id)
        )
    )

    return bool(matches)


def create_match(lost, found, score, criteria):
    lost_id = lost["itemID"]
    found_id = found["itemID"]

    if match_exists(lost_id, found_id):
        return None

    both_have_photos = bool(
        get_photo_key(lost)
        and get_photo_key(found)
    )

    match = {
        "matchID": str(uuid.uuid4()),
        "lostItemID": lost_id,
        "foundItemID": found_id,
        "matchScore": score,
        "matchedCriteria": criteria,
        "status": "POSSIBLE",
        "createdAt": now(),
        "visualStatus": (
            "PENDING"
            if both_have_photos
            else "NOT_AVAILABLE"
        )
    }

    matches_table.put_item(Item=match)

    if both_have_photos:
        start_visual_analysis(match["matchID"])

    print(
        "MATCH_CREATED:",
        match["matchID"],
        score,
        match["visualStatus"]
    )

    return match


def find_all_matches(new_item):
    existing = scan_all(items_table)

    item_type = str(
        new_item.get("type", "")
    ).upper()

    opposite = (
        "FOUND" if item_type == "LOST" else "LOST"
    )

    created = []

    for old in existing:
        if old.get("itemID") == new_item.get("itemID"):
            continue

        if str(old.get("type", "")).upper() != opposite:
            continue

        if str(old.get("status", "")).upper() == "VALIDATED":
            continue

        score, criteria = calculate_match_score(
            new_item, old
        )

        if score < MATCH_THRESHOLD:
            continue

        if item_type == "LOST":
            lost, found = new_item, old
        else:
            lost, found = old, new_item

        match = create_match(
            lost, found, score, criteria
        )

        if match:
            created.append(match)

    return created


# ============================================================
# REGISTRAR OBJETO
# ============================================================

def create_item(event):
    body = get_body(event)

    if not str(body.get("title", "")).strip():
        return response(
            400,
            {"message": "El campo title es obligatorio"}
    
    
        )

    claims = get_claims(event)
    groups = get_groups(claims)

    item_type = (
        "FOUND" if "STAFF" in groups else "LOST"
    )

    raw_photo = (
        body.get("photoKey")
        or body.get("imageUrl")
    )

    photo_key = extract_photo_key(raw_photo)

    if raw_photo and not photo_key:
        return response(
            400,
            {"message": "Referencia de foto no valida"}
        )

    item = {
        "itemID": str(uuid.uuid4()),
        "type": item_type,
        "title": body.get("title", ""),
        "category": body.get("category", "other"),
        "zone": body.get("zone", ""),
        "date": body.get("date", ""),
        "description": body.get("description", ""),
        "status": "REGISTERED",
        "reportedBy": claims.get("sub", "test-user"),
        "reportedByEmail": claims.get("email", ""),
        "createdAt": now(),
        "pickupCode": generate_pickup_code()
    }

    if photo_key:
        item["photoKey"] = photo_key

    items_table.put_item(Item=item)

    # El registro ya existe aunque Nova falle.
    matches = find_all_matches(item)

    return response(
        201,
        {
            "message": "Objeto registrado correctamente",
            "item": enrich_photo(item),
            "matchesCreated": len(matches),
            "matches": matches
        }
    )
    


# ============================================================
# GET ITEMS
# ============================================================

def get_items(event):
    claims = get_claims(event)
    groups = get_groups(claims)

    user_id = claims.get("sub", "test-user")

    items = scan_all(items_table)

    if "STAFF" not in groups:
        items = [
            item for item in items
            if item.get("reportedBy") == user_id
        ]

    return response(
        200,
        {
            "items": [
                enrich_photo(item)
                for item in items
            ],
            "count": len(items),
            "groups": groups
        }
    )


# ============================================================
# GET MATCHES
# ============================================================

def get_matches(event):
    claims = get_claims(event)
    groups = get_groups(claims)

    items = scan_all(items_table)
    matches = scan_all(matches_table)

    by_id = {
        i["itemID"]: i
        for i in items
    }

    output = []

    for match in matches:
        lost = by_id.get(match.get("lostItemID"))
        found = by_id.get(match.get("foundItemID"))

        if not lost or not found:
            continue

        if "STAFF" not in groups:
            if (
                lost.get("reportedBy")
                != claims.get("sub", "")
            ):
                continue

            found_data = {
                "itemID": found["itemID"],
                "type": "FOUND",
                "status": found.get("status", "REGISTERED")
            }

            visible_match = dict(match)

        else:
            found_data = enrich_photo(found)
            visible_match = dict(match)

        output.append({
            **visible_match,
            "lostItem": enrich_photo(lost),
            "foundItem": found_data
        })

    output.sort(
        key=lambda x: int(x.get("matchScore", 0)),
        reverse=True
    )

    return response(
        200,
        {
            "matches": output,
            "count": len(output)
        }
    )


# ============================================================
# CAMBIAR ESTADO DE OBJETO
# ============================================================

def update_item_status(item_id, status):
    items_table.update_item(
        Key={"itemID": item_id},
        UpdateExpression="SET #st = :status",
        ExpressionAttributeNames={
            "#st": "status"
        },
        ExpressionAttributeValues={
            ":status": status
        }
    )


# ============================================================
# VALIDAR / DESCARTAR COINCIDENCIA
# ============================================================

def validate_match(event):
    claims = get_claims(event)
    groups = get_groups(claims)

    if "STAFF" not in groups:
        return response(
            403,
            {"message": "Solo STAFF puede gestionar coincidencias"}
        )

    match_id = (
        event.get("pathParameters") or {}
    ).get("matchID")

    if not match_id:
        return response(
            400,
            {"message": "matchID obligatorio"}
        )

    match = matches_table.get_item(
        Key={"matchID": match_id}
    ).get("Item")

    if not match:
        return response(
            404,
            {"message": "Match no encontrado"}
        )

    if str(match.get("status", "")).upper() != "POSSIBLE":
        return response(
            409,
            {"message": "Coincidencia ya gestionada"}
        )

    lost_id = match["lostItemID"]
    found_id = match["foundItemID"]

    action = str(
        get_body(event).get("action", "VALIDATE")
    ).upper()

    if action not in ("VALIDATE", "REJECT"):
        return response(
            400,
            {"message": "Accion no valida"}
        )

    timestamp = now()

    if action == "REJECT":
        matches_table.update_item(
            Key={"matchID": match_id},
            UpdateExpression=(
                "SET #st = :status, rejectedAt = :date"
            ),
            ExpressionAttributeNames={
                "#st": "status"
            },
            ExpressionAttributeValues={
                ":status": "REJECTED",
                ":date": timestamp
            }
        )

        try:
            topic_clientes = os.environ.get("TOPIC_CLIENTES_ARN")
            if topic_clientes:
                sns.publish(
                    TopicArn=topic_clientes,
                    Subject="Coincidencia no confirmada",
                    Message=(
                        "Seguridad descartó una posible coincidencia.\n"
                        f"ID de reporte: {lost_id}\n"
                        "Tu búsqueda puede continuar."
                    )
                )
        except Exception as error:
            print("SNS_REJECT_ERROR:", str(error))

        return response(
            200,
            {
                "message": "Coincidencia descartada",
                "status": "REJECTED"
            }
        )

    matches_table.update_item(
        Key={"matchID": match_id},
        UpdateExpression=(
            "SET #st = :status, validatedAt = :date"
        ),
        ExpressionAttributeNames={
            "#st": "status"
        },
        ExpressionAttributeValues={
            ":status": "VALIDATED",
            ":date": timestamp
        }
    )

    update_item_status(lost_id, "VALIDATED")
    update_item_status(found_id, "VALIDATED")

    for other in scan_all(matches_table):
        if (
            other.get("foundItemID") == found_id
            and other.get("matchID") != match_id
            and other.get("status") == "POSSIBLE"
        ):
            matches_table.update_item(
                Key={"matchID": other["matchID"]},
                UpdateExpression="SET #st = :status",
                ExpressionAttributeNames={
                    "#st": "status"
                },
                ExpressionAttributeValues={
                    ":status": "REJECTED"
                }
            )

    try:
        topic_clientes = os.environ.get("TOPIC_CLIENTES_ARN")
        if topic_clientes:
            sns.publish(
                TopicArn=topic_clientes,
                Subject="Objeto perdido validado",
                Message=(
                    "El personal de Seguridad validó "
                    "la coincidencia de tu reporte.\n\n"
                    f"ID perdido: {lost_id}\n"
                    f"ID encontrado: {found_id}\n\n"
                    "Acércate al módulo de Seguridad "
                    "con tu documento de identidad y el "
                    "codigo de retiro que puedes "
                    "encontrar en el reporte dentro de la pagina web"
                )
            )
    except Exception as error:
        print("SNS_VALIDATE_ERROR:", str(error))

    return response(
        200,
        {
            "message": "Coincidencia validada correctamente",
            "matchID": match_id,
            "lostItemID": lost_id,
            "foundItemID": found_id,
            "status": "VALIDATED"
        }
    )

# ============================================================
# BUSCAR POR CÓDIGO (STAFF)
# ============================================================
def get_item_by_code(event):
    claims = get_claims(event)
    if "STAFF" not in get_groups(claims):
        return response(403, {"message": "Solo STAFF puede buscar por código"})

    codigo = (event.get("pathParameters") or {}).get("pickupCode")
    
    if not codigo:
        return response(400, {"message": "Código obligatorio"})

    try:
        # Requiere crear un GSI en DynamoDB llamado 'PickupCodeIndex'
        from boto3.dynamodb.conditions import Key
        result = items_table.query(
            IndexName="PickupCodeIndex",
            KeyConditionExpression=Key("pickupCode").eq(codigo)
        )
        items = result.get("Items", [])
        
        if not items:
            return response(404, {"message": "Código no encontrado"})
            
        return response(200, {"item": enrich_photo(items[0])})
    except Exception as e:
        print("QUERY_ERROR:", str(e))
        return response(500, {"message": "Error consultando código"})

# ============================================================
# ENTREGAR OBJETO (STAFF)
# ============================================================
def deliver_item(event):
    claims = get_claims(event)
    if "STAFF" not in get_groups(claims):
        return response(403, {"message": "Solo STAFF puede entregar objetos"})

    item_id = (event.get("pathParameters") or {}).get("itemID")
    
    if not item_id:
        return response(400, {"message": "itemID obligatorio"})

    update_item_status(item_id, "DELIVERED") # Utiliza la función existente

    return response(200, {"message": "Objeto entregado exitosamente", "status": "DELIVERED"})

# ============================================================
# HANDLER API GATEWAY REST
# ============================================================

def lambda_handler(event, context):
    try:
        method = str(
            event.get("httpMethod", "")
        ).upper()

        path = event.get("resource", "")

        print("REQUEST:", method, path)

        if method == "OPTIONS":
            return response(200, {"message": "OK"})

        if method == "POST" and path == "/upload-url":
            return generate_upload_url(event)

        if method == "GET" and path == "/items":
            return get_items(event)

        if method == "POST" and path == "/items":
            return create_item(event)

        if method == "GET" and path == "/matches":
            return get_matches(event)

        if (
            method == "PATCH"
            and path == "/matches/{matchID}/validate"
        ):
            return validate_match(event)

        # NUEVAS RUTAS
        if method == "GET" and path == "/items/code/{pickupCode}":
            return get_item_by_code(event)
            
        if method == "PATCH" and path == "/items/{itemID}/deliver":
            return deliver_item(event)

        return response(
            404,
            {"message": f"Ruta no encontrada: {method} {path}"}
        )

    except Exception as error:
        print("LAMBDA_ERROR:", str(error))

        return response(
            500,
            {
                "message": "Error interno del servidor",
                "detail": str(error)
            }
        )


