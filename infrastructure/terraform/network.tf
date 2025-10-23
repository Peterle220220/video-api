# ---------------------------------------------------------------------------------------------------------------------
# DATA SOURCES
# Look up existing network resources provided by the university's AWS account setup.
# This avoids creating a new VPC and leverages the existing network infrastructure.
# ---------------------------------------------------------------------------------------------------------------------

# Use the specific VPC ID from the error message
data "aws_vpc" "default" {
  id = "vpc-007bab53289655834"
}

data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "tag:aws-controltower:NetConfig"
    values = ["Public"]
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# SECURITY GROUP
# Creates a security group to be used by the ALB and ECS services.
# It allows inbound traffic on ports 80 (for HTTP redirect) and 443 (for HTTPS) from anywhere.
# It also allows all outbound traffic, which is necessary for services to pull images and communicate with other AWS services.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_security_group" "app_sg" {
  name        = "CAB432SG-n12122882"
  description = "Security group for the CAB432 application"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Allow HTTP traffic to ALB"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTPS traffic to ALB"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Note: For communication between services within the VPC (e.g., frontend calling backend),
  # you can add a self-referencing ingress rule.
  # ingress {
  #   description = "Allow internal traffic"
  #   from_port   = 0
  #   to_port     = 0
  #   protocol    = "-1"
  #   self        = true
  # }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name         = "CAB432SG-n12122882"
    qut-username = var.qut_username
    purpose      = "assessment"
  }
}
