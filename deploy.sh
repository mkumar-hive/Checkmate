#!/bin/bash

# Checkmate Production Deployment Script
# This script automates the deployment process

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose (try both new and old command formats)
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    else
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    print_status "All prerequisites met"
}

# Setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    # Check if .env.production exists
    if [ ! -f .env.production ]; then
        if [ -f .env.production.example ]; then
            print_warning ".env.production not found, copying from example..."
            cp .env.production.example .env.production
            print_warning "Please edit .env.production with your configuration"
            exit 1
        else
            print_error ".env.production.example not found"
            exit 1
        fi
    fi
    
    # Load environment variables
    export $(cat .env.production | grep -v '^#' | xargs)
    print_status "Environment variables loaded"
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p docker/production/nginx/conf.d
    mkdir -p docker/production/mongo/init
    mkdir -p logs/server
    mkdir -p ssl/certs
    mkdir -p backups
    
    print_status "Directories created"
}

# Build Docker images
build_images() {
    print_status "Building Docker images..."
    
    $DOCKER_COMPOSE -f production-docker-compose.yml build --no-cache
    
    print_status "Docker images built successfully"
}

# Start services
start_services() {
    print_status "Starting services..."
    
    $DOCKER_COMPOSE -f production-docker-compose.yml up -d
    
    print_status "Services started"
}

# Wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to be healthy..."
    
    # Wait for MongoDB
    echo -n "Waiting for MongoDB..."
    until docker exec checkmate-mongodb mongosh --eval "db.adminCommand('ping')" &> /dev/null; do
        echo -n "."
        sleep 2
    done
    echo " Ready!"
    
    # Wait for Redis
    echo -n "Waiting for Redis..."
    until docker exec checkmate-redis redis-cli ping &> /dev/null; do
        echo -n "."
        sleep 2
    done
    echo " Ready!"
    
    # Wait for Server
    echo -n "Waiting for Server..."
    until curl -f http://localhost:52345/api/v1/auth/users/superadmin &> /dev/null; do
        echo -n "."
        sleep 2
    done
    echo " Ready!"
    
    print_status "All services are healthy"
}

# Show deployment info
show_info() {
    echo ""
    echo "======================================"
    echo "   Checkmate Deployment Complete!"
    echo "======================================"
    echo ""
    print_status "Frontend: http://localhost"
    print_status "API: http://localhost:52345/api/v1"
    echo ""
    echo "Next steps:"
    echo "1. Access the frontend and create your first admin account"
    echo "2. Configure monitors and notifications"
    echo "3. Set up SSL certificates for production use"
    echo ""
    echo "Useful commands:"
    echo "  View logs:    $DOCKER_COMPOSE -f production-docker-compose.yml logs -f"
    echo "  Stop:         $DOCKER_COMPOSE -f production-docker-compose.yml down"
    echo "  Restart:      $DOCKER_COMPOSE -f production-docker-compose.yml restart"
    echo ""
}

# Main deployment flow
main() {
    echo "======================================"
    echo "   Checkmate Production Deployment"
    echo "======================================"
    echo ""
    
    check_prerequisites
    setup_environment
    create_directories
    
    # Ask for confirmation
    echo ""
    read -p "Ready to deploy? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Deployment cancelled"
        exit 1
    fi
    
    build_images
    start_services
    wait_for_services
    show_info
}

# Run main function
main