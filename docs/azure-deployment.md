# Azure Deployment Plan for Driver Tracker

This plan outlines deploying the Driver Tracker app to Microsoft Azure using:
- **Azure Container Registry (ACR)** for storing the Docker image
- **Azure App Service** (Linux) for running the container
- **Azure Database for PostgreSQL Flexible Server** as the managed database
- Optional: Azure Key Vault for secrets, Azure Monitor for logging

## Prerequisites
- Azure subscription
- Azure CLI installed and logged in (`az login`)
- Docker installed locally
- Git repository pushed to GitHub (or Azure Repos)

## Step‑by‑Step

### 1. Provision Azure Resources
```bash
# Set variables (adjust as needed)
RESOURCE_GROUP=driver-tracker-rg
LOCATION=eastus
ACR_NAME=drivertrackeracr$(openssl rand -hex 3)   # must be globally unique
APP_SERVICE_NAME=drivertracker-app$(openssl rand -hex 3)
POSTGRES_NAME=drivertracker-pg$(openssl rand -hex 3)
POSTGRES_ADMIN=pgadmin
POSTGRES_PASSWORD=$(openssl rand -base64 32)   # store securely
```

#### Create resource group
```bash
az group create --name $RESOURCE_GROUP --location $LOCATION
```

#### Create Azure Container Registry
```bash
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true
```

#### Create PostgreSQL Flexible Server
```bash
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_NAME \
  --location $LOCATION \
  --admin-user $POSTGRES_ADMIN \
  --admin-password $POSTGRES_PASSWORD \
  --sku-name B_Standard_B1s \
  --tier Burstable \
  --storage-size 32 \
  --version 15 \
  --yes
```

Retrieve the PostgreSQL connection string:
```bash
POSTGRES_CONNECTION=$(az postgres flexible-server show-connection-string \
  --name $POSTGRES_NAME \
  --resource-group $RESOURCE_GROUP \
  --client diesel \
  -o tsv)
# Result format: Host=<host>;Port=5432;Database=postgres;Username=<username>;Password=<password>
# Convert to DATABASE_URL: postgresql://<username>:<password>@<host>:5432/postgres?sslmode=require
```

### 2. Build and Push Docker Image to ACR
```bash
# Log in to ACR
az acr login --name $ACR_NAME

# Build the image (using the existing Dockerfile)
docker build -t $ACR_NAME.azurecr.io/driver-tracker:latest .

# Push
docker push $ACR_NAME.azurecr.io/driver-tracker:latest
```

### 3. Create Azure App Service (Linux) with Docker Container
```bash
# Create App Service plan
az appservice plan create \
  --name $APP_SERVICE_NAME-plan \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku B1 \
  --is-linux

# Create the web app
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_NAME-plan \
  --name $APP_SERVICE_NAME \
  --deployment-container-image-name $ACR_NAME.azurecr.io/driver-tracker:latest

# Configure ACR credentials for the web app
az webapp config container set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name $ACR_NAME.azurecr.io/driver-tracker:latest \
  --docker-registry-server-url https://$ACR_NAME.azurecr.io \
  --docker-registry-server-user $(az acr credential show --name $ACR_NAME --query username -o tsv) \
  --docker-registry-server-password $(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)
```

### 4. Set Environment Variables in App Service
```bash
# Convert PostgreSQL connection string to DATABASE_URL format
# Example: postgresql://pgadmin:password@hostname:5432/postgres?sslmode=require
DATABASE_URL="postgresql://$POSTGRES_ADMIN:$POSTGRES_PASSWORD@$POSTGRES_NAME.postgres.database.azure.com:5432/postgres?sslmode=require"

# Generate other secrets
NEXTAUTH_SECRET=$(openssl rand -base64 32)
SETTINGS_ENCRYPTION_KEY=$(openssl rand -base64 32)
NEXTAUTH_URL="https://$APP_SERVICE_NAME.azurewebsites.net"

# Apply to App Service
az webapp config appsettings set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings DATABASE_URL="$DATABASE_URL" \
             NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
             NEXTAUTH_URL="$NEXTAUTH_URL" \
             SETTINGS_ENCRYPTION_KEY="$SETTINGS_ENCRYPTION_KEY" \
             AUTO_SEED_ON_EMPTY_DB=true \
             MIGRATION_MAX_RETRIES=10 \
             MIGRATION_RETRY_DELAY_SECONDS=5
# Add optional provider secrets if needed (Twilio, Microsoft Graph)
```

### 5. Enable Automatic Deployments (Optional)
- **Option A**: Use Azure Container Registry webhook to trigger App Service redeploy on new image push.
- **Option B**: Use GitHub Actions to build & push to ACR, then Azure App Service webhook for sync.

### 6. Database Migrations on Startup
The existing Dockerfile/entrypoint.sh already runs `prisma migrate deploy` on container start (see `entrypoint.sh`). Ensure the App Service starts the container with that entrypoint (it does by default).

### 7. Verify Deployment
- Browse to `https://<APP_SERVICE_NAME>.azurewebsites.net`
- Test driver check‑in/check‑out, admin login, notification settings.
- Check logs: `az webapp log tail --name $APP_SERVICE_NAME --resource-group $RESOURCE_GROUP`

### 8. Monitoring & Scaling
- Enable Azure Monitor for App Service (metrics, logs).
- Scale up the App Service plan or increase PostgreSQL compute tier as needed.
- Set up auto‑scale rules based on CPU/memory.

### 9. Backup & Disaster Recovery
- Enable PostgreSQL backup retention (flexible server includes configurable backup).
- For App Service, use Azure Backup or clone the app/stage slots.
- Document restore steps: copy backup, restore PostgreSQL, redeploy image.

## Coolify API Usage (Answer to Your Question)
Yes, Coolify provides a REST and GraphQL API that you can use to automate the steps in the Coolify plan:
- **Create a server**: `POST /api/v1/servers`
- **Add an application**: `POST /api/v1/applications`
- **Set environment variables**: `PATCH /api/v1/applications/:id`
- **Trigger a deploy**: `POST /api/v1/applications/:id/deploys`
You would need an API token from your Coolify user settings. This allows you to script the entire Coolify setup from CI/CD or a management tool.

---
*Plan generated on $(date). Adjust names, locations, and SKUs to match your workload and budget.*