variable "ssm_prefix" {
  description = "Prefix for SSM parameter names"
  type        = string
  default     = "/n12122882/video_api"
}

resource "aws_ssm_parameter" "aai_base" {
  name      = "${var.ssm_prefix}/aai_base"
  type      = "String"
  value     = "https://api.assemblyai.com"
  overwrite = true
}

resource "aws_ssm_parameter" "ffmpeg_config" {
  name      = "${var.ssm_prefix}/ffmpeg_config"
  type      = "String"
  overwrite = true
  value     = jsonencode({
    ffmpeg = {
      preset  = "medium"
      crf     = 23
      fps     = 30
      threads = 0
    }
    transcoding = {
      defaultResolutions = ["1280x720", "854x480"]
      maxConcurrent      = 2
    }
    limits = {
      maxFileSize = "500MB"
    }
    monitoring = {
      cpuMonitoringInterval = 2000
    }
  })
}


