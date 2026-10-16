"""
Script para poblar (seed) las tablas de DynamoDB con los datos reales de la demo:
- LostFoundItems
- LostFoundMatches

Uso:
    python seed_dynamodb.py [--region us-east-1]
"""

import csv
import json
import boto3
import argparse
import os

def seed_items(dynamodb, filename="LostFoundItems_results.csv"):
    if not os.path.exists(filename):
        print(f"Archivo no encontrado: {filename}")
        return
    table = dynamodb.Table("LostFoundItems")
    print("Poblando tabla LostFoundItems...")
    with open(filename, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            clean_item = {k: v for k, v in row.items() if v != ""}
            table.put_item(Item=clean_item)
            print(f"  + Item insertado: {clean_item.get('title')} ({clean_item.get('itemID')})")

def seed_matches(dynamodb, filename="LostFoundMatches_results.csv"):
    if not os.path.exists(filename):
        print(f"Archivo no encontrado: {filename}")
        return
    table = dynamodb.Table("LostFoundMatches")
    print("Poblando tabla LostFoundMatches...")
    with open(filename, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            clean_match = {}
            for k, v in row.items():
                if v == "":
                    continue
                if k == "matchedCriteria" and v.startswith("["):
                    try:
                        # parse criteria format if json
                        raw = json.loads(v)
                        clean_match[k] = [c.get("S", c) if isinstance(c, dict) else c for c in raw]
                        continue
                    except Exception:
                        pass
                if k == "matchScore":
                    try:
                        clean_match[k] = int(v)
                        continue
                    except ValueError:
                        pass
                clean_match[k] = v
            table.put_item(Item=clean_match)
            print(f"  + Match insertado: {clean_match.get('matchID')} (Score: {clean_match.get('matchScore')})")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--region", default="us-east-1", help="AWS Region")
    args = parser.parse_args()

    dynamodb = boto3.resource("dynamodb", region_name=args.region)
    seed_items(dynamodb)
    seed_matches(dynamodb)
    print("\n¡Sembrado de base de datos completado exitosamente!")

if __name__ == "__main__":
    main()
