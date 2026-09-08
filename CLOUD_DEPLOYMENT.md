# SmartMonitoring — Cloud Deployment Guide (AWS)

This document covers the complete step-by-step process to deploy SmartMonitoring to AWS — from account setup to a live production environment with CI/CD.

---

## Target Architecture

```
Internet
    │
    ▼
CloudFront (CDN)
    │
    ├── Static files → S3 (React frontend)
    │
    └── /api/* → Application Load Balancer
                        │
                        ▼
                   ECS Fargate
                   (Spring Boot container)
                        │
                        ├── RDS PostgreSQL (private subnet)
                        └── AWS IoT Core (MQTT broker)

GitHub Actions → ECR (container registry) → ECS (auto deploy)
```

---

## Prerequisites

- AWS account with billing set up
- AWS CLI installed: `brew install awscli`
- Docker installed: `brew install --cask docker`
- GitHub repo with your code pushed

---

## Phase 1 — AWS Account Setup

### Step 1.1 — Create an IAM User for deployments

Never use your root AWS account for deployments. Create a dedicated IAM user.

1. Go to **AWS Console → IAM → Users → Create user**
2. Name: `smartmonitoring-deploy`
3. Attach these managed policies:
   - `AmazonECS_FullAccess`
   - `AmazonEC2ContainerRegistryFullAccess`
   - `AmazonRDSFullAccess`
   - `AmazonS3FullAccess`
   - `CloudFrontFullAccess`
   - `AWSIoTFullAccess`
4. Create user → **Security credentials** tab → **Create access key**
5. Choose: **Application running outside AWS**
6. Save the `Access Key ID` and `Secret Access Key` — you'll need these for GitHub Actions

### Step 1.2 — Configure AWS CLI locally

```bash
aws configure
# AWS Access Key ID: <paste key>
# AWS Secret Access Key: <paste secret>
# Default region: ap-south-1      ← Mumbai, closest for India
# Default output format: json
```

Verify it works:
```bash
aws sts get-caller-identity
```

---

## Phase 2 — Network Setup (VPC)

Your app and database must run in a private network — not exposed directly to the internet.

### Step 2.1 — Create VPC

```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=smartmonitoring-vpc}]'
```

Note the `VpcId` from the output (e.g. `vpc-0abc123`).

### Step 2.2 — Create Subnets

You need two public subnets (for load balancer) and two private subnets (for app + DB).

```bash
# Public subnet 1 (AZ a)
aws ec2 create-subnet --vpc-id vpc-0abc123 \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ap-south-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=sm-public-1a}]'

# Public subnet 2 (AZ b)
aws ec2 create-subnet --vpc-id vpc-0abc123 \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ap-south-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=sm-public-1b}]'

# Private subnet 1 (AZ a) — app + DB
aws ec2 create-subnet --vpc-id vpc-0abc123 \
  --cidr-block 10.0.10.0/24 \
  --availability-zone ap-south-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=sm-private-1a}]'

# Private subnet 2 (AZ b) — app + DB
aws ec2 create-subnet --vpc-id vpc-0abc123 \
  --cidr-block 10.0.11.0/24 \
  --availability-zone ap-south-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=sm-private-1b}]'
```

### Step 2.3 — Internet Gateway + NAT Gateway

```bash
# Internet gateway (for public subnets)
aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=sm-igw}]'

aws ec2 attach-internet-gateway \
  --internet-gateway-id igw-0abc123 \
  --vpc-id vpc-0abc123

# NAT gateway (allows private subnets to reach internet for updates)
# First allocate an Elastic IP
aws ec2 allocate-address --domain vpc

# Then create NAT gateway in public subnet
aws ec2 create-nat-gateway \
  --subnet-id subnet-public-1a \
  --allocation-id eipalloc-0abc123 \
  --tag-specifications 'ResourceType=natgateway,Tags=[{Key=Name,Value=sm-nat}]'
```

> **Tip:** Use the AWS Console VPC Wizard instead of CLI for this step — it's much easier visually. Go to **VPC → Create VPC → VPC and more** and it creates everything automatically.

---

## Phase 3 — RDS PostgreSQL

### Step 3.1 — Create DB Subnet Group

```bash
aws rds create-db-subnet-group \
  --db-subnet-group-name sm-db-subnet-group \
  --db-subnet-group-description "SmartMonitoring DB subnets" \
  --subnet-ids subnet-private-1a subnet-private-1b
```

### Step 3.2 — Create Security Group for RDS

```bash
aws ec2 create-security-group \
  --group-name sm-rds-sg \
  --description "SmartMonitoring RDS security group" \
  --vpc-id vpc-0abc123
```

Allow inbound PostgreSQL (port 5432) only from ECS security group:
```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-rds-id \
  --protocol tcp \
  --port 5432 \
  --source-group sg-ecs-id
```

### Step 3.3 — Create RDS Instance

```bash
aws rds create-db-instance \
  --db-instance-identifier smartmonitoring-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username postgres \
  --master-user-password "YourStrongPassword123!" \
  --db-name smart_monitoring \
  --db-subnet-group-name sm-db-subnet-group \
  --vpc-security-group-ids sg-rds-id \
  --no-publicly-accessible \
  --storage-type gp3 \
  --allocated-storage 20 \
  --backup-retention-period 7 \
  --deletion-protection
```

Wait 5-10 minutes for it to become available:
```bash
aws rds wait db-instance-available \
  --db-instance-identifier smartmonitoring-db
```

Get the endpoint:
```bash
aws rds describe-db-instances \
  --db-instance-identifier smartmonitoring-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

Save this — it will look like:
`smartmonitoring-db.xxxxxxxxx.ap-south-1.rds.amazonaws.com`

---

## Phase 4 — AWS Secrets Manager

Store sensitive config so it never lives in code or environment variables as plain text.

```bash
# DB password
aws secretsmanager create-secret \
  --name smartmonitoring/db-password \
  --secret-string "YourStrongPassword123!"

# JWT secret (generate a strong one)
aws secretsmanager create-secret \
  --name smartmonitoring/jwt-secret \
  --secret-string "$(openssl rand -base64 32)"
```

ECS will pull these at runtime and inject them as environment variables.

---

## Phase 5 — ECR (Container Registry)

### Step 5.1 — Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name smart-monitoring-backend \
  --region ap-south-1
```

Note the repository URI:
`123456789.dkr.ecr.ap-south-1.amazonaws.com/smart-monitoring-backend`

### Step 5.2 — Build and Push Docker Image (first time manually)

```bash
# Login to ECR
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.ap-south-1.amazonaws.com

# Build image
docker build -t smart-monitoring-backend .

# Tag with ECR URI
docker tag smart-monitoring-backend:latest \
  123456789.dkr.ecr.ap-south-1.amazonaws.com/smart-monitoring-backend:latest

# Push
docker push 123456789.dkr.ecr.ap-south-1.amazonaws.com/smart-monitoring-backend:latest
```

---

## Phase 6 — ECS Fargate

### Step 6.1 — Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name smartmonitoring-cluster \
  --capacity-providers FARGATE
```

### Step 6.2 — Create IAM Role for ECS Tasks

```bash
# Task execution role (allows ECS to pull image + fetch secrets)
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Principal":{"Service":"ecs-tasks.amazonaws.com"},
      "Action":"sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Allow reading from Secrets Manager
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

### Step 6.3 — Create Task Definition

Save this as `task-definition.json`:

```json
{
  "family": "smartmonitoring-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "smart-monitoring-backend",
      "image": "123456789.dkr.ecr.ap-south-1.amazonaws.com/smart-monitoring-backend:latest",
      "portMappings": [
        { "containerPort": 8080, "protocol": "tcp" }
      ],
      "environment": [
        { "name": "SPRING_DATASOURCE_URL", "value": "jdbc:postgresql://smartmonitoring-db.xxx.ap-south-1.rds.amazonaws.com:5432/smart_monitoring" },
        { "name": "DB_USERNAME", "value": "postgres" },
        { "name": "DCU_INTEGRATION_MODE", "value": "REST" },
        { "name": "CORS_ALLOWED_ORIGINS", "value": "https://yourdomain.com" }
      ],
      "secrets": [
        { "name": "DB_PASSWORD", "valueFrom": "arn:aws:secretsmanager:ap-south-1:123456789:secret:smartmonitoring/db-password" },
        { "name": "JWT_SECRET",   "valueFrom": "arn:aws:secretsmanager:ap-south-1:123456789:secret:smartmonitoring/jwt-secret" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/smartmonitoring",
          "awslogs-region": "ap-south-1",
          "awslogs-stream-prefix": "backend"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget -qO- http://localhost:8080/actuator/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

Register it:
```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json
```

### Step 6.4 — Create CloudWatch Log Group

```bash
aws logs create-log-group \
  --log-group-name /ecs/smartmonitoring \
  --region ap-south-1
```

### Step 6.5 — Create Application Load Balancer

```bash
# Create ALB in public subnets
aws elbv2 create-load-balancer \
  --name smartmonitoring-alb \
  --subnets subnet-public-1a subnet-public-1b \
  --security-groups sg-alb-id \
  --scheme internet-facing \
  --type application

# Create target group
aws elbv2 create-target-group \
  --name sm-backend-tg \
  --protocol HTTP \
  --port 8080 \
  --vpc-id vpc-0abc123 \
  --target-type ip \
  --health-check-path /actuator/health \
  --health-check-interval-seconds 30

# Create HTTPS listener (requires ACM certificate)
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

### Step 6.6 — Create ECS Service

```bash
aws ecs create-service \
  --cluster smartmonitoring-cluster \
  --service-name smartmonitoring-service \
  --task-definition smartmonitoring-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration '{
    "awsvpcConfiguration": {
      "subnets": ["subnet-private-1a", "subnet-private-1b"],
      "securityGroups": ["sg-ecs-id"],
      "assignPublicIp": "DISABLED"
    }
  }' \
  --load-balancers '[{
    "targetGroupArn": "arn:aws:elasticloadbalancing:...",
    "containerName": "smart-monitoring-backend",
    "containerPort": 8080
  }]'
```

---

## Phase 7 — Frontend Deployment (S3 + CloudFront)

### Step 7.1 — Create S3 Bucket

```bash
aws s3 mb s3://smartmonitoring-ui --region ap-south-1

# Block all public access (CloudFront will serve it, not S3 directly)
aws s3api put-public-access-block \
  --bucket smartmonitoring-ui \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,\
    BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### Step 7.2 — Build and Upload Frontend

```bash
cd smart-monitoring-ui

# Set production API URL
VITE_API_BASE_URL=https://api.yourdomain.com npm run build

# Upload to S3
aws s3 sync dist/ s3://smartmonitoring-ui \
  --delete \
  --cache-control "public, max-age=31536000, immutable"

# index.html must not be cached
aws s3 cp dist/index.html s3://smartmonitoring-ui/index.html \
  --cache-control "no-cache"
```

### Step 7.3 — Create CloudFront Distribution

1. Go to **AWS Console → CloudFront → Create distribution**
2. Origin: select your S3 bucket
3. Origin access: **Origin access control (OAC)** — creates a policy so only CloudFront can read S3
4. Default root object: `index.html`
5. Custom error pages: add `403 → /index.html` and `404 → /index.html` (required for React Router)
6. Price class: **Use only North America and Europe** or **All locations** depending on budget
7. Create distribution — note the CloudFront domain (e.g. `d1abc.cloudfront.net`)

---

## Phase 8 — Domain & SSL (Optional but recommended)

### Step 8.1 — Request ACM Certificate

```bash
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names "*.yourdomain.com" \
  --validation-method DNS \
  --region us-east-1   # must be us-east-1 for CloudFront
```

Add the DNS validation record to your domain registrar, then wait for validation.

### Step 8.2 — Add domain to CloudFront

In the CloudFront distribution settings:
- Alternate domain names (CNAMEs): `app.yourdomain.com`
- SSL certificate: select the ACM certificate

### Step 8.3 — Add domain to ALB

- Add HTTPS listener with ACM cert
- Point `api.yourdomain.com` DNS record to the ALB DNS name

---

## Phase 9 — GitHub Actions CI/CD Setup

### Step 9.1 — Add secrets to GitHub repo

Go to your GitHub repo → **Settings → Secrets and variables → Actions**

**Secrets** (sensitive values):
```
AWS_ACCESS_KEY_ID         → IAM user access key
AWS_SECRET_ACCESS_KEY     → IAM user secret key
```

**Variables** (non-sensitive):
```
AWS_REGION                → ap-south-1
ECR_REPOSITORY            → smart-monitoring-backend
ECS_CLUSTER               → smartmonitoring-cluster
ECS_SERVICE               → smartmonitoring-service
ECS_TASK_DEFINITION       → smartmonitoring-task
CONTAINER_NAME            → smart-monitoring-backend
S3_BUCKET                 → smartmonitoring-ui
CLOUDFRONT_DISTRIBUTION   → E1ABCDEF123456
VITE_API_BASE_URL         → https://api.yourdomain.com
```

### Step 9.2 — Verify workflows are in place

The repo already contains:
```
.github/workflows/deploy-backend.yml   ← triggers on src/** changes
.github/workflows/deploy-frontend.yml  ← triggers on smart-monitoring-ui/** changes
```

### Step 9.3 — Test the pipeline

```bash
# Make a small change and push
git add .
git commit -m "test: trigger CI pipeline"
git push origin main
```

Go to GitHub → **Actions** tab — you should see both workflows running.

Backend deploy takes ~3-4 minutes. Frontend deploy takes ~1-2 minutes.

---

## Phase 10 — Post-Deployment Verification

### Check backend is healthy

```bash
curl https://api.yourdomain.com/actuator/health
# Expected: {"status":"UP"}
```

### Check frontend loads

Open `https://app.yourdomain.com` — you should see the login page.

### Seed admin user

Connect to RDS via a bastion host or RDS Query Editor:
```sql
INSERT INTO users (user_id, email, password, name, role, tower_number, flat_number, created_at, updated_at)
VALUES (
  'admin@society.com',
  'admin@society.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhe2',
  'Society Admin',
  'ADMIN',
  NULL,
  'OFFICE',
  NOW(), NOW()
);
```

### Run Liquibase check

Liquibase runs automatically on startup. Check ECS logs in CloudWatch:
```
/ecs/smartmonitoring → backend → latest stream
```

---

## Cost Summary (ap-south-1 / Mumbai)

| Service | Spec | Est. Monthly |
|---|---|---|
| ECS Fargate | 0.5 vCPU, 1GB RAM | ~$12 |
| RDS PostgreSQL | db.t3.micro, 20GB | ~$15 |
| ALB | Standard | ~$16 |
| CloudFront | Low traffic | ~$1 |
| S3 | < 1GB | < $1 |
| NAT Gateway | 1 AZ | ~$35 |
| AWS IoT Core | Low message volume | ~$2 |
| CloudWatch Logs | 5GB/month | ~$3 |
| **Total** | | **~$85/month** |

> NAT Gateway is the most expensive item. For development/staging, you can skip it and assign public IPs to ECS tasks temporarily. For production it's required.

---

## Troubleshooting

**ECS task keeps restarting**
```bash
# Check task logs
aws logs get-log-events \
  --log-group-name /ecs/smartmonitoring \
  --log-stream-name backend/smart-monitoring-backend/TASK_ID
```

**Cannot connect to RDS**
- Verify ECS security group is allowed on RDS security group port 5432
- Check RDS is in the same VPC as ECS

**GitHub Actions failing**
- Verify all secrets and variables are set in repo settings
- Check IAM user has all required policies
- Ensure ECR repository exists before first push

**CloudFront returning old files**
```bash
aws cloudfront create-invalidation \
  --distribution-id E1ABCDEF123456 \
  --paths "/*"
```

**Frontend can't reach API (CORS error)**
- Verify `CORS_ALLOWED_ORIGINS` in ECS task definition matches CloudFront domain exactly
- Check ALB security group allows inbound HTTPS (443) from internet
