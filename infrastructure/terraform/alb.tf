# ---------------------------------------------------------------------------------------------------------------------
# APPLICATION LOAD BALANCER (ALB)
# This file defines the ALB, its listeners, and target groups. The ALB serves as the single
# entry point for all HTTP/HTTPS traffic and routes requests to the appropriate microservice.
# This satisfies the "HTTPS" core criterion and contributes to the "Communication mechanisms" additional criterion.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.app_sg.id]
  subnets            = data.aws_subnets.public.ids

  tags = {
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# TARGET GROUPS
# Each publicly accessible service gets its own target group. ECS will register task IPs with these groups.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_lb_target_group" "web" {
  name        = "${var.project_name}-web-tg"
  port        = 3000 # Assuming React app runs on port 3000
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

resource "aws_lb_target_group" "api" {
  name        = "${var.project_name}-api-tg"
  port        = 8080 # Port for the video-api service
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  health_check {
    path                = "/api/videos/health" # A dedicated health check endpoint is recommended
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
  port        = 8081 # Port for the auth-service
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  health_check {
    path                = "/api/auth/health" # A dedicated health check endpoint is recommended
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

# Rule to route /api/videos/* to the video-api service
resource "aws_lb_listener_rule" "api_rule" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/videos*"]
    }
  }
}

# Rule to route /api/auth/* to the auth-service
resource "aws_lb_listener_rule" "auth_rule" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 101

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
