provider "aws" {}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_kms_key" "evidence" {
  description             = "Nutrio immutable security evidence"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    {
      Sid       = "EnableAccountAdministration", Effect = "Allow",
      Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" },
      Action    = "kms:*", Resource = "*"
    },
    {
      Sid       = "AllowEncryptedReceiverLogs", Effect = "Allow",
      Principal = { Service = "logs.${data.aws_region.current.name}.amazonaws.com" },
      Action    = ["kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"],
      Resource  = "*",
      Condition = { ArnLike = { "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.name}*" } }
    }
  ] })
}

resource "aws_s3_bucket" "evidence" {
  bucket_prefix       = "${var.name}-"
  object_lock_enabled = true
}

resource "aws_s3_bucket_versioning" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_object_lock_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = var.retention_days
    }
  }
  depends_on = [aws_s3_bucket_versioning.evidence]
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.evidence.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "evidence" {
  bucket                  = aws_s3_bucket.evidence.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    {
      Sid       = "DenyInsecureTransport", Effect = "Deny", Principal = "*",
      Action    = "s3:*", Resource = [aws_s3_bucket.evidence.arn, "${aws_s3_bucket.evidence.arn}/*"],
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    },
    {
      Sid       = "DenyIncorrectEncryptionKey", Effect = "Deny", Principal = "*",
      Action    = "s3:PutObject", Resource = "${aws_s3_bucket.evidence.arn}/*",
      Condition = { StringNotEquals = { "s3:x-amz-server-side-encryption-aws-kms-key-id" = aws_kms_key.evidence.arn } }
    }
  ] })
}

resource "aws_dynamodb_table" "state" {
  name         = "${var.name}-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  attribute {
    name = "pk"
    type = "S"
  }
  point_in_time_recovery { enabled = true }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.evidence.arn
  }
}

data "archive_file" "receiver" {
  type        = "zip"
  output_path = "${path.module}/receiver.zip"
  source {
    content  = file("${path.module}/receiver.mjs")
    filename = "receiver.mjs"
  }
  source {
    content  = file("${path.module}/protocol.mjs")
    filename = "protocol.mjs"
  }
}

resource "aws_iam_role" "receiver" {
  name_prefix        = "${var.name}-"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}

resource "aws_iam_role_policy" "receiver" {
  role = aws_iam_role.receiver.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
    { Effect = "Allow", Action = ["s3:PutObject", "s3:PutObjectRetention"], Resource = "${aws_s3_bucket.evidence.arn}/*" },
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:TransactWriteItems"], Resource = aws_dynamodb_table.state.arn },
    { Effect = "Allow", Action = ["kms:Encrypt", "kms:GenerateDataKey"], Resource = aws_kms_key.evidence.arn },
    { Effect = "Allow", Action = "secretsmanager:GetSecretValue", Resource = [var.anchor_request_secret_arn, var.anchor_ack_secret_arn, var.alert_hmac_secret_arn] },
  ] })
}

resource "aws_lambda_function" "receiver" {
  function_name                  = var.name
  role                           = aws_iam_role.receiver.arn
  runtime                        = "nodejs20.x"
  handler                        = "receiver.handler"
  filename                       = data.archive_file.receiver.output_path
  source_code_hash               = data.archive_file.receiver.output_base64sha256
  timeout                        = 15
  memory_size                    = 256
  reserved_concurrent_executions = 10
  environment { variables = {
    EVIDENCE_BUCKET           = aws_s3_bucket.evidence.id
    STATE_TABLE               = aws_dynamodb_table.state.name
    KMS_KEY_ARN               = aws_kms_key.evidence.arn
    RETENTION_DAYS            = tostring(var.retention_days)
    ANCHOR_REQUEST_SECRET_ARN = var.anchor_request_secret_arn
    ANCHOR_ACK_SECRET_ARN     = var.anchor_ack_secret_arn
    ANCHOR_ACK_KEY_ID         = var.anchor_ack_key_id
    ALERT_HMAC_SECRET_ARN     = var.alert_hmac_secret_arn
    ALERT_HMAC_KEY_ID         = var.alert_hmac_key_id
  } }
}

resource "aws_cloudwatch_log_group" "receiver" {
  name              = "/aws/lambda/${aws_lambda_function.receiver.function_name}"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.evidence.arn
}

resource "aws_api_gateway_rest_api" "receiver" {
  name = var.name
  endpoint_configuration { types = ["REGIONAL"] }
}

resource "aws_api_gateway_resource" "anchors" {
  rest_api_id = aws_api_gateway_rest_api.receiver.id
  parent_id   = aws_api_gateway_rest_api.receiver.root_resource_id
  path_part   = "anchors"
}
resource "aws_api_gateway_resource" "alerts" {
  rest_api_id = aws_api_gateway_rest_api.receiver.id
  parent_id   = aws_api_gateway_rest_api.receiver.root_resource_id
  path_part   = "alerts"
}
resource "aws_api_gateway_method" "anchors" {
  rest_api_id   = aws_api_gateway_rest_api.receiver.id
  resource_id   = aws_api_gateway_resource.anchors.id
  http_method   = "POST"
  authorization = "NONE"
}
resource "aws_api_gateway_method" "alerts" {
  rest_api_id   = aws_api_gateway_rest_api.receiver.id
  resource_id   = aws_api_gateway_resource.alerts.id
  http_method   = "POST"
  authorization = "NONE"
}
resource "aws_api_gateway_integration" "anchors" {
  rest_api_id             = aws_api_gateway_rest_api.receiver.id
  resource_id             = aws_api_gateway_resource.anchors.id
  http_method             = aws_api_gateway_method.anchors.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.receiver.invoke_arn
}
resource "aws_api_gateway_integration" "alerts" {
  rest_api_id             = aws_api_gateway_rest_api.receiver.id
  resource_id             = aws_api_gateway_resource.alerts.id
  http_method             = aws_api_gateway_method.alerts.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.receiver.invoke_arn
}
resource "aws_api_gateway_deployment" "receiver" {
  rest_api_id = aws_api_gateway_rest_api.receiver.id
  triggers = { redeployment = sha1(jsonencode([
    aws_api_gateway_resource.anchors.id, aws_api_gateway_resource.alerts.id,
    aws_api_gateway_method.anchors.id, aws_api_gateway_method.alerts.id,
    aws_api_gateway_integration.anchors.id, aws_api_gateway_integration.alerts.id,
  ])) }
  lifecycle { create_before_destroy = true }
}
resource "aws_api_gateway_stage" "receiver" {
  rest_api_id          = aws_api_gateway_rest_api.receiver.id
  deployment_id        = aws_api_gateway_deployment.receiver.id
  stage_name           = "v1"
  xray_tracing_enabled = true
}
resource "aws_api_gateway_method_settings" "receiver" {
  rest_api_id = aws_api_gateway_rest_api.receiver.id
  stage_name  = aws_api_gateway_stage.receiver.stage_name
  method_path = "*/*"
  settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
    metrics_enabled        = true
  }
}
resource "aws_lambda_permission" "api" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.receiver.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.receiver.execution_arn}/*/POST/*"
}

resource "aws_wafv2_web_acl" "receiver" {
  name  = var.name
  scope = "REGIONAL"
  default_action {
    allow {}
  }
  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = var.name
    sampled_requests_enabled   = true
  }
  rule {
    name     = "rate-limit"
    priority = 1
    action {
      block {}
    }
    statement {
      rate_based_statement {
        aggregate_key_type = "IP"
        limit              = 300
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-rate"
      sampled_requests_enabled   = true
    }
  }
  rule {
    name     = "aws-common"
    priority = 2
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-common"
      sampled_requests_enabled   = true
    }
  }
}
resource "aws_wafv2_web_acl_association" "receiver" {
  resource_arn = aws_api_gateway_stage.receiver.arn
  web_acl_arn  = aws_wafv2_web_acl.receiver.arn
}

resource "aws_cloudwatch_metric_alarm" "errors" {
  alarm_name          = "${var.name}-lambda-errors"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = aws_lambda_function.receiver.function_name }
  alarm_actions       = var.alarm_topic_arn == "" ? [] : [var.alarm_topic_arn]
}

output "anchor_url" { value = "https://${aws_api_gateway_rest_api.receiver.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_stage.receiver.stage_name}/anchors" }
output "alert_url" { value = "https://${aws_api_gateway_rest_api.receiver.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_stage.receiver.stage_name}/alerts" }
output "evidence_bucket" { value = aws_s3_bucket.evidence.id }
