"""Restore the isolated demo resources used by Excel student registration after a host boot."""

import os

import boto3

endpoint = "http://review-moto:5000"
if any(os.environ.get(key) != endpoint for key in ("AWS_ENDPOINT_URL", "AWS_ENDPOINT_URL_SQS")):
    raise RuntimeError("Expected the Dawon demo emulator")
if os.environ.get("TOOLS_SQS_QUEUE_NAME") != "dawon-review-tools":
    raise RuntimeError("Unexpected tools queue")

storage = boto3.client("s3", endpoint_url=endpoint)
queue = boto3.client("sqs", endpoint_url=endpoint)
bucket = "dawon-review-excel"
if not any(item["Name"] == bucket for item in storage.list_buckets()["Buckets"]):
    storage.create_bucket(Bucket=bucket)
storage.head_bucket(Bucket=bucket)
queue.create_queue(QueueName="dawon-review-tools")
queue.get_queue_url(QueueName="dawon-review-tools")
print("Dawon demo Excel bucket and queue ready")
