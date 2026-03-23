import json
import logging
import os

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client("s3")

DATA_BUCKET = os.environ.get("DATA_BUCKET", "")
RESULTS_BUCKET = os.environ.get("RESULTS_BUCKET", "")


def lambda_handler(event, context):
    """Process data from the input bucket and write results to the output bucket."""
    logger.info("Processing data: %s", json.dumps(event))

    input_key = event.get("input_key")
    if not input_key:
        return {"status": "FAILED", "error": "Missing input_key in event"}

    try:
        # Read data from source bucket
        response = s3_client.get_object(Bucket=DATA_BUCKET, Key=input_key)
        data = json.loads(response["Body"].read().decode("utf-8"))

        # Process data (placeholder - implement actual processing logic)
        result = {"source_key": input_key, "record_count": len(data) if isinstance(data, list) else 1, "processed": True}

        # Write results
        output_key = f"processed/{input_key}"
        s3_client.put_object(
            Bucket=RESULTS_BUCKET,
            Key=output_key,
            Body=json.dumps(result),
            ContentType="application/json",
        )

        logger.info("Successfully processed %s -> %s", input_key, output_key)
        return {"status": "SUCCESS", "output_key": output_key, "record_count": result["record_count"]}

    except Exception as e:
        logger.error("Failed to process %s: %s", input_key, str(e))
        return {"status": "FAILED", "error": str(e)}
