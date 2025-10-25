# ---------------------------------------------------------------------------------------------------------------------
# APPLICATION LOAD BALANCER (ALB)
# This file defines the ALB, its listeners, and target groups.
# This satisfies the "HTTPS" core criterion and contributes to "Communication mechanisms".
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_lb" "main" {
  name               = "cab432-a3-n12122882-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [data.aws_security_group.existing.id]
  subnets            = ["subnet-075811427d5564cf9", "subnet-05a3b8177138c8b14", "subnet-04ca053dcbe5f49cc"]
  enable_deletion_protection = false

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# TARGET GROUPS
# Each publicly accessible service gets its own target group.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_lb_target_group" "web" {
  name        = "${var.project_name}-web-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  health_check {
    path                = "/"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_target_group" "auth" {
  name        = "${var.project_name}-auth-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  health_check {
    path                = "/api/auth/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_target_group" "transcoding" {
  name        = "${var.project_name}-transcoding-tg"
  port        = 3002
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  health_check {
    path                = "/api/transcoding/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_target_group" "upload" {
  name        = "${var.project_name}-upload-tg"
  port        = 3003
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  health_check {
    path                = "/api/storage/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# LISTENERS & RULES
# Configures how the ALB handles incoming requests.
# ---------------------------------------------------------------------------------------------------------------------

# Listener for HTTP on port 80, which redirects all traffic to HTTPS
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Listener for HTTPS on port 443
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn # Default traffic goes to the web frontend
  }
}

# Rule to route /api/auth/* to the auth service
resource "aws_lb_listener_rule" "auth_rule" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth.arn
  }

  condition {
    path_pattern {
      values = ["/api/auth*"]
    }
  }
}

# Rule to route /api/transcoding/* to the transcoding service
resource "aws_lb_listener_rule" "transcoding_rule" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 101

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.transcoding.arn
  }

  condition {
    path_pattern {
      values = ["/api/transcoding*"]
    }
  }
}

# Rule to route /api/storage/* and /api/videos/* to the upload service
resource "aws_lb_listener_rule" "upload_rule" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 102

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.upload.arn
  }

  condition {
    path_pattern {
      values = ["/api/storage*", "/api/videos*"]
    }
  }
}
