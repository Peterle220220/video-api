#!/bin/bash

# Script to fix DynamoDB permissions for the video-api project
echo "🔧 Fixing DynamoDB permissions..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first"
    exit 1
fi

# Get current user/role
CURRENT_IDENTITY=$(aws sts get-caller-identity --query 'Arn' --output text)
echo "Current identity: $CURRENT_IDENTITY"

# Check if we have admin permissions
if aws iam get-role --role-name AWSReservedSSO_CAB432-STUDENT_f2baa6a2ba3c79c9 > /dev/null 2>&1; then
    echo "✅ Found SSO role, checking permissions..."
    
    # Create a policy for DynamoDB access
    cat > dynamodb-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:Query",
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:ap-southeast-2:901444280953:table/cab432-a2-n12122882-metadata",
                "arn:aws:dynamodb:ap-southeast-2:901444280953:table/cab432-a2-n12122882-metadata/index/*"
            ]
        }
    ]
}
EOF

    echo "📝 Created DynamoDB policy"
    echo "⚠️  Note: You may need to contact your AWS administrator to attach this policy to your SSO role"
    echo "Policy file: dynamodb-policy.json"
    
else
    echo "❌ Cannot find SSO role. Please check your AWS configuration"
fi

echo "🔍 Checking DynamoDB table access..."
if aws dynamodb describe-table --table-name cab432-a2-n12122882-metadata > /dev/null 2>&1; then
    echo "✅ DynamoDB table exists and is accessible"
else
    echo "❌ Cannot access DynamoDB table"
fi
