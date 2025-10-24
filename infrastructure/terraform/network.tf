# ---------------------------------------------------------------------------------------------------------------------
# DATA SOURCES
# Look up existing network resources provided by the university's AWS account setup.
# ---------------------------------------------------------------------------------------------------------------------

data "aws_vpc" "default" {
  id = "vpc-007bab53289655834"
}

data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Use existing security group
data "aws_security_group" "existing" {
  id = var.existing_security_group_id
}