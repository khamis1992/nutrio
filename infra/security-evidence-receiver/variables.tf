variable "name" {
  type    = string
  default = "nutrio-security-evidence"
}
variable "retention_days" {
  type    = number
  default = 2555
}
variable "anchor_request_secret_arn" {
  type      = string
  sensitive = true
}
variable "anchor_ack_secret_arn" {
  type      = string
  sensitive = true
}
variable "anchor_ack_key_id" { type = string }
variable "alert_hmac_secret_arn" {
  type      = string
  sensitive = true
}
variable "alert_hmac_key_id" { type = string }
variable "alarm_topic_arn" {
  type    = string
  default = ""
}
